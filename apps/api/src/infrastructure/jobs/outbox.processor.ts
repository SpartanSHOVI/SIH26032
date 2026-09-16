import { Inject } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DatabaseService, rows } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { OutboxJobData } from './jobs.types';

@Processor('outbox-dispatch', {
  concurrency: 5,
})
export class OutboxProcessor extends WorkerHost {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<OutboxJobData, any, string>): Promise<any> {
    const { outboxId, eventType, payload, simulateFailure } = job.data;

    // Permanent failure simulation for dead-letter verification tests
    if (eventType === 'FAIL_DEAD_LETTER' || payload?.forceFail) {
      throw new Error('Unrecoverable downstream processing failure');
    }

    // Transient failure simulation for automated retry verification tests
    if (simulateFailure && job.attemptsMade < 2) {
      throw new Error(`Simulated transient network failure on attempt ${job.attemptsMade + 1}`);
    }

    let routeResult: any = null;

    // 1. Route SMS-confirmation sends
    if (
      eventType === 'SMS_CONFIRMATION' ||
      eventType === 'SMS_ALERT' ||
      payload?.channel === 'SMS' ||
      payload?.booked_via === 'SMS'
    ) {
      routeResult = await this.handleSmsConfirmation(job);
    }
    // 2. Route USSD / IVR simulated notification sends
    else if (
      eventType === 'USSD_ALERT' ||
      eventType === 'USSD_NOTIFICATION' ||
      eventType === 'IVR_CALL' ||
      eventType === 'VOICE_OBD' ||
      payload?.channel === 'USSD' ||
      payload?.channel === 'IVR'
    ) {
      routeResult = await this.handleUssdVrNotification(job);
    }
    // 3. Route PFMS mock-status polling
    else if (
      eventType === 'PFMS_POLL' ||
      eventType === 'PFMS_STATUS_CHECK' ||
      (eventType === 'PAYMENT_UPDATED' && String(payload?.status).toUpperCase() === 'PROCESSING')
    ) {
      routeResult = await this.handlePfmsPolling(job);
    }

    // 4. Live Queue Update: Broadcast to Redis pub/sub channel 'queue:updates'
    // This feeds QueueGateway so real-time Socket.IO room broadcasts fire reliably!
    await this.redis.publish('queue:updates', JSON.stringify(payload ?? {}));

    // 5. Mark event_outbox row as dispatched in PostgreSQL
    if (outboxId) {
      await rows(
        this.db,
        `update event_outbox
            set published_at = now(),
                attempts = $1
          where id = $2`,
        job.attemptsMade + 1,
        outboxId,
      );
    }

    return {
      dispatched: true,
      outboxId,
      eventType,
      routeResult,
      timestamp: new Date().toISOString(),
    };
  }

  private async handleSmsConfirmation(job: Job<OutboxJobData>) {
    const { payload } = job.data;
    const recipient = payload?.mobile || payload?.farmerId || 'UNKNOWN';
    const message =
      payload?.message ||
      `Token ${payload?.tokenNumber ?? ''} status update: ${payload?.status ?? 'CONFIRMED'}`;

    if (payload?.farmerId) {
      await rows(
        this.db,
        `insert into notifications (id, farmer_id, channel, message, notification_type, status, created_at)
         values (gen_random_uuid(), $1::uuid, 'SMS', $2, 'SMS_CONFIRMATION', 'DELIVERED', now())`,
        payload.farmerId,
        message,
      ).catch(() => undefined);
    }

    return {
      channel: 'SMS',
      status: 'DELIVERED',
      recipient,
      message,
    };
  }

  private async handleUssdVrNotification(job: Job<OutboxJobData>) {
    const { payload, eventType } = job.data;
    const channel = (eventType && eventType.includes('IVR')) || payload?.channel === 'IVR' ? 'IVR' : 'USSD';
    const recipient = payload?.mobile || payload?.farmerId || 'UNKNOWN';
    const message =
      payload?.message ||
      `USSD/IVR alert for token ${payload?.tokenNumber ?? ''}: ${payload?.status ?? ''}`;

    if (payload?.farmerId) {
      await rows(
        this.db,
        `insert into notifications (id, farmer_id, channel, message, notification_type, status, created_at)
         values (gen_random_uuid(), $1::uuid, $2, $3, 'VOICE_ALERT', 'DELIVERED', now())`,
        payload.farmerId,
        channel,
        message,
      ).catch(() => undefined);
    }

    return {
      channel,
      status: 'DISPATCHED',
      recipient,
      dtmf_ready: true,
    };
  }

  private async handlePfmsPolling(job: Job<OutboxJobData>) {
    const { payload } = job.data;
    return {
      gateway: 'PFMS-DBT-DIRECT',
      status: 'POLL_SUCCESS',
      utr_number: payload?.utrReference || payload?.transactionRef || 'PFMS_MOCK',
      settlement_verified: true,
    };
  }

  @OnWorkerEvent('failed')
  async onJobFailed(job: Job<OutboxJobData>, err: Error) {
    if (job.data?.outboxId) {
      await rows(
        this.db,
        `update event_outbox
            set attempts = $1,
                available_at = now() + make_interval(secs => least(300, power(2, $1)::int))
          where id = $2`,
        job.attemptsMade,
        job.data.outboxId,
      ).catch(() => undefined);
    }
  }
}
