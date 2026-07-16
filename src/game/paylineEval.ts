// PAYLINE evaluation — the Crack Farm pay model (game layer, NOT the engine).
//
// The dev's engine (src/engine/WinEvaluator.ts, frozen) is ways-only; Crack
// Farm plays as a classic PAYLINES slot instead: 10 fixed lines over 5×3,
// leftmost-consecutive matches, wilds substitute, one clean cell-per-reel
// path per win. The returned object is WinResult-shaped, so the ENTIRE
// presentation stack (win sheets, ways-light comet, marquee, tallies) works
// unchanged — a payline combo carries exactly one cell per reel, which the
// comet renders as a single clean line ("ultra cleane paylines").
//
// Settlement (mockHost) and display (PixiApp) both evaluate through the
// src/game/winEval.ts façade, so amounts and cells always match. The real
// contract-side payline evaluation is the dev's port of this file — the
// rules are documented in dev-handoff (paylines feature).

import { BPS_DIVISOR, MIN_MATCHING_REELS } from '@/config/paytable';
import { SymbolId } from '@/config/symbols';
import type { GameConfig } from '@/engine/GameConfig';
import type { WinResult, WinCombination } from '@/engine/WinEvaluator';

/** The 10 classic 5×3 paylines — row index per reel (row 0 = top). */
export const PAYLINES_5x3: ReadonlyArray<readonly number[]> = [
  [1, 1, 1, 1, 1], // 1 middle
  [0, 0, 0, 0, 0], // 2 top
  [2, 2, 2, 2, 2], // 3 bottom
  [0, 1, 2, 1, 0], // 4 V
  [2, 1, 0, 1, 2], // 5 Λ
  [0, 0, 1, 2, 2], // 6 stairs down
  [2, 2, 1, 0, 0], // 7 stairs up
  [1, 0, 0, 0, 1], // 8 top arc
  [1, 2, 2, 2, 1], // 9 bottom arc
  [0, 1, 1, 1, 2], // 10 soft diagonal
];

/**
 * Evaluate PAYLINE wins. Same contract as the engine's evaluateWins:
 * returns the RAW (uncapped, unmultiplied) win; scatters pay anywhere and
 * count toward the FS trigger exactly like the ways model.
 *
 * Pay basis: `payBps` is bps of the TOTAL wager per WINNING LINE (matching
 * the ways model's per-way basis — the paytable in the crack-farm manifest
 * is tuned for this via the MC sim, so RTP lands where certified).
 */
export function evaluatePaylines(
  board: number[][],
  totalWager: bigint,
  config: Pick<GameConfig, 'gridConfig' | 'payTable' | 'scatterPay'>,
): WinResult {
  const { payTable, scatterPay, gridConfig } = config;
  const { reelCount, visibleRows } = gridConfig;
  const combinations: WinCombination[] = [];
  let totalWin = 0n;
  let scatterCount = 0;

  // Scatters: anywhere on the board (identical to the ways model).
  for (let row = 0; row < visibleRows; row++) {
    for (let reel = 0; reel < reelCount; reel++) {
      if (board[row][reel] === SymbolId.SCATTER) scatterCount++;
    }
  }
  if (scatterCount >= MIN_MATCHING_REELS) {
    const idx = Math.min(scatterCount - MIN_MATCHING_REELS, 2) as 0 | 1 | 2;
    const scatterPayBps = scatterPay[idx];
    const scatterWin = (totalWager * BigInt(scatterPayBps)) / BigInt(BPS_DIVISOR);
    if (scatterWin > 0n) {
      totalWin += scatterWin;
      const cells: [number, number][] = [];
      for (let row = 0; row < visibleRows; row++) {
        for (let reel = 0; reel < reelCount; reel++) {
          if (board[row][reel] === SymbolId.SCATTER) cells.push([row, reel]);
        }
      }
      combinations.push({
        symbolId: SymbolId.SCATTER, matchCount: scatterCount, ways: 1,
        payBps: scatterPayBps, winAmount: scatterWin, cells,
      });
    }
  }

  // Lines: leftmost-consecutive, wilds substitute. Only rows that exist on
  // this grid participate (a 5×5 board simply never selects rows 3/4 — the
  // line set is a 5×3 design; Crack Farm is 5×3).
  for (const line of PAYLINES_5x3) {
    // Effective symbol = the first non-wild along the line (all-wild lines
    // evaluate as HIGH_A, mirroring the engine's wild-as-HIGH_A rule).
    let effective: number | null = null;
    for (let reel = 0; reel < reelCount; reel++) {
      const row = line[reel];
      if (row >= visibleRows) { effective = null; break; }
      const sym = board[row][reel];
      if (sym === SymbolId.SCATTER) break; // scatter breaks a line match
      if (sym !== SymbolId.WILD) { effective = sym; break; }
      effective = SymbolId.HIGH_A; // provisional: all wilds so far
    }
    if (effective === null) continue;
    const payEntry = payTable[effective];
    if (!payEntry) continue;

    // Count the leftmost run of effective-or-wild.
    let matchCount = 0;
    const cells: [number, number][] = [];
    for (let reel = 0; reel < reelCount; reel++) {
      const row = line[reel];
      if (row >= visibleRows) break;
      const sym = board[row][reel];
      if (sym === effective || sym === SymbolId.WILD) {
        matchCount++;
        cells.push([row, reel]);
      } else break;
    }
    if (matchCount < MIN_MATCHING_REELS) continue;

    const payIdx = Math.min(matchCount - MIN_MATCHING_REELS, 2) as 0 | 1 | 2;
    const payBps = payEntry[payIdx];
    if (payBps === 0) continue;
    const winAmount = (BigInt(payBps) * totalWager) / BigInt(BPS_DIVISOR);
    if (winAmount === 0n) continue;

    totalWin += winAmount;
    combinations.push({
      symbolId: effective, matchCount, ways: 1, payBps, winAmount, cells,
    });
  }

  return {
    totalWin,
    combinations,
    scatterCount,
    scatterPaid: scatterCount >= MIN_MATCHING_REELS,
  };
}
