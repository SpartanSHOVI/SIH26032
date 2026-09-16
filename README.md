# AnnSetu (अन्न सेतु) — Smart Farmer Procurement & Queue Platform

[![CI Pipeline](https://github.com/SpartanSHOVI/SIH_2026/actions/workflows/ci.yml/badge.svg)](https://github.com/SpartanSHOVI/SIH_2026/actions/workflows/ci.yml)
[![Node.js 24 LTS](https://img.shields.io/badge/Node.js-24.20.0%20LTS-green.svg)](https://nodejs.org/)
[![NestJS 12](https://img.shields.io/badge/NestJS-12.0.1-red.svg)](https://nestjs.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.4%20(Turbopack)-black.svg)](https://nextjs.org/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16.4-blue.svg)](https://www.postgresql.org/)
[![Redis 7.2](https://img.shields.io/badge/Redis-7.2.4-red.svg)](https://redis.io/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**AnnSetu** (अन्न सेतु — *"grain bridge"*) is a unified digital platform for Minimum Support Price (MSP) agricultural procurement across Indian Agricultural Produce Market Committee (APMC) mandis. It bridges the gap between state procurement portals, mandi physical operations, and farmers by providing **real-time queue visibility**, **atomic slot booking**, **multi-channel notifications (App, Web, USSD, IVR)**, and **end-to-end procurement-to-payment (PFMS/DBT) tracking** through a single AgriStack Farmer ID.

---

## Current Architecture

AnnSetu is organized as a high-performance **pnpm monorepo** featuring a NestJS 12 backend, a Next.js 16 Turbopack frontend, shared schema contracts, and asynchronous BullMQ workers backed by PostgreSQL 16 and Redis 7.2.

```text
AnnSetu/
├── apps/
│   ├── api/                                  # NestJS 12 + Express REST API & WebSocket Gateway
│   │   ├── prisma/                           # PostgreSQL schema, migrations & seed scripts
│   │   │   ├── schema.prisma                 # 22+ domain tables, indexes & pg_trgm extensions
│   │   │   └── migrations/                   # Full migration history (Prisma 7 engine)
│   │   ├── src/
│   │   │   ├── common/                       # Guards (AccessGuard, Roles), Filters (Errors), Pipes (XSS Sanitizer)
│   │   │   ├── config/                       # Zod-validated environment schema (env.ts)
│   │   │   ├── infrastructure/
│   │   │   │   ├── database/                 # Prisma PostgreSQL connection pooling, SQL injection guards
│   │   │   │   ├── redis/                    # Redis 7.2 pub/sub, tiered rate limiting & atomic Lua scripts
│   │   │   │   ├── audit/                    # Immutable audit logging (audit_events)
│   │   │   │   ├── events/                   # Outbox event publisher & local event bus
│   │   │   │   └── jobs/                     # BullMQ outbox worker, exponential backoff & DLQ
│   │   │   ├── modules/
│   │   │   │   ├── auth/                     # Argon2id hashing, rotating refresh tokens, session expiry
│   │   │   │   ├── booking/                  # Atomic slot booking, row-level locks, sequence generation
│   │   │   │   ├── queue/                    # Real-time queue lookup, rolling wait recalculations
│   │   │   │   ├── center/                   # Mandi operator queue, call-next (SKIP LOCKED), gate entry
│   │   │   │   ├── admin/                    # OLS demand forecasting, KPI telemetry, mandi rebalancing
│   │   │   │   ├── procurement/              # 8-stage state machine: weighing, moisture QC, lot acceptance
│   │   │   │   ├── payments/                 # PFMS DBT tracking, deterministic UTR generation, dynamic MSP join
│   │   │   │   ├── msp/                      # Dynamic statutory MSP floor rates, CCEA benchmarks & audit logs
│   │   │   │   ├── channel/                  # USSD, IVR, and SMS inclusion simulation endpoints
│   │   │   │   ├── translation/              # Multilingual proxy with Google Cloud Translation
│   │   │   │   ├── locations/                # APMC mandi directory, states, districts & crops
│   │   │   │   └── health/                   # Kubernetes liveness & readiness probes
│   │   │   ├── realtime/
│   │   │   │   └── queue.gateway.ts          # Socket.IO gateway (/queue) with room-scoped routing
│   │   │   └── main.ts                       # /api/v1 bootstrap, Swagger OpenAPI docs, CORS, cookies, XSS pipe
│   │   └── test/                             # Unit, integration, security & 50-client load tests
│   │
│   └── web/                                  # Next.js 16 (Turbopack) Progressive Web App
│       ├── src/
│       │   ├── app/                          # Next.js App Router root layout, catch-all & styles
│       │   ├── screens/                      # Dedicated React portals:
│       │   │   ├── PortalGateway.tsx         # Unified role portal entry point (/, /portal)
│       │   │   ├── Dashboard.tsx             # Farmer macro dashboard & upcoming bookings
│       │   │   ├── Booking.tsx               # APMC mandi selection, date/window & slot booking
│       │   │   ├── QueueStatus.tsx           # Live queue status, token card & running-late actions
│       │   │   ├── ProcurementStatus.tsx     # 8-stage procurement timeline & assay inspection
│       │   │   ├── PaymentStatus.tsx         # PFMS payment tracking, UTR codes & bank credit status
│       │   │   ├── Profile.tsx               # Farmer profile & DPDP Act 2023 consent management
│       │   │   ├── CenterDashboard.tsx       # Mandi staff: gate entry, weighing, QC & lot acceptance
│       │   │   ├── CenterLogin.tsx           # APMC staff login with session expiry banner
│       │   │   ├── AdminDashboard.tsx        # Nodal officer: macro KPIs, OLS demand, statutory MSP floor & rebalancing
│       │   │   ├── Login.tsx                 # Farmer login with session expiry banner
│       │   │   └── Register.tsx              # Farmer registration with AgriStack land record verification
│       │   ├── components/                   # StatusErrorAlert, FarmerLayout, CenterLayout, AdminLayout
│       │   ├── context/                      # AuthContext, CenterAuthContext, TranslationContext
│       │   ├── hooks/
│       │   │   └── useQueueRealtime.ts       # Zero-churn Socket.IO hook using mutable ref trampolines
│       │   └── services/
│       │       ├── api.ts                    # Axios client with auto-refresh on 401 & status code parsing
│       │       └── queueSocket.ts            # Socket.IO client factory & Little's Law wait calculations
│       └── test/                             # 43 automated screen data-binding & i18n test suites
│
├── nginx/
│   └── nginx.conf                            # Nginx load balancer, least-conn API pool & WebSocket proxy
│
├── packages/
│   └── contracts/                            # Shared Zod schemas & event types across API and web
│
├── docs/                                     # Architecture guides, verification & migration history
│   ├── migration/                            # Historical verification records & contract audits
│   └── ...
├── algorithm.md                              # Mathematical models & algorithm specifications
├── BULLMQ.md                                 # Asynchronous queue architecture & DLQ specifications
├── CI.md                                     # Continuous Integration pipeline documentation
├── MERGE-REPORT.md                           # 3-branch integration & verification sign-off report
└── pnpm-workspace.yaml                       # Monorepo configuration
```

---

## Technology Stack

| Domain | Technology | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | `24.20.0` LTS | Pinned execution runtime across all services |
| **Package Manager**| pnpm | `9.15.9` | Monorepo package management & workspace linking |
| **Backend Framework**| NestJS | `12.0.1` | Modular enterprise REST & WebSocket backend |
| **HTTP Engine** | Express | `4.x` | Underlying HTTP server with Helmet & Cookie-Parser |
| **Database** | PostgreSQL | `16.4` | Relational data store, JSONB, and `pg_trgm` extension |
| **ORM & Migrations**| Prisma | `7.10.0` | Type-safe queries, migration engine & schema generator |
| **In-Memory Store** | Redis | `7.2.4` | Real-time Pub/Sub, rate limiting & cache layer |
| **Job Queue** | BullMQ | `6.3.4` | Asynchronous outbox worker with exponential backoff & DLQ |
| **Realtime Gateway**| Socket.IO | `4.8.1` | Bidirectional room-scoped queue updates (`/queue`) |
| **Frontend Framework**| Next.js | `16.3.4` | App Router with Turbopack dev server |
| **UI Library** | React | `19.2.8` | Component rendering with concurrent features |
| **State & Data** | TanStack Query | `5.x` | Server state management, deduplication & cache |
| **Styling** | Tailwind CSS | `4.x` | Responsive UI with Gov.in visual design language |
| **Load Balancer** | Nginx | `Alpine` | Least-connection API load balancing, WebSocket proxying & edge rate limits |
| **Authentication** | Argon2id + JWT + Refresh | `0.44` / `9.0` | Memory-hard hashing, 15m access, 7d rolling refresh & session expiry |
| **Security Suite** | Helmet + CSRF + XSS + SQLi | Custom / `8.x` | CSP, Double-Submit CSRF, recursive XSS sanitization pipe & SQL injection guards |
| **Validation** | Zod | `3.25.0` | Runtime schema validation & contract enforcement |

---

## Core Algorithms & Engineering Innovations

AnnSetu implements 16 verified algorithms and mathematical formulations documented in detail in [`algorithm.md`](file:///Users/shubham/Drive%20D/Custom_Projects/SIH_2026/AnnSetu/algorithm.md):

1. **Queueing Theory Wait Estimation (Little's Law Adaptation)**:  
   $$\text{Wait} = \max\left(3, \left\lfloor \frac{Q \times \mu}{C} + 0.5 \right\rfloor\right)$$  
   Dynamically calculates waiting times based on queue depth ($Q$), rolling average lot duration ($\mu$), and active counter windows ($C$).
2. **Atomic Slot Booking (Pessimistic Locking)**:  
   `SELECT * FROM slots WHERE id = $1 FOR UPDATE` ensures strict serializability; verified under 50-client concurrent load tests for the last available slot with zero overselling.
3. **Lock-Free Multi-Operator Dispatch (`FOR UPDATE SKIP LOCKED`)**:  
   Allows multiple physical mandi counter operators to call waiting farmers simultaneously with zero lock-contention and zero double claims.
4. **Time-Series Demand Forecasting (OLS Linear Regression)**:  
   Applies Ordinary Least Squares regression over a trailing 7-day sliding window to forecast tomorrow's mandi farmer arrivals, slope trajectory, and confidence metrics.
5. **Idempotent Inter-Mandi Load Balancing**:  
   Safely shifts harvest slot quotas from overburdened mandis to adjacent underutilized centers using composite idempotency hashing.
6. **Strict Monotonic Procurement State Machine**:  
   Enforces a legally binding 8-stage forward DAG (`booked` $\to$ `arrived` $\to$ `verification` $\to$ `quality_check` $\to$ `accepted` $\to$ `procured` $\to$ `payment_processing` $\to$ `payment_completed`).
7. **Deterministic PFMS/DBT Payment Tracking**:  
   Generates standard RBI/PFMS format UTR references (`PFMS<Hash8>DBT<Date>`) with idempotent payment status sync.
8. **Distributed Tiered Rate Limiting**:  
   Evaluates single-round-trip Redis Lua scripts (`INCR` + `EXPIRE`) enforcing 15 req/min on `/auth/`, 60 req/min on mutations, and 300 req/min on queries with standard RFC `X-RateLimit-*` and `Retry-After` headers.
9. **Transactional Outbox with Exponential Backoff (BullMQ)**:  
   Ensures zero lost notifications across SMS, USSD, and IVR channels with automatic exponential retry ($D_0 \cdot 2^k$) and Dead-Letter Queues.
10. **Argon2id & Timing-Safe Verification**:  
    Protects farmer and operator accounts against GPU cracking and eliminates timing side-channel attacks via `crypto.timingSafeEqual`.
11. **Ref Trampoline Client Event-Loop**:  
    Prevents Socket.IO disconnection storms by mapping volatile React callbacks to stable mutable refs, eliminating UI token flickering.
12. **Typo-Tolerant Trigram Search (`pg_trgm`)**:  
    Jaccard similarity indexing enables phonetic matching across transliterated Indian regional language names.
13. **Least-Connection Reverse Proxy Load Balancing**:  
    Nginx load balancer distributes incoming REST and WebSocket connections across backend instances via `least_conn` with edge connection limiting (`limit_conn_zone`) and health monitoring.
14. **Standardized RFC Error Payloads & Status Badges**:  
    Global exception filter normalizes all NestJS, Prisma, and validation errors into uniform JSON payloads with explicit HTTP status codes (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`), paired with the `StatusErrorAlert` frontend component.
15. **Transparent Session Refresh & Expiry Redirection**:  
    Axios response interceptors handle 401 token expirations transparently by pausing concurrent calls and refreshing rolling tokens, or cleanly clearing stored sessions and redirecting to `/login?expired=true` or `/center/login?expired=true`.
16. **Full-Stack Defense-in-Depth Security**:  
    Multi-layered prevention combining Double-Submit CSRF cookie/header validation with origin checks, global recursive XSS input sanitization (`XssSanitizerPipe`), strict Helmet CSP policies, and parameterized SQL query safety assertions (`assertSqlSafety`).
17. **Dynamic Statutory MSP Floor & Bonus Overlay Engine**:  
    Maintains real statutory Government of India CACP/CCEA floor benchmarks with state procurement incentive bonus overlays (`msp_rates`), protected by Redis caching and an immutable audit trail (`msp_audit_logs`). Enables Nodal Officers to adjust rates with mandatory justifications and automatically propagates throughout DBT settlements, APMC weighment assay, feature-phone USSD (`*555#` Option 3), and multilingual IVR voice synthesis (`1800-180-SETU` Option 4).
18. **National Standardized Agricultural Commodity Taxonomy & Classification**:  
    Full Agmarknet/APMC master catalog integration comprising 605+ standardized commodities across 16 primary functional groups (`Cereals`, `Pulses`, `Oil Seeds`, `Fibre Crops`, `Spices`, `Vegetables`, `Fruits`, etc.). Integrated into farmer onboarding (`Register.tsx`), mandi operator gate entry (`CenterDashboard.tsx`), nodal officer MSP governance (`AdminDashboard.tsx`), and REST taxonomy endpoints (`/locations/commodities` & `/locations/commodities/groups`).

---

## Prerequisites & Environment Setup

### System Requirements
- **Node.js**: `24.20.0` (managed via `nvm` or `fnm`)
- **pnpm**: `9.15.9` (`corepack enable && corepack prepare pnpm@9.15.9 --activate`)
- **PostgreSQL**: `16.x`
- **Redis**: `7.x`

### Environment Configuration

Create a `.env` file at the repository root:

```bash
# Database & Cache
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/annsetu?schema=public"
REDIS_URL="redis://localhost:6379"

# Security & Sessions
JWT_SECRET="super-secret-at-least-32-characters-long-key"
APP_ORIGIN="http://localhost:3000"
PORT="3001"
NODE_ENV="development"
DEMO_AUTH="true"

# Multilingual Services (Optional)
GOOGLE_TRANSLATE_API_KEY=""
```

---

## Running AnnSetu

### Option A: Complete Docker Compose Stack (with Load Balancer)

Launch PostgreSQL 16, Redis 7.2, backend services, and the Nginx Load Balancer:

```bash
# Start all infrastructure and load balancer
docker compose up -d --build

# View container status
docker compose ps
```

The Nginx Load Balancer will listen on `http://localhost:80` (or `${LB_PORT:-80}`), balancing requests to backend API instances and WebSocket listeners.

---

### Option B: Local Monorepo Development (preferred)

#### 1. Start Infrastructure (PostgreSQL & Redis)
```bash
docker compose up -d postgres redis
```

#### 2. Run Database Migrations & Seed Data
```bash
pnpm db:migrate
pnpm db:generate
pnpm seed
```

#### 3. Start Development Servers
Start both the NestJS API (`:3001`) and Next.js Web App (`:3000`) concurrently:
```bash
pnpm dev
```

Or start individual services independently:
```bash
pnpm dev:api    # Starts NestJS API on http://localhost:3001
pnpm dev:web    # Starts Next.js frontend on http://localhost:3000
```

---

## Service Endpoints & Portals

| Portal / Service | URL | Description |
|---|---|---|
| **Nginx Load Balancer** | `http://localhost:80/` | Unified reverse proxy & least-conn load balancer |
| **LB Health Probe** | `http://localhost:80/lb-health` | Load balancer health and availability check |
| **Role Portal Gateway** | `http://localhost:3000/` | Entry page selecting Farmer, Center, or Admin portal |
| **Farmer Dashboard** | `http://localhost:3000/farmer/dashboard` | Farmer slot management and procurement status |
| **Live Queue Status** | `http://localhost:3000/farmer/queue` | Real-time queue tracker with live wait updates |
| **Slot Booking** | `http://localhost:3000/farmer/book` | Calendar & time-window mandi booking |
| **Center Operator Portal**| `http://localhost:3000/center` | Mandi gate entry, weighment, and quality inspection |
| **Center Operator Login** | `http://localhost:3000/center/login` | Mandi operator PIN login with session expiry banner |
| **Farmer Login** | `http://localhost:3000/login` | Farmer mobile/Aadhaar login with session expiry banner |
| **Nodal Admin Analytics** | `http://localhost:3000/admin` | Macro mandi analytics, OLS forecasts & rebalancing |
| **Statutory MSP Control** | `http://localhost:3000/admin?role=admin` | Interactive statutory MSP floor, bonus editor & audit ledger |
| **REST API Base** | `http://localhost:3001/api/v1` | Versioned REST API with RFC status code errors |
| **Commodities Master API** | `http://localhost:3001/api/v1/locations/commodities` | 605+ Agmarknet commodities with group filtering & search |
| **Commodity Groups API** | `http://localhost:3001/api/v1/locations/commodities/groups` | 16 standardized agricultural groups with variety counts |
| **Statutory MSP API** | `http://localhost:3001/api/v1/msp` | Public crop MSP lookup & Nodal Officer rate management |
| **Swagger OpenAPI Docs** | `http://localhost:3001/api/docs` | Interactive Swagger documentation |
| **Socket.IO Gateway** | `ws://localhost:3001/queue` | WebSocket namespace for real-time room events |
| **Health Check** | `http://localhost:3001/api/v1/health` | Database and Redis connectivity health probe |

---

## Automated Testing & Quality Assurance

AnnSetu enforces automated CI quality gates on all pull requests and commits via GitHub Actions (see [`CI.md`](file:///Users/shubham/Drive%20D/Custom_Projects/SIH_2026/AnnSetu/CI.md)):

```bash
# Run all frontend and backend tests
pnpm test

# Run backend test suite (unit, integration, BullMQ bursts & load tests)
pnpm --filter @annsetu/api test

# Run statutory MSP subsystem integration tests
pnpm --filter @annsetu/api exec tsx --test test/msp.test.ts

# Run commodity master taxonomy & classification tests
pnpm --filter @annsetu/api exec tsx --test test/commodities.test.ts

# Run security, error status codes & token refresh test suite
pnpm --filter @annsetu/api exec tsx --test test/security-error-refresh.test.ts

# Run frontend test suite (43 tests: data-binding, i18n, accessibility)
pnpm --filter @annsetu/web test

# Run TypeScript typechecks across the monorepo
pnpm typecheck

# Run production builds
pnpm build
```

### Verified Test Telemetry
- **Booking Concurrency**: 50 concurrent requests competing for 1 remaining slot $\to$ **Exactly 1 succeeds, 49 cleanly rejected, 0 overbooking** (p95: 100ms).
- **Call-Next Work Stealing**: 50 simultaneous operator calls $\to$ **50 distinct tokens claimed, 0 double claims** (p95: 67ms).
- **BullMQ Burst Test**: 500 queued outbox jobs with 10% intentional carrier failure $\to$ **100% processed or queued in DLQ, 0 jobs lost**.
- **Translation & Fallbacks**: 11 Indian regional languages supported with zero-downtime English fallback.

---

## External Access & Port Forwarding

To share the running application externally with judges, teammates, or mobile devices without exposing private network ports, use **Cloudflare Quick Tunnels** (zero warning screens, zero adblocker triggers):

```bash
cloudflared tunnel --url http://localhost:3000
```

The Next.js configuration ([`apps/web/next.config.mjs`](file:///Users/shubham/Drive%20D/Custom_Projects/SIH_2026/AnnSetu/apps/web/next.config.mjs)) automatically proxies `/api/v1/*` requests and WebSocket feeds through the tunnel domain.

---

## License

This project is licensed under the **Apache License 2.0** — developed for the Smart India Hackathon (SIH) 2026 initiative.
