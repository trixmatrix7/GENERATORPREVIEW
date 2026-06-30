// engine/reels.ts — reel strips + board build. VERBATIM from the Fantasy ZIP
// (src/config/reels.ts) and SlotGame.sol _reelStrip/_buildBoard. Strip-reel model:
// each reel is a fixed 40-symbol strip; the stop indexes a window of VISIBLE rows.

export const REEL_STRIPS: readonly (readonly number[])[] = [
  // Reel 0
  [8, 8, 7, 8, 8, 6, 8, 7, 8, 5, 8, 6, 8, 7, 4, 8, 8, 7, 6, 8,
   5, 8, 7, 3, 8, 6, 8, 8, 4, 7, 8, 6, 8, 8, 8, 7, 8, 8, 8, 8],
  // Reel 1
  [8, 7, 6, 1, 5, 8, 4, 8, 7, 3, 8, 6, 2, 8, 5, 7, 8, 4, 1, 8,
   6, 2, 8, 7, 5, 0, 8, 3, 7, 1, 8, 6, 5, 8, 4, 7, 8, 6, 8, 3],
  // Reel 2
  [8, 6, 4, 2, 8, 7, 5, 3, 0, 8, 6, 4, 2, 8, 7, 5, 3, 8, 1, 6,
   4, 2, 8, 7, 5, 3, 8, 4, 6, 2, 8, 5, 7, 8, 8, 2, 4, 3, 7, 0],
  // Reel 3
  [8, 6, 4, 3, 2, 0, 8, 5, 3, 8, 2, 4, 0, 7, 3, 8, 4, 2, 5, 7,
   3, 0, 5, 2, 8, 1, 3, 2, 8, 4, 8, 3, 2, 5, 4, 0, 8, 7, 6, 3],
  // Reel 4
  [3, 5, 2, 3, 0, 4, 6, 3, 2, 0, 7, 3, 2, 4, 8, 2, 6, 3, 0, 2,
   7, 5, 4, 3, 2, 8, 0, 3, 4, 5, 2, 3, 8, 6, 2, 5, 0, 4, 6, 7],
] as const;

export const REEL_COUNT = REEL_STRIPS.length; // 5
export const REEL_LENGTH = REEL_STRIPS[0].length; // 40 (uniform — contract invariant)

/** Window of `rows` symbols on a reel starting at `stop` (wrapping). */
export function getVisibleSymbols(reelIndex: number, stop: number, rows: number): number[] {
  const strip = REEL_STRIPS[reelIndex];
  const len = strip.length;
  const out: number[] = [];
  for (let r = 0; r < rows; r++) out.push(strip[(stop + r) % len]);
  return out;
}

/** board[row][reel]. Mirrors SlotGame.sol _buildBoard for arbitrary visible rows. */
export function buildBoard(stops: number[], rows: number): number[][] {
  const board: number[][] = Array.from({ length: rows }, () => [] as number[]);
  for (let reel = 0; reel < REEL_COUNT; reel++) {
    const col = getVisibleSymbols(reel, stops[reel], rows);
    for (let row = 0; row < rows; row++) board[row][reel] = col[row];
  }
  return board;
}
