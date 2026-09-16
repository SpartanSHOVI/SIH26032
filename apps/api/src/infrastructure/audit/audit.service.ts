import { Injectable } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseService, rows, Tx } from '../database/database.service';

export interface AuditLogParams {
  correlationId?: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType?: 'STAFF' | 'FARMER' | 'SYSTEM' | 'OFFICER';
  actorId: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export function toEntityUuid(entityId: string): string {
  if (!entityId) return randomUUID();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) {
    return entityId;
  }
  const hash = createHash('md5').update(String(entityId)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async log(dbOrTx: Tx | DatabaseService, params: AuditLogParams) {
    const id = randomUUID();
    const correlationId = params.correlationId || randomUUID();
    const actorType = params.actorType || 'STAFF';
    const beforeState = params.beforeState ? JSON.stringify(params.beforeState) : null;
    const afterState = params.afterState ? JSON.stringify(params.afterState) : null;
    const metadata = params.metadata ? JSON.stringify(params.metadata) : null;
    const entityId = toEntityUuid(params.entityId);

    await rows(
      dbOrTx,
      `insert into audit_events (
        id, correlation_id, entity_type, entity_id, action, actor_type, actor_id,
        before_state, after_state, metadata, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, now())`,
      id,
      correlationId,
      params.entityType,
      entityId,
      params.action,
      actorType,
      params.actorId,
      beforeState,
      afterState,
      metadata,
    );

    return {
      id,
      correlationId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorType,
      actorId: params.actorId,
    };
  }
}
