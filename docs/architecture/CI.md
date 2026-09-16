# AnnSetu CI Pipeline Documentation

## Overview

The AnnSetu CI pipeline (`.github/workflows/ci.yml`) enforces strict automated regression gates across the NestJS/Next.js migration codebase (`apps/api`, `apps/web`, and `packages/contracts`).

Every Pull Request and push to development or integration branches (`main`, `team/**`) triggers four distinct, un-collapsed verification gates. **Zero soft-fails (`continue-on-error`) are allowed**; any red check blocks merge.

---

## The 4 Gate Steps

| Gate Name in PR Checks | Target Workspaces | Environment / Services | Command Executed |
| :--- | :--- | :--- | :--- |
| **`Typecheck (@annsetu/api & @annsetu/web)`** | `@annsetu/api`<br/>`@annsetu/web` | Node 24.20.0, pnpm 9.15.9 | `pnpm db:generate`<br/>`pnpm typecheck` |
| **`Unit & Integration Tests`** | `@annsetu/api`<br/>`@annsetu/web` | Node 24, Postgres 16.4, Redis 7.2.4 | `pnpm db:migrate`<br/>`pnpm --filter @annsetu/api test`<br/>`pnpm --filter @annsetu/web test` |
| **`Concurrency & Load Tests`** | `@annsetu/api` | Node 24, Postgres 16.4, Redis 7.2.4 | `pnpm --filter @annsetu/api build`<br/>`pnpm test:load` |
| **`Production Build`** | `@annsetu/api`<br/>`@annsetu/web` | Node 24.20.0, pnpm 9.15.9 | `pnpm db:generate`<br/>`pnpm build:migration` |

---

## Service Containers & Infrastructure

The test gates (`unit-integration-tests` and `concurrency-load-tests`) automatically spin up clean-room service containers on the GitHub Actions runner:

- **PostgreSQL 16.4 Alpine** (`postgres:16.4-alpine`):
  - Port: `5432`
  - Health check: `pg_isready`
  - Database: `annsetu`
- **Redis 7.2.4 Alpine** (`redis:7.2.4-alpine`):
  - Port: `6379`
  - Health check: `redis-cli ping`
- **Node.js**: Pinned to LTS `24.20.0` with `pnpm 9.15.9` (matching repo engines and lockfile).

---

## Path Scoping & Isolation

The workflow triggers **only** when files inside the migration target are touched:

- `AnnSetu/apps/api/**`
- `AnnSetu/apps/web/**`
- `AnnSetu/packages/contracts/**`
- `AnnSetu/package.json`
- `AnnSetu/pnpm-workspace.yaml`
- `AnnSetu/pnpm-lock.yaml`
- `.github/workflows/ci.yml`

Changes to legacy code paths (`AnnSetu/spring-boot/**`, `AnnSetu/farmer-portal/**`, `AnnSetu/realtime-service/**`) or the un-migrated reference folder (`SIH-KisanConnect-Enhanced/**`) **never trigger** this pipeline.

---

## Local Pre-Push Verification Checklist

Run these commands locally in `AnnSetu/` before submitting a PR:

### 1. Typecheck Both Applications
```bash
pnpm typecheck
```
*Expected: 0 errors emitted by `tsc --noEmit` across API and Web.*

### 2. Unit & Integration Tests
Ensure PostgreSQL and Redis are running locally (e.g. via local docker containers or system daemons):
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/annsetu" \
REDIS_URL="redis://localhost:6379" \
pnpm test:unit
```
*Expected: All unit and integration test assertions pass (0 failures).*

### 3. Concurrency & Load Tests
Verify slot overbooking atomicity, `SKIP LOCKED` operator queue safety, and state transition integrity:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/annsetu" \
REDIS_URL="redis://localhost:6379" \
pnpm test:load
```
*Expected: 13/13 scenarios pass with 100% success rate.*

### 4. Production Build
```bash
pnpm build:migration
```
*Expected: API compiles to `dist/`, Next.js creates optimized production build (`.next`).*
