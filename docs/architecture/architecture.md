# AnnSetu Migrated Architecture

## Runtime Shape

AnnSetu now has a migration target inside the existing repository:

- `apps/api`: NestJS on Express, PostgreSQL through Prisma, Redis for rate limiting and queue fan-out, and Socket.io for live queue updates.
- `apps/web`: Next.js App Router hosting the preserved farmer, center-operator, and admin React flows as client screens.
- `packages/contracts`: shared event contracts for queue/outbox messages.

The legacy `spring-boot`, `farmer-portal`, `realtime-service`, and `agmarknet` folders remain in place. The migration work is additive and does not delete legacy data or change the default legacy startup path.

## API Boundaries

The Nest API keeps the legacy `/api/v1` REST contract used by the existing frontend:

- Auth and profile: `/auth/register`, `/auth/login`, `/auth/profile`, `/farmers/lookup`, `/farmers/:id`.
- Locations and center discovery: `/locations/*`, `/centers`.
- Booking and queue: `/centers/:id/slots`, `/tokens/book`, `/tokens/:id`, `/tokens/lookup`, `/bookings/my`.
- Center operations: `/centers/:id/queue`, `/centers/:id/call-next`, `/tokens/:id/status`, `/tokens/:id/payment`, announcements, and message logs.
- Admin: overview, centers, farmers, demand prediction, slot generation, analytics, and mandi rebalance.
- Channel fallback: `/ussd`, `/ivr/call`, and `/ivr/alerts`.
- Translation: `/translate` proxies Google Cloud Translation, caches repeated phrases in Redis, and keeps the browser API-key free.

Security is cookie-based. Access tokens are short-lived HTTP-only cookies, refresh sessions are stored in PostgreSQL, refresh tokens rotate, and mutating requests require the readable `annsetu_csrf` cookie to match the `X-CSRF-Token` header. Roles are `FARMER`, `CENTER_OPERATOR`, and `ADMIN`.

## Data And Consistency

The first four SQL migrations are preserved as copied legacy migrations. `0003_compat_v4_seed_centers` makes the existing V4 seed replayable by inserting the center ids referenced by the legacy farmer seed. `0005_nest_foundation` adds auth/session/outbox/audit structures without replacing legacy tables.

Booking locks the selected `slots` row before checking and incrementing `booked_count`. Token numbers use a database sequence and center/date prefix. Operator `call-next` uses `FOR UPDATE SKIP LOCKED` so concurrent callers do not claim the same token. Token status updates validate the expected status progression, with `rejected` as an explicit terminal branch.

Queue events are written to `event_outbox` in the same transaction as booking/status/payment mutations. A dispatcher publishes pending events to Redis, and the Socket.io gateway broadcasts them to center and farmer rooms.

## Frontend Shape

The Next app keeps the original UI flows and styling from `farmer-portal`, but moves route screens under `src/screens` so Next does not prerender them as Pages Router routes. The App Router owns `/` and `/*`, then the existing React Router tree handles farmer, center, and admin navigation on the client.

The API client now uses `NEXT_PUBLIC_API_URL` or `/api/v1`, sends credentials, and attaches CSRF headers for mutating calls. The service worker only caches non-API GET requests.

The farmer portal uses a runtime translation provider instead of hardcoded text maps. Farmers choose from English plus India's scheduled languages, the provider batches visible static text to the API, and translated phrases are cached in browser storage. The UI can keep farmer-facing language codes while sending Google-specific codes where they differ, such as Konkani via `gom`. If Google Translate is unavailable or `GOOGLE_TRANSLATE_API_KEY` is missing, the portal keeps the original English copy visible.
