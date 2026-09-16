# BullMQ Outbox Dispatch Integration Reference

> **Service**: `apps/api` (`@annsetu/api`)  
> **Branch**: `team/backend`  
> **Module**: `JobsModule` (`src/infrastructure/jobs/jobs.module.ts`)  
> **Target Audience**: Backend engineers, Platform + QA engineers building load & stress tests.

---

## 1. Overview & Architecture

The BullMQ integration transitions AnnSetu from unmonitored inline Redis event dispatching to a resilient, durable, transactional outbox queue. 

- Events are committed transactionally into PostgreSQL table `event_outbox` by domain mutations (bookings, procurement state transitions, payment status updates).
- `OutboxQueueService` periodically polls pending rows and enqueues them into BullMQ.
- BullMQ worker (`OutboxProcessor`) processes jobs asynchronously with exponential backoff and idempotency.
- Live Socket.IO broadcasts continue to fire via Redis channel `queue:updates` on dispatch.
- Successfully dispatched events are marked in PostgreSQL (`published_at = now()`, `attempts = attempts + 1`).
- Failed jobs never silently drop; they exhaust 3 retries and land in the queryable dead-letter state (`removeOnFail: false`).

---

## 2. Queue Configuration

| Setting | Value | Notes |
|---|---|---|
| **Queue Name** | `outbox-dispatch` | Single queue for all outbox event types |
| **Worker Concurrency** | `5` | Configured in `@Processor('outbox-dispatch', { concurrency: 5 })` |
| **Redis Connection** | Shared `REDIS_URL` | Configured with `maxRetriesPerRequest: null`, `enableOfflineQueue: true` |
| **Default Attempts** | `3` | Maximum retry attempts before dead-lettering |
| **Backoff Policy** | `exponential` (500ms initial) | BullMQ delay formula: `500 * 2^(attempt - 1)` |
| **Remove on Complete** | `1000` | Retains last 1,000 completed jobs for audit |
| **Remove on Fail** | `false` | Retains **all** failed jobs for dead-letter querying |
| **Deduplication Key** | `jobId = event_outbox.id` | Prevents duplicate execution even across poll loops |

---

## 3. Job Types & Routing

`OutboxProcessor` routes jobs based on `eventType` and `payload.channel`:

| Job Type | Trigger Criteria | Processor Action |
|---|---|---|
| **SMS Confirmation** | `SMS_CONFIRMATION`, `SMS_ALERT`, or `channel === 'SMS'` | Logs delivered SMS in `notifications` table (`SMS`, `SMS_CONFIRMATION`). |
| **USSD / IVR Voice Alert** | `USSD_ALERT`, `USSD_NOTIFICATION`, `IVR_CALL`, `VOICE_OBD`, or `channel === 'USSD' \| 'IVR'` | Simulates DTMF-ready alert; logs in `notifications` table (`USSD` or `IVR`, `VOICE_ALERT`). |
| **PFMS Mock Status Polling** | `PFMS_POLL`, `PFMS_STATUS_CHECK`, or `PAYMENT_UPDATED` with `PROCESSING` | Simulates PFMS gateway reconciliation with UTR reference validation. |
| **Live Queue Broadcast** | All outbox events | Worker publishes JSON payload to Redis channel `queue:updates`. `QueueGateway` fans out live updates to Socket.IO clients (`center:${id}`, `farmer:${id}`). |

---

## 4. Dead-Letter Queue & Observability Endpoints

All endpoints are mounted under `/admin` and protected by `@Roles('ADMIN')`:

### 4.1 Queue Depth & Health Metrics
- **Endpoint**: `GET /api/v1/admin/queues` (or `/admin/queues`)
- **Response Format**:
```json
{
  "queue_name": "outbox-dispatch",
  "counts": {
    "waiting": 0,
    "active": 0,
    "completed": 104,
    "failed": 6,
    "delayed": 0,
    "paused": 0
  },
  "total_depth": 0,
  "dead_letter_count": 6
}
```

### 4.2 Query Dead-Letter Jobs
- **Endpoint**: `GET /api/v1/admin/queues/dead-letter?limit=50`
- **Response Format**:
```json
[
  {
    "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "name": "FAIL_DEAD_LETTER",
    "outbox_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "event_type": "FAIL_DEAD_LETTER",
    "failed_reason": "Unrecoverable downstream processing failure",
    "attempts_made": 3,
    "timestamp": 1726118000000,
    "processed_on": 1726118000150,
    "failed_on": 1726118000300,
    "data": {
      "forceFail": true
    }
  }
]
```

---

## 5. Verification & Test Suite

Run the full integration and burst test suite:

```bash
pnpm --filter @annsetu/api test
```

### Test Coverage (`apps/api/test/bullmq-outbox-dispatch.test.ts`):
1. **Enqueue on pending row**: Verifies `pollAndEnqueuePending` creates BullMQ job with `jobId = row.id`.
2. **Dispatch marking**: Verifies successful job sets `event_outbox.published_at` and records attempts.
3. **Transient retry**: Simulates failure on attempts 1 & 2; confirms BullMQ retries with exponential backoff and succeeds on attempt 3.
4. **Dead-letter preservation**: Simulates permanent failure; asserts job is NOT dropped and lands in `getDeadLetterJobs()`.
5. **Observability**: Verifies queue metrics and dead-letter endpoint accuracy through `AdminService`.
6. **SMS routing**: Verifies SMS notification delivery and DB persistence.
7. **USSD/IVR routing**: Verifies voice alert delivery and DTMF readiness.
8. **Realtime Socket.IO path**: Verifies Redis pub/sub channel `queue:updates` broadcast during dispatch.
9. **100-Job Burst Test**: Enqueues 100 jobs concurrently (85 standard, 10 transient-retry, 5 permanent-fail); verifies 100% resolve into 95 completed + 5 failed with 0 jobs lost and queue drained to 0.
