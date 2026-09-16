# AnnSetu pitch feature validation

Source audited: `AnnSetu.zip` supplied on 15 September 2026. Legacy code under `zArchive/legacy-implementation` is excluded from current-system claims.

## Code-backed and safe to demonstrate

| Feature | Status | Evidence in current codebase |
|---|---|---|
| Farmer registration, login and profile | Implemented | `apps/api/src/modules/auth`, `apps/web/src/screens/Login.tsx`, `Register.tsx`, `Profile.tsx` |
| Role separation for farmer, center operator and admin | Implemented | `apps/api/src/common/guards`, `apps/web/src/screens/PortalGateway.tsx` |
| Capacity-aware atomic slot booking | Implemented and concurrency-tested | `apps/api/src/modules/booking`, `apps/api/test/concurrency.load.ts` |
| Token generation and farmer booking history | Implemented | Booking API and farmer dashboard screens |
| Live queue position and wait estimate | Implemented | `queue.service.ts`, Socket.IO gateway and `useQueueRealtime.ts` |
| Multi-operator call-next without duplicate claims | Implemented and concurrency-tested | `FOR UPDATE SKIP LOCKED` flow and 50-caller load scenario |
| Mandi gate entry, weighing, quality check and lot decision | Implemented | Center dashboard, procurement module and state-machine tests |
| Procurement-to-payment status | Implemented using a deterministic PFMS mock | Payments module and `payment-pfms-adapter.test.ts` |
| Farmer, center and nodal-admin portals | Implemented | Next.js screens under `apps/web/src/screens` |
| Demand prediction | Implemented | Seven-day OLS logic in `admin.service.ts` with tests |
| Mandi capacity rebalance | Implemented | Admin rebalance service, endpoint and test |
| Dynamic MSP administration and audit history | Implemented | MSP module, admin screen and tests |
| Commodity directory | Implemented | Commodity data, location endpoints and tests |
| Redis rate limiting | Implemented | Redis Lua counter in `access.guard.ts` |
| Transactional outbox, BullMQ retry and DLQ | Implemented | Events/jobs infrastructure and BullMQ integration tests |
| DPDP consent withdrawal and erasure request | Implemented | Auth endpoints, audit records and Profile privacy controls |
| PII masking, CSRF, XSS filtering, JWT rotation and Argon2 | Implemented | Common security layer, auth service and security tests |
| Offline PWA application shell | Implemented | `manifest.webmanifest` and custom `sw.js` cache |
| USSD and IVR user journeys | Implemented as local simulations | Channel controller, USSD/IVR services and USSD simulator screen |
| Multilingual translation and TTS | Implemented with fallbacks | Translation controller, browser TTS and optional provider configuration |

## Mocked for the SIH demo

| Feature | Correct pitch wording |
|---|---|
| AgriStack | AgriStack-compatible adapter with seeded Farmer ID records |
| Aadhaar verification | Hashed/masked Aadhaar demo lookup, not live UIDAI e-KYC |
| PFMS/DBT | Deterministic PFMS-compatible payment state simulator |
| SMS notifications | Simulated notification dispatch with production gateway interface planned |
| Bhashini and Google translation | Provider-ready adapters with browser/local fallback |
| State procurement portals | Adapter boundary; state-specific live connectors are not implemented |

## Partial or qualified claims

| Claim | Validation |
|---|---|
| PWA works offline | The shell/static assets are cached. API mutations do not work offline and no durable offline booking queue exists. |
| Row-level security | A legacy migration enables policies, but the next migration disables RLS. Do not claim active PostgreSQL RLS. |
| Push notifications | No FCM or browser PushManager implementation is present. Describe in-app and simulated SMS alerts only. |
| Exact package versions | Core versions are pinned, but several frontend dependencies use ranges. Cite the lockfile or use major versions. |
| Node.js 24.20 runtime | This is the target declared by the repository. Verify the presentation laptop actually runs Node 24.20. |

## Do not present as completed

- Nginx load balancing. It exists only in the legacy Docker profile.
- Spring Boot or the separate legacy realtime service.
- CAPTCHA protection.
- Kubernetes autoscaling or a deployed NIC MeghRaj environment.
- Production TLS 1.3 or AES-256 encryption at rest.
- Real UIDAI, AgriStack, PFMS, state-portal, SMS or Bhashini credentials.
- Maps/GPS center discovery.
- Firebase push notifications.
- A 5,000 requests-per-second benchmark.
- Measured reductions such as 8–12 hours to 45 minutes. These may be stated only as proposed pilot targets.

## Verified engineering evidence suitable for the pitch

- Thirteen of thirteen recorded load scenarios passed.
- One remaining slot accepted exactly one request under 50 concurrent booking attempts.
- Fifty simultaneous call-next operations produced fifty distinct claims with no duplicate claim.
- The repository includes dedicated tests for authorization, security, queue realtime behavior, procurement state transitions, weighing/QC persistence, PFMS adapter behavior, BullMQ dispatch, MSP, commodities, admin analytics and accessibility/i18n.

## Documentation corrections required

The current `README.md` and old `SLIDES_CONTENT.md` still contain retired architecture claims. Replace Express 4 with Express 5.2 and remove Nginx, Spring Boot, Vite, Node.js 22, Bucket4j, Workbox, Kafka-style claims, live government integration wording and the 5,000 requests/second benchmark before reusing that text in the new presentation.
