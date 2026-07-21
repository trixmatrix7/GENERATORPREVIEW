// FRUIT STACKS — the ONE deterministic round derivation (math core).
//
// 6×5 SCATTER-PAYS TUMBLER (construct: research/slot-feel/18):
//   • a symbol pays with 8+ of its kind ANYWHERE (tiers 8-9 / 10-11 / 12+)
//   • winners pop, survivors fall, fresh symbols refill from the top,
//     the board re-evaluates — one spin = a chain of tumble steps
//   • crate symbols (id 0, the repurposed wild slot) carry ×N values that
//     SUM and multiply the whole spin's win
//   • 4+ scatters → free spins with a persistent multiplier POOL (applies
//     only when a NEW crate lands in that spin, reference rule)
//
// This module is intentionally PURE — no imports, no engine deps — so BOTH
// settlement (mockHost) and presentation (decode façade → PixiApp) call the
// SAME function, and the Python-free Node sim (custom-math/sim_fruit_stacks
// .mjs via --experimental-strip-types) certifies the identical rule.
// Presentation-math == settlement-math is the repo's hard invariant.

export interface FruitStacksMathConfig {
  /** 6 reel strips (display + initial board + refill weights all draw here). */
  reelStrips: number[][];
  visibleRows: number;
  /** payTiers[symbolId] = [bps for 8-9, 10-11, 12+] (10000 = 1× bet). */
  payTiers: Record<number, [number, number, number]>;
  /** Scatter direct pays: [4sc, 5sc, 6+sc] in bps. */
  scatterPayBps: [number, number, number];
  /** Crate ×values with weights: [value, weight][]. */
  multiWeights: [number, number][];
  freeSpinsCount: number;      // 15
  retriggerSpins: number;      // +5 on 3+ sc in a FS spin
  freeSpinsCap: number;        // hard spin cap per round
  multiPoolCap: number;        // pool cap (reference ×500)
  maxWinMultiplier: number;    // session cap (× bet)
}

export interface TumbleWin {
  symbolId: number;
  count: number;
  tier: 0 | 1 | 2;
  payBps: number;
  cells: [number, number][];   // [row, reel] of EVERY cell of that symbol
  amount: bigint;
}

export interface TumbleStep {
  wins: TumbleWin[];
  /** every removed cell this step (the pop-apart set) */
  removed: [number, number][];
  /** refills[reel] = symbols entering from the top, TOP-FIRST order */
  refills: number[][];
  boardAfter: number[][];
}

export interface CrateLanding {
  cell: [number, number];
  value: number;
  /** step index it landed on (-1 = initial board) */
  step: number;
}

export interface FruitSpin {
  stops: number[];
  initialBoard: number[][];
  steps: TumbleStep[];
  crates: CrateLanding[];
  scatters: number;            // scatters seen across the whole spin
  scatterPay: bigint;
  winBeforeMulti: bigint;      // tumble wins + scatter pay
  multiSum: number;            // sum of crate values THIS spin (0 = none)
  poolBefore: number;          // FS only (0 in base)
  poolAfter: number;
  spinWin: bigint;             // after multiplier application
}

export interface FruitRound {
  base: FruitSpin;
  fsTriggered: boolean;
  fsSpins: FruitSpin[];
  totalWin: bigint;            // capped, authoritative
  capped: boolean;
}

// ── deterministic RNG (sfc32) seeded from the bytes32 randomness ───────────
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

const SCATTER = 1;
const MULTI = 0;

function drawMulti(rand: () => number, weights: [number, number][]): number {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  for (const [v, w] of weights) { x -= w; if (x < 0) return v; }
  return weights[0][0];
}

function tierOf(count: number): 0 | 1 | 2 {
  return count >= 12 ? 2 : count >= 10 ? 1 : 0;
}

/** One spin (base or FS): initial board → tumble chain → multiplier. */
function playSpin(
  rand: () => number,
  bet: bigint,
  cfg: FruitStacksMathConfig,
  poolBefore: number,
): FruitSpin {
  const rows = cfg.visibleRows;
  const reels = cfg.reelStrips.length;

  // Initial board straight off the strips (same rule the reels display).
  const stops = cfg.reelStrips.map(s => Math.floor(rand() * s.length));
  const board: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let reel = 0; reel < reels; reel++) {
      const strip = cfg.reelStrips[reel];
      row.push(strip[(stops[reel] + r) % strip.length]);
    }
    board.push(row);
  }

  const crates: CrateLanding[] = [];
  let scatters = 0;
  const noteLandings = (cells: Iterable<[number, number, number]>, step: number) => {
    for (const [row, reel, sym] of cells) {
      if (sym === MULTI) crates.push({ cell: [row, reel], value: drawMulti(rand, cfg.multiWeights), step });
      else if (sym === SCATTER) scatters++;
    }
  };
  noteLandings(function* () {
    for (let r = 0; r < rows; r++) for (let c = 0; c < reels; c++) yield [r, c, board[r][c]] as [number, number, number];
  }(), -1);

  // Tumble chain.
  const steps: TumbleStep[] = [];
  let winBeforeMulti = 0n;
  for (;;) {
    // count each paying symbol anywhere on the board
    const cellsBySym = new Map<number, [number, number][]>();
    for (let r = 0; r < rows; r++) for (let c = 0; c < reels; c++) {
      const s = board[r][c];
      if (cfg.payTiers[s]) {
        let arr = cellsBySym.get(s);
        if (!arr) cellsBySym.set(s, arr = []);
        arr.push([r, c]);
      }
    }
    const wins: TumbleWin[] = [];
    for (const [sym, cells] of cellsBySym) {
      if (cells.length < 8) continue;
      const tier = tierOf(cells.length);
      const payBps = cfg.payTiers[sym][tier];
      wins.push({
        symbolId: sym, count: cells.length, tier, payBps, cells,
        amount: (bet * BigInt(payBps)) / 10000n,
      });
    }
    if (wins.length === 0) break;

    for (const w of wins) winBeforeMulti += w.amount;
    const removed = wins.flatMap(w => w.cells);
    const removedSet = new Set(removed.map(([r, c]) => r * reels + c));

    // gravity + refill, column by column
    const refills: number[][] = [];
    for (let c = 0; c < reels; c++) {
      const survivors: number[] = [];
      for (let r = 0; r < rows; r++) {
        if (!removedSet.has(r * reels + c)) survivors.push(board[r][c]);
      }
      const need = rows - survivors.length;
      const strip = cfg.reelStrips[c];
      const fresh: number[] = [];
      for (let i = 0; i < need; i++) fresh.push(strip[Math.floor(rand() * strip.length)]);
      refills.push(fresh);
      const col = [...fresh, ...survivors]; // fresh land on top
      for (let r = 0; r < rows; r++) board[r][c] = col[r];
      noteLandings(fresh.map((sym, i) => [i, c, sym] as [number, number, number]), steps.length);
    }
    steps.push({ wins, removed, refills, boardAfter: board.map(r => [...r]) });
    if (steps.length > 40) break; // physical impossibility guard
  }

  // Scatter direct pay (4+ anywhere across the spin).
  let scatterPay = 0n;
  if (scatters >= 4) {
    const idx = Math.min(scatters - 4, 2);
    scatterPay = (bet * BigInt(cfg.scatterPayBps[idx])) / 10000n;
    winBeforeMulti += scatterPay;
  }

  // Crate multiplication: all values this spin SUM; in FS the standing POOL
  // joins IF a new crate landed (reference "Multiplier Pool" rule).
  const multiSum = crates.reduce((s, c) => s + c.value, 0);
  let spinWin = winBeforeMulti;
  let poolAfter = poolBefore;
  if (multiSum > 0) {
    const applied = Math.min(multiSum + poolBefore, cfg.multiPoolCap);
    if (spinWin > 0n) spinWin = spinWin * BigInt(applied);
    poolAfter = Math.min(poolBefore + multiSum, cfg.multiPoolCap);
  }

  return {
    stops, initialBoard: [], // filled by the caller via boardFromStops (board mutated through the chain)
    steps, crates, scatters, scatterPay, winBeforeMulti, multiSum,
    poolBefore, poolAfter, spinWin,
  };
}

/** Rebuild the initial board from stops (playSpin mutates its board through
 *  the chain, so the initial view is re-derived — same strip rule). */
export function boardFromStops(stops: number[], cfg: FruitStacksMathConfig): number[][] {
  const rows = cfg.visibleRows;
  const board: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let reel = 0; reel < cfg.reelStrips.length; reel++) {
      const strip = cfg.reelStrips[reel];
      row.push(strip[(stops[reel] + r) % strip.length]);
    }
    board.push(row);
  }
  return board;
}

/** THE round derivation — settlement and presentation both call this. */
export function deriveFruitStacksRound(
  randomness: string,
  bet: bigint,
  cfg: FruitStacksMathConfig,
): FruitRound {
  const rand = rngFromHex(randomness);
  const maxWin = bet * BigInt(cfg.maxWinMultiplier);

  const base = playSpin(rand, bet, cfg, 0);
  base.initialBoard = boardFromStops(base.stops, cfg);
  let totalWin = base.spinWin > maxWin ? maxWin : base.spinWin;

  const fsTriggered = base.scatters >= 4;
  const fsSpins: FruitSpin[] = [];
  let capped = totalWin >= maxWin;
  if (fsTriggered && !capped) {
    let remaining = cfg.freeSpinsCount;
    let pool = 0;
    while (remaining > 0 && fsSpins.length < cfg.freeSpinsCap) {
      const spin = playSpin(rand, bet, cfg, pool);
      spin.initialBoard = boardFromStops(spin.stops, cfg);
      pool = spin.poolAfter;
      fsSpins.push(spin);
      totalWin += spin.spinWin;
      remaining--;
      if (spin.scatters >= 3) remaining += cfg.retriggerSpins;
      if (totalWin >= maxWin) { totalWin = maxWin; capped = true; break; }
    }
  }

  return { base, fsTriggered, fsSpins, totalWin, capped };
}
