// Corrected WAYS evaluation (Vice Heat and every other 'ways' profile).
//
// WHY THIS EXISTS
// The frozen engine evaluator (src/engine/WinEvaluator.ts:113-123) seeds its
// candidate-symbol set from column 0 ONLY, and maps a WILD sitting there to
// HIGH_A:
//
//     const sym = board[row][0];
//     const effectiveSym = sym === SymbolId.WILD ? SymbolId.HIGH_A : sym;
//
// For a normal board that is a valid shortcut — a ways win must start on reel 0,
// so only symbols visible there can pay. But a WILD substitutes for EVERY
// symbol, so a wild in column 0 should open the door for all of them. Mapping it
// to HIGH_A instead means that when reel 0 is a FULL WILD TOWER (every Vice
// free-spins expansion, and 12.5% of base spins where reel 0's lone wild shows)
// the candidate set collapses to {HIGH_A} and AT MOST ONE combination can pay —
// even though the counting loop below happily substitutes wilds for anything.
//
// Measured on a real reported board (towers on reels 0,1,3; reel 2 =
// [K, shades, J, briefcase, J]; reel 4 = [J, J, shades, car, suit]) with the
// shipped paytable: the engine pays ONE combo (HIGH_A, 125 ways, 45.20x); the
// correct model pays FOUR (HIGH_A 45.20x + briefcase 18.36x + K 16.95x +
// J 5-of-a-kind, 500 ways, 73.45x) = 153.96x. The player was getting a third of
// what the certified math promises — this is a PAYOUT bug, not a display bug,
// because settlement (mockHost) scores through the same façade.
//
// The certified simulator has always used the correct model
// (custom-math/simulate_vice_heat_v2.py:171-183 iterates every paying symbol),
// so the runtime has been paying under its own certification.
//
// WHAT CHANGED: the candidate set, and nothing else. Scatter handling, the
// per-reel counting rule, consecutive-from-reel-0 matching, the ways product,
// the pay-index caps and the bps arithmetic are all mirrored from the engine so
// results stay identical on every board WITHOUT a wild in column 0.
//
// src/engine/* stays byte-identical to the dev repo — this routes in through the
// winEval façade instead, so settlement and presentation are corrected together.

import { BPS_DIVISOR, MIN_MATCHING_REELS } from '@/config/paytable';
import { SymbolId } from '@/config/symbols';
import type { WinResult, WinCombination } from '@/engine/WinEvaluator';
import type { GameConfig } from '@/engine/GameConfig';

export function evaluateViceWays(
  board: number[][],
  totalWager: bigint,
  config: Pick<GameConfig, 'gridConfig' | 'payTable' | 'scatterPay'>,
): WinResult {
  const { payTable, scatterPay, gridConfig } = config;
  const { reelCount, visibleRows } = gridConfig;
  const combinations: WinCombination[] = [];
  let totalWin = 0n;
  let scatterCount = 0;

  // ── Scatter: pays anywhere, no ways factor (mirrors WinEvaluator.ts:71-105) ──
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

  // ── Ways: evaluate EVERY paying symbol, not just what column 0 literally shows.
  // Wild (0) and scatter (1) are never candidates in their own right: wilds only
  // ever substitute (the engine likewise never evaluates symbolId 0 — its
  // payTable[WILD] entry is dead weight), and scatters pay above. Ascending id
  // order keeps the combinations array deterministic for the presentation.
  const candidates = Object.keys(payTable)
    .map(Number)
    .filter(id => Number.isFinite(id) && id !== SymbolId.WILD && id !== SymbolId.SCATTER)
    .sort((a, b) => a - b);

  for (const sym of candidates) {
    const payEntry = payTable[sym as keyof typeof payTable];
    if (!payEntry) continue;

    // Per reel: how many cells show this symbol or a wild (mirrors :133-145).
    const reelCounts: number[] = [];
    const reelCells: [number, number][][] = [];
    for (let reel = 0; reel < reelCount; reel++) {
      let count = 0;
      const cells: [number, number][] = [];
      for (let r = 0; r < visibleRows; r++) {
        const cell = board[r][reel];
        if (cell === sym || cell === SymbolId.WILD) {
          count++;
          cells.push([r, reel]);
        }
      }
      reelCounts.push(count);
      reelCells.push(cells);
    }

    // Consecutive from reel 0 (mirrors :148-152).
    let matchReels = 0;
    for (let reel = 0; reel < reelCount; reel++) {
      if (reelCounts[reel] > 0) matchReels++;
      else break;
    }
    if (matchReels < MIN_MATCHING_REELS) continue;

    let ways = 1;
    const winCells: [number, number][] = [];
    for (let reel = 0; reel < matchReels; reel++) {
      ways *= reelCounts[reel];
      winCells.push(...reelCells[reel]);
    }

    const payIdx = Math.min(matchReels - MIN_MATCHING_REELS, 2) as 0 | 1 | 2;
    const payBps = payEntry[payIdx];
    if (payBps === 0) continue;

    const winAmount = (BigInt(ways) * BigInt(payBps) * totalWager) / BigInt(BPS_DIVISOR);
    if (winAmount === 0n) continue;

    totalWin += winAmount;
    combinations.push({
      symbolId: sym, matchCount: matchReels, ways, payBps, winAmount, cells: winCells,
    });
  }

  return {
    totalWin,
    combinations,
    scatterCount,
    scatterPaid: scatterCount >= MIN_MATCHING_REELS,
  };
}
