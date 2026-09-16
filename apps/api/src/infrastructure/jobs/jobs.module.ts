import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { env } from '../../config/env';
import { DatabaseModule } from '../database/database.service';
import { RedisModule } from '../redis/redis.service';
import { OutboxProcessor } from './outbox.processor';
import { OutboxQueueService } from './outbox-queue.service';

const redisUrl = new URL(env.REDIS_URL);
const redisConnection = {
  host: redisUrl.hostname || 'localhost',
  port: redisUrl.port ? Number(redisUrl.port) : 6379,
  password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
  username: redisUrl.username ? decodeURIComponent(redisUrl.username) : undefined,
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
};

@Global()
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    BullModule.forRoot({
      connection: redisConnection,
    }),
    BullModule.registerQueue({
      name: 'outbox-dispatch',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 500,
        },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    }),
  ],
  providers: [OutboxProcessor, OutboxQueueService],
  exports: [BullModule, OutboxQueueService],
})
export class JobsModule {}
