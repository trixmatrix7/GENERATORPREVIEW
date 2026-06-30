// engine/ways.ts — ways-pays evaluation. Byte-for-byte port of SlotGame.sol
// _evaluateWins, generalised to `rows` (5 for the Fantasy spec, 3 for the 5x3
// test grid). Candidate symbols are seeded from reel 0 only (left-to-right ways).
// wager is fixed at 1 so every win is returned in ×bet.

import { SymbolId } from '../config/symbols';
import { REEL_COUNT } from './reels';
import { payBps, scatterPayBps, MIN_MATCHING_REELS, BPS_DIVISOR } from './paytable';
import type { Board, WinConnection, Cell } from './types';

export interface EvalResult {
  scatterCount: number;
  scatterWinX: number;
  connections: WinConnection[];
  baseWinX: number;
}

export function evaluateWins(board: Board, rows: number): EvalResult {
  // scatter count over the whole board
  let scatterCount = 0;
  for (let row = 0; row < rows; row++) {
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      if (board[row][reel] === SymbolId.SCATTER) scatterCount++;
    }
  }

  const scPay = scatterPayBps(scatterCount);
  const scatterWinX = scPay > 0 ? scPay / BPS_DIVISOR : 0;

  const connections: WinConnection[] = [];
  const evaluated = new Array<boolean>(16).fill(false);

  for (let row = 0; row < rows; row++) {
    const sym = board[row][0];
    if (sym === SymbolId.SCATTER) continue;
    const effectiveSym = sym === SymbolId.WILD ? SymbolId.HIGH_A : sym;
    if (evaluated[effectiveSym]) continue;
    evaluated[effectiveSym] = true;

    let matchReels = 0;
    let ways = 1;
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      let reelCount = 0;
      for (let r = 0; r < rows; r++) {
        const cell = board[r][reel];
        if (cell === effectiveSym || cell === SymbolId.WILD) reelCount++;
      }
      if (reelCount === 0) break;
      matchReels++;
      ways *= reelCount;
    }

    if (matchReels < MIN_MATCHING_REELS) continue;
    const pBps = payBps(effectiveSym, matchReels);
    if (pBps === 0) continue;

    // collect the contributing cells across the matched reels (for highlight)
    const cells: Cell[] = [];
    for (let reel = 0; reel < matchReels; reel++) {
      for (let r = 0; r < rows; r++) {
        const cell = board[r][reel];
        if (cell === effectiveSym || cell === SymbolId.WILD) cells.push({ reel, row: r });
      }
    }

    connections.push({
      symbol: effectiveSym,
      matchReels,
      ways,
      payBps: pBps,
      winX: (ways * pBps) / BPS_DIVISOR,
      cells,
    });
  }

  // Sequential reveal order: by symbol value ASC (small pays first, builds to the big one).
  connections.sort((a, b) => payBps(a.symbol, 5) - payBps(b.symbol, 5) || a.symbol - b.symbol);

  const baseWinX = scatterWinX + connections.reduce((s, c) => s + c.winX, 0);
  return { scatterCount, scatterWinX, connections, baseWinX };
}
