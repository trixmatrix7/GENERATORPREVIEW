// engine/spin.ts — full spin lifecycle. Mirror of SlotGame.sol onRandomness:
// base eval → free-spins round (flat ×multiplier, retriggers) → Hold & Win,
// each addition capped at maxWinMultiplier × bet. Parametric on grid rows.

import { GRIDS } from '../config/gridConfig';
import { SPEC } from '../config/gameConfig';
import { deriveStops, freeSpinSeed, randomSeed, toBig } from './rng';
import { buildBoard } from './reels';
import { evaluateWins } from './ways';
import { playHoldAndWin } from './holdAndWin';
import type { Outcome, SpinOptions, FreeSpin, BaseResult, WinTier, HoldWinResult } from './types';

const MAX_WIN_X = SPEC.maxWinMultiplier;

function tierFor(winX: number): WinTier {
  if (winX <= 0) return 'none';
  if (winX < 2) return 'small';
  if (winX < 10) return 'normal';
  if (winX < 50) return 'big';
  return 'mega';
}

export function spin(opts: SpinOptions): Outcome {
  const grid = GRIDS[opts.grid];
  const rows = grid.rows;
  const seed = opts.seed ?? randomSeed();
  const randomness = toBig(seed);
  const bet = opts.bet;
  const buyBonus = !!opts.buyBonus;

  const stops = deriveStops(randomness);
  const board = buildBoard(stops, rows);
  const baseEval = evaluateWins(board, rows);

  const base: BaseResult = {
    board,
    stops,
    scatterCount: baseEval.scatterCount,
    connections: baseEval.connections,
    scatterWinX: baseEval.scatterWinX,
    baseWinX: baseEval.baseWinX,
  };

  let totalWinX = 0;
  let capped = false;
  let fsTriggered: boolean;

  if (buyBonus) {
    fsTriggered = true; // purchased round — the triggering spin itself doesn't pay
  } else {
    totalWinX = Math.min(baseEval.baseWinX, MAX_WIN_X);
    if (baseEval.baseWinX > MAX_WIN_X) capped = true;
    fsTriggered = baseEval.scatterCount >= SPEC.freeSpinsTriggerScatters;
  }

  // ── Free spins ──
  const fsSpins: FreeSpin[] = [];
  let played = 0;
  if (fsTriggered) {
    let remaining = SPEC.freeSpinsCount;
    while (remaining > 0 && played < SPEC.freeSpinsCap) {
      const s = freeSpinSeed(randomness, played);
      const fsStops = deriveStops(s);
      const fsBoard = buildBoard(fsStops, rows);
      const fe = evaluateWins(fsBoard, rows);
      const winX = fe.baseWinX * SPEC.freeSpinsMultiplier;
      totalWinX += winX;
      if (totalWinX > MAX_WIN_X) {
        totalWinX = MAX_WIN_X;
        capped = true;
      }
      const retrigger = fe.scatterCount >= SPEC.freeSpinsTriggerScatters;
      fsSpins.push({
        index: played,
        board: fsBoard,
        stops: fsStops,
        scatterCount: fe.scatterCount,
        rawWinX: fe.baseWinX,
        winX,
        retrigger,
      });
      if (retrigger) remaining += SPEC.freeSpinsCount;
      remaining--;
      played++;
    }
  }
  const freeSpins = {
    triggered: fsTriggered,
    spins: fsSpins,
    played,
    multiplier: SPEC.freeSpinsMultiplier,
    totalWinX: fsSpins.reduce((s, f) => s + f.winX, 0),
  };

  // ── Hold & Win (base game; never on a purchased FS round) ──
  let holdWin: HoldWinResult = {
    triggered: false,
    initialCoins: 0,
    steps: [],
    lockedCells: [],
    grand: false,
    totalMultiplierX: 0,
  };
  if (!buyBonus) {
    const hw = playHoldAndWin(randomness, board, rows);
    if (hw.triggered) {
      const preHold = totalWinX;
      totalWinX += hw.totalMultiplierX;
      if (totalWinX > MAX_WIN_X) {
        totalWinX = MAX_WIN_X;
        capped = true;
        hw.totalMultiplierX = Math.max(0, MAX_WIN_X - preHold);
      }
      holdWin = hw;
    }
  }

  totalWinX = Math.min(totalWinX, MAX_WIN_X);

  return {
    seed,
    grid: opts.grid,
    bet,
    base,
    freeSpins,
    holdWin,
    totalWinX,
    totalWin: totalWinX * bet,
    tier: tierFor(totalWinX),
    capped,
  };
}
