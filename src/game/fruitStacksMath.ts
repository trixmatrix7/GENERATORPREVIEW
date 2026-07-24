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

/** Purchased FS stages (Noski, fixed reference prices): stage 2/3 pre-load
 *  the multiplier POOL with ×50 / ×100 (standing in the pool field at round
 *  start). Card art: silver / red / gold ribbons. */
export const FRUIT_BUY_STAGES = [
  { stage: 1, startPool: 0, costMult: 100, label: 'FREE SPINS' },
  { stage: 2, startPool: 50, costMult: 300, label: 'START ×50' },
  // 460x statt 500x: unter dem 5000x-Cap saettigt die Stage-3-EV bei ~443x
  // (mehr Gifts verdraengen zahlende Fruechte + Cap-Clipping) -> ehrlicher
  // Preis fuer 96.25% Payback (Re-Cert 2026-07-24).
  { stage: 3, startPool: 100, costMult: 460, label: 'START ×100' },
] as const;

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
