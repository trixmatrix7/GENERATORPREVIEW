// FRUIT STACKS math certification — runs the LIVE TS core (fruitStacksSpin.ts)
// via Node type-stripping, so the certified rule IS the shipped rule.
//   node --experimental-strip-types custom-math/sim_fruit_stacks.mjs [rounds] [--write]
// --write bakes src/data/math_fruit_stacks.json (strips + pays + custom rules).

import { deriveFruitStacksRound, BUY_STAGE_EXTRA_GIFTS } from '../src/game/fruitStacksSpin.ts';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROUNDS = Number(process.argv[2]) || 200_000;
const WRITE = process.argv.includes('--write');
const BUY = process.argv.includes('--buy') ? Number(process.argv[process.argv.indexOf('--buy') + 1]) : 0;
const GIFTS = process.argv.includes('--gifts') ? Number(process.argv[process.argv.indexOf('--gifts') + 1]) : -1;
if (BUY > 0 && GIFTS >= 0) BUY_STAGE_EXTRA_GIFTS[BUY] = GIFTS;

// ── strip generation (deterministic) ───────────────────────────────────────
// Lows carry the hit rate (dense), mids/highs are genuinely premium (sparse
// → an 8+ of them is an event). Crates only live on reels 1/3/5.
// 9-PAY reference construct (Noski's glossy pack): 4 jewel highs (sparse,
// premium) + 5 fruit lows (dense, hit engine). Ids: 2 heart, 3 gold star,
// 4 blue star, 5 diamond, 6 cherry, 7 grapes, 8 orange, 9 lemon, 10 melon.
const COMP_BASE = { 2: 5, 3: 4, 4: 4, 5: 3, 6: 8, 7: 6, 8: 7, 9: 7, 10: 6, 1: 1 }; // Σ=51
const STRIP_LEN = 60;

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStrip(seed, withCrate, extraScatter) {
  const items = [];
  for (const [id, n] of Object.entries(COMP_BASE)) for (let i = 0; i < n; i++) items.push(Number(id));
  if (withCrate) items.push(0);
  if (extraScatter) items.push(1);
  // pad with the fruit lows (they carry the hit rate; jewels stay premium)
  const pads = [6, 8, 9, 7, 10];
  let p = 0;
  while (items.length < STRIP_LEN) items.push(pads[p++ % 5]);
  const rand = mulberry(seed);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const CFG = {
  reelStrips: [101, 202, 303, 404, 505, 606].map((s, i) => makeStrip(s, true, i === 2 || i === 5)),
  visibleRows: 5,
  payTiers: {
    2: [23200, 30900, 185000],
    3: [30900, 77300, 232000],
    4: [38600, 154300, 386300],
    5: [154300, 386300, 772600],
    6: [3900, 11500, 30900],
    7: [12400, 18500, 123700],
    8: [6100, 13900, 61800],
    9: [7800, 15400, 77300],
    10: [15400, 23200, 154300],
  },
  scatterPayBps: [30000, 50000, 1000000],
  multiWeights: [[2, 600], [3, 250], [4, 120], [5, 70], [6, 35], [8, 20], [10, 12], [15, 6], [20, 4], [25, 3], [50, 1.5], [100, 0.6], [250, 0.25], [500, 0.1]],
  freeSpinsCount: 15,
  retriggerSpins: 5,
  freeSpinsCap: 50,
  multiPoolCap: 500,
  maxWinMultiplier: 5000,
};

// ── simulate ───────────────────────────────────────────────────────────────
const BET = 1_000_000n; // 1.00 in 6-dec base units
let paid = 0n, basePaid = 0n, fsPaid = 0n;
let hits = 0, fsCount = 0, caps = 0, maxX = 0;
const seedRand = mulberry(20260721);
const randHex = () => '0x' + Array.from({ length: 64 }, () => Math.floor(seedRand() * 16).toString(16)).join('');

for (let i = 0; i < ROUNDS; i++) {
  const round = deriveFruitStacksRound(randHex(), BET, CFG, BUY);
  paid += round.totalWin;
  basePaid += round.base.spinWin;
  if (round.fsTriggered) { fsCount++; fsPaid += round.totalWin - round.base.spinWin; }
  if (round.totalWin > 0n) hits++;
  if (round.capped) caps++;
  const x = Number(round.totalWin) / Number(BET);
  if (x > maxX) maxX = x;
}

const rtp = Number(paid) / Number(BET * BigInt(ROUNDS)) * 100;
console.log(`rounds=${ROUNDS}` + (BUY ? ` BUY-STAGE ${BUY} (EV per bet = ${(Number(paid) / Number(BET * BigInt(ROUNDS))).toFixed(2)}x -> cost @96% = ${(Number(paid) / Number(BET * BigInt(ROUNDS)) / 0.96).toFixed(1)}x)` : ''));
console.log(`RTP total  ${rtp.toFixed(2)}%`);
console.log(`  base     ${(Number(basePaid) / Number(BET * BigInt(ROUNDS)) * 100).toFixed(2)}%`);
console.log(`  fs part  ${(Number(fsPaid) / Number(BET * BigInt(ROUNDS)) * 100).toFixed(2)}%`);
console.log(`hit rate   ${(hits / ROUNDS * 100).toFixed(2)}%`);
console.log(`FS freq    1 in ${(ROUNDS / Math.max(1, fsCount)).toFixed(0)}`);
console.log(`caps       ${caps}   maxX ${maxX.toFixed(1)}`);

if (WRITE) {
  const manifest = {
    gameId: 'fruit-stacks',
    gridId: '6x5',
    payModel: 'scatterpays',
    rtpTargetBps: 9600,
    reelStrips: CFG.reelStrips,
    // classic 3-tuple shape kept for registry compat (8-9/10-11/12+ tiers)
    payTable: Object.fromEntries(Object.entries(CFG.payTiers)),
    scatterPay: CFG.scatterPayBps,
    freeSpinsCount: CFG.freeSpinsCount,
    freeSpinsCap: CFG.freeSpinsCap,
    freeSpinMultiplier: 1,
    maxWinMultiplier: CFG.maxWinMultiplier,
    custom: {
      scatterPays: true,
      tumble: true,
      retriggerSpins: CFG.retriggerSpins,
      multiPoolCap: CFG.multiPoolCap,
      multiWeights: CFG.multiWeights,
      simRtpPct: Number(rtp.toFixed(2)),
      simRounds: ROUNDS,
    },
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, '..', 'src', 'data', 'math_fruit_stacks.json');
  writeFileSync(out, JSON.stringify(manifest));
  console.log('wrote', out);
}
