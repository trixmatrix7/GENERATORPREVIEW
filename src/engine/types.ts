// engine/types.ts — outcome shapes produced by the deterministic engine.
// The engine mirrors SlotGame.sol; everything is computed in BET-MULTIPLES (×bet),
// so `winX` × bet = display win. Board is indexed [row][reel].

import type { GridId } from '../config/gridConfig';

export type Board = number[][]; // board[row][reel] = symbolId

export interface Cell {
  reel: number;
  row: number;
}

/** One winning ways-connection (a symbol group across N consecutive reels). */
export interface WinConnection {
  symbol: number; // effective symbol id (wild folded into HIGH_A)
  matchReels: number; // consecutive reels from the left
  ways: number; // product of per-reel match counts
  payBps: number; // pay per way (BPS of wager)
  winX: number; // ways * payBps / 10000  (in ×bet)
  cells: Cell[]; // every contributing cell (effectiveSym or WILD) across matched reels
}

export interface BaseResult {
  board: Board;
  stops: number[];
  scatterCount: number;
  connections: WinConnection[]; // sorted by symbol value ASC for the sequential reveal
  scatterWinX: number;
  baseWinX: number; // connections + scatter, before any cap
}

export interface FreeSpin {
  index: number;
  board: Board;
  stops: number[];
  scatterCount: number;
  rawWinX: number; // before the ×multiplier
  winX: number; // rawWinX * freeSpinsMultiplier
  retrigger: boolean;
}

export interface FreeSpinsResult {
  triggered: boolean;
  spins: FreeSpin[];
  played: number;
  multiplier: number;
  totalWinX: number;
}

export interface HoldWinStep {
  step: number; // 0 = initial trigger fill, then 1..n respin steps
  landed: Cell[]; // cells locked this step
  values: number[]; // value per landed cell (parallel to `landed`)
  isJackpot: boolean[]; // whether each landed value was a jackpot tier
  lockedCount: number; // cumulative locked after this step
  respinsLeft: number;
}

export interface HoldWinResult {
  triggered: boolean;
  initialCoins: number;
  steps: HoldWinStep[];
  lockedCells: Cell[];
  grand: boolean; // full board locked
  totalMultiplierX: number; // in ×bet (incl. grand bonus)
}

export type WinTier = 'none' | 'small' | 'normal' | 'big' | 'mega';

export interface Outcome {
  seed: `0x${string}`;
  grid: GridId;
  bet: number;
  base: BaseResult;
  freeSpins: FreeSpinsResult;
  holdWin: HoldWinResult;
  totalWinX: number; // capped at maxWinMultiplier
  totalWin: number; // totalWinX * bet
  tier: WinTier;
  capped: boolean;
}

/** Options controlling a forced/seeded spin (for the test buttons). */
export interface SpinOptions {
  grid: GridId;
  bet: number;
  seed?: `0x${string}`; // omit → random seed
  buyBonus?: boolean; // force the free-spins round
}
