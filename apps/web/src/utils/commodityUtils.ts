import rawCommoditiesData from '../data/commodities.json';

export interface CommodityItem {
  id: number;
  cmdt_name: string;
  image_name: string | null;
  group_id: number;
  group_name: string;
  status: number | string;
}

export interface CommodityGroupSummary {
  id: number;
  name: string;
  count: number;
  icon?: string;
}

// Filter out meta aggregates (id 0, 9999, 99999)
export const ALL_COMMODITIES: CommodityItem[] = (
  (rawCommoditiesData as { data: CommodityItem[] }).data || []
).filter((c) => c.id !== 0 && c.id !== 9999 && c.id !== 99999);

// Group icon and color mapping for Indian agricultural classifications
export const GROUP_THEMES: Record<string, { icon: string; bg: string; text: string; border: string }> = {
  'Cereals': { icon: '🌾', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  'Pulses': { icon: '🌱', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'Oil Seeds': { icon: '🌻', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  'Fibre Crops': { icon: '🧵', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  'Spices': { icon: '🌶️', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  'Vegetables': { icon: '🥬', bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  'Fruits': { icon: '🍎', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  'Dry Fruits': { icon: '🥜', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  'Beverages': { icon: '☕', bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300' },
  'Flowers': { icon: '🌸', bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  'Medicinal and Aromatic Plants': { icon: '🌿', bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  'Forest Products': { icon: '🌲', bg: 'bg-lime-50', text: 'text-lime-800', border: 'border-lime-200' },
  'Oils and Fats': { icon: '🫗', bg: 'bg-yellow-100', text: 'text-yellow-900', border: 'border-yellow-300' },
  'Live Stock,Poultry,Fisheries': { icon: '🐄', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  'Drug and Narcotics': { icon: '🍃', bg: 'bg-stone-50', text: 'text-stone-800', border: 'border-stone-200' },
  'Others': { icon: '📦', bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' },
};

// Distinct groups summary
export const COMMODITY_GROUPS: CommodityGroupSummary[] = Object.values(
  ALL_COMMODITIES.reduce<Record<string, CommodityGroupSummary>>((acc, item) => {
    if (!acc[item.group_name]) {
      acc[item.group_name] = {
        id: item.group_id,
        name: item.group_name,
        count: 0,
        icon: GROUP_THEMES[item.group_name]?.icon || '🌾',
      };
    }
    acc[item.group_name].count += 1;
    return acc;
  }, {})
).sort((a, b) => b.count - a.count);

// Curated top MSP crops for fast 1-click selection
export const POPULAR_MSP_CROPS = [
  { name: 'Wheat', hindi: 'गेहूं', group: 'Cereals', msp: 2275 },
  { name: 'Paddy (Common)', hindi: 'धान (सामान्य)', group: 'Cereals', msp: 2183 },
  { name: 'Paddy (Grade A)', hindi: 'धान (ग्रेड ए)', group: 'Cereals', msp: 2203 },
  { name: 'Mustard', hindi: 'सरसों', group: 'Oil Seeds', msp: 5650 },
  { name: 'Bengal Gram(Gram)(Whole)', hindi: 'चना', group: 'Pulses', msp: 5440 },
  { name: 'Soybean', hindi: 'सोयाबीन', group: 'Oil Seeds', msp: 4600 },
  { name: 'Cotton', hindi: 'कपास', group: 'Fibre Crops', msp: 6620 },
  { name: 'Bajra(Pearl Millet/Cumbu)', hindi: 'बाजरा', group: 'Cereals', msp: 2500 },
  { name: 'Maize', hindi: 'मक्का', group: 'Cereals', msp: 2090 },
  { name: 'Groundnut', hindi: 'मूंगफली', group: 'Oil Seeds', msp: 6377 },
  { name: 'Green Gram(Moong)(Whole)', hindi: 'मूंग', group: 'Pulses', msp: 8558 },
  { name: 'Black Gram(Urd Beans)(Whole)', hindi: 'उड़द', group: 'Pulses', msp: 6950 },
  { name: 'Barley(Jau)', hindi: 'जौ', group: 'Cereals', msp: 1850 },
  { name: 'Ragi (Finger Millet)', hindi: 'रागी', group: 'Cereals', msp: 3846 },
  { name: 'Jowar(Sorghum)', hindi: 'ज्वार', group: 'Cereals', msp: 3180 },
];

/**
 * Lookup the official classification group for any given crop name
 */
export function getCommodityGroup(cropName?: string): string {
  if (!cropName) return 'Cereals';
  const clean = cropName.trim().toLowerCase();

  // 1. Direct match
  const match = ALL_COMMODITIES.find((c) => c.cmdt_name.toLowerCase() === clean);
  if (match) return match.group_name;

  // 2. Partial match
  const partial = ALL_COMMODITIES.find(
    (c) => c.cmdt_name.toLowerCase().includes(clean) || clean.includes(c.cmdt_name.toLowerCase())
  );
  if (partial) return partial.group_name;

  // 3. Fallback heuristics for common terms
  if (clean.includes('wheat') || clean.includes('paddy') || clean.includes('rice') || clean.includes('bajra') || clean.includes('maize') || clean.includes('barley') || clean.includes('ragi') || clean.includes('jowar')) {
    return 'Cereals';
  }
  if (clean.includes('gram') || clean.includes('chana') || clean.includes('dal') || clean.includes('moong') || clean.includes('urad') || clean.includes('bean') || clean.includes('pea') || clean.includes('arhar')) {
    return 'Pulses';
  }
  if (clean.includes('mustard') || clean.includes('soybean') || clean.includes('groundnut') || clean.includes('sunflower') || clean.includes('sesamum') || clean.includes('castor') || clean.includes('seed')) {
    return 'Oil Seeds';
  }
  if (clean.includes('cotton') || clean.includes('jute') || clean.includes('fibre')) {
    return 'Fibre Crops';
  }

  return 'Cereals';
}

/**
 * Filter commodities by group and/or search term
 */
export function filterCommodities(query?: string, group?: string): CommodityItem[] {
  let list = ALL_COMMODITIES;
  if (group && group !== 'All') {
    list = list.filter((c) => c.group_name === group);
  }
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter((c) => c.cmdt_name.toLowerCase().includes(q) || c.group_name.toLowerCase().includes(q));
  }
  return list;
}

/**
 * Get styling details for a group badge
 */
export function getGroupBadgeStyle(groupName?: string) {
  const theme = GROUP_THEMES[groupName || ''] || GROUP_THEMES['Others'];
  return theme;
}
