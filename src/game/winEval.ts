// Win-evaluation FAÇADE — the single switch between the dev engine's WAYS
// model and the game-layer PAYLINES model. Every non-engine call site
// (mockHost settlement, PixiApp presentation, test triggers) evaluates
// through here so settle and display always agree; src/engine/* stays
// byte-identical to the dev repo.

import { type WinResult } from '@/engine/WinEvaluator';
import { evaluatePaylines } from './paylineEval';
import { evaluateScatterPays } from './scatterPaysEval';
import { evaluateViceWays } from './viceWays';
import type { GameConfig } from '@/engine/GameConfig';

export type PayModel = 'ways' | 'lines' | 'scatterpays' | 'cluster';

/** Crack Farm plays PAYLINES, Fruit Stacks plays SCATTER-PAYS (pay-anywhere
 *  tumbler); every other game keeps the engine's ways. */
export function activePayModel(): PayModel {
  try {
    const g = localStorage.getItem('active-game');
    return g === 'crackfarm' ? 'lines' : g === 'fruitstacks' ? 'scatterpays' : g === 'sushi' ? 'cluster' : 'ways';
  } catch {
    return 'ways';
  }
}

export function evalWins(
  board: number[][],
  totalWager: bigint,
  config: Pick<GameConfig, 'gridConfig' | 'payTable' | 'scatterPay'>,
): WinResult {
  const model = activePayModel();
  return model === 'lines'
    ? evaluatePaylines(board, totalWager, config)
    : model === 'scatterpays'
      ? evaluateScatterPays(board, totalWager, config)
      // WAYS goes through the CORRECTED evaluator (see viceWays.ts): the frozen
      // engine seeds its candidate symbols from column 0 only and folds a wild
      // there into HIGH_A, so a full wild reel 0 could pay at most ONE
      // combination. Identical results on any board without a wild in column 0,
      // so non-expanding ways profiles are unaffected. Routing here fixes
      // settlement (mockHost) and presentation (PixiApp) with one edit and
      // leaves src/engine/* byte-identical to the dev repo.
      : evaluateViceWays(board, totalWager, config);
}
