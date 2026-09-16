import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const DOMAIN_STATES = [
  'booked',
  'arrived',
  'verification',
  'quality_check',
  'accepted',
  'procured',
  'payment_processing',
  'payment_completed',
] as const;

export type DomainState = (typeof DOMAIN_STATES)[number] | 'rejected';
export type ProcurementState = DomainState;

export const TERMINAL_STATES = ['payment_completed', 'rejected'] as const;

export function mapToLotStatus(status: string): 'GATE_ENTRY' | 'WEIGHING' | 'QC' | 'ACCEPTED' | 'REJECTED' {
  const s = String(status).toLowerCase();
  if (s === 'arrived') return 'GATE_ENTRY';
  if (s === 'verification') return 'WEIGHING';
  if (s === 'quality_check') return 'QC';
  if (['accepted', 'procured', 'payment_processing', 'payment_completed'].includes(s)) return 'ACCEPTED';
  if (s === 'rejected') return 'REJECTED';
  return 'GATE_ENTRY';
}

export const weighingSchema = z.object({
  gross_weight: z.coerce.number().positive('gross_weight must be greater than 0'),
  tare_weight: z.coerce.number().positive('tare_weight must be greater than 0'),
}).refine(d => d.gross_weight > d.tare_weight, {
  message: 'gross_weight must be greater than tare_weight',
  path: ['gross_weight'],
});

export type WeighingInput = z.infer<typeof weighingSchema>;

export const qualityCheckSchema = z.object({
  moisture_percent: z.coerce.number().min(0).max(100, 'moisture_percent must be between 0 and 100'),
  quality_pass: z.boolean(),
  reject_reason: z.string().max(255).optional(),
});

export type QualityCheckInput = z.infer<typeof qualityCheckSchema>;

export const rejectSchema = z.object({
  reject_reason: z.string().min(1, 'reject_reason is required').max(255),
});

export type RejectInput = z.infer<typeof rejectSchema>;

export const statusUpdateSchema = z.object({
  status: z.string().min(1),
  gross_weight: z.coerce.number().optional(),
  tare_weight: z.coerce.number().optional(),
  moisture_percent: z.coerce.number().optional(),
  quality_pass: z.boolean().optional(),
  reject_reason: z.string().optional(),
});

export class WeighingInputDto {
  @ApiProperty({ type: Number, example: 1250.5, description: 'Gross loaded vehicle weight in kg' })
  gross_weight!: number;

  @ApiProperty({ type: Number, example: 450.0, description: 'Tare empty vehicle weight in kg' })
  tare_weight!: number;
}

export class QualityCheckInputDto {
  @ApiProperty({ type: Number, example: 11.5, description: 'Moisture percentage (0-100%)' })
  moisture_percent!: number;

  @ApiProperty({ type: Boolean, example: true, description: 'Quality inspection result' })
  quality_pass!: boolean;

  @ApiProperty({ type: String, required: false, example: 'Excessive foreign matter', description: 'Rejection reason if quality_pass is false' })
  reject_reason?: string;
}

export class RejectInputDto {
  @ApiProperty({ type: String, example: 'Grain discoloration above acceptable MSP threshold', description: 'Reason for rejecting procurement lot' })
  reject_reason!: string;
}

export class StatusUpdateDto {
  @ApiProperty({ type: String, example: 'procured', description: 'Target procurement domain state' })
  status!: string;

  @ApiProperty({ type: Number, required: false, example: 1250.5 })
  gross_weight?: number;

  @ApiProperty({ type: Number, required: false, example: 450.0 })
  tare_weight?: number;

  @ApiProperty({ type: Number, required: false, example: 11.5 })
  moisture_percent?: number;

  @ApiProperty({ type: Boolean, required: false, example: true })
  quality_pass?: boolean;

  @ApiProperty({ type: String, required: false, example: 'Rejection reason' })
  reject_reason?: string;
}

export interface ProcurementResponseDto {
  id: string;
  farmerId: string;
  farmer_id: string;
  centerId: string;
  center_id: string;
  centerName: string;
  center_name: string;
  lotStatus: 'GATE_ENTRY' | 'WEIGHING' | 'QC' | 'ACCEPTED' | 'REJECTED';
  status: string;
  grossWeight?: number | null;
  gross_weight?: number | null;
  tareWeight?: number | null;
  tare_weight?: number | null;
  netWeight?: number | null;
  net_weight?: number | null;
  moisturePercent?: number | null;
  moisture_percent?: number | null;
  qualityPass?: boolean | null;
  quality_pass?: boolean | null;
  staffId?: string | null;
  staff_id?: string | null;
  startedAt: string;
  started_at: string;
  completedAt?: string | null;
  completed_at?: string | null;
  bookingId: string;
  booking_id: string;
  tokenNumber: string;
  token_number: string;
  bookingDate: string;
  date: string;
  timeWindowStart: string;
  start_time: string;
  timeWindowEnd: string;
  end_time: string;
  crop?: string | null;
  quantity?: number | null;
  farmerName?: string | null;
  farmer_name?: string | null;
  mobile?: string | null;
  rejectReason?: string | null;
  reject_reason?: string | null;
  tamper_evident_seal?: string | null;
  tee_attestation?: {
    verified: boolean;
    algorithm: string;
    enclave_id: string;
    seal: string;
    timestamp: string;
  } | null;
}

