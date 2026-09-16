import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService, first, rows } from '../src/infrastructure/database/database.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { MspService } from '../src/modules/msp/msp.service';

describe('Statutory Minimum Support Price (MSP) Subsystem Tests', () => {
  let db: DatabaseService;
  let redis: RedisService;
  let mspService: MspService;

  before(async () => {
    db = new DatabaseService();
    redis = new RedisService();
    mspService = new MspService(db, redis);
  });

  it('1. should list statutory MSP rates across categories (Cereal, Pulse, Oilseed)', async () => {
    const rates = await mspService.getAllRates();
    assert.ok(Array.isArray(rates), 'Rates should be an array');
    assert.ok(rates.length >= 20, `Expected at least 20 seeded crops, found ${rates.length}`);

    const wheat = rates.find(r => r.crop === 'Wheat');
    assert.ok(wheat, 'Wheat must be present in statutory rates');
    assert.equal(wheat.category, 'Cereal');
    assert.equal(wheat.season, 'Rabi 2025-26');
    assert.ok(wheat.effective_price > 0, 'Effective price must be positive');
  });

  it('2. should fetch rate for specific crop with case-insensitive and fuzzy matching', async () => {
    const wheatRate = await mspService.getRateForCrop('wheat');
    assert.equal(wheatRate.crop, 'Wheat');
    assert.ok(wheatRate.effective_price >= 2275);

    const mustardRate = await mspService.getRateForCrop('Mustard Seed');
    assert.ok(mustardRate.crop.includes('Mustard'));
    assert.ok(mustardRate.effective_price >= 5650);
  });

  it('3. should inscribe a new statutory crop floor with audit logging', async () => {
    const testCropName = `Test Rye ${Date.now()}`;
    const created = await mspService.createRate(
      {
        crop: testCropName,
        category: 'Cereal',
        season: 'Rabi 2025-26',
        price_per_quintal: 2350,
        bonus_per_quintal: 50,
        market_average: 2200,
        notes: 'Statutory test grain floor inscription',
      },
      { sub: 'TEST_NODAL_OFFICER_001', role: 'ADMIN', sid: 'test-session' },
    );

    assert.equal(created.crop, testCropName);
    assert.equal(created.price_per_quintal, 2350);
    assert.equal(created.bonus_per_quintal, 50);
    assert.equal(created.effective_price, 2400);

    // Verify audit log
    const auditLogs = await mspService.getAuditLogs(testCropName);
    assert.ok(auditLogs.length > 0, 'Must have at least 1 audit entry for newly inscribed crop');
    assert.equal(auditLogs[0].new_price, 2350);
    assert.equal(auditLogs[0].new_bonus, 50);
  });

  it('4. should update an existing MSP rate and state bonus with mandatory reason', async () => {
    // Find Wheat record
    const wheat = await first<{ id: string; price_per_quintal: number }>(
      db,
      `select id::text, price_per_quintal::float from msp_rates where crop = 'Wheat' limit 1`,
    );
    assert.ok(wheat, 'Wheat must exist');

    const updated = await mspService.updateRate(
      wheat.id,
      {
        price_per_quintal: 2450,
        bonus_per_quintal: 150,
        reason: 'Cabinet Committee on Economic Affairs (CCEA) Kharif and Rabi revision',
        notes: 'Gazette notification test update',
      },
      { sub: 'TEST_NODAL_OFFICER_001', role: 'ADMIN', sid: 'test-session' },
    );

    assert.equal(updated.price_per_quintal, 2450);
    assert.equal(updated.bonus_per_quintal, 150);
    assert.equal(updated.effective_price, 2600);

    // Verify rate query reflects the updated price
    const fetched = await mspService.getRateForCrop('Wheat');
    assert.equal(fetched.effective_price, 2600);

    // Verify audit record was created with exact delta
    const logs = await mspService.getAuditLogs('Wheat');
    assert.ok(logs.length > 0);
    const latest = logs[0];
    assert.equal(latest.new_price, 2450);
    assert.equal(latest.new_bonus, 150);
    assert.equal(latest.reason, 'Cabinet Committee on Economic Affairs (CCEA) Kharif and Rabi revision');
  });

  it('5. should synchronize against official CCEA / CACP benchmarks and log re-alignment', async () => {
    const syncRes = await mspService.syncOfficialBenchmarks({
      sub: 'AUTOMATED_SYNC_SERVICE',
      role: 'ADMIN',
      sid: 'sync-session',
    });

    assert.ok(syncRes.synced_count >= 1, 'Should have synchronized at least the modified Wheat record');
    assert.ok(syncRes.updated_crops.includes('Wheat'), 'Wheat should have been re-aligned to statutory benchmark 2275');

    // Confirm Wheat is back to statutory baseline
    const wheatAfterSync = await mspService.getRateForCrop('Wheat');
    assert.equal(wheatAfterSync.price_per_quintal, 2275);
  });
});
