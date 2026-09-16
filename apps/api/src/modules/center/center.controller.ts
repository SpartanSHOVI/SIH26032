import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { Actor, Roles } from '../../common/decorators/access';
import { Principal } from '../auth/auth.types';
import { DatabaseService, first, rows } from '../../infrastructure/database/database.service';
import { EventsService } from '../../infrastructure/events/events.service';
import { QueueService, statusFlow } from '../queue/queue.service';
import { resolvePaymentMethod } from '../payments/payment-policy';

@Controller()
export class CenterController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  @Get('centers/:centerId/queue')
  queueForCenter(@Param('centerId') centerId: string, @Query('date') date?: string) {
    return this.queue.centerQueue(centerId, date);
  }

  @Get('centers/:centerId/analytics')
  async analytics(@Param('centerId') centerId: string, @Query('date') date?: string) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    const [summary, statuses] = await Promise.all([
      first<Record<string, any>>(
        this.db,
        `select count(*)::int total_tokens,
                count(*) filter (where lower(t.status) in ('booked','arrived','verification','quality_check'))::int waiting,
                count(*) filter (where lower(t.status) in ('procured','payment_processing','payment_completed'))::int procured,
                count(*) filter (where lower(t.status) = 'rejected')::int rejected
           from tokens t join slots s on s.id = t.slot_id
          where t.center_id = $1 and s.slot_date = $2::date`,
        centerId,
        d,
      ),
      rows(this.db, `select lower(status) status, count(*)::int count from tokens t join slots s on s.id = t.slot_id where t.center_id = $1 and s.slot_date = $2::date group by lower(status)`, centerId, d),
    ]);
    return { date: d, ...(summary ?? {}), statuses };
  }

  @Roles('CENTER_OPERATOR', 'ADMIN', 'FARMER')
  @Post('centers/:centerId/call-next')
  async callNext(
    @Param('centerId') centerId: string,
    @Query('date') date: string | undefined,
    @Actor() actor?: Principal,
  ) {
    return this.handleCallNext(centerId, date, actor);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN', 'FARMER')
  @Get('centers/:centerId/call-next')
  async callNextGet(
    @Param('centerId') centerId: string,
    @Query('date') date: string | undefined,
    @Actor() actor?: Principal,
  ) {
    return this.handleCallNext(centerId, date, actor);
  }

  private async handleCallNext(
    centerId: string,
    date: string | undefined,
    actor?: Principal,
  ) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    const actorId = actor?.sub || 'operator';
    return this.db.$transaction(async (tx) => {
      const token = await first<Record<string, any>>(
        tx,
        `select t.id, t.token_number, t.farmer_id, t.status, f.name as farmer_name
           from tokens t
           join slots s on s.id = t.slot_id
           left join farmers f on f.id = t.farmer_id
          where t.center_id = $1 and s.slot_date = $2::date and lower(t.status) in ('booked','arrived')
          order by case lower(t.status) when 'arrived' then 0 else 1 end, s.start_time, t.created_at
          for update of t skip locked
          limit 1`,
        centerId,
        d,
      );
      if (!token) return { message: 'No farmers waiting', token: null };
      const nextStatus = token.status === 'booked' ? 'arrived' : 'verification';
      await rows(
        tx,
        `update tokens set status = $1, claimed_at = now(), claimed_by = $2, updated_at = now() where id = $3`,
        nextStatus,
        actorId,
        token.id,
      );
      await this.events.enqueue(tx, {
        type: 'CALL_NEXT',
        centerId,
        farmerId: token.farmer_id,
        tokenNumber: token.token_number,
        status: nextStatus,
      });
      return {
        message: `Calling token ${token.token_number}`,
        token_id: token.id,
        token_number: token.token_number,
        farmer_name: token.farmer_name || 'Farmer',
        status: nextStatus,
      };
    });
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @Patch('tokens/:tokenId/status')
  async updateStatus(@Param('tokenId') tokenId: string, @Body() body: Record<string, any>, @Actor() actor: Principal) {
    const requested = String(body.status ?? '').toLowerCase();
    if (!requested) throw new BadRequestException('status is required');
    await this.db.$transaction(async (tx) => {
      const token = await first<Record<string, any>>(tx, 'select * from tokens where id = $1 for update', Number(tokenId));
      if (!token) throw new BadRequestException('Token not found');
      const currentIndex = statusFlow.indexOf(String(token.status).toLowerCase());
      const requestedIndex = statusFlow.indexOf(requested);
      const valid = requested === 'rejected' || requestedIndex === currentIndex + 1 || requested === token.status;
      if (!valid) throw new BadRequestException(`Invalid status transition from ${token.status} to ${requested}`);
      await rows(
        tx,
        `update tokens
            set status = $1::varchar, reject_reason = $2, quantity_received = $3, procured_at = case when $1::varchar = 'procured' then now() else procured_at end,
                claimed_by = coalesce(claimed_by, $4), updated_at = now()
          where id = $5`,
        requested,
        body.reject_reason ?? null,
        body.quantity_received == null ? null : Number(body.quantity_received),
        actor.sub,
        Number(tokenId),
      );
      await this.events.enqueue(tx, { type: 'STATUS_CHANGED', centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number, status: requested });
    });
    return this.queue.tokenDetail(Number(tokenId));
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @Patch('tokens/:tokenId/payment')
  async payment(@Param('tokenId') tokenId: string, @Body() body: Record<string, any>) {
    await this.db.$transaction(async (tx) => {
      const existing = await first<Record<string, any>>(
        tx,
        'select * from tokens where id = $1 for update',
        Number(tokenId),
      );
      if (!existing) throw new BadRequestException('Token not found');

      const paymentMethod = resolvePaymentMethod(existing.booked_via, body.payment_method);
      const transactionRef = paymentMethod === 'cash'
        ? String(body.transaction_ref || `CASH-${existing.token_number}`)
        : body.transaction_ref ?? null;

      const token = await first<Record<string, any>>(
        tx,
        `update tokens
            set payment_method = $1, payment_status = $2::varchar, payment_amount = $3, transaction_ref = $4,
                payment_at = case when $2::varchar in ('credited','paid','completed') then now() else payment_at end,
                status = case when $2::varchar in ('credited','paid','completed') then 'payment_completed' else status end,
                updated_at = now()
          where id = $5 returning *`,
        paymentMethod,
        body.payment_status ?? 'processing',
        body.payment_amount == null ? null : Number(body.payment_amount),
        transactionRef,
        Number(tokenId),
      );
      if (!token) throw new BadRequestException('Token payment update failed');
      await this.events.enqueue(tx, { type: 'PAYMENT_UPDATED', centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number, status: token.status });
    });
    return this.queue.tokenDetail(Number(tokenId));
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @Post(['centers/:centerId/announcements', 'centers/:centerId/announcement'])
  announcement(@Param('centerId') centerId: string, @Body() body: Record<string, any>) {
    return first(
      this.db,
      `insert into center_announcements (center_id, reason, new_date, new_time, message)
       values ($1, $2, $3, $4, $5) returning *`,
      centerId,
      body.reason ?? 'general',
      body.new_date ?? null,
      body.new_time ?? null,
      body.message ?? '',
    );
  }

  @Get('centers/:centerId/announcements')
  announcements(@Param('centerId') centerId: string) {
    return rows(this.db, 'select * from center_announcements where center_id = $1 order by created_at desc limit 20', centerId);
  }

  @Get('messages')
  messages(@Query('farmer_id') farmerId?: string, @Query('center_id') centerId?: string) {
    return rows(this.db, `select * from message_logs where ($1::uuid is null or farmer_id = $1) and ($2::uuid is null or center_id = $2) order by created_at desc limit 100`, farmerId ?? null, centerId ?? null);
  }
}
