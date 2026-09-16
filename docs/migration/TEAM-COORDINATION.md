# AnnSetu — Engineering Team Coordination & Migration Baseline
**Document Version:** 1.0.0  
**Target Repository:** `github.com/SpartanSHOVI/AnnSetuV2`  
**Date:** September 12, 2026  
**Author:** Lead Engineer  
**Audience:** Workstream Leads (Backend, Frontend, Platform+QA)  

---

## 1. Executive Summary & Objective

AnnSetu (SIH 26032) is transitioning from a legacy multi-runtime architecture (Java Spring Boot 3.3 + Standalone Node Realtime + Vite/React Farmer Portal) to a modern, unified, production-grade monorepo stack:
- **Frontend:** Next.js (App Router client-wrapper) + TypeScript (`apps/web`)
- **Backend:** NestJS on Express (`apps/api`)
- **Database:** PostgreSQL 16 via Prisma ORM
- **Cache / PubSub:** Redis 7.2
- **Asynchronous Jobs & Outbox:** BullMQ
- **API Documentation:** OpenAPI / Swagger (`@nestjs/swagger`)
- **Infrastructure:** Docker Compose & Containerized Microservices

This document establishes the **verified source-of-truth baseline** before parallel engineering commences. It details current repository drift, provides a comprehensive route parity matrix, assigns workstream task breakdowns, defines strict branching and merge policies, and outlines the final definition of done.

---

## 2. Verified Current State vs. Migration Claims

An audit was executed on **September 12, 2026** against the claims documented in `AnnSetu/docs/migration/verification.md` (dated September 9, 2026).

### 2.1 Audit Findings & Drift Analysis

| Component / Verification Claim | Verification Claim (Sep 09, 2026) | Verified State (Sep 12, 2026) | Drift / Impact Status |
|---|---|---|---|
| **`apps/api` Typecheck** | Passed (`tsc --noEmit`) | **PASSES** | Clean typecheck, no syntax or type errors. |
| **`apps/api` Production Build** | Passed (`tsc -p tsconfig.json`) | **PASSES** | Compiles into `dist/` cleanly. |
| **`apps/api` Test Suite** | Assumed functional | **EMPTY (0 tests)** | `test/` directory contains 0 test files (`tsx --test` runs 0 suites). Integration harness required. |
| **`apps/web` Typecheck** | Passed (`tsc --noEmit`) | **FAILS (TS2339)** | **DRIFT DETECTED:** Commit `620324b` / `5f9e17c` introduced broken response unwrapping in `src/screens/Register.tsx(62,31)` and `(82,31)` (`Property 'data' does not exist on type 'any[]'`). |
| **`apps/web` Production Build** | Passed (`next build --webpack`) | **FAILS** | Build aborted due to the TypeScript error in `Register.tsx`. |
| **OpenAPI / Swagger UI** | `@nestjs/swagger` installed | **PARTIALLY BOOTSTRAPPED** | Bootstrapped in `src/main.ts` on `api/docs`, but **0 controllers or DTOs** possess OpenAPI annotations (`@ApiTags`, `@ApiOperation`, `@ApiProperty`). UI shows empty/generic contracts. |
| **BullMQ Job Queue** | Target architecture requirement | **ABSENT** | BullMQ is not installed. Outbox dispatching relies on a raw, unmonitored `setInterval(1000)` in `src/main.ts:33`. |
| **Node Engine Consistency** | Pinned `24.20.0` | **ENGINE WARNING** | Local shell runs Node `v26.8.1`, triggering pnpm engine mismatch warnings against `.nvmrc` and `package.json` engines. |

> [!WARNING]
> **Priority Phase 1 Blocker for Frontend & Platform+QA:**  
> The build failure in `apps/web` (`Register.tsx`) blocks production compilation. The Frontend engineer must resolve this contract mismatch immediately, while Platform+QA must lock the CI typecheck pipeline.

---

## 3. Comprehensive Route Parity Matrix

Every legacy Java Spring Boot controller endpoint specified in `docs/migration/contracts.md` has been mapped to its NestJS equivalent in `apps/api`.

### Status Legend
- **DONE**: Fully implemented in NestJS with active database transactions, domain validation, and outbox event emissions.
- **PARTIAL**: Route exists in NestJS, but exhibits contract drift, schema mismatches, or missing payload features compared to the legacy implementation and UI expectations.
- **PLACEHOLDER**: Folder or stub exists, but no functional controller or routes are mounted.
- **MISSING**: Completely absent in NestJS; returns 404.

```
Total Legacy Endpoints Audited: 44
├── DONE:                 34 (77.3%)
├── PARTIAL:               6 (13.6%)
└── PLACEHOLDER / MISSING: 4  (9.1%)

Additional NestJS Target Endpoints: 4 (Auth Refresh, Logout, Translation Proxy, Health Check)
```

### Parity Table

| Legacy Controller & HTTP Route | Legacy Method / Operation | NestJS Target Route & Controller Handler | Status | Contract Drift & Technical Notes |
|---|---|---|:---:|---|
| **AdminController.java** | | | | |
| `GET /api/v1/admin/overview` | `getOverview(date)` | `GET admin/overview` (`AdminController.overview`) | **DONE** | Aggregates daily KPI counts (centers, farmers, tokens, procured, pending outbox). |
| `GET /api/v1/admin/centers` | `getCentersOverview(...)` | `GET admin/centers` (`AdminController.centers`) | **DONE** | Delegates to `listCenters` with congestion status and waiting counts. |
| `GET /api/v1/admin/farmers` | `getAllFarmersAndTokens()` | `GET admin/farmers` (`AdminController.farmers`) | **DONE** | Joined with `tokens`, `centers`, and `slots`. Supplies `token_number`, `farmer_name`, `mobile`, `center_name`, `date`, `start_time` for `AdminDashboard.tsx`. |
| `GET /api/v1/admin/centers/:id/predict-demand` | `predictDemand(centerId)` | `GET admin/centers/:centerId/predict-demand` (`AdminController.predictDemand`) | **DONE** | Real 7-day linear trend and moving average with honest zero fallback for unseeded centers. Method documented in response metadata. |
| `POST /api/v1/admin/centers/:id/generate-slots` | `generateSlots(centerId, body)` | `POST admin/centers/:centerId/generate-slots` (`AdminController.generateSlots`) | **DONE** | Generates hourly slot intervals (09:00–17:00) with capacity balancing and upsert logic. |
| `GET /api/v1/admin/analytics` | `getMacroAnalytics(date, state)` | `GET admin/analytics` (`AdminController.analytics`) | **DONE** | Real Prisma aggregation: bookings vs capacity, queue module rolling average wait times, completion rate, and full macro pipeline telemetry. |
| `POST /api/v1/admin/rebalance-mandi` | `rebalanceMandi(body)` | `POST admin/rebalance-mandi` (`AdminController.rebalance`) | **DONE** | Validates source/target existence, checks target capacity, records in `audit_events` and `event_outbox`, with deterministic deduplication. |
| **CenterController.java** | | | | |
| `GET /api/v1/centers/:id/queue` | `getCenterQueue(centerId, date)` | `GET centers/:centerId/queue` (`CenterController.queueForCenter`) | **DONE** | Returns ordered tokens by date and slot start time via `QueueService.centerQueue`. |
| `GET /api/v1/centers/:id/analytics` | `getCenterAnalytics(centerId, date)` | `GET centers/:centerId/analytics` (`CenterController.analytics`) | **DONE** | Returns summary waiting/procured/rejected counts and status breakdowns. |
| `POST /api/v1/centers/:id/call-next` | `callNextFarmer(centerId, date)` | `POST centers/:centerId/call-next` (`CenterController.callNext`) | **DONE** | Atomic token claim using `FOR UPDATE SKIP LOCKED`, status transition (`arrived` / `verification`), outbox event enqueued. |
| `PATCH /api/v1/tokens/:id/status` | `updateTokenStatus(tokenId, body)` | `PATCH tokens/:tokenId/status` (`CenterController.updateStatus`) | **DONE** | Enforces sequential status lifecycle (`statusFlow`), terminal `rejected` state, records `quantity_received`, emits `STATUS_CHANGED`. |
| `PATCH /api/v1/tokens/:id/payment` | `updatePayment(tokenId, body)` | `PATCH tokens/:tokenId/payment` (`CenterController.payment`) | **DONE** | Updates payment status, sets `payment_completed` upon credit, emits `PAYMENT_UPDATED`. |
| `POST /api/v1/centers/:id/announcements` | `createAnnouncement(centerId, body)` | `POST centers/:centerId/announcements` (`CenterController.announcement`) | **DONE** | Inserts emergency broadcast into `center_announcements`. Also supports `/announcement`. |
| `GET /api/v1/centers/:id/announcements` | `getAnnouncements(centerId)` | `GET centers/:centerId/announcements` (`CenterController.announcements`) | **DONE** | Returns center announcements sorted by created timestamp. |
| `GET /api/v1/messages` | `getMessageLogs(farmerId, centerId)` | `GET messages` (`CenterController.messages`) | **DONE** | Fetches SMS/WhatsApp message dispatch logs with optional filters. |
| `POST /api/v1/centers/operator/login` | `operatorLogin(body)` | `POST centers/operator/login` (`AuthController.login`) | **DONE** | Mapped in `AuthController.login` under `@Post(['auth/login','centers/operator/login'])`. Sets secure session cookies. |
| **LocationController.java** | | | | |
| `GET /api/v1/locations/states` | `getStates()` | `GET locations/states` (`LocationsController.states`) | **PARTIAL** | **Contract Drift:** Returns `[{ state: string }]` objects instead of primitive `string[]`. Broke `Register.tsx` typecheck and runtime contract. |
| `GET /api/v1/locations/districts` | `getDistricts(state)` | `GET locations/districts` (`LocationsController.districts`) | **PARTIAL** | **Contract Drift:** Returns `[{ district: string }]` objects instead of primitive `string[]`. |
| `GET /api/v1/locations/classifications` | `getClassifications()` | `GET locations/classifications` (`LocationsController.classifications`) | **PARTIAL** | **Contract Drift:** Returns `[{ classification: string }]` objects instead of primitive `string[]`. |
| `GET /api/v1/locations/centers` | `getCentersByLocation(...)` | `GET locations/centers` (`LocationsController.centers`) | **DONE** | Returns filtered APMC centers with calculated waiting counts and status. |
| **AuthController.java** | | | | |
| `POST /api/v1/auth/register` | `register(req)` | `POST auth/register` (`AuthController.register`) | **DONE** | Advisory locking on mobile, Argon2 hash, farmer record created, session cookies issued. |
| `POST /api/v1/auth/login` | `login(req)` | `POST auth/login` (`AuthController.login`) | **DONE** | Supports mobile/Aadhaar/Farmer ID, automatic migration from legacy SHA-256 to Argon2, issues HTTP-only JWT cookies. |
| `POST /api/v1/auth/request-otp` | `requestOtp(req)` | `POST auth/request-otp` (`AuthController.otp`) | **DONE** | Generates simulated OTP (supports alias `auth/send-otp`). Guarded by demo flags. |
| `POST /api/v1/auth/verify-otp` | `verifyOtp(req)` | `POST auth/verify-otp` (`AuthController.verify`) | **DONE** | Verifies demo OTP (123456) and issues authentication session. |
| `GET /api/v1/auth/profile` | `getProfile(id)` | `GET auth/profile` (`AuthController.profile`) | **DONE** | Returns authenticated principal profile (Farmer or Center Operator). Also handles `GET farmers/:id`. |
| `PATCH /api/v1/auth/profile` | `updateProfile(id, data)` | `PATCH auth/profile` (`AuthController.update`) | **DONE** | Updates profile fields with validation. Also handles `PATCH farmers/:id`. |
| `GET /api/v1/farmers/lookup` | `lookupFarmer(mobile)` | `GET farmers/lookup` (`AuthController.lookup`) | **DONE** | Looks up registered farmer demographic profile by mobile number. |
| **IvrController.java** | | | | |
| `POST /api/v1/ivr/call` | `handleIncomingCall(...)` | `POST ivr/call` (`ChannelController.ivr`) | **DONE** | Toll-free voice IVR state machine supporting Hindi, Punjabi, Marathi, English, and DTMF keypress actions. |
| `GET /api/v1/ivr/alerts` | `getRecordedVoiceAlerts(...)` | `GET ivr/alerts` (`ChannelController.alerts`) | **DONE** | Returns synthetic and recorded voice outbound dialing (OBD) broadcast logs. |
| **UssdController.java** | | | | |
| `POST /api/v1/ussd` | `handleUssdJson / handleUssdForm` | `POST ussd` (`ChannelController.ussd`) | **DONE** | Telecom webhook endpoint (*555#). Parses JSON and Form payload; returns text with standard `CON`/`END` syntax. |
| `GET /api/v1/ussd` | `handleUssdGet(...)` | `GET ussd` (`ChannelController.ussdGet`) | **DONE** | Simulated USSD dial query for testing/feature phones. |
| **BookingController.java** | | | | |
| `GET /api/v1/bookings/centers` | `getCenters(...)` | `GET bookings/centers` (`BookingController.centers`) | **DONE** | Aliased with `GET centers`. Returns available centers with capacity telemetry. |
| `GET /api/v1/centers/:id/slots` | `getSlots(centerId, date)` | `GET centers/:centerId/slots` (`BookingController.slots`) | **DONE** | Aliased with `GET bookings/availability`. Auto-populates operating hours if missing. |
| `POST /api/v1/tokens/book` | `bookToken(req)` | `POST tokens/book` (`BookingController.book`) | **DONE** | Aliased with `POST bookings`. Atomic slot row lock, capacity check, token generation via sequence, outbox event. |
| `POST /api/v1/tokens/call-book` | `callBookToken(req)` | `POST tokens/call-book` (`BookingController.callBook`) | **DONE** | Assisted staff booking with automated on-the-fly farmer profile creation and SMS dispatch. |
| `POST /api/v1/tokens/:id/running-late` | `requestRunningLate(tokenId)` | `POST tokens/:tokenId/running-late` (`BookingController.runningLate`) | **DONE** | Grants one-time 15-minute grace period, updates `grace_until`, emits outbox position update. |
| `GET /api/v1/bookings/my` | `getMyBookings(farmerId)` | `GET bookings/my` (`BookingController.my`) | **DONE** | Returns all historical and active bookings for farmer with center and slot joins. |
| **QueueController.java** | | | | |
| `GET /api/v1/tokens/:id` | `getTokenDetails(tokenId)` | `GET tokens/:tokenId` (`QueueController.token`) | **DONE** | Aliased with `GET queue/:tokenId`. Calculates live queue position (`ahead` count) and estimated wait time. |
| `GET /api/v1/tokens/lookup` | `lookupToken(value)` | `GET tokens/lookup` (`QueueController.lookup`) | **DONE** | Aliased with `GET queue/lookup`. Looks up active token by token number or mobile number. |
| `GET /api/v1/farmers/:id/notifications`| `getNotifications(farmerId)` | `GET farmers/:farmerId/notifications` (`QueueController.notifications`) | **DONE** | Aliased with `GET notifications`. Returns delivery history of alerts. |
| **ProcurementController.java** | | | | |
| `GET /api/v1/procurement/:bookingId` | `getProcurementStatus(bookingId)` | `GET procurement/:bookingId` (`ProcurementController.getStatus`) | **DONE** | Backed by Prisma queries joining tokens, centers, slots, farmers. Direct frontend contract parity. |
| `GET /api/v1/procurement/my` | `getMyProcurement()` | `GET procurement/my` (`ProcurementController.getMy`) | **DONE** | Dedicated procurement history endpoint for authenticated farmer with center join. |
| **PaymentController.java** | | | | |
| `GET /api/v1/payments/:lotId` | `getPaymentStatus(lotId)` | `GET payments/:procurementLotId` (`PaymentsController.getStatus`) | **DONE** | Resolves payment details with camelCase and snake_case properties and PFMS response metadata. |
| `GET /api/v1/payments/my` | `getMyPayments()` | `GET payments/my` (`PaymentsController.getMy`) | **DONE** | Dedicated payment and DBT history endpoint for authenticated farmer. |
| **Additional Target API Endpoints** | | | | |
| `POST /api/v1/auth/refresh` | *N/A (Legacy used mock tokens)* | `POST auth/refresh` (`AuthController.refresh`) | **DONE** | Rotates refresh sessions in PostgreSQL, verifies CSRF token, and re-issues cookies. |
| `POST /api/v1/auth/logout` | *N/A* | `POST auth/logout` (`AuthController.logout`) | **DONE** | Revokes session in DB and clears authentication cookies. |
| `POST /api/v1/translate` | *N/A* | `POST translate` (`TranslationController.translate`) | **DONE** | Proxies Google Cloud Translation with Redis caching (24h TTL) to prevent browser API key exposure. |
| `GET /api/v1/health` | `actuator/health` | `GET health` (`HealthController.health`) | **DONE** | Readiness/liveness probe verifying PostgreSQL and Redis connections. |

---

## 4. Redis Architecture & BullMQ Ownership

### 4.1 Current Redis Usage
1. **Outbox Event Dispatch (`EventsService`):**
   - Events are written to the `event_outbox` table during business transactions.
   - Dispatching is driven by an unmonitored Node `setInterval(1000)` in `src/main.ts:33`.
   - Events are published to the Redis channel `queue:updates`.
   - Failures use manual SQL retry backoff: `available_at = now() + make_interval(secs => least(300, power(2, attempts)::int))`.
2. **WebSocket Pub/Sub Broadcast (`QueueGateway`):**
   - An `ioredis` subscriber listens on `queue:updates` and fans out Socket.IO events to rooms (`center:${id}`, `farmer:${id}`).
3. **Rate Limiting (`AccessGuard`):**
   - Sliding window limiter using a Redis Lua script (`INCR` with `EXPIRE 60s`). (Keep in Redis).
4. **Translation Cache (`TranslationController`):**
   - Caches translated text pairs in Redis with a 24-hour TTL. (Keep in Redis).
5. **System Health (`HealthController`):**
   - Redis ping check. (Keep in Redis).

### 4.2 What BullMQ Must Own (Phase 2)
The raw Node `setInterval` in `src/main.ts` is fragile: it cannot scale across multiple API instances, lacks dead-letter handling, and lacks execution telemetry. BullMQ must replace it:
- **`outbox-queue`:** Worker polling `event_outbox` or triggered immediately upon transaction commit. Delivers events to Redis pub/sub with managed retries, exponential backoff, and DLQ.
- **`notification-queue`:** Asynchronous SMS, WhatsApp, and voice alert delivery.
- **`payment-sync-queue`:** Scheduled cron / polling worker simulating PFMS/DBT payment status reconciliation.
- **`metrics / telemetry`:** BullMQ repeatable jobs to aggregate center demand and pre-warm macro analytics caches.

---

## 5. OpenAPI / Swagger Status & Remediation

- **Current State:** `@nestjs/swagger` is installed and instantiated in `apps/api/src/main.ts` via `SwaggerModule.setup('api/docs', app, ...)`.
- **The Issue:** The codebase lacks OpenAPI decorators across controllers and DTOs. It exposes empty endpoint trees without schema models, path parameters, request bodies, or response codes.
- **Remediation Plan (Phase 1/2):**
  1. Add `@ApiTags(...)` to every NestJS controller.
  2. Decorate methods with `@ApiOperation({ summary, description })` and `@ApiResponse({ status, type })`.
  3. Define formal TypeScript DTO classes with `@ApiProperty()` for inputs and outputs (replacing `Record<string, any>`).
  4. Verify the Swagger UI is served cleanly at `/api/docs`.

---

## 6. Three-Workstream Task Breakdown

The 3-person team will execute across the agreed 5 phases without modifying the phase structure.

```
PHASE 1: Verify Parity & Re-baseline
PHASE 2: Close Backend Gaps & Introduce BullMQ
PHASE 3: Frontend Hardening & Contract Alignment
PHASE 4: Test Coverage, Concurrency & Load Verification
PHASE 5: Cutover & Legacy Archive
```

### Workstream 1: Backend Engineer
**Branch:** `team/backend`

- **Phase 1: Immediate Parity Fixes**
  - Fix `LocationsController` (`states`, `districts`, `classifications`) to return flat `string[]` arrays instead of object rows.
  - Fix `AdminController.farmers` to join `tokens`, `centers`, and `slots`, restoring `token_number`, `center_name`, and slot timing.
  - Fix `AdminController.predictDemand` response schema (`predicted_tomorrow`, `history`) and restore the synthetic 14-day APMC arrival fallback.
  - Implement dedicated `ProcurementController` under `apps/api/src/modules/procurement` (`GET /procurement/{bookingId}`, `GET /procurement/my`).
  - Implement dedicated `PaymentController` under `apps/api/src/modules/payments` (`GET /payments/{lotId}`, `GET /payments/my`).
- **Phase 2: BullMQ & Async Processing**
  - Install `bullmq` and `@nestjs/bullmq` in `apps/api`.
  - Eliminate `setInterval` from `src/main.ts`.
  - Implement BullMQ outbox worker with retry backoff and dead-letter queue.
  - Implement background DBT payment status polling worker.
- **Phase 3: Macro Analytics & Swagger Completion**
  - Expand `AdminController.analytics` to return the complete macro analytics payload (`hourly_throughput`, `district_cpi`, `crop_breakdown`, `ml_feature_weights`, `rebalancing_recommendations`).
  - Add comprehensive `@nestjs/swagger` annotations across all 10 module controllers and DTOs.
- **Phase 4 & 5: Load Support & Cutover Support**
  - Support QA with database index tuning and locking validations.
  - Assist Release Manager in validating clean migrations on target database.

---

### Workstream 2: Frontend Engineer — [100% COMPLETE ACROSS ALL 4 PROMPTS]
**Branch:** `team/frontend`

- **Prompt 1/4: Live Queue Realtime Path [COMPLETED]**
  - Room-scoped Socket.IO integration (`center:${centerId}`) listening on `queue:updated`, `token:called`, and `status:changed`.
  - Rolling average wait-time recalculations based on Little's Law telemetry (`avg_processing_min`).
  - Offline-first cache in `localStorage` with explicit staleness notices (`Offline • Last updated HH:MM`).
  - Integrated voice readout (`Web Speech API`) and one-time 15-minute slot extension (`running-late`).
- **Prompt 2/4: Screen Audit & Mock Elimination [COMPLETED]**
  - Audited all 13 screens; eliminated hardcoded mock arrays and placeholder fallback objects.
  - Full data-binding through unified `api.ts` Axios client with CSRF token injection and cookie credentials.
  - Staged status transitions in `ProcurementStatus` and `PaymentStatus` matching live database enum progression.
- **Prompt 3/4: Admin & Center Dashboards Deep Dive [COMPLETED]**
  - `AdminDashboard`: Bound to real `/admin/analytics` contracts (Bookings vs Capacity, Wait Time Trends, Completion Rates), linear demand prediction, and smart slot generator. Honest zero-state fallbacks without synthetic numbers.
  - `CenterDashboard`: One-tap staff procurement progression actions (`Gate Entry` -> `Weighing` -> `QC Check` -> `Lot Accepted` -> `Pay Farmer` / `Reject`) with optimistic UI cache updates, blocking reason tooltips, and offline queue synchronization.
- **Prompt 4/4: Translation Coverage & WCAG 2.1 AA Accessibility Sweep [COMPLETED]**
  - **i18n & Translation Sweep:** Verified runtime translation provider across 23 scheduled languages + English; verified `kok` -> `gom` Konkani Google Cloud Translation mapping exception.
  - **Silent English Fallback:** Preserved non-breaking fallback to English when Google Translate API key is absent or returns 500/network error.
  - **Batching & Telemetry Protection:** Verified request batching (50 chunk size, debounced 300ms, cached in `localStorage`) ensures call count stays completely flat across simulated rapid socket re-renders.
  - **WCAG 2.1 AA Accessibility Pass:**
    - Full keyboard navigation across all interactive controls (`Booking`, `QueueStatus`, `CenterDashboard`, `AdminDashboard`, `LanguageSelector`).
    - Explicit `htmlFor` <-> `id` label associations across all forms (`Register`, `Login`, `Booking`).
    - Visible focus rings (`focus-visible:ring-2`) on buttons, tabs, links, and custom cards (`role="button"`, `tabIndex={0}`).
    - Dual status cues: status pills carry both text and icon cues (e.g. `CheckCircle`, `Clock`, `XCircle`), never relying solely on color.
- **Verification Sign-Off:**
  - `pnpm --filter @annsetu/web test`: **42/42 tests passing** across 4 test suites (`queue-realtime`, `screens-data-binding`, `admin-center-dashboards`, `i18n-accessibility`).
  - `pnpm typecheck`: **0 errors** across `@annsetu/api` and `@annsetu/web`.
  - `pnpm build:migration`: **0 errors** (Next.js production build succeeded in 1.7s).
  - Status: **Ready for sequential Release Manager merge into `main`**.

---

### Workstream 3: Platform + QA Engineer
**Branch:** `team/platform-qa`

- **Phase 1: CI Enforcement & Node Standardization**
  - Configure root CI / pre-commit scripts to run `pnpm typecheck` and `pnpm build:migration` on all branches.
  - Standardize Node environment enforcement (`node 24.20.0`) across dev environments.
  - Bootstrap integration test framework in `apps/api/test/` (Vitest/Jest/Node test runner).
- **Phase 2: Automated Integration & Concurrency Tests**
  - Implement integration tests for core flows: Auth, Slot Booking, Operator Queue, Status Transitions.
  - Write high-concurrency race condition tests:
    - Overbooking prevention (concurrent requests booking the final slot).
    - Double-claiming prevention in operator `call-next` (`SKIP LOCKED` verification).
- **Phase 3: Realtime & Queue Load Verification**
  - Load-test Socket.IO queue broadcast scalability under Redis pub/sub.
  - Test BullMQ failure injection: Verify outbox worker retries, backoff, and DLQ behavior when Redis or PostgreSQL is temporarily unavailable.
- **Phase 4 & 5: Target Infrastructure & Cutover Orchestration**
  - Deliver clean, production Docker Compose configuration (`docker-compose.yml`) running NestJS API, Next.js Web, PostgreSQL 16, and Redis 7.2.
  - Ensure zero references to legacy services in the target compose stack.
  - Create pre-flight cutover automated verification scripts.

---

## 7. Branching Model & Merge Protocol

To prevent merge chaos during parallel execution, the team strictly adheres to this git branching protocol:

```
                  [main] (Default Branch - Protected)
                    │
                    ├── Baseline Commit (TEAM-COORDINATION.md)
                    │
     ┌──────────────┴──────────────┐
     ▼                             ▼                             ▼
[team/backend]              [team/frontend]             [team/platform-qa]
(Backend workstream)       (Frontend workstream)       (Platform & QA workstream)
     │                             │                             │
     ▼ (Individual PRs/Commits)    ▼ (Individual PRs/Commits)    ▼ (Individual PRs/Commits)
     │                             │                             │
     └─────────────────────────────┼─────────────────────────────┘
                                   │
                      (All 3 report completion)
                                   │
                         [Release Manager Merge]
                   Order: backend -> frontend -> platform-qa
                                   │
                                   ▼
                      [main] (Integrated Target Stack)
                                   │
                           [Final Cutover]
                   (Archive legacy & switch root Compose)
```

### Protocol Rules:
1. **Branch Creation:** The three long-lived branches (`team/backend`, `team/frontend`, `team/platform-qa`) are created directly from the current baseline commit containing this document.
2. **Exclusivity:** Each engineer commits **exclusively** to their designated branch.
3. **No Direct Pushing to `main`:** `main` is strictly locked. No feature code is merged into `main` during parallel development.
4. **Designated Release Manager Merge:** Once all three workstreams report their definition of done complete, a designated Release Manager executes a dedicated merge pass onto `main` in strict sequential order:
   - **Step 1:** Merge `team/backend` into `main` (establishes API, schema, and queue foundation).
   - **Step 2:** Merge `team/frontend` into `main` (aligns UI against active backend contracts).
   - **Step 3:** Merge `team/platform-qa` into `main` (adds comprehensive test suites, CI checks, and container configs).
5. **Final Cutover Prompt:** The retirement of legacy services (`spring-boot`, `farmer-portal`, `realtime-service`) occurs on `main` **only after** all three branches have merged and verified.

---

## 8. Explicit "DO NOT TOUCH" Directives

### 8.1 `SIH-KisanConnect-Enhanced/`
> [!CAUTION]
> **STRICTLY OFF-LIMITS:** `SIH-KisanConnect-Enhanced/` is an unrelated older hackathon prototype co-located in this repository.  
> - **Do not read, modify, refactor, or delete this folder.**  
> - It contains obsolete dependencies, incompatible schema patterns, and unverified mock logic.  
> - It must be explicitly excluded from all build scripts, linting passes, CI jobs, and test runners.

### 8.2 Legacy Implementation Preservation
> [!IMPORTANT]
> The legacy service directories:
> - `AnnSetu/spring-boot/`
> - `AnnSetu/farmer-portal/`
> - `AnnSetu/realtime-service/`  
> 
> **Must NOT be edited or deleted during workstream execution.** They serve as the authoritative behavioral and mathematical reference for business logic (e.g., arrival probability distributions, grace calculations). Their formal retirement occurs strictly during the final cutover phase on `main`.

---

## 9. Definition of Done for the Complete Migration

The migration will be certified complete when all items below pass verification:

- [ ] **Route Parity:** All 44 legacy endpoints possess fully implemented, active NestJS controller handlers with zero 404/500 placeholder responses.
- [ ] **Contract Integrity:** Data shapes returned by `/locations/*`, `/admin/*`, `/procurement/*`, and `/payments/*` strictly fulfill frontend UI contracts.
- [ ] **Queue & Outbox:** 100% of outbox events are dispatched and retried through BullMQ with active DLQ handling. The raw `setInterval` loop in `main.ts` is eliminated.
- [ ] **OpenAPI / Swagger:** Swagger UI is fully operational at `/api/docs` with complete `@ApiTags`, `@ApiOperation`, and schema DTOs for all endpoints.
- [ ] **Automated Concurrency & Load:**
  - Automated concurrency tests prove zero slot overbooking under concurrent client requests.
  - Operator `call-next` proves zero double-token allocation under race conditions.
  - Socket.IO gateway handles simulated multi-client queue status subscriptions.
- [ ] **Clean Compilation:** `pnpm typecheck` and `pnpm build:migration` pass with 0 errors and 0 warnings across `apps/api` and `apps/web`.
- [ ] **Branch Merge:** `team/backend`, `team/frontend`, and `team/platform-qa` are merged into `main` in the prescribed order without regression.
- [ ] **Final Cutover:** Root `docker-compose.yml` launches only the target stack (PostgreSQL, Redis, NestJS, Next.js); legacy services are cleanly archived.
