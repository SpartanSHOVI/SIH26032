import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService, first, rows } from '../src/infrastructure/database/database.service';
import { EventsService } from '../src/infrastructure/events/events.service';
import { AuditService } from '../src/infrastructure/audit/audit.service';
import { AdminService } from '../src/modules/admin/admin.service';

describe('Admin Mandi Rebalance Integration Tests', () => {
  let db: DatabaseService;
  let events: EventsService;
  let audit: AuditService;
  let adminService: AdminService;

  const srcCenterId = '22222222-3333-4444-5555-666666666661';
  const tgtCenterId = '22222222-3333-4444-5555-666666666662';
  const testDate = '2026-09-15';

  before(async () => {
    db = new DatabaseService();
    events = new EventsService(db);
    audit = new AuditService(db);
    adminService = new AdminService(db, events, audit);

    // Clean up test data
    await rows(db, `delete from audit_events where entity_type = 'MANDI_REBALANCE' and metadata->>'source_center_id' in ($1, $2)`, srcCenterId, tgtCenterId);
    await rows(db, `delete from daily_capacity where center_id in ($1::uuid, $2::uuid)`, srcCenterId, tgtCenterId);
    await rows(db, `delete from centers where id in ($1::uuid, $2::uuid)`, srcCenterId, tgtCenterId);

    // Insert 2 test centers:
    // Target center capacity: max_capacity = 30, booked_count = 20 -> remaining = 10
    await rows(
      db,
      `insert into centers (id, code, name, state, state_code, district, capacity_per_hour, active)
       values ($1::uuid, 'REB_SRC', 'Source Mandi A', 'Punjab', 'PB', 'Ludhiana', 25, true),
              ($2::uuid, 'REB_TGT', 'Target Mandi B', 'Punjab', 'PB', 'Ludhiana', 25, true)`,
      srcCenterId,
      tgtCenterId,
    );

    await rows(
      db,
      `insert into daily_capacity (id, center_id, capacity_date, max_capacity, booked_count)
       values (gen_random_uuid(), $1::uuid, $2::date, 30, 20)`,
      tgtCenterId,
      testDate,
    );
  });

  after(async () => {
    await rows(db, `delete from audit_events where entity_type = 'MANDI_REBALANCE' and metadata->>'source_center_id' in ($1, $2)`, srcCenterId, tgtCenterId);
    await rows(db, `delete from daily_capacity where center_id in ($1::uuid, $2::uuid)`, srcCenterId, tgtCenterId);
    await rows(db, `delete from centers where id in ($1::uuid, $2::uuid)`, srcCenterId, tgtCenterId);
    await db.onModuleDestroy();
  });

  // Test Case 1: Valid rebalance succeeds and records audit log
  it('1. should validate and record a valid rebalance request within available target capacity', async () => {
    const res = await adminService.rebalanceMandi({
      source_center: srcCenterId,
      target_center: tgtCenterId,
      token_count: 5, // Target has 10 remaining room, so 5 is valid
      date: testDate,
      idempotency_key: 'test-rebalance-valid-key-1',
    });

    assert.equal(res.success, true);
    assert.equal(res.tokens_shifted, 5);
    assert.equal(res.is_duplicate, false);
    assert.equal(res.source_center_id, srcCenterId);
    assert.equal(res.target_center_id, tgtCenterId);
    assert.ok(res.rebalance_id);

    // Verify audit log record exists
    const auditRecord = await first<any>(
      db,
      `select * from audit_events where entity_type = 'MANDI_REBALANCE' and entity_id = $1`,
      res.rebalance_id,
    );
    assert.ok(auditRecord, 'Rebalance must be recorded in audit_events');
    assert.equal(auditRecord.action, 'MANDI_REBALANCE');
    assert.equal(auditRecord.after_state.tokens_shifted, 5);

    // Verify daily_capacity was updated: booked_count was 20, now 25
    const capRecord = await first<any>(
      db,
      `select booked_count from daily_capacity where center_id = $1::uuid and capacity_date = $2::date`,
      tgtCenterId,
      testDate,
    );
    assert.equal(capRecord?.booked_count, 25);
  });

  // Test Case 2: Nonexistent center is rejected with 404
  it('2. should reject rebalance request against nonexistent center with 404', async () => {
    await assert.rejects(
      async () => {
        await adminService.rebalanceMandi({
          source_center: srcCenterId,
          target_center: '00000000-0000-0000-0000-000000000000',
          token_count: 5,
          date: testDate,
        });
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundException);
        assert.equal(err.getStatus(), 404);
        assert.match(err.message, /Target center '.*' not found/);
        return true;
      },
    );

    await assert.rejects(
      async () => {
        await adminService.rebalanceMandi({
          source_center: '00000000-0000-0000-0000-000000000000',
          target_center: tgtCenterId,
          token_count: 5,
          date: testDate,
        });
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundException);
        assert.equal(err.getStatus(), 404);
        assert.match(err.message, /Source center '.*' not found/);
        return true;
      },
    );
  });

  // Test Case 3: Request exceeding target capacity is rejected with 409
  it('3. should reject rebalance request that exceeds target center capacity with 409', async () => {
    // Current target has max_capacity = 30, booked = 25 -> remaining is 5.
    // Requesting 10 should be rejected!
    await assert.rejects(
      async () => {
        await adminService.rebalanceMandi({
          source_center: srcCenterId,
          target_center: tgtCenterId,
          token_count: 10,
          date: testDate,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        const res = err.getResponse();
        assert.ok(res.remaining_room < 10);
        assert.equal(res.requested_count, 10);
        return true;
      },
    );
  });

  // Test Case 4: Repeat/duplicate request is handled deterministically (not duplicated)
  it('4. should handle duplicate rebalance request deterministically without creating duplicate audit rows', async () => {
    const auditCountBefore = await first<{ count: number }>(
      db,
      `select count(*)::int as count from audit_events where entity_type = 'MANDI_REBALANCE'`,
    );

    // Call rebalance with the same idempotency key used in test 1
    const res = await adminService.rebalanceMandi({
      source_center: srcCenterId,
      target_center: tgtCenterId,
      token_count: 5,
      date: testDate,
      idempotency_key: 'test-rebalance-valid-key-1',
    });

    assert.equal(res.success, true);
    assert.equal(res.is_duplicate, true, 'Repeat request must be flagged as duplicate');
    assert.match(res.message, /Idempotent request/);

    const auditCountAfter = await first<{ count: number }>(
      db,
      `select count(*)::int as count from audit_events where entity_type = 'MANDI_REBALANCE'`,
    );

    assert.equal(
      auditCountAfter?.count,
      auditCountBefore?.count,
      'Audit log count must NOT increase on duplicate replay',
    );
  });
});
