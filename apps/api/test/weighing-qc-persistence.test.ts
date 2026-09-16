import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService, first, rows } from '../src/infrastructure/database/database.service';
import { EventsService } from '../src/infrastructure/events/events.service';
import { AuditService, toEntityUuid } from '../src/infrastructure/audit/audit.service';
import { ProcurementService } from '../src/modules/procurement/procurement.service';

describe('Weighing & QC Field Persistence Integration Test', () => {
  let db: DatabaseService;
  let events: EventsService;
  let audit: AuditService;
  let procurementService: ProcurementService;

  let testTokenId: string;
  let testCenterId: string;
  let testFarmerId: string;
  let testSlotId: string;
  const testTokenNumber = 987654;

  before(async () => {
    db = new DatabaseService();
    events = new EventsService(db);
    audit = new AuditService(db);
    procurementService = new ProcurementService(db, events, audit);

    // Fetch or verify existing seed center, farmer, and slot
    const center = await first<any>(db, `select id from centers limit 1`);
    assert.ok(center, 'Must have at least one center in database');
    testCenterId = center.id;

    let farmer = await first<any>(db, `select id from farmers limit 1`);
    if (!farmer) {
      await rows(
        db,
        `insert into farmers (id, name, mobile, crop, quantity, created_at, updated_at)
         values (gen_random_uuid(), 'Integration Test Farmer', '9876543210', 'Wheat', 30, now(), now())`,
      );
      farmer = await first<any>(db, `select id from farmers where mobile = '9876543210'`);
    }
    testFarmerId = farmer.id;

    let slot = await first<any>(db, `select id from slots where center_id = $1 limit 1`, testCenterId);
    if (!slot) {
      await rows(
        db,
        `insert into slots (center_id, slot_date, start_time, end_time, total_slots, booked_count, created_at)
         values ($1, current_date, '10:00:00', '11:00:00', 50, 0, now())`,
        testCenterId,
      );
      slot = await first<any>(db, `select id from slots where center_id = $1 limit 1`, testCenterId);
    }
    testSlotId = slot.id;

    // Clean up any stale test token
    await rows(db, `delete from tokens where token_number = $1`, testTokenNumber);

    // Insert fresh test token in 'booked' state
    const inserted = await first<any>(
      db,
      `insert into tokens (
        token_number, center_id, farmer_id, slot_id, status, payment_status, created_at, updated_at
      ) values ($1, $2, $3, $4, 'booked', 'PENDING', now(), now())
      returning id`,
      testTokenNumber,
      testCenterId,
      testFarmerId,
      testSlotId,
    );
    assert.ok(inserted, 'Failed to insert test token');
    testTokenId = String(inserted.id);
  });

  after(async () => {
    // Clean up created integration test token and associated audit records
    if (testTokenId) {
      await rows(db, `delete from audit_events where entity_id = $1::uuid`, toEntityUuid(testTokenId)).catch(() => {});
      await rows(db, `delete from event_outbox where payload->>'tokenNumber' = $1`, String(testTokenNumber));
      await rows(db, `delete from tokens where id = $1::bigint`, testTokenId);
    }
    await db.onModuleDestroy();
  });

  it('1. should persist gate-entry transition to arrived', async () => {
    const res = await procurementService.gateEntry(testTokenId, 'STAFF_GATE_1');
    assert.equal(res.status, 'arrived');
    assert.equal(res.lotStatus, 'GATE_ENTRY');

    // Verify in database
    const dbRecord = await first<any>(db, `select status from tokens where id = $1::bigint`, testTokenId);
    assert.equal(dbRecord?.status, 'arrived');
  });

  it('2. should persist weighing fields (gross_weight, tare_weight, net_weight) round-trip through Prisma', async () => {
    const grossWeight = 4250.75;
    const tareWeight = 1250.25;
    const expectedNetWeight = 3000.5;

    const res = await procurementService.weighing(
      testTokenId,
      {
        gross_weight: grossWeight,
        tare_weight: tareWeight,
      },
      'STAFF_WEIGH_1',
    );

    assert.equal(res.status, 'verification');
    assert.equal(res.gross_weight, grossWeight);
    assert.equal(res.tare_weight, tareWeight);
    assert.equal(res.net_weight, expectedNetWeight);

    // Direct database verification via Prisma raw query
    const dbRecord = await first<any>(
      db,
      `select status, gross_weight, tare_weight, net_weight, staff_id
         from tokens
        where id = $1::bigint`,
      testTokenId,
    );

    assert.ok(dbRecord);
    assert.equal(dbRecord.status, 'verification');
    assert.equal(Number(dbRecord.gross_weight), grossWeight);
    assert.equal(Number(dbRecord.tare_weight), tareWeight);
    assert.equal(Number(dbRecord.net_weight), expectedNetWeight);
    assert.equal(dbRecord.staff_id, 'STAFF_WEIGH_1');
  });

  it('3. should persist quality-check fields (moisture_percent, quality_pass) round-trip through Prisma', async () => {
    const moisture = 12.4;
    const qualityPass = true;

    const res = await procurementService.qualityCheck(
      testTokenId,
      {
        moisture_percent: moisture,
        quality_pass: qualityPass,
      },
      'STAFF_QC_1',
    );

    assert.equal(res.status, 'quality_check');
    assert.equal(res.moisture_percent, moisture);
    assert.equal(res.quality_pass, qualityPass);

    // Direct database verification
    const dbRecord = await first<any>(
      db,
      `select status, moisture_percent, quality_pass, staff_id
         from tokens
        where id = $1::bigint`,
      testTokenId,
    );

    assert.ok(dbRecord);
    assert.equal(dbRecord.status, 'quality_check');
    assert.equal(Number(dbRecord.moisture_percent), moisture);
    assert.equal(dbRecord.quality_pass, true);
    assert.equal(dbRecord.staff_id, 'STAFF_QC_1');
  });

  it('4. should accept lot and verify audit trail persistence', async () => {
    const res = await procurementService.lotAccepted(testTokenId, 'STAFF_MANAGER_1');
    assert.equal(res.status, 'accepted');
    assert.equal(res.lotStatus, 'ACCEPTED');

    // Verify audit logs were written atomically for each transition
    const auditEntries = await rows<any>(
      db,
      `select action, actor_id, before_state, after_state
         from audit_events
        where entity_id = $1::text
        order by created_at asc`,
      toEntityUuid(testTokenId),
    );

    // Expecting 4 audit events: GATE_ENTRY, WEIGHING, QUALITY_CHECK, LOT_ACCEPTED
    assert.ok(auditEntries.length >= 4, `Expected at least 4 audit entries, found ${auditEntries.length}`);
    const actions = auditEntries.map(e => e.action);
    assert.ok(actions.includes('GATE_ENTRY'));
    assert.ok(actions.includes('WEIGHING'));
    assert.ok(actions.includes('QUALITY_CHECK'));
    assert.ok(actions.includes('LOT_ACCEPTED'));
  });
});
