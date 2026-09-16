export type ProcurementAction = 'gate_entry' | 'weighing' | 'quality_check' | 'lot_accepted' | 'reject';

export interface ValidProcurementActions {
  canGateEntry: boolean;
  canWeigh: boolean;
  canQualityCheck: boolean;
  canAccept: boolean;
  canReject: boolean;
  nextAction: ProcurementAction | null;
  gateEntryBlockedReason?: string;
  weighingBlockedReason?: string;
  qcBlockedReason?: string;
  acceptBlockedReason?: string;
}

export interface CachedQueueItem {
  id: number | string;
  token_number: string;
  farmer_name?: string;
  mobile?: string;
  crop?: string;
  quantity?: number;
  quantity_received?: number;
  status: string;
  slot_time?: string;
  payment_status?: string;
  payment_amount?: number;
  reject_reason?: string;
  [key: string]: any;
}

/**
 * Derives valid procurement actions based on server-validated lifecycle states.
 * Enforces sequential workflow: booked -> arrived -> verification -> quality_check -> accepted/procured
 */
export function getValidProcurementActions(rawStatus?: string): ValidProcurementActions {
  const status = String(rawStatus || 'booked').toLowerCase();

  switch (status) {
    case 'booked':
      return {
        canGateEntry: true,
        canWeigh: false,
        canQualityCheck: false,
        canAccept: false,
        canReject: true,
        nextAction: 'gate_entry',
        weighingBlockedReason: 'Weighing requires Gate Entry arrival first',
        qcBlockedReason: 'Quality inspection requires Weighing first',
        acceptBlockedReason: 'Lot acceptance requires Quality Check first',
      };

    case 'arrived':
      return {
        canGateEntry: false,
        canWeigh: true,
        canQualityCheck: false,
        canAccept: false,
        canReject: true,
        nextAction: 'weighing',
        gateEntryBlockedReason: 'Gate Entry already confirmed',
        qcBlockedReason: 'Quality inspection requires Weighing first',
        acceptBlockedReason: 'Lot acceptance requires Quality Check first',
      };

    case 'verification':
      return {
        canGateEntry: false,
        canWeigh: false,
        canQualityCheck: true,
        canAccept: false,
        canReject: true,
        nextAction: 'quality_check',
        gateEntryBlockedReason: 'Gate Entry already confirmed',
        weighingBlockedReason: 'Weighbridge measurements already recorded',
        acceptBlockedReason: 'Lot acceptance requires Quality Check first',
      };

    case 'quality_check':
      return {
        canGateEntry: false,
        canWeigh: false,
        canQualityCheck: false,
        canAccept: true,
        canReject: true,
        nextAction: 'lot_accepted',
        gateEntryBlockedReason: 'Gate Entry already confirmed',
        weighingBlockedReason: 'Weighbridge measurements already recorded',
        qcBlockedReason: 'Quality assay inspection already completed',
      };

    case 'accepted':
    case 'procured':
      return {
        canGateEntry: false,
        canWeigh: false,
        canQualityCheck: false,
        canAccept: false,
        canReject: false,
        nextAction: null,
        gateEntryBlockedReason: 'Produce lot already accepted into Mandi inventory',
        weighingBlockedReason: 'Produce lot already accepted into Mandi inventory',
        qcBlockedReason: 'Produce lot already accepted into Mandi inventory',
        acceptBlockedReason: 'Produce lot already accepted into Mandi inventory',
      };

    case 'rejected':
      return {
        canGateEntry: false,
        canWeigh: false,
        canQualityCheck: false,
        canAccept: false,
        canReject: false,
        nextAction: null,
        gateEntryBlockedReason: 'Token is marked rejected',
        weighingBlockedReason: 'Token is marked rejected',
        qcBlockedReason: 'Token is marked rejected',
        acceptBlockedReason: 'Token is marked rejected',
      };

    default:
      return {
        canGateEntry: false,
        canWeigh: false,
        canQualityCheck: false,
        canAccept: false,
        canReject: false,
        nextAction: null,
      };
  }
}

/**
 * Client-side local storage cache helpers for Center Dashboard offline reliability
 */
const CACHE_PREFIX = 'annsetu_center_queue_';

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

function getStorageKey(centerId: string, date: string): string {
  return `${CACHE_PREFIX}${centerId}_${date}`;
}

export function saveCenterQueueCache(centerId: string, date: string, queue: any[]): void {
  const store = getStorage();
  if (!store) return;
  try {
    const payload = {
      centerId,
      date,
      timestamp: new Date().toISOString(),
      queue,
    };
    store.setItem(getStorageKey(centerId, date), JSON.stringify(payload));
  } catch (err) {
    // LocalStorage quota or access error handled silently
  }
}

export function loadCenterQueueCache(centerId: string, date: string): any[] | null {
  const store = getStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(getStorageKey(centerId, date));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.queue)) return parsed.queue;
    return [];
  } catch (err) {
    return null;
  }
}

export function clearCenterQueueCache(centerId: string, date: string): void {
  const store = getStorage();
  if (!store) return;
  try {
    store.removeItem(getStorageKey(centerId, date));
  } catch (err) {
    // Handled
  }
}

/**
 * Optimistically updates a token's status in a queue array for immediate UI reflection without manual refresh
 */
export function applyOptimisticQueueStatus(
  queue: any[],
  tokenId: number | string,
  newStatus: string,
  extraFields: Record<string, any> = {},
): any[] {
  return queue.map((token) => {
    if (String(token.id) === String(tokenId) || String(token.token_number) === String(tokenId)) {
      return {
        ...token,
        status: newStatus,
        ...extraFields,
      };
    }
    return token;
  });
}
