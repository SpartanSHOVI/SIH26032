import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';
import { EventsService } from './infrastructure/events/events.service';
import { serializable } from './infrastructure/database/database.service';
import { buildSwagger } from './swagger';
import { map } from 'rxjs';

import { sanitizeAndMaskPii } from './common/interceptors/pii-masking.interceptor';
import { XssSanitizerPipe } from './common/pipes/xss-sanitizer.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.useGlobalPipes(new XssSanitizerPipe());

  // Security Hardening: Disable Express x-powered-by banner
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp && typeof expressApp.disable === 'function') {
    expressApp.disable('x-powered-by');
  }

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const isAllowed =
        origin === env.APP_ORIGIN ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.ngrok-free.app') ||
        origin.endsWith('.ngrok.io') ||
        origin.endsWith('.ngrok.app') ||
        origin.endsWith('.trycloudflare.com') ||
        origin.endsWith('.loca.lt');
      if (isAllowed || env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('CORS origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization', 'ngrok-skip-browser-warning', 'x-requested-with'],
  });
  app.useGlobalInterceptors({
    intercept(context, next) {
      const req = context.switchToHttp().getRequest();
      const isPublicLookup = req?.path?.includes('/farmers/lookup') || req?.path?.includes('/admin/farmers');
      return next.handle().pipe(
        map((value) => sanitizeAndMaskPii(serializable(value), isPublicLookup)),
      );
    },
  });

  buildSwagger(app);

  const events = app.get(EventsService);
  setInterval(() => void events.dispatch().catch(() => undefined), 1000).unref();
  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
