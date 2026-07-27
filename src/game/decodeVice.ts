// Vice Heat DECODE FAÇADE — bypasses the frozen SlotEngine.decodeSpinOutcome
// (whose uint8[5] schema carries only round TOTALS, so the free-spins round had
// no script and the presentation invented its own with Math.random()).
//
// The mock settlement encodes only the authoritative totals; the full round
// (base spin, hot expansion, every free spin's stops/board/towers/credited win)
// is RE-DERIVED here from the same `randomness` through the same pure core the
// settlement used (deriveViceRound) — the Hold & Win re-enactment pattern.
// Display and payout can never diverge because both are the same function of
// the seed.

import { decodeAbiParameters } from 'viem';
import type { HexString } from '@/bridge/types';
import type { SpinOutcome } from '@/engine/SlotEngine';
import { mathProfileById, loadMathProfileId } from '@/config/mathProfiles';
import { deriveViceRound, isViceMathConfig, type ViceMathConfig, type ViceRound } from './viceSpin';

/** SpinOutcome + the re-derived round script for the presentation layer. */
export interface ViceHeatOutcome extends SpinOutcome {
  viceRound: ViceRound;
}

export const VICE_GAME_STATE = [
  { type: 'uint8[5]', name: 'stops' },
  { type: 'uint256', name: 'totalWin' },
  { type: 'uint8', name: 'scatterCount' },
  { type: 'uint16', name: 'freeSpinsPlayed' },
  { type: 'bool', name: 'freeSpinsTriggered' },
  { type: 'uint8', name: 'stageCode' },
] as const;

/** The ACTIVE math profile as a Vice config — the same object App.tsx hands to
 *  MockHost, so settle and decode derive against identical strips/pays. */
export function activeViceConfig(): ViceMathConfig {
  const built = mathProfileById(loadMathProfileId()).build?.();
  if (!built || !isViceMathConfig(built)) {
    throw new Error('decodeViceOutcome: active math profile is not a Vice profile.');
  }
  return built as unknown as ViceMathConfig;
}

export function decodeViceOutcome(
  rawGameState: HexString,
  totalWager: bigint,
  randomness: HexString,
): ViceHeatOutcome {
  const [stopsRaw, totalWin, scatterCount, freeSpinsPlayed, freeSpinsTriggered, stageCode] =
    decodeAbiParameters(VICE_GAME_STATE, rawGameState) as unknown as
    [readonly number[], bigint, number, number, boolean, number];

  const config = activeViceConfig();
  // Re-derive the WHOLE round from the seed (identical function to settlement).
  // For a bought/ante round the wager is the COST; the round plays at the BASE
  // bet, recovered from the stage's cost multiplier exactly as mockHost does.
  const stage = Number(stageCode);
  const buy = config.viceBuyStages?.find(st => st.stage === stage);
  const bet = buy
    ? totalWager / BigInt(buy.costMult)
    : stage === 3 && config.anteBet
      ? (totalWager * 100n) / BigInt(Math.round(config.anteBet.costMult * 100))
      : totalWager;
  const round = deriveViceRound(randomness as `0x${string}`, bet, config, stage);

  return {
    stops: Array.from(stopsRaw),
    // AS LANDED — the reels stop on this. A hot spin's expansion is played from
    // viceRound.base.expandedReels / evalBoard by the presentation.
    board: round.base.board,
    winAmount: BigInt(totalWin.toString()),
    wager: bet,
    scatterCount: Number(scatterCount),
    freeSpinsTriggered: Boolean(freeSpinsTriggered),
    freeSpinsPlayed: Number(freeSpinsPlayed),
    // Evaluation of the base spin's EVALUATED board (post hot expansion).
    winResult: round.base.winResult,
    holdWinTriggered: false,
    holdWinWin: 0n,
    holdWin: null,
    viceRound: round,
  };
}

/** Type guard for the presentation layer. */
export function isViceOutcome(o: SpinOutcome): o is ViceHeatOutcome {
  return 'viceRound' in o;
}
