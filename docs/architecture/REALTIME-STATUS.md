# AnnSetu — Frontend Realtime Queue Path & Room-Join Architecture
**Document Version:** 1.0.0  
**Date:** September 12, 2026  
**Author:** Frontend Engineer (`team/frontend`)  
**Scope:** Live Queue Realtime Path, Room-Scoping, Offline-First Caching & Rolling Wait Time (Frontend Prompt 1 of 4)  
**Status:** IMPLEMENTED & VERIFIED (Zero build/typecheck errors, 4/4 automated tests passing)

---

## 1. Overview

This document specifies the standard client-side Socket.IO real-time connection, room-scoping protocol, offline-first caching mechanism, and in-memory queue recalculation patterns implemented in `apps/web`.

Any subsequent frontend prompts touching real-time screens (`CenterDashboard`, `Dashboard`, `ProcurementStatus`, `PaymentStatus`) must follow these conventions for uniform real-time behavior.

---

## 2. Socket.IO Gateway & Room-Join Protocol

The backend Socket.IO gateway is mounted at the `/queue` namespace on the NestJS API server (`apps/api/src/realtime/queue.gateway.ts`).

### 2.1 Connection URL
- Resolved via `getSocketUrl()` in [`src/services/queueSocket.ts`](file:///Users/shubham/Drive%20D/Custom_Projects/SIH_2026/AnnSetu/apps/web/src/services/queueSocket.ts):
  - Prioritizes `process.env.NEXT_PUBLIC_WS_URL`.
  - Derives origin from `process.env.NEXT_PUBLIC_API_URL` (stripping `/api/v1`).
  - Defaults to `${window.location.protocol}//${window.location.hostname}:3001/queue`.

### 2.2 Room-Join Events
When a client socket connects, it must emit standard colon-delimited room join messages to subscribe to targeted events:
```typescript
// Join center room (receives CALL_NEXT, center announcements, throughput updates)
socket.emit('join:center', centerId);

// Join farmer room (receives personal token status, direct call alerts, payment updates)
socket.emit('join:farmer', farmerId);
```

### 2.3 Server Broadcast Event
- Backend gateway listens to Redis channel `queue:updates` and broadcasts on event name:
  ```typescript
  socket.on('queue:update', (event: QueueUpdateEvent) => { ... });
  ```

---

## 3. Strict Room-Scoping & Event Filtering

To ensure a farmer's application never processes updates meant for other farmers at other centers:
1. **Room Separation:** Sockets in room `center:C1` do not receive room-scoped messages emitted to `center:C2`.
2. **Client-Side Guard:** [`isEventRelevant(event, targetFarmerId, targetTokenNumber, targetCenterId)`](file:///Users/shubham/Drive%20D/Custom_Projects/SIH_2026/AnnSetu/apps/web/src/services/queueSocket.ts) verifies each incoming payload. Any broadcast with a mismatched `centerId` or unrelated `farmerId` is dropped without triggering state updates or re-renders.

---

## 4. Offline-First Caching Pattern

To eliminate blank or bouncing loading skeletons when opening or reopening the application:
1. **Cache Storage:** `localStorage` is used under key `annsetu_queue_cache_${lookupValue}`.
2. **Cached Attributes:**
   - `farmers_ahead`: number
   - `estimated_wait_min`: number
   - `current_token`: string
   - `avg_processing_min`: number
   - `counters`: number
   - `status`: string
   - `lastUpdated`: ISO timestamp string
   - `isStale`: boolean
3. **Immediate Render:** On component mount, cached state is loaded synchronously before network queries execute, allowing instant screen display.
4. **Staleness Indicator:**
   - When offline or socket is disconnected: Displays `Offline • Last updated HH:MM` (e.g. `11:45`) and an amber status dot.
   - On reconnect / fresh data: Automatically clears staleness (`isStale = false`), updates cache, and displays `Live Socket Connected (Updated just now)` with a pulsing green dot.

---

## 5. In-Memory Sub-Second Wait-Time Recalculation

When staff invokes `call-next` or a lot advances, the UI updates in-memory immediately (< 100ms, well under the 1-second requirement) without making an HTTP refetch:

### 5.1 Little's Law Formula (Reused from Backend)
$$\text{estimated\_wait\_min} = \begin{cases} 
0 & \text{if lot is accepted, procured, or paid} \\ 
3 & \text{if } \text{farmers\_ahead} \le 0 \\ 
\max\left(3, \operatorname{round}\left(\frac{\text{farmers\_ahead} \times \text{avg\_processing\_min}}{\text{counters}}\right)\right) & \text{if } \text{farmers\_ahead} > 0 
\end{cases}$$

### 5.2 Rolling Average Adaptation
- Upon receiving a `PROCUREMENT_COMPLETED` or `LOT_ACCEPTED` broadcast with updated `avg_processing_min`, the hook dynamically adjusts the counter speed and recalculates wait times.
- Relative indicator shows `Updated just now`, `Updated 1 min ago`, or `Updated N min ago` using `formatTimeAgo()`.

---

## 6. How to Reuse in Other Screens

Import the hook and types directly:
```typescript
import { useQueueRealtime } from '../hooks/useQueueRealtime';

const {
  tokenData,
  farmers_ahead,
  estimated_wait_min,
  current_token,
  avg_processing_min,
  status,
  realtimeConnected,
  isStale,
  lastUpdatedClock,
  timeAgoText,
} = useQueueRealtime({
  activeLookupValue: farmerMobileOrTokenId,
  serverTokenData: initialQueryData,
  onTokenCalled: (event) => { /* audio readout / notification */ },
  onQueueUpdated: (event) => { /* update dashboard badges */ },
});
```

---

## 7. Service Worker Verification Note

- File [`public/sw.js`](file:///Users/shubham/Drive%20D/Custom_Projects/SIH_2026/AnnSetu/apps/web/public/sw.js) is verified **100% UNCHANGED**.
- Line 7 strictly enforces:
  ```javascript
  if (url.pathname.startsWith('/api/')) return;
  ```
  API requests are never cached in the Service Worker cache; all offline queue persistence is handled via client state (`localStorage`) in accordance with architectural constraints.
