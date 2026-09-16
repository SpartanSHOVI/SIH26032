import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/access';
import { DatabaseService, first, rows, Tx } from '../../infrastructure/database/database.service';
import { EventsService } from '../../infrastructure/events/events.service';
import { listCenters } from '../locations/locations.controller';

const hours = [
  ['09:00', '10:00'],
  ['10:00', '11:00'],
  ['11:00', '12:00'],
  ['12:00', '13:00'],
  ['14:00', '15:00'],
  ['15:00', '16:00'],
  ['16:00', '17:00'],
];

@Controller()
export class BookingController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EventsService) private readonly events: EventsService,
  ) {}

  @Public()
  @Get(['centers', 'bookings/centers'])
  centers(@Query() q: Record<string, string>) {
    return listCenters(this.db, { ...q, limit: Number(q.limit ?? 100) });
  }

  @Public()
  @Get(['centers/:centerId/slots', 'bookings/availability'])
  async slots(@Param('centerId') centerId?: string, @Query('centerId') queryCenterId?: string, @Query('date') date?: string) {
    return this.ensureSlots(centerId ?? queryCenterId, date ?? new Date().toISOString().slice(0, 10), this.db);
  }

  @Post(['tokens/book', 'bookings'])
  book(@Body() body: Record<string, unknown>) {
    return this.bookToken(body, 'app');
  }

  @Public()
  @Post('tokens/call-book')
  async callBook(@Body() body: Record<string, any>) {
    const centerId = String(body.center_id ?? '');
    const slotId = Number(body.slot_id);
    const mobile = String(body.mobile ?? '').trim();
    if (!centerId || !slotId || !mobile) throw new BadRequestException('center_id, slot_id and mobile are required');
    const farmer = await this.db.$transaction(async (tx) => {
      const existing = await first<{ id: string }>(tx, 'select id::text from farmers where mobile = $1 limit 1', mobile);
      if (existing) return existing;
      return first<{ id: string }>(
        tx,
        `insert into farmers (farmer_id, name, mobile, address, crop, quantity, preferred_center_id)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id::text`,
        `FARMER-${mobile}`,
        body.name ?? `Farmer ${mobile.slice(-4)}`,
        mobile,
        body.location ?? null,
        body.crop ?? null,
        body.quantity == null ? null : Number(body.quantity),
        centerId,
      );
    });
    const booked = await this.bookToken({ farmer_id: farmer?.id, center_id: centerId, slot_id: slotId, booked_via: 'call' }, 'call');
    return { ...booked, farmer_id: farmer?.id, sms_sent: `SMS to ${mobile}: Your token ${booked.token_number} is booked.` };
  }

  @Post('tokens/:tokenId/running-late')
  async runningLate(@Param('tokenId') tokenId: string) {
    return this.db.$transaction(async (tx) => {
      const token = await first<Record<string, any>>(
        tx,
        `select t.*, s.end_time from tokens t join slots s on s.id = t.slot_id where t.id = $1 for update`,
        Number(tokenId),
      );
      if (!token) throw new BadRequestException('Token not found');
      if (token.running_late_used) throw new BadRequestException('Running late extension has already been used for this token.');
      if (!['booked', 'arrived', 'verification', 'quality_check'].includes(String(token.status))) throw new BadRequestException('Cannot extend current token');
      await rows(tx, `update tokens set running_late_used = true, grace_until = now() + interval '15 minutes', updated_at = now() where id = $1`, Number(tokenId));
      await this.events.enqueue(tx, { type: 'POSITION_UPDATE', centerId: token.center_id, farmerId: token.farmer_id, tokenNumber: token.token_number, status: token.status });
      return { token_id: Number(tokenId), running_late_used: true, extended_until: token.end_time ? `${token.end_time} + 15 mins` : 'Extended (+15 mins)' };
    });
  }

  @Get('bookings/my')
  async my(@Query('farmerId') farmerId?: string) {
    if (!farmerId) return [];
    return rows(
      this.db,
      `select t.id token_id, t.id, t.token_number, t.status, t.payment_status, t.payment_amount, t.created_at,
              c.id::text center_id, c.name center, c.name center_name, c.location center_location,
              s.id slot_id, s.slot_date as date, s.start_time, s.end_time,
              f.id::text farmer_id, f.name farmer_name, f.crop, f.quantity
         from tokens t join centers c on c.id = t.center_id join slots s on s.id = t.slot_id join farmers f on f.id = t.farmer_id
        where t.farmer_id = $1
        order by t.created_at desc`,
      farmerId,
    );
  }

  private async ensureSlots(centerId: string | undefined, date: string, db: Tx | DatabaseService) {
    if (!centerId) throw new BadRequestException('centerId is required');
    const existing = await rows(db, `select *, slot_date as date, greatest(total_slots - booked_count, 0) as remaining, booked_count >= total_slots as full from slots where center_id = $1 and slot_date = $2::date order by start_time`, centerId, date);
    if (existing.length) return existing;
    return this.db.$transaction(async (tx) => {
      const center = await first<{ capacity_per_hour: number }>(tx, 'select capacity_per_hour from centers where id = $1', centerId);
      if (!center) throw new BadRequestException('Center not found');
      for (const [start, end] of hours) {
        await rows(tx, `insert into slots (center_id, slot_date, start_time, end_time, total_slots, booked_count) values ($1, $2::date, $3, $4, $5, 0) on conflict do nothing`, centerId, date, start, end, center.capacity_per_hour ?? 25);
      }
      return rows(tx, `select *, slot_date as date, greatest(total_slots - booked_count, 0) as remaining, booked_count >= total_slots as full from slots where center_id = $1 and slot_date = $2::date order by start_time`, centerId, date);
    });
  }

  private async bookToken(body: Record<string, any>, via: string) {
    const farmerId = String(body.farmer_id ?? '');
    const centerId = String(body.center_id ?? '');
    const slotId = Number(body.slot_id);
    if (!farmerId || !centerId || !slotId) throw new BadRequestException('farmer_id, center_id and slot_id are required');
    return this.db.$transaction(async (tx) => {
      const slot = await first<Record<string, any>>(tx, 'select * from slots where id = $1 for update', slotId);
      if (!slot) throw new BadRequestException('Slot not found');
      if (String(slot.center_id) !== centerId) throw new BadRequestException('Selected slot does not belong to this center');
      if (Number(slot.booked_count) >= Number(slot.total_slots)) throw new BadRequestException('This slot is full. Please choose another slot.');
      const center = await first<Record<string, any>>(tx, 'select * from centers where id = $1', centerId);
      const farmer = await first<Record<string, any>>(tx, 'select * from farmers where id = $1', farmerId);
      if (!center || !farmer) throw new BadRequestException('Center or farmer not found');
      const seq = await first<{ n: string }>(tx, `select nextval('token_number_seq')::text n`);
      const ymd = new Date(slot.slot_date).toISOString().slice(2, 10).replaceAll('-', '');
      const tokenNumber = `${center.code ?? 'PC'}-${ymd}-${seq?.n}`;
      const token = await first<{ id: number }>(
        tx,
        `insert into tokens (token_number, farmer_id, center_id, slot_id, status, booked_via)
         values ($1, $2, $3, $4, 'booked', $5) returning id`,
        tokenNumber,
        farmerId,
        centerId,
        slotId,
        body.booked_via ?? via,
      );
      await rows(tx, 'update slots set booked_count = booked_count + 1 where id = $1', slotId);
      const msg = `Appointment confirmed! Token ${tokenNumber} at ${center.name} on ${String(slot.slot_date).slice(0, 10)} between ${slot.start_time}-${slot.end_time}.`;
      await rows(tx, `insert into notifications (farmer_id, channel, message, notification_type, status) values ($1, 'app', $2, 'booking', 'sent')`, farmerId, msg);
      await this.events.enqueue(tx, { type: 'TOKEN_BOOKED', centerId, farmerId, tokenNumber, status: 'booked' });
      return { token_id: token?.id, token_number: tokenNumber, date: new Date(slot.slot_date).toISOString().slice(0, 10), time: `${slot.start_time} - ${slot.end_time}`, center: center.name, farmer: farmer.name, farmer_mobile: farmer.mobile };
    });
  }
}
