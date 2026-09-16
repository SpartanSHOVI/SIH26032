import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, first, rows } from '../../infrastructure/database/database.service';
import { EventsService } from '../../infrastructure/events/events.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PfmsAdapterService } from './pfms-adapter.service';
import { MSP_RATES, PaymentResponseDto, PaymentStatus } from './payment.types';
import { assertPfmsEligible } from './payment-policy';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PfmsAdapterService) private readonly pfms: PfmsAdapterService,
  ) {}

  async getPaymentStatus(identifier: string): Promise<PaymentResponseDto> {
    const record = await this.findPayment(identifier);
    if (!record) {
      throw new NotFoundException(`Payment record not found for '${identifier}'`);
    }
    return this.mapToResponse(record);
  }

  async getMyPayments(farmerId?: string): Promise<PaymentResponseDto[]> {
    if (!farmerId) return [];

    // Query tokens with payment information joined with centers, farmers, and dynamic msp_rates
    const tokenPayments = await rows<Record<string, any>>(
      this.db,
      `select t.*, c.name as center_name, s.slot_date,
              f.name as farmer_name, f.crop, f.quantity as farmer_quantity,
              p.id as payment_uuid, p.status as lot_payment_status,
              p.amount as lot_payment_amount, p.utr_reference as lot_utr,
              p.credited_at as lot_credited_at, p.pfms_response as lot_pfms_response,
              p.created_at as payment_created_at, p.updated_at as payment_updated_at,
              coalesce(mr.price_per_quintal + mr.bonus_per_quintal, 2275)::float as msp_price
         from tokens t
         join centers c on c.id = t.center_id
         join slots s on s.id = t.slot_id
         join farmers f on f.id = t.farmer_id
         left join payments p on p.farmer_id = t.farmer_id and p.utr_reference = t.transaction_ref
         left join msp_rates mr on lower(mr.crop) = lower(f.crop) and mr.is_active = true
        where t.farmer_id = $1::uuid
        order by t.created_at desc`,
      farmerId,
    );

    return tokenPayments.map(r => this.mapToResponse(r));
  }

  async updatePaymentStatus(
    identifier: string,
    targetStatus: PaymentStatus,
    options: {
      amount?: number;
      utr_reference?: string;
      pfms_response?: any;
    } = {},
    staffId = 'SYSTEM',
    correlationId?: string,
  ): Promise<PaymentResponseDto> {
    const isNum = /^\d+$/.test(identifier);

    return this.db.$transaction(async (tx) => {
      // Find token and lock for update
      const token = await first<Record<string, any>>(
        tx,
        `select t.*, f.crop, f.quantity as farmer_quantity, c.name as center_name, s.slot_date
           from tokens t
           join centers c on c.id = t.center_id
           join slots s on s.id = t.slot_id
           join farmers f on f.id = t.farmer_id
          where ${isNum ? 't.id = $1::bigint' : 't.token_number = $1 or t.id::text = $1'}
          for update
          limit 1`,
        identifier,
      );

      if (!token) {
        throw new NotFoundException(`Token not found for payment '${identifier}'`);
      }

      // This service models the PFMS/DBT state machine. Assistant bookings have
      // no verified bank details and must be settled through the cash endpoint.
      assertPfmsEligible(token.booked_via);

      const currentStatus = String(token.payment_status || 'PENDING').toUpperCase() as PaymentStatus;

      // IDEMPOTENT NO-OP: Replaying the same status transition is a no-op
      if (currentStatus === targetStatus) {
        return this.mapToResponse(token);
      }

      // Compute amount based on produce quantity and MSP rate if not explicitly supplied
      const crop = token.crop || 'Wheat';
      const msp = MSP_RATES[crop] || 2275;
      const qty = token.net_weight != null ? Number(token.net_weight) : (token.quantity_received || token.farmer_quantity || 30);
      const amount = options.amount != null ? Number(options.amount) : (token.payment_amount != null ? Number(token.payment_amount) : Number((qty * msp).toFixed(2)));

      // Generate UTR and credited timestamp when transitioning to CREDITED
      let utr = options.utr_reference || token.transaction_ref;
      let creditedAt: Date | null = token.payment_at ? new Date(token.payment_at) : null;
      let pfmsResponse = options.pfms_response;

      if (targetStatus === 'CREDITED') {
        if (!utr) {
          utr = this.pfms.generateUtrReference(String(token.id));
        }
        if (!creditedAt) {
          creditedAt = new Date();
        }
        if (!pfmsResponse) {
          pfmsResponse = this.pfms.simulatePfmsResponse(utr, amount, 'CREDITED');
        }
      } else if (targetStatus === 'PROCESSING') {
        if (!pfmsResponse) {
          pfmsResponse = this.pfms.simulatePfmsResponse(utr || 'PENDING', amount, 'PROCESSING');
        }
      }

      // Update tokens table
      await rows(
        tx,
        `update tokens
            set payment_status = $1,
                payment_amount = $2,
                transaction_ref = $3,
                payment_at = case when $1 = 'CREDITED' then coalesce($4, now()) else payment_at end,
                status = case when $1 = 'CREDITED' then 'payment_completed' else (case when $1 = 'PROCESSING' then 'payment_processing' else status end) end,
                updated_at = now()
          where id = $5`,
        targetStatus,
        amount,
        utr || null,
        creditedAt,
        token.id,
      );

      // Check if a payment record exists in payments table
      const existingPayment = await first<Record<string, any>>(
        tx,
        `select * from payments where farmer_id = $1 and utr_reference = $2 limit 1`,
        token.farmer_id,
        utr,
      );

      if (existingPayment) {
        await rows(
          tx,
          `update payments
              set status = $1,
                  amount = $2,
                  utr_reference = $3,
                  credited_at = $4,
                  pfms_response = $5::jsonb,
                  updated_at = now()
            where id = $6`,
          targetStatus,
          amount,
          utr,
          creditedAt,
          pfmsResponse ? JSON.stringify(pfmsResponse) : null,
          existingPayment.id,
        );
      } else {
        // Create an idempotent payment entry if not already present
        // Use a dummy or created procurement_lot if needed
        const lot = await first<{ id: string }>(tx, `select id from procurement_lots where farmer_id = $1 limit 1`, token.farmer_id);
        if (lot) {
          await rows(
            tx,
            `insert into payments (id, procurement_lot_id, farmer_id, amount, status, utr_reference, credited_at, pfms_response, created_at, updated_at)
             values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
             on conflict (procurement_lot_id) do update set status = excluded.status, amount = excluded.amount, utr_reference = excluded.utr_reference, credited_at = excluded.credited_at, pfms_response = excluded.pfms_response, updated_at = now()`,
            lot.id,
            token.farmer_id,
            amount,
            targetStatus,
            utr || null,
            creditedAt,
            pfmsResponse ? JSON.stringify(pfmsResponse) : null,
          );
        }
      }

      // Enqueue outbox event (only on actual transition, not on idempotent replay)
      await this.events.enqueue(tx, {
        type: 'PAYMENT_UPDATED',
        centerId: token.center_id,
        farmerId: token.farmer_id,
        tokenNumber: token.token_number,
        status: targetStatus,
      });

      // Write audit log entry (only on actual transition)
      await this.audit.log(tx, {
        correlationId,
        entityType: 'PAYMENT',
        entityId: String(token.id),
        action: 'PAYMENT_STATE_CHANGE',
        actorType: staffId === 'SYSTEM' ? 'SYSTEM' : 'STAFF',
        actorId: staffId,
        beforeState: { payment_status: currentStatus, payment_amount: token.payment_amount },
        afterState: { payment_status: targetStatus, payment_amount: amount, utr_reference: utr },
        metadata: { centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number },
      });

      const updatedWithCrop = await first<Record<string, any>>(
        tx,
        `select t.*, f.crop, f.quantity as farmer_quantity, c.name as center_name, s.slot_date,
                coalesce(mr.price_per_quintal + mr.bonus_per_quintal, 2275)::float as msp_price
           from tokens t
           join centers c on c.id = t.center_id
           join slots s on s.id = t.slot_id
           join farmers f on f.id = t.farmer_id
           left join msp_rates mr on lower(mr.crop) = lower(f.crop) and mr.is_active = true
          where t.id = $1`,
        token.id,
      );

      return this.mapToResponse(updatedWithCrop!);
    });
  }

  async advancePayment(identifier: string, staffId = 'SYSTEM', correlationId?: string): Promise<PaymentResponseDto> {
    const record = await this.findPayment(identifier);
    if (!record) {
      throw new NotFoundException(`Payment record not found for '${identifier}'`);
    }
    const current = String(record.payment_status || 'PENDING').toUpperCase() as PaymentStatus;
    const next = this.pfms.getNextStatus(current);
    return this.updatePaymentStatus(identifier, next, {}, staffId, correlationId);
  }

  private async findPayment(identifier: string): Promise<Record<string, any> | undefined> {
    const isNum = /^\d+$/.test(identifier);
    return first<Record<string, any>>(
      this.db,
      `select t.*, c.name as center_name, s.slot_date,
              f.name as farmer_name, f.crop, f.quantity as farmer_quantity,
              coalesce(mr.price_per_quintal + mr.bonus_per_quintal, 2275)::float as msp_price
         from tokens t
         join centers c on c.id = t.center_id
         join slots s on s.id = t.slot_id
         join farmers f on f.id = t.farmer_id
         left join msp_rates mr on lower(mr.crop) = lower(f.crop) and mr.is_active = true
        where ${isNum ? 't.id = $1::bigint' : 't.token_number = $1 or t.id::text = $1 or t.transaction_ref = $1'}
        limit 1`,
      identifier,
    );
  }

  private mapToResponse(t: Record<string, any>): PaymentResponseDto {
    const rawStatus = String(t.payment_status || t.status || 'PENDING').toUpperCase();
    let status: PaymentStatus = 'PENDING';
    if (['CREDITED', 'PAID', 'PAYMENT_COMPLETED'].includes(rawStatus)) status = 'CREDITED';
    else if (['PROCESSING', 'PAYMENT_PROCESSING'].includes(rawStatus)) status = 'PROCESSING';
    else if (['FAILED', 'REJECTED'].includes(rawStatus)) status = 'FAILED';
    else if (['REVERSED'].includes(rawStatus)) status = 'REVERSED';
    else status = 'PENDING';

    const qty = t.net_weight != null ? Number(t.net_weight) : (t.quantity_received != null ? Number(t.quantity_received) : (t.farmer_quantity || 30));
    const msp = t.msp_price != null ? Number(t.msp_price) : (MSP_RATES[t.crop || 'Wheat'] || 2275);
    const amount = t.payment_amount != null ? Number(t.payment_amount) : Number((qty * msp).toFixed(2));
    const dateStr = t.slot_date instanceof Date
      ? t.slot_date.toISOString().slice(0, 10)
      : String(t.slot_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);

    const utr = t.transaction_ref || t.lot_utr || null;
    const creditedAt = t.payment_at ? new Date(t.payment_at).toISOString() : (t.lot_credited_at ? new Date(t.lot_credited_at).toISOString() : null);
    const createdAt = t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString();
    const updatedAt = t.updated_at ? new Date(t.updated_at).toISOString() : createdAt;

    return {
      id: String(t.id),
      procurementLotId: String(t.id),
      procurement_lot_id: String(t.id),
      farmerId: String(t.farmer_id),
      farmer_id: String(t.farmer_id),
      amount,
      payment_amount: amount,
      status,
      payment_status: status,
      utrReference: utr,
      utr_reference: utr,
      transactionRef: utr,
      transaction_ref: utr,
      creditedAt,
      credited_at: creditedAt,
      paymentAt: creditedAt,
      payment_at: creditedAt,
      pfmsResponse: t.pfms_response || t.lot_pfms_response || null,
      pfms_response: t.pfms_response || t.lot_pfms_response || null,
      createdAt,
      created_at: createdAt,
      updatedAt,
      updated_at: updatedAt,
      procurementLot: {
        id: String(t.id),
        centerName: t.center_name || 'Procurement Center',
        netWeight: qty,
        bookingDate: dateStr,
        tokenNumber: String(t.token_number || t.id),
      },
    };
  }
}
