// FRUIT STACKS — STRATIFIED certification (scatter-tier update 2026-07-24).
// Plain play-through Monte-Carlo swings ±1pp+ at 1M rounds (the 5/6-scatter
// pool tiers put big EV into 1-in-4k / 1-in-57k events) — same lesson as the
// Crack Farm cert. This script decomposes:
//   RTP = E[base spinWin] + Σ_tier P(trigger, tier) × E[FS chain | startPool]
// with each factor measured on its own large sample.
//   node --experimental-strip-types custom-math/strat_fruit.mjs [baseN] [fsN]
import { playSpin } from '../src/game/fruitStacksSpin.ts';
import m from '../src/data/math_fruit_stacks.json' with { type: 'json' };

const CFG = {
  reelStrips: m.reelStrips, visibleRows: 5,
  payTiers: Object.fromEntries(Object.entries(m.payTable).map(([k, v]) => [Number(k), v])),
  scatterPayBps: m.scatterPay, multiWeights: m.custom.multiWeights,
  freeSpinsCount: m.freeSpinsCount, retriggerSpins: m.custom.retriggerSpins,
  freeSpinsCap: m.freeSpinsCap, multiPoolCap: m.custom.multiPoolCap,
  maxWinMultiplier: m.maxWinMultiplier,
};
const BET = 1_000_000n;
const MAXWIN = BET * BigInt(CFG.maxWinMultiplier);

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_N = Number(process.argv[2]) || 2_000_000;
const FS_N = Number(process.argv[3]) || 300_000;

// ── 1) base spins: EV + tier probabilities ─────────────────────────────────
{
  const rand = mulberry(11);
  let sum = 0n; const tierCount = { 4: 0, 5: 0, 6: 0 };
  for (let i = 0; i < BASE_N; i++) {
    const s = playSpin(rand, BET, CFG, 0);
    sum += s.spinWin > MAXWIN ? MAXWIN : s.spinWin;
    if (s.scatters >= 4) {
      const t = Math.min(s.scatters, 6);
      tierCount[t === 4 ? 4 : t]++;
    }
  }
  globalThis.__base = { ev: Number(sum) / Number(BET) / BASE_N, tierCount };
}

// ── 2) FS chain EV per start pool (exact replica of the derive loop) ───────
function fsChainEV(startPool, n, seed) {
  const rand = mulberry(seed);
  let sum = 0n; let caps = 0;
  for (let i = 0; i < n; i++) {
    let remaining = CFG.freeSpinsCount, pool = startPool, total = 0n, spins = 0;
    while (remaining > 0 && spins < CFG.freeSpinsCap) {
      const spin = playSpin(rand, BET, CFG, pool);
      pool = spin.poolAfter;
      total += spin.spinWin;
      spins++; remaining--;
      if (spin.scatters >= 3) remaining += CFG.retriggerSpins;
      if (total >= MAXWIN) { total = MAXWIN; caps++; break; }
    }
    sum += total;
  }
  return { ev: Number(sum) / Number(BET) / n, caps };
}

const fs0 = fsChainEV(0, FS_N, 21);
const fs50 = fsChainEV(50, Math.max(50_000, FS_N >> 1), 22);
const fs100 = fsChainEV(100, Math.max(50_000, FS_N >> 2), 23);

const { ev: baseEV, tierCount } = globalThis.__base;
const p4 = tierCount[4] / BASE_N, p5 = tierCount[5] / BASE_N, p6 = tierCount[6] / BASE_N;
const rtp = baseEV + p4 * fs0.ev + p5 * fs50.ev + p6 * fs100.ev;

console.log(JSON.stringify({
  baseN: BASE_N, fsN: FS_N,
  baseEV: +(baseEV * 100).toFixed(2) + '%',
  trigger: { p4: '1-in-' + Math.round(1 / p4), p5: '1-in-' + Math.round(1 / p5), p6: p6 > 0 ? '1-in-' + Math.round(1 / p6) : '0 seen' },
  fsEV: { pool0: +fs0.ev.toFixed(1), pool50: +fs50.ev.toFixed(1), pool100: +fs100.ev.toFixed(1) },
  fsCaps: { pool0: fs0.caps, pool50: fs50.caps, pool100: fs100.caps },
  RTP: +(rtp * 100).toFixed(2) + '%',
}, null, 1));
