// Win-evaluation FAÇADE — the single switch between the dev engine's WAYS
// model and the game-layer PAYLINES model. Every non-engine call site
// (mockHost settlement, PixiApp presentation, test triggers) evaluates
// through here so settle and display always agree; src/engine/* stays
// byte-identical to the dev repo.

import { evaluateWins, type WinResult } from '@/engine/WinEvaluator';
import { evaluatePaylines } from './paylineEval';
import { evaluateScatterPays } from './scatterPaysEval';
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
      // WAYS uses the ENGINE evaluator, unchanged. A wild in column 0 is
      // evaluated as HIGH_A and only symbols actually present in column 0 seed a
      // combination — so a full wild reel pays ONE combo at the wild/HIGH_A rate,
      // it does not let every symbol in the paytable connect.
      //
      // This is NOT a shortcut and NOT a bug: SlotGame.sol:341 does the same
      // (`effectiveSym = (sym == SYM_WILD) ? SYM_HIGH_A : sym`). The contract
      // pays the real money, so the client MUST match it byte for byte. On
      // 2026-07-27 this was briefly "corrected" to seed every paying symbol,
      // because the Python design model disagreed with the engine — that made
      // every symbol, high and low, connect at once on an expanded board and
      // made the client pay more than the chain ever would. The engine is the
      // spec; the simulator was the outlier. Do not "fix" this again.
      : evaluateWins(board, totalWager, config);
}
