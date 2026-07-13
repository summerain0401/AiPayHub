import { getConfig } from '../config.js';

// ============================================
// 价格档位系统
// ============================================

export interface PriceTier {
  id: string;              // "tier_050"
  amount: number;          // 分
  label: string;           // "0.50"
  labelCNY: string;        // "¥0.50"
  alipayServiceId: string; // Alipay AI Pay service ID
}

const DEFAULT_TIERS: PriceTier[] = [
  { id: 'tier_050',  amount: 50,   label: '0.50',  labelCNY: '¥0.50',  alipayServiceId: '' },
  { id: 'tier_100',  amount: 100,  label: '1.00',  labelCNY: '¥1.00',  alipayServiceId: '' },
  { id: 'tier_200',  amount: 200,  label: '2.00',  labelCNY: '¥2.00',  alipayServiceId: '' },
  { id: 'tier_500',  amount: 500,  label: '5.00',  labelCNY: '¥5.00',  alipayServiceId: '' },
  { id: 'tier_1000', amount: 1000, label: '10.00', labelCNY: '¥10.00', alipayServiceId: '' },
];

let cached: PriceTier[] | null = null;

export function getTiers(): PriceTier[] {
  if (cached) return cached;
  const config = getConfig();
  cached = DEFAULT_TIERS.map((t) => ({
    ...t,
    alipayServiceId: config.alipay.tierServiceIds[t.id] || '',
  }));
  return cached;
}

export function getTierById(id: string): PriceTier | undefined {
  return getTiers().find((t) => t.id === id);
}

export function getTierByAmount(cents: number): PriceTier | undefined {
  return getTiers().find((t) => t.amount === cents);
}
