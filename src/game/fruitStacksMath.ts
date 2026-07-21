// Fruit Stacks math bootstrap — adapts the certified manifest
// (src/data/math_fruit_stacks.json, baked by custom-math/sim_fruit_stacks.mjs)
// into the pure math core's config. Settlement (mockHost), decode
// (decodeFruitStacksOutcome) and presentation (PixiApp) all read THIS ONE
// object, so every layer plays the identical certified rule.

import manifest from '@/data/math_fruit_stacks.json';
import type { FruitStacksMathConfig } from './fruitStacksSpin';

const m = manifest as unknown as {
  reelStrips: number[][];
  payTable: Record<string, [number, number, number]>;
  scatterPay: [number, number, number];
  freeSpinsCount: number;
  freeSpinsCap: number;
  maxWinMultiplier: number;
  custom: { retriggerSpins: number; multiPoolCap: number; multiWeights: [number, number][] };
};

export const FRUIT_STACKS_MATH: FruitStacksMathConfig = {
  reelStrips: m.reelStrips,
  visibleRows: 5,
  payTiers: Object.fromEntries(
    Object.entries(m.payTable).map(([k, v]) => [Number(k), v]),
  ) as Record<number, [number, number, number]>,
  scatterPayBps: m.scatterPay,
  multiWeights: m.custom.multiWeights,
  freeSpinsCount: m.freeSpinsCount,
  retriggerSpins: m.custom.retriggerSpins,
  freeSpinsCap: m.freeSpinsCap,
  multiPoolCap: m.custom.multiPoolCap,
  maxWinMultiplier: m.maxWinMultiplier,
};
