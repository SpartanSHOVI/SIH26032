import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService, first, rows } from '../../infrastructure/database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { Principal } from '../auth/auth.types';
import {
  CreateMspRateDto,
  createMspRateSchema,
  UpdateMspRateDto,
  updateMspRateSchema,
} from './msp.types';

export interface MspRateRecord {
  id: string;
  crop: string;
  category: string;
  season: string;
  price_per_quintal: number;
  bonus_per_quintal: number;
  effective_price: number;
  market_average: number | null;
  effective_date: string;
  is_active: boolean;
  source: string;
  updated_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MspAuditRecord {
  id: string;
  msp_rate_id: string;
  crop: string;
  previous_price: number;
  new_price: number;
  previous_bonus: number;
  new_bonus: number;
  reason: string;
  updated_by: string;
  changed_at: string;
}

const OFFICIAL_BENCHMARKS = [
  { crop: 'Wheat', category: 'Cereal', season: 'Rabi 2025-26', price: 2275.0, bonus: 0.0, market: 2150.0, notes: 'Statutory floor rate notified by Ministry of Agriculture & Farmers Welfare' },
  { crop: 'Paddy (Common)', category: 'Cereal', season: 'Kharif 2025-26', price: 2183.0, bonus: 0.0, market: 2020.0, notes: 'Common grade paddy standard procurement floor' },
  { crop: 'Paddy (Grade A)', category: 'Cereal', season: 'Kharif 2025-26', price: 2203.0, bonus: 0.0, market: 2080.0, notes: 'Grade A fine paddy procurement rate' },
  { crop: 'Mustard', category: 'Oilseed', season: 'Rabi 2025-26', price: 5650.0, bonus: 0.0, market: 5200.0, notes: 'Rapeseed and mustard seed standard MSP' },
  { crop: 'Gram (Chana)', category: 'Pulse', season: 'Rabi 2025-26', price: 5440.0, bonus: 0.0, market: 5100.0, notes: 'Chana / Bengal Gram statutory procurement floor' },
  { crop: 'Soybean (Yellow)', category: 'Oilseed', season: 'Kharif 2025-26', price: 4600.0, bonus: 0.0, market: 4350.0, notes: 'Yellow Soybean MSP guarantee' },
  { crop: 'Maize', category: 'Cereal', season: 'Kharif 2025-26', price: 2090.0, bonus: 0.0, market: 1950.0, notes: 'Corn / Maize support price' },
  { crop: 'Cotton (Medium Staple)', category: 'Commercial', season: 'Kharif 2025-26', price: 6620.0, bonus: 0.0, market: 6400.0, notes: 'Medium staple cotton support price' },
  { crop: 'Cotton (Long Staple)', category: 'Commercial', season: 'Kharif 2025-26', price: 7020.0, bonus: 0.0, market: 6800.0, notes: 'Long staple premium cotton support price' },
  { crop: 'Bajra (Pearl Millet)', category: 'Nutri-Cereal', season: 'Kharif 2025-26', price: 2500.0, bonus: 0.0, market: 2300.0, notes: 'Pearl millet nutri-cereal procurement floor' },
  { crop: 'Moong', category: 'Pulse', season: 'Kharif 2025-26', price: 8558.0, bonus: 0.0, market: 8100.0, notes: 'Green gram / Moong support price' },
  { crop: 'Urad', category: 'Pulse', season: 'Kharif 2025-26', price: 6950.0, bonus: 0.0, market: 6600.0, notes: 'Black gram / Urad support price' },
  { crop: 'Groundnut', category: 'Oilseed', season: 'Kharif 2025-26', price: 6377.0, bonus: 0.0, market: 5900.0, notes: 'Groundnut pod support price' },
  { crop: 'Jowar', category: 'Nutri-Cereal', season: 'Kharif 2025-26', price: 3180.0, bonus: 0.0, market: 2900.0, notes: 'Sorghum / Jowar hybrid rate' },
  { crop: 'Barley', category: 'Cereal', season: 'Rabi 2025-26', price: 1850.0, bonus: 0.0, market: 1720.0, notes: 'Rabi barley floor price' },
  { crop: 'Lentil (Masur)', category: 'Pulse', season: 'Rabi 2025-26', price: 6425.0, bonus: 0.0, market: 6100.0, notes: 'Masur pulse procurement rate' },
];

@Injectable()
export class MspService {
  private readonly logger = new Logger(MspService.name);
  private readonly CACHE_ALL_KEY = 'annsetu:msp:rates:all';
  private readonly CACHE_CROP_PREFIX = 'annsetu:msp:crop:';

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  /**
   * Fetch all statutory MSP rates with caching and optional filters
   */
  async getAllRates(query?: {
    category?: string;
    season?: string;
    active_only?: boolean;
    search?: string;
  }): Promise<MspRateRecord[]> {
    const activeOnly = query?.active_only ?? false;
    const category = query?.category?.trim();
    const season = query?.season?.trim();
    const search = query?.search?.trim().toLowerCase();

    // Redis cache hit for unfiltered all rates
    if (!category && !season && !activeOnly && !search) {
      try {
        const cached = await this.redis.get(this.CACHE_ALL_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        this.logger.warn(`Redis get failed for MSP cache: ${(err as Error).message}`);
      }
    }

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (activeOnly) {
      conditions.push('r.is_active = true');
    }
    if (category) {
      params.push(category);
      conditions.push(`lower(r.category) = lower($${params.length})`);
    }
    if (season) {
      params.push(season);
      conditions.push(`lower(r.season) = lower($${params.length})`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(lower(r.crop) like $${params.length} or lower(r.category) like $${params.length})`);
    }

    const sql = `
      select r.id::text,
             r.crop,
             r.category,
             r.season,
             r.price_per_quintal::float,
             r.bonus_per_quintal::float,
             (r.price_per_quintal + r.bonus_per_quintal)::float as effective_price,
             r.market_average::float,
             r.effective_date::text,
             r.is_active,
             r.source,
             r.updated_by,
             r.notes,
             r.created_at::text,
             r.updated_at::text
        from msp_rates r
       where ${conditions.join(' and ')}
       order by r.category asc, r.crop asc
    `;

    const rawRows = await rows<Record<string, any>>(this.db, sql, ...params);

    const formatted: MspRateRecord[] = rawRows.map(r => ({
      id: r.id,
      crop: r.crop,
      category: r.category,
      season: r.season,
      price_per_quintal: Number(r.price_per_quintal),
      bonus_per_quintal: Number(r.bonus_per_quintal || 0),
      effective_price: Number(r.effective_price || r.price_per_quintal),
      market_average: r.market_average ? Number(r.market_average) : null,
      effective_date: r.effective_date,
      is_active: Boolean(r.is_active),
      source: r.source,
      updated_by: r.updated_by,
      notes: r.notes,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    // Cache when it's the full unconstrained list
    if (!category && !season && !activeOnly && !search) {
      try {
        await this.redis.set(this.CACHE_ALL_KEY, JSON.stringify(formatted), 'EX', 300); // 5 min TTL
      } catch (err) {
        this.logger.warn(`Redis set failed for MSP cache: ${(err as Error).message}`);
      }
    }

    return formatted;
  }

  /**
   * Get specific MSP rate for a crop with fuzzy fallback and Redis caching
   */
  async getRateForCrop(cropName?: string): Promise<{
    crop: string;
    category: string;
    season: string;
    price_per_quintal: number;
    bonus_per_quintal: number;
    effective_price: number;
    market_average: number | null;
  }> {
    const raw = (cropName || 'Wheat').trim();
    const normalizedKey = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cacheKey = `${this.CACHE_CROP_PREFIX}${normalizedKey}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // ignore redis error
    }

    // 1. Try exact match
    let record = await first<Record<string, any>>(
      this.db,
      `select crop, category, season,
              price_per_quintal::float, bonus_per_quintal::float,
              (price_per_quintal + bonus_per_quintal)::float as effective_price,
              market_average::float
         from msp_rates
        where lower(crop) = lower($1) and is_active = true
        limit 1`,
      raw,
    );

    // 2. Try prefix or substring match if exact not found
    if (!record) {
      record = await first<Record<string, any>>(
        this.db,
        `select crop, category, season,
                price_per_quintal::float, bonus_per_quintal::float,
                (price_per_quintal + bonus_per_quintal)::float as effective_price,
                market_average::float
           from msp_rates
          where is_active = true
            and (lower(crop) like lower($1) || '%' or lower($1) like '%' || lower(crop) || '%')
          order by length(crop) asc
          limit 1`,
        raw,
      );
    }

    const result = record
      ? {
          crop: record.crop,
          category: record.category,
          season: record.season,
          price_per_quintal: Number(record.price_per_quintal),
          bonus_per_quintal: Number(record.bonus_per_quintal || 0),
          effective_price: Number(record.effective_price || record.price_per_quintal),
          market_average: record.market_average ? Number(record.market_average) : null,
        }
      : {
          crop: raw,
          category: 'Cereal',
          season: 'Statutory Floor',
          price_per_quintal: 2275.0,
          bonus_per_quintal: 0.0,
          effective_price: 2275.0,
          market_average: 2150.0,
        };

    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 600); // 10 min TTL
    } catch {
      // ignore
    }

    return result;
  }

  /**
   * Create a new notified crop MSP rate (Admin / Nodal Officer)
   */
  async createRate(dto: CreateMspRateDto, actor?: Principal): Promise<MspRateRecord> {
    const validated = createMspRateSchema.parse(dto);
    const actorName = actor?.sub || 'Nodal Officer';

    // Check if crop already exists
    const existing = await first<{ id: string }>(
      this.db,
      `select id::text from msp_rates where lower(crop) = lower($1) limit 1`,
      validated.crop.trim(),
    );
    if (existing) {
      throw new BadRequestException(`Crop '${validated.crop}' already exists in MSP rates. Use update instead.`);
    }

    const inserted = await first<Record<string, any>>(
      this.db,
      `insert into msp_rates (
         crop, category, season, price_per_quintal, bonus_per_quintal,
         market_average, source, updated_by, notes
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9
       ) returning id::text, crop, category, season,
                   price_per_quintal::float, bonus_per_quintal::float,
                   (price_per_quintal + bonus_per_quintal)::float as effective_price,
                   market_average::float, effective_date::text, is_active,
                   source, updated_by, notes, created_at::text, updated_at::text`,
      validated.crop.trim(),
      validated.category.trim(),
      validated.season.trim(),
      validated.price_per_quintal,
      validated.bonus_per_quintal || 0,
      validated.market_average || null,
      'Nodal Officer Gazette Determination',
      actorName,
      validated.notes || 'Initial crop notification',
    );

    if (!inserted) {
      throw new BadRequestException('Failed to create MSP rate');
    }

    // Insert initial audit record
    await rows(
      this.db,
      `insert into msp_audit_logs (
         msp_rate_id, crop, previous_price, new_price,
         previous_bonus, new_bonus, reason, updated_by
       ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)`,
      inserted.id,
      inserted.crop,
      0.0,
      Number(inserted.price_per_quintal),
      0.0,
      Number(inserted.bonus_per_quintal),
      'Initial Statutory Commodity Notification',
      actorName,
    );

    await this.invalidateCache();

    return {
      id: inserted.id,
      crop: inserted.crop,
      category: inserted.category,
      season: inserted.season,
      price_per_quintal: Number(inserted.price_per_quintal),
      bonus_per_quintal: Number(inserted.bonus_per_quintal),
      effective_price: Number(inserted.effective_price),
      market_average: inserted.market_average ? Number(inserted.market_average) : null,
      effective_date: inserted.effective_date,
      is_active: Boolean(inserted.is_active),
      source: inserted.source,
      updated_by: inserted.updated_by,
      notes: inserted.notes,
      created_at: inserted.created_at,
      updated_at: inserted.updated_at,
    };
  }

  /**
   * Update existing MSP rate or state incentive bonus with mandatory audit reason
   */
  async updateRate(id: string, dto: UpdateMspRateDto, actor?: Principal): Promise<MspRateRecord> {
    const validated = updateMspRateSchema.parse(dto);
    const actorName = actor?.sub || 'Nodal Officer';

    const existing = await first<Record<string, any>>(
      this.db,
      `select id::text, crop, price_per_quintal::float, bonus_per_quintal::float,
              season, is_active, notes
         from msp_rates
        where id = $1::uuid limit 1`,
      id,
    );

    if (!existing) {
      throw new NotFoundException(`MSP rate record with ID '${id}' not found`);
    }

    const previousPrice = Number(existing.price_per_quintal);
    const previousBonus = Number(existing.bonus_per_quintal || 0);

    const newPrice = validated.price_per_quintal !== undefined ? validated.price_per_quintal : previousPrice;
    const newBonus = validated.bonus_per_quintal !== undefined ? validated.bonus_per_quintal : previousBonus;
    const newSeason = validated.season !== undefined ? validated.season : existing.season;
    const newIsActive = validated.is_active !== undefined ? validated.is_active : existing.is_active;
    const newNotes = validated.notes !== undefined ? validated.notes : existing.notes;
    const newMarketAverage = validated.market_average;

    const updated = await first<Record<string, any>>(
      this.db,
      `update msp_rates
          set price_per_quintal = $1,
              bonus_per_quintal = $2,
              season = $3,
              is_active = $4,
              notes = $5,
              market_average = coalesce($6, market_average),
              updated_by = $7,
              updated_at = CURRENT_TIMESTAMP
        where id = $8::uuid
        returning id::text, crop, category, season,
                  price_per_quintal::float, bonus_per_quintal::float,
                  (price_per_quintal + bonus_per_quintal)::float as effective_price,
                  market_average::float, effective_date::text, is_active,
                  source, updated_by, notes, created_at::text, updated_at::text`,
      newPrice,
      newBonus,
      newSeason,
      newIsActive,
      newNotes,
      newMarketAverage ?? null,
      actorName,
      id,
    );

    if (!updated) {
      throw new NotFoundException('Failed to update MSP rate');
    }

    // Record audit trail
    await rows(
      this.db,
      `insert into msp_audit_logs (
         msp_rate_id, crop, previous_price, new_price,
         previous_bonus, new_bonus, reason, updated_by
       ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)`,
      id,
      existing.crop,
      previousPrice,
      newPrice,
      previousBonus,
      newBonus,
      validated.reason,
      actorName,
    );

    await this.invalidateCache();

    return {
      id: updated.id,
      crop: updated.crop,
      category: updated.category,
      season: updated.season,
      price_per_quintal: Number(updated.price_per_quintal),
      bonus_per_quintal: Number(updated.bonus_per_quintal),
      effective_price: Number(updated.effective_price),
      market_average: updated.market_average ? Number(updated.market_average) : null,
      effective_date: updated.effective_date,
      is_active: Boolean(updated.is_active),
      source: updated.source,
      updated_by: updated.updated_by,
      notes: updated.notes,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  /**
   * Sync official CCEA/CACP statutory benchmarks
   */
  async syncOfficialBenchmarks(actor?: Principal): Promise<{
    synced_count: number;
    updated_crops: string[];
    timestamp: string;
  }> {
    const actorName = actor?.sub || 'Statutory Sync System';
    const updatedCrops: string[] = [];

    for (const b of OFFICIAL_BENCHMARKS) {
      const existing = await first<Record<string, any>>(
        this.db,
        `select id::text, crop, price_per_quintal::float, bonus_per_quintal::float
           from msp_rates
          where lower(crop) = lower($1) limit 1`,
        b.crop,
      );

      if (existing) {
        const curPrice = Number(existing.price_per_quintal);
        if (curPrice !== b.price) {
          await rows(
            this.db,
            `update msp_rates
                set price_per_quintal = $1,
                    market_average = $2,
                    season = $3,
                    source = 'CACP / CCEA Statutory Gazette (Live Sync)',
                    updated_by = $4,
                    updated_at = CURRENT_TIMESTAMP
              where id = $5::uuid`,
            b.price,
            b.market,
            b.season,
            actorName,
            existing.id,
          );

          await rows(
            this.db,
            `insert into msp_audit_logs (
               msp_rate_id, crop, previous_price, new_price,
               previous_bonus, new_bonus, reason, updated_by
             ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)`,
            existing.id,
            existing.crop,
            curPrice,
            b.price,
            Number(existing.bonus_per_quintal || 0),
            Number(existing.bonus_per_quintal || 0),
            'Automated CCEA Gazette Statutory Benchmark Re-alignment',
            actorName,
          );

          updatedCrops.push(b.crop);
        }
      } else {
        const inserted = await first<{ id: string }>(
          this.db,
          `insert into msp_rates (
             crop, category, season, price_per_quintal, bonus_per_quintal,
             market_average, source, updated_by, notes
           ) values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9
           ) returning id::text`,
          b.crop,
          b.category,
          b.season,
          b.price,
          b.bonus,
          b.market,
          'CACP / CCEA Statutory Gazette (Live Sync)',
          actorName,
          b.notes,
        );

        if (inserted) {
          await rows(
            this.db,
            `insert into msp_audit_logs (
               msp_rate_id, crop, previous_price, new_price,
               previous_bonus, new_bonus, reason, updated_by
             ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)`,
            inserted.id,
            b.crop,
            0.0,
            b.price,
            0.0,
            b.bonus,
            'Statutory Gazette Benchmark Crop Initial Registration',
            actorName,
          );
          updatedCrops.push(b.crop);
        }
      }
    }

    await this.invalidateCache();

    return {
      synced_count: updatedCrops.length,
      updated_crops: updatedCrops,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get immutable audit log history of rate and bonus revisions
   */
  async getAuditLogs(crop?: string, limit = 50): Promise<MspAuditRecord[]> {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (crop?.trim()) {
      params.push(crop.trim());
      conditions.push(`lower(crop) = lower($${params.length})`);
    }

    params.push(safeLimit);

    const logRows = await rows<Record<string, any>>(
      this.db,
      `select id::text,
              msp_rate_id::text,
              crop,
              previous_price::float,
              new_price::float,
              previous_bonus::float,
              new_bonus::float,
              reason,
              updated_by,
              changed_at::text
         from msp_audit_logs
        where ${conditions.join(' and ')}
        order by changed_at desc
        limit $${params.length}`,
      ...params,
    );

    return logRows.map(l => ({
      id: l.id,
      msp_rate_id: l.msp_rate_id,
      crop: l.crop,
      previous_price: Number(l.previous_price),
      new_price: Number(l.new_price),
      previous_bonus: Number(l.previous_bonus),
      new_bonus: Number(l.new_bonus),
      reason: l.reason,
      updated_by: l.updated_by,
      changed_at: l.changed_at,
    }));
  }

  /**
   * Clears Redis caches for all rates and per-crop lookups
   */
  private async invalidateCache(): Promise<void> {
    try {
      await this.redis.del(this.CACHE_ALL_KEY);
      // Clean per-crop keys
      const keys = await this.redis.keys(`${this.CACHE_CROP_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn(`Redis cache invalidation failed: ${(err as Error).message}`);
    }
  }
}
