/**
 * Official Minimum Support Price (MSP) notified floor rates (₹ per Quintal)
 * Government of India, Commission for Agricultural Costs and Prices (CACP)
 */
export const MSP_RATES: Record<string, number> = {
  'Wheat': 2275,
  'Paddy': 2183,
  'Paddy (Common)': 2183,
  'Paddy (Grade A)': 2203,
  'Mustard': 5650,
  'Mustard Seed': 5650,
  'Rapeseed': 5650,
  'Soybean': 4600,
  'Soybean (Yellow)': 4600,
  'Gram': 5440,
  'Gram (Chana)': 5440,
  'Chana': 5440,
  'Bajra': 2500,
  'Bajra (Pearl Millet)': 2500,
  'Maize': 2090,
  'Cotton': 6620,
  'Cotton (Medium Staple)': 6620,
  'Cotton (Long Staple)': 7020,
  'Ragi': 3846,
  'Groundnut': 6377,
  'Moong': 8558,
  'Urad': 6950,
  'Jowar': 3180,
  'Barley': 1850,
};

export const getMspRate = (cropName?: string): number => {
  if (!cropName) return 2275;
  const normalized = cropName.trim();
  if (MSP_RATES[normalized]) return MSP_RATES[normalized];

  const lower = normalized.toLowerCase();
  for (const [key, rate] of Object.entries(MSP_RATES)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return rate;
    }
  }
  return 2275; // Default fallback to wheat MSP
};

export const calculateMspPayment = (cropName: string | undefined, quantityQuintals: number): number => {
  const rate = getMspRate(cropName);
  const qty = Math.max(0, quantityQuintals || 0);
  return Math.round(qty * rate);
};
