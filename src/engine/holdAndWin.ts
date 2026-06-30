// engine/holdAndWin.ts — deterministic Hold & Win, mirror of SlotGame.sol
// _playHoldAndWin (and src/engine/holdAndWin.ts). 6+ COIN symbols on the trigger
// board start a lock-and-respin; each respin that lands ≥1 coin refreshes respins.
// Records per-step landed cells + values so the renderer replays the exact round.

import { SymbolId } from '../config/symbols';
import { REEL_COUNT } from './reels';
import { HOLD_WIN } from '../config/gameConfig';
import { hwDraw } from './rng';
import type { Board, Cell, HoldWinResult, HoldWinStep } from './types';

const { triggerMinCoins, startRespins, landProbBps, jackpotProbBps, grandValue, coinValues, jackpots } =
  HOLD_WIN;

function hwCoinValue(i: number): number {
  return coinValues[i % coinValues.length];
}
function hwJackpotValue(i: number): number {
  return jackpots[i % jackpots.length];
}

/** Mirror of _hwValue: jackpot tier if word%10000 < jackpotProbBps, else a coin value. */
function hwValue(word: bigint): { value: number; isJackpot: boolean } {
  if (word % 10_000n < BigInt(jackpotProbBps)) {
    return { value: hwJackpotValue(Number((word / 10_000n) % 3n)), isJackpot: true };
  }
  return { value: hwCoinValue(Number((word / 10_000n) % 8n)), isJackpot: false };
}

export function playHoldAndWin(randomness: bigint, board: Board, rows: number): HoldWinResult {
  const size = REEL_COUNT * rows;
  const locked = new Array<boolean>(size).fill(false);
  const flat = (reel: number, row: number) => row * REEL_COUNT + reel;
  const unflat = (idx: number): Cell => ({ reel: idx % REEL_COUNT, row: Math.floor(idx / REEL_COUNT) });

  let lockedCount = 0;
  let sum = 0;
  const steps: HoldWinStep[] = [];

  // Initial coins from the trigger board.
  const initLanded: Cell[] = [];
  const initValues: number[] = [];
  const initJackpot: boolean[] = [];
  for (let row = 0; row < rows; row++) {
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      if (board[row][reel] === SymbolId.COIN) {
        const idx = flat(reel, row);
        if (!locked[idx]) {
          locked[idx] = true;
          lockedCount++;
          const { value, isJackpot } = hwValue(hwDraw(randomness, 3, idx, 0));
          sum += value;
          initLanded.push(unflat(idx));
          initValues.push(value);
          initJackpot.push(isJackpot);
        }
      }
    }
  }

  const initialCoins = lockedCount;
  if (lockedCount < triggerMinCoins) {
    return { triggered: false, initialCoins, steps: [], lockedCells: [], grand: false, totalMultiplierX: 0 };
  }

  steps.push({
    step: 0,
    landed: initLanded,
    values: initValues,
    isJackpot: initJackpot,
    lockedCount,
    respinsLeft: startRespins,
  });

  let respins: number = startRespins;
  let step = 0;
  const maxSteps = size * (startRespins + 1) + startRespins + 5;
  while (respins > 0 && lockedCount < size && step < maxSteps) {
    const landed: Cell[] = [];
    const values: number[] = [];
    const isJackpot: boolean[] = [];
    for (let i = 0; i < size; i++) {
      if (locked[i]) continue;
      if (hwDraw(randomness, 1, step, i) % 10_000n < BigInt(landProbBps)) {
        locked[i] = true;
        lockedCount++;
        const { value, isJackpot: jp } = hwValue(hwDraw(randomness, 2, step, i));
        sum += value;
        landed.push(unflat(i));
        values.push(value);
        isJackpot.push(jp);
      }
    }
    respins = landed.length > 0 ? startRespins : respins - 1;
    step++;
    steps.push({ step, landed, values, isJackpot, lockedCount, respinsLeft: respins });
  }

  const grand = lockedCount === size;
  const totalMultiplierX = sum + (grand ? grandValue : 0);

  const lockedCells: Cell[] = [];
  for (let i = 0; i < size; i++) if (locked[i]) lockedCells.push(unflat(i));

  return { triggered: true, initialCoins, steps, lockedCells, grand, totalMultiplierX };
}
