import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBookingsVsCapacity,
  computeWaitTimeTrends,
  computeCompletionRates,
  formatZeroStateCenter,
  CenterAnalyticsItem,
} from '../src/services/adminAnalytics';
import {
  getValidProcurementActions,
  saveCenterQueueCache,
  loadCenterQueueCache,
  clearCenterQueueCache,
  applyOptimisticQueueStatus,
  CachedQueueItem,
} from '../src/services/centerOfflineCache';
import { staffProcurementApi, api } from '../src/services/api';

// In-memory localStorage mock for node test runner
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// Attach mock localStorage to global if running in Node without DOM
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new LocalStorageMock();
}

describe('AdminDashboard & CenterDashboard Integration Test Suite', () => {
  const originalPost = api.post;
  const originalPatch = api.patch;

  before(() => {
    api.post = (async (url: string, data?: any) => {
      return { status: 200, data: { success: true, url, data } };
    }) as any;
    api.patch = (async (url: string, data?: any) => {
      return { status: 200, data: { success: true, url, data } };
    }) as any;
  });

  after(() => {
    api.post = originalPost;
    api.patch = originalPatch;
  });

  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  // =========================================================================
  // Scope 1: AdminDashboard Analytics Views (4 tests)
  // =========================================================================

  it('AdminDashboard (1/4): renders bookings-vs-capacity analytics view with correct utilization percentages', () => {
    const mockCenters: CenterAnalyticsItem[] = [
      {
        id: 'c-1',
        name: 'Khanna Grain Market',
        code: 'KGM-01',
        capacity: 100,
        total_bookings: 85,
        completed: 40,
        waiting: 45,
        avg_wait_time_mins: 25,
        completion_rate_pct: 47,
        utilization_pct: 85,
        status: 'Moderate',
      },
      {
        id: 'c-2',
        name: 'Rajpura Mandi',
        code: 'RAJ-02',
        capacity: 80,
        total_bookings: 20,
        completed: 10,
        waiting: 10,
        avg_wait_time_mins: 10,
        completion_rate_pct: 50,
        utilization_pct: 25,
        status: 'Normal',
      },
    ];

    const result = computeBookingsVsCapacity(mockCenters);

    assert.equal(result.length, 2);
    assert.equal(result[0].centerName, 'Khanna Grain Market');
    assert.equal(result[0].capacity, 100);
    assert.equal(result[0].bookings, 85);
    assert.equal(result[0].utilizationPct, 85);
    assert.equal(result[0].status, 'Moderate');

    assert.equal(result[1].centerName, 'Rajpura Mandi');
    assert.equal(result[1].capacity, 80);
    assert.equal(result[1].bookings, 20);
    assert.equal(result[1].utilizationPct, 25);
    assert.equal(result[1].status, 'Normal');
  });

  it('AdminDashboard (2/4): renders average wait-time trends view and identifies bottlenecks', () => {
    const mockCenters: CenterAnalyticsItem[] = [
      {
        id: 'c-1',
        name: 'Ludhiana Central Yard',
        code: 'LDH-01',
        capacity: 120,
        total_bookings: 110,
        completed: 30,
        waiting: 70,
        avg_wait_time_mins: 55,
        completion_rate_pct: 27,
        utilization_pct: 92,
        status: 'Congested',
      },
      {
        id: 'c-2',
        name: 'Moga APMC',
        code: 'MOG-02',
        capacity: 80,
        total_bookings: 30,
        completed: 25,
        waiting: 5,
        avg_wait_time_mins: 12,
        completion_rate_pct: 83,
        utilization_pct: 38,
        status: 'Normal',
      },
    ];

    const hourlySlots = [
      { slot: '09:00 - 10:00', wait_time_mins: 15, arrivals: 25 },
      { slot: '10:00 - 11:00', wait_time_mins: 45, arrivals: 40 },
    ];

    const trends = computeWaitTimeTrends(mockCenters, hourlySlots);

    assert.equal(trends.length, 2);
    // Center 1 is congested with 55 mins avg wait
    assert.equal(trends[0].avgWaitMins, 55);
    assert.equal(trends[0].status, 'Congested');
    // Center 2 is normal with 12 mins avg wait
    assert.equal(trends[1].avgWaitMins, 12);
    assert.equal(trends[1].status, 'Normal');

    // Identifies congested bottleneck
    const bottleneck = trends.find((t) => t.status === 'Congested');
    assert.ok(bottleneck);
    assert.equal(bottleneck?.centerName, 'Ludhiana Central Yard');
  });

  it('AdminDashboard (3/4): renders procurement completion rate view calculating accurate throughput', () => {
    const mockCenters: CenterAnalyticsItem[] = [
      {
        id: 'c-1',
        name: 'Jalandhar Mandi',
        code: 'JAL-01',
        capacity: 100,
        total_bookings: 80,
        completed: 64,
        waiting: 16,
        avg_wait_time_mins: 18,
        completion_rate_pct: 80,
        utilization_pct: 80,
        status: 'Moderate',
      },
    ];

    const rates = computeCompletionRates(mockCenters);

    assert.equal(rates.length, 1);
    assert.equal(rates[0].completed, 64);
    assert.equal(rates[0].totalBookings, 80);
    assert.equal(rates[0].completionRatePct, 80);
  });

  it('AdminDashboard (4/4): renders honest empty/zero-data state without fabricated placeholder numbers', () => {
    // 1. Center with zero bookings
    const zeroCenterRaw = {
      id: 'c-zero',
      name: 'Newly Commissioned Center',
      code: 'NEW-00',
      capacity: 100,
      todays_farmers: 0,
      completed: 0,
      waiting: 0,
    };

    const formatted = formatZeroStateCenter(zeroCenterRaw);

    // Must be honest 0s, NOT fabricated mock numbers (e.g. 12,450 or 47,320)
    assert.equal(formatted.total_bookings, 0);
    assert.equal(formatted.completed, 0);
    assert.equal(formatted.waiting, 0);
    assert.equal(formatted.utilization_pct, 0);
    assert.equal(formatted.completion_rate_pct, 0);
    assert.equal(formatted.avg_wait_time_mins, 0);
    assert.equal(formatted.status, 'Normal');

    // 2. Empty centers list returns empty views
    const emptyResult = computeBookingsVsCapacity([]);
    assert.deepEqual(emptyResult, []);

    const emptyTrends = computeWaitTimeTrends([]);
    assert.deepEqual(emptyTrends, []);

    const emptyRates = computeCompletionRates([]);
    assert.deepEqual(emptyRates, []);
  });

  // =========================================================================
  // Scope 2: CenterDashboard One-Tap Actions (6 tests)
  // =========================================================================

  it('CenterDashboard (1/6): Gate Entry action succeeds when token is in "booked" state', async () => {
    const status = 'booked';
    const actions = getValidProcurementActions(status);

    assert.equal(actions.canGateEntry, true);
    assert.equal(actions.nextAction, 'gate_entry');

    // Execute Gate Entry via fallback contract handler
    const response = await staffProcurementApi.gateEntry('T-1001');
    assert.ok(response);
    assert.ok(response.status === 200 || response.status === 201);
  });

  it('CenterDashboard (2/6): Weighing action succeeds when token is in "arrived" state', async () => {
    const status = 'arrived';
    const actions = getValidProcurementActions(status);

    assert.equal(actions.canWeigh, true);
    assert.equal(actions.nextAction, 'weighing');

    // Execute Weighing with net weight
    const response = await staffProcurementApi.weighing('T-1002', {
      gross_weight: 55,
      tare_weight: 10,
      net_weight: 45,
    });
    assert.ok(response);
    assert.ok(response.status === 200 || response.status === 201);
  });

  it('CenterDashboard (3/6): Quality Check action succeeds when token is in "verification" state', async () => {
    const status = 'verification';
    const actions = getValidProcurementActions(status);

    assert.equal(actions.canQualityCheck, true);
    assert.equal(actions.nextAction, 'quality_check');

    // Execute Quality Check
    const response = await staffProcurementApi.qualityCheck('T-1003', {
      moisture_percent: 12.5,
      quality_pass: true,
    });
    assert.ok(response);
    assert.ok(response.status === 200 || response.status === 201);
  });

  it('CenterDashboard (4/6): Lot Accepted action succeeds when token is in "quality_check" state', async () => {
    const status = 'quality_check';
    const actions = getValidProcurementActions(status);

    assert.equal(actions.canAccept, true);
    assert.equal(actions.nextAction, 'lot_accepted');

    // Execute Lot Accepted
    const response = await staffProcurementApi.lotAccepted('T-1004');
    assert.ok(response);
    assert.ok(response.status === 200 || response.status === 201);
  });

  it('CenterDashboard (5/6): Invalid actions are disabled with explanatory server-validated blocking reasons', () => {
    // A: Attempting Weighing before Gate Entry ("booked" state)
    const bookedActions = getValidProcurementActions('booked');
    assert.equal(bookedActions.canWeigh, false, 'Weighing should be disabled before Gate Entry');
    assert.equal(bookedActions.canQualityCheck, false, 'QC should be disabled before Gate Entry');
    assert.equal(bookedActions.canAccept, false, 'Acceptance should be disabled before Gate Entry');
    assert.match(bookedActions.weighingBlockedReason || '', /Gate Entry/);

    // B: Attempting QC before Weighing ("arrived" state)
    const arrivedActions = getValidProcurementActions('arrived');
    assert.equal(arrivedActions.canGateEntry, false, 'Gate Entry should be disabled once arrived');
    assert.equal(arrivedActions.canQualityCheck, false, 'QC should be disabled before weighing');
    assert.match(arrivedActions.qcBlockedReason || '', /Weighing/);

    // C: Terminal state ("accepted") disables all further transition buttons
    const acceptedActions = getValidProcurementActions('accepted');
    assert.equal(acceptedActions.canGateEntry, false);
    assert.equal(acceptedActions.canWeigh, false);
    assert.equal(acceptedActions.canQualityCheck, false);
    assert.equal(acceptedActions.canAccept, false);
    assert.equal(acceptedActions.nextAction, null);
  });

  it('CenterDashboard (6/6): Successful action immediately updates the visible queue list optimistically', () => {
    const initialQueue: CachedQueueItem[] = [
      {
        id: 'T-501',
        token_number: 'TK-101',
        farmer_name: 'Gurpreet Singh',
        mobile: '9876543210',
        crop: 'Wheat',
        quantity: 50,
        status: 'booked',
      },
      {
        id: 'T-502',
        token_number: 'TK-102',
        farmer_name: 'Harbhajan Kaur',
        mobile: '9876543211',
        crop: 'Paddy',
        quantity: 40,
        status: 'booked',
      },
    ];

    // Optimistically update T-501 to 'arrived' upon Gate Entry success
    const updatedQueue = applyOptimisticQueueStatus(initialQueue, 'T-501', 'arrived');

    assert.equal(updatedQueue.length, 2);
    assert.equal(updatedQueue[0].id, 'T-501');
    assert.equal(updatedQueue[0].status, 'arrived');
    // Ensure T-502 remains unchanged
    assert.equal(updatedQueue[1].id, 'T-502');
    assert.equal(updatedQueue[1].status, 'booked');

    // Advance T-501 through Weighing
    const weighedQueue = applyOptimisticQueueStatus(updatedQueue, 'T-501', 'verification', {
      quantity_received: 48.5,
    });
    assert.equal(weighedQueue[0].status, 'verification');
    assert.equal(weighedQueue[0].quantity_received, 48.5);
  });

  // =========================================================================
  // Scope 3: CenterDashboard Offline Caching (2 tests)
  // =========================================================================

  it('CenterDashboard Offline (1/2): displays cached queue from localStorage when offline/disconnected', () => {
    const centerId = 'center-khanna-01';
    const date = '2026-09-12';
    const queueData: CachedQueueItem[] = [
      {
        id: 'OFF-1',
        token_number: 'TK-901',
        farmer_name: 'Jaswant Singh',
        mobile: '9812345678',
        crop: 'Wheat',
        quantity: 60,
        status: 'arrived',
      },
      {
        id: 'OFF-2',
        token_number: 'TK-902',
        farmer_name: 'Kuldeep Singh',
        mobile: '9812345679',
        crop: 'Mustard',
        quantity: 35,
        status: 'verification',
      },
    ];

    // Persist to local cache
    saveCenterQueueCache(centerId, date, queueData);

    // Read back when offline
    const restored = loadCenterQueueCache(centerId, date);

    assert.ok(restored);
    assert.equal(restored.length, 2);
    assert.equal(restored[0].token_number, 'TK-901');
    assert.equal(restored[0].status, 'arrived');
    assert.equal(restored[1].token_number, 'TK-902');
    assert.equal(restored[1].status, 'verification');
  });

  it('CenterDashboard Offline (2/2): synchronizes and updates local cache when connection is restored', () => {
    const centerId = 'center-khanna-01';
    const date = '2026-09-12';

    // 1. Initial cached state
    const staleQueue: CachedQueueItem[] = [
      {
        id: 'SYNC-1',
        token_number: 'TK-301',
        farmer_name: 'Balwinder Singh',
        crop: 'Wheat',
        quantity: 40,
        status: 'booked',
      },
    ];
    saveCenterQueueCache(centerId, date, staleQueue);

    // 2. Server emits fresh reconciled queue on reconnect
    const freshQueue: CachedQueueItem[] = [
      {
        id: 'SYNC-1',
        token_number: 'TK-301',
        farmer_name: 'Balwinder Singh',
        crop: 'Wheat',
        quantity: 40,
        status: 'quality_check', // Advanced while offline
      },
      {
        id: 'SYNC-2',
        token_number: 'TK-302',
        farmer_name: 'Manjit Singh',
        crop: 'Wheat',
        quantity: 45,
        status: 'arrived', // Newly arrived while offline
      },
    ];

    // Synchronize to cache
    saveCenterQueueCache(centerId, date, freshQueue);

    const reconnectedQueue = loadCenterQueueCache(centerId, date);
    assert.ok(reconnectedQueue);
    assert.equal(reconnectedQueue.length, 2);
    assert.equal(reconnectedQueue[0].status, 'quality_check');
    assert.equal(reconnectedQueue[1].token_number, 'TK-302');

    // 3. Clear cache works
    clearCenterQueueCache(centerId, date);
    assert.equal(loadCenterQueueCache(centerId, date), null);
  });
});
