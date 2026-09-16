import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, first, rows } from '../../infrastructure/database/database.service';

export const statusFlow = ['booked', 'arrived', 'verification', 'quality_check', 'accepted', 'procured', 'payment_processing', 'payment_completed'];
const liveStatuses = ['booked', 'arrived', 'verification', 'quality_check'];

function maskName(value: unknown) {
  const parts = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Farmer';
  return parts.map((part) => `${part[0]}${'*'.repeat(Math.min(Math.max(part.length - 1, 2), 5))}`).join(' ');
}

function maskMobile(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `******${digits.slice(-4)}` : '******';
}

function maskReference(value: unknown) {
  const ref = String(value ?? '').trim();
  if (!ref) return null;
  return ref.length > 4 ? `${'*'.repeat(Math.min(ref.length - 4, 8))}${ref.slice(-4)}` : `****${ref}`;
}

/**
 * Public, read-only projection used by farmers who received an assisted booking.
 * Deliberately excludes internal IDs, Aadhaar/bank fields and notification history.
 */
export function toPublicTrackingView(token: Record<string, any>) {
  return {
    token_number: token.token_number,
    status: token.status,
    reject_reason: token.reject_reason ?? null,
    booked_via: token.booked_via,
    created_at: token.created_at,
    farmer_name: maskName(token.farmer_name),
    mobile: maskMobile(token.mobile),
    crop: token.crop,
    quantity: token.quantity,
    quantity_received: token.quantity_received,
    center_name: token.center_name,
    center_location: token.center_location,
    date: token.date,
    start_time: token.start_time,
    end_time: token.end_time,
    farmers_ahead: token.farmers_ahead,
    current_token: token.current_token,
    estimated_wait_min: token.estimated_wait_min,
    avg_processing_min: token.avg_processing_min,
    counters: token.counters,
    wait_explanation: token.wait_explanation,
    status_flow: token.status_flow,
    payment_status: token.payment_status,
    payment_method: token.payment_method,
    payment_amount: token.payment_amount,
    transaction_ref: maskReference(token.transaction_ref),
    payment_at: token.payment_at,
    last_updated_at: new Date().toISOString(),
  };
}

@Injectable()
export class QueueService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async tokenDetail(tokenId: string | number) {
    const token = await first<Record<string, any>>(
      this.db,
      `select t.*, f.name farmer_name, f.mobile, f.crop, f.quantity, f.bank_account, f.ifsc,
              c.name center_name, c.location center_location, c.counters, c.avg_processing_min,
              s.slot_date, s.start_time, s.end_time
         from tokens t
         left join farmers f on f.id = t.farmer_id
         left join centers c on c.id = t.center_id
         left join slots s on s.id = t.slot_id
        where t.id = $1`,
      Number(tokenId),
    );
    if (!token) throw new NotFoundException('Token not found');
    return this.mapToken(token);
  }

  async lookup(value?: string) {
    if (!value?.trim()) throw new NotFoundException('Token not found');
    const q = value.trim();
    const token = await first<{ id: number }>(
      this.db,
      `select t.id
         from tokens t left join farmers f on f.id = t.farmer_id
        where t.token_number = $1 or f.mobile = $1
        order by t.created_at desc
        limit 1`,
      q,
    );
    if (!token) throw new NotFoundException('Token not found');
    return this.tokenDetail(token.id);
  }

  async publicLookup(value?: string) {
    return toPublicTrackingView(await this.lookup(value));
  }

  async notifications(farmerId?: string) {
    return rows(
      this.db,
      `select id, farmer_id::text, channel, message, notification_type, status, created_at
         from notifications
        where ($1::uuid is null or farmer_id = $1)
        order by created_at desc
        limit 50`,
      farmerId ?? null,
    );
  }

  async centerQueue(centerId: string, date?: string) {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    return rows(
      this.db,
      `select t.id token_id, t.id, t.token_number, t.status, t.booked_via, t.created_at,
              f.id::text farmer_id, f.name farmer_name, f.mobile, f.crop, f.quantity,
              s.slot_date as date, s.start_time, s.end_time
         from tokens t
         join farmers f on f.id = t.farmer_id
         join slots s on s.id = t.slot_id
        where t.center_id = $1 and s.slot_date = $2::date
        order by s.start_time, t.created_at`,
      centerId,
      targetDate,
    );
  }

  private async mapToken(token: Record<string, any>) {
    const date = token.slot_date instanceof Date
      ? token.slot_date.toISOString().slice(0, 10)
      : String(token.slot_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const aheadRow = await first<{ ahead: string }>(
      this.db,
      `select count(*)::text ahead
         from tokens t join slots s on s.id = t.slot_id
        where t.center_id = $1 and s.slot_date = $2::date
          and lower(t.status) = any($3::text[])
          and (s.start_time, t.created_at, t.id) < ($4, $5, $6)`,
      token.center_id,
      date,
      liveStatuses,
      token.start_time ?? '09:00',
      token.created_at,
      token.id,
    );
    const current = await first<{ token_number: string }>(
      this.db,
      `select token_number
         from tokens t join slots s on s.id = t.slot_id
        where t.center_id = $1 and s.slot_date = $2::date and lower(t.status) in ('verification','quality_check')
        order by t.claimed_at nulls last, t.updated_at desc
        limit 1`,
      token.center_id,
      date,
    );
    const ahead = Number(aheadRow?.ahead ?? 0);
    const counters = Math.max(Number(token.counters ?? 2), 1);
    const avg = Number(token.avg_processing_min ?? 7);
    const finished = ['procured', 'payment_processing', 'payment_completed', 'rejected'].includes(String(token.status).toLowerCase());

    // ─── wait_explanation: Little's Law broken down for the farmer ─────────────
    const estimatedWaitMin = finished ? 0 : ahead === 0 ? 3 : Math.max(3, Math.round((ahead * avg) / counters));
    const wait_explanation = finished
      ? {
          status: 'complete',
          message: 'Your produce has been processed. No further wait.',
          farmers_ahead: 0,
          counters_open: counters,
          avg_min_per_farmer: avg,
          formula: 'N/A — processing complete',
          little_law: "Wait = (ahead × avg_service_time) / active_counters",
        }
      : ahead === 0
      ? {
          status: 'next',
          message: 'You are next in line! Please proceed to the counter.',
          farmers_ahead: 0,
          counters_open: counters,
          avg_min_per_farmer: avg,
          formula: 'Queue is clear — minimum courtesy wait of 3 min',
          little_law: "Wait = (ahead × avg_service_time) / active_counters",
        }
      : {
          status: 'waiting',
          message: `${ahead} farmer${ahead === 1 ? '' : 's'} ahead of you across ${counters} open counter${counters === 1 ? '' : 's'}.`,
          farmers_ahead: ahead,
          counters_open: counters,
          avg_min_per_farmer: avg,
          formula: `⌈(${ahead} × ${avg}) / ${counters}⌉ = ${estimatedWaitMin} min`,
          little_law: "Wait = (farmers_ahead × avg_service_time) / active_counters",
          tip: estimatedWaitMin > 30
            ? `Tip: If you arrive ${Math.round(estimatedWaitMin * 0.4)} min early, your effective wait may be shorter.`
            : undefined,
        };
    // ──────────────────────────────────────────────────────────────────────────

    return {
      id: token.id,
      token_id: token.id,
      token_number: token.token_number,
      status: token.status,
      reject_reason: token.reject_reason,
      quantity_received: token.quantity_received,
      booked_via: token.booked_via,
      running_late_used: Boolean(token.running_late_used),
      grace_until: token.grace_until,
      payment_method: token.payment_method,
      payment_status: token.payment_status,
      payment_amount: token.payment_amount,
      transaction_ref: token.transaction_ref,
      payment_at: token.payment_at,
      created_at: token.created_at,
      farmer_id: token.farmer_id,
      farmer_name: token.farmer_name ?? '-',
      mobile: token.mobile ?? '-',
      crop: token.crop ?? '-',
      quantity: token.quantity ?? 0,
      bank_account: token.bank_account,
      ifsc: token.ifsc,
      center_id: token.center_id,
      center_name: token.center_name ?? '-',
      center_location: token.center_location ?? '-',
      counters,
      avg_processing_min: avg,
      slot_id: token.slot_id,
      date,
      start_time: token.start_time ?? '-',
      end_time: token.end_time ?? '-',
      farmers_ahead: finished ? 0 : ahead,
      current_token: current?.token_number ?? '-',
      estimated_wait_min: estimatedWaitMin,
      wait_explanation,
      status_flow: statusFlow,
      notifications: await this.notifications(token.farmer_id),
    };
  }
}
