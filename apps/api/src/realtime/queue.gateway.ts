import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { env } from '../config/env';

@WebSocketGateway({
  namespace: '/queue',
  cors: {
    origin: env.NODE_ENV === 'production' ? [env.APP_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'] : true,
    credentials: true,
  },
})
export class QueueGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;
  private subscriber?: Redis;

  async onModuleInit() {
    this.subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: true });
    this.subscriber.on('message', (_channel, raw) => {
      try {
        const event = JSON.parse(raw);
        if (event.centerId) this.server.to(`center:${event.centerId}`).emit('queue:update', event);
        if (event.farmerId) this.server.to(`farmer:${event.farmerId}`).emit('queue:update', event);
        this.server.emit('queue:update', event);
      } catch {
        // Ignore malformed external pub/sub payloads.
      }
    });
    if (this.subscriber.status !== 'ready') {
      await new Promise<void>((resolve, reject) => {
        this.subscriber?.once('ready', resolve);
        this.subscriber?.once('error', reject);
      });
    }
    await this.subscriber.subscribe('queue:updates');
  }

  async onModuleDestroy() {
    this.subscriber?.disconnect();
  }

  @SubscribeMessage('join:center')
  joinCenter(@ConnectedSocket() socket: Socket, @MessageBody() centerId: string) {
    socket.join(`center:${centerId}`);
    return { joined: `center:${centerId}` };
  }

  @SubscribeMessage('join:farmer')
  joinFarmer(@ConnectedSocket() socket: Socket, @MessageBody() farmerId: string) {
    socket.join(`farmer:${farmerId}`);
    return { joined: `farmer:${farmerId}` };
  }
}
