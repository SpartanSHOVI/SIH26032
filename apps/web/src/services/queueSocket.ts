import { io, Socket } from 'socket.io-client';

export interface QueueUpdateEvent {
  version?: number;
  eventId?: string;
  type: 'CALL_NEXT' | 'STATUS_CHANGED' | 'PAYMENT_UPDATED' | 'PROCUREMENT_COMPLETED' | 'LOT_ACCEPTED' | 'ROLLING_AVG_UPDATED' | string;
  centerId?: string;
  farmerId?: string;
  tokenNumber?: string;
  status?: string;
  avg_processing_min?: number;
  farmers_ahead?: number;
  estimated_wait_min?: number;
  current_token?: string;
  timestamp?: string;
}

export interface CachedQueueState {
  lookupValue: string;
  tokenData: any;
  farmers_ahead: number;
  estimated_wait_min: number;
  current_token: string;
  avg_processing_min: number;
  counters: number;
  status: string;
  lastUpdated: string; // ISO string
  isStale: boolean;
}

const CACHE_PREFIX = 'annsetu_queue_cache_';

/**
 * Little's Law dynamic queue wait calculation matching backend formula:
 * wait_mins = ahead === 0 ? 3 : Math.max(3, Math.round((ahead * avg_processing_min) / counters))
 */
export function calculateEstimatedWait(
  farmersAhead: number,
  avgProcessingMin: number = 7,
  counters: number = 2,
  status?: string,
): number {
  const isFinished = status && ['procured', 'payment_processing', 'payment_completed', 'rejected'].includes(status.toLowerCase());
  if (isFinished) return 0;
  if (farmersAhead <= 0) return 3;
  const activeCounters = Math.max(counters, 1);
  return Math.max(3, Math.round((farmersAhead * avgProcessingMin) / activeCounters));
}

export function formatLastUpdatedHHMM(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return '';
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatTimeAgo(dateOrIso?: string | Date | null, now: Date = new Date()): string {
  if (!dateOrIso) return 'Updated just now';
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return 'Updated just now';
  const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (diffSec < 60) return 'Updated just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return 'Updated 1 min ago';
  if (diffMin < 60) return `Updated ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return 'Updated 1 hr ago';
  return `Updated ${diffHr} hrs ago`;
}

/**
 * Strict room-scoping enforcement: verifies whether an incoming event is relevant
 * to the subscribed farmer/token/center. Events for unrelated farmers or other centers are dropped.
 */
export function isEventRelevant(
  event: QueueUpdateEvent,
  targetFarmerId?: string,
  targetTokenNumber?: string,
  targetCenterId?: string,
): boolean {
  if (targetFarmerId && event.farmerId && event.farmerId === targetFarmerId) {
    return true;
  }
  if (targetTokenNumber && event.tokenNumber && event.tokenNumber === targetTokenNumber) {
    return true;
  }
  if (targetCenterId && event.centerId && event.centerId === targetCenterId) {
    return true;
  }
  return false;
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

export function saveQueueCache(lookupKey: string, state: CachedQueueState): void {
  const store = getStorage();
  if (!store || !lookupKey) return;
  try {
    store.setItem(`${CACHE_PREFIX}${lookupKey}`, JSON.stringify(state));
  } catch {
    // Ignore storage quota or disabled localStorage errors
  }
}

export function loadQueueCache(lookupKey: string): CachedQueueState | null {
  const store = getStorage();
  if (!store || !lookupKey) return null;
  try {
    const raw = store.getItem(`${CACHE_PREFIX}${lookupKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedQueueState;
  } catch {
    return null;
  }
}

export function clearQueueCache(lookupKey: string): void {
  const store = getStorage();
  if (!store || !lookupKey) return;
  try {
    store.removeItem(`${CACHE_PREFIX}${lookupKey}`);
  } catch {}
}

export function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl && apiUrl.startsWith('http')) {
      return apiUrl.replace(/\/api\/v1\/?$/, '');
    }
    // On local machine directly accessing localhost, use direct port 3001
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    // When forwarded via tunnel/proxy (e.g. ngrok, localtunnel), route through tunnel origin
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

export function createQueueSocket(): Socket {
  const url = `${getSocketUrl()}/queue`;
  return io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
}
