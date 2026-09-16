import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Masks an Aadhaar number to display only the last 4 digits: XXXX-XXXX-1234
 */
export function maskAadhaar(val: string): string {
  const clean = String(val).replace(/[\s-]/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  const last4 = clean.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

/**
 * Masks a bank account number to show only the last 4 digits: XXXXXX1234
 */
export function maskBankAccount(val: string): string {
  const clean = String(val).trim();
  if (clean.length <= 4) return 'XXXXXX';
  const last4 = clean.slice(-4);
  return `XXXXXX${last4}`;
}

/**
 * Masks a 10-digit mobile number: 98XXXXXX10
 */
export function maskPhone(val: string): string {
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 2)}XXXXXX${clean.slice(-2)}`;
  }
  if (clean.length > 4) {
    return `${clean.slice(0, 2)}XXXX${clean.slice(-2)}`;
  }
  return 'XXXX';
}

const SENSITIVE_KEYS_TO_REMOVE = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'refresh_hash',
  'refreshhash',
  'csrf_hash',
  'csrfhash',
  'secret',
  'salt',
  'private_key',
  'privatekey',
]);

const AADHAAR_KEYS = new Set([
  'aadhaar',
  'aadhaarnumber',
  'aadhaar_number',
  'aadhaar_no',
]);

const BANK_KEYS = new Set([
  'bank_account',
  'bankaccount',
  'account_number',
  'accountnumber',
  'account_no',
]);

/**
 * Recursively redacts sensitive keys and masks PII in JSON objects/arrays
 */
export function sanitizeAndMaskPii(data: any, maskPhoneNumbers = false): any {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    // For collections/lists, mask phone numbers for zero data leakage
    return data.map((item) => sanitizeAndMaskPii(item, true));
  }

  if (typeof data === 'object' && !(data instanceof Date)) {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Completely strip sensitive credentials and internal hashes
      if (SENSITIVE_KEYS_TO_REMOVE.has(lowerKey)) {
        continue;
      }

      // Mask Aadhaar numbers
      if (AADHAAR_KEYS.has(lowerKey) && typeof value === 'string' && value.length > 0) {
        sanitized[key] = maskAadhaar(value);
        continue;
      }

      // Mask Bank accounts
      if (BANK_KEYS.has(lowerKey) && typeof value === 'string' && value.length > 0) {
        sanitized[key] = maskBankAccount(value);
        continue;
      }

      // Mask phone numbers in overview or public collections
      if (maskPhoneNumbers && (lowerKey === 'mobile' || lowerKey === 'phone') && typeof value === 'string') {
        sanitized[key] = maskPhone(value);
        continue;
      }

      sanitized[key] = sanitizeAndMaskPii(value, maskPhoneNumbers);
    }

    return sanitized;
  }

  return data;
}

@Injectable()
export class PiiMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const isPublicLookup = req?.path?.includes('/farmers/lookup') || req?.path?.includes('/admin/farmers');

    return next.handle().pipe(
      map((data) => sanitizeAndMaskPii(data, isPublicLookup)),
    );
  }
}
