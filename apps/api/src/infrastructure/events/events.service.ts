import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { queueEventSchema } from '@annsetu/contracts';
import { DatabaseService, rows, Tx } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { OutboxQueueService } from '../jobs/outbox-queue.service';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Optional() @Inject(OutboxQueueService) private readonly outboxQueue?: OutboxQueueService,
  ) {}

  async enqueue(db: Tx | DatabaseService, event: Record<string, unknown>) {
    const payload = queueEventSchema.parse({
      version: 1,
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    });
    await rows(
      db,
      'insert into event_outbox (id, event_type, aggregate_id, payload) values ($1, $2, $3, $4::jsonb)',
      payload.eventId,
      payload.type,
      String(payload.centerId ?? payload.tokenNumber ?? payload.eventId),
      JSON.stringify(payload),
    );
    return payload;
  }

  /**
   * Dispatches pending event_outbox rows via BullMQ outbox-dispatch queue
   */
  async dispatch(limit = 100) {
    if (this.outboxQueue) {
      const result = await this.outboxQueue.pollAndEnqueuePending(limit);
      return { pending: result.pending, published: result.enqueued };
    }

    // Direct fallback if queue processor not available
    const pending = await rows<{ id: string; payload: unknown }>(
      this.db,
      `select id, payload
         from event_outbox
        where published_at is null and available_at <= now()
        order by created_at
        limit $1`,
      limit,
    );

    let published = 0;
    for (const event of pending) {
      try {
        await this.redis.publish('queue:updates', JSON.stringify(event.payload));
        await rows(this.db, 'update event_outbox set published_at = now() where id = $1', event.id);
        published += 1;
      } catch {
        await rows(
          this.db,
          `update event_outbox
              set attempts = attempts + 1,
                  available_at = now() + make_interval(secs => least(300, power(2, attempts)::int))
            where id = $1`,
          event.id,
        );
      }
    }
    return { pending: pending.length, published };
  }
}
