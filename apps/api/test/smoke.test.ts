import test from 'node:test';
import assert from 'node:assert/strict';
import { queueEventSchema } from '@annsetu/contracts';

test('API Smoke Test: Contracts schema verification', () => {
  assert.ok(queueEventSchema, 'queueEventSchema must be defined');
  const validEvent = {
    version: 1 as const,
    eventId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    type: 'QUEUE_UPDATED',
    centerId: '00000000-0000-0000-0000-000000000001',
    timestamp: new Date().toISOString(),
  };
  const parsed = queueEventSchema.safeParse(validEvent);
  assert.strictEqual(parsed.success, true, 'Valid event should parse cleanly');
});
