// Win evaluation engine — pure deterministic logic, no RNG.
// This must produce identical results to the Solidity contract's _evaluateWins().
//
// Grid-agnostic ways evaluation:
//   For each non-scatter symbol, find how many consecutive reels (left→right)
//   contain at least one instance (including wilds). If ≥ MIN_MATCHING_REELS,
//   compute ways = product of matching-symbol counts on each qualifying reel,
//   then win += ways × payBps × totalWager / BPS_DIVISOR.
//
//   Total ways scales as visibleRows^reelCount for an all-symbol board
//   (5×3 = 3^5 = 243, 5×5 = 5^5 = 3125). Loop bounds come from gridConfig
//   on the passed GameConfig, not from compile-time constants.
//
//   Scatter pays anywhere (count all scatters on board, no ways factor).

import { BPS_DIVISOR, MIN_MATCHING_REELS } from '@/config/paytable';
import { SymbolId } from '@/config/symbols';
import { DEFAULT_GAME_CONFIG, type GameConfig } from './GameConfig';

/** Result of win evaluation for a single spin. */
export interface WinResult {
  /** Total win amount in the same units as totalWager (bigint for precision). */
  totalWin: bigint;
  /** Individual winning combinations found. */
  combinations: WinCombination[];
  /** Number of scatters on the board (used to trigger free spins). */
  scatterCount: number;
  /** Whether the scatter pay is included in totalWin. */
  scatterPaid: boolean;
}

/** A single winning combination. */
export interface WinCombination {
  symbolId: number;
  matchCount: number; // 3, 4, or 5
  ways: number;
  payBps: number;
  winAmount: bigint;
  /** Which board cells are part of this win: [row, reelIndex][] */
  cells: [number, number][];
}

/**
 * Evaluate wins for a given board and total wager. Works for any grid shape
 * — loop bounds come from `config.gridConfig` (reelCount × visibleRows).
 *
 * Returns the RAW (uncapped, unmultiplied) base win so callers can
 * apply free-spin multipliers and the session-level max-win cap in the
 * same order as the Solidity contract's onRandomness() — per-spin caps
 * diverge from contract semantics when multiple large wins stack.
 *
 * The board's outer length must equal `gridConfig.visibleRows` and each
 * row must have `gridConfig.reelCount` entries. Mismatched boards produce
 * undefined behaviour (loops trust the gridConfig, not the board shape).
 *
 * @param board - board[row][reel], 0-indexed, row 0 = top
 * @param totalWager - total wager in token base units (bigint)
 * @param config - GameConfig including gridConfig + payTable + scatterPay
 */
export function evaluateWins(
  board: number[][],
  totalWager: bigint,
  config: Pick<GameConfig, 'gridConfig' | 'payTable' | 'scatterPay'> = DEFAULT_GAME_CONFIG,
): WinResult {
  const { payTable, scatterPay, gridConfig } = config;
  const { reelCount, visibleRows } = gridConfig;
  const combinations: WinCombination[] = [];
  let totalWin = 0n;
  let scatterCount = 0;

  // Count scatters on the full board
  for (let row = 0; row < visibleRows; row++) {
    for (let reel = 0; reel < reelCount; reel++) {
      if (board[row][reel] === SymbolId.SCATTER) scatterCount++;
    }
  }

  // Scatter pay (anywhere, no ways factor).
  // Cap the index at 2 (5+ scatters all pay the 5-of-a-kind tier) — V1
  // behaviour with 5×3 had at most 5 scatters; 5×5 can fit up to 25 and
  // wider grids more still. Without the cap, scatterPay[idx] would read
  // off the end of the 3-element tuple.
  if (scatterCount >= MIN_MATCHING_REELS) {
    const idx = Math.min(scatterCount - MIN_MATCHING_REELS, 2) as 0 | 1 | 2;
    const scatterPayBps = scatterPay[idx];
    const scatterWin = (totalWager * BigInt(scatterPayBps)) / BigInt(BPS_DIVISOR);
    if (scatterWin > 0n) {
      totalWin += scatterWin;
      // Collect scatter cells
      const cells: [number, number][] = [];
      for (let row = 0; row < visibleRows; row++) {
        for (let reel = 0; reel < reelCount; reel++) {
          if (board[row][reel] === SymbolId.SCATTER) cells.push([row, reel]);
        }
      }
      combinations.push({
        symbolId: SymbolId.SCATTER,
        matchCount: scatterCount,
        ways: 1,
        payBps: scatterPayBps,
        winAmount: scatterWin,
        cells,
      });
    }
  }

  // Ways wins for regular symbols (wilds substitute).
  // We walk each visible row's reel-0 entry once, but track which effective
  // symbols we've already paid — payouts are per-symbol, not per-row, so
  // the same HIGH_A combo isn't paid twice if it appears on multiple rows.
  const evaluatedSymbols = new Set<number>();

  for (let row = 0; row < visibleRows; row++) {
    const sym = board[row][0];

    // Skip scatter (handled above) and wild (evaluated as part of other symbols).
    if (sym === SymbolId.SCATTER) continue;

    // Determine effective symbol (wild = evaluate as HIGH_A for own combo).
    const effectiveSym = sym === SymbolId.WILD ? SymbolId.HIGH_A : sym;

    if (evaluatedSymbols.has(effectiveSym)) continue;
    evaluatedSymbols.add(effectiveSym);

    const payEntry = payTable[effectiveSym];
    if (!payEntry) continue;

    // Count matching reels consecutively from left.
    // On each reel: count cells with effectiveSym or Wild (not scatter).
    const reelCounts: number[] = [];
    const reelCells: [number, number][][] = [];

    for (let reel = 0; reel < reelCount; reel++) {
      let count = 0;
      const cells: [number, number][] = [];
      for (let r = 0; r < visibleRows; r++) {
        const cell = board[r][reel];
        if (cell === effectiveSym || cell === SymbolId.WILD) {
          count++;
          cells.push([r, reel]);
        }
      }
      reelCounts.push(count);
      reelCells.push(cells);
    }

    // Find consecutive matching reels from reel 0
    let matchReels = 0;
    for (let reel = 0; reel < reelCount; reel++) {
      if (reelCounts[reel] > 0) matchReels++;
      else break;
    }

    if (matchReels < MIN_MATCHING_REELS) continue;

    // Compute ways = product of counts on matched reels.
    let ways = 1;
    const winCells: [number, number][] = [];
    for (let reel = 0; reel < matchReels; reel++) {
      ways *= reelCounts[reel];
      winCells.push(...reelCells[reel]);
    }

    // Cap the pay index at 2 — same reasoning as the scatter cap. A 6-reel
    // grid (Stage 3) can produce 6-of-a-kind matches; we treat 5+ as the
    // top tier from the same paytable tuple.
    const payIdx = Math.min(matchReels - MIN_MATCHING_REELS, 2) as 0 | 1 | 2;
    const payBps = payEntry[payIdx];
    if (payBps === 0) continue;

    const winAmount = (BigInt(ways) * BigInt(payBps) * totalWager) / BigInt(BPS_DIVISOR);
    if (winAmount === 0n) continue;

    totalWin += winAmount;
    combinations.push({
      symbolId: effectiveSym,
      matchCount: matchReels,
      ways,
      payBps,
      winAmount,
      cells: winCells,
    });
  }

  return {
    totalWin,
    combinations,
    scatterCount,
    scatterPaid: scatterCount >= MIN_MATCHING_REELS,
  };
}

// Precomputed from 5M-spin Monte Carlo on current reel strips and paytable.
// Recompute via `ROUNDS=5000000 TOLERANCE_PCT=0.10 npm run simulate:rtp` when strips or paytable change.
const PRECOMPUTED_WIN_CHANCE_PCT = 92.29;
const PRECOMPUTED_AVG_WIN_MULTIPLIER = 0.8742;

/**
 * Theoretical win chance and expected multiplier derived from reel strip frequencies.
 * Values precomputed via Monte Carlo simulation; update when config changes.
 */
export function computeWinChance(_totalWager: bigint): { winChancePct: number; expectedMultiplier: number } {
  return {
    winChancePct: PRECOMPUTED_WIN_CHANCE_PCT,
    expectedMultiplier: PRECOMPUTED_AVG_WIN_MULTIPLIER,
  };
}
