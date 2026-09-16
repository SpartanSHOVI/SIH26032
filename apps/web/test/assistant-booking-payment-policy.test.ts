import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCenterPaymentPolicy } from '../src/services/paymentPolicy';

describe('Assistant booking payment UI policy', () => {
  it('selects cash as the only valid presentation for call bookings', () => {
    assert.deepEqual(getCenterPaymentPolicy('call'), {
      cashOnly: true,
      defaultMethod: 'cash',
      methodLabel: 'Cash at Mandi Counter',
    });
  });

  it('defaults registered portal bookings to PFMS/DBT', () => {
    assert.deepEqual(getCenterPaymentPolicy('app'), {
      cashOnly: false,
      defaultMethod: 'online',
      methodLabel: 'PFMS / DBT Online',
    });
  });
});
