import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';
import { DatabaseService, first, rows } from '../src/infrastructure/database/database.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { EventsService } from '../src/infrastructure/events/events.service';
import { AuditService } from '../src/infrastructure/audit/audit.service';
import { OutboxProcessor } from '../src/infrastructure/jobs/outbox.processor';
import { OutboxQueueService } from '../src/infrastructure/jobs/outbox-queue.service';
import { AdminService } from '../src/modules/admin/admin.service';
import { env } from '../src/config/env';

async function waitFor(fn: () => Promise<boolean>, timeoutMs = 10000, intervalMs = 50): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout after ${timeoutMs}ms waiting for condition`);
}

describe('BullMQ Outbox Dispatch Integration & Burst Tests', () => {
  let db: DatabaseService;
  let redis: RedisService;
  let events: EventsService;
  let audit: AuditService;
  let processor: OutboxProcessor;
  let outboxQueueService: OutboxQueueService;
  let adminService: AdminService;
  let queue: Queue;
  let worker: Worker;
  let subscriberRedis: Redis;

  const testFarmerId = '99999999-1111-2222-3333-444444444441';
  const testFarmerCode = 'FID-BULLMQ-TEST-01';

  const redisUrl = new URL(env.REDIS_URL);
  const redisConnection = {
    host: redisUrl.hostname || 'localhost',
    port: redisUrl.port ? Number(redisUrl.port) : 6379,
    password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
    username: redisUrl.username ? decodeURIComponent(redisUrl.username) : undefined,
    maxRetriesPerRequest: null,
  };

  before(async () => {
    db = new DatabaseService();
    redis = new RedisService();
    events = new EventsService(db);
    audit = new AuditService(db);
    processor = new OutboxProcessor(db, redis);

    // Dedicated BullMQ queue instance
    queue = new Queue('outbox-dispatch', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 50 },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    });

    // Wipe any leftover test jobs from Redis
    try {
      await queue.obliterate({ force: true });
    } catch {
      await queue.drain();
    }

    outboxQueueService = new OutboxQueueService(queue as any, db);
    adminService = new AdminService(db, events, audit, outboxQueueService);

    // Initialize BullMQ Worker driving OutboxProcessor
    worker = new Worker(
      'outbox-dispatch',
      async (job: Job) => {
        return processor.process(job as any);
      },
      {
        connection: redisConnection,
        concurrency: 10,
      },
    );

    worker.on('failed', (job, err) => {
      if (job) {
        processor.onJobFailed(job as any, err);
      }
    });

    // Dedicated ioredis subscriber for verifying realtime broadcasts
    subscriberRedis = new Redis(env.REDIS_URL);

    // Insert test farmer record for notification tests
    await rows(
      db,
      `insert into farmers (id, farmer_id, name, state_code, preferred_language, consent_given)
       values ($1::uuid, $2, 'BullMQ Test Farmer', 'PB', 'pa', true)
       on conflict (id) do update set name = excluded.name`,
      testFarmerId,
      testFarmerCode,
    );
  });

  after(async () => {
    if (worker) await worker.close();
    if (queue) {
      try {
        await queue.obliterate({ force: true });
      } catch {
        // ignore obliterate error on teardown
      }
      await queue.close();
    }
    if (subscriberRedis) await subscriberRedis.quit();

    // Clean up test database records
    await rows(db, `delete from notifications where farmer_id = $1::uuid`, testFarmerId);
    await rows(db, `delete from farmers where id = $1::uuid`, testFarmerId);
    await rows(db, `delete from event_outbox where aggregate_id like 'test-bullmq-%'`);

    await redis.onModuleDestroy();
    await db.onModuleDestroy();
  });

  // Test Case 1: Job enqueued on new outbox row
  it('1. should enqueue a BullMQ job for a pending event_outbox row', async () => {
    const outboxId = randomUUID();
    const aggregateId = 'test-bullmq-enqueue-01';

    await rows(
      db,
      `insert into event_outbox (id, event_type, aggregate_id, payload, attempts, available_at)
       values ($1::uuid, 'TOKEN_GENERATED', $2, $3::jsonb, 0, now())`,
      outboxId,
      aggregateId,
      JSON.stringify({ tokenNumber: 'TK-1001', centerId: 'c1', status: 'BOOKED' }),
    );

    const pollResult = await outboxQueueService.pollAndEnqueuePending(10);
    assert.ok(pollResult.enqueued >= 1, 'Expected at least 1 job to be enqueued');

    const job = await queue.getJob(outboxId);
    assert.ok(job, 'Expected BullMQ job to exist in queue');
    assert.equal(job.data.outboxId, outboxId);
    assert.equal(job.data.eventType, 'TOKEN_GENERATED');
    assert.equal(job.data.payload.tokenNumber, 'TK-1001');
  });

  // Test Case 2: Job processed successfully and marks the row dispatched
  it('2. should process job successfully and mark event_outbox row dispatched (published_at not null)', async () => {
    const outboxId = randomUUID();
    const aggregateId = 'test-bullmq-success-02';

    await rows(
      db,
      `insert into event_outbox (id, event_type, aggregate_id, payload, attempts, available_at)
       values ($1::uuid, 'QUEUE_PROGRESS', $2, $3::jsonb, 0, now())`,
      outboxId,
      aggregateId,
      JSON.stringify({ tokenNumber: 'TK-1002', centerId: 'c1', status: 'CALLED' }),
    );

    await outboxQueueService.enqueueOutboxRow({
      id: outboxId,
      event_type: 'QUEUE_PROGRESS',
      aggregate_id: aggregateId,
      payload: { tokenNumber: 'TK-1002', centerId: 'c1', status: 'CALLED' },
    });

    await waitFor(async () => {
      const row = await first<{ published_at: Date | null; attempts: number }>(
        db,
        `select published_at, attempts from event_outbox where id = $1::uuid`,
        outboxId,
      );
      return Boolean(row?.published_at);
    }, 8000);

    const updated = await first<{ published_at: Date | null; attempts: number }>(
      db,
      `select published_at, attempts from event_outbox where id = $1::uuid`,
      outboxId,
    );

    assert.ok(updated?.published_at !== null, 'event_outbox.published_at must be populated');
    assert.ok((updated?.attempts ?? 0) >= 1, 'event_outbox.attempts must be recorded');
  });

  // Test Case 3: Job retries on simulated transient failure (assert retry attempt count)
  it('3. should retry job with exponential backoff on simulated transient failure and succeed on attempt 3', async () => {
    const outboxId = randomUUID();
    const aggregateId = 'test-bullmq-retry-03';

    await rows(
      db,
      `insert into event_outbox (id, event_type, aggregate_id, payload, attempts, available_at)
       values ($1::uuid, 'RETRY_TEST_EVENT', $2, $3::jsonb, 0, now())`,
      outboxId,
      aggregateId,
      JSON.stringify({ tokenNumber: 'TK-1003', transient: true }),
    );

    const job = await outboxQueueService.enqueueOutboxRow(
      {
        id: outboxId,
        event_type: 'RETRY_TEST_EVENT',
        aggregate_id: aggregateId,
        payload: { tokenNumber: 'TK-1003', transient: true },
      },
      {
        simulateFailure: true,
        attempts: 3,
        backoffDelay: 50,
      },
    );

    // Wait for the job to complete after transient retries
    await waitFor(async () => {
      const j = await queue.getJob(outboxId);
      const isCompleted = await j?.isCompleted();
      return Boolean(isCompleted);
    }, 10000);

    const finalJob = await queue.getJob(outboxId);
    assert.ok(finalJob, 'Job must exist');
    // It completed after 3 attempts
    assert.equal(finalJob.attemptsMade, 3, 'Job must record 3 total attempts upon completion on 3rd try');

    const outboxRow = await first<{ published_at: Date | null; attempts: number }>(
      db,
      `select published_at, attempts from event_outbox where id = $1::uuid`,
      outboxId,
    );
    assert.ok(outboxRow?.published_at !== null, 'published_at must be marked after retry success');
    assert.equal(outboxRow?.attempts, 3, 'attempts count in event_outbox must equal 3');
  });

  // Test Case 4: Job lands in dead-letter after exhausting retries
  it('4. should land in dead-letter state after exhausting retries without silently dropping', async () => {
    const outboxId = randomUUID();
    const aggregateId = 'test-bullmq-fail-04';

    await rows(
      db,
      `insert into event_outbox (id, event_type, aggregate_id, payload, attempts, available_at)
       values ($1::uuid, 'FAIL_DEAD_LETTER', $2, $3::jsonb, 0, now())`,
      outboxId,
      aggregateId,
      JSON.stringify({ forceFail: true }),
    );

    await outboxQueueService.enqueueOutboxRow(
      {
        id: outboxId,
        event_type: 'FAIL_DEAD_LETTER',
        aggregate_id: aggregateId,
        payload: { forceFail: true },
      },
      {
        attempts: 3,
        backoffDelay: 40,
      },
    );

    // Wait until job is in failed set
    await waitFor(async () => {
      const j = await queue.getJob(outboxId);
      const isFailed = await j?.isFailed();
      return Boolean(isFailed);
    }, 10000);

    const deadLetters = await outboxQueueService.getDeadLetterJobs(50);
    const deadJob = deadLetters.find((d) => d.outbox_id === outboxId);

    assert.ok(deadJob, 'Failed job must be present in dead-letter listing');
    assert.equal(deadJob.attempts_made, 3, 'Dead-letter job must have exhausted all 3 attempts');
    assert.ok(
      deadJob.failed_reason?.includes('Unrecoverable downstream processing failure'),
      'Failure reason must be recorded in dead-letter job',
    );
  });

  // Test Case 5: Queue depth counts are queryable and accurate
  it('5. should provide accurate and queryable queue depth counts and dead-letter endpoint', async () => {
    const metrics = await outboxQueueService.getQueueMetrics();
    assert.equal(metrics.queue_name, 'outbox-dispatch');
    assert.ok(metrics.counts.completed >= 2, 'Completed count should include previous successful jobs');
    assert.ok(metrics.dead_letter_count >= 1, 'Dead letter count should reflect failed jobs');
    assert.equal(typeof metrics.total_depth, 'number');

    // Also verify through AdminService
    const adminMetrics = await adminService.getQueues();
    assert.equal(adminMetrics.queue_name, 'outbox-dispatch');
    assert.equal(adminMetrics.dead_letter_count, metrics.dead_letter_count);

    const deadLetterList = await adminService.getDeadLetterJobs(10);
    assert.ok(Array.isArray(deadLetterList));
    assert.ok(deadLetterList.length >= 1);
  });

  // Test Case 6: SMS-type job routes to the SMS handler
  it('6. should route SMS_CONFIRMATION jobs to SMS handler and persist delivered notification', async () => {
    const outboxId = randomUUID();
    const aggregateId = 'test-bullmq-sms-06';

    const testPayload = {
      farmerId: testFarmerId,
      mobile: '+919876543210',
      tokenNumber: 'SMS-777',
      status: 'CONFIRMED',
      message: 'Farmer token SMS-777 confirmed at Mandi Ludhiana',
    };

    await rows(
      db,
      `insert into event_outbox (id, event_type, aggregate_id, payload, attempts, available_at)
       values ($1::uuid, 'SMS_CONFIRMATION', $2, $3::jsonb, 0, now())`,
      outboxId,
      aggregateId,
      JSON.stringify(testPayload),
    );

    await outboxQueueService.enqueueOutboxRow({
      id: outboxId,
      event_type: 'SMS_CONFIRMATION',
      aggregate_id: aggregateId,
      payload: testPayload,
    });

    await waitFor(async () => {
      const notif = await first<{ id: string; status: string; channel: string }>(
        db,
        `select id, status, channel from notifications where farmer_id = $1::uuid and channel = 'SMS'`,
        testFarmerId,
      );
      return Boolean(notif);
    }, 8000);

    const notif = await first<{ id: string; status: string; channel: string; message: string }>(
      db,
      `select id, status, channel, message from notifications where farmer_id = $1::uuid and channel = 'SMS' order by created_at desc limit 1`,
      testFarmerId,
    );

    assert.ok(notif, 'SMS notification row must be persisted in database');
    assert.equal(notif.channel, 'SMS');
    assert.equal(notif.status, 'DELIVERED');
    assert.ok(notif.message.includes('SMS-777'));
  });

  // Test Case 7: USSD/IVR-type job routes to the correct handler
  it('7. should route USSD_NOTIFICATION and IVR_CALL jobs to respective handlers and persist voice alerts', async () => {
    const outboxIdUssd = randomUUID();
    const outboxIdIvr = randomUUID();

    // 7a: USSD notification
    await outboxQueueService.enqueueOutboxRow({
      id: outboxIdUssd,
      event_type: 'USSD_NOTIFICATION',
      aggregate_id: 'test-bullmq-ussd-07a',
      payload: {
        farmerId: testFarmerId,
        channel: 'USSD',
        tokenNumber: 'USSD-888',
        status: 'READY_AT_GATE',
      },
    });

    // 7b: IVR voice call
    await outboxQueueService.enqueueOutboxRow({
      id: outboxIdIvr,
      event_type: 'IVR_CALL',
      aggregate_id: 'test-bullmq-ivr-07b',
      payload: {
        farmerId: testFarmerId,
        channel: 'IVR',
        tokenNumber: 'IVR-999',
        status: 'TOKEN_CALLED_BOOTH_2',
      },
    });

    await waitFor(async () => {
      const ussdNotif = await first(
        db,
        `select id from notifications where farmer_id = $1::uuid and channel = 'USSD'`,
        testFarmerId,
      );
      const ivrNotif = await first(
        db,
        `select id from notifications where farmer_id = $1::uuid and channel = 'IVR'`,
        testFarmerId,
      );
      return Boolean(ussdNotif && ivrNotif);
    }, 8000);

    const ussdNotif = await first<{ channel: string; status: string }>(
      db,
      `select channel, status from notifications where farmer_id = $1::uuid and channel = 'USSD' limit 1`,
      testFarmerId,
    );
    const ivrNotif = await first<{ channel: string; status: string }>(
      db,
      `select channel, status from notifications where farmer_id = $1::uuid and channel = 'IVR' limit 1`,
      testFarmerId,
    );

    assert.ok(ussdNotif, 'USSD notification must be stored');
    assert.equal(ussdNotif.channel, 'USSD');
    assert.equal(ussdNotif.status, 'DELIVERED');

    assert.ok(ivrNotif, 'IVR notification must be stored');
    assert.equal(ivrNotif.channel, 'IVR');
    assert.equal(ivrNotif.status, 'DELIVERED');
  });

  // Test Case 8: Socket broadcast still fires after successful dispatch (realtime path not broken)
  it('8. should fire Redis pub/sub queue:updates broadcast on job dispatch to maintain Socket.IO realtime path', async () => {
    const outboxId = randomUUID();
    const aggregateId = 'test-bullmq-realtime-08';
    const testBroadcastPayload = {
      centerId: 'center-ludhiana-01',
      tokenNumber: 'RT-1234',
      queuePosition: 4,
      status: 'CALLED',
      broadcastNonce: randomUUID(),
    };

    let receivedMessage: any = null;

    await subscriberRedis.subscribe('queue:updates');
    const messagePromise = new Promise<void>((resolve) => {
      subscriberRedis.on('message', (channel, msg) => {
        if (channel === 'queue:updates') {
          try {
            const parsed = JSON.parse(msg);
            if (parsed.broadcastNonce === testBroadcastPayload.broadcastNonce) {
              receivedMessage = parsed;
              resolve();
            }
          } catch {
            // ignore non-json
          }
        }
      });
    });

    await outboxQueueService.enqueueOutboxRow({
      id: outboxId,
      event_type: 'QUEUE_POSITION_CHANGED',
      aggregate_id: aggregateId,
      payload: testBroadcastPayload,
    });

    await Promise.race([
      messagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for queue:updates pub/sub message')), 8000)),
    ]);

    // Ensure Test 8's job has fully transitioned to completed
    await waitFor(async () => {
      const j = await queue.getJob(outboxId);
      return Boolean(await j?.isCompleted());
    }, 5000);

    await subscriberRedis.unsubscribe('queue:updates');

    assert.ok(receivedMessage, 'Must receive broadcast on queue:updates channel');
    assert.equal(receivedMessage.centerId, 'center-ludhiana-01');
    assert.equal(receivedMessage.queuePosition, 4);
    assert.equal(receivedMessage.tokenNumber, 'RT-1234');
  });

  // Test Case 9 (Burst Test): Enqueue 100 jobs in quick succession and verify 100% processed or dead-lettered
  it('9. [BURST TEST] should enqueue 100 jobs in quick succession and ensure 100% are processed or dead-lettered with 0 jobs lost', async () => {
    const totalBurstJobs = 100;
    const transientCount = 10;
    const intentionalFailCount = 5;
    const normalCount = totalBurstJobs - transientCount - intentionalFailCount; // 85

    const burstJobIds: string[] = [];
    const burstPromises: Promise<any>[] = [];

    // Enqueue 85 normal jobs
    for (let i = 0; i < normalCount; i++) {
      const outboxId = randomUUID();
      burstJobIds.push(outboxId);
      burstPromises.push(
        outboxQueueService.enqueueOutboxRow({
          id: outboxId,
          event_type: 'BURST_NORMAL_EVENT',
          aggregate_id: `test-bullmq-burst-norm-${i}`,
          payload: { batchIndex: i, type: 'NORMAL' },
        }),
      );
    }

    // Enqueue 10 transient-failure jobs (will retry twice, succeed on attempt 3)
    for (let i = 0; i < transientCount; i++) {
      const outboxId = randomUUID();
      burstJobIds.push(outboxId);
      burstPromises.push(
        outboxQueueService.enqueueOutboxRow(
          {
            id: outboxId,
            event_type: 'BURST_TRANSIENT_EVENT',
            aggregate_id: `test-bullmq-burst-trans-${i}`,
            payload: { batchIndex: i, type: 'TRANSIENT' },
          },
          {
            simulateFailure: true,
            attempts: 3,
            backoffDelay: 30,
          },
        ),
      );
    }

    // Enqueue 5 intentional fail jobs (exhaust retries -> dead-letter)
    for (let i = 0; i < intentionalFailCount; i++) {
      const outboxId = randomUUID();
      burstJobIds.push(outboxId);
      burstPromises.push(
        outboxQueueService.enqueueOutboxRow(
          {
            id: outboxId,
            event_type: 'FAIL_DEAD_LETTER',
            aggregate_id: `test-bullmq-burst-fail-${i}`,
            payload: { batchIndex: i, forceFail: true },
          },
          {
            attempts: 3,
            backoffDelay: 30,
          },
        ),
      );
    }

    // Enqueue all 100 in parallel burst
    await Promise.all(burstPromises);

    // Wait until all 100 jobs have completed their lifecycles
    await waitFor(
      async () => {
        let completed = 0;
        let failed = 0;
        for (const id of burstJobIds) {
          const j = await queue.getJob(id);
          if (await j?.isCompleted()) completed++;
          else if (await j?.isFailed()) failed++;
        }
        return completed + failed === totalBurstJobs;
      },
      15000,
      100,
    );

    let completedCount = 0;
    let failedCount = 0;
    for (const id of burstJobIds) {
      const j = await queue.getJob(id);
      if (await j?.isCompleted()) completedCount++;
      else if (await j?.isFailed()) failedCount++;
    }

    // Assert exact accounting:
    // 85 normal + 10 transient (which retried and succeeded) = 95 completed
    // 5 intentional fails = 5 failed
    assert.equal(completedCount, normalCount + transientCount, 'Completed burst jobs count mismatch');
    assert.equal(failedCount, intentionalFailCount, 'Failed (dead-letter) burst jobs count mismatch');
    assert.equal(completedCount + failedCount, 100, 'Total processed jobs must equal exactly 100');

    const endMetrics = await outboxQueueService.getQueueMetrics();
    assert.equal(endMetrics.counts.waiting, 0, 'Waiting queue depth must be drained to 0');
    assert.equal(endMetrics.counts.active, 0, 'Active queue count must be 0');
    assert.equal(endMetrics.counts.delayed, 0, 'Delayed retry queue count must be 0');
  });

  // Test Case 10 (Production-Scale Burst Test): Enqueue 500 jobs with 10% intentional failure variant
  it('10. [PRODUCTION-SCALE BURST TEST] should enqueue 500 jobs with 10% intentional failure and verify zero job loss and queryable dead-letter queue', async () => {
    const totalBurstJobs = 500;
    const intentionalFailCount = 50; // exactly 10%
    const transientCount = 50;       // retry and recover
    const normalCount = totalBurstJobs - transientCount - intentionalFailCount; // 400

    const burstJobIds: string[] = [];
    const burstPromises: Promise<any>[] = [];

    // Enqueue 400 normal notification jobs
    for (let i = 0; i < normalCount; i++) {
      const outboxId = randomUUID();
      burstJobIds.push(outboxId);
      burstPromises.push(
        outboxQueueService.enqueueOutboxRow({
          id: outboxId,
          event_type: 'BURST_500_NORMAL_EVENT',
          aggregate_id: `test-bullmq-burst500-norm-${i}`,
          payload: { batchIndex: i, type: 'NORMAL_500' },
        }),
      );
    }

    // Enqueue 50 transient-failure jobs (will retry twice, succeed on attempt 3)
    for (let i = 0; i < transientCount; i++) {
      const outboxId = randomUUID();
      burstJobIds.push(outboxId);
      burstPromises.push(
        outboxQueueService.enqueueOutboxRow(
          {
            id: outboxId,
            event_type: 'BURST_500_TRANSIENT_EVENT',
            aggregate_id: `test-bullmq-burst500-trans-${i}`,
            payload: { batchIndex: i, type: 'TRANSIENT_500' },
          },
          {
            simulateFailure: true,
            attempts: 3,
            backoffDelay: 20,
          },
        ),
      );
    }

    // Enqueue 50 intentional fail jobs (exhaust retries -> dead-letter)
    for (let i = 0; i < intentionalFailCount; i++) {
      const outboxId = randomUUID();
      burstJobIds.push(outboxId);
      burstPromises.push(
        outboxQueueService.enqueueOutboxRow(
          {
            id: outboxId,
            event_type: 'FAIL_500_DEAD_LETTER',
            aggregate_id: `test-bullmq-burst500-fail-${i}`,
            payload: { batchIndex: i, forceFail: true },
          },
          {
            attempts: 3,
            backoffDelay: 20,
          },
        ),
      );
    }

    // Enqueue all 500 in parallel burst
    await Promise.all(burstPromises);

    // Wait until all 500 jobs have completed their lifecycles
    await waitFor(
      async () => {
        let completed = 0;
        let failed = 0;
        for (const id of burstJobIds) {
          const j = await queue.getJob(id);
          if (await j?.isCompleted()) completed++;
          else if (await j?.isFailed()) failed++;
        }
        return completed + failed === totalBurstJobs;
      },
      30000,
      200,
    );

    let completedCount = 0;
    let failedCount = 0;
    for (const id of burstJobIds) {
      const j = await queue.getJob(id);
      if (await j?.isCompleted()) completedCount++;
      else if (await j?.isFailed()) failedCount++;
    }

    // Assert exact accounting (zero job loss)
    assert.equal(completedCount, normalCount + transientCount, 'Completed 500-burst jobs count mismatch');
    assert.equal(failedCount, intentionalFailCount, 'Failed (dead-letter) 500-burst jobs count mismatch');
    assert.equal(completedCount + failedCount, 500, 'Total processed jobs must equal exactly 500 with zero job loss');

    // Verify dead-letter jobs are queryable via OutboxQueueService / Admin observability
    const deadLetters = await outboxQueueService.getDeadLetterJobs(100);
    assert.ok(deadLetters.length >= intentionalFailCount, 'Dead-letter jobs must be queryable via DLQ endpoint');
    const intentionalFailIdSet = new Set(burstJobIds.slice(normalCount + transientCount));
    const matchedDeadLetters = deadLetters.filter((dl: any) => intentionalFailIdSet.has(dl.outbox_id || dl.job_id));
    assert.equal(matchedDeadLetters.length, intentionalFailCount, 'All 50 intentionally-failed jobs must exist in dead-letter list');

    const endMetrics = await outboxQueueService.getQueueMetrics();
    assert.equal(endMetrics.counts.waiting, 0, 'Waiting queue depth must be drained to 0');
    assert.equal(endMetrics.counts.active, 0, 'Active queue count must be 0');
    assert.equal(endMetrics.counts.delayed, 0, 'Delayed retry queue count must be 0');
  });
});

