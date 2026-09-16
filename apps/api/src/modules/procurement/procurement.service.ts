import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DatabaseService, first, rows, Tx } from '../../infrastructure/database/database.service';
import { EventsService } from '../../infrastructure/events/events.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { validateProcurementTransition } from './procurement.state-machine';
import { TeeSecurityService } from '../../common/security/tee.service';
import {
  mapToLotStatus,
  ProcurementResponseDto,
  QualityCheckInput,
  qualityCheckSchema,
  RejectInput,
  rejectSchema,
  WeighingInput,
  weighingSchema,
} from './procurement.types';

@Injectable()
export class ProcurementService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Optional() @Inject(TeeSecurityService) private readonly tee?: TeeSecurityService,
  ) {}

  async getProcurementStatus(identifier: string): Promise<ProcurementResponseDto> {
    const token = await this.findToken(identifier);
    if (!token) {
      throw new NotFoundException(`Procurement lot not found for '${identifier}'`);
    }
    return this.mapToResponse(token);
  }

  async getProcurementReceipt(identifier: string): Promise<Record<string, any>> {
    const isNum = /^\d+$/.test(identifier);
    const token = await first<Record<string, any>>(
      this.db,
      `select t.*, 
              c.name as center_name, c.code as center_code, c.location as center_location, c.district as center_district, c.state as center_state,
              s.slot_date, s.start_time, s.end_time,
              f.name as farmer_name, f.mobile as farmer_mobile, f.address as farmer_address, f.district as farmer_district,
              f.crop as farmer_crop, f.bank_account, f.ifsc,
              m.price_per_quintal as msp_price, m.bonus_per_quintal as msp_bonus
         from tokens t
         join centers c on c.id = t.center_id
         join slots s on s.id = t.slot_id
         join farmers f on f.id = t.farmer_id
         left join msp_rates m on m.crop = f.crop and m.is_active = true
        where ${isNum ? 't.id = $1::bigint' : 't.token_number = $1 or t.id::text = $1'}
        limit 1`,
      identifier,
    );

    if (!token) {
      throw new NotFoundException(`Procurement record not found for '${identifier}'`);
    }

    const dateObj = token.procured_at
      ? new Date(token.procured_at)
      : (token.created_at ? new Date(token.created_at) : new Date());
    const dateFormatted = dateObj.toISOString().slice(0, 10).split('-').reverse().join('-');
    const timeFormatted = dateObj.toTimeString().slice(0, 8);
    const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, '');

    const centerCode = token.center_code || '28244';
    const receiptNo = `W${centerCode}-${yymmdd}-${token.token_number || '1'}`;
    const lotNo = `W${centerCode}-${yymmdd}-${token.token_number || '1'}${String(token.id).slice(-4).toUpperCase()}-A`;

    const cropName = token.farmer_crop || 'Wheat';
    const ratePer100Kg = token.msp_price
      ? Number(token.msp_price) + Number(token.msp_bonus || 0)
      : 2275;
    const netWeightQtl = token.net_weight != null
      ? Number(token.net_weight)
      : (token.quantity_received != null ? Number(token.quantity_received) : Number(token.quantity || 40));
    const netWeightKg = Math.round(netWeightQtl * 100);
    const bags = token.bags ? Number(token.bags) : Math.ceil(netWeightKg / 50);

    const grossAmount = Math.round((netWeightKg / 100) * ratePer100Kg);
    const deduction = 0;
    const netAmount = grossAmount - deduction;

    const org = `कृ.उ.बा.स. ${token.center_name}, उप बा ${token.center_location || token.center_district || ''}, जि. ${token.center_district || token.center_state || ''}`;

    return {
      organization: org,
      slip_type: 'शेतकरी पावती (Farmer Receipt)',
      status: (token.payment_status || (token.status === 'accepted' ? 'PAID' : token.status)).toUpperCase(),
      date: dateFormatted,
      time: timeFormatted,
      receipt_no: receiptNo,
      trader: '27- मे. अन्न सेतु खरेदी केंद्र / Food Corporation of India',
      weighing_no: `WB-${String(token.id).slice(-5).toUpperCase()}`,
      seller_name: token.farmer_name,
      seller_mobile: token.farmer_mobile,
      seller_village: token.farmer_address || token.farmer_district || 'अंतापूर',
      department_grade: token.moisture_percent ? `FAQ Grade — ओलावा: ${token.moisture_percent}%` : 'काडा — 573531',
      lot_no: lotNo,
      grain_type: cropName,
      buyer: 'शासकीय हमीभाव खरेदी (Govt MSP Procurement)',
      sub_buyer: 'kt',
      bags: bags,
      weight_kg: netWeightKg,
      rate_per_100_kg: ratePer100Kg,
      total_bags: bags,
      total_weight_kg: netWeightKg,
      total_amount: grossAmount,
      net_amount: netAmount,
      deduction_amount: deduction,
      bank_account: token.bank_account,
      ifsc: token.ifsc,
      utr_ref: token.transaction_ref || `PFMS${yymmdd}${token.token_number || 101}`,
      powered_by: 'AnnSetu (अन्न सेतु) — राष्ट्रीय कृषी खरेदी व रांग व्यवस्थापन प्रणाली',
    };
  }

  async getMyProcurement(farmerId?: string): Promise<ProcurementResponseDto[]> {
    if (!farmerId) return [];
    const list = await rows<Record<string, any>>(
      this.db,
      `select t.*, c.name as center_name, c.location as center_location,
              s.slot_date, s.start_time, s.end_time,
              f.name as farmer_name, f.mobile, f.crop, f.quantity as farmer_quantity
         from tokens t
         join centers c on c.id = t.center_id
         join slots s on s.id = t.slot_id
         join farmers f on f.id = t.farmer_id
        where t.farmer_id = $1::uuid
        order by t.created_at desc`,
      farmerId,
    );
    return list.map(r => this.mapToResponse(r));
  }

  async gateEntry(identifier: string, staffId: string, correlationId?: string): Promise<ProcurementResponseDto> {
    return this.db.$transaction(async (tx) => {
      const token = await this.findTokenForUpdate(tx, identifier);
      if (!token) throw new NotFoundException(`Token not found for '${identifier}'`);

      const beforeStatus = String(token.status || 'booked').toLowerCase();
      validateProcurementTransition(beforeStatus, 'arrived');

      if (beforeStatus !== 'arrived') {
        await rows(
          tx,
          `update tokens
              set status = 'arrived',
                  claimed_at = coalesce(claimed_at, now()),
                  staff_id = $1,
                  updated_at = now()
            where id = $2`,
          staffId,
          token.id,
        );

        await this.events.enqueue(tx, {
          type: 'GATE_ENTRY',
          centerId: token.center_id,
          farmerId: token.farmer_id,
          tokenNumber: token.token_number,
          status: 'arrived',
        });

        await this.audit.log(tx, {
          correlationId,
          entityType: 'TOKEN',
          entityId: String(token.id),
          action: 'GATE_ENTRY',
          actorType: 'STAFF',
          actorId: staffId,
          beforeState: { status: beforeStatus },
          afterState: { status: 'arrived' },
          metadata: { centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number },
        });
      }

      const updated = await this.findToken(String(token.id), tx);
      return this.mapToResponse(updated!);
    });
  }

  async weighing(
    identifier: string,
    rawInput: WeighingInput,
    staffId: string,
    correlationId?: string,
  ): Promise<ProcurementResponseDto> {
    const input = weighingSchema.parse(rawInput);
    const netWeight = Number((input.gross_weight - input.tare_weight).toFixed(3));

    return this.db.$transaction(async (tx) => {
      const token = await this.findTokenForUpdate(tx, identifier);
      if (!token) throw new NotFoundException(`Token not found for '${identifier}'`);

      const beforeStatus = String(token.status || 'booked').toLowerCase();
      validateProcurementTransition(beforeStatus, 'verification');

      await rows(
        tx,
        `update tokens
            set status = 'verification',
                gross_weight = $1::numeric,
                tare_weight = $2::numeric,
                net_weight = $3::numeric,
                quantity_received = $4::float8,
                staff_id = $5,
                updated_at = now()
          where id = $6`,
        input.gross_weight,
        input.tare_weight,
        netWeight,
        netWeight,
        staffId,
        token.id,
      );

      await this.events.enqueue(tx, {
        type: 'WEIGHING',
        centerId: token.center_id,
        farmerId: token.farmer_id,
        tokenNumber: token.token_number,
        status: 'verification',
      });

      await this.audit.log(tx, {
        correlationId,
        entityType: 'TOKEN',
        entityId: String(token.id),
        action: 'WEIGHING',
        actorType: 'STAFF',
        actorId: staffId,
        beforeState: {
          status: beforeStatus,
          gross_weight: token.gross_weight,
          tare_weight: token.tare_weight,
          net_weight: token.net_weight,
        },
        afterState: {
          status: 'verification',
          gross_weight: input.gross_weight,
          tare_weight: input.tare_weight,
          net_weight: netWeight,
        },
        metadata: { centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number },
      });

      const updated = await this.findToken(String(token.id), tx);
      return this.mapToResponse(updated!);
    });
  }

  async qualityCheck(
    identifier: string,
    rawInput: QualityCheckInput,
    staffId: string,
    correlationId?: string,
  ): Promise<ProcurementResponseDto> {
    const input = qualityCheckSchema.parse(rawInput);
    const targetStatus = input.quality_pass ? 'quality_check' : 'rejected';

    return this.db.$transaction(async (tx) => {
      const token = await this.findTokenForUpdate(tx, identifier);
      if (!token) throw new NotFoundException(`Token not found for '${identifier}'`);

      const beforeStatus = String(token.status || 'booked').toLowerCase();
      validateProcurementTransition(beforeStatus, targetStatus);

      await rows(
        tx,
        `update tokens
            set status = $1::text,
                moisture_percent = $2::numeric,
                quality_pass = $3::boolean,
                reject_reason = case when $1::text = 'rejected' then coalesce($4, reject_reason, 'Failed quality standards') else reject_reason end,
                staff_id = $5,
                updated_at = now()
          where id = $6`,
        targetStatus,
        input.moisture_percent,
        input.quality_pass,
        input.reject_reason || null,
        staffId,
        token.id,
      );

      await this.events.enqueue(tx, {
        type: input.quality_pass ? 'QUALITY_CHECK' : 'LOT_REJECTED',
        centerId: token.center_id,
        farmerId: token.farmer_id,
        tokenNumber: token.token_number,
        status: targetStatus,
      });

      await this.audit.log(tx, {
        correlationId,
        entityType: 'TOKEN',
        entityId: String(token.id),
        action: input.quality_pass ? 'QUALITY_CHECK' : 'LOT_REJECTED',
        actorType: 'STAFF',
        actorId: staffId,
        beforeState: {
          status: beforeStatus,
          moisture_percent: token.moisture_percent,
          quality_pass: token.quality_pass,
        },
        afterState: {
          status: targetStatus,
          moisture_percent: input.moisture_percent,
          quality_pass: input.quality_pass,
          reject_reason: input.reject_reason,
        },
        metadata: { centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number },
      });

      const updated = await this.findToken(String(token.id), tx);
      return this.mapToResponse(updated!);
    });
  }

  async lotAccepted(identifier: string, staffId: string, correlationId?: string): Promise<ProcurementResponseDto> {
    return this.db.$transaction(async (tx) => {
      const token = await this.findTokenForUpdate(tx, identifier);
      if (!token) throw new NotFoundException(`Token not found for '${identifier}'`);

      const beforeStatus = String(token.status || 'booked').toLowerCase();
      validateProcurementTransition(beforeStatus, 'accepted');

      await rows(
        tx,
        `update tokens
            set status = 'accepted',
                staff_id = $1,
                updated_at = now()
          where id = $2`,
        staffId,
        token.id,
      );

      await this.events.enqueue(tx, {
        type: 'LOT_ACCEPTED',
        centerId: token.center_id,
        farmerId: token.farmer_id,
        tokenNumber: token.token_number,
        status: 'accepted',
      });

      await this.audit.log(tx, {
        correlationId,
        entityType: 'TOKEN',
        entityId: String(token.id),
        action: 'LOT_ACCEPTED',
        actorType: 'STAFF',
        actorId: staffId,
        beforeState: { status: beforeStatus },
        afterState: { status: 'accepted' },
        metadata: { centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number },
      });

      const updated = await this.findToken(String(token.id), tx);
      return this.mapToResponse(updated!);
    });
  }

  async reject(identifier: string, rawInput: RejectInput, staffId: string, correlationId?: string): Promise<ProcurementResponseDto> {
    const input = rejectSchema.parse(rawInput);

    return this.db.$transaction(async (tx) => {
      const token = await this.findTokenForUpdate(tx, identifier);
      if (!token) throw new NotFoundException(`Token not found for '${identifier}'`);

      const beforeStatus = String(token.status || 'booked').toLowerCase();
      validateProcurementTransition(beforeStatus, 'rejected');

      await rows(
        tx,
        `update tokens
            set status = 'rejected',
                reject_reason = $1,
                staff_id = $2,
                updated_at = now()
          where id = $3`,
        input.reject_reason,
        staffId,
        token.id,
      );

      await this.events.enqueue(tx, {
        type: 'LOT_REJECTED',
        centerId: token.center_id,
        farmerId: token.farmer_id,
        tokenNumber: token.token_number,
        status: 'rejected',
      });

      await this.audit.log(tx, {
        correlationId,
        entityType: 'TOKEN',
        entityId: String(token.id),
        action: 'LOT_REJECTED',
        actorType: 'STAFF',
        actorId: staffId,
        beforeState: { status: beforeStatus, reject_reason: token.reject_reason },
        afterState: { status: 'rejected', reject_reason: input.reject_reason },
        metadata: { centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number },
      });

      const updated = await this.findToken(String(token.id), tx);
      return this.mapToResponse(updated!);
    });
  }

  async updateStatus(identifier: string, body: Record<string, any>, staffId: string, correlationId?: string): Promise<ProcurementResponseDto> {
    const requested = String(body.status || '').toLowerCase();
    if (requested === 'arrived') {
      return this.gateEntry(identifier, staffId, correlationId);
    }
    if (requested === 'verification') {
      return this.weighing(identifier, {
        gross_weight: body.gross_weight ?? body.grossWeight ?? 35,
        tare_weight: body.tare_weight ?? body.tareWeight ?? 5,
      }, staffId, correlationId);
    }
    if (requested === 'quality_check') {
      return this.qualityCheck(identifier, {
        moisture_percent: body.moisture_percent ?? body.moisturePercent ?? 12.0,
        quality_pass: body.quality_pass ?? body.qualityPass ?? true,
        reject_reason: body.reject_reason ?? body.rejectReason,
      }, staffId, correlationId);
    }
    if (requested === 'accepted') {
      return this.lotAccepted(identifier, staffId, correlationId);
    }
    if (requested === 'rejected') {
      return this.reject(identifier, {
        reject_reason: body.reject_reason ?? body.rejectReason ?? 'Rejected by center operator',
      }, staffId, correlationId);
    }

    // Default sequential progression if another state (e.g. procured)
    return this.db.$transaction(async (tx) => {
      const token = await this.findTokenForUpdate(tx, identifier);
      if (!token) throw new NotFoundException(`Token not found for '${identifier}'`);

      const beforeStatus = String(token.status || 'booked').toLowerCase();
      validateProcurementTransition(beforeStatus, requested);

      await rows(
        tx,
        `update tokens
            set status = $1,
                procured_at = case when $1 = 'procured' then coalesce(procured_at, now()) else procured_at end,
                staff_id = $2,
                updated_at = now()
          where id = $3`,
        requested,
        staffId,
        token.id,
      );

      await this.events.enqueue(tx, {
        type: 'STATUS_CHANGED',
        centerId: token.center_id,
        farmerId: token.farmer_id,
        tokenNumber: token.token_number,
        status: requested,
      });

      await this.audit.log(tx, {
        correlationId,
        entityType: 'TOKEN',
        entityId: String(token.id),
        action: 'STATUS_CHANGED',
        actorType: 'STAFF',
        actorId: staffId,
        beforeState: { status: beforeStatus },
        afterState: { status: requested },
        metadata: { centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number },
      });

      const updated = await this.findToken(String(token.id), tx);
      return this.mapToResponse(updated!);
    });
  }

  private async findToken(identifier: string, client: Tx | DatabaseService = this.db): Promise<Record<string, any> | undefined> {
    const isNum = /^\d+$/.test(identifier);
    return first<Record<string, any>>(
      client,
      `select t.*, c.name as center_name, c.location as center_location,
              s.slot_date, s.start_time, s.end_time,
              f.name as farmer_name, f.mobile, f.crop, f.quantity as farmer_quantity
         from tokens t
         join centers c on c.id = t.center_id
         join slots s on s.id = t.slot_id
         join farmers f on f.id = t.farmer_id
        where ${isNum ? 't.id = $1::bigint' : 't.token_number = $1 or t.id::text = $1'}
        limit 1`,
      identifier,
    );
  }

  private async findTokenForUpdate(tx: Tx | DatabaseService, identifier: string): Promise<Record<string, any> | undefined> {
    const isNum = /^\d+$/.test(identifier);
    return first<Record<string, any>>(
      tx,
      `select t.*
         from tokens t
        where ${isNum ? 't.id = $1::bigint' : 't.token_number = $1 or t.id::text = $1'}
        for update
        limit 1`,
      identifier,
    );
  }

  private mapToResponse(t: Record<string, any>): ProcurementResponseDto {
    const status = String(t.status || 'booked').toLowerCase();
    const lotStatus = mapToLotStatus(status);
    const dateStr = t.slot_date instanceof Date
      ? t.slot_date.toISOString().slice(0, 10)
      : String(t.slot_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const startedAt = t.claimed_at
      ? new Date(t.claimed_at).toISOString()
      : (t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString());
    const completedAt = t.procured_at ? new Date(t.procured_at).toISOString() : null;

    const gross = t.gross_weight != null ? Number(t.gross_weight) : null;
    const tare = t.tare_weight != null ? Number(t.tare_weight) : null;
    const net = t.net_weight != null ? Number(t.net_weight) : (t.quantity_received != null ? Number(t.quantity_received) : null);
    const moisture = t.moisture_percent != null ? Number(t.moisture_percent) : null;
    const qPass = t.quality_pass != null ? Boolean(t.quality_pass) : (lotStatus === 'REJECTED' ? false : null);

    return {
      id: String(t.id),
      farmerId: String(t.farmer_id),
      farmer_id: String(t.farmer_id),
      centerId: String(t.center_id),
      center_id: String(t.center_id),
      centerName: t.center_name || 'Procurement Center',
      center_name: t.center_name || 'Procurement Center',
      lotStatus,
      status,
      grossWeight: gross,
      gross_weight: gross,
      tareWeight: tare,
      tare_weight: tare,
      netWeight: net,
      net_weight: net,
      moisturePercent: moisture,
      moisture_percent: moisture,
      qualityPass: qPass,
      quality_pass: qPass,
      staffId: t.staff_id ? String(t.staff_id) : (t.claimed_by ? String(t.claimed_by) : null),
      staff_id: t.staff_id ? String(t.staff_id) : (t.claimed_by ? String(t.claimed_by) : null),
      startedAt,
      started_at: startedAt,
      completedAt,
      completed_at: completedAt,
      bookingId: String(t.id),
      booking_id: String(t.id),
      tokenNumber: String(t.token_number),
      token_number: String(t.token_number),
      bookingDate: dateStr,
      date: dateStr,
      timeWindowStart: t.start_time || '09:00',
      start_time: t.start_time || '09:00',
      timeWindowEnd: t.end_time || '10:00',
      end_time: t.end_time || '10:00',
      crop: t.crop ?? null,
      quantity: t.farmer_quantity != null ? Number(t.farmer_quantity) : null,
      farmerName: t.farmer_name ?? null,
      farmer_name: t.farmer_name ?? null,
      mobile: t.mobile ?? null,
      rejectReason: t.reject_reason ?? null,
      reject_reason: t.reject_reason ?? null,
      tamper_evident_seal: this.tee ? this.tee.generateSeal(t.id, {
        farmer_id: t.farmer_id,
        center_id: t.center_id,
        net_weight: net,
        status,
        moisture_percent: moisture,
      }).seal : 'TEESTUB_SEAL',
      tee_attestation: this.tee ? this.tee.generateSeal(t.id, {
        farmer_id: t.farmer_id,
        center_id: t.center_id,
        net_weight: net,
        status,
        moisture_percent: moisture,
      }) : undefined,
    };
  }
}
