// SlotEngine — decodes on-chain game state and drives the frontend presentation layer.
// All payout authority lives in the Solidity contract; this module only renders.

import { decodeAbiParameters, encodeAbiParameters } from 'viem';
import type { HexString } from '@/bridge/types';
import { buildBoard, REEL_LENGTHS } from '@/config/reels';
import { evaluateWins, computeWinChance, type WinResult } from './WinEvaluator';
import { SymbolId } from '@/config/symbols';
import { playDeterministicHoldAndWin, HW_TRIGGER_MIN, type HwRound } from './holdAndWin';

/** Decoded result of a settled spin, parsed from raw.gameState. */
export interface SpinOutcome {
  stops: number[];          // reel stop positions [r0, r1, r2, r3, r4]
  board: number[][];        // board[row][reel] — grid-dependent
  winAmount: bigint;        // authoritative payout from chain (includes free spins + Hold & Win)
  wager: bigint;            // total wager for tier resolution (win/bet ratio)
  scatterCount: number;     // number of scatters on the base spin board
  freeSpinsTriggered: boolean;
  freeSpinsPlayed: number;  // how many free spins were run on-chain (0 if no trigger)
  winResult: WinResult;     // frontend win evaluation of the base spin board (for highlighting)
  holdWinTriggered: boolean;        // 6+ coins on the base board opened Hold & Win
  holdWinWin: bigint;               // authoritative Hold & Win portion of winAmount
  holdWin: HwRound | null;          // round re-derived from randomness, for animation only
}

/** Flat indices (row * reelCount + reel) of coin symbols on the board. */
function coinCellIndices(board: number[][]): number[] {
  const out: number[] = [];
  for (let row = 0; row < board.length; row++) {
    const cols = board[row].length;
    for (let reel = 0; reel < cols; reel++) {
      if (board[row][reel] === SymbolId.COIN) out.push(row * cols + reel);
    }
  }
  return out;
}

const GAME_STATE_V2 = [
  { type: 'uint8[5]', name: 'stops' },
  { type: 'uint256', name: 'totalWin' },
  { type: 'uint8', name: 'scatterCount' },
  { type: 'uint8', name: 'freeSpinsPlayed' },
  { type: 'bool', name: 'freeSpinsTriggered' },
  { type: 'bool', name: 'holdWinTriggered' },
  { type: 'uint256', name: 'holdWinWin' },
] as const;
const GAME_STATE_V1 = GAME_STATE_V2.slice(0, 5);

// Static-encoded sizes are exact: v1 = 9 words (uint8[5]→5, +uint256+uint8+uint8+bool),
// v2 = 11 words (+bool holdWinTriggered +uint256 holdWinWin). Used to pick the
// schema by length rather than guessing via try/catch.
const GAME_STATE_V1_BYTES = 9 * 32;
const GAME_STATE_V2_BYTES = 11 * 32;
const HEX_RE = /^0x[0-9a-fA-F]*$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * Decode a settled session's raw.gameState into a SpinOutcome.
 *
 * gameState ABI (v2): (uint8[5] stops, uint256 totalWin, uint8 scatterCount,
 *   uint8 freeSpinsPlayed, bool freeSpinsTriggered, bool holdWinTriggered,
 *   uint256 holdWinWin). v1 omitted the two Hold & Win fields — already-deployed
 *   contracts emit v1, so we decode v2 first and fall back to v1 for compat.
 *
 * `randomness` (raw.randomness from the settled session) lets us re-derive the
 * deterministic Hold & Win round for animation — the contract computed the same
 * round, so this is a faithful replay, never an invented outcome.
 */
export function decodeSpinOutcome(
  rawGameState: HexString,
  totalWager: bigint,
  randomness?: HexString,
): SpinOutcome {
  if (typeof rawGameState !== 'string' || !HEX_RE.test(rawGameState) || rawGameState.length % 2 !== 0) {
    throw new Error(`decodeSpinOutcome: malformed gameState hex (length ${String(rawGameState).length})`);
  }
  const byteLen = (rawGameState.length - 2) / 2;
  if (byteLen < GAME_STATE_V1_BYTES) {
    throw new Error(`decodeSpinOutcome: gameState too short (${byteLen} bytes, need >= ${GAME_STATE_V1_BYTES})`);
  }

  let stopsRaw: readonly number[];
  let winAmount: bigint, scatterCount: number | bigint, freeSpinsPlayed: number | bigint;
  let freeSpinsTriggered: boolean, holdWinTriggered = false;
  let holdWinWin: bigint = 0n;
  // Pick the schema by ENCODED LENGTH, not try/catch. viem's decode is lenient
  // with trailing data, so a v2 schema would read garbage off v1 data and a v1
  // schema would silently DROP the Hold & Win fields off v2 data — either way a
  // real-money bug. The static sizes are exact, so length disambiguates safely.
  if (byteLen >= GAME_STATE_V2_BYTES) {
    const d = decodeAbiParameters(GAME_STATE_V2, rawGameState);
    [stopsRaw, winAmount, scatterCount, freeSpinsPlayed, freeSpinsTriggered, holdWinTriggered, holdWinWin] =
      d as unknown as [readonly number[], bigint, number, number, boolean, boolean, bigint];
  } else {
    const d = decodeAbiParameters(GAME_STATE_V1, rawGameState);
    [stopsRaw, winAmount, scatterCount, freeSpinsPlayed, freeSpinsTriggered] =
      d as unknown as [readonly number[], bigint, number, number, boolean];
  }

  const stops = Array.from(stopsRaw);
  const board = buildBoard(stops);
  // winResult reflects only the base spin board — used for symbol highlighting.
  // The authoritative total payout (free spins + Hold & Win) is winAmount.
  const winResult = evaluateWins(board, totalWager);

  // Re-derive the Hold & Win round for animation, but ONLY from a well-formed
  // 32-byte randomness. A short/garbage value would seed a DIFFERENT round than
  // the chain computed, so we skip the animation rather than show a wrong one —
  // the payout (winAmount) is already authoritative either way.
  let holdWin: HwRound | null = null;
  if (holdWinTriggered) {
    if (randomness && BYTES32_RE.test(randomness)) {
      const coins = coinCellIndices(board);
      if (coins.length >= HW_TRIGGER_MIN) {
        holdWin = playDeterministicHoldAndWin(
          BigInt(randomness),
          coins,
          board.length * (board[0]?.length ?? 0),
        );
      }
    } else if (typeof console !== 'undefined') {
      console.warn('[slot] Hold & Win triggered but randomness is missing/invalid — skipping the bonus animation (payout is still authoritative).');
    }
  }

  return {
    stops,
    board,
    winAmount: BigInt(winAmount.toString()),
    wager: totalWager,
    scatterCount: Number(scatterCount),
    freeSpinsTriggered: Boolean(freeSpinsTriggered),
    freeSpinsPlayed: Number(freeSpinsPlayed),
    winResult,
    holdWinTriggered: Boolean(holdWinTriggered),
    holdWinWin: BigInt(holdWinWin.toString()),
    holdWin,
  };
}

/**
 * Encode gameData for openSession. A normal spin sends none ('0x'); a bonus buy
 * sends abi.encode(true), which the contract reads via _isBuyBonus to force the
 * free-spins round (and charge the premium passed as the wager).
 */
export function encodeGameData(buyBonus = false): HexString {
  return buyBonus ? encodeAbiParameters([{ type: 'bool' }], [true]) : '0x';
}

/**
 * Derive reel stops from a bytes32 randomness value (mirrors Solidity _deriveStops).
 * Used ONLY in the dev harness — never for authoritative outcomes.
 */
export function deriveStopsFromRandomness(randomness: `0x${string}`): number[] {
  let seed = BigInt(randomness);
  const stops: number[] = [];
  const stripLengths = REEL_LENGTHS;
  for (let i = 0; i < 5; i++) {
    stops.push(Number(seed % BigInt(stripLengths[i])));
    seed = seed / BigInt(stripLengths[i]);
  }
  return stops;
}

/**
 * Compute client-side win preview (bet × expected multiplier).
 * This is a HINT only — the chain is authoritative.
 */
export function previewWin(wager: bigint): {
  winChancePct: number;
  profitOnWin: bigint;
  totalReturn: bigint;
  multiplier: number;
} {
  const { winChancePct, expectedMultiplier } = computeWinChance(wager);
  const totalReturn = (wager * BigInt(Math.round(expectedMultiplier * 10000))) / 10000n;
  const profitOnWin = totalReturn > wager ? totalReturn - wager : 0n;
  return {
    winChancePct,
    profitOnWin,
    totalReturn,
    multiplier: expectedMultiplier,
  };
}

/** Check if a scatter count triggers free spins. */
export function isScatterTrigger(scatterCount: number): boolean {
  return scatterCount >= 3;
}

/** Get the winning cells from a WinResult for visual highlighting. */
export function getWinningCells(winResult: WinResult): Set<string> {
  const cells = new Set<string>();
  for (const combo of winResult.combinations) {
    if (combo.symbolId !== SymbolId.SCATTER) {
      for (const [row, reel] of combo.cells) {
        cells.add(`${row}:${reel}`);
      }
    }
  }
  return cells;
}
