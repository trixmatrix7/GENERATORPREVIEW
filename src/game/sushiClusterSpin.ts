// SUSHI PARTY — the ONE deterministic round derivation (math core).
//
// 6×6 CLUSTER + POWERNUDGE (Sugar Supreme PowerNudge construct, Report 19):
//   • a symbol pays with 5+ of its kind CONNECTED horizontally/vertically
//     (flood-fill, not diagonal); tiers 5,6,7,8,9,10,11,12,13,14,15+.
//   • POWERNUDGE: on every win, the win pays, then every COLUMN that held a
//     winning symbol drops 1 (fresh symbol on top). Each winning POSITION marks
//     its grid cell and adds +1 to that cell's multiplier. A win that covers
//     multiplier cells is multiplied by the SUM of all involved cell multipliers.
//     Loops until no win. BASE: multipliers cleared each round. FS: the multiplier
//     grid PERSISTS across the whole round and keeps growing.
//   • 3/4/5/6 scatters (anywhere) → 10/12/15/20 free spins. Retrigger ≥3 → +10.
//   • Buy: forces 3/4/5/6 scatters. Max win 5000×. RTP target 96.09%.
//
// PURE module (no imports/engine deps) so settlement (mockHost), decode façade
// and presentation all call the SAME function; the Node --strip-types sim
// certifies the identical rule. Settlement-math == display-math is the invariant.

export interface SushiMathConfig {
  /** 6 reel strips (base). Symbol ids 2..9 pay, 1 = scatter. */
  reelStrips: number[][];
  /** Special FS reel strips (higher scatter/high density — "spezielle Walzen"). */
  fsReelStrips: number[][];
  rows: number;   // 6
  reels: number;  // 6
  /** payTiers[symbolId] = [5,6,7,8,9,10,11,12,13,14,15+] in bps (10000 = 1× bet). */
  payTiers: Record<number, number[]>;
  minCluster: number;      // 5
  fsSpinsByScatter: Record<number, number>; // {3:10,4:12,5:15,6:20}
  retriggerSpins: number;  // +10
  maxWinMultiplier: number; // 5000
  /** per-cell multiplier ceiling (Noski saw ×20 cells) — tames the FS tail. */
  maxCellMulti: number;    // 25
  /** FS per-win multiplier increment (base always +1). The nudge cascades less
   *  than a tumble, so the persistent FS multiplier grid is the RTP lever. */
  fsMultiIncrement?: number; // e.g. 2..4
  /** buy forces this scatter distribution (count→weight). Default uniform 3-6.
   *  Weighting toward 3 makes the bought feature match natural triggers → buy RTP ≈ base RTP. */
  buyScatterWeights?: Record<number, number>;
}

const SCATTER = 1;

// ── deterministic RNG (sfc32 from bytes32 randomness) ──────────────────────
function rngFromHex(hex: string): () => number {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const word = (i: number) => parseInt(h.slice(i * 8, i * 8 + 8).padEnd(8, '0'), 16) >>> 0;
  let a = word(0), b = word(1), c = word(2), d = word(3);
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const out = (t + d) | 0;
    c = (c + out) | 0;
    return (out >>> 0) / 4294967296;
  };
}

function tierOf(count: number): number {
  // index into payTiers[sym]: 5→0, 6→1 … 14→9, 15+→10
  if (count >= 15) return 10;
  return count - 5;
}

// ── cluster flood-fill (4-connected, same symbol, non-scatter) ─────────────
function findClusters(board: number[][], rows: number, reels: number, minCluster: number)
  : { sym: number; cells: [number, number][] }[] {
  const seen = Array.from({ length: rows }, () => new Array(reels).fill(false));
  const out: { sym: number; cells: [number, number][] }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < reels; c++) {
    const sym = board[r][c];
    if (seen[r][c] || sym === SCATTER || sym <= 0) continue;
    // BFS same-symbol connected region
    const stack: [number, number][] = [[r, c]];
    const cells: [number, number][] = [];
    seen[r][c] = true;
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      cells.push([cr, cc]);
      const nb: [number, number][] = [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]];
      for (const [nr, ncc] of nb) {
        if (nr < 0 || nr >= rows || ncc < 0 || ncc >= reels) continue;
        if (!seen[nr][ncc] && board[nr][ncc] === sym) { seen[nr][ncc] = true; stack.push([nr, ncc]); }
      }
    }
    if (cells.length >= minCluster) out.push({ sym, cells });
  }
  return out;
}

// ── types the presentation replays ─────────────────────────────────────────
export interface ClusterWin {
  sym: number;
  cells: [number, number][];   // [row, reel]
  count: number;
  basePayBps: number;
  multiplier: number;          // sum of involved cell multis (≥1)
  amount: bigint;
}
export interface NudgeStep {
  wins: ClusterWin[];
  /** winner cells cleared this step ([row,reel]) — go dark, then column collapses */
  clearedCells: [number, number][];
  /** columns that tumbled this step (had ≥1 winning cell) */
  nudgedCols: number[];
  /** board AFTER this step's tumble+refill */
  boardAfter: number[][];
  /** multiplier grid AFTER this step (rows×reels, 0 = none) — position-fixed ×N cells */
  multiAfter: number[][];
  /** fresh symbols dropped in per tumbled column (top→down order) */
  refills: Record<number, number[]>;
}
export interface SushiSpin {
  stops: number[];
  initialBoard: number[][];
  steps: NudgeStep[];
  scatters: number;            // scatters on the settled initial board (anywhere)
  spinWin: bigint;             // total (all nudge steps)
  multiAtEnd: number[][];      // multiplier grid at spin end (FS carries this)
}
export interface SushiRound {
  base: SushiSpin;
  fsTriggered: boolean;
  fsSpins: SushiSpin[];
  totalWin: bigint;
  capped: boolean;
  buyStage: number;            // 0 = natural; 1 = bought
}

function boardFromStops(stops: number[], strips: number[][], rows: number): number[][] {
  const board: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let reel = 0; reel < strips.length; reel++) {
      const strip = strips[reel];
      row.push(strip[(stops[reel] + r) % strip.length]);
    }
    board.push(row);
  }
  return board;
}

/** One spin: initial board → PowerNudge loop. `multiGrid` carries in FS (mutated,
 *  persists); in base it starts empty and is discarded by the caller. */
function playSpin(
  rand: () => number,
  bet: bigint,
  cfg: SushiMathConfig,
  strips: number[][],
  multiGrid: number[][],   // rows×reels, mutated in place (FS persistence)
  multiInc: number,        // per-win multiplier increment (base 1; FS boosted)
): SushiSpin {
  const { rows, reels } = cfg;
  const stops = strips.map(s => Math.floor(rand() * s.length));
  const board = boardFromStops(stops, strips, rows);
  const initialBoard = board.map(r => [...r]);
  const scatters = board.flat().filter(v => v === SCATTER).length;

  const steps: NudgeStep[] = [];
  let spinWin = 0n;
  // PowerNudge pays a connection ONCE: winning cells are marked "paid" and travel
  // DOWN with the nudge; a cluster only pays when it holds ≥1 FRESH (unpaid) cell —
  // i.e. when a symbol arriving from the top forms or GROWS a connection. Without
  // this the shifted-but-identical cluster re-pays every nudge (RTP explodes ~24×).
  const paid = Array.from({ length: rows }, () => new Array(reels).fill(false));

  for (;;) {
    const allClusters = findClusters(board, rows, reels, cfg.minCluster);
    // A connection pays ONCE: it only counts while it is still an entirely FRESH
    // cluster (no already-paid cell). A shifted/grown version of the same symbols
    // carries its paid marks down, so it will not re-pay — only a brand-new
    // cluster formed by incoming top symbols does. (Tumble-equivalent RTP.)
    const clusters = allClusters.filter(cl => cl.cells.every(([r, c]) => !paid[r][c]));
    if (clusters.length === 0) break;

    const wins: ClusterWin[] = [];
    for (const cl of clusters) {
      const tiers = cfg.payTiers[cl.sym];
      if (!tiers) continue;
      const basePayBps = tiers[tierOf(cl.cells.length)];
      // effective multiplier = sum of cell multis over the cluster (≥1)
      let msum = 0;
      for (const [r, c] of cl.cells) msum += multiGrid[r][c];
      const mult = msum > 0 ? msum : 1;
      const amount = (bet * BigInt(basePayBps) * BigInt(mult)) / 10000n;
      wins.push({ sym: cl.sym, cells: cl.cells, count: cl.cells.length, basePayBps, multiplier: mult, amount });
    }
    for (const w of wins) spinWin += w.amount;

    // POWERNUDGE STEP (Noski ground truth — the winning symbols do NOT vanish):
    // every COLUMN holding a winning symbol NUDGES DOWN 1 together (a fresh symbol
    // slides in on top, the bottom row falls off). Each winning POSITION marks its
    // grid cell (+1, position-fixed; persists the whole round in FS). The nudged
    // board is re-evaluated, so a still-connected cluster keeps paying as it walks
    // down until it disperses ("kann weiter tumblen bis Spin vorbei"). A win
    // covering ×N cells already paid ×(sum of those cells) THIS step; the +1
    // applies to the NEXT win that lands there.
    const winnerSet = new Set<number>();
    for (const w of wins) for (const [r, c] of w.cells) winnerSet.add(r * reels + c);
    const winningCells: [number, number][] = [...winnerSet].map(k => [Math.floor(k / reels), k % reels]);
    const capM = cfg.maxCellMulti || 25;
    for (const [r, c] of winningCells) { multiGrid[r][c] = Math.min(capM, multiGrid[r][c] + multiInc); paid[r][c] = true; }
    const nudgedCols = [...new Set([...winnerSet].map(k => k % reels))].sort((a, b) => a - b);

    // NUDGE: each affected column shifts DOWN 1 (winners persist, shifted; bottom
    // cell falls off; a fresh strip symbol enters at the top). The multiplier grid
    // is POSITION-fixed — it does NOT move with the symbols.
    const refills: Record<number, number[]> = {};
    for (const c of nudgedCols) {
      for (let r = rows - 1; r >= 1; r--) { board[r][c] = board[r - 1][c]; paid[r][c] = paid[r - 1][c]; }
      const strip = strips[c];
      const fresh = strip[Math.floor(rand() * strip.length)];
      board[0][c] = fresh;
      paid[0][c] = false;   // the incoming top symbol is fresh — can trigger a pay
      refills[c] = [fresh];
    }

    steps.push({
      wins,
      clearedCells: winningCells,   // winning cells (highlighted; they NUDGE, not vanish)
      nudgedCols,
      boardAfter: board.map(r => [...r]),
      multiAfter: multiGrid.map(r => [...r]),
      refills,
    });
    if (steps.length > 60) break; // safety
  }

  return { stops, initialBoard, steps, scatters, spinWin, multiAtEnd: multiGrid.map(r => [...r]) };
}

/** THE round derivation — settlement + presentation both call this. */
export function deriveSushiRound(
  randomness: string,
  bet: bigint,
  cfg: SushiMathConfig,
  buyStage = 0,   // 0 = natural, 1 = bought FS
): SushiRound {
  const rand = rngFromHex(randomness);
  const maxWin = bet * BigInt(cfg.maxWinMultiplier);
  const rows = cfg.rows, reels = cfg.reels;
  const emptyMulti = () => Array.from({ length: rows }, () => new Array(reels).fill(0));

  let base: SushiSpin;
  if (buyStage > 0) {
    // Bought round: the base spin is only the trigger — force scatters (no pays).
    let scatterCount: number;
    const bw = cfg.buyScatterWeights;
    if (bw) {
      const entries = Object.entries(bw).map(([k, w]) => [Number(k), w] as [number, number]);
      const tot = entries.reduce((s, [, w]) => s + w, 0);
      let x = rand() * tot; scatterCount = entries[0][0];
      for (const [k, w] of entries) { if (x < w) { scatterCount = k; break; } x -= w; }
    } else {
      scatterCount = [3, 4, 5, 6][Math.min(3, Math.floor(rand() * 4))];
    }
    const stops = cfg.reelStrips.map(s => Math.floor(rand() * s.length));
    const board = boardFromStops(stops, cfg.reelStrips, rows);
    // inject scatters at distinct random cells
    const flat = Array.from({ length: rows * reels }, (_, i) => i);
    for (let i = flat.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [flat[i], flat[j]] = [flat[j], flat[i]]; }
    for (let k = 0; k < scatterCount; k++) { const cell = flat[k]; board[Math.floor(cell / reels)][cell % reels] = SCATTER; }
    base = { stops, initialBoard: board, steps: [], scatters: scatterCount, spinWin: 0n, multiAtEnd: emptyMulti() };
  } else {
    base = playSpin(rand, bet, cfg, cfg.reelStrips, emptyMulti(), 1);
  }

  let totalWin = base.spinWin > maxWin ? maxWin : base.spinWin;
  const fsTriggered = buyStage > 0 || base.scatters >= 3;
  const fsSpins: SushiSpin[] = [];
  let capped = totalWin >= maxWin;

  if (fsTriggered && !capped) {
    const startScatter = Math.min(6, Math.max(3, base.scatters || 3));
    let remaining = cfg.fsSpinsByScatter[startScatter] ?? 10;
    const fsMulti = emptyMulti();   // PERSISTS across all FS spins (Noski: grows to 20x+)
    let played = 0;
    while (remaining > 0 && played < 200) {
      const spin = playSpin(rand, bet, cfg, cfg.fsReelStrips, fsMulti, cfg.fsMultiIncrement ?? 1);
      fsSpins.push(spin);
      totalWin += spin.spinWin;
      remaining--; played++;
      if (spin.scatters >= 3) remaining += cfg.retriggerSpins; // retrigger +10
      if (totalWin >= maxWin) { totalWin = maxWin; capped = true; break; }
    }
  }

  return { base, fsTriggered, fsSpins, totalWin, capped, buyStage };
}
