// Sushi Party math bootstrap — adapts the certified manifest
// (src/data/math_sushi_party.json) into the pure cluster math core's config.
// Settlement (mockHost), decode (decodeSushiOutcome) and presentation (PixiApp)
// all read THIS ONE object, so every layer plays the identical certified rule.

import manifest from '@/data/math_sushi_party.json';
import type { SushiMathConfig } from './sushiClusterSpin';

const m = manifest as unknown as {
  reelStrips: number[][];
  fsReelStrips: number[][];
  payTable: Record<string, number[]>;
  minCluster: number;
  fsSpinsByScatter: Record<number, number>;
  retriggerSpins: number;
  maxWinMultiplier: number;
  maxCellMulti: number;
  fsMultiIncrement: number;
  buyScatterWeights: Record<number, number>;
};

/** Purchased FS stage (Noski, fixed reference price): forces 3/4/5/6 scatters
 *  per the manifest's buyScatterWeights. Card art: gold ribbon. */
export const SUSHI_BUY_STAGES = [
  { stage: 1, costMult: 100, label: 'FREE SPINS' },
] as const;

export const SUSHI_MATH: SushiMathConfig = {
  reelStrips: m.reelStrips,
  fsReelStrips: m.fsReelStrips,
  rows: 6,
  reels: 6,
  payTiers: Object.fromEntries(
    Object.entries(m.payTable).map(([k, v]) => [Number(k), v]),
  ) as Record<number, number[]>,
  minCluster: m.minCluster,
  fsSpinsByScatter: m.fsSpinsByScatter,
  retriggerSpins: m.retriggerSpins,
  maxWinMultiplier: m.maxWinMultiplier,
  maxCellMulti: m.maxCellMulti,
  fsMultiIncrement: m.fsMultiIncrement,
  buyScatterWeights: m.buyScatterWeights,
};
