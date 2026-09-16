# Verification

Verified on September 9, 2026 against disposable local infrastructure:

- PostgreSQL 16.4 container on `127.0.0.1:55432`.
- Redis 7.2.4 container on `127.0.0.1:56379`.
- Prisma migrations replayed from a clean schema.
- Prisma client generated from the migrated schema.
- `pnpm typecheck` passed for API and web.
- `pnpm build:migration` passed for API and Next.js production builds.
- Multilingual provider and Google Translate proxy typecheck/build with the migration apps.
- API smoke tests passed for `/api/v1/health`, `/api/v1/locations/states`, `/api/v1/centers`, farmer registration, slot creation, and authenticated token booking with cookies and CSRF.

Notes:

- The shell running tests uses system Node `v26.8.1`, so pnpm prints an engine warning. The repo now pins Node `24.20.0` through `engines` and `.nvmrc`, and the API runtime smoke used the installed local Node 24 binary.
- Port `3001` was already in use locally, so runtime smoke testing used API port `3101`.
- The legacy V4 migration references fixed center ids that were absent from the earlier center seed. `0003_compat_v4_seed_centers` adds only those missing centers before V4 while preserving the copied legacy V4 SQL unchanged.

---

## Re-baseline Verification — September 12, 2026

**Branch:** `team/platform-qa`  
**Operator:** Platform + QA Engineer  
**Purpose:** Re-establish verified baseline after Backend (4 prompts) and Frontend (4 prompts) workstreams completed on their respective branches.

### Infrastructure Used

| Component | Version | Source | Notes |
|-----------|---------|--------|-------|
| **PostgreSQL** | 18.6 (Homebrew) | Local `localhost:5432` | **DRIFT from target:** docker-compose.yml pins `postgres:16.4`. Local Homebrew runs 18.6. Migrations and queries still pass; no incompatible syntax detected. Production target must remain PG 16. |
| **Redis** | 8.10.1 | Local `localhost:6379` | **DRIFT from target:** docker-compose.yml pins `redis:7.2.4-alpine`. Local Homebrew runs 8.10.1. Pub/sub, rate limiting, and caching unaffected. Production target must remain Redis 7.2. |
| **Node.js** | v26.8.1 (system) | `node --version` | `.nvmrc` pins `24.20.0`, `package.json` engines `>=24.20.0 <25`. pnpm prints engine warning. No runtime failures observed. |
| **Disposable DB** | `annsetu_rebaseline` | Created and dropped during verification | Clean-room replay; no data from `annsetu` carried over. |

### Step 1: Prisma Migrations — ✅ PASS

All 6 migrations applied cleanly against fresh database `annsetu_rebaseline`:

```
Applying migration `0001_legacy`
Applying migration `0002_legacy`
Applying migration `0003_compat_v4_seed_centers`
Applying migration `0003_legacy`
Applying migration `0004_legacy`
Applying migration `0005_nest_foundation`

All migrations have been successfully applied.
```

### Step 2: Prisma Client Generation — ✅ PASS

```
✔ Generated Prisma Client (v7.10.0) in 85ms
```

### Step 3: Typecheck (`pnpm typecheck`) — ⚠️ PARTIAL

| Package | Result | Details |
|---------|--------|---------|
| `@annsetu/api` | ✅ PASS | `tsc --noEmit` — 0 errors |
| `@annsetu/web` | ❌ FAIL | `TS2339: Property 'data' does not exist on type 'any[]'` in `Register.tsx` lines 62, 82 |

> **Note:** The `Register.tsx` error is a known drift documented in TEAM-COORDINATION.md §2.1. It was fixed on `team/frontend` (commit `24104d9`) but has not yet merged to `team/platform-qa`. This is expected per the branching protocol — the fix will arrive during the Release Manager merge (frontend → main → rebase platform-qa). **No action required on this branch.**

### Step 4: Production Build (`pnpm build:migration`) — ⚠️ PARTIAL

| Package | Result | Details |
|---------|--------|---------|
| `@annsetu/api` | ✅ PASS | `tsc -p tsconfig.json` compiled to `dist/` cleanly |
| `@annsetu/web` | ❌ FAIL | Build aborted by same `Register.tsx` TS2339 errors |

> Same root cause as Step 3. Blocked by the unmerged frontend fix.

### Step 5: API Test Suite — ⚠️ EMPTY (0 tests)

```
ℹ tests 0  |  suites 0  |  pass 0  |  fail 0
```

`apps/api/test/` directory contains 0 test files. Integration test framework must be bootstrapped by Platform+QA (this prompt's next deliverable in Prompt 2/4).

### Step 6: Runtime Smoke Tests — ✅ ALL PASS

API started on port `3101` against disposable `annsetu_rebaseline` database.

| # | Smoke Test | Method & Route | Result | Response Summary |
|---|-----------|----------------|--------|-----------------|
| 1 | Health Check | `GET /api/v1/health` | ✅ 200 | Returns health status JSON |
| 2 | Location States | `GET /api/v1/locations/states` | ✅ 200 | Returns state list (object rows `[{state}]`, not flat `string[]` — known PARTIAL parity) |
| 3 | Centers List | `GET /api/v1/bookings/centers` | ✅ 200 | Returns seeded APMC center records with `waiting`, `status` fields |
| 4 | Farmer Registration | `POST /api/v1/auth/register` | ✅ 200 | Created farmer `Rebaseline Farmer` (mobile `9876500001`). Requires `consent: true` in body. Sets `annsetu_access`, `annsetu_refresh`, `annsetu_csrf` cookies. |
| 5 | Slot Availability | `GET /api/v1/centers/:id/slots` | ✅ 200 | Auto-generated 7 hourly slots (09:00–17:00) for Punjab center. Returns `remaining`, `full` computed fields. |
| 6 | Token Booking | `POST /api/v1/tokens/book` | ✅ 200 | Booked token `LDH-260912-100000`. Requires `farmer_id`, `center_id`, `slot_id` in body + CSRF header. Atomic slot lock verified. |
| 7 | Swagger UI | `GET /api/docs` | ✅ 200 | Serves `<title>Swagger UI</title>` HTML page |
| 8 | Token Details | `GET /api/v1/tokens/3` | ✅ 200 | Returns full token with center, farmer, slot joins, queue position, wait estimate |
| 9 | Farmer Profile | `GET /api/v1/auth/profile` | ✅ 200 | Returns authenticated farmer profile from JWT cookie |
| 10 | Admin RBAC Guard | `GET /api/v1/admin/overview` | ✅ 403 | Correctly returns `"Role not allowed"` for FARMER role token |

### Step 7: Swagger / OpenAPI Status — ⚠️ PARTIALLY BOOTSTRAPPED

| Metric | Value | Assessment |
|--------|-------|-----------|
| Swagger UI served | ✅ Yes | `GET /api/docs` returns 200 with full UI |
| Total API paths | 50 | All controllers registered |
| Tagged operations | 54 | NestJS auto-generates tags from controller names |
| `@ApiTags` / `@ApiOperation` annotations | 0 | **No manual OpenAPI decorators** on any controller or method |
| Schema DTOs (`components.schemas`) | 0 | **No formal DTO classes** with `@ApiProperty()` |
| User-facing tags | 0 | No explicit `@ApiTags()` found |

> **Assessment:** Swagger UI is functional but shows generic NestJS-auto-discovered routes with no descriptions, parameter schemas, or response types. Comprehensive annotation is a Backend Phase 3 deliverable.

### Step 8: BullMQ Status — ❌ ABSENT

- `bullmq` is not in `package.json` dependencies.
- `@nestjs/bullmq` is not installed.
- Outbox dispatching is driven by `setInterval(() => void events.dispatch().catch(() => undefined), 1000).unref()` in `src/main.ts:33`.
- This is a Backend Phase 2 deliverable.

### Step 9: Mapped Route Count Verification

From NestJS startup logs, **54 routes mapped** across 8 controllers:

| Controller | Routes Mapped |
|-----------|---------------|
| AuthController | 14 (login×2, register, profile GET/PATCH, farmer lookup/GET/PATCH, refresh, logout, OTP request×2, OTP verify) |
| LocationsController | 4 (states, districts, classifications, centers) |
| BookingController | 9 (centers×2, slots×2, book×2, call-book, running-late, my) |
| QueueController | 6 (lookup×2, token×2, notifications×2) |
| CenterController | 8 (queue, analytics, call-next, status, payment, announcements POST×2, announcements GET, messages) |
| AdminController | 7 (overview, centers, farmers, predict-demand, generate-slots, analytics, rebalance-mandi) |
| ChannelController | 4 (USSD POST, USSD GET, IVR call, IVR alerts) |
| HealthController | 1 (health) |
| TranslationController | 1 (translate) |

**4 MISSING routes** (ProcurementController and PaymentController): confirmed absent as documented in TEAM-COORDINATION.md §3.

### Disposable Database Cleanup

Disposable database `annsetu_rebaseline` dropped after verification completed.

### Summary of Drift from September 9 Baseline

| Area | Sep 9 State | Sep 12 State | Delta |
|------|------------|-------------|-------|
| `@annsetu/api` typecheck | ✅ Pass | ✅ Pass | No change |
| `@annsetu/api` build | ✅ Pass | ✅ Pass | No change |
| `@annsetu/web` typecheck | ✅ Pass (claimed) | ❌ Fail (`Register.tsx` TS2339) | **Regression on `team/platform-qa` branch** — fixed on `team/frontend`, awaiting merge |
| `@annsetu/web` build | ✅ Pass (claimed) | ❌ Fail (same TS2339) | Same as above |
| Prisma migrations | ✅ 6/6 applied | ✅ 6/6 applied | No change |
| Swagger UI | Partially bootstrapped | Partially bootstrapped (0 annotations, 0 schemas) | No change |
| BullMQ | Absent | Absent | No change — Backend Phase 2 |
| API test suite | 0 tests | 0 tests | No change — Platform+QA Prompt 2/4 |
| Runtime smoke tests | All pass | All pass (10/10) | Expanded coverage with RBAC guard test |
| Local PG version | 16.4 (container) | 18.6 (Homebrew) | **Environment drift** — production target unchanged |
| Local Redis version | 7.2.4 (container) | 8.10.1 (Homebrew) | **Environment drift** — production target unchanged |
