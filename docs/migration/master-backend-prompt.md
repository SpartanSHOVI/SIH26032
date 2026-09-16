# Master Prompt For Continuing The Backend Migration

Act as the senior engineer responsible for completing AnnSetu's backend migration from Spring Boot plus standalone realtime Node to a production-grade NestJS API on Express.

Work inside the existing repository without deleting legacy folders or changing the legacy default runtime until verified parity is complete. Treat the current SQL migrations and seeded data as production-like legacy assets. Preserve the frontend response shapes already consumed by the AnnSetu UI.

Build the backend as a modular NestJS application under `apps/api`:

- Keep `/api/v1` compatibility for auth, farmer profile, centers, slots, token booking, queue details, center operations, admin analytics, USSD, IVR, announcements, messages, procurement, and payment.
- Use PostgreSQL as the source of truth. Use Prisma for connection/runtime integration, but keep critical transactional paths explicit and inspectable.
- Use Redis for rate limiting, queue broadcasts, and short-lived operational coordination. If Redis is unavailable for required write protection, fail closed with a clear 503.
- Use an outbox table for every queue/payment/status event created by a transaction. Publish to Redis only after the DB commit path has recorded the event.
- Use cookie auth with short-lived access cookies, rotating refresh sessions in Postgres, CSRF checks on mutations, strict origin checks, and role checks for `FARMER`, `CENTER_OPERATOR`, and `ADMIN`.
- Support migration from legacy SHA-256 farmer passwords into Argon2 on first successful login. Keep demo OTP available only behind an explicit demo flag and never in production.
- Make booking atomic: lock the slot row, validate slot-center ownership, check capacity, create the token, increment booked count, create notifications, and enqueue the event in one transaction.
- Make `call-next` atomic: select eligible tokens with `FOR UPDATE SKIP LOCKED`, claim one token, update status, and emit an outbox event.
- Validate token state transitions using the domain flow: `booked -> arrived -> verification -> quality_check -> accepted -> procured -> payment_processing -> payment_completed`, plus explicit `rejected`.
- Keep all BIGINT/Decimal/Date JSON output safe for the web client.

Frontend constraints:

- Keep the Next.js App Router app under `apps/web`.
- Preserve the current AnnSetu screens, visual language, and route names.
- Use cookies/CSRF through the API client.
- Do not cache `/api/*` requests in the PWA service worker.

Verification requirements:

- Apply migrations against an isolated PostgreSQL 16 database.
- Generate Prisma from the migrated schema.
- Run `pnpm typecheck`.
- Run `pnpm build:migration`.
- Smoke-test at least health, centers, registration, slot creation, and token booking against a disposable database.
- Document known parity gaps before claiming completion.
