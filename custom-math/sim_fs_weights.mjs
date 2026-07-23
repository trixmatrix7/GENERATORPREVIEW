// SCRATCH rebalance harness for Fruit Stacks multiWeights.
// Clone of sim_fruit_stacks.mjs CFG (same strips/pays/params) but:
//   --weights '<json [[v,w],...]>'  override the crate value distribution
//   --buy N                         purchased stage 1/2/3
//   [rounds] positional             default 100000
// Also tallies ACTUAL crate values drawn in the sim -> tier shares.
// Does NOT write anything to the repo.

import { deriveFruitStacksRound } from '../src/game/fruitStacksSpin.ts';

const args = process.argv.slice(2);
const num = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const ROUNDS = Number(args.find(a => /^\d+$/.test(a))) || 100_000;
const BUY = num('--buy', 0);
const wIdx = args.indexOf('--weights');
const WEIGHTS = wIdx >= 0 ? JSON.parse(args[wIdx + 1]) : null;

// ── strips: identical deterministic generation to sim_fruit_stacks.mjs ─────
const COMP_BASE = { 2: 5, 3: 4, 4: 4, 5: 3, 6: 8, 7: 6, 8: 7, 9: 7, 10: 6, 1: 1 };
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
  multiWeights: WEIGHTS ?? [[2, 600], [3, 250], [4, 120], [5, 70], [6, 35], [8, 20], [10, 12], [15, 6], [20, 4], [25, 3], [50, 1.5], [100, 0.6], [250, 0.25], [500, 0.1]],
  freeSpinsCount: 15,
  retriggerSpins: 5,
  freeSpinsCap: 50,
  multiPoolCap: 500,
  maxWinMultiplier: 5000,
};

// ── simulate (same seeding scheme as the cert sim) ─────────────────────────
const BET = 1_000_000n;
let paid = 0n, basePaid = 0n, fsPaid = 0n;
let hits = 0, fsCount = 0, caps = 0, maxX = 0;
const crateCount = new Map();   // value -> count (base + fs, actual draws)
let cratesBase = 0, cratesFs = 0;
const seedRand = mulberry(num('--seed', 20260721));
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
  for (const c of round.base.crates) { crateCount.set(c.value, (crateCount.get(c.value) || 0) + 1); cratesBase++; }
  for (const sp of round.fsSpins) for (const c of sp.crates) { crateCount.set(c.value, (crateCount.get(c.value) || 0) + 1); cratesFs++; }
}

const rtp = Number(paid) / Number(BET * BigInt(ROUNDS)) * 100;
console.log(`rounds=${ROUNDS}` + (BUY ? ` BUY-STAGE ${BUY} EVx=${(Number(paid) / Number(BET * BigInt(ROUNDS))).toFixed(2)}` : ''));
console.log(`RTP total  ${rtp.toFixed(2)}%`);
console.log(`  base     ${(Number(basePaid) / Number(BET * BigInt(ROUNDS)) * 100).toFixed(2)}%`);
console.log(`  fs part  ${(Number(fsPaid) / Number(BET * BigInt(ROUNDS)) * 100).toFixed(2)}%`);
console.log(`hit rate   ${(hits / ROUNDS * 100).toFixed(2)}%`);
console.log(`FS freq    1 in ${(ROUNDS / Math.max(1, fsCount)).toFixed(0)}`);
console.log(`caps       ${caps}   maxX ${maxX.toFixed(1)}`);

// tier shares from ACTUAL draws
const total = cratesBase + cratesFs;
let silver = 0, red = 0, gold = 0, meanV = 0;
for (const [v, n] of crateCount) {
  meanV += v * n;
  if (v <= 5) silver += n; else if (v <= 30) red += n; else gold += n;
}
console.log(`crates     ${total} (base ${cratesBase} / fs ${cratesFs})  meanValue ${(meanV / Math.max(1, total)).toFixed(3)}`);
console.log(`tiers      silver ${(silver / total * 100).toFixed(2)}%  red ${(red / total * 100).toFixed(2)}%  gold ${(gold / total * 100).toFixed(3)}%  (gold 1-in-${(total / Math.max(1, gold)).toFixed(0)})`);
const vals = [...crateCount.entries()].sort((a, b) => a[0] - b[0]);
console.log('dist       ' + vals.map(([v, n]) => `${v}:${(n / total * 100).toFixed(2)}%`).join(' '));
