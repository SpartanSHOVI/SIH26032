import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PfmsAdapterService } from '../src/modules/payments/pfms-adapter.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PaymentStatus } from '../src/modules/payments/payment.types';

describe('Payment PFMS Mock Adapter & Service', () => {
  const pfms = new PfmsAdapterService();

  // Case 1: State PENDING advances to PROCESSING
  it('1. should handle PENDING status and return next state PROCESSING', () => {
    const current: PaymentStatus = 'PENDING';
    const next = pfms.getNextStatus(current);
    assert.equal(next, 'PROCESSING');
  });

  // Case 2: State PROCESSING advances to CREDITED
  it('2. should handle PROCESSING status and return next state CREDITED', () => {
    const current: PaymentStatus = 'PROCESSING';
    const next = pfms.getNextStatus(current);
    assert.equal(next, 'CREDITED');
  });

  // Case 3: State CREDITED is terminal
  it('3. should handle CREDITED status as terminal', () => {
    const current: PaymentStatus = 'CREDITED';
    const next = pfms.getNextStatus(current);
    assert.equal(next, 'CREDITED');
  });

  // Case 4: UTR format validation
  it('4. should generate and validate realistic PFMS UTR format', () => {
    const utr = pfms.generateUtrReference('101');
    assert.match(utr, /^PFMS[A-Z0-9]{8}DBT\d{8}$/);
    assert.equal(pfms.isValidUtrReference(utr), true);

    // Assert invalid UTR rejection
    assert.equal(pfms.isValidUtrReference('INVALID_UTR'), false);
    assert.equal(pfms.isValidUtrReference('PFMS123'), false);
    assert.equal(pfms.isValidUtrReference(''), false);
  });

  // Case 5: PFMS response payload generation
  it('5. should generate deterministic simulated PFMS response payload', () => {
    const utr = pfms.generateUtrReference('202');
    const response = pfms.simulatePfmsResponse(utr, 68250, 'CREDITED');
    assert.equal(response.status, 'CREDITED');
    assert.equal(response.status_code, 'PFMS_SUCCESS');
    assert.equal(response.amount, 68250);
    assert.equal(response.utr_number, utr);
    assert.ok(response.credited_date);
    assert.equal(response.bank_ref_no.startsWith('SBIN'), true);
  });

  // Case 6: Idempotent-upsert no-op behavior and audit log entry count assertion
  it('6. should ensure idempotent-upsert no-op and exact audit log count on replay', async () => {
    // In-memory mock token state
    let tokenState = {
      id: '1001',
      token_number: 1001,
      center_id: '550e8400-e29b-41d4-a716-446655440000',
      farmer_id: '660e8400-e29b-41d4-a716-446655440000',
      status: 'accepted',
      payment_status: 'PENDING',
      payment_amount: 68250,
      transaction_ref: null as string | null,
      payment_at: null as Date | null,
      crop: 'Wheat',
      farmer_quantity: 30,
      net_weight: 30,
      center_name: 'Mandi Center 1',
      slot_date: new Date('2026-09-12'),
      created_at: new Date('2026-09-12T08:00:00Z'),
      updated_at: new Date('2026-09-12T08:00:00Z'),
    };

    const auditLogs: any[] = [];
    const outboxEvents: any[] = [];

    // Mock DatabaseService with $transaction
    const mockDb: any = {
      $transaction: async (cb: any) => {
        const txMock: any = {
          $queryRawUnsafe: async (sql: string, ...params: any[]) => {
            if (sql.includes('for update')) {
              return [{ ...tokenState }];
            }
            if (sql.includes('update tokens')) {
              tokenState.payment_status = params[0];
              tokenState.payment_amount = params[1];
              tokenState.transaction_ref = params[2];
              tokenState.payment_at = params[3];
              tokenState.status = params[0] === 'CREDITED' ? 'payment_completed' : (params[0] === 'PROCESSING' ? 'payment_processing' : tokenState.status);
              return [];
            }
            if (sql.includes('select * from payments')) {
              return [];
            }
            if (sql.includes('select id from procurement_lots')) {
              return [{ id: '770e8400-e29b-41d4-a716-446655440000' }];
            }
            if (sql.includes('insert into payments')) {
              return [];
            }
            if (sql.includes('where t.id = $1')) {
              return [{ ...tokenState }];
            }
            return [];
          },
        };
        return cb(txMock);
      },
    };

    const mockEvents: any = {
      enqueue: async (_tx: any, event: any) => {
        outboxEvents.push(event);
      },
    };

    const mockAudit: any = {
      log: async (_tx: any, entry: any) => {
        auditLogs.push(entry);
      },
    };

    const paymentsService = new PaymentsService(mockDb, mockEvents, mockAudit, pfms);

    // Transition 1: PENDING -> PROCESSING
    const res1 = await paymentsService.updatePaymentStatus('1001', 'PROCESSING');
    assert.equal(res1.status, 'PROCESSING');
    assert.equal(auditLogs.length, 1);
    assert.equal(outboxEvents.length, 1);
    assert.equal(auditLogs[0].beforeState.payment_status, 'PENDING');
    assert.equal(auditLogs[0].afterState.payment_status, 'PROCESSING');

    // IDEMPOTENT REPLAY 1: Call PROCESSING again -> should be NO-OP
    const res1Replay = await paymentsService.updatePaymentStatus('1001', 'PROCESSING');
    assert.equal(res1Replay.status, 'PROCESSING');
    // Audit log count and outbox count must NOT increase on replay!
    assert.equal(auditLogs.length, 1, 'Audit log count must remain 1 after idempotent replay of PROCESSING');
    assert.equal(outboxEvents.length, 1, 'Outbox event count must remain 1 after idempotent replay of PROCESSING');

    // Transition 2: PROCESSING -> CREDITED
    const res2 = await paymentsService.updatePaymentStatus('1001', 'CREDITED');
    assert.equal(res2.status, 'CREDITED');
    assert.ok(res2.utrReference);
    assert.match(res2.utrReference!, /^PFMS[A-Z0-9]{8}DBT\d{8}$/);
    assert.equal(auditLogs.length, 2);
    assert.equal(outboxEvents.length, 2);
    assert.equal(auditLogs[1].beforeState.payment_status, 'PROCESSING');
    assert.equal(auditLogs[1].afterState.payment_status, 'CREDITED');

    // IDEMPOTENT REPLAY 2: Call CREDITED again -> should be NO-OP
    const res2Replay = await paymentsService.updatePaymentStatus('1001', 'CREDITED');
    assert.equal(res2Replay.status, 'CREDITED');
    // Audit log count and outbox count must NOT increase on replay!
    assert.equal(auditLogs.length, 2, 'Audit log count must remain 2 after idempotent replay of CREDITED');
    assert.equal(outboxEvents.length, 2, 'Outbox event count must remain 2 after idempotent replay of CREDITED');
  });
});
