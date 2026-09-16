import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import {
  validateProcurementTransition,
  getNextExpectedProcurementState,
  isTerminalProcurementState,
  canTransitionToRejected,
} from '../src/modules/procurement/procurement.state-machine';
import { ProcurementState } from '../src/modules/procurement/procurement.types';

describe('Procurement State Machine', () => {
  // Case 1: Full happy path traversal
  it('1. should validate full sequential happy path traversal', () => {
    const states: ProcurementState[] = [
      'booked',
      'arrived',
      'verification',
      'quality_check',
      'accepted',
      'procured',
      'payment_processing',
      'payment_completed',
    ];

    for (let i = 0; i < states.length - 1; i++) {
      const current = states[i];
      const next = states[i + 1];
      const result = validateProcurementTransition(current, next);
      assert.equal(result.valid, true);
      assert.equal(result.targetState, next);
      assert.equal(result.expectedNext, next);
    }
  });

  // Cases 2-8: Invalid jump rejection tests for each non-terminal state (7 tests)
  it('2. should reject invalid jump from "booked" directly to "verification" with 409', () => {
    assert.throws(
      () => validateProcurementTransition('booked', 'verification'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        const res = err.getResponse();
        assert.equal(res.currentState, 'booked');
        assert.equal(res.requestedState, 'verification');
        assert.equal(res.expectedState, 'arrived');
        return true;
      },
    );
  });

  it('3. should reject invalid jump from "arrived" directly to "quality_check" with 409', () => {
    assert.throws(
      () => validateProcurementTransition('arrived', 'quality_check'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        const res = err.getResponse();
        assert.equal(res.currentState, 'arrived');
        assert.equal(res.requestedState, 'quality_check');
        assert.equal(res.expectedState, 'verification');
        return true;
      },
    );
  });

  it('4. should reject invalid jump from "verification" directly to "accepted" with 409', () => {
    assert.throws(
      () => validateProcurementTransition('verification', 'accepted'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        const res = err.getResponse();
        assert.equal(res.currentState, 'verification');
        assert.equal(res.requestedState, 'accepted');
        assert.equal(res.expectedState, 'quality_check');
        return true;
      },
    );
  });

  it('5. should reject invalid jump from "quality_check" directly to "procured" with 409', () => {
    assert.throws(
      () => validateProcurementTransition('quality_check', 'procured'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        const res = err.getResponse();
        assert.equal(res.currentState, 'quality_check');
        assert.equal(res.requestedState, 'procured');
        assert.equal(res.expectedState, 'accepted');
        return true;
      },
    );
  });

  it('6. should reject invalid jump from "accepted" directly to "payment_processing" with 409', () => {
    assert.throws(
      () => validateProcurementTransition('accepted', 'payment_processing'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        const res = err.getResponse();
        assert.equal(res.currentState, 'accepted');
        assert.equal(res.requestedState, 'payment_processing');
        assert.equal(res.expectedState, 'procured');
        return true;
      },
    );
  });

  it('7. should reject invalid jump from "procured" directly to "payment_completed" with 409', () => {
    assert.throws(
      () => validateProcurementTransition('procured', 'payment_completed'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        const res = err.getResponse();
        assert.equal(res.currentState, 'procured');
        assert.equal(res.requestedState, 'payment_completed');
        assert.equal(res.expectedState, 'payment_processing');
        return true;
      },
    );
  });

  it('8. should reject invalid backward jump from "payment_processing" to "arrived" with 409', () => {
    assert.throws(
      () => validateProcurementTransition('payment_processing', 'arrived'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        const res = err.getResponse();
        assert.equal(res.currentState, 'payment_processing');
        assert.equal(res.requestedState, 'arrived');
        assert.equal(res.expectedState, 'payment_completed');
        return true;
      },
    );
  });

  // Cases 9-11: Rejection branch tested from multiple non-terminal states
  it('9. should allow transition to "rejected" from "booked"', () => {
    const result = validateProcurementTransition('booked', 'rejected');
    assert.equal(result.valid, true);
    assert.equal(result.targetState, 'rejected');
  });

  it('10. should allow transition to "rejected" from "verification"', () => {
    const result = validateProcurementTransition('verification', 'rejected');
    assert.equal(result.valid, true);
    assert.equal(result.targetState, 'rejected');
  });

  it('11. should allow transition to "rejected" from "quality_check"', () => {
    const result = validateProcurementTransition('quality_check', 'rejected');
    assert.equal(result.valid, true);
    assert.equal(result.targetState, 'rejected');
  });

  // Cases 12-13: Terminal state rejections
  it('12. should reject any transition out of terminal "rejected" state with 409', () => {
    assert.equal(isTerminalProcurementState('rejected'), true);
    assert.equal(canTransitionToRejected('rejected'), false);
    assert.throws(
      () => validateProcurementTransition('rejected', 'arrived'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        assert.match(err.message, /terminal state/);
        return true;
      },
    );
  });

  it('13. should reject any transition out of terminal "payment_completed" state with 409', () => {
    assert.equal(isTerminalProcurementState('payment_completed'), true);
    assert.throws(
      () => validateProcurementTransition('payment_completed', 'booked'),
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(err.getStatus(), 409);
        assert.match(err.message, /terminal state/);
        return true;
      },
    );
  });

  // Case 14: Next expected state utility
  it('14. should accurately return next expected state across all stages', () => {
    assert.equal(getNextExpectedProcurementState('booked'), 'arrived');
    assert.equal(getNextExpectedProcurementState('arrived'), 'verification');
    assert.equal(getNextExpectedProcurementState('verification'), 'quality_check');
    assert.equal(getNextExpectedProcurementState('quality_check'), 'accepted');
    assert.equal(getNextExpectedProcurementState('accepted'), 'procured');
    assert.equal(getNextExpectedProcurementState('procured'), 'payment_processing');
    assert.equal(getNextExpectedProcurementState('payment_processing'), 'payment_completed');
    assert.equal(getNextExpectedProcurementState('payment_completed'), null);
    assert.equal(getNextExpectedProcurementState('rejected'), null);
  });
});
