import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertPfmsEligible, resolvePaymentMethod } from '../src/modules/payments/payment-policy';

describe('Assistant booking payment policy', () => {
  it('allows only cash for a call-created booking', () => {
    assert.equal(resolvePaymentMethod('call', undefined), 'cash');
    assert.equal(resolvePaymentMethod('call', 'cash'), 'cash');
    assert.throws(() => resolvePaymentMethod('call', 'online'), /Use cash payment/);
    assert.throws(() => assertPfmsEligible('call'), /PFMS\/DBT is unavailable/);
  });

  it('keeps online and cash choices for registered portal bookings', () => {
    assert.equal(resolvePaymentMethod('app', undefined), 'online');
    assert.equal(resolvePaymentMethod('app', 'online'), 'online');
    assert.equal(resolvePaymentMethod('app', 'cash'), 'cash');
    assert.doesNotThrow(() => assertPfmsEligible('app'));
  });
});
