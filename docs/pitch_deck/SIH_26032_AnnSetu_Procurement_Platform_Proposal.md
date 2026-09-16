# AnnSetu — Smart Farmer Procurement & Queue Platform

**Problem Statement ID:** 26032
**Organization:** Ministry of Consumer Affairs, Food & Public Distribution
**Department:** Department of Consumer Affairs (DoCA)
**Theme:** Smart Automation

*"AnnSetu" (अन्न सेतु) means "grain bridge" — the platform that bridges a farmer's field to their payment, with no confusion in between.*

---

## 0. How to read this document (plain-language glossary)

A few technical words appear a lot below. Here is what they mean in simple terms, so nothing needs a second search:

| Term | Simple meaning |
|---|---|
| API | A defined way for two computer systems to talk to each other, like a waiter carrying orders between a customer and a kitchen. |
| Backend | The part of the software that runs on a server, handling data and logic — the customer never sees it directly. |
| Microservice | A small, independent piece of the backend that does one job well (e.g. "send SMS") and can be updated without touching the rest. |
| Database | Organised storage for data, built to be searched and updated reliably. |
| Cache | A fast, temporary storage layer that avoids repeating slow work (e.g. remembering "queue length at Center A" for a few seconds instead of recalculating it on every request). |
| Message queue | A system that holds tasks (like "send this SMS") in line so they get done even if the sender is momentarily overloaded — nothing gets lost. |
| WebSocket | A live, always-open connection between the app and the server, used so a farmer's screen updates instantly without refreshing. |
| USSD | The menu system used for `*99#`-style banking on basic phones — no internet or smartphone needed. |
| IVR | An automated phone call that plays a recorded message or takes voice/keypad input. |
| RAG (Retrieval-Augmented Generation) | An AI setup where the system first *looks up* the exact relevant text from official documents, then only *rephrases* that text simply — it cannot invent facts, because it is not allowed to answer without a matching official source. |
| LLM | A Large Language Model — the AI model behind chatbots. Good at language, unreliable at exact arithmetic, so it is kept out of anything requiring precise counting or money calculations in this design. |
| DPI | Digital Public Infrastructure — shared, reusable government digital systems (Aadhaar, UPI, Agristack) that other applications plug into instead of rebuilding. |
| DPDP Act 2023 | India's Digital Personal Data Protection law, governing how citizen data must be collected, stored, and deleted. |

---

## 1. Research — what already exists

Before proposing anything, here is a survey of live government systems that already do part of this job, so the proposal builds on them instead of duplicating them.

| System | Who runs it | What it already does |
|---|---|---|
| **e-NAM** (National Agricultural Market) | SFAC, Ministry of Agriculture | Lets farmers view mandi-wise arrivals and price ranges on a mobile app. Trading itself (bidding, price discovery among registered traders). |
| **FCI Depot Online System** | Food Corporation of India | Farmer self-registration for depots, used as the entry point to central-pool procurement. |
| **State procurement portals** — e.g. West Bengal's e-Paddy, Himachal Pradesh's HPAPPP, Punjab's e-PMB / PMS, Haryana's Meri Fasal Mera Byora (MFMB) | Respective state civil supply / mandi boards | Farmer self-registration, self-scheduling of a procurement slot, e-token issue for transporting produce to the mandi. |
| **AgriStack Farmer Registry** | Ministry of Agriculture & Farmers Welfare (Digital Agriculture Mission) | A single national Farmer ID linked to Aadhaar and digitised land records. As of August 2026 it covers **over 10.3 crore farmers** and is already being wired into PM-KISAN, Kisan Credit Card, and **MSP-based procurement systems**. |

**Key takeaway:** the identity layer (Farmer ID under AgriStack) and the basic "register + book a slot" flow already exist in several states. The gap is not "does a portal exist" — it is what happens *after* the token is issued, and what happens to a farmer who is not comfortable with apps.

### What is actually going wrong (reported directly by farmers, in the field)

- **Wrong center or date on the token.** In Punjab's e-token rollout, commission agents reported tokens issued for the wrong date, and centralised issuing from a single head office caused delays and mismatched purchase-centre allocations.
- **Waiting continues even after a token is issued.** In Madhya Pradesh's e-token system for input distribution, farmers with a valid token still waited hours because of network failures and OTP delays — the token existed, but there was no live visibility into actual queue movement.
- **No fallback for feature phones or poor connectivity.** Farmers described themselves as "mobile-technology challenged," and cyber-café-assisted bookings sometimes selected the wrong center entirely, splitting one farmer's produce across two locations.
- **The national app itself hands off to desktop for the important part.** e-NAM's own mobile app explicitly does not support gate entry, weighment, quality assaying, or payment — those steps require a desktop, which breaks the "track everything from your phone" promise.
- **Fragmentation.** Every state runs its own separate portal (WB, Punjab, Haryana, HP all have different systems) with no shared queue-visibility or notification standard across them.
- **Payment delay is a recurring complaint** across mandi reporting — farmers not knowing *when* money will actually land is treated as almost as stressful as the wait itself.

This is the evidence base for the feature choices below.

---

## 2. Design principle: build on what exists, don't replace it

Two things already work at national scale and should be reused, not rebuilt:

1. **AgriStack Farmer ID** — for identity and land-record verification. A farmer already holding a Farmer ID should never have to re-register from scratch.
2. **PFMS / DBT** — for the actual money movement. This platform should *read* payment status from PFMS, not become a payment system itself.

AnnSetu is therefore positioned as a **queue-and-communication layer that sits on top of existing state procurement portals** through simple API adapters — states keep their back-end procurement/billing systems; AnnSetu adds the farmer-facing experience and the missing real-time layer.

---

## 3. Proposed feature set

### 3.1 Essential features (the platform does not work without these)

| Feature | Why it's essential |
|---|---|
| Farmer registration & e-KYC | Entry point; reused from AgriStack Farmer ID + Aadhaar OTP wherever the state has already onboarded the farmer. |
| Slot booking with capacity limits | A center that can process 200 farmers a day must not accept 400 bookings — this is the root cause of crowding. |
| Token issuance | Confirms a specific date, time window, and center for one farmer. |
| Real-time queue tracking | Farmer can see "how many ahead of me" and an estimated wait, not just a static token. |
| SMS / app notifications | Booking confirmation, "your turn is approaching," and procurement/payment status changes. |
| Procurement status tracking | Gate entry → weighing → quality check → lot accepted, visible to the farmer step by step. |
| Payment status tracking | Pulled from PFMS/DBT so the farmer sees the same status the bank sees — no guessing. |
| Admin / procurement-center dashboard | Staff need to see today's bookings, current queue, and mark procurement complete. |

### 3.2 Differentiator features (built *on top of* what already exists elsewhere)

| Existing gap | What AnnSetu adds | How it's different |
|---|---|---|
| Tokens issued centrally, sometimes for the wrong date/center (Punjab) | **Decentralised, capacity-aware slot allocation** run per center, with a daily cap computed from that center's historical throughput | Removes the single-point bottleneck; a center simply cannot be over-booked because the system enforces its own real capacity, not a head-office guess. |
| Token issued but still hours of blind waiting (MP) | **Live queue position + dynamic wait-time estimate**, pushed by SMS/app/IVR at set milestones ("5 ahead of you", "your turn now") | Converts a static token into a live status, the same way a food-delivery app shows movement instead of just a confirmation. |
| No option for feature-phone / low-literacy farmers | **USSD + IVR channel** parallel to the app, in the farmer's regional language, needing no internet or smartphone | Extends the *exact same* backend to farmers the app-only systems currently exclude. |
| e-NAM app requires a desktop for weighment, quality, payment | **End-to-end status on the phone** — every stage from gate entry to payment credit is visible in the same app/SMS thread | Removes the desktop hand-off that currently breaks the mobile promise. |
| Every state runs a separate, disconnected portal | **Adapter layer over existing state systems** — one Farmer ID, one notification experience, regardless of which state's back-end is being called | Farmers who migrate for procurement across state lines (common for wheat/paddy belts) get one consistent experience. |
| No self-service answers; farmers rely on word of mouth or a helpline | **Multilingual RAG-based FAQ assistant** answering from official MSP/procurement documents only, with a "no confident answer" fallback | A supporting feature only — see Section 4 for the strict boundary on what it is and is not allowed to do. |
| No pre-check before arriving at the center | **Optional grain-quality photo pre-check** (a small image-classification model, not an LLM) giving an advisory moisture/foreign-matter estimate | Helps a farmer avoid a wasted trip with over-moist grain; final grading always stays with the human inspector and calibrated equipment. |

---

## 4. Where AI is used — and where it is deliberately kept out

This is stated explicitly because it is easy to over-use AI in a proposal like this. The rule followed throughout: **if the answer must be exactly correct and auditable (a number, a status, a decision), it is computed by ordinary deterministic code — never by a language model.**

| Task | How it's done | AI involved? |
|---|---|---|
| Slot capacity, token numbering | Rule-based scheduling engine (plain arithmetic against a configured daily capacity) | No |
| Queue position, estimated wait time | Deterministic formula (Section 6) using rolling averages | No |
| Payment amount, MSP rate applied | Read directly from PFMS / the procurement transaction record | No |
| Identity verification | Aadhaar/UIDAI e-KYC APIs, existing government infrastructure | No |
| Farmer-facing FAQ chatbot ("what documents do I need", "why is my payment pending") | **RAG**: retrieves the matching passage from official circulars/FAQs first, then an LLM only rewords that retrieved passage into plain, translated language. If no matching passage is found, it says so and hands off to the helpline instead of guessing. | Yes — supporting role only |
| Grain quality photo pre-check | A small, purpose-built image-classification model (not a chat LLM) gives an advisory estimate | Yes — advisory, non-final, clearly labelled |

The chatbot is never the system of record for anything — it cannot change a booking, cannot confirm a payment, and cannot be the final word on grain quality.

---

## 5. User roles

- **Farmer** — registers, books a slot, tracks queue and payment.
- **Procurement center staff** — manages today's queue, records weighment/quality/lot outcome.
- **State nodal officer** — configures center capacity, views congestion analytics for their state.
- **DoCA / FCI dashboard user** — national view of procurement volume, average wait time, and payment turnaround, for policy monitoring.

---

## 6. How the queue math actually works (no AI, on purpose)

Two simple, explainable calculations run the entire experience:

**Daily capacity cap** (prevents over-booking a center):
```
Daily slots available = Center's historical average daily throughput
                          × a safety buffer (e.g. 0.9)
```
Once booked slots reach this number, the booking screen simply stops offering that day — same idea as a restaurant reservation system.

**Estimated wait time for a farmer already in the queue:**
```
Estimated wait = (number of tokens ahead in the queue)
                   × (rolling average service time per farmer at that center,
                      calculated from the last 20 completed transactions)
```
This is Little's Law applied in its simplest form — a standard queueing-theory formula, recalculated every few minutes as real transactions complete, and pushed to farmers waiting. No prediction model is needed or used; it is arithmetic on real, current numbers.

---

## 7. System architecture (simplified)

```
                         ┌───────────────────────────────────────────┐
                         │           FARMER-FACING CHANNELS           │
                         │  Mobile app (Android/iOS) · Web (PWA)      │
                         │  USSD menu (feature phones) · SMS · IVR    │
                         └───────────────────┬─────────────────────────┘
                                             │  API Gateway (auth, rate limiting)
                         ┌───────────────────▼─────────────────────────┐
                         │              CORE PLATFORM (backend)         │
                         │   deployed on government cloud (NIC MeghRaj) │
                         │                                              │
                         │  ┌───────────────────┐  ┌───────────────────┐│
                         │  │ Slot & queue       │  │ Notification      ││
                         │  │ engine (rule-based)│  │ service            ││
                         │  └───────────────────┘  └───────────────────┘│
                         │  ┌───────────────────┐  ┌───────────────────┐│
                         │  │ Payment status     │  │ RAG FAQ assistant ││
                         │  │ tracker            │  │ (AI, supporting)  ││
                         │  └───────────────────┘  └───────────────────┘│
                         └───────────────────┬─────────────────────────┘
                                             │
                       ┌─────────────────────┼─────────────────────────┐
                       ▼                     ▼                         ▼
             ┌───────────────────┐ ┌───────────────────┐   ┌───────────────────────┐
             │ Aadhaar / Farmer  │ │ PFMS / DBT          │   │ State procurement      │
             │ ID (AgriStack)    │ │ (payment records)   │   │ portals (via adapters) │
             └───────────────────┘ └───────────────────┘   └───────────────────────┘
```

### Farmer journey, step by step

```
Register once  ──▶  Book a slot  ──▶  Receive token &  ──▶  Procurement at  ──▶  Track payment
(Aadhaar +           (center, date,     live queue           center (gate         status until
 Farmer ID)           time; capped)     position              entry, weighing,     credited
                                         via app/SMS/IVR)      quality check)
```

### What happens the moment a farmer's produce is procured (event flow)

```
Staff marks "lot accepted" at center
          │
          ▼
  Message queue (Kafka/RabbitMQ) — event: "procurement complete"
          │
   ┌──────┴──────┐
   ▼             ▼
Notification   Payment tracker starts
service        polling PFMS for credit
sends SMS/            │
push: "produce         ▼
accepted, payment     Payment credited
processing"     ──▶   → SMS/app: "₹X credited to your account on <date>"
```

This event-driven design matters specifically because harvest season creates huge, short traffic spikes — the message queue means a burst of 5,000 simultaneous procurements does not overwhelm the notification service; each event just waits its turn and still gets delivered.

---

## 8. Detailed tech stack

### Frontend

| Layer | Choice | Why |
|---|---|---|
| Farmer mobile app | **Flutter** (single codebase, Android + iOS) | Runs well on the low-end Android phones common in rural India; supports offline-first local storage (SQLite) that syncs once network returns. |
| Web fallback | **Progressive Web App (PWA)** | Works in a browser with no install, caches key screens for poor connectivity. |
| Admin / center dashboard | **React.js + Tailwind CSS** | Fast to build, real-time queue display screens for the physical counter. |
| Feature-phone channel | **USSD gateway** (via an empanelled telecom aggregator, the same model as banking `*99#`) + **IVR** for voice prompts | No internet or smartphone required at all. |
| Language support | i18n libraries (`flutter_intl`, `react-i18next`) + recorded/synthesised regional-language voice prompts for IVR | Matches the diversity of procurement states (Punjabi, Hindi, Bengali, Telugu, etc.). |

### Backend

| Layer | Choice | Why |
|---|---|---|
| Core transactional services (farmer, slot, procurement, payment) | **Java (Spring Boot)** microservices | Reliability and strong typing for financial/legal records; matches the tech many existing government systems (like FCI/PFMS integrations) already use. |
| Real-time / high-concurrency services (queue broadcast, notifications) | **Node.js (NestJS) + Socket.io** | Handles thousands of open live connections efficiently during peak procurement hours. |
| API Gateway | **Kong** or NGINX | Single entry point: authentication, rate limiting, routing to the right microservice. |
| Authentication | OAuth2 / JWT, backed by Aadhaar e-KYC and AgriStack Farmer ID lookup | Reuses existing national identity infrastructure instead of building a new one. |

### Data layer

| Component | Choice | Why |
|---|---|---|
| Primary database | **PostgreSQL** | ACID-compliant relational storage for bookings, procurement transactions, and payment status — records that must never be inconsistent. |
| Live queue state & caching | **Redis** | In-memory, extremely fast reads/writes for "current queue position," with built-in pub/sub for pushing live updates. |
| Event backbone | **Apache Kafka** (or RabbitMQ for a smaller pilot) | Decouples services so a traffic spike in one place (e.g. notifications) never blocks another (e.g. payment tracking). |
| File/photo storage | **MinIO** (S3-compatible) on government cloud, encrypted at rest | Stores quality pre-check photos and documents securely. |
| Vector store for the RAG assistant | **pgvector** extension on PostgreSQL (or a lightweight store like Qdrant) | Stores official MSP/procurement documents as searchable chunks for retrieval before any AI-generated wording. |

### AI components (supporting only — see Section 4)

| Component | Approach |
|---|---|
| Multilingual FAQ assistant | RAG: retrieve the matching official-document passage → LLM rewords it simply and translates it → if no passage matches, respond with "no official answer found, contact the helpline" instead of guessing. |
| Grain-quality photo pre-check | A small, dedicated image-classification model (not an LLM) trained on moisture/foreign-matter visual indicators, output labelled clearly as advisory only. |

### Infrastructure & operations

| Concern | Choice |
|---|---|
| Hosting | **NIC MeghRaj** (government cloud) — required for data sovereignty over farmer personal data. |
| Containerisation & scaling | **Docker + Kubernetes**, auto-scaled up during harvest season and down afterward, since procurement traffic is extremely seasonal. |
| Monitoring | **Prometheus + Grafana** for system health; a congestion-analytics dashboard for DoCA/FCI officials. |
| Security | TLS in transit, encryption at rest, role-based access control (farmer vs. staff vs. officer), CAPTCHA and rate limits on booking to prevent token-scalping by intermediaries — a real problem seen in earlier token rollouts. |
| Compliance | Built to the **DPDP Act 2023** — consent-based data collection, data minimisation (never storing more Aadhaar detail than required), and a right-to-erasure path. |
| Audit trail | Every token issuance and every payment-status change is logged immutably, directly addressing the "wrong date/center" complaints seen in earlier rollouts. |

---

## 9. Non-functional priorities

- **Seasonal scalability** — procurement traffic is not steady; it spikes hard for a few weeks per season (wheat/paddy). Architecture scales out during these windows and back down afterward.
- **Offline resilience** — the app caches the farmer's own booking/queue status locally so a temporary network drop (a repeatedly reported real-world problem) doesn't make the token appear to vanish.
- **Accessibility** — IVR and USSD ensure a farmer without a smartphone or reliable data is not excluded, unlike app-only systems.
- **Auditability** — every state change (booking, token, procurement stage, payment) is logged, addressing the "token issued for wrong date" type of failure directly.

---

## 10. Suggested rollout plan

| Phase | Scope |
|---|---|
| Phase 1 — MVP pilot | 2–3 procurement centers in one state; core features only (registration, slot booking, queue tracking, SMS). Validate the capacity-cap and wait-time formulas against real throughput data. |
| Phase 2 — Add supporting features | RAG FAQ assistant, WhatsApp notifications, quality pre-check, admin analytics dashboard. |
| Phase 3 — Scale out | USSD/IVR channel, adapter integrations with more state portals, national DoCA/FCI monitoring dashboard. |

## 11. Suggested success metrics

- Reduction in average on-site waiting time per farmer (before vs. after).
- Reduction in "wrong date/center" token complaints.
- Percentage of farmers reached who have no smartphone (via USSD/IVR adoption).
- Time from procurement completion to payment credit, as read from PFMS.
- FAQ assistant deflection rate (queries resolved without a helpline call) — tracked alongside its "no confident answer" rate, to keep it honest rather than incentivising guessing.

---

## 12. Sources consulted

- FCI Depot Online System — farmer registration (fcidepotonline.gov.in)
- West Bengal e-Paddy procurement portal (epaddy.wb.gov.in)
- Himachal Pradesh wheat procurement registration, The Tribune
- Punjab e-token confusion reporting, The Tribune (multiple articles on PMS/e-PMB rollout issues)
- Madhya Pradesh e-Vikas portal queueing issues, Ground Report
- e-NAM mobile app store listing (Google Play / Apple App Store) — stated scope limitations
- AgriStack Farmer Registry coverage and procurement integration, Business Standard / PIB (August 2026)
