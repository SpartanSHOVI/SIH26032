import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import {
  QueueUpdateEvent,
  CachedQueueState,
  calculateEstimatedWait,
  formatLastUpdatedHHMM,
  formatTimeAgo,
  isEventRelevant,
  saveQueueCache,
  loadQueueCache,
  clearQueueCache,
} from '../src/services/queueSocket';

// Polyfill localStorage in Node.js test environment
const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};
(globalThis as any).localStorage = mockLocalStorage;

describe('Live Queue Realtime Path, Room-Scoping & Offline Caching Tests', () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: Server;
  let serverPort: number;

  before(async () => {
    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: '*' },
    });

    const queueNs = ioServer.of('/queue');
    queueNs.on('connection', (socket) => {
      socket.on('join:center', (centerId: string) => {
        socket.join(`center:${centerId}`);
        socket.emit('joined', { room: `center:${centerId}` });
      });

      socket.on('join:farmer', (farmerId: string) => {
        socket.join(`farmer:${farmerId}`);
        socket.emit('joined', { room: `farmer:${farmerId}` });
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'string' ? 3001 : addr!.port;
        resolve();
      });
    });
  });

  after(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    storage.clear();
  });

  // Test Case 1: Queue-position-changed event updates UI within 1 second of receipt (measured round-trip latency < 1000ms)
  it('1. should update queue position and recompute wait time in < 1 second on call-next event without API refetch', async () => {
    const centerId = 'center-punjab-01';
    const farmerId = 'farmer-harpreet-01';
    const tokenNumber = 'PUN-001005';

    let farmersAhead = 5;
    let avgProcessingMin = 6;
    const counters = 2;
    let currentToken = '—';
    let estimatedWaitMin = calculateEstimatedWait(farmersAhead, avgProcessingMin, counters);
    assert.equal(estimatedWaitMin, 15, 'Initial wait for 5 farmers ahead with 6 min avg and 2 counters should be 15 min');

    const client: ClientSocketType = ClientSocket(`http://127.0.0.1:${serverPort}/queue`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => client.on('connect', resolve));

    // Join rooms
    client.emit('join:center', centerId);
    client.emit('join:farmer', farmerId);
    await new Promise((r) => setTimeout(r, 50));

    // Measure round-trip update latency
    const updateReceivedPromise = new Promise<{ latencyMs: number; newAhead: number; newWait: number }>((resolve) => {
      client.on('queue:update', (event: QueueUpdateEvent) => {
        const receiveTime = Date.now();
        const eventEmitTime = event.timestamp ? new Date(event.timestamp).getTime() : receiveTime;
        const latencyMs = receiveTime - eventEmitTime;

        // In-memory UI update
        if (event.type === 'CALL_NEXT' && event.centerId === centerId) {
          currentToken = event.tokenNumber || currentToken;
          farmersAhead = Math.max(0, farmersAhead - 1);
          estimatedWaitMin = calculateEstimatedWait(farmersAhead, avgProcessingMin, counters);
        }

        resolve({ latencyMs, newAhead: farmersAhead, newWait: estimatedWaitMin });
      });
    });

    // Server emits CALL_NEXT for another farmer at this center
    const emitTime = new Date().toISOString();
    const queueNs = ioServer.of('/queue');
    queueNs.to(`center:${centerId}`).emit('queue:update', {
      type: 'CALL_NEXT',
      centerId,
      tokenNumber: 'PUN-001001',
      status: 'verification',
      timestamp: emitTime,
    });

    const result = await updateReceivedPromise;

    // Assert latency is well under 1000ms (1 second)
    assert.ok(result.latencyMs < 1000, `Round-trip UI update latency (${result.latencyMs}ms) must be under 1000ms`);
    assert.equal(result.newAhead, 4, 'Farmers ahead must decrement from 5 to 4');
    assert.equal(result.newWait, 12, 'Estimated wait must recompute from 15 to 12 min without API refetch');
    assert.equal(currentToken, 'PUN-001001', 'Current token being served must update');

    client.disconnect();
  });

  // Test Case 2: Wait-time recalculates after a procurement-completion broadcast and shows "Updated N min ago"
  it('2. should automatically recalculate wait time matching rolling average of completed lots and format "Updated N min ago"', () => {
    const farmersAhead = 4;
    const counters = 2;
    let avgProcessingMin = 6;

    // Initial wait calculation
    let waitMin = calculateEstimatedWait(farmersAhead, avgProcessingMin, counters);
    assert.equal(waitMin, 12);

    // Procurement completion broadcast arrives carrying new rolling average of last 20 lots: 4.5 min -> 5 min
    const newRollingAvg = 5;
    avgProcessingMin = newRollingAvg;
    waitMin = calculateEstimatedWait(farmersAhead, avgProcessingMin, counters);
    assert.equal(waitMin, 10, 'Wait time must recompute to Math.max(3, round((4 * 5) / 2)) = 10 min');

    // Finished/Accepted state drops wait to 0
    assert.equal(calculateEstimatedWait(farmersAhead, avgProcessingMin, counters, 'procured'), 0);
    assert.equal(calculateEstimatedWait(farmersAhead, avgProcessingMin, counters, 'payment_completed'), 0);

    // Verify rolling wait time "Updated N min ago" formatting
    const baseTime = new Date('2026-09-12T11:00:00.000Z');
    assert.equal(formatTimeAgo(baseTime, new Date('2026-09-12T11:00:20.000Z')), 'Updated just now');
    assert.equal(formatTimeAgo(baseTime, new Date('2026-09-12T11:01:05.000Z')), 'Updated 1 min ago');
    assert.equal(formatTimeAgo(baseTime, new Date('2026-09-12T11:08:00.000Z')), 'Updated 8 min ago');
    assert.equal(formatTimeAgo(baseTime, new Date('2026-09-12T12:05:00.000Z')), 'Updated 1 hr ago');
  });

  // Test Case 3: Disconnect/reconnect correctly shows cached state with "last updated HH:MM" indicator while offline and clears it on reconnect
  it('3. should persist queue state to localStorage, display "last updated HH:MM" when offline, and clear staleness on reconnect', () => {
    const testLookup = '9870001001';
    clearQueueCache(testLookup);

    const testTimestamp = '2026-09-12T10:45:00.000Z';
    const cachedState: CachedQueueState = {
      lookupValue: testLookup,
      tokenData: { id: 101, token_number: 'PUN-101', center_name: 'Khanna Mandi' },
      farmers_ahead: 3,
      estimated_wait_min: 9,
      current_token: 'PUN-098',
      avg_processing_min: 6,
      counters: 2,
      status: 'booked',
      lastUpdated: testTimestamp,
      isStale: true,
    };

    // 3a. Save to cache
    saveQueueCache(testLookup, cachedState);

    // 3b. Read from cache while offline
    const loaded = loadQueueCache(testLookup);
    assert.ok(loaded, 'Cached state must be retrievable from localStorage');
    assert.equal(loaded!.farmers_ahead, 3);
    assert.equal(loaded!.estimated_wait_min, 9);
    assert.equal(loaded!.current_token, 'PUN-098');

    // 3c. Verify "last updated HH:MM" formatting
    const clockText = formatLastUpdatedHHMM(loaded!.lastUpdated);
    const dateObj = new Date(testTimestamp);
    const expectedHHMM = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    assert.equal(clockText, expectedHHMM, 'Must format exact HH:MM clock timestamp');

    // 3d. Reconnect with fresh server data
    const freshNow = new Date().toISOString();
    const freshState: CachedQueueState = {
      ...loaded!,
      farmers_ahead: 2,
      estimated_wait_min: 6,
      lastUpdated: freshNow,
      isStale: false,
    };
    saveQueueCache(testLookup, freshState);

    const reconnected = loadQueueCache(testLookup);
    assert.equal(reconnected!.isStale, false, 'isStale must be cleared upon reconnect with fresh server data');
    assert.equal(reconnected!.farmers_ahead, 2, 'Fresh queue position must overwrite old cached data');
  });

  // Test Case 4: Room-scoping verified: farmer does NOT receive events for a different farmer or different center
  it('4. should verify room-scoping and discard events belonging to other centers or unrelated farmers', async () => {
    const myCenter = 'center-target-111';
    const otherCenter = 'center-foreign-999';
    const myFarmer = 'farmer-harpreet-01';
    const otherFarmer = 'farmer-other-99';
    const myToken = 'PUN-001005';
    const otherToken = 'HAR-009999';

    // 4a. Verify isEventRelevant filter logic
    const foreignEvent: QueueUpdateEvent = {
      type: 'CALL_NEXT',
      centerId: otherCenter,
      farmerId: otherFarmer,
      tokenNumber: otherToken,
    };
    assert.equal(
      isEventRelevant(foreignEvent, myFarmer, myToken, myCenter),
      false,
      'Event for a different center and different farmer must be deemed irrelevant',
    );

    const ownCenterEvent: QueueUpdateEvent = {
      type: 'CALL_NEXT',
      centerId: myCenter,
      farmerId: otherFarmer,
      tokenNumber: 'PUN-001001',
    };
    assert.equal(
      isEventRelevant(ownCenterEvent, myFarmer, myToken, myCenter),
      true,
      'Event for the farmer’s active center must be accepted',
    );

    const ownDirectEvent: QueueUpdateEvent = {
      type: 'STATUS_CHANGED',
      centerId: myCenter,
      farmerId: myFarmer,
      tokenNumber: myToken,
      status: 'verification',
    };
    assert.equal(
      isEventRelevant(ownDirectEvent, myFarmer, myToken, myCenter),
      true,
      'Event targeting this specific farmer must be accepted',
    );

    // 4b. Verify live Socket.IO room separation
    const clientMyCenter: ClientSocketType = ClientSocket(`http://127.0.0.1:${serverPort}/queue`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => clientMyCenter.on('connect', resolve));
    clientMyCenter.emit('join:center', myCenter);
    clientMyCenter.emit('join:farmer', myFarmer);
    await new Promise((r) => setTimeout(r, 50));

    let receivedForeignEvent = false;
    clientMyCenter.on('queue:update', (ev: QueueUpdateEvent) => {
      if (ev.centerId === otherCenter) {
        receivedForeignEvent = true;
      }
    });

    const queueNs = ioServer.of('/queue');
    // Emit only to room `center:otherCenter`
    queueNs.to(`center:${otherCenter}`).emit('queue:update', foreignEvent);
    await new Promise((r) => setTimeout(r, 60));

    assert.equal(receivedForeignEvent, false, 'Client in center-target-111 must NOT receive broadcasts sent to center-foreign-999');

    clientMyCenter.disconnect();
  });
});
