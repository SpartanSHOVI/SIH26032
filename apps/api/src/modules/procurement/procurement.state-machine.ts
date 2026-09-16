import { ConflictException } from '@nestjs/common';
import { DOMAIN_STATES, ProcurementState } from './procurement.types';

export function getExpectedNextState(currentState: string): string | null {
  const current = currentState.toLowerCase();
  const index = DOMAIN_STATES.indexOf(current as any);
  if (index >= 0 && index < DOMAIN_STATES.length - 1) {
    return DOMAIN_STATES[index + 1];
  }
  return null;
}

export const getNextExpectedProcurementState = getExpectedNextState;

export function isTerminalProcurementState(state: string): boolean {
  const s = state.toLowerCase();
  return s === 'rejected' || s === 'payment_completed';
}

export function canTransitionToRejected(state: string): boolean {
  return !isTerminalProcurementState(state);
}

export interface TransitionValidationResult {
  valid: boolean;
  currentState: string;
  targetState: string;
  expectedNext: string | null;
}

export function validateProcurementTransition(currentState: string, targetState: string): TransitionValidationResult {
  const current = currentState.toLowerCase();
  const target = targetState.toLowerCase();

  // Terminal states cannot transition to any other state
  if (current === 'rejected') {
    throw new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      message: `Cannot transition from terminal state 'rejected'. Token has already been rejected.`,
      currentState: current,
      expectedState: null,
      requestedState: target,
    });
  }

  if (current === 'payment_completed') {
    throw new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      message: `Cannot transition from terminal state 'payment_completed'. Process is already complete.`,
      currentState: current,
      expectedState: null,
      requestedState: target,
    });
  }

  // Rejection is valid from any non-terminal state
  if (target === 'rejected') {
    return {
      valid: true,
      currentState: current,
      targetState: target,
      expectedNext: 'rejected',
    };
  }

  const expected = getExpectedNextState(current);

  // Idempotent: transition to same state is a no-op
  if (current === target) {
    return {
      valid: true,
      currentState: current,
      targetState: target,
      expectedNext: expected,
    };
  }

  if (target !== expected) {
    throw new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      message: `Invalid state transition from '${current}' to '${target}'. Expected next state is '${expected}'.`,
      currentState: current,
      expectedState: expected,
      requestedState: target,
    });
  }

  return {
    valid: true,
    currentState: current,
    targetState: target,
    expectedNext: expected,
  };
}
