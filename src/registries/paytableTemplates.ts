import { RegistryEntry, createRegistry } from './types.js';

export interface PaytableTemplateEntry extends RegistryEntry {
  profile: 'low-vol' | 'medium-vol' | 'high-vol';
  payingSymbols3Kind: string[];
  payingSymbols4Kind: string[];
  payingSymbols5Kind: string[];
  topPay5Kind: number;
  notes: string;
}

const entries: readonly PaytableTemplateEntry[] = [
  {
    id: 'high-vol-243ways',
    name: 'High Volatility Cliff Paytable',
    description: 'Only HIGH_A and HIGH_B pay for 3-kind. MID_C pays 4+. Everything else only 5-kind. Creates steep pay cliff for low hit frequency.',
    version: '1.0.0',
    implemented: true,
    profile: 'high-vol',
    payingSymbols3Kind: ['WILD', 'HIGH_A', 'HIGH_B'],
    payingSymbols4Kind: ['WILD', 'HIGH_A', 'HIGH_B', 'MID_C'],
    payingSymbols5Kind: ['WILD', 'HIGH_A', 'HIGH_B', 'MID_C', 'MID_D', 'LOW_E', 'LOW_F', 'LOW_G'],
    topPay5Kind: 138200,
    notes: 'Paired with asymmetric-high-vol reel template to achieve vol index ~7.',
  },
  {
    id: 'medium-vol-243ways',
    name: 'Medium Volatility Even Paytable',
    description: 'All symbols pay for 3+. Narrower spread between low and high pays.',
    version: '0.1.0',
    implemented: false,
    profile: 'medium-vol',
    payingSymbols3Kind: ['WILD', 'HIGH_A', 'HIGH_B', 'MID_C', 'MID_D', 'LOW_E', 'LOW_F', 'LOW_G'],
    payingSymbols4Kind: ['WILD', 'HIGH_A', 'HIGH_B', 'MID_C', 'MID_D', 'LOW_E', 'LOW_F', 'LOW_G'],
    payingSymbols5Kind: ['WILD', 'HIGH_A', 'HIGH_B', 'MID_C', 'MID_D', 'LOW_E', 'LOW_F', 'LOW_G'],
    topPay5Kind: 50000,
    notes: 'Standard paytable for medium-vol games with ~45% hit freq.',
  },
] as const;

export const paytableTemplateRegistry = createRegistry(entries, { compatibleGrids: ['5x3'] });
