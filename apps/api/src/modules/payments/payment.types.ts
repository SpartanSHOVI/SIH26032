import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const PAYMENT_STATES = ['PENDING', 'PROCESSING', 'CREDITED', 'FAILED', 'REVERSED'] as const;

export type PaymentStatus = (typeof PAYMENT_STATES)[number];

export const MSP_RATES: Record<string, number> = {
  Wheat: 2275,
  'Paddy (Common)': 2183,
  Paddy: 2183,
  'Mustard Seed': 5650,
  Mustard: 5650,
  Soybean: 4600,
  'Gram (Chana)': 5440,
  Gram: 5440,
};

export const updatePaymentStatusSchema = z.object({
  status: z.enum(PAYMENT_STATES),
  amount: z.coerce.number().positive().optional(),
  utr_reference: z.string().max(100).optional(),
  pfms_response: z.record(z.unknown()).optional(),
});

export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;

export class UpdatePaymentStatusDto {
  @ApiProperty({ type: String, enum: PAYMENT_STATES, example: 'PROCESSING', description: 'Next target payment state' })
  status!: PaymentStatus;

  @ApiProperty({ type: Number, required: false, example: 54600.0, description: 'Disbursed payment amount in INR' })
  amount?: number;

  @ApiProperty({ type: String, required: false, example: 'PFMS2026091212345678', description: 'Unique Transaction Reference (UTR) number' })
  utr_reference?: string;

  @ApiProperty({ required: false, type: Object, description: 'Raw PFMS gateway mock response payload' })
  pfms_response?: Record<string, unknown>;
}

export interface PaymentResponseDto {
  id: string;
  procurementLotId: string;
  procurement_lot_id: string;
  farmerId: string;
  farmer_id: string;
  amount: number;
  payment_amount: number;
  status: PaymentStatus;
  payment_status: PaymentStatus;
  utrReference?: string | null;
  utr_reference?: string | null;
  transactionRef?: string | null;
  transaction_ref?: string | null;
  creditedAt?: string | null;
  credited_at?: string | null;
  paymentAt?: string | null;
  payment_at?: string | null;
  pfmsResponse?: any;
  pfms_response?: any;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
  procurementLot?: {
    id: string;
    centerName: string;
    netWeight: number;
    bookingDate: string;
    tokenNumber: string;
  };
}
