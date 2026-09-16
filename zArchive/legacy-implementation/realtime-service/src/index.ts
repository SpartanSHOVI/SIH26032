import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from './config/env.js';
import { setupQueueHandlers } from './services/queue.js';
import { logger } from './config/logger.js';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const pubClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
  lazyConnect: true,
});
const subClient = pubClient.duplicate();

pubClient.on('error', (err: Error) => logger.error('Redis pub client error', { err }));
subClient.on('error', (err: Error) => logger.error('Redis sub client error', { err }));

async function start(): Promise<void> {
  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    socket.on('join-center', (centerId: string) => {
      socket.join(`center:${centerId}`);
      logger.info('Client joined center room', { socketId: socket.id, centerId });
    });

    socket.on('leave-center', (centerId: string) => {
      socket.leave(`center:${centerId}`);
      logger.info('Client left center room', { socketId: socket.id, centerId });
    });

    socket.on('subscribe-farmer', (farmerId: string) => {
      socket.join(`farmer:${farmerId}`);
      logger.info('Client subscribed to farmer updates', { socketId: socket.id, farmerId });
    });

    socket.on('disconnect', (reason: string) => {
      logger.info('Client disconnected', { socketId: socket.id, reason });
    });
  });

  setupQueueHandlers(io, pubClient);

  httpServer.listen(env.PORT, () => {
    logger.info('Realtime service started', { port: env.PORT });
  });

  const healthCheck = () => {
    const redisStatus = pubClient.status === 'ready' ? 'ok' : 'degraded';
    return { status: redisStatus === 'ok' ? 'ok' : 'degraded', redis: redisStatus };
  };

  httpServer.on('request', (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const health = healthCheck();
      res.writeHead(health.status === 'ok' ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
    }
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await Promise.all([
      io.close(),
      pubClient.quit(),
      subClient.quit(),
    ]);
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await Promise.all([
      io.close(),
      pubClient.quit(),
      subClient.quit(),
    ]);
    process.exit(0);
  });
}

start().catch((err) => {
  logger.error('Failed to start realtime service', { err });
  process.exit(1);
});