import { Server } from 'socket.io';
import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';

export interface QueueUpdateEvent {
  type: 'POSITION_UPDATE' | 'STATUS_CHANGE' | 'CALLED' | 'COMPLETED' | 'SKIPPED';
  centerId: string;
  farmerId?: string;
  bookingId?: string;
  queuePosition?: number;
  status?: string;
  estimatedWaitMinutes?: number;
  timestamp: string;
}

export interface FarmerQueueStatus {
  farmerId: string;
  bookingId: string;
  centerId: string;
  queuePosition: number;
  status: 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'NO_SHOW';
  estimatedWaitMinutes: number;
  lastUpdated: string;
}

const QUEUE_CHANNEL = 'queue:updates';
const FARMER_STATUS_KEY = 'farmer:status:';

export function setupQueueHandlers(io: Server, redis: Redis): void {
  const subscriber = redis.duplicate();
  subscriber.subscribe(QUEUE_CHANNEL, (err) => {
    if (err) {
      logger.error('Failed to subscribe to queue channel', { err });
    } else {
      logger.info('Subscribed to queue updates channel');
    }
  });

  subscriber.on('message', (channel: string, message: string) => {
    if (channel === QUEUE_CHANNEL) {
      try {
        const event: QueueUpdateEvent = JSON.parse(message);
        handleQueueEvent(io, event);
      } catch (err) {
        logger.error('Failed to parse queue event', { err, message });
      }
    }
  });

  io.on('connection', (socket) => {
    socket.on('get-queue-status', async (data: { farmerId: string }, callback) => {
      try {
        const status = await getFarmerQueueStatus(redis, data.farmerId);
        callback({ success: true, data: status });
      } catch (err) {
        logger.error('Failed to get queue status', { err, farmerId: data.farmerId });
        callback({ success: false, error: 'Failed to get queue status' });
      }
    });

    socket.on('get-center-queue', async (data: { centerId: string }, callback) => {
      try {
        const queue = await getCenterQueue(redis, data.centerId);
        callback({ success: true, data: queue });
      } catch (err) {
        logger.error('Failed to get center queue', { err, centerId: data.centerId });
        callback({ success: false, error: 'Failed to get center queue' });
      }
    });
  });
}

function handleQueueEvent(io: Server, event: QueueUpdateEvent): void {
  const room = `center:${event.centerId}`;
  io.to(room).emit('queue-update', event);

  if (event.farmerId) {
    const farmerRoom = `farmer:${event.farmerId}`;
    io.to(farmerRoom).emit('queue-update', event);
  }

  logger.debug('Broadcasted queue update', { event });
}

export async function publishQueueUpdate(redis: Redis, event: QueueUpdateEvent): Promise<void> {
  await redis.publish(QUEUE_CHANNEL, JSON.stringify(event));
}

export async function getFarmerQueueStatus(redis: Redis, farmerId: string): Promise<FarmerQueueStatus | null> {
  const key = `${FARMER_STATUS_KEY}${farmerId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setFarmerQueueStatus(redis: Redis, status: FarmerQueueStatus): Promise<void> {
  const key = `${FARMER_STATUS_KEY}${status.farmerId}`;
  await redis.set(key, JSON.stringify(status), 'EX', 86400);
}

export async function getCenterQueue(redis: Redis, centerId: string): Promise<FarmerQueueStatus[]> {
  const pattern = `${FARMER_STATUS_KEY}*`;
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return [];

  const pipeline = redis.mget(...keys);
  const results = await pipeline;

  const statuses: FarmerQueueStatus[] = [];
  for (const result of results) {
    if (result) {
      const status = JSON.parse(result) as FarmerQueueStatus;
      if (status.centerId === centerId) {
        statuses.push(status);
      }
    }
  }

  return statuses.sort((a, b) => a.queuePosition - b.queuePosition);
}

export async function calculateEstimatedWait(
  redis: Redis,
  centerId: string,
  position: number
): Promise<number> {
  const avgKey = `center:${centerId}:avg_wait`;
  const avg = await redis.get(avgKey);
  const avgMinutes = avg ? parseFloat(avg) : 5;
  return Math.round(position * avgMinutes);
}

export async function updateRollingAverage(redis: Redis, centerId: string, waitTime: number): Promise<void> {
  const avgKey = `center:${centerId}:avg_wait`;
  const current = await redis.get(avgKey);
  const currentAvg = current ? parseFloat(current) : 5;
  const newAvg = currentAvg * 0.9 + waitTime * 0.1;
  await redis.set(avgKey, newAvg.toFixed(2));
}