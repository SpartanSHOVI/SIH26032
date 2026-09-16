import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService, first, rows } from '../src/infrastructure/database/database.service';
import { EventsService } from '../src/infrastructure/events/events.service';
import { AuditService } from '../src/infrastructure/audit/audit.service';
import { AdminService } from '../src/modules/admin/admin.service';

describe('Admin Analytics Integration Tests (Exact Real Calculations)', () => {
  let db: DatabaseService;
  let events: EventsService;
  let audit: AuditService;
  let adminService: AdminService;

  const testState = 'TestAnalyticsState';
  const centerAId = '33333333-4444-5555-6666-777777777771';
  const centerBId = '33333333-4444-5555-6666-777777777772';
  const centerCId = '33333333-4444-5555-6666-777777777773';

  let testFarmerId: string;
  let slotAId: string;
  let slotBId: string;
  let slotCId: string;

  const testDate = '2026-09-20';
  const otherDate = '2026-09-25';

  before(async () => {
    db = new DatabaseService();
    events = new EventsService(db);
    audit = new AuditService(db);
    adminService = new AdminService(db, events, audit);

    // Clean up any stale data
    await rows(db, `delete from tokens where center_id in ($1::uuid, $2::uuid, $3::uuid)`, centerAId, centerBId, centerCId);
    await rows(db, `delete from slots where center_id in ($1::uuid, $2::uuid, $3::uuid)`, centerAId, centerBId, centerCId);
    await rows(db, `delete from daily_capacity where center_id in ($1::uuid, $2::uuid, $3::uuid)`, centerAId, centerBId, centerCId);
    await rows(db, `delete from centers where id in ($1::uuid, $2::uuid, $3::uuid)`, centerAId, centerBId, centerCId);

    // 1. Create a test farmer
    let farmer = await first<any>(db, `select id from farmers limit 1`);
    if (!farmer) {
      await rows(
        db,
        `insert into farmers (id, name, mobile, crop, quantity, created_at, updated_at)
         values (gen_random_uuid(), 'Analytics Test Farmer', '9998887776', 'Wheat', 30, now(), now())`,
      );
      farmer = await first<any>(db, `select id from farmers where mobile = '9998887776'`);
    }
    testFarmerId = farmer.id;

    // 2. Insert 3 centers in TestAnalyticsState:
    // Center A: cap = 20, counters = 2, avg_processing_min = 6
    // Center B: cap = 10, counters = 1, avg_processing_min = 5
    // Center C: cap = 15, counters = 2, avg_processing_min = 7
    await rows(
      db,
      `insert into centers (id, code, name, state, state_code, district, counters, avg_processing_min, active)
       values ($1::uuid, 'ANALYTICS_A', 'Mandi A (60% Utilized)', $4, 'PB', 'District 1', 2, 6.0, true),
              ($2::uuid, 'ANALYTICS_B', 'Mandi B (80% Utilized)', $4, 'PB', 'District 1', 1, 5.0, true),
              ($3::uuid, 'ANALYTICS_C', 'Mandi C (0% Utilized)',  $4, 'PB', 'District 2', 2, 7.0, true)`,
      centerAId,
      centerBId,
      centerCId,
      testState,
    );

    // 3. Set daily capacity explicitly:
    // Center A: max_capacity = 20
    // Center B: max_capacity = 10
    // Center C: max_capacity = 15
    await rows(
      db,
      `insert into daily_capacity (id, center_id, capacity_date, max_capacity, booked_count)
       values (gen_random_uuid(), $1::uuid, $4::date, 20, 12),
              (gen_random_uuid(), $2::uuid, $4::date, 10, 8),
              (gen_random_uuid(), $3::uuid, $4::date, 15, 0)`,
      centerAId,
      centerBId,
      centerCId,
      testDate,
    );

    // 4. Create slots for the test date:
    const slotARow = await first<any>(
      db,
      `insert into slots (center_id, slot_date, start_time, end_time, total_slots, booked_count, created_at)
       values ($1::uuid, $2::date, '09:00:00', '10:00:00', 20, 12, now())
       returning id`,
      centerAId,
      testDate,
    );
    slotAId = String(slotARow.id);

    const slotBRow = await first<any>(
      db,
      `insert into slots (center_id, slot_date, start_time, end_time, total_slots, booked_count, created_at)
       values ($1::uuid, $2::date, '09:00:00', '10:00:00', 10, 8, now())
       returning id`,
      centerBId,
      testDate,
    );
    slotBId = String(slotBRow.id);

    const slotCRow = await first<any>(
      db,
      `insert into slots (center_id, slot_date, start_time, end_time, total_slots, booked_count, created_at)
       values ($1::uuid, $2::date, '09:00:00', '10:00:00', 15, 0, now())
       returning id`,
      centerCId,
      testDate,
    );
    slotCId = String(slotCRow.id);

    // 5. Seed Center A: 12 tokens total
    // - 6 completed: 3 accepted, 2 procured, 1 payment_completed
    // - 4 waiting: 2 booked, 1 arrived, 1 verification
    // - 2 rejected
    let tNum = 991001;
    const centerAStatuses = [
      'accepted', 'accepted', 'accepted',
      'procured', 'procured',
      'payment_completed',
      'booked', 'booked',
      'arrived',
      'verification',
      'rejected', 'rejected',
    ];

    for (const st of centerAStatuses) {
      await rows(
        db,
        `insert into tokens (token_number, center_id, farmer_id, slot_id, status, payment_status, created_at, updated_at)
         values ($1, $2::uuid, $3::uuid, $4::bigint, $5, 'PENDING', now(), now())`,
        tNum++,
        centerAId,
        testFarmerId,
        slotAId,
        st,
      );
    }

    // 6. Seed Center B: 8 tokens total
    // - 8 completed: all 8 procured
    // - 0 waiting
    const centerBStatuses = [
      'procured', 'procured', 'procured', 'procured',
      'payment_completed', 'payment_completed', 'accepted', 'accepted',
    ];

    for (const st of centerBStatuses) {
      await rows(
        db,
        `insert into tokens (token_number, center_id, farmer_id, slot_id, status, payment_status, created_at, updated_at)
         values ($1, $2::uuid, $3::uuid, $4::bigint, $5, 'CREDITED', now(), now())`,
        tNum++,
        centerBId,
        testFarmerId,
        slotBId,
        st,
      );
    }

    // 7. Center C has 0 tokens seeded (honest zero bookings)
  });

  after(async () => {
    await rows(db, `delete from tokens where center_id in ($1::uuid, $2::uuid, $3::uuid)`, centerAId, centerBId, centerCId);
    await rows(db, `delete from slots where center_id in ($1::uuid, $2::uuid, $3::uuid)`, centerAId, centerBId, centerCId);
    await rows(db, `delete from daily_capacity where center_id in ($1::uuid, $2::uuid, $3::uuid)`, centerAId, centerBId, centerCId);
    await rows(db, `delete from centers where id in ($1::uuid, $2::uuid, $3::uuid)`, centerAId, centerBId, centerCId);
    await db.onModuleDestroy();
  });

  // Integration Test 1: Real capacity utilization calculation
  it('1. should compute exact booking vs capacity utilization (Center A: 12/20 = 60.0%, Center B: 8/10 = 80.0%)', async () => {
    const res = await adminService.getAnalytics(testDate, testState);

    assert.equal(res.centers.length, 3, 'Must return exactly 3 centers for the test state');

    const centerA = res.centers.find(c => c.center_id === centerAId)!;
    assert.ok(centerA);
    assert.equal(centerA.total_bookings, 12, 'Center A must have exactly 12 bookings');
    assert.equal(centerA.capacity, 20, 'Center A capacity must be 20');
    assert.equal(centerA.utilization_pct, 60.0, 'Center A utilization must be exactly 60.0%');

    const centerB = res.centers.find(c => c.center_id === centerBId)!;
    assert.ok(centerB);
    assert.equal(centerB.total_bookings, 8, 'Center B must have exactly 8 bookings');
    assert.equal(centerB.capacity, 10, 'Center B capacity must be 10');
    assert.equal(centerB.utilization_pct, 80.0, 'Center B utilization must be exactly 80.0%');
  });

  // Integration Test 2: Procurement completion rate
  it('2. should compute exact procurement completion rate (Center A: 6/12 = 50.0%, Center B: 8/8 = 100.0%)', async () => {
    const res = await adminService.getAnalytics(testDate, testState);

    const centerA = res.centers.find(c => c.center_id === centerAId)!;
    assert.equal(centerA.completed, 6, 'Center A must have exactly 6 completed tokens');
    assert.equal(centerA.completion_rate_pct, 50.0, 'Center A completion rate must be 50.0%');

    const centerB = res.centers.find(c => c.center_id === centerBId)!;
    assert.equal(centerB.completed, 8, 'Center B must have exactly 8 completed tokens');
    assert.equal(centerB.completion_rate_pct, 100.0, 'Center B completion rate must be 100.0%');
  });

  // Integration Test 3: Rolling average wait time calculation using queue module logic
  it('3. should calculate wait time using queue module formula (Center A: 4 waiting, 2 counters, 6 min = 12 mins; Center B: 0 waiting = 0 mins)', async () => {
    const res = await adminService.getAnalytics(testDate, testState);

    // Center A: waiting = 4, counters = 2, avg = 6.0
    // Formula: Math.max(3, Math.round((4 * 6) / 2)) = 12 mins
    const centerA = res.centers.find(c => c.center_id === centerAId)!;
    assert.equal(centerA.waiting, 4, 'Center A must have exactly 4 waiting tokens');
    assert.equal(centerA.avg_wait_time_mins, 12, 'Center A average wait time must be exactly 12 minutes');

    // Center B: waiting = 0
    // Formula: waiting === 0 ? 0 : ...
    const centerB = res.centers.find(c => c.center_id === centerBId)!;
    assert.equal(centerB.waiting, 0, 'Center B must have 0 waiting tokens');
    assert.equal(centerB.avg_wait_time_mins, 0, 'Center B with 0 waiting must return honest 0 mins');
  });

  // Integration Test 4: Honest zeros on Center C (0 bookings, no synthetic fallback)
  it('4. should return honest zero values for empty Center C without falling back to synthetic hardcoded numbers', async () => {
    const res = await adminService.getAnalytics(testDate, testState);

    const centerC = res.centers.find(c => c.center_id === centerCId)!;
    assert.ok(centerC);
    assert.equal(centerC.total_bookings, 0, 'Must report honest 0 bookings');
    assert.equal(centerC.completed, 0, 'Must report honest 0 completed');
    assert.equal(centerC.waiting, 0, 'Must report honest 0 waiting');
    assert.equal(centerC.utilization_pct, 0.0, 'Must report honest 0.0% utilization');
    assert.equal(centerC.completion_rate_pct, 0.0, 'Must report honest 0.0% completion rate');
    assert.equal(centerC.avg_wait_time_mins, 0, 'Must report honest 0 mins wait time');
    assert.equal(centerC.capacity, 15);
  });

  // Integration Test 5: Date scoping and overall state aggregation
  it('5. should scope aggregations strictly to target date (0 bookings on other date; exact summary sums on test date)', async () => {
    // 5a. Query test date:
    // Total bookings = 12 (A) + 8 (B) + 0 (C) = 20
    // Total capacity = 20 (A) + 10 (B) + 15 (C) = 45
    // Overall utilization = 20 / 45 = 44.4%
    // Total completed = 6 (A) + 8 (B) = 14
    // Overall completion rate = 14 / 20 = 70.0%
    const resTestDate = await adminService.getAnalytics(testDate, testState);
    assert.equal(resTestDate.summary.total_bookings, 20);
    assert.equal(resTestDate.summary.total_capacity, 45);
    assert.equal(resTestDate.summary.overall_utilization_pct, 44.4);
    assert.equal(resTestDate.summary.total_completed, 14);
    assert.equal(resTestDate.summary.completion_rate_pct, 70.0);
    assert.equal(resTestDate.summary.total_waiting, 4);

    // 5b. Query other date with 0 bookings:
    const resOtherDate = await adminService.getAnalytics(otherDate, testState);
    assert.equal(resOtherDate.summary.total_bookings, 0, 'Must return 0 bookings for dates with no activity');
    assert.equal(resOtherDate.summary.total_completed, 0);
    assert.equal(resOtherDate.summary.overall_utilization_pct, 0.0);
    assert.equal(resOtherDate.summary.completion_rate_pct, 0.0);
  });
});
