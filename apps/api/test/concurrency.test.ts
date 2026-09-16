import test from 'node:test';
import assert from 'node:assert';
import { main } from './concurrency.load';

test('Concurrency & Load Test Suite: Booking, Call-Next, and State Transitions', async () => {
  const res = await main();
  assert.strictEqual(res.allPassed, true, 'All concurrency and load test scenarios must pass with 100% rate');
});
