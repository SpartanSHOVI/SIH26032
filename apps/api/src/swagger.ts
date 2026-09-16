import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';

export function buildSwagger(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('AnnSetu API')
    .setDescription('NestJS API for AnnSetu Smart Farmer Procurement & Queue Platform — SIH 26032')
    .setVersion('2.0.0')
    .addTag('Procurement', 'MSP Procurement lifecycle, gate entry, weighing, QC, and acceptance')
    .addTag('Payments', 'PFMS/DBT payment status transitions and reconciliation')
    .addTag('Admin', 'Admin macro analytics, mandi rebalance, and queue observability')
    .addTag('Auth', 'Cookie-based session authentication with Argon2 password hashing')
    .addTag('Bookings', 'Farmer slot booking and token generation')
    .addTag('Queue', 'Real-time queue tracking and live position updates')
    .addTag('Centers', 'Procurement centers and slot configuration')
    .addTag('Locations', 'Geographic hierarchy and mandi locations')
    .addTag('Channel', 'Simulated USSD, IVR, and SMS endpoints')
    .addTag('Health', 'Service health check')
    .addTag('Translation', 'Regional language translation services')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
  });
  return document;
}
