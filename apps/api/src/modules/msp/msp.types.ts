import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CROP_CATEGORIES = ['Cereal', 'Pulse', 'Oilseed', 'Commercial', 'Nutri-Cereal'] as const;
export type CropCategory = (typeof CROP_CATEGORIES)[number];

export const createMspRateSchema = z.object({
  crop: z.string().min(2, 'Crop name is required').max(100),
  category: z.string().min(2).max(50),
  season: z.string().min(2).max(50),
  price_per_quintal: z.coerce.number().positive('Price must be greater than zero'),
  bonus_per_quintal: z.coerce.number().nonnegative().optional().default(0),
  market_average: z.coerce.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateMspRateInput = z.infer<typeof createMspRateSchema>;

export class CreateMspRateDto {
  @ApiProperty({ type: String, example: 'Wheat', description: 'Notified agricultural commodity name' })
  crop!: string;

  @ApiProperty({ type: String, example: 'Cereal', description: 'Commodity category classification' })
  category!: string;

  @ApiProperty({ type: String, example: 'Rabi 2025-26', description: 'Procurement crop marketing season' })
  season!: string;

  @ApiProperty({ type: Number, example: 2275.0, description: 'Statutory Base MSP rate in INR per quintal' })
  price_per_quintal!: number;

  @ApiProperty({ type: Number, example: 125.0, required: false, description: 'State bonus or procurement incentive in INR per quintal' })
  bonus_per_quintal?: number;

  @ApiProperty({ type: Number, example: 2150.0, required: false, description: 'Average APMC open market spot price for arbitrage tracking' })
  market_average?: number;

  @ApiProperty({ type: String, example: 'Official CCEA floor price notification', required: false, description: 'Administrative reference notes' })
  notes?: string;
}

export const updateMspRateSchema = z.object({
  price_per_quintal: z.coerce.number().positive().optional(),
  bonus_per_quintal: z.coerce.number().nonnegative().optional(),
  market_average: z.coerce.number().positive().optional(),
  season: z.string().min(2).max(50).optional(),
  is_active: z.boolean().optional(),
  reason: z.string().min(3, 'Audit reason for rate modification is mandatory').max(255),
  notes: z.string().max(500).optional(),
});

export type UpdateMspRateInput = z.infer<typeof updateMspRateSchema>;

export class UpdateMspRateDto {
  @ApiProperty({ type: Number, example: 2425.0, required: false, description: 'Updated Base MSP rate per quintal' })
  price_per_quintal?: number;

  @ApiProperty({ type: Number, example: 125.0, required: false, description: 'Updated state incentive bonus per quintal' })
  bonus_per_quintal?: number;

  @ApiProperty({ type: Number, example: 2200.0, required: false, description: 'Updated average APMC open market price' })
  market_average?: number;

  @ApiProperty({ type: String, example: 'Rabi 2025-26', required: false, description: 'Updated season' })
  season?: string;

  @ApiProperty({ type: Boolean, example: true, required: false, description: 'Active status for procurement calculation' })
  is_active?: boolean;

  @ApiProperty({ type: String, example: 'Cabinet Committee on Economic Affairs (CCEA) Kharif revision', description: 'Reason for rate change' })
  reason!: string;

  @ApiProperty({ type: String, example: 'Notified via Gazette S.O. 4521(E)', required: false, description: 'Administrative notes' })
  notes?: string;
}
