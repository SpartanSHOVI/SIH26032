import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService, rows } from '../database/database.service';
import { DeadLetterJobDto, OutboxJobData, QueueMetricsResult } from './jobs.types';

@Injectable()
export class OutboxQueueService {
  constructor(
    @InjectQueue('outbox-dispatch') public readonly queue: Queue<OutboxJobData, any, string>,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  /**
   * Enqueue a single outbox event into BullMQ with deterministic deduplication
   */
  async enqueueOutboxRow(
    row: { id: string; event_type: string; aggregate_id: string; payload: any },
    options?: { simulateFailure?: boolean; attempts?: number; backoffDelay?: number },
  ) {
    const rawPayload = row.payload;
    const parsedPayload =
      typeof rawPayload === 'string' ? JSON.parse(rawPayload) : (rawPayload ?? {});

    return this.queue.add(
      row.event_type || 'OUTBOX_EVENT',
      {
        outboxId: row.id,
        eventType: row.event_type,
        aggregateId: row.aggregate_id,
        payload: parsedPayload,
        simulateFailure: options?.simulateFailure,
      },
      {
        jobId: row.id, // Idempotent deduplication by outbox event ID
        attempts: options?.attempts ?? 3,
        backoff: {
          type: 'exponential',
          delay: options?.backoffDelay ?? 500,
        },
        removeOnComplete: 1000,
        removeOnFail: false, // Keep failed jobs in dead-letter state!
      },
    );
  }

  /**
   * Poll pending rows from event_outbox and enqueue them into BullMQ
   * Replaces the unmonitored inline Redis publish in setInterval.
   */
  async pollAndEnqueuePending(limit = 100) {
    const pending = await rows<{ id: string; event_type: string; aggregate_id: string; payload: any }>(
      this.db,
      `select id, event_type, aggregate_id, payload
         from event_outbox
        where published_at is null and available_at <= now()
        order by created_at asc
        limit $1`,
      limit,
    );

    let enqueued = 0;
    for (const event of pending) {
      try {
        await this.enqueueOutboxRow(event);
        enqueued += 1;
      } catch (err: any) {
        // If job already exists in BullMQ (duplicate key), that's fine
        if (!String(err.message).includes('already exists')) {
          console.error(`Failed to enqueue outbox row ${event.id}:`, err);
        }
      }
    }

    return { pending: pending.length, enqueued };
  }

  /**
   * Inspect current queue depth and state counts
   */
  async getQueueMetrics(): Promise<QueueMetricsResult> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'prioritized',
    );
    const isPaused = await this.queue.isPaused().catch(() => false);
    const waiting = counts.waiting ?? 0;
    const active = counts.active ?? 0;
    const completed = counts.completed ?? 0;
    const failed = counts.failed ?? 0;
    const delayed = counts.delayed ?? 0;
    const paused = isPaused ? 1 : 0;

    return {
      queue_name: 'outbox-dispatch',
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      },
      total_depth: waiting + active + delayed,
      dead_letter_count: failed,
    };
  }

  /**
   * Retrieve queryable dead-letter (failed) jobs
   */
  async getDeadLetterJobs(limit = 50): Promise<DeadLetterJobDto[]> {
    const failed = await this.queue.getFailed(0, Math.max(0, limit - 1));
    return failed.map(j => ({
      job_id: j.id,
      name: j.name,
      outbox_id: j.data?.outboxId,
      event_type: j.data?.eventType,
      failed_reason: j.failedReason,
      attempts_made: j.attemptsMade,
      timestamp: j.timestamp,
      processed_on: j.processedOn,
      failed_on: j.finishedOn,
      data: j.data?.payload ?? {},
    }));
  }
}
