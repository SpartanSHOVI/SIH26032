import { Pool } from 'pg';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3102/api/v1';
const PG_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/annsetu_loadtest';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-min-32-chars';

const pool = new Pool({ connectionString: PG_URL, max: 20 });
const redis = new Redis(REDIS_URL);

const digest = (v: string) => createHash('sha256').update(v).digest('hex');

interface UserSession {
  farmerId?: string;
  centerId?: string;
  accountId: string;
  cookieHeader: string;
  csrfToken: string;
}

export interface ScenarioRunResult {
  runIndex: number;
  concurrency: number;
  successCount: number;
  rejectedCount: number;
  unexpectedCount: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  dbTokensCreated: number;
  dbBookedCount: number;
  expectedBookedCount: number;
  doubleBookingsOrClaims: number;
  passed: boolean;
  notes?: string;
}

export interface ScenarioResult {
  id: string;
  name: string;
  category: 'booking' | 'call-next' | 'transition';
  concurrency: number;
  runs: ScenarioRunResult[];
  allPassed: boolean;
}

const allResults: ScenarioResult[] = [];

async function clearRateLimits() {
  const keys = await redis.keys('rate:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

async function createFarmerSession(mobileSuffix: string): Promise<UserSession> {
  const mobile = `98700${mobileSuffix.padStart(5, '0')}`;
  const farmerRes = await pool.query(
    `INSERT INTO farmers (farmer_id, name, mobile, crop, quantity, consent_given, consent_timestamp, preferred_language)
     VALUES ($1, $2, $3, 'Wheat', 30, true, now(), 'en')
     ON CONFLICT (farmer_id) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [`FARMER-${mobile}`, `LoadTest Farmer ${mobileSuffix}`, mobile]
  );
  const farmerId = farmerRes.rows[0].id;

  const accountRes = await pool.query(
    `INSERT INTO app_accounts (login, password_hash, role, farmer_id, demo)
     VALUES ($1, 'hash_placeholder', 'FARMER', $2, false)
     ON CONFLICT (login) DO UPDATE SET farmer_id = EXCLUDED.farmer_id
     RETURNING id`,
    [mobile, farmerId]
  );
  const accountId = accountRes.rows[0].id;

  const sid = randomUUID();
  const refreshSecret = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');

  await pool.query(
    `INSERT INTO auth_sessions (id, account_id, refresh_hash, csrf_hash, expires_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, now() + interval '7 days')`,
    [sid, accountId, digest(refreshSecret), digest(csrfToken)]
  );

  const accessToken = jwt.sign(
    { role: 'FARMER', farmerId, sid, demo: false },
    JWT_SECRET,
    { subject: accountId, expiresIn: '1h', issuer: 'annsetu', audience: 'annsetu-web' }
  );

  return {
    farmerId,
    accountId,
    csrfToken,
    cookieHeader: `annsetu_access=${accessToken}; annsetu_csrf=${csrfToken}; annsetu_refresh=${sid}.${refreshSecret}`,
  };
}

async function createOperatorSession(opId: string, centerId: string): Promise<UserSession> {
  const login = `operator_${opId}`;
  const accountRes = await pool.query(
    `INSERT INTO app_accounts (login, password_hash, role, center_id, demo)
     VALUES ($1, 'hash_placeholder', 'CENTER_OPERATOR', $2::uuid, false)
     ON CONFLICT (login) DO UPDATE SET center_id = EXCLUDED.center_id
     RETURNING id`,
    [login, centerId]
  );
  const accountId = accountRes.rows[0].id;

  const sid = randomUUID();
  const refreshSecret = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');

  await pool.query(
    `INSERT INTO auth_sessions (id, account_id, refresh_hash, csrf_hash, expires_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, now() + interval '7 days')`,
    [sid, accountId, digest(refreshSecret), digest(csrfToken)]
  );

  const accessToken = jwt.sign(
    { role: 'CENTER_OPERATOR', centerId, sid, demo: false },
    JWT_SECRET,
    { subject: accountId, expiresIn: '1h', issuer: 'annsetu', audience: 'annsetu-web' }
  );

  return {
    centerId,
    accountId,
    csrfToken,
    cookieHeader: `annsetu_access=${accessToken}; annsetu_csrf=${csrfToken}; annsetu_refresh=${sid}.${refreshSecret}`,
  };
}

async function httpRequest(
  endpoint: string,
  method: string,
  session: UserSession,
  body?: Record<string, any>
) {
  const start = performance.now();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': session.cookieHeader,
      'X-CSRF-Token': session.csrfToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const elapsed = performance.now() - start;
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json, elapsed };
}

function calculatePercentile(latencies: number[], p: number): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// -------------------------------------------------------------
// 1. Booking Atomicity Tests
// -------------------------------------------------------------
async function runBookingScenario(
  scenarioId: string,
  scenarioName: string,
  concurrency: number,
  totalCapacity: number,
  initialBooked: number,
  runCount: number,
  centerId: string,
  sessions: UserSession[]
): Promise<ScenarioResult> {
  console.log(`\n======================================================`);
  console.log(`RUNNING: ${scenarioName} (${concurrency} concurrent, ${runCount} run(s))`);
  console.log(`======================================================`);

  const runs: ScenarioRunResult[] = [];
  const expectedSuccesses = totalCapacity - initialBooked;

  for (let r = 1; r <= runCount; r++) {
    await clearRateLimits();
    const scenarioNum = scenarioId.replace(/\D/g, '');
    const dateStr = `2026-12-${String(r).padStart(2, '0')}`;
    const startTime = `${String(Math.min(23, 8 + Math.floor(Number(scenarioNum) / 10))).padStart(2, '0')}:${String((Number(scenarioNum) * 7 + r) % 60).padStart(2, '0')}`;
    const endTime = '23:59';

    // Seed slot
    const slotRes = await pool.query(
      `INSERT INTO slots (center_id, slot_date, start_time, end_time, total_slots, booked_count)
       VALUES ($1, $2::date, $3, $4, $5, $6)
       RETURNING id`,
      [centerId, dateStr, startTime, endTime, totalCapacity, initialBooked]
    );
    const slotId = slotRes.rows[0].id;

    // Pick N distinct sessions
    const runSessions = sessions.slice(0, concurrency);

    // Fire concurrent booking HTTP requests
    const promises = runSessions.map((session) =>
      httpRequest('/tokens/book', 'POST', session, {
        farmer_id: session.farmerId,
        center_id: centerId,
        slot_id: Number(slotId),
      })
    );

    const responses = await Promise.all(promises);

    let successCount = 0;
    let rejectedCount = 0;
    let unexpectedCount = 0;
    const latencies: number[] = [];

    for (const resp of responses) {
      latencies.push(resp.elapsed);
      const errText = String(resp.data?.error || resp.data?.message || '');
      if (resp.status === 200 || resp.status === 201) {
        successCount++;
      } else if (resp.status === 400 && errText.includes('slot is full')) {
        rejectedCount++;
      } else {
        unexpectedCount++;
        console.error(`[Unexpected Response] Status: ${resp.status}`, resp.data);
      }
    }

    // Verify DB
    const tokensRes = await pool.query(
      `SELECT count(*)::int as count FROM tokens WHERE slot_id = $1`,
      [slotId]
    );
    const dbTokensCreated = tokensRes.rows[0].count;

    const slotAfter = await pool.query(
      `SELECT booked_count, total_slots FROM slots WHERE id = $1`,
      [slotId]
    );
    const dbBookedCount = slotAfter.rows[0].booked_count;

    const doubleBookings = Math.max(0, dbTokensCreated - expectedSuccesses);
    const passed =
      successCount === expectedSuccesses &&
      rejectedCount === concurrency - expectedSuccesses &&
      unexpectedCount === 0 &&
      dbTokensCreated === expectedSuccesses &&
      dbBookedCount === totalCapacity &&
      doubleBookings === 0;

    const runResult: ScenarioRunResult = {
      runIndex: r,
      concurrency,
      successCount,
      rejectedCount,
      unexpectedCount,
      minLatencyMs: Math.min(...latencies),
      maxLatencyMs: Math.max(...latencies),
      avgLatencyMs: Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)),
      p95LatencyMs: Number(calculatePercentile(latencies, 95).toFixed(2)),
      dbTokensCreated,
      dbBookedCount,
      expectedBookedCount: totalCapacity,
      doubleBookingsOrClaims: doubleBookings,
      passed,
      notes: passed
        ? `Pass: exactly ${expectedSuccesses} booked, ${rejectedCount} rejected`
        : `Fail: success=${successCount}, rej=${rejectedCount}, unexpected=${unexpectedCount}, dbTokens=${dbTokensCreated}`,
    };

    runs.push(runResult);

    console.log(
      `Run ${r}/${runCount}: ${passed ? '✅ PASS' : '❌ FAIL'} | Success: ${successCount}/${expectedSuccesses} | Rejected: ${rejectedCount} | Unexp: ${unexpectedCount} | DB Booked: ${dbBookedCount}/${totalCapacity} | p95: ${runResult.p95LatencyMs}ms`
    );
  }

  const allPassed = runs.every((r) => r.passed);
  const scenarioResult: ScenarioResult = {
    id: scenarioId,
    name: scenarioName,
    category: 'booking',
    concurrency,
    runs,
    allPassed,
  };
  allResults.push(scenarioResult);
  return scenarioResult;
}

// -------------------------------------------------------------
// 2. Call-Next Concurrency Tests (FOR UPDATE SKIP LOCKED)
// -------------------------------------------------------------
async function runCallNextScenario(
  scenarioId: string,
  scenarioName: string,
  concurrency: number,
  centerId: string,
  operators: UserSession[],
  farmerSessions: UserSession[]
): Promise<ScenarioResult> {
  console.log(`\n======================================================`);
  console.log(`RUNNING: ${scenarioName} (${concurrency} simultaneous callers)`);
  console.log(`======================================================`);

  await clearRateLimits();
  const scenarioNum = Number(scenarioId.replace(/\D/g, '') || '1');
  const day = 15 + (scenarioNum % 10);
  const dateStr = `2026-11-${String(day).padStart(2, '0')}`;

  // Seed N slots with 1 token each so SKIP LOCKED tests token queue contention across slots
  const slotIds: number[] = [];
  const tokenIds: number[] = [];
  for (let i = 0; i < concurrency; i++) {
    const startTime = `${String(Math.floor(i / 60) + 8).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`;
    const slotRes = await pool.query(
      `INSERT INTO slots (center_id, slot_date, start_time, end_time, total_slots, booked_count)
       VALUES ($1, $2::date, $3, '23:59', 1, 1)
       RETURNING id`,
      [centerId, dateStr, startTime]
    );
    const slotId = slotRes.rows[0].id;
    slotIds.push(slotId);

    const farmer = farmerSessions[i % farmerSessions.length];
    const tokenNumber = `LDH-2611${scenarioNum}-${concurrency}00${String(i).padStart(3, '0')}`;
    const tRes = await pool.query(
      `INSERT INTO tokens (token_number, farmer_id, center_id, slot_id, status, booked_via)
       VALUES ($1, $2, $3, $4, 'arrived', 'loadtest')
       RETURNING id`,
      [tokenNumber, farmer.farmerId, centerId, slotId]
    );
    tokenIds.push(tRes.rows[0].id);
  }

  // Fire concurrent call-next requests from N different operators
  const runOps = operators.slice(0, concurrency);
  const promises = runOps.map((op) =>
    httpRequest(`/centers/${centerId}/call-next?date=${dateStr}`, 'POST', op)
  );

  const responses = await Promise.all(promises);

  let successCount = 0;
  let nullClaimCount = 0;
  let unexpectedCount = 0;
  const claimedTokenIds = new Set<number>();
  const duplicateClaims: number[] = [];
  const latencies: number[] = [];

  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    latencies.push(resp.elapsed);
    if (resp.status === 200 || resp.status === 201) {
      if (resp.data?.token_id) {
        successCount++;
        const tid = Number(resp.data.token_id);
        if (claimedTokenIds.has(tid)) {
          duplicateClaims.push(tid);
        } else {
          claimedTokenIds.add(tid);
        }
      } else if (resp.data?.token === null) {
        nullClaimCount++;
      } else {
        unexpectedCount++;
        console.log(`[CallNext Unknown 200] Op ${i}:`, resp.data);
      }
    } else {
      unexpectedCount++;
      console.error(`[CallNext Unexpected] Status: ${resp.status}`, resp.data);
    }
  }

  // Verify in DB that each token is claimed by exactly one operator
  const dbClaimedRes = await pool.query(
    `SELECT id, status, claimed_by, claimed_at FROM tokens WHERE id = ANY($1::bigint[])`,
    [tokenIds]
  );
  const claimedInDb = dbClaimedRes.rows.filter((t) => t.status === 'verification');
  const uniqueClaimantsInDb = new Set(claimedInDb.map((t) => t.claimed_by));

  const doubleClaims = duplicateClaims.length + (claimedInDb.length - uniqueClaimantsInDb.size);
  const passed =
    successCount === concurrency &&
    claimedTokenIds.size === concurrency &&
    doubleClaims === 0 &&
    unexpectedCount === 0 &&
    claimedInDb.length === concurrency;

  const runResult: ScenarioRunResult = {
    runIndex: 1,
    concurrency,
    successCount,
    rejectedCount: nullClaimCount,
    unexpectedCount,
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    avgLatencyMs: Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)),
    p95LatencyMs: Number(calculatePercentile(latencies, 95).toFixed(2)),
    dbTokensCreated: concurrency,
    dbBookedCount: concurrency,
    expectedBookedCount: concurrency,
    doubleBookingsOrClaims: doubleClaims,
    passed,
    notes: passed
      ? `Pass: exactly ${concurrency} distinct tokens claimed with 0 duplicates`
      : `Fail: success=${successCount}, distinct=${claimedTokenIds.size}, doubleClaims=${doubleClaims}`,
  };

  console.log(
    `Call-Next Result: ${passed ? '✅ PASS' : '❌ FAIL'} | Claimed: ${claimedTokenIds.size}/${concurrency} | Double Claims: ${doubleClaims} | p95: ${runResult.p95LatencyMs}ms`
  );

  const scenarioResult: ScenarioResult = {
    id: scenarioId,
    name: scenarioName,
    category: 'call-next',
    concurrency,
    runs: [runResult],
    allPassed: passed,
  };
  allResults.push(scenarioResult);
  return scenarioResult;
}

// -------------------------------------------------------------
// 3. Token State Transition Integrity Tests
// -------------------------------------------------------------
async function runTransitionScenario(
  scenarioId: string,
  scenarioName: string,
  initialStatus: string,
  transitionA: { status: string; reject_reason?: string },
  transitionB: { status: string; reject_reason?: string },
  centerId: string,
  opA: UserSession,
  opB: UserSession,
  farmerSession: UserSession
): Promise<ScenarioResult> {
  console.log(`\n======================================================`);
  console.log(`RUNNING: ${scenarioName} (Initial: ${initialStatus})`);
  console.log(`======================================================`);

  await clearRateLimits();

  // Create slot and token
  const scenarioNum = scenarioId.replace(/\D/g, '') || '1';
  const startTime = `1${scenarioNum}:00`;
  const slotRes = await pool.query(
    `INSERT INTO slots (center_id, slot_date, start_time, end_time, total_slots, booked_count)
     VALUES ($1, '2026-11-25'::date, $2, '23:59', 10, 1)
     RETURNING id`,
    [centerId, startTime]
  );
  const slotId = slotRes.rows[0].id;

  const tRes = await pool.query(
    `INSERT INTO tokens (token_number, farmer_id, center_id, slot_id, status, booked_via)
     VALUES ($1, $2, $3, $4, $5, 'loadtest')
     RETURNING id`,
    [`TRN-${Date.now().toString().slice(-6)}`, farmerSession.farmerId, centerId, slotId, initialStatus]
  );
  const tokenId = tRes.rows[0].id;

  // Fire concurrent conflicting transitions
  const pA = httpRequest(`/tokens/${tokenId}/status`, 'PATCH', opA, transitionA);
  const pB = httpRequest(`/tokens/${tokenId}/status`, 'PATCH', opB, transitionB);

  const [resA, resB] = await Promise.all([pA, pB]);

  // Read final state from DB
  const finalDb = await pool.query(
    `SELECT status, reject_reason, updated_at FROM tokens WHERE id = $1`,
    [tokenId]
  );
  const finalStatus = finalDb.rows[0].status;

  console.log(`Op A (${transitionA.status}): HTTP ${resA.status}`, resA.data?.status || resA.data?.message);
  console.log(`Op B (${transitionB.status}): HTTP ${resB.status}`, resB.data?.status || resB.data?.message);
  console.log(`Final DB status: ${finalStatus}`);

  // One must succeed (200) and the other must be cleanly rejected (400)
  const oneSuccessOneFail =
    (resA.status === 200 && resB.status === 400) ||
    (resB.status === 200 && resA.status === 400);

  const passed = oneSuccessOneFail && (finalStatus === transitionA.status || finalStatus === transitionB.status);

  const latencies = [resA.elapsed, resB.elapsed];
  const runResult: ScenarioRunResult = {
    runIndex: 1,
    concurrency: 2,
    successCount: (resA.status === 200 ? 1 : 0) + (resB.status === 200 ? 1 : 0),
    rejectedCount: (resA.status === 400 ? 1 : 0) + (resB.status === 400 ? 1 : 0),
    unexpectedCount: (resA.status !== 200 && resA.status !== 400 ? 1 : 0) + (resB.status !== 200 && resB.status !== 400 ? 1 : 0),
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    avgLatencyMs: Number(((resA.elapsed + resB.elapsed) / 2).toFixed(2)),
    p95LatencyMs: Math.max(...latencies),
    dbTokensCreated: 1,
    dbBookedCount: 1,
    expectedBookedCount: 1,
    doubleBookingsOrClaims: 0,
    passed,
    notes: passed
      ? `Pass: deterministic resolution, one succeeded (status -> ${finalStatus}), conflicting request rejected with 400`
      : `Fail: unexpected status A=${resA.status}, B=${resB.status}`,
  };

  const scenarioResult: ScenarioResult = {
    id: scenarioId,
    name: scenarioName,
    category: 'transition',
    concurrency: 2,
    runs: [runResult],
    allPassed: passed,
  };
  allResults.push(scenarioResult);
  return scenarioResult;
}

let childProcess: any = null;

async function ensureServerRunning() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      console.log(`Connected to running API server at ${API_BASE_URL}`);
      return;
    }
  } catch {}
  console.log(`Starting API server on port 3102 for load test execution...`);
  const { spawn } = await import('node:child_process');
  const path = await import('node:path');
  childProcess = spawn('node', ['dist/main.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: '3102',
      DATABASE_URL: PG_URL,
      REDIS_URL: REDIS_URL,
    },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        console.log(`API server is healthy and responding on ${API_BASE_URL}`);
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API server failed to start within 25s');
}

// -------------------------------------------------------------
// Main Test Runner
// -------------------------------------------------------------
export async function main() {
  console.log(`Starting Concurrency & Load Test Suite...`);
  console.log(`Target API: ${API_BASE_URL}`);
  console.log(`Target PG: ${PG_URL}`);
  console.log(`Target Redis: ${REDIS_URL}`);

  try {
    await ensureServerRunning();

    // 1. Verify Center
    const centerRes = await pool.query(
      `SELECT id, code, name FROM centers WHERE state = 'Punjab' LIMIT 1`
    );
    assert(centerRes.rows.length > 0, 'No center found in Punjab');
    const center = centerRes.rows[0];
    const centerId = center.id;
    console.log(`Selected Center: ${center.name} (${center.code}) [${centerId}]`);

    // Clean up any residual test data from previous runs
    console.log(`Cleaning up residual loadtest slots and tokens...`);
    await pool.query(`DELETE FROM tokens WHERE booked_via = 'loadtest' OR token_number LIKE 'LDH-26%' OR token_number LIKE 'TRN-%'`);
    await pool.query(`DELETE FROM slots WHERE slot_date >= '2026-11-01'::date`);

    // 2. Pre-generate 60 Farmer Sessions
    console.log(`Pre-seeding 60 Farmer accounts and sessions...`);
    const farmerSessions: UserSession[] = [];
    for (let i = 1; i <= 60; i++) {
      farmerSessions.push(await createFarmerSession(String(i)));
    }
    console.log(`Seeded ${farmerSessions.length} farmer sessions.`);

    // 3. Pre-generate 55 Operator Sessions
    console.log(`Pre-seeding 55 Operator accounts and sessions...`);
    const operatorSessions: UserSession[] = [];
    for (let i = 1; i <= 55; i++) {
      operatorSessions.push(await createOperatorSession(String(i), centerId));
    }
    console.log(`Seeded ${operatorSessions.length} operator sessions.`);

    // -------------------------------------------------------------
    // Execute Required Test Scenarios
    // -------------------------------------------------------------

    // SCENARIO 1: 10 concurrent requests at last slot (1 remaining capacity)
    await runBookingScenario(
      'SCENARIO_1_1',
      'Booking Concurrency: 10 requests for 1 remaining slot',
      10,
      10,
      9,
      1,
      centerId,
      farmerSessions
    );

    // SCENARIO 2: 50 concurrent requests at last slot (1 remaining capacity)
    await runBookingScenario(
      'SCENARIO_1_2',
      'Booking Concurrency: 50 requests for 1 remaining slot',
      50,
      50,
      49,
      1,
      centerId,
      farmerSessions
    );

    // SCENARIO 3: 10 concurrent requests at slot with room for exactly 3
    await runBookingScenario(
      'SCENARIO_1_3',
      'Booking Concurrency: 10 requests for 3 remaining slots',
      10,
      10,
      7,
      1,
      centerId,
      farmerSessions
    );

    // SCENARIO 4: Repeat Scenario 1.1 5 times to check for flakiness
    await runBookingScenario(
      'SCENARIO_1_4',
      'Booking Flakiness Test: 10 requests for 1 remaining slot (5 runs)',
      10,
      10,
      9,
      5,
      centerId,
      farmerSessions
    );

    // SCENARIO 5: call-next with 5 simultaneous callers
    await runCallNextScenario(
      'SCENARIO_2_1',
      'Call-Next Concurrency: 5 simultaneous callers (FOR UPDATE SKIP LOCKED)',
      5,
      centerId,
      operatorSessions,
      farmerSessions
    );

    // SCENARIO 6: call-next with 20 simultaneous callers
    await runCallNextScenario(
      'SCENARIO_2_2',
      'Call-Next Concurrency: 20 simultaneous callers (FOR UPDATE SKIP LOCKED)',
      20,
      centerId,
      operatorSessions,
      farmerSessions
    );

    // SCENARIO 7: call-next with 50 simultaneous callers
    await runCallNextScenario(
      'SCENARIO_2_3',
      'Call-Next Concurrency: 50 simultaneous callers (FOR UPDATE SKIP LOCKED)',
      50,
      centerId,
      operatorSessions,
      farmerSessions
    );

    // SCENARIO 8: Token transition conflict (verification vs accepted from arrived)
    await runTransitionScenario(
      'SCENARIO_3_1',
      'Token State Integrity: Concurrent valid next vs invalid skip (arrived -> verification vs accepted)',
      'arrived',
      { status: 'verification' },
      { status: 'accepted' },
      centerId,
      operatorSessions[0],
      operatorSessions[1],
      farmerSessions[0]
    );

    // SCENARIO 9: Token transition conflict (quality_check vs procured from verification)
    await runTransitionScenario(
      'SCENARIO_3_2',
      'Token State Integrity: Concurrent valid next vs invalid skip (verification -> quality_check vs procured)',
      'verification',
      { status: 'quality_check' },
      { status: 'procured' },
      centerId,
      operatorSessions[0],
      operatorSessions[1],
      farmerSessions[0]
    );

    console.log(`\n======================================================`);
    console.log(`ALL LOAD & CONCURRENCY TESTS COMPLETED`);
    console.log(`======================================================`);

    let totalRuns = 0;
    let passedRuns = 0;
    for (const sc of allResults) {
      for (const r of sc.runs) {
        totalRuns++;
        if (r.passed) passedRuns++;
      }
    }
    console.log(`Total Runs: ${totalRuns} | Passed: ${passedRuns} | Failed: ${totalRuns - passedRuns}`);
    console.log(`Overall Status: ${passedRuns === totalRuns ? '✅ 100% PASS' : '❌ FAILURES DETECTED'}`);

    const fs = await import('node:fs');
    const path = await import('node:path');
    const outPath = path.resolve(__dirname, 'load-test-results.json');
    fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), totalRuns, passedRuns, allResults }, null, 2));
    console.log(`Saved detailed test telemetry to ${outPath}`);

    return { allResults, totalRuns, passedRuns, allPassed: passedRuns === totalRuns };
  } finally {
    if (childProcess) {
      console.log('Stopping ephemeral API server...');
      try {
        childProcess.kill('SIGKILL');
        childProcess.unref();
      } catch {}
    }
    await pool.end();
    redis.disconnect();
  }
}

if (require.main === module || process.argv[1]?.includes('concurrency.load')) {
  main().then((res) => {
    if (!res.allPassed) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
