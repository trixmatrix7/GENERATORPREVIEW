import { RegistryEntry, createRegistry } from './types.js';

export interface ReelTemplateEntry extends RegistryEntry {
  reelLength: number;
  reelCount: number;
  profile: 'low-vol' | 'medium-vol' | 'high-vol';
  hitFreqRange: [number, number];
  scatterReels: number[];
  scatterPerReel: number;
  wildReels: number[];
  notes: string;
}

const entries: readonly ReelTemplateEntry[] = [
  {
    id: 'asymmetric-high-vol',
    name: 'Asymmetric High Volatility (40 stops)',
    description: 'Filler-heavy reel 0 with escalating high-pay density. Scatter on all 5 reels (2 each). Achieves 28-32% hit freq with 243 ways when paired with cliff paytable.',
    version: '1.0.0',
    implemented: true,
    reelLength: 40,
    reelCount: 5,
    profile: 'high-vol',
    hitFreqRange: [28, 32],
    scatterReels: [0, 1, 2, 3, 4],
    scatterPerReel: 2,
    wildReels: [1, 2, 3, 4],
    notes: 'Reel 0 has 0 wilds (filler gate). Reels 1-4 have 2/3/4/3 wilds.',
  },
  {
    id: 'symmetric-medium-vol',
    name: 'Symmetric Medium Volatility (30 stops)',
    description: 'Equal symbol distribution across reels. Scatter on reels 0/2/4 only. Standard hit freq ~40-50%.',
    version: '0.1.0',
    implemented: false,
    reelLength: 30,
    reelCount: 5,
    profile: 'medium-vol',
    hitFreqRange: [40, 50],
    scatterReels: [0, 2, 4],
    scatterPerReel: 1,
    wildReels: [0, 1, 2, 3, 4],
    notes: 'Original V0 strip design. Good for low-to-medium volatility games.',
  },
] as const;

export const reelTemplateRegistry = createRegistry(entries, { compatibleGrids: ['5x3'] });
