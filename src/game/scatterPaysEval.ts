// SCATTER-PAYS evaluation (Fruit Stacks) — the winEval façade's third branch.
//
// Pay-anywhere by count: a symbol wins with 8+ of its kind ANYWHERE on the
// board (tiers 8-9 / 10-11 / 12+). No lines, no ways, no wild substitution
// (id 0 is the multiplier crate, not a wild). Emits the engine's standard
// WinResult shape so the whole highlight/ceremony stack consumes it
// unchanged — the same leverage paylineEval.ts proved for Crack Farm.
// NOTE: this scores ONE board (the first tumble step). The full cascade
// chain + crate multipliers live in fruitStacksSpin.deriveFruitStacksRound;
// this evaluator exists for façade consistency (test triggers, base
// highlighting, FS-trigger detection on arbitrary boards).

import type { WinResult, WinCombination } from '@/engine/WinEvaluator';
import type { GameConfig } from '@/engine/GameConfig';
import { FRUIT_STACKS_MATH } from './fruitStacksMath';

const SCATTER = 1;

export function evaluateScatterPays(
  board: number[][],
  totalWager: bigint,
  _config: Pick<GameConfig, 'gridConfig' | 'payTable' | 'scatterPay'>,
): WinResult {
  const tiers = FRUIT_STACKS_MATH.payTiers;
  const cellsBySym = new Map<number, [number, number][]>();
  let scatterCount = 0;
  for (let row = 0; row < board.length; row++) {
    for (let reel = 0; reel < board[row].length; reel++) {
      const s = board[row][reel];
      if (s === SCATTER) { scatterCount++; continue; }
      if (!tiers[s]) continue;
      let arr = cellsBySym.get(s);
      if (!arr) cellsBySym.set(s, arr = []);
      arr.push([row, reel]);
    }
  }

  const combinations: WinCombination[] = [];
  let totalWin = 0n;
  for (const [symbolId, cells] of cellsBySym) {
    if (cells.length < 8) continue;
    const tier = cells.length >= 12 ? 2 : cells.length >= 10 ? 1 : 0;
    const payBps = tiers[symbolId][tier];
    const winAmount = (totalWager * BigInt(payBps)) / 10000n;
    combinations.push({ symbolId, matchCount: cells.length, ways: 1, payBps, winAmount, cells });
    totalWin += winAmount;
  }

  // Scatter direct pay: 4+ anywhere (mirrors the math core's rule).
  let scatterPaid = false;
  if (scatterCount >= 4) {
    const idx = Math.min(scatterCount - 4, 2);
    const amt = (totalWager * BigInt(FRUIT_STACKS_MATH.scatterPayBps[idx])) / 10000n;
    totalWin += amt;
    scatterPaid = true;
  }

  return { totalWin, combinations, scatterCount, scatterPaid };
}
