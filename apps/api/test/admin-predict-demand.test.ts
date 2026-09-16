import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService, first, rows } from '../src/infrastructure/database/database.service';
import { EventsService } from '../src/infrastructure/events/events.service';
import { AuditService } from '../src/infrastructure/audit/audit.service';
import { AdminService } from '../src/modules/admin/admin.service';

describe('Admin Predict Demand Unit & Integration Tests', () => {
  let db: DatabaseService;
  let events: EventsService;
  let audit: AuditService;
  let adminService: AdminService;

  const steadyCenterId = '11111111-2222-3333-4444-555555555551';
  const trendCenterId = '11111111-2222-3333-4444-555555555552';
  const emptyCenterId = '11111111-2222-3333-4444-555555555553';

  before(async () => {
    db = new DatabaseService();
    events = new EventsService(db);
    audit = new AuditService(db);
    adminService = new AdminService(db, events, audit);

    // Clean up test centers and demand
    await rows(db, `delete from daily_demand where center_id in ($1::uuid, $2::uuid, $3::uuid)`, steadyCenterId, trendCenterId, emptyCenterId);
    await rows(db, `delete from centers where id in ($1::uuid, $2::uuid, $3::uuid)`, steadyCenterId, trendCenterId, emptyCenterId);

    // Create 3 test centers
    await rows(
      db,
      `insert into centers (id, code, name, state, state_code, district, capacity_per_hour, active)
       values ($1::uuid, 'TEST_STEADY', 'Steady Test Mandi', 'Punjab', 'PB', 'Ludhiana', 25, true),
              ($2::uuid, 'TEST_TREND', 'Trend Test Mandi', 'Haryana', 'HR', 'Karnal', 25, true),
              ($3::uuid, 'TEST_EMPTY', 'Empty Test Mandi', 'Maharashtra', 'MH', 'Nashik', 25, true)`,
      steadyCenterId,
      trendCenterId,
      emptyCenterId,
    );

    // Seed steady demand: 7 days of 50 farmers each
    const today = new Date();
    for (let i = 7; i >= 1; i--) {
      const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
      await rows(
        db,
        `insert into daily_demand (center_id, demand_date, farmer_count) values ($1::uuid, $2::date, 50)`,
        steadyCenterId,
        d,
      );
    }

    // Seed upward trending demand: [10, 20, 30, 40, 50] across 5 days (slope = 10, next = 60)
    for (let i = 5; i >= 1; i--) {
      const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
      const count = (6 - i) * 10; // 10, 20, 30, 40, 50
      await rows(
        db,
        `insert into daily_demand (center_id, demand_date, farmer_count) values ($1::uuid, $2::date, $3)`,
        trendCenterId,
        d,
        count,
      );
    }
  });

  after(async () => {
    await rows(db, `delete from daily_demand where center_id in ($1::uuid, $2::uuid, $3::uuid)`, steadyCenterId, trendCenterId, emptyCenterId);
    await rows(db, `delete from centers where id in ($1::uuid, $2::uuid, $3::uuid)`, steadyCenterId, trendCenterId, emptyCenterId);
    await db.onModuleDestroy();
  });

  // Test Case 1: Steady historical demand
  it('1. should project steady demand accurately and document method in metadata', async () => {
    const res = await adminService.predictDemand(steadyCenterId);

    assert.equal(res.center_id, steadyCenterId);
    assert.equal(res.predicted_tomorrow, 50);
    assert.equal(res.expected_demand, 50);
    assert.equal(res.metadata.trend, 'steady');
    assert.equal(res.metadata.sample_count, 7);
    assert.equal(res.confidence, 'high');
    assert.ok(res.metadata.method, 'Method must be specified in metadata');
    assert.match(res.metadata.method, /Trend|Regression|Average/i);
    assert.ok(res.metadata.explanation);
    assert.equal(res.history.length, 7);
  });

  // Test Case 2: Center with zero history (honest fallback, no fabricated numbers)
  it('2. should return honest zero projection for center with zero history', async () => {
    const res = await adminService.predictDemand(emptyCenterId);

    assert.equal(res.center_id, emptyCenterId);
    assert.equal(res.predicted_tomorrow, 0, 'Must return honest 0, not fabricated numbers');
    assert.equal(res.expected_demand, 0);
    assert.equal(res.confidence, 'none');
    assert.equal(res.metadata.sample_count, 0);
    assert.equal(res.metadata.trend, 'insufficient_data');
    assert.ok(res.metadata.explanation.includes('No historical demand records found'));
    assert.equal(res.history.length, 0);
  });

  // Test Case 3: Center with clear upward trend
  it('3. should project linear trend for center with upward demand progression', async () => {
    const res = await adminService.predictDemand(trendCenterId);

    assert.equal(res.center_id, trendCenterId);
    // [10, 20, 30, 40, 50] with slope 10 -> next value projected is 60
    assert.equal(res.predicted_tomorrow, 60);
    assert.equal(res.expected_demand, 60);
    assert.equal(res.metadata.trend, 'upward');
    assert.equal(res.metadata.slope, 10);
    assert.equal(res.metadata.sample_count, 5);
    assert.equal(res.confidence, 'medium');
    assert.ok(res.metadata.method);
  });
});
