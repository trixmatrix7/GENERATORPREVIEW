// engine/paytable.ts — pays in BPS of wager. VERBATIM from the Fantasy ZIP
// (src/config/paytable.ts) and SlotGame.sol _pay/_scatterPay.

import { SymbolId } from '../config/symbols';

export type PayEntry = [pay3: number, pay4: number, pay5: number];

export const PAY_TABLE: Partial<Record<number, PayEntry>> = {
  [SymbolId.WILD]: [182, 1274, 33375],
  [SymbolId.HIGH_A]: [182, 1274, 33375],
  [SymbolId.HIGH_B]: [76, 516, 13350],
  [SymbolId.MID_C]: [0, 364, 6372],
  [SymbolId.MID_D]: [0, 182, 2731],
  [SymbolId.LOW_E]: [0, 0, 1153],
  [SymbolId.LOW_F]: [0, 0, 0],
  [SymbolId.LOW_G]: [0, 0, 0],
};

export const SCATTER_PAY: PayEntry = [40, 219, 1495];

export const MIN_MATCHING_REELS = 3;
export const BPS_DIVISOR = 10_000;

/** Pay-per-way (BPS) for `symId` matched on `matchCount` reels. Mirrors _pay(). */
export function payBps(symId: number, matchCount: number): number {
  if (matchCount < MIN_MATCHING_REELS || matchCount > 5) return 0;
  const idx = matchCount - MIN_MATCHING_REELS; // 0=3x,1=4x,2=5x
  const entry = PAY_TABLE[symId];
  if (!entry) return 0;
  return entry[idx];
}

/** Scatter pay (BPS of wager) for `count` scatters. Mirrors _scatterPay(). */
export function scatterPayBps(count: number): number {
  if (count === 3) return SCATTER_PAY[0];
  if (count === 4) return SCATTER_PAY[1];
  if (count >= 5) return SCATTER_PAY[2];
  return 0;
}
