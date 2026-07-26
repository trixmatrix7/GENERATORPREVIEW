// Sushi Party DECODE FAÇADE — bypasses the frozen SlotEngine.decodeSpinOutcome
// (whose uint8[5] schema cannot carry a 6-reel cluster + PowerNudge board).
//
// The mock settlement encodes only the authoritative totals; the full round
// (initial board, PowerNudge steps, persistent multiplier grid, FS chain) is
// RE-DERIVED here from the same `randomness` through the same pure core the
// settlement used (deriveSushiRound) — the Hold & Win re-enactment pattern.
// Display and payout can never diverge because both are the same function of
// the seed. There is no cluster evaluator, so winResult is a minimal empty
// literal — the presentation layer reads sushiRound.steps, not winResult.

import { decodeAbiParameters } from 'viem';
import type { HexString } from '@/bridge/types';
import type { SpinOutcome } from '@/engine/SlotEngine';
import { deriveSushiRound, type SushiRound } from './sushiClusterSpin';
import { SUSHI_MATH, SUSHI_BUY_STAGES } from './sushiMath';

/** SpinOutcome + the re-derived cluster/nudge script for the presentation layer. */
export interface SushiPartyOutcome extends SpinOutcome {
  sushiRound: SushiRound;
}

export const SUSHI_GAME_STATE = [
  { type: 'uint8[6]', name: 'stops' },
  { type: 'uint256', name: 'totalWin' },
  { type: 'uint8', name: 'scatterCount' },
  { type: 'uint16', name: 'fsPlayed' },
  { type: 'bool', name: 'fsTriggered' },
  { type: 'uint8', name: 'buyStage' },
] as const;

export function decodeSushiOutcome(
  rawGameState: HexString,
  totalWager: bigint,
  randomness: HexString,
): SushiPartyOutcome {
  const [stopsRaw, totalWin, scatterCount, fsPlayed, fsTriggered, buyStage] =
    decodeAbiParameters(SUSHI_GAME_STATE, rawGameState) as unknown as
    [readonly number[], bigint, number, number, boolean, number];

  // Re-derive the WHOLE round from the seed (identical function to
  // settlement) — a purchased round derives with its stage (forced-scatter FS).
  // For buys the wager is the COST; the round plays at the base bet.
  const stage = Number(buyStage);
  const costMult = stage > 0 ? SUSHI_BUY_STAGES[stage - 1].costMult : 0;
  const bet = stage > 0 ? (totalWager * 10n) / BigInt(Math.round(costMult * 10)) : totalWager;
  const round = deriveSushiRound(randomness, bet, SUSHI_MATH, stage);

  const board = round.base.initialBoard;
  return {
    stops: Array.from(stopsRaw),
    board,
    winAmount: BigInt(totalWin.toString()),
    wager: bet,
    scatterCount: Number(scatterCount),
    freeSpinsTriggered: Boolean(fsTriggered),
    freeSpinsPlayed: Number(fsPlayed),
    // No cluster evaluator — smallest valid WinResult; presentation reads sushiRound.steps.
    winResult: { totalWin: 0n, combinations: [], scatterCount: 0, scatterPaid: false },
    holdWinTriggered: false,
    holdWinWin: 0n,
    holdWin: null,
    sushiRound: round,
  };
}

/** Type guard for the presentation layer. */
export function isSushiOutcome(o: SpinOutcome): o is SushiPartyOutcome {
  return 'sushiRound' in o;
}
