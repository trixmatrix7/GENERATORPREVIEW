// SUSHI PARTY cluster+PowerNudge certification — runs the LIVE TS core.
//   node --experimental-strip-types custom-math/sim_sushi.mjs [rounds] [--buy] [--write]
import { deriveSushiRound } from '../src/game/sushiClusterSpin.ts';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROUNDS = Number(process.argv[2]) || 200_000;
const BUY = process.argv.includes('--buy');
const WRITE = process.argv.includes('--write');

// Pay values (bps, 10000 = 1× bet) — FIXED from Sugar Supreme rules (Report 19).
// index 0..10 = cluster size 5,6,7,8,9,10,11,12,13,14,15+
const PAY = {
  2: [10000,12500,15000,20000,25000,30000,50000,75000,150000,200000,1000000], // high_a
  3: [7500,10000,12500,15000,20000,25000,40000,60000,120000,150000,750000],   // high_b
  4: [5000,6000,7500,10000,15000,20000,30000,40000,80000,100000,500000],      // high_c
  5: [4000,4500,5000,7500,10000,15000,25000,30000,60000,80000,400000],        // high_d
  6: [3000,3500,4000,5000,6000,10000,15000,20000,40000,60000,300000],         // low_e
  7: [2000,2500,3000,5000,6000,7500,12500,15000,30000,50000,200000],          // low_f
  8: [1500,2000,2500,4000,5000,6000,10000,12500,25000,40000,150000],          // low_g
  9: [1000,1500,2000,3000,4000,5000,7500,10000,20000,30000,100000],           // low_h
};

// Strip composition. Scatter is decoupled as an explicit COUNT per strip so its
// frequency is independent of symbol density. TUNE via env:
//   SCN=scatter count/strip (base trigger), FSCN=scatter count/strip (FS retrigger, rare),
//   HB=high weight, LB=low weight, HR=high ramp, LR=low ramp, FSDENSE=FS symbol-density boost,
//   STRIP=strip length.
const E = (k, d) => process.env[k] !== undefined ? Number(process.env[k]) : d;
const SCN = E('SCN', 2), FSCN = E('FSCN', 1);   // FS retrigger RARE (Noski)
const HB = E('HB', 3.0), LB = E('LB', 7.0), HR = E('HR', 1.30), LR = E('LR', 1.15);
const FSDENSE = E('FSDENSE', 1.0);
const STRIP_LEN = E('STRIP', 120);
const wHigh = (i) => HB * Math.pow(HR, i);  // highs 2..5 (i=0..3)
const wLow = (i) => LB * Math.pow(LR, i);   // lows 6..9 (i=0..3)
const SYMS = [[2, wHigh(0)], [3, wHigh(1)], [4, wHigh(2)], [5, wHigh(3)],
              [6, wLow(0)], [7, wLow(1)], [8, wLow(2)], [9, wLow(3)]];
// FS density boost: shift weight toward the symbols that cluster (denser board = more
// connections = multipliers build over the 10-20 spins). Keeps the same 8 symbols.
const FS_SYMS = SYMS.map(([id, w], i) => [id, w * (i >= 4 ? FSDENSE : 1)]);

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeStrip(seed, syms, scatNf) {
  const rand = mulberry(seed);
  // fractional scatter count: floor + 1 with prob = frac (per strip, averages over 6 reels)
  const scatN = Math.floor(scatNf) + (rand() < (scatNf - Math.floor(scatNf)) ? 1 : 0);
  const items = [];
  const symSlots = STRIP_LEN - scatN;
  const total = syms.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of syms) for (let i = 0; i < Math.round(w / total * symSlots); i++) items.push(id);
  while (items.length < symSlots) items.push(syms[Math.floor(rand() * syms.length)][0]);
  items.length = symSlots;
  for (let k = 0; k < scatN; k++) items.push(1); // SCATTER
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}

const CFG = {
  reelStrips: [101,202,303,404,505,606].map(s => makeStrip(s, SYMS, SCN)),
  fsReelStrips: [711,812,913,714,815,916].map(s => makeStrip(s, FS_SYMS, FSCN)),
  rows: 6, reels: 6,
  payTiers: PAY,
  minCluster: 5,
  fsSpinsByScatter: { 3: 10, 4: 12, 5: 15, 6: 20 },
  retriggerSpins: 10,
  maxWinMultiplier: 5000,
  maxCellMulti: E('MCAP', 25),
  fsMultiIncrement: E('FSINC', 1),
  // BUYSC: if set, force exactly that scatter count (measure V(n)); else calibrated weights.
  // Calibrated so E[V] ≈ 96× → buy RTP ≈ 96% (V3=77.6 V4=111 V5=173 V6=260 at this density).
  buyScatterWeights: process.env.BUYSC ? { [Number(process.env.BUYSC)]: 1 } : { 3: 0.64, 4: 0.29, 5: 0.05, 6: 0.02 },
};

const BET = 1_000_000n;
let paid = 0n, basePaid = 0n, fsPaid = 0n;
let hits = 0, fsCount = 0, caps = 0, maxX = 0;
const seedRand = mulberry(20260725);
const randHex = () => '0x' + Array.from({ length: 64 }, () => Math.floor(seedRand() * 16).toString(16)).join('');

for (let i = 0; i < ROUNDS; i++) {
  const round = deriveSushiRound(randHex(), BET, CFG, BUY ? 1 : 0);
  paid += round.totalWin;
  basePaid += round.base.spinWin;
  if (round.fsTriggered) { fsCount++; fsPaid += round.totalWin - round.base.spinWin; }
  if (round.totalWin > 0n) hits++;
  if (round.capped) caps++;
  const x = Number(round.totalWin) / Number(BET);
  if (x > maxX) maxX = x;
}

const cost = BUY ? 100 : 1;
const rtp = Number(paid) / Number(BET * BigInt(ROUNDS)) / cost * 100;
console.log(`rounds=${ROUNDS}${BUY ? ' BUY(100x)' : ''}`);
console.log(`RTP total  ${rtp.toFixed(2)}%`);
console.log(`  base     ${(Number(basePaid) / Number(BET * BigInt(ROUNDS)) * 100).toFixed(2)}%`);
console.log(`  fs part  ${(Number(fsPaid) / Number(BET * BigInt(ROUNDS)) * 100).toFixed(2)}%`);
console.log(`hit rate   ${(hits / ROUNDS * 100).toFixed(2)}%`);
console.log(`FS freq    1 in ${(ROUNDS / Math.max(1, fsCount)).toFixed(0)}`);
console.log(`caps ${caps}  maxX ${maxX.toFixed(0)}`);

if (WRITE) {
  const manifest = {
    gameId: 'sushi-party', gridId: '6x6', payModel: 'cluster', rtpTargetBps: 9609,
    reelStrips: CFG.reelStrips, fsReelStrips: CFG.fsReelStrips,
    payTable: PAY, minCluster: 5,
    fsSpinsByScatter: CFG.fsSpinsByScatter, retriggerSpins: 10, maxWinMultiplier: 5000,
    maxCellMulti: CFG.maxCellMulti, fsMultiIncrement: CFG.fsMultiIncrement,
    buyScatterWeights: CFG.buyScatterWeights,
    comp: { HB, LB, HR, LR, SCN, FSCN, FSDENSE, FSINC: CFG.fsMultiIncrement, STRIP_LEN },
    custom: { cluster: true, powerNudge: true, mechanic: 'nudge-pay-once', simRtpPct: Number(rtp.toFixed(2)), simRounds: ROUNDS },
  };
  const here = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(here, '..', 'src', 'data', 'math_sushi_party.json'), JSON.stringify(manifest));
  console.log('wrote src/data/math_sushi_party.json');
}
