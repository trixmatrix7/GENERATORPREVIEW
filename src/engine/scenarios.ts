// engine/scenarios.ts — forced outcomes for the studio test buttons. Everything
// stays seed-driven (no hand-built fake boards) EXCEPT the Hold & Win demo: the
// Fantasy reel strips contain no COIN symbol, so H&W can't arise from a strip
// spin — the demo injects coins purely to preview that animation. Clearly marked.

import { GRIDS, type GridId } from '../config/gridConfig';
import { SymbolId } from '../config/symbols';
import { spin } from './spin';
import { randomSeed, toBig } from './rng';
import { buildBoard } from './reels';
import { deriveStops } from './rng';
import { evaluateWins } from './ways';
import { playHoldAndWin } from './holdAndWin';
import type { Outcome } from './types';

export type ScenarioPredicate = (o: Outcome) => boolean;

/** Search random seeds for one matching `pred`; keep the highest-win fallback. */
export function findOutcome(
  grid: GridId,
  bet: number,
  pred: ScenarioPredicate,
  score: (o: Outcome) => number = (o) => o.totalWinX,
  attempts = 40000,
): Outcome {
  let best: Outcome | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < attempts; i++) {
    const o = spin({ grid, bet, seed: randomSeed() });
    if (pred(o)) return o;
    const sc = score(o);
    if (sc > bestScore) {
      bestScore = sc;
      best = o;
    }
  }
  return best ?? spin({ grid, bet, seed: randomSeed() });
}

export const forceAnyWin = (grid: GridId, bet: number): Outcome =>
  findOutcome(grid, bet, (o) => o.base.connections.length > 0);

export const forceFreeSpins = (grid: GridId, bet: number): Outcome =>
  findOutcome(grid, bet, (o) => o.base.scatterCount >= 3, (o) => o.base.scatterCount);

/** Near-miss: exactly 2 scatters (the sweat tease that just misses the trigger). */
export const forceNearMiss = (grid: GridId, bet: number): Outcome =>
  findOutcome(grid, bet, (o) => o.base.scatterCount === 2 && o.freeSpins.triggered === false);

export const forceBigWin = (grid: GridId, bet: number): Outcome =>
  findOutcome(grid, bet, (o) => o.totalWinX >= 10 && o.totalWinX < 50);

export const forceMega = (grid: GridId, bet: number): Outcome =>
  findOutcome(grid, bet, (o) => o.totalWinX >= 50);

/** DEMO ONLY — injects 6 COIN symbols to preview the Hold & Win round. */
export function demoHoldWin(grid: GridId, bet: number): Outcome {
  const spec = GRIDS[grid];
  const rows = spec.rows;
  const seed = randomSeed();
  const randomness = toBig(seed);
  const stops = deriveStops(randomness);
  const board = buildBoard(stops, rows);

  // Inject coins on a seeded spread of cells (≥ trigger min).
  const coinCount = 6 + (Number(randomness % 4n)); // 6..9
  const total = spec.cols * rows;
  let placed = 0;
  let cursor = Number(randomness % BigInt(total));
  while (placed < coinCount && placed < total) {
    const row = Math.floor(cursor / spec.cols);
    const reel = cursor % spec.cols;
    if (board[row][reel] !== SymbolId.COIN) {
      board[row][reel] = SymbolId.COIN;
      placed++;
    }
    cursor = (cursor + 7) % total;
  }

  const baseEval = evaluateWins(board, rows);
  const hw = playHoldAndWin(randomness, board, rows);
  const totalWinX = Math.min(hw.totalMultiplierX, 5000);

  return {
    seed,
    grid,
    bet,
    base: {
      board,
      stops,
      scatterCount: baseEval.scatterCount,
      connections: baseEval.connections,
      scatterWinX: baseEval.scatterWinX,
      baseWinX: baseEval.baseWinX,
    },
    freeSpins: { triggered: false, spins: [], played: 0, multiplier: 18, totalWinX: 0 },
    holdWin: hw,
    totalWinX,
    totalWin: totalWinX * bet,
    tier: totalWinX >= 50 ? 'mega' : totalWinX >= 10 ? 'big' : totalWinX >= 2 ? 'normal' : 'small',
    capped: false,
  };
}
