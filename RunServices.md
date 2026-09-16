# AnnSetu — Service Execution & Run Guide

This guide outlines the standard procedures for running the AnnSetu development and production services.

---

### Option 1: Monorepo Full-Stack Stack (Recommended for Development)

Runs the unified NestJS API (`:3001`), Next.js Web App (`:3000`), PostgreSQL 16 (`:5432`), and Redis 7.2 (`:6379`):

#### Step 1: Start PostgreSQL & Redis in Docker
```bash
docker compose up -d postgres redis
```

#### Step 2: Run Database Migrations & Generate Prisma Client
```bash
pnpm db:migrate
pnpm db:generate
```

#### Step 3: Start API and Web Services Concurrently
```bash
pnpm dev
```
- **Farmer & Operator Web App**: [http://localhost:3000](http://localhost:3000)
- **Nodal Officer Admin Portal**: [http://localhost:3000/admin?role=admin](http://localhost:3000/admin?role=admin)
- **REST API & Swagger Docs**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **Statutory MSP API**: [http://localhost:3001/api/v1/msp](http://localhost:3001/api/v1/msp)

---

### Option 2: Docker Compose (All Services Containerized)

Spins up the full stack including PostgreSQL, Redis, backend, and reverse proxy:

```bash
docker compose up -d --build
```

To view logs or check status:
```bash
# View live logs
docker compose logs -f

# Check container health status
docker compose ps
```

To stop:
```bash
docker compose down
```

---

### Option 3: Running Services Independently

If you wish to run services in separate terminal tabs:

#### Terminal 1: NestJS API Backend
```bash
pnpm dev:api
```

#### Terminal 2: Next.js Web Frontend
```bash
pnpm dev:web
```

---

### Verifying Service Health

```bash
# NestJS REST API Health Probe
curl -i http://localhost:3001/api/v1/health

# Web Frontend Probe
curl -i http://localhost:3000/

# Statutory MSP Floor Benchmark Query
curl -s http://localhost:3001/api/v1/msp | jq '.[0:2]'

# Interactive IVR Voice Hotline (Simulated)
curl -s -X POST http://localhost:3001/api/v1/ivr/call \
  -H "Content-Type: application/json" \
  -d '{"caller_phone":"9876543210","digits":"4","language":"hi"}' | jq .
```

---

### External Demo / Judges Access (Cloudflare Tunnel or Ngrok)

To securely share the live AnnSetu portal with mobile devices or hackathon evaluators:

```bash
# Using Cloudflare Quick Tunnels (No sign-in required, zero warning banners)
cloudflared tunnel --url http://localhost:3000

# Alternative using Ngrok
ngrok http 3000 --host-header="localhost:3000"
```
