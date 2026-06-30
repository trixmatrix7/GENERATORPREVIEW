// symbols.ts — canonical symbol IDs. MUST match the SymbolId enum used by the
// on-chain contract (SlotGame.sol) and the dev generator's src/config/symbols.ts.
// IDs are frozen: WILD=0 … COIN=9.

export enum SymbolId {
  WILD = 0,
  SCATTER = 1,
  HIGH_A = 2,
  HIGH_B = 3,
  MID_C = 4,
  MID_D = 5,
  LOW_E = 6,
  LOW_F = 7,
  LOW_G = 8,
  COIN = 9, // Hold & Win money symbol
}

export const SYMBOL_COUNT = 10;

export type SymbolKind = 'wild' | 'scatter' | 'high' | 'mid' | 'royal' | 'coin';

/** Kind per symbol — drives per-kind base scale + win-pop factor. */
export const SYMBOL_KIND: Record<SymbolId, SymbolKind> = {
  [SymbolId.WILD]: 'wild',
  [SymbolId.SCATTER]: 'scatter',
  [SymbolId.HIGH_A]: 'high',
  [SymbolId.HIGH_B]: 'high',
  [SymbolId.MID_C]: 'mid',
  [SymbolId.MID_D]: 'mid',
  [SymbolId.LOW_E]: 'royal',
  [SymbolId.LOW_F]: 'royal',
  [SymbolId.LOW_G]: 'royal',
  [SymbolId.COIN]: 'coin',
};

/** Base render scale (× cell) per kind — neutral generator defaults. Tune via a
 *  theme/animation preset; nothing here is tuned to any specific game. */
export const BASE_SCALE_PER_KIND: Record<SymbolKind, number> = {
  royal: 0.92,
  mid: 1.0,
  high: 1.0,
  wild: 1.0,
  scatter: 1.1,
  coin: 1.0,
};

/** Win-pop overshoot factor per kind — neutral defaults (premiums pop a touch harder). */
export const POP_FACTOR_PER_KIND: Record<SymbolKind, number> = {
  scatter: 1.28,
  wild: 1.26,
  high: 1.25,
  mid: 1.22,
  royal: 1.2,
  coin: 1.24,
};

export const ALL_SYMBOL_IDS: SymbolId[] = [
  SymbolId.WILD,
  SymbolId.SCATTER,
  SymbolId.HIGH_A,
  SymbolId.HIGH_B,
  SymbolId.MID_C,
  SymbolId.MID_D,
  SymbolId.LOW_E,
  SymbolId.LOW_F,
  SymbolId.LOW_G,
  SymbolId.COIN,
];

export const isWild = (s: number): boolean => s === SymbolId.WILD;
export const isScatter = (s: number): boolean => s === SymbolId.SCATTER;
export const isCoin = (s: number): boolean => s === SymbolId.COIN;

export const kindOf = (s: number): SymbolKind => SYMBOL_KIND[s as SymbolId] ?? 'mid';
export const baseScaleOf = (s: number): number => BASE_SCALE_PER_KIND[kindOf(s)];
export const popFactorOf = (s: number): number => POP_FACTOR_PER_KIND[kindOf(s)];
