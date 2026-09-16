import { Injectable } from '@nestjs/common';
import { PaymentStatus } from './payment.types';

export const UTR_REGEX = /^PFMS[A-Z0-9]{8}DBT\d{8}$/;

@Injectable()
export class PfmsAdapterService {
  /**
   * Deterministic next state in the PFMS DBT lifecycle:
   * PENDING -> PROCESSING -> CREDITED
   */
  getNextStatus(current: PaymentStatus): PaymentStatus {
    const s = String(current).toUpperCase() as PaymentStatus;
    switch (s) {
      case 'PENDING':
        return 'PROCESSING';
      case 'PROCESSING':
        return 'CREDITED';
      case 'CREDITED':
        return 'CREDITED'; // Idempotent terminal
      case 'FAILED':
      case 'REVERSED':
        return s;
      default:
        return 'PENDING';
    }
  }

  /**
   * Generate standard RBI / PFMS format UTR string:
   * e.g. PFMS1A2B3C4DDBT20260912
   */
  generateUtrReference(identifier: string, date = new Date()): string {
    const cleanId = String(identifier).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const hashPart = (cleanId + '00000000').slice(0, 8);
    const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
    return `PFMS${hashPart}DBT${datePart}`;
  }

  /**
   * Validate standard UTR format string
   */
  validateUtrFormat(utr: string): boolean {
    return UTR_REGEX.test(utr);
  }

  isValidUtrReference(utr: string): boolean {
    return this.validateUtrFormat(utr);
  }

  /**
   * Deterministic mock verification of PFMS payment response
   */
  simulatePfmsResponse(utr: string, amount: number, status: PaymentStatus): Record<string, any> {
    return {
      gateway: 'PFMS-DBT-DIRECT',
      scheme_code: 'MSP-CENTRAL-PROCUREMENT',
      status: status === 'CREDITED' ? 'CREDITED' : (status === 'PROCESSING' ? 'PROCESSING' : 'PENDING'),
      status_code: status === 'CREDITED' ? 'PFMS_SUCCESS' : 'PFMS_IN_PROGRESS',
      utr_number: utr,
      amount,
      settlement_amount: amount,
      response_code: status === 'CREDITED' ? '00' : '01',
      response_message: status === 'CREDITED' ? 'Amount successfully credited via DBT to Aadhaar-linked bank account' : 'Transaction pending with beneficiary bank',
      bank_ref_no: `SBIN${Math.floor(10000000 + Math.random() * 90000000)}`,
      credited_date: status === 'CREDITED' ? new Date().toISOString() : null,
      timestamp: new Date().toISOString(),
    };
  }
}
