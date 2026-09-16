import { BadRequestException } from '@nestjs/common';

export type PaymentMethod = 'online' | 'cash';

export function isAssistantBooking(bookedVia: unknown) {
  return String(bookedVia ?? '').trim().toLowerCase() === 'call';
}

export function resolvePaymentMethod(bookedVia: unknown, requestedMethod?: unknown): PaymentMethod {
  const assistantBooking = isAssistantBooking(bookedVia);
  const method = String(requestedMethod ?? (assistantBooking ? 'cash' : 'online')).trim().toLowerCase();

  if (method !== 'online' && method !== 'cash') {
    throw new BadRequestException('Payment method must be either online or cash');
  }
  if (assistantBooking && method !== 'cash') {
    throw new BadRequestException(
      'Assistant bookings do not contain verified bank details. Use cash payment at the mandi counter.',
    );
  }
  return method;
}

export function assertPfmsEligible(bookedVia: unknown) {
  if (isAssistantBooking(bookedVia)) {
    throw new BadRequestException(
      'PFMS/DBT is unavailable for assistant bookings because bank details were not collected. Use cash payment.',
    );
  }
}
