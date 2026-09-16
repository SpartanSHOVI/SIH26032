# AnnSetu — API Route Parity & Backend Migration Report
**Document Version:** 4.0.0 (Final Backend Completion)  
**Date:** September 12, 2026  
**Author:** Backend Engineer (`team/backend`)  
**Scope:** Complete Backend Workstream (Prompts 1, 2, 3, & 4 of 4)  
**Status:** 100% COMPLETE — ALL TARGET ROUTES, CONTROLLERS, WORKERS, AUTH HARDENING & SWAGGER SPECIFICATIONS IMPLEMENTED AND VERIFIED

---

## 1. Executive Summary

With the successful completion of **Prompt 4 of 4**, the **Backend workstream on the AnnSetu NestJS migration is 100% complete**. 

Across all 4 sequential backend prompts:
1. **Prompt 1 (Procurement & Payments):** Implemented dedicated `ProcurementController` and `PaymentsController` with a strict 7-stage procurement lifecycle state machine, real physical weighbridge and QC inspection persistence, and deterministic PFMS DBT payment status state transitions.
2. **Prompt 2 (Admin Macro Analytics & Mandi Rebalance):** Replaced all synthetic/mock fallbacks in `AdminController` with real database aggregations across `tokens`, `slots`, `centers`, `farmers`, and `audit_events`. Derived capacity utilization, wait time projections, 7-day linear demand predictions, and atomic mandi slot rebalancing.
3. **Prompt 3 (BullMQ Outbox Integration):** Replaced fragile inline timer polling with a durable, multi-worker BullMQ queue architecture (`outbox-dispatch`), supporting exponential backoff, dead-letter preservation, live Socket.IO Redis pub/sub broadcasts, and admin queue depth observability.
4. **Prompt 4 (Auth Hardening & Swagger Bootstrap):** Implemented zero-downtime, transparent password migration from legacy SHA-256 to Argon2 upon first successful login, enforced Argon2 for new farmer registrations, strictly gated Demo OTP behind `DEMO_MODE`/`DEMO_AUTH` with a fatal production startup guard, and bootstrapped `@nestjs/swagger` with complete OpenAPI 3.0 documentation covering 100% of routes and typed DTOs.

---

## 2. Reconciled Route Parity Matrix (Against `TEAM-COORDINATION.md`)

All 44 legacy endpoints originally cataloged in `TEAM-COORDINATION.md`, plus all modern NestJS architecture endpoints, are **100% DONE** with active database transactions, domain validation, outbox event emissions, and Swagger metadata.

### Summary Metrics:
```
Total Legacy Endpoints Audited:         44 / 44  (100.0% DONE)
Additional Modern Architecture Routes:  22 / 22  (100.0% DONE)
Total OpenAPI 3.0 Documented Routes:    66 / 66  (100.0% COVERAGE)
```

| Route & HTTP Method | Target Controller Handler | Status | Completed Date | Implementation Details & Swagger Coverage |
|---|---|:---:|:---:|---|
| **Admin Controller (`@ApiTags('Admin')`)** | | | | |
| `GET /api/v1/admin/overview` | `AdminController.overview` | **DONE** | 2026-09-12 | Dual-contract KPI summary (legacy + modern keys). Full Swagger DTO documentation. |
| `GET /api/v1/admin/centers` | `AdminController.centers` | **DONE** | 2026-09-12 | Real database query via `listCenters` with state, district, classification, and name search filters. |
| `GET /api/v1/admin/farmers` | `AdminController.farmers` | **DONE** | 2026-09-12 | Joined query across `tokens`, `farmers`, `centers`, and `slots` for `AdminDashboard.tsx` registry tab. |
| `GET /api/v1/admin/centers/:id/predict-demand` | `AdminController.predictDemand` | **DONE** | 2026-09-12 | 7-day linear trend (least-squares regression) with honest zero fallback and response metadata. |
| `POST /api/v1/admin/centers/:id/generate-slots` | `AdminController.generateSlots` | **DONE** | 2026-09-12 | Generates 7 balanced hourly slot intervals with capacity allocation. |
| `GET /api/v1/admin/analytics` | `AdminController.analytics` | **DONE** | 2026-09-12 | Real Prisma aggregation: bookings vs capacity, wait time formula, completion rates, and pipeline telemetry. |
| `POST /api/v1/admin/rebalance-mandi` | `AdminController.rebalance` | **DONE** | 2026-09-12 | Validates target capacity, auditable persistence to `audit_events`, outbox event, deduplication. |
| `GET /api/v1/admin/rebalance-mandi/history` | `AdminController.rebalanceHistory` | **DONE** | 2026-09-12 | Historical audit trail for inter-mandi rebalance operations. |
| `GET /api/v1/admin/queues` | `AdminController.getQueues` | **DONE** | 2026-09-12 | BullMQ queue telemetry: waiting, active, completed, failed, delayed counts. |
| `GET /api/v1/admin/queues/dead-letter` | `AdminController.getDeadLetter` | **DONE** | 2026-09-12 | DLQ inspection endpoint returning failed job stack traces and payloads. |
| **Procurement Controller (`@ApiTags('Procurement')`)** | | | | |
| `GET /api/v1/procurement/:bookingId` | `ProcurementController.getStatus` | **DONE** | 2026-09-12 | Real Prisma query joining `tokens`, `centers`, `slots`, and `farmers`. |
| `GET /api/v1/procurement/my` | `ProcurementController.getMy` | **DONE** | 2026-09-12 | Dedicated procurement history endpoint for authenticated farmer. |
| `POST /api/v1/procurement/:id/gate-entry` | `ProcurementController.gateEntry` | **DONE** | 2026-09-12 | Transitions `booked` → `arrived` (`lotStatus: GATE_ENTRY`), emits outbox and audit events. |
| `POST /api/v1/procurement/:id/weighing` | `ProcurementController.weighing` | **DONE** | 2026-09-12 | Validates gross/tare weights, calculates net weight, transitions to `verification` (`lotStatus: WEIGHING`). |
| `POST /api/v1/procurement/:id/quality-check` | `ProcurementController.qualityCheck` | **DONE** | 2026-09-12 | Validates moisture % (0–100%) and boolean inspection result. Transitions to QC or terminal rejection. |
| `POST /api/v1/procurement/:id/lot-accepted` | `ProcurementController.lotAccepted` | **DONE** | 2026-09-12 | Finalizes lot acceptance (`lotStatus: ACCEPTED`). Aliased to `:id/accept`. |
| `POST /api/v1/procurement/:id/reject` | `ProcurementController.reject` | **DONE** | 2026-09-12 | Explicit rejection from any non-terminal state with mandatory `reject_reason`. |
| `PATCH /api/v1/procurement/:id/status` | `ProcurementController.updateStatus` | **DONE** | 2026-09-12 | Flexible staff patch endpoint with full state machine and audit persistence. |
| **Payment Controller (`@ApiTags('Payments')`)** | | | | |
| `GET /api/v1/payments/:procurementLotId` | `PaymentsController.getStatus` | **DONE** | 2026-09-12 | Resolves payment details by token ID, number, or UTR with dual camelCase/snake_case keys. |
| `GET /api/v1/payments/my` | `PaymentsController.getMy` | **DONE** | 2026-09-12 | Returns all payment and DBT records for authenticated farmer with MSP rate settlements. |
| `POST /api/v1/payments/:id/transition` | `PaymentsController.advancePayment` | **DONE** | 2026-09-12 | Advances PFMS state machine `PENDING` → `PROCESSING` → `CREDITED`. |
| `PATCH /api/v1/payments/:id/status` | `PaymentsController.updateStatus` | **DONE** | 2026-09-12 | Idempotent status update with custom amount, UTR, or mock PFMS gateway payload. |
| **Auth Controller (`@ApiTags('Auth')`)** | | | | |
| `POST /api/v1/auth/login` | `AuthController.login` | **DONE** | 2026-09-12 | Transparent SHA-256 → Argon2 password upgrade on success; direct Argon2 verify; sets cookies. |
| `POST /api/v1/centers/operator/login` | `AuthController.login` | **DONE** | 2026-09-12 | Center operator login mapped via alias in `AuthController.login`. |
| `POST /api/v1/auth/register` | `AuthController.register` | **DONE** | 2026-09-12 | Farmer onboarding with direct Argon2 hashing and advisory locking. |
| `POST /api/v1/auth/request-otp` | `AuthController.otp` | **DONE** | 2026-09-12 | Demo OTP request flow, strictly gated behind `DEMO_MODE`/`DEMO_AUTH`. Aliased to `send-otp`. |
| `POST /api/v1/auth/verify-otp` | `AuthController.verify` | **DONE** | 2026-09-12 | Demo OTP verification flow, gated behind demo flag. |
| `GET /api/v1/auth/profile` | `AuthController.profile` | **DONE** | 2026-09-12 | Returns authenticated farmer or operator profile. Also handles `GET farmers/:id`. |
| `PATCH /api/v1/auth/profile` | `AuthController.update` | **DONE** | 2026-09-12 | Profile update with field validation. Also handles `PATCH farmers/:id`. |
| `GET /api/v1/farmers/lookup` | `AuthController.lookup` | **DONE** | 2026-09-12 | Looks up farmer demographic profile by mobile number. |
| `POST /api/v1/auth/refresh` | `AuthController.refresh` | **DONE** | 2026-09-12 | Rotates refresh sessions in PostgreSQL, verifies CSRF token, and re-issues cookies. |
| `POST /api/v1/auth/logout` | `AuthController.logout` | **DONE** | 2026-09-12 | Revokes session in DB and clears authentication cookies. |
| **Center Controller (`@ApiTags('Centers')`)** | | | | |
| `GET /api/v1/centers/:id/queue` | `CenterController.queueForCenter` | **DONE** | 2026-09-12 | Ordered tokens by date and slot start time via `QueueService`. |
| `GET /api/v1/centers/:id/analytics` | `CenterController.analytics` | **DONE** | 2026-09-12 | Summary waiting/procured/rejected counts and status breakdowns. |
| `POST /api/v1/centers/:id/call-next` | `CenterController.callNext` | **DONE** | 2026-09-12 | Atomic token claim using `FOR UPDATE SKIP LOCKED`, status transition, outbox event. |
| `PATCH /api/v1/tokens/:id/status` | `CenterController.updateStatus` | **DONE** | 2026-09-12 | Enforces sequential status lifecycle, terminal `rejected`, emits `STATUS_CHANGED`. |
| `PATCH /api/v1/tokens/:id/payment` | `CenterController.payment` | **DONE** | 2026-09-12 | Updates payment status, sets `payment_completed` upon credit, emits `PAYMENT_UPDATED`. |
| `POST /api/v1/centers/:id/announcements`| `CenterController.announcement` | **DONE** | 2026-09-12 | Emergency broadcast insertion. Aliased to `/announcement`. |
| `GET /api/v1/centers/:id/announcements` | `CenterController.announcements` | **DONE** | 2026-09-12 | Fetches center announcements sorted by timestamp. |
| `GET /api/v1/messages` | `CenterController.messages` | **DONE** | 2026-09-12 | Fetches SMS/WhatsApp dispatch logs. |
| **Location Controller (`@ApiTags('Locations')`)** | | | | |
| `GET /api/v1/locations/states` | `LocationsController.states` | **DONE** | 2026-09-12 | Flat string list of active procurement states. |
| `GET /api/v1/locations/districts` | `LocationsController.districts` | **DONE** | 2026-09-12 | Flat string list of active districts for given state. |
| `GET /api/v1/locations/classifications`| `LocationsController.classifications`| **DONE** | 2026-09-12 | Flat string list of center classifications (`MAJOR_MANDI`, `SUB_YARD`, `PURCHASE_CENTER`). |
| `GET /api/v1/locations/centers` | `LocationsController.centers` | **DONE** | 2026-09-12 | Filtered APMC centers with calculated waiting counts. |
| **Booking Controller (`@ApiTags('Bookings')`)** | | | | |
| `GET /api/v1/bookings/centers` | `BookingController.centers` | **DONE** | 2026-09-12 | Aliased with `GET centers`. Returns available centers with capacity telemetry. |
| `GET /api/v1/centers/:id/slots` | `BookingController.slots` | **DONE** | 2026-09-12 | Aliased with `GET bookings/availability`. Auto-populates operating hours. |
| `POST /api/v1/tokens/book` | `BookingController.book` | **DONE** | 2026-09-12 | Aliased with `POST bookings`. Atomic slot row lock, token generation via sequence. |
| `POST /api/v1/tokens/call-book` | `BookingController.callBook` | **DONE** | 2026-09-12 | Assisted staff booking with automated farmer profile creation. |
| `POST /api/v1/tokens/:id/running-late` | `BookingController.runningLate` | **DONE** | 2026-09-12 | Grants 15-minute grace period, updates `grace_until`, emits outbox position update. |
| `GET /api/v1/bookings/my` | `BookingController.my` | **DONE** | 2026-09-12 | Returns all historical and active bookings for farmer. |
| **Queue Controller (`@ApiTags('Queue')`)** | | | | |
| `GET /api/v1/tokens/:id` | `QueueController.token` | **DONE** | 2026-09-12 | Aliased with `GET queue/:tokenId`. Calculates live ahead count and wait time. |
| `GET /api/v1/tokens/lookup` | `QueueController.lookup` | **DONE** | 2026-09-12 | Aliased with `GET queue/lookup`. Looks up active token by token number or mobile. |
| `GET /api/v1/farmers/:id/notifications`| `QueueController.notifications` | **DONE** | 2026-09-12 | Aliased with `GET notifications`. Returns delivery history of alerts. |
| **Channel, Health & Translation Controllers** | | | | |
| `POST /api/v1/ussd` | `ChannelController.ussd` | **DONE** | 2026-09-12 | Telecom webhook endpoint (*555#) with standard `CON`/`END` syntax. |
| `GET /api/v1/ussd` | `ChannelController.ussdGet` | **DONE** | 2026-09-12 | Simulated USSD dial query for testing/feature phones. |
| `POST /api/v1/ivr/call` | `ChannelController.ivr` | **DONE** | 2026-09-12 | Toll-free voice IVR state machine supporting Hindi, Punjabi, Marathi, English. |
| `GET /api/v1/ivr/alerts` | `ChannelController.alerts` | **DONE** | 2026-09-12 | Voice outbound dialing (OBD) broadcast logs. |
| `POST /api/v1/translate` | `TranslationController.translate`| **DONE** | 2026-09-12 | Google Cloud Translation proxy with Redis caching (24h TTL). |
| `GET /api/v1/health` | `HealthController.health` | **DONE** | 2026-09-12 | Readiness/liveness probe verifying PostgreSQL and Redis connections. |

---

## 3. In-Depth Feature Verification: Prompt 4 Specifics

### 3.1 SHA-256 → Argon2 Transparent Password Migration
- **Detection & Upgrade:** On `login`, if the stored hash matches `/^[a-fA-F0-9]{64}$/`, it verifies the plaintext password using timing-safe SHA-256 comparison. On success, it immediately re-hashes the password using `argon2.hash(password)` and atomically writes the new hash to `app_accounts` (`WHERE id = $2 AND password_hash = $3`) and `farmers` in the same request.
- **New Registrations:** Always hashed with Argon2 directly upon account creation.
- **Malformed Hash Protection:** Invalid/corrupt hashes in PostgreSQL are caught safely and return `UnauthorizedException('Invalid credentials')` instead of crashing with a 500 error.
- **Concurrency Safety:** Parallel requests on the same legacy account migrate safely without deadlocks or hash corruption.

### 3.2 Demo OTP Gating & Production Startup Guard
- **Flag Configuration:** Controlled by `DEMO_MODE=true` or `DEMO_AUTH=true`. Unset by default in all production files and Docker configs.
- **Access Guard:** Attempting to invoke `POST /auth/request-otp` or `POST /auth/verify-otp` with the flag unset/false immediately rejects with `ForbiddenException('Demo OTP unavailable: demo mode is disabled')`.
- **Production Startup Guard:** In `apps/api/src/config/env.ts`, if `NODE_ENV === 'production'` and demo mode is enabled, the application immediately throws:
  ```
  FATAL: Demo authentication / DEMO_MODE is strictly forbidden in production environments.
  ```

### 3.3 Swagger OpenAPI 3.0 Documentation
- **UI Endpoint:** Served at `/api/docs/`
- **JSON Specification:** Served at `/api/docs-json`
- **YAML Specification:** Served at `/api/docs-yaml`
- **Route Coverage:** 66/66 paths documented with `@ApiTags`, `@ApiOperation`, `@ApiResponse`, and typed DTO classes (`LoginDto`, `RegisterDto`, `DemoOtpRequestDto`, `DemoOtpVerifyDto`, `WeighingInputDto`, `QualityCheckInputDto`, `RejectInputDto`, `StatusUpdateDto`, `UpdatePaymentStatusDto`, `RebalanceRequestDto`).

---

## 4. Automated Test Suite Verification

### Full Test Suite Run (`apps/api`)
Command: `pnpm --filter @annsetu/api test`  
Result: **57 tests across 8 test suites PASS cleanly (0 failures, 0 skipped)**

```
▶ Admin Analytics Integration Tests (Exact Real Calculations)
  ✔ 1. should compute exact booking vs capacity utilization (Center A: 12/20 = 60.0%, Center B: 8/10 = 80.0%)
  ✔ 2. should compute exact procurement completion rate (Center A: 6/12 = 50.0%, Center B: 8/8 = 100.0%)
  ✔ 3. should calculate wait time using queue module formula (Center A: 4 waiting, 2 counters, 6 min = 12 mins; Center B: 0 waiting = 0 mins)
  ✔ 4. should return honest zero values for empty Center C without falling back to synthetic hardcoded numbers
  ✔ 5. should scope aggregations strictly to target date (0 bookings on other date; exact summary sums on test date)
✔ Admin Analytics Integration Tests (Exact Real Calculations) (249ms)

▶ Admin Predict Demand Unit & Integration Tests
  ✔ 1. should project steady demand accurately and document method in metadata
  ✔ 2. should return honest zero projection for center with zero history
  ✔ 3. should project linear trend for center with upward demand progression
✔ Admin Predict Demand Unit & Integration Tests (256ms)

▶ Admin Mandi Rebalance Integration Tests
  ✔ 1. should validate and record a valid rebalance request within available target capacity
  ✔ 2. should reject rebalance request against nonexistent center with 404
  ✔ 3. should reject rebalance request that exceeds target center capacity with 409
  ✔ 4. should handle duplicate rebalance request deterministically without creating duplicate audit rows
✔ Admin Mandi Rebalance Integration Tests (189ms)

▶ Auth Argon2 Password Migration & Demo OTP Gating & Swagger Verification
  ✔ 1. should verify legacy SHA-256 hash on login and transparently upgrade stored hash to Argon2 in same request
  ✔ 2. should reject login with wrong password on legacy account and NOT upgrade the stored hash
  ✔ 3. should authenticate already-Argon2 account normally without redundant re-hashing
  ✔ 4. should produce an Argon2 password hash directly for newly registered farmers
  ✔ 5. should allow migrated account to log in repeatedly using the new Argon2 hash
  ✔ 6. should safely handle concurrent login attempts on the same legacy account without hash corruption
  ✔ 7. should fail cleanly with UnauthorizedException on malformed/corrupted stored hash instead of crashing with 500
  ✔ 8. should successfully request and verify demo OTP when demo mode is enabled
  ✔ 9. should reject demo OTP with ForbiddenException when DEMO_AUTH / DEMO_MODE is disabled
  ✔ 10. should assert that startup guard rejects production environment if demo flag is enabled
  ✔ 11. should generate a valid OpenAPI 3.0 specification document with title, version, and tags
  ✔ 12. should contain entries in Swagger schema for procurement, payment, admin analytics, and BullMQ-admin paths
✔ Auth Argon2 Password Migration & Demo OTP Gating & Swagger Verification (607ms)

▶ BullMQ Outbox Dispatch Integration & Burst Tests
  ✔ 1. should enqueue a BullMQ job for a pending event_outbox row
  ✔ 2. should process job successfully and mark event_outbox row dispatched (published_at not null)
  ✔ 3. should retry job with exponential backoff on simulated transient failure and succeed on attempt 3
  ✔ 4. should land in dead-letter state after exhausting retries without silently dropping
  ✔ 5. should provide accurate and queryable queue depth counts and dead-letter endpoint
  ✔ 6. should route SMS_CONFIRMATION jobs to SMS handler and persist delivered notification
  ✔ 7. should route USSD_NOTIFICATION and IVR_CALL jobs to respective handlers and persist voice alerts
  ✔ 8. should fire Redis pub/sub queue:updates broadcast on job dispatch to maintain Socket.IO realtime path
  ✔ 9. [BURST TEST] should enqueue 100 jobs in quick succession and ensure 100% are processed or dead-lettered with 0 jobs lost
✔ BullMQ Outbox Dispatch Integration & Burst Tests (1118ms)

▶ Payment PFMS Mock Adapter & Service
  ✔ 1. should handle PENDING status and return next state PROCESSING
  ✔ 2. should handle PROCESSING status and return next state CREDITED
  ✔ 3. should handle CREDITED status as terminal
  ✔ 4. should generate and validate realistic PFMS UTR format
  ✔ 5. should generate deterministic simulated PFMS response payload
  ✔ 6. should ensure idempotent-upsert no-op and exact audit log count on replay
✔ Payment PFMS Mock Adapter & Service (1.5ms)

▶ Procurement State Machine
  ✔ 1. should validate full sequential happy path traversal
  ✔ 2. should reject invalid jump from "booked" directly to "verification" with 409
  ✔ 3. should reject invalid jump from "arrived" directly to "quality_check" with 409
  ✔ 4. should reject invalid jump from "verification" directly to "accepted" with 409
  ✔ 5. should reject invalid jump from "quality_check" directly to "procured" with 409
  ✔ 6. should reject invalid jump from "accepted" directly to "payment_processing" with 409
  ✔ 7. should reject invalid jump from "procured" directly to "payment_completed" with 409
  ✔ 8. should reject invalid backward jump from "payment_processing" to "arrived" with 409
  ✔ 9. should allow transition to "rejected" from "booked"
  ✔ 10. should allow transition to "rejected" from "verification"
  ✔ 11. should allow transition to "rejected" from "quality_check"
  ✔ 12. should reject any transition out of terminal "rejected" state with 409
  ✔ 13. should reject any transition out of terminal "payment_completed" state with 409
  ✔ 14. should accurately return next expected state across all stages
✔ Procurement State Machine (1.7ms)

▶ Weighing & QC Field Persistence Integration Test
  ✔ 1. should persist gate-entry transition to arrived
  ✔ 2. should persist weighing fields (gross_weight, tare_weight, net_weight) round-trip through Prisma
  ✔ 3. should persist quality-check fields (moisture_percent, quality_pass) round-trip through Prisma
  ✔ 4. should accept lot and verify audit trail persistence
✔ Weighing & QC Field Persistence Integration Test (223ms)

ℹ tests 57
ℹ suites 8
ℹ pass 57
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 9380ms
```

### TypeScript & Build Verification
```bash
pnpm --filter @annsetu/api typecheck   # PASS (0 errors)
pnpm --filter @annsetu/api build       # PASS (0 errors, compiles to dist/)
```

---

## 5. Conclusion & Backend Hand-off

The Backend workstream has achieved **complete 1:1 functional and architectural parity** with the legacy system while elevating AnnSetu to modern production standards:
- All business logic (procurement, payment, admin analytics, queue tracking, bookings) is production-ready.
- Asynchronous messaging is resiliently managed via BullMQ with automatic DLQ retention.
- Authentication is hardened with modern Argon2 cryptographic standards, transparent migration, and strict demo OTP gating.
- Full API documentation is automatically generated and accessible via OpenAPI 3.0 / Swagger UI.
