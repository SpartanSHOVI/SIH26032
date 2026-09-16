export type CenterPaymentMethod = 'online' | 'cash';

export function isAssistantBooking(bookedVia: unknown) {
  return String(bookedVia ?? '').trim().toLowerCase() === 'call';
}

export function getCenterPaymentPolicy(bookedVia: unknown) {
  const cashOnly = isAssistantBooking(bookedVia);
  return {
    cashOnly,
    defaultMethod: (cashOnly ? 'cash' : 'online') as CenterPaymentMethod,
    methodLabel: cashOnly ? 'Cash at Mandi Counter' : 'PFMS / DBT Online',
  };
}
