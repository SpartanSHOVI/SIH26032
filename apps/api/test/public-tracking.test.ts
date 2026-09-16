import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toPublicTrackingView } from '../src/modules/queue/queue.service';

describe('Public assisted-booking tracking projection', () => {
  it('keeps the end-to-end status while redacting private farmer data', () => {
    const result = toPublicTrackingView({
      id: 91,
      farmer_id: 'private-farmer-id',
      token_number: 'APMC-260916-91',
      status: 'payment_processing',
      booked_via: 'call',
      farmer_name: 'Ramesh Kumar',
      mobile: '9876543210',
      aadhaar: '123412341234',
      bank_account: '998877665544',
      ifsc: 'PUNB0123456',
      crop: 'Wheat',
      quantity: 40,
      center_name: 'Khanna Mandi',
      center_location: 'Ludhiana',
      date: '2026-09-17',
      start_time: '10:00',
      end_time: '11:00',
      farmers_ahead: 3,
      current_token: 'APMC-260916-88',
      estimated_wait_min: 11,
      status_flow: ['booked', 'arrived', 'payment_processing', 'payment_completed'],
      payment_status: 'processing',
      payment_amount: 91200,
      transaction_ref: 'PFMS1234567890',
      notifications: [{ message: 'private message' }],
    });

    assert.equal(result.token_number, 'APMC-260916-91');
    assert.equal(result.status, 'payment_processing');
    assert.equal(result.farmers_ahead, 3);
    assert.equal(result.mobile, '******3210');
    assert.equal(result.farmer_name, 'R***** K****');
    assert.ok(result.transaction_ref?.endsWith('7890'));

    const publicKeys = Object.keys(result);
    assert.equal(publicKeys.includes('farmer_id'), false);
    assert.equal(publicKeys.includes('aadhaar'), false);
    assert.equal(publicKeys.includes('bank_account'), false);
    assert.equal(publicKeys.includes('ifsc'), false);
    assert.equal(publicKeys.includes('notifications'), false);
  });
});
