import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AccessGuard } from './common/guards/access.guard';
import { Errors } from './common/filters/errors';
import { DatabaseModule } from './infrastructure/database/database.service';
import { RedisModule } from './infrastructure/redis/redis.service';
import { EventsModule } from './infrastructure/events/events.module';
import { AuthModule } from './modules/auth/auth.module';
import { LocationsModule } from './modules/locations/locations.module';
import { BookingModule } from './modules/booking/booking.module';
import { QueueModule } from './modules/queue/queue.module';
import { CenterModule } from './modules/center/center.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChannelModule } from './modules/channel/channel.module';
import { HealthModule } from './modules/health/health.module';
import { TranslationModule } from './modules/translation/translation.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MspModule } from './modules/msp/msp.module';
import { TeeSecurityModule } from './common/security/tee.module';
import { QueueGateway } from './realtime/queue.gateway';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    EventsModule,
    AuditModule,
    JobsModule,
    AuthModule,
    LocationsModule,
    BookingModule,
    QueueModule,
    CenterModule,
    AdminModule,
    ChannelModule,
    HealthModule,
    TranslationModule,
    ProcurementModule,
    PaymentsModule,
    MspModule,
    TeeSecurityModule,
  ],
  providers: [
    QueueGateway,
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_FILTER, useClass: Errors },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        helmet({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'http://127.0.0.1:*', 'https://*'],
              frameAncestors: ["'none'"],
            },
          },
          crossOriginOpenerPolicy: { policy: 'same-origin' },
          crossOriginResourcePolicy: { policy: 'cross-origin' },
          frameguard: { action: 'deny' },
          hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
          noSniff: true,
          referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
          xssFilter: true,
        }),
        cookieParser(),
      )
      .forRoutes('*');
  }
}
