// Fruit Stacks DECODE FAÇADE — bypasses the frozen SlotEngine.decodeSpinOutcome
// (whose uint8[5] schema cannot carry a 6-reel cascade board).
//
// The mock settlement encodes only the authoritative totals; the full round
// (initial board, tumble steps, crates, FS chain) is RE-DERIVED here from the
// same `randomness` through the same pure core the settlement used
// (deriveFruitStacksRound) — the Hold & Win re-enactment pattern. Display and
// payout can never diverge because both are the same function of the seed.

import { decodeAbiParameters } from 'viem';
import type { HexString } from '@/bridge/types';
import type { SpinOutcome } from '@/engine/SlotEngine';
import { deriveFruitStacksRound, type FruitRound } from './fruitStacksSpin';
import { FRUIT_BUY_STAGES } from './fruitStacksMath';
import { FRUIT_STACKS_MATH } from './fruitStacksMath';
import { evaluateScatterPays } from './scatterPaysEval';

/** SpinOutcome + the re-derived cascade script for the presentation layer. */
export interface FruitStacksOutcome extends SpinOutcome {
  fruitRound: FruitRound;
}

export const FRUIT_GAME_STATE = [
  { type: 'uint8[6]', name: 'stops' },
  { type: 'uint256', name: 'totalWin' },
  { type: 'uint8', name: 'scatterCount' },
  { type: 'uint16', name: 'freeSpinsPlayed' },
  { type: 'bool', name: 'freeSpinsTriggered' },
  { type: 'uint8', name: 'buyStage' },
] as const;

export function decodeFruitStacksOutcome(
  rawGameState: HexString,
  totalWager: bigint,
  randomness: HexString,
): FruitStacksOutcome {
  const [stopsRaw, totalWin, scatterCount, freeSpinsPlayed, freeSpinsTriggered, buyStage] =
    decodeAbiParameters(FRUIT_GAME_STATE, rawGameState) as unknown as
    [readonly number[], bigint, number, number, boolean, number];

  // Re-derive the WHOLE round from the seed (identical function to
  // settlement) — a purchased round derives with its stage (min-gift rule).
  // For buys the wager is the COST; the round plays at the base bet.
  const stage = Number(buyStage);
  const costMult = stage > 0 ? FRUIT_BUY_STAGES[stage - 1].costMult : 0;
  const bet = stage > 0 ? (totalWager * 10n) / BigInt(Math.round(costMult * 10)) : totalWager;
  const round = deriveFruitStacksRound(randomness, bet, FRUIT_STACKS_MATH, stage);

  const board = round.base.initialBoard;
  return {
    stops: Array.from(stopsRaw),
    board,
    winAmount: BigInt(totalWin.toString()),
    wager: bet,
    scatterCount: Number(scatterCount),
    freeSpinsTriggered: Boolean(freeSpinsTriggered),
    freeSpinsPlayed: Number(freeSpinsPlayed),
    winResult: evaluateScatterPays(board, bet, undefined as never),
    holdWinTriggered: false,
    holdWinWin: 0n,
    holdWin: null,
    fruitRound: round,
  };
}

/** Type guard for the presentation layer. */
export function isFruitStacksOutcome(o: SpinOutcome): o is FruitStacksOutcome {
  return 'fruitRound' in o;
}
