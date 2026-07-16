// Win-evaluation FAÇADE — the single switch between the dev engine's WAYS
// model and the game-layer PAYLINES model. Every non-engine call site
// (mockHost settlement, PixiApp presentation, test triggers) evaluates
// through here so settle and display always agree; src/engine/* stays
// byte-identical to the dev repo.

import { evaluateWins, type WinResult } from '@/engine/WinEvaluator';
import { evaluatePaylines } from './paylineEval';
import type { GameConfig } from '@/engine/GameConfig';

export type PayModel = 'ways' | 'lines';

/** Crack Farm plays PAYLINES; every other game keeps the engine's ways. */
export function activePayModel(): PayModel {
  try {
    return localStorage.getItem('active-game') === 'crackfarm' ? 'lines' : 'ways';
  } catch {
    return 'ways';
  }
}

export function evalWins(
  board: number[][],
  totalWager: bigint,
  config: Pick<GameConfig, 'gridConfig' | 'payTable' | 'scatterPay'>,
): WinResult {
  return activePayModel() === 'lines'
    ? evaluatePaylines(board, totalWager, config)
    : evaluateWins(board, totalWager, config);
}
