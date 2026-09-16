import { Controller, Get, Inject, Query } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from '../../common/decorators/access';
import { DatabaseService, rows } from '../../infrastructure/database/database.service';

export interface CommodityRecord {
  id: number;
  cmdt_name: string;
  image_name: string | null;
  group_id: number;
  group_name: string;
  status: number | string;
}

let cachedCommodities: CommodityRecord[] | null = null;

function loadCommodities(): CommodityRecord[] {
  if (cachedCommodities) return cachedCommodities;
  const candidates = [
    path.join(__dirname, '../../data/commodities.json'),
    path.join(__dirname, '../../../src/data/commodities.json'),
    path.join(process.cwd(), 'src/data/commodities.json'),
    path.join(process.cwd(), 'apps/api/src/data/commodities.json'),
    path.join(process.cwd(), 'commodities.json'),
    path.join(process.cwd(), '../commodities.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
        cachedCommodities = (raw.data || []).filter(
          (c: any) => c.id !== 0 && c.id !== 9999 && c.id !== 99999
        );
        return cachedCommodities!;
      }
    } catch {
      // continue searching
    }
  }
  return [];
}

const centerSelect = `
  id::text, code, name, state, district, location, distance_km,
  capacity_per_hour, counters, avg_processing_min, daily_capacity,
  market_id, state_id, district_id, coalesce(classification, 'APMC (Regulated)') as classification
`;

@Controller('locations')
export class LocationsController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Public()
  @Get('states')
  states() {
    return rows(this.db, `select distinct state from centers where state is not null order by state`);
  }

  @Public()
  @Get('districts')
  districts(@Query('state') state?: string) {
    return rows(
      this.db,
      `select distinct district from centers
        where district is not null and ($1::text is null or state = $1)
        order by district`,
      state ?? null,
    );
  }

  @Public()
  @Get('classifications')
  classifications() {
    return rows(this.db, `select distinct coalesce(classification, 'APMC (Regulated)') as classification from centers order by classification`);
  }

  @Public()
  @Get('commodities/groups')
  commodityGroups() {
    const list = loadCommodities();
    const map = new Map<string, { id: number; name: string; count: number }>();
    for (const item of list) {
      if (!map.has(item.group_name)) {
        map.set(item.group_name, { id: item.group_id, name: item.group_name, count: 0 });
      }
      map.get(item.group_name)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  @Public()
  @Get('commodities')
  commodities(
    @Query('group') group?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    let list = loadCommodities();
    if (group && group !== 'All') {
      list = list.filter((c) => c.group_name.toLowerCase() === group.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.cmdt_name.toLowerCase().includes(q) || c.group_name.toLowerCase().includes(q)
      );
    }
    const max = limit ? parseInt(limit, 10) : 150;
    return list.slice(0, isNaN(max) ? 150 : max);
  }

  @Public()
  @Get('centers')
  async centers(
    @Query('state') state?: string,
    @Query('district') district?: string,
    @Query('classification') classification?: string,
    @Query('search') search?: string,
  ) {
    return listCenters(this.db, { state, district, classification, search, limit: 100 });
  }
}

export async function listCenters(
  db: DatabaseService,
  opts: { date?: string; state?: string; district?: string; classification?: string; search?: string; limit?: number },
) {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  return rows(
    db,
    `select ${centerSelect},
            coalesce(q.waiting, 0)::int as waiting,
            case when coalesce(q.waiting, 0) < coalesce(nullif(c.daily_capacity, 0), coalesce(c.capacity_per_hour, 25) * 7) * 0.8
                 then 'Available' else 'Busy' end as status
       from centers c
       left join lateral (
         select count(*) waiting
           from tokens t join slots s on s.id = t.slot_id
          where t.center_id = c.id
            and s.slot_date = $1::date
            and lower(t.status) in ('booked','arrived','verification','quality_check')
       ) q on true
      where ($2::text is null or c.state = $2)
        and ($3::text is null or c.district = $3)
        and ($4::text is null or coalesce(c.classification, 'APMC (Regulated)') = $4)
        and ($5::text is null or c.name ilike '%' || $5 || '%' or c.code ilike '%' || $5 || '%' or c.location ilike '%' || $5 || '%')
      order by c.state nulls last, c.district nulls last, c.name
      limit $6`,
    date,
    opts.state ?? null,
    opts.district ?? null,
    opts.classification ?? null,
    opts.search ?? null,
    opts.limit ?? 100,
  );
}
