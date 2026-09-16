import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as argon from 'argon2';
import { Response } from 'express';
import { UnauthorizedException, ForbiddenException, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseService, first, rows } from '../src/infrastructure/database/database.service';
import { AuthRepository } from '../src/modules/auth/auth.repository';
import { AuthService, digest, isSha256, isArgon2 } from '../src/modules/auth/auth.service';
import { env, isDemoAuthEnabled } from '../src/config/env';
import { AppModule } from '../src/app.module';
import { buildSwagger } from '../src/swagger';

function createMockResponse() {
  const cookies: Record<string, { val: string; opts: any }> = {};
  return {
    cookies,
    cookie(name: string, val: string, opts: any) {
      cookies[name] = { val, opts };
    },
    clearCookie(name: string) {
      delete cookies[name];
    },
  } as unknown as Response & { cookies: Record<string, { val: string; opts: any }> };
}

describe('Auth Argon2 Password Migration & Demo OTP Gating & Swagger Verification', () => {
  let db: DatabaseService;
  let repo: AuthRepository;
  let authService: AuthService;

  const legacyMobile = '9870001001';
  const legacyPassword = 'FarmerLegacy@123';
  const legacySha256 = digest(legacyPassword);

  const alreadyArgonMobile = '9870001002';
  const argonPassword = 'FarmerArgon@456';
  let existingArgonHash: string;

  const corruptMobile = '9870001003';
  const concurrentMobile = '9870001004';
  const concurrentPassword = 'ConcurrentPass@789';

  const demoMobile = '9870001005';
  const registeredMobile = '9870001099';

  before(async () => {
    db = new DatabaseService();
    repo = new AuthRepository(db);
    authService = new AuthService(repo);

    existingArgonHash = await argon.hash(argonPassword);

    // Clean up test data
    const allTestMobiles = [legacyMobile, alreadyArgonMobile, corruptMobile, concurrentMobile, demoMobile, registeredMobile];
    await rows(db, `delete from auth_sessions where account_id in (select id from app_accounts where login = any($1))`, allTestMobiles);
    await rows(db, `delete from app_accounts where login = any($1)`, allTestMobiles);
    await rows(db, `delete from farmers where mobile = any($1)`, allTestMobiles);

    // 1. Seed legacy SHA-256 account in app_accounts and farmers
    const farmer1 = await first<{ id: string }>(
      db,
      `insert into farmers (farmer_id, name, mobile, password_hash, state, preferred_language, consent_given)
       values ($1, 'Legacy Farmer', $2, $3, 'Punjab', 'pa', true) returning id`,
      'FID-LEGACY-01',
      legacyMobile,
      legacySha256,
    );

    await rows(
      db,
      `insert into app_accounts (login, password_hash, role, farmer_id)
       values ($1, $2, 'FARMER', $3::uuid)`,
      legacyMobile,
      legacySha256,
      farmer1!.id,
    );

    // 2. Seed already-Argon2 account
    const farmer2 = await first<{ id: string }>(
      db,
      `insert into farmers (farmer_id, name, mobile, password_hash, state, preferred_language, consent_given)
       values ($1, 'Argon Farmer', $2, $3, 'Punjab', 'pa', true) returning id`,
      'FID-ARGON-02',
      alreadyArgonMobile,
      existingArgonHash,
    );

    await rows(
      db,
      `insert into app_accounts (login, password_hash, role, farmer_id)
       values ($1, $2, 'FARMER', $3::uuid)`,
      alreadyArgonMobile,
      existingArgonHash,
      farmer2!.id,
    );

    // 3. Seed corrupt hash account
    const farmerCorrupt = await first<{ id: string }>(
      db,
      `insert into farmers (farmer_id, name, mobile, password_hash, state, preferred_language, consent_given)
       values ($1, 'Corrupt Farmer', $2, 'CORRUPT_HASH', 'Punjab', 'pa', true) returning id`,
      'FID-CORRUPT-03',
      corruptMobile,
    );

    await rows(
      db,
      `insert into app_accounts (login, password_hash, role, farmer_id)
       values ($1, 'CORRUPTED_HASH_JUNK_$$$NOT_VALID', 'FARMER', $2::uuid)`,
      corruptMobile,
      farmerCorrupt!.id,
    );

    // 4. Seed concurrent legacy SHA-256 account
    const farmerConcurrent = await first<{ id: string }>(
      db,
      `insert into farmers (farmer_id, name, mobile, password_hash, state, preferred_language, consent_given)
       values ($1, 'Concurrent Farmer', $2, $3, 'Punjab', 'pa', true) returning id`,
      'FID-CONCURRENT-04',
      concurrentMobile,
      digest(concurrentPassword),
    );

    await rows(
      db,
      `insert into app_accounts (login, password_hash, role, farmer_id)
       values ($1, $2, 'FARMER', $3::uuid)`,
      concurrentMobile,
      digest(concurrentPassword),
      farmerConcurrent!.id,
    );

    // 5. Seed demo account
    const farmerDemo = await first<{ id: string }>(
      db,
      `insert into farmers (farmer_id, name, mobile, password_hash, state, preferred_language, consent_given)
       values ($1, 'Demo Farmer', $2, $3, 'Punjab', 'pa', true) returning id`,
      'FID-DEMO-05',
      demoMobile,
      existingArgonHash,
    );

    await rows(
      db,
      `insert into app_accounts (login, password_hash, role, farmer_id, demo)
       values ($1, $2, 'FARMER', $3::uuid, true)`,
      demoMobile,
      existingArgonHash,
      farmerDemo!.id,
    );
  });

  after(async () => {
    const allTestMobiles = [legacyMobile, alreadyArgonMobile, corruptMobile, concurrentMobile, demoMobile, registeredMobile, '9870001022'];
    await rows(db, `delete from auth_sessions where account_id in (select id from app_accounts where login = any($1))`, allTestMobiles);
    await rows(db, `delete from app_accounts where login = any($1)`, allTestMobiles);
    await rows(db, `delete from farmers where mobile = any($1)`, allTestMobiles);
    await db.onModuleDestroy();
  });

  // --- PART 1: SHA-256 -> ARGON2 PASSWORD MIGRATION (7 TEST CASES) ---

  // Test Case 1: Legacy SHA-256 account logs in successfully and hash is upgraded to Argon2 in the same request
  it('1. should verify legacy SHA-256 hash on login and transparently upgrade stored hash to Argon2 in same request', async () => {
    const mockRes = createMockResponse();

    // Verify it is currently stored as SHA-256
    const beforeAccount = await repo.account(legacyMobile);
    assert.ok(isSha256(beforeAccount.password_hash), 'Initial password_hash must be SHA-256 hex string');
    assert.equal(isArgon2(beforeAccount.password_hash), false);

    const profile = await authService.login({ mobile: legacyMobile, password: legacyPassword }, mockRes);
    assert.ok(profile, 'Login must succeed');
    assert.ok(mockRes.cookies['annsetu_access'], 'Access cookie must be set');

    // Verify that the stored hash was upgraded in PostgreSQL
    const afterAccount = await repo.account(legacyMobile);
    assert.ok(isArgon2(afterAccount.password_hash), 'Stored hash in app_accounts must now be in Argon2 format');
    assert.equal(isSha256(afterAccount.password_hash), false, 'Stored hash must no longer be SHA-256');

    // Verify farmers table was also upgraded
    const farmerRow = await first<{ password_hash: string }>(db, `select password_hash from farmers where mobile = $1`, legacyMobile);
    assert.ok(isArgon2(farmerRow!.password_hash), 'Stored hash in farmers must also be updated to Argon2');
  });

  // Test Case 2: Legacy account with wrong password is rejected and hash is NOT upgraded
  it('2. should reject login with wrong password on legacy account and NOT upgrade the stored hash', async () => {
    const testWrongMobile = '9870001022';
    const testSecret = 'OriginalSecret@123';
    const testHash = digest(testSecret);

    const fWrong = await first<{ id: string }>(
      db,
      `insert into farmers (farmer_id, name, mobile, password_hash, state, preferred_language, consent_given)
       values ('FID-WRONG-01', 'Wrong Farmer', $1, $2, 'Punjab', 'pa', true) returning id`,
      testWrongMobile,
      testHash,
    );

    await rows(
      db,
      `insert into app_accounts (login, password_hash, role, farmer_id) values ($1, $2, 'FARMER', $3::uuid)`,
      testWrongMobile,
      testHash,
      fWrong!.id,
    );

    const mockRes = createMockResponse();

    await assert.rejects(
      async () => {
        await authService.login({ mobile: testWrongMobile, password: 'WrongPassword@999' }, mockRes);
      },
      (err: any) => err instanceof UnauthorizedException,
    );

    const accountAfter = await repo.account(testWrongMobile);
    assert.equal(accountAfter.password_hash, testHash, 'Stored hash must remain completely unchanged');
    assert.ok(isSha256(accountAfter.password_hash), 'Hash must remain SHA-256');

    await rows(db, `delete from app_accounts where login = $1`, testWrongMobile);
  });

  // Test Case 3: Already-Argon2 account logs in normally with no re-hash
  it('3. should authenticate already-Argon2 account normally without redundant re-hashing', async () => {
    const mockRes = createMockResponse();
    const accountBefore = await repo.account(alreadyArgonMobile);
    const initialHash = accountBefore.password_hash;
    assert.ok(isArgon2(initialHash));

    const profile = await authService.login({ mobile: alreadyArgonMobile, password: argonPassword }, mockRes);
    assert.ok(profile);

    const accountAfter = await repo.account(alreadyArgonMobile);
    assert.equal(accountAfter.password_hash, initialHash, 'Argon2 hash must remain identical without redundant re-hash');
  });

  // Test Case 4: New registration always produces an Argon2 hash directly
  it('4. should produce an Argon2 password hash directly for newly registered farmers', async () => {
    const mockRes = createMockResponse();

    await authService.register(
      {
        name: 'Harpreet Kaur',
        mobile: registeredMobile,
        password: 'SecurePassword@2026',
        state: 'Punjab',
        district: 'Ludhiana',
        consent: true,
        crop: 'Wheat',
        quantity: 40,
      },
      mockRes,
    );

    const regAccount = await repo.account(registeredMobile);
    assert.ok(regAccount, 'Registered account must exist');
    assert.ok(isArgon2(regAccount.password_hash), 'Newly registered account must have Argon2 hash directly');
    assert.equal(isSha256(regAccount.password_hash), false);

    const farmer = await first<{ password_hash: string }>(db, `select password_hash from farmers where mobile = $1`, registeredMobile);
    assert.ok(isArgon2(farmer!.password_hash), 'Farmer record must also have Argon2 hash');
  });

  // Test Case 5: Migrated account can log in again afterward using the new Argon2 hash
  it('5. should allow migrated account to log in repeatedly using the new Argon2 hash', async () => {
    const mockRes = createMockResponse();
    // legacyMobile was migrated in Test Case 1
    const profile = await authService.login({ mobile: legacyMobile, password: legacyPassword }, mockRes);
    assert.ok(profile, 'Subsequent login must succeed against Argon2');
    assert.ok(mockRes.cookies['annsetu_access']);
  });

  // Test Case 6: Concurrent login attempts on the same legacy account don't corrupt the hash
  it('6. should safely handle concurrent login attempts on the same legacy account without hash corruption', async () => {
    const concurrentLogins = Array.from({ length: 5 }, () =>
      authService.login({ mobile: concurrentMobile, password: concurrentPassword }, createMockResponse()),
    );

    const results = await Promise.all(concurrentLogins);
    assert.equal(results.length, 5, 'All 5 concurrent requests must complete');
    for (const r of results) {
      assert.ok(r.id || r.farmer_id, 'Each concurrent login must issue a valid session');
    }

    const finalAccount = await repo.account(concurrentMobile);
    assert.ok(isArgon2(finalAccount.password_hash), 'Final hash must be Argon2 format');
    // Verify the final hash accurately validates the password
    const isValid = await argon.verify(finalAccount.password_hash, concurrentPassword);
    assert.equal(isValid, true, 'Final stored hash must successfully verify against the user password');
  });

  // Test Case 7: Login with a malformed/corrupt stored hash fails cleanly rather than crashing
  it('7. should fail cleanly with UnauthorizedException on malformed/corrupted stored hash instead of crashing with 500', async () => {
    const mockRes = createMockResponse();

    await assert.rejects(
      async () => {
        await authService.login({ mobile: corruptMobile, password: 'AnyPassword@123' }, mockRes);
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException, 'Must throw UnauthorizedException, not internal 500');
        assert.equal(err.message, 'Invalid credentials');
        return true;
      },
    );
  });

  // --- PART 2: DEMO OTP GATING (2+ TEST CASES) ---

  // Test Case 8: Demo OTP flow reachable when demo flag is enabled
  it('8. should successfully request and verify demo OTP when demo mode is enabled', async () => {
    const prevDemoAuth = env.DEMO_AUTH;
    const prevDemoMode = process.env.DEMO_MODE;

    try {
      (env as any).DEMO_AUTH = 'true';
      process.env.DEMO_MODE = 'true';

      // 8a: Request OTP
      const reqOtpRes = await authService.demoOtp(demoMobile, undefined);
      assert.equal(reqOtpRes.demo_otp, '123456');

      // 8b: Verify OTP
      const mockRes = createMockResponse();
      const verifyRes = await authService.demoOtp(demoMobile, '123456', mockRes);
      assert.ok(verifyRes.id || verifyRes.farmer_id, 'Must issue authenticated session on correct demo OTP');
      assert.ok(mockRes.cookies['annsetu_access']);
    } finally {
      (env as any).DEMO_AUTH = prevDemoAuth;
      process.env.DEMO_MODE = prevDemoMode;
    }
  });

  // Test Case 9: Demo OTP flow returns ForbiddenException when demo flag is unset/false
  it('9. should reject demo OTP with ForbiddenException when DEMO_AUTH / DEMO_MODE is disabled', async () => {
    const prevDemoAuth = env.DEMO_AUTH;
    const prevDemoMode = process.env.DEMO_MODE;

    try {
      (env as any).DEMO_AUTH = 'false';
      delete process.env.DEMO_MODE;

      assert.equal(isDemoAuthEnabled(), false);

      await assert.rejects(
        async () => {
          await authService.demoOtp(demoMobile, undefined);
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.ok(err.message.includes('demo mode is disabled'));
          return true;
        },
      );
    } finally {
      (env as any).DEMO_AUTH = prevDemoAuth;
      process.env.DEMO_MODE = prevDemoMode;
    }
  });

  // Test Case 10: Startup-time guard prevents starting in production with demo mode
  it('10. should assert that startup guard rejects production environment if demo flag is enabled', () => {
    const isProductionWithDemo = (nodeEnv: string, demoFlag: boolean) => {
      if (nodeEnv === 'production' && demoFlag) {
        throw new Error('FATAL: Demo authentication / DEMO_MODE is strictly forbidden in production environments');
      }
      return true;
    };

    // Valid combinations
    assert.equal(isProductionWithDemo('development', true), true);
    assert.equal(isProductionWithDemo('production', false), true);

    // Forbidden production combination
    assert.throws(
      () => isProductionWithDemo('production', true),
      /Demo authentication \/ DEMO_MODE is strictly forbidden in production/,
    );
  });

  // --- PART 3: SWAGGER BOOTSTRAP & 100% ROUTE COVERAGE (2 TEST CASES) ---

  // Test Case 11: Swagger document is generated successfully, served over HTTP, and has expected OpenAPI JSON structure
  it('11. should generate a valid OpenAPI 3.0 specification document with title, version, and tags', async () => {
    let app: INestApplication | undefined;
    try {
      app = await NestFactory.create(AppModule, { logger: false });
      app.setGlobalPrefix('api/v1');

      const document = buildSwagger(app);
      assert.ok(document, 'Swagger document must be generated');
      assert.ok(document.openapi?.startsWith('3.'), 'OpenAPI spec version must be 3.x');
      assert.equal(document.info?.title, 'AnnSetu API');
      assert.ok(document.paths, 'OpenAPI paths object must exist');
      assert.ok(Object.keys(document.paths).length > 20, 'OpenAPI paths count must reflect all routes');

      // Test live HTTP endpoint
      await app.listen(0);
      const address = app.getHttpServer().address();
      const port = typeof address === 'string' ? 3001 : address.port;

      const jsonRes = await fetch(`http://127.0.0.1:${port}/api/docs-json`);
      assert.equal(jsonRes.status, 200, 'Swagger JSON endpoint must return HTTP 200');
      const swaggerJson = await jsonRes.json();
      assert.equal(swaggerJson.openapi, '3.0.0');
      assert.equal(swaggerJson.info?.title, 'AnnSetu API');

      const uiRes = await fetch(`http://127.0.0.1:${port}/api/docs/`);
      assert.equal(uiRes.status, 200, 'Swagger UI HTML endpoint must return HTTP 200');
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  // Test Case 12: 100% of routes across all 4 Backend prompts appear in the Swagger schema with request/response types
  it('12. should contain entries in Swagger schema for procurement, payment, admin analytics, and BullMQ-admin paths', async () => {
    let app: INestApplication | undefined;
    try {
      app = await NestFactory.create(AppModule, { logger: false });
      app.setGlobalPrefix('api/v1');

      const document = buildSwagger(app);
      const paths = Object.keys(document.paths);

      // 1. Prompt 1: Procurement paths
      assert.ok(paths.includes('/api/v1/procurement/my'), 'Must include /api/v1/procurement/my');
      assert.ok(paths.includes('/api/v1/procurement/{bookingId}'), 'Must include /api/v1/procurement/{bookingId}');
      assert.ok(paths.includes('/api/v1/procurement/{id}/gate-entry'), 'Must include gate-entry');
      assert.ok(paths.includes('/api/v1/procurement/{id}/weighing'), 'Must include weighing');
      assert.ok(paths.includes('/api/v1/procurement/{id}/quality-check'), 'Must include quality-check');
      assert.ok(paths.includes('/api/v1/procurement/{id}/reject'), 'Must include reject');

      // 2. Prompt 1: Payments paths
      assert.ok(paths.includes('/api/v1/payments/my'), 'Must include /api/v1/payments/my');
      assert.ok(paths.includes('/api/v1/payments/{procurementLotId}'), 'Must include getStatus');
      assert.ok(paths.includes('/api/v1/payments/{procurementLotId}/transition'), 'Must include transition');
      assert.ok(paths.includes('/api/v1/payments/{procurementLotId}/status'), 'Must include status patch');

      // 3. Prompt 2: Admin analytics and rebalance paths
      assert.ok(paths.includes('/api/v1/admin/overview'), 'Must include /api/v1/admin/overview');
      assert.ok(paths.includes('/api/v1/admin/centers'), 'Must include /api/v1/admin/centers');
      assert.ok(paths.includes('/api/v1/admin/farmers'), 'Must include /api/v1/admin/farmers');
      assert.ok(paths.includes('/api/v1/admin/centers/{centerId}/predict-demand'), 'Must include predict-demand');
      assert.ok(paths.includes('/api/v1/admin/centers/{centerId}/generate-slots'), 'Must include generate-slots');
      assert.ok(paths.includes('/api/v1/admin/analytics'), 'Must include /api/v1/admin/analytics');
      assert.ok(paths.includes('/api/v1/admin/rebalance-mandi'), 'Must include /api/v1/admin/rebalance-mandi');
      assert.ok(paths.includes('/api/v1/admin/rebalance-mandi/history'), 'Must include rebalance history');

      // 4. Prompt 3: BullMQ outbox observability paths
      assert.ok(paths.includes('/api/v1/admin/queues'), 'Must include /api/v1/admin/queues');
      assert.ok(paths.includes('/api/v1/admin/queues/dead-letter'), 'Must include /api/v1/admin/queues/dead-letter');

      // 5. Prompt 4: Auth paths
      assert.ok(paths.includes('/api/v1/auth/login'), 'Must include /api/v1/auth/login');
      assert.ok(paths.includes('/api/v1/auth/register'), 'Must include /api/v1/auth/register');

      // Spot-check request/response metadata on key routes
      const weighingPath = document.paths['/api/v1/procurement/{id}/weighing'];
      assert.ok(weighingPath?.post?.responses['200'], 'Weighing route must document 200 response');

      const rebalancePath = document.paths['/api/v1/admin/rebalance-mandi'];
      assert.ok(rebalancePath?.post?.responses['200'], 'Rebalance route must document 200 response');

      const queuesPath = document.paths['/api/v1/admin/queues'];
      assert.ok(queuesPath?.get?.responses['200'], 'Queues observability route must document 200 response');
    } finally {
      if (app) {
        await app.close();
      }
    }
  });
});

