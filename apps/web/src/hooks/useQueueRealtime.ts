import { useState, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import {
  QueueUpdateEvent,
  CachedQueueState,
  calculateEstimatedWait,
  formatLastUpdatedHHMM,
  formatTimeAgo,
  isEventRelevant,
  saveQueueCache,
  loadQueueCache,
  createQueueSocket,
} from '../services/queueSocket';

export interface UseQueueRealtimeOptions {
  activeLookupValue: string;
  serverTokenData?: any;
  onTokenCalled?: (event: QueueUpdateEvent) => void;
  onQueueUpdated?: (event: QueueUpdateEvent) => void;
}

export interface UseQueueRealtimeReturn {
  tokenData: any;
  farmers_ahead: number;
  estimated_wait_min: number;
  current_token: string;
  avg_processing_min: number;
  status: string;
  realtimeConnected: boolean;
  isStale: boolean;
  lastUpdatedClock: string;
  timeAgoText: string;
  lastBroadcastReceivedAt: Date | null;
  latencyMs: number | null;
  hasCachedData: boolean;
  recomputeWaitTime: (newAvg?: number) => void;
}

export function useQueueRealtime({
  activeLookupValue,
  serverTokenData,
  onTokenCalled,
  onQueueUpdated,
}: UseQueueRealtimeOptions): UseQueueRealtimeReturn {
  // 1. Initial cached state loading
  const [cachedData, setCachedData] = useState<CachedQueueState | null>(() => {
    return loadQueueCache(activeLookupValue);
  });

  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [isStale, setIsStale] = useState<boolean>(() => !serverTokenData && !!cachedData);

  // Core reactive display metrics
  const [farmersAhead, setFarmersAhead] = useState<number>(() => {
    if (serverTokenData) return Number(serverTokenData.farmers_ahead ?? 0);
    if (cachedData) return Number(cachedData.farmers_ahead ?? 0);
    return 0;
  });

  const [estimatedWaitMin, setEstimatedWaitMin] = useState<number>(() => {
    if (serverTokenData) return Number(serverTokenData.estimated_wait_min ?? 0);
    if (cachedData) return Number(cachedData.estimated_wait_min ?? 0);
    return 0;
  });

  const [currentToken, setCurrentToken] = useState<string>(() => {
    if (serverTokenData) return serverTokenData.current_token || '—';
    if (cachedData) return cachedData.current_token || '—';
    return '—';
  });

  const [avgProcessingMin, setAvgProcessingMin] = useState<number>(() => {
    if (serverTokenData) return Number(serverTokenData.avg_processing_min ?? 7);
    if (cachedData) return Number(cachedData.avg_processing_min ?? 7);
    return 7;
  });

  const [status, setStatus] = useState<string>(() => {
    if (serverTokenData) return String(serverTokenData.status ?? 'booked');
    if (cachedData) return String(cachedData.status ?? 'booked');
    return 'booked';
  });

  const [lastBroadcastReceivedAt, setLastBroadcastReceivedAt] = useState<Date | null>(() => {
    if (cachedData?.lastUpdated) return new Date(cachedData.lastUpdated);
    return null;
  });

  const [lastUpdatedClock, setLastUpdatedClock] = useState<string>(() => {
    if (cachedData?.lastUpdated) return formatLastUpdatedHHMM(cachedData.lastUpdated);
    return formatLastUpdatedHHMM(new Date());
  });

  const [timeAgoText, setTimeAgoText] = useState<string>(() => {
    return formatTimeAgo(cachedData?.lastUpdated ? new Date(cachedData.lastUpdated) : null);
  });

  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Refs to allow event handlers to read latest state without re-attaching listeners
  const farmersAheadRef = useRef(farmersAhead);
  farmersAheadRef.current = farmersAhead;

  const avgRef = useRef(avgProcessingMin);
  avgRef.current = avgProcessingMin;

  const countersRef = useRef<number>(serverTokenData?.counters ?? cachedData?.counters ?? 2);
  countersRef.current = serverTokenData?.counters ?? cachedData?.counters ?? 2;

  const statusRef = useRef(status);
  statusRef.current = status;

  const tokenDataEffective = serverTokenData || cachedData?.tokenData || null;

  // 2. Synchronize when server query delivers fresh data
  useEffect(() => {
    if (serverTokenData) {
      setFarmersAhead(Number(serverTokenData.farmers_ahead ?? 0));
      setEstimatedWaitMin(Number(serverTokenData.estimated_wait_min ?? 0));
      setCurrentToken(serverTokenData.current_token || '—');
      setAvgProcessingMin(Number(serverTokenData.avg_processing_min ?? 7));
      setStatus(String(serverTokenData.status ?? 'booked'));
      const now = new Date();
      setLastBroadcastReceivedAt(now);
      setLastUpdatedClock(formatLastUpdatedHHMM(now));
      setTimeAgoText('Updated just now');
      setIsStale(false);

      const cacheObj: CachedQueueState = {
        lookupValue: activeLookupValue,
        tokenData: serverTokenData,
        farmers_ahead: Number(serverTokenData.farmers_ahead ?? 0),
        estimated_wait_min: Number(serverTokenData.estimated_wait_min ?? 0),
        current_token: serverTokenData.current_token || '—',
        avg_processing_min: Number(serverTokenData.avg_processing_min ?? 7),
        counters: Number(serverTokenData.counters ?? 2),
        status: String(serverTokenData.status ?? 'booked'),
        lastUpdated: now.toISOString(),
        isStale: false,
      };
      setCachedData(cacheObj);
      saveQueueCache(activeLookupValue, cacheObj);
    }
  }, [serverTokenData, activeLookupValue]);

  // 3. React to lookup value change (switching token or mobile)
  useEffect(() => {
    const loaded = loadQueueCache(activeLookupValue);
    setCachedData(loaded);
    if (loaded && !serverTokenData) {
      setFarmersAhead(loaded.farmers_ahead);
      setEstimatedWaitMin(loaded.estimated_wait_min);
      setCurrentToken(loaded.current_token);
      setAvgProcessingMin(loaded.avg_processing_min);
      setStatus(loaded.status);
      setLastBroadcastReceivedAt(new Date(loaded.lastUpdated));
      setLastUpdatedClock(formatLastUpdatedHHMM(loaded.lastUpdated));
      setTimeAgoText(formatTimeAgo(new Date(loaded.lastUpdated)));
      setIsStale(true);
    }
  }, [activeLookupValue]);

  // 4. Time-ago tick timer (updates "Updated N min ago" every 15 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgoText(formatTimeAgo(lastBroadcastReceivedAt));
    }, 15000);
    return () => clearInterval(interval);
  }, [lastBroadcastReceivedAt]);

  // Refs for callbacks and dynamic state so event listeners never churn or trigger socket reconnects
  const socketRef = useRef<Socket | null>(null);
  const tokenDataRef = useRef(tokenDataEffective);
  tokenDataRef.current = tokenDataEffective;

  const lookupValueRef = useRef(activeLookupValue);
  lookupValueRef.current = activeLookupValue;

  const onTokenCalledRef = useRef(onTokenCalled);
  onTokenCalledRef.current = onTokenCalled;

  const onQueueUpdatedRef = useRef(onQueueUpdated);
  onQueueUpdatedRef.current = onQueueUpdated;

  // 5. Socket.IO Real-time Connection (stable lifecycle mounted once)
  useEffect(() => {
    const socket = createQueueSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setRealtimeConnected(true);
      setIsStale(false);

      // Join rooms using latest token data
      const centerId = tokenDataRef.current?.center_id;
      const farmerId = tokenDataRef.current?.farmer_id;
      if (centerId) {
        socket.emit('join:center', centerId);
      }
      if (farmerId) {
        socket.emit('join:farmer', farmerId);
      }
    });

    socket.on('disconnect', () => {
      setRealtimeConnected(false);
      setIsStale(true);
    });

    socket.on('queue:update', (event: QueueUpdateEvent) => {
      const receiveStart = Date.now();
      const currentToken = tokenDataRef.current;
      const centerId = currentToken?.center_id;
      const farmerId = currentToken?.farmer_id;
      const tokenNumber = currentToken?.token_number;

      // Room-scoping validation: ignore broadcasts belonging to different farmers or different centers
      if (!isEventRelevant(event, farmerId, tokenNumber, centerId)) {
        return;
      }

      const now = new Date();
      setLastBroadcastReceivedAt(now);
      setLastUpdatedClock(formatLastUpdatedHHMM(now));
      setTimeAgoText('Updated just now');
      setIsStale(false);

      // Handle Event Type 1: Staff called next farmer
      if (event.type === 'CALL_NEXT') {
        if ((tokenNumber && event.tokenNumber === tokenNumber) || (farmerId && event.farmerId === farmerId)) {
          // This specific farmer was called
          setFarmersAhead(0);
          setEstimatedWaitMin(0);
          if (event.tokenNumber) setCurrentToken(event.tokenNumber);
          setStatus(event.status || 'arrived');
          onTokenCalledRef.current?.(event);
        } else if (centerId && event.centerId === centerId) {
          // Another farmer at this center was called: advance queue position
          if (event.tokenNumber) setCurrentToken(event.tokenNumber);
          setFarmersAhead((prev) => {
            const nextAhead = Math.max(0, prev - 1);
            const nextWait = calculateEstimatedWait(nextAhead, avgRef.current, countersRef.current, statusRef.current);
            setEstimatedWaitMin(nextWait);
            return nextAhead;
          });
          onQueueUpdatedRef.current?.(event);
        }
      }

      // Handle Event Type 2: Status transition
      else if (event.type === 'STATUS_CHANGED') {
        if ((tokenNumber && event.tokenNumber === tokenNumber) || (farmerId && event.farmerId === farmerId)) {
          const newStatus = event.status || 'arrived';
          setStatus(newStatus);
          const isFinished = ['procured', 'payment_processing', 'payment_completed', 'rejected'].includes(newStatus.toLowerCase());
          if (isFinished) {
            setFarmersAhead(0);
            setEstimatedWaitMin(0);
          }
          onQueueUpdatedRef.current?.(event);
        }
      }

      // Handle Event Type 3: Procurement completed / lot accepted / rolling average update
      else if (
        event.type === 'PROCUREMENT_COMPLETED' ||
        event.type === 'LOT_ACCEPTED' ||
        event.type === 'ROLLING_AVG_UPDATED' ||
        event.avg_processing_min != null
      ) {
        if (event.avg_processing_min != null && event.avg_processing_min > 0) {
          const newAvg = Number(event.avg_processing_min);
          setAvgProcessingMin(newAvg);
          const nextWait = calculateEstimatedWait(farmersAheadRef.current, newAvg, countersRef.current, statusRef.current);
          setEstimatedWaitMin(nextWait);
        }
        onQueueUpdatedRef.current?.(event);
      }

      // Record measured round-trip UI latency
      setLatencyMs(Date.now() - receiveStart);

      // Persist live state to local storage
      const activeLookup = lookupValueRef.current;
      if (activeLookup) {
        saveQueueCache(activeLookup, {
          lookupValue: activeLookup,
          tokenData: tokenDataRef.current,
          farmers_ahead: farmersAheadRef.current,
          estimated_wait_min: estimatedWaitMin,
          current_token: currentToken?.token_number ? String(currentToken.token_number) : '—',
          avg_processing_min: avgRef.current,
          counters: countersRef.current,
          status: statusRef.current,
          lastUpdated: now.toISOString(),
          isStale: false,
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // 6. Dynamically join rooms if center_id or farmer_id becomes available after socket connects
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      const centerId = tokenDataEffective?.center_id;
      const farmerId = tokenDataEffective?.farmer_id;
      if (centerId) socket.emit('join:center', centerId);
      if (farmerId) socket.emit('join:farmer', farmerId);
    }
  }, [tokenDataEffective?.center_id, tokenDataEffective?.farmer_id]);

  const recomputeWaitTime = (newAvg?: number) => {
    const avg = newAvg ?? avgRef.current;
    if (newAvg != null) setAvgProcessingMin(newAvg);
    setEstimatedWaitMin(calculateEstimatedWait(farmersAheadRef.current, avg, countersRef.current, statusRef.current));
  };

  return {
    tokenData: tokenDataEffective,
    farmers_ahead: farmersAhead,
    estimated_wait_min: estimatedWaitMin,
    current_token: currentToken,
    avg_processing_min: avgProcessingMin,
    status,
    realtimeConnected,
    isStale,
    lastUpdatedClock,
    timeAgoText,
    lastBroadcastReceivedAt,
    latencyMs,
    hasCachedData: !!cachedData,
    recomputeWaitTime,
  };
}
