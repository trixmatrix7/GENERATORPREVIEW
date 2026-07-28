// VICE HEAT — GUARANTEED TOWER on the bought 4-scatter round.
//
// Byte-for-byte copy of custom-math/sim_vice_towermult.mjs (which is itself a
// copy of the runtime-faithful custom-math/sim_vice.mjs) plus ONE new thing:
// a GUARANTEE mechanism for the buy4 stage, and per-ROUND tower bookkeeping.
// Neither original file was modified.
//
//   --guar=none|first|round|firstReel0   the guarantee under test
//     none        today: 1 bought round in 6.7 shows no tower at all
//     first       FREE SPIN 1: if NO reel would expand, nudge exactly one reel's
//                 stop forward to the nearest stop whose 5-row window carries a
//                 wild. The reel is picked from the SPIN SEED's unused high bits
//                 ((seed >> 128) % 5) — deterministic, exactly the trick
//                 forceScatterStops already uses for the bought trigger board.
//     firstReel0  same, but the nudge always lands on reel 0 (cheapest reel:
//                 the engine evaluator folds a column-0 wild into HIGH_A)
//     round       LAST spin of the round only, and only when no tower has been
//                 collected yet and this spin would not produce one either.
//   --guar-stats                          print the per-round tower histogram
//
//   TOWER MULTIPLIERS default to the SHIPPED manifest rule here:
//     --agg=highest --w=custom.towerMultiplierWeights --sticky=keep
//
// ── inherited header ───────────────────────────────────────────────────────
//   NEW FEATURE — every EXPANDED WILD REEL carries its own multiplier badge
//   drawn from {1,2,3,4,5}. The multiplier is a property OF THE REEL, so a
//   winning ways combination that runs across reels 0..k-1 aggregates the badges
//   of the expanded reels it actually crosses.
//
//     --agg=none|highest|sum|product     how crossed badges combine
//     --w=w1,w2,w3,w4,w5                 relative weights for 1x..5x
//     --sticky=keep|reroll               4sc towers keep their badge for the
//                                        round, or re-roll it every spin
//     --hotmult=on|off                   do hot base-spin expansions carry a
//                                        badge too (default off: the feature is
//                                        specified for the 3sc / 4sc rounds)
//
// EVALUATOR: engine only by default — WinEvaluator.ts:120 seeds the ways
// candidate set from COLUMN 0 and folds a wild there into HIGH_A, and
// SlotGame.sol:341 (the paying contract) does the identical thing. --eval=corrected
// exists for the self-test only; never certify with it.
//
// STRIP OVERRIDES (in memory — this script NEVER writes src/data/math_vice_heat.json):
//     --fsw=N     top-level fsReelStrips wilds per reel   (natural + ante FS)
//     --b3w=N     buy3 stage fsReelStrips wilds per reel
//     --b4w=N     buy4 stage fsReelStrips wilds per reel
//     --antew=N   ante base reelStrips wilds per reel
//   Rebuild keeps strip LENGTH and SCATTER count identical and takes/returns the
//   difference from/to the paying symbol that is furthest from its original share,
//   then deterministically shuffles. Mix is printed so drift is visible.
//
// Usage:
//   node custom-math/sim_vice_towermult.mjs [rounds] [flags]
//     --mode=natural|buy3|buy4|ante|all   (default all)
//     --seed=N  --buy-rounds=N  --hot  --no-simul  --json[=path]
//     --grid                              aggregation x weights comparison grid
//     --dump-strips=path                  write the overridden strips as JSON
//     --quiet                             one line per run

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, '..', 'src', 'data', 'math_vice_heat.json');
const M = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

// ── CLI (parsed early: strip overrides must happen before the views are built) ─
const argv = process.argv.slice(2);
const flag = k => argv.some(a => a === `--${k}` || a.startsWith(`--${k}=`));
const val = (k, d) => { const a = argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const numOrNull = (k) => { const v = val(k, null); return v === null ? null : Number(v); };
// wild-count override: a single number (all reels) or a per-reel comma list "42,42,41,41,42"
const wildsOrNull = (k) => { const v = val(k, null); return v === null ? null : v.split(',').map(Number); };

// ── engine constants ────────────────────────────────────────────────────────
const BPS_DIVISOR = 10_000;
const MIN_MATCHING_REELS = 3;
const S_WILD = 0, S_SCATTER = 1, S_HIGH_A = 2;

const KEY_TO_ID = { wild: 0, scatter: 1, highA: 2, highB: 3, midC: 4, midD: 5, lowE: 6, lowF: 7, lowG: 8, coin: 9 };
const PAY = [];
for (const [k, v] of Object.entries(M.payTable)) {
  const id = KEY_TO_ID[k] ?? Number(k);
  if (Number.isFinite(id)) PAY[id] = v;
}
const SCATTER_PAY = M.scatterPay;
const ROWS = M.gridId === '5x5' ? 5 : 3;
const REELS = M.reelStrips.length;

// ── strip rebuild helper (length + scatter count preserved) ─────────────────
function shuffleDet(a, seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function setWildCount(strip, targetW, seed, targetS) {
  const L = strip.length;
  const cnt = {};
  for (const v of strip) cnt[v] = (cnt[v] ?? 0) + 1;
  const curW = cnt[S_WILD] ?? 0;
  const curS = cnt[S_SCATTER] ?? 0;
  if (targetS === undefined || targetS === null) targetS = curS;
  if (curW === targetW && curS === targetS) return strip.slice();
  const payKeys = Object.keys(cnt).map(Number).filter(id => id !== S_WILD && id !== S_SCATTER);
  const payTotal = payKeys.reduce((a, k) => a + cnt[k], 0);
  const ideal = {};
  for (const k of payKeys) ideal[k] = cnt[k] / payTotal;

  const pool = [];
  for (const k of payKeys) for (let i = 0; i < cnt[k]; i++) pool.push(k);
  let need = (targetW - curW) + (targetS - curS); // >0: take stops away from paying symbols
  const work = {}; for (const k of payKeys) work[k] = cnt[k];
  let total = payTotal;
  if (need > 0) {
    for (let i = 0; i < need; i++) {
      let worst = null, ex = -Infinity;
      for (const k of payKeys) { if (work[k] <= 1) continue; const e = work[k] / total - ideal[k]; if (e > ex) { ex = e; worst = k; } }
      work[worst]--; total--;
    }
  } else {
    for (let i = 0; i < -need; i++) {
      let best = null, df = Infinity;
      for (const k of payKeys) { const d = work[k] / total - ideal[k]; if (d < df) { df = d; best = k; } }
      work[best]++; total++;
    }
  }
  const out = [];
  for (let i = 0; i < targetW; i++) out.push(S_WILD);
  for (let i = 0; i < targetS; i++) out.push(S_SCATTER);
  for (const k of payKeys) for (let i = 0; i < work[k]; i++) out.push(k);
  if (out.length !== L) throw new Error(`strip rebuild length drift ${out.length} != ${L}`);
  return shuffleDet(out, seed);
}
function mixOf(st) {
  const c = {}; for (const s of st) c[s] = (c[s] ?? 0) + 1;
  const t = st.length;
  return Object.fromEntries(Object.entries(c).sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, (100 * v / t).toFixed(2)]));
}

const STRIP_EDITS = [];
// rep: repeat the strip R times BEFORE setting the wild count, so the density
// grid gets R times finer (a 405-stop strip only moves in 0.247% steps).
const SHUF = Number(val('shuf', 0));   // offsets every rebuild shuffle seed
function applyWildOverride(strips, n, tag, seedBase, rep, sc) {
  seedBase += SHUF * 1000003;
  if (n === null && !sc) return strips;
  if (n === null) n = strips.map(s => s.filter(x => x === S_WILD).length);
  const R = rep && rep > 1 ? rep : 1;
  if (R > 1) strips = strips.map(s => { const o = []; for (let i = 0; i < R; i++) o.push(...s); return o; });
  const before = strips.map(s => s.filter(x => x === S_WILD).length).join('/');
  const out = strips.map((s, r) => setWildCount(s, n.length === 1 ? n[0] : n[r], seedBase + r * 7919, sc ? (sc.length === 1 ? sc[0] : sc[r]) : null));
  STRIP_EDITS.push({ tag, rep: R, scattersAfter: out.map(s => s.filter(x => x === S_SCATTER).length).join('/'), wildsBefore: before, wildsAfter: out.map(s => s.filter(x => x === S_WILD).length).join('/'), len: out.map(s => s.length).join('/'), mixReel0: mixOf(out[0]) });
  return out;
}

const OV_FS = wildsOrNull('fsw'), OV_B3 = wildsOrNull('b3w'), OV_B4 = wildsOrNull('b4w'), OV_ANTE = wildsOrNull('antew');
const REP_FS = Number(val('fsrep', 1)), REP_B3 = Number(val('b3rep', 1)), REP_B4 = Number(val('b4rep', 1)), REP_ANTE = Number(val('anterep', 1));
const SC_FS = wildsOrNull('fssc'), SC_B3 = wildsOrNull('b3sc'), SC_B4 = wildsOrNull('b4sc');

const CFG = {
  reelStrips: M.reelStrips,
  fsReelStrips: applyWildOverride(M.fsReelStrips, OV_FS, 'fsReelStrips', 11000, REP_FS, SC_FS),
  freeSpinsCount: M.freeSpinsCount ?? 12,
  freeSpinsCap: M.freeSpinsCap ?? 50,
  freeSpinsMultiplier: M.freeSpinMultiplier ?? 5,
  maxWinMultiplier: M.maxWinMultiplier ?? 5000,
  expandingWildsInFS: !!M.custom.expandingWildsInFreeSpins,
  stickyTowerCap: M.custom.stickyTowerCap ?? 2,
  retriggerSpins: M.custom.retriggerSpins,
  stickyRoundSpins: M.custom.stickyRoundSpins,
  stickyRoundCap: M.custom.stickyRoundCap,
  simulExpandMultipliers: flag('simul-table') ? JSON.parse(val('simul-table', '{}')) : (M.custom.simulExpandMultipliers ?? {}),
  stickyFullBoardMultiplier: M.custom.stickyFullBoardMultiplier ?? 1,
  fullBoardInstantMaxWin: !!M.custom.fullBoardInstantMaxWin,
  viceBuyStages: (M.custom.viceBuyStages ?? []).map(st => {
    const n = st.stage === 1 ? OV_B3 : st.stage === 2 ? OV_B4 : null;
    const sc = st.stage === 1 ? SC_B3 : st.stage === 2 ? SC_B4 : null;
    if (st.fsReelStrips && (n !== null || sc)) return { ...st, fsReelStrips: applyWildOverride(st.fsReelStrips, n, `buy${st.scatters}.fsReelStrips`, 22000 + st.stage * 101, st.stage === 1 ? REP_B3 : REP_B4, sc) };
    return st;
  }),
  anteBet: M.custom.anteBet ? { ...M.custom.anteBet, reelStrips: applyWildOverride(M.custom.anteBet.reelStrips, OV_ANTE, 'ante.reelStrips', 33000, REP_ANTE) } : null,
  hotChance1In: M.custom.hotSpinChance1In ?? 0,
};

const PAY_SYMS = [];
for (let s = 2; s <= 9; s++) if (PAY[s]) PAY_SYMS.push(s);
let ALL_MASK = 0;
for (const s of PAY_SYMS) ALL_MASK |= 1 << s;

function buildViews(strip) {
  const L = strip.length;
  const out = new Array(L);
  for (let stop = 0; stop < L; stop++) {
    const raw = new Int32Array(10);
    let wilds = 0, scat = 0, mask = 0;
    for (let r = 0; r < ROWS; r++) {
      const v = strip[(stop + r) % L];
      if (v === S_WILD) wilds++;
      else if (v === S_SCATTER) scat++;
      else raw[v]++;
      if (v !== S_SCATTER) {
        const eff = v === S_WILD ? S_HIGH_A : v;
        if (PAY[eff]) mask |= 1 << eff;
      }
    }
    const cnt = new Int32Array(10);
    for (const s of PAY_SYMS) cnt[s] = raw[s] + wilds;
    out[stop] = { cnt, wilds, scat, mask };
  }
  return out;
}
const FULL = (() => {
  const cnt = new Int32Array(10);
  for (const s of PAY_SYMS) cnt[s] = ROWS;
  return { cnt, wilds: ROWS, scat: 0, mask: 1 << S_HIGH_A };
})();

const VIEWS_BASE = CFG.reelStrips.map(buildViews);
const VIEWS_FS = CFG.fsReelStrips.map(buildViews);
const VIEWS_ANTE = CFG.anteBet ? CFG.anteBet.reelStrips.map(buildViews) : null;
const LENS_BASE = CFG.reelStrips.map(s => s.length);
const LENS_FS = CFG.fsReelStrips.map(s => s.length);
const LENS_ANTE = CFG.anteBet ? CFG.anteBet.reelStrips.map(s => s.length) : null;
const STAGE_VIEWS = new Map();
for (const st of (CFG.viceBuyStages ?? [])) {
  const strips = st.fsReelStrips ?? CFG.fsReelStrips;
  STAGE_VIEWS.set(st.stage, { fsViews: strips.map(buildViews), fsLens: strips.map(s => s.length) });
}

// ── evaluator + TOWER MULTIPLIER aggregation ────────────────────────────────
// expM[reel] = badge multiplier on that reel, or 0 when the reel is not an
// expanded wild reel. A combination that runs across reels 0..k-1 aggregates
// only the badges inside that run.
const AGG = { none: 0, highest: 1, sum: 2, product: 3 };
let _lineWin = 0, _scatWin = 0, _scat = 0, _multWeightedNum = 0, _multWeightedDen = 0;
function evalSpin(views, wager, corrected, expM, aggMode) {
  const unit = wager / BPS_DIVISOR;
  let scat = 0;
  for (let i = 0; i < REELS; i++) scat += views[i].scat;
  _scat = scat;
  _scatWin = 0;
  if (scat >= MIN_MATCHING_REELS) {
    const bps = SCATTER_PAY[Math.min(scat - MIN_MATCHING_REELS, 2)];
    _scatWin = Math.floor(unit * bps);          // scatter pay is NEVER multiplied
  }
  const mask = corrected ? ALL_MASK : views[0].mask;
  let line = 0;
  for (let si = 0; si < PAY_SYMS.length; si++) {
    const s = PAY_SYMS[si];
    if (((mask >>> s) & 1) === 0) continue;
    let ways = 1, k = 0;
    for (let i = 0; i < REELS; i++) {
      const n = views[i].cnt[s];
      if (n === 0) break;
      ways *= n; k++;
    }
    if (k < MIN_MATCHING_REELS) continue;
    const bps = PAY[s][Math.min(k - MIN_MATCHING_REELS, 2)];
    if (!bps) continue;
    const raw = Math.floor(ways * bps * unit);
    let m = 1;
    if (aggMode && expM) {
      if (aggMode === 1) { let hi = 0; for (let i = 0; i < k; i++) if (expM[i] > hi) hi = expM[i]; if (hi > 0) m = hi; }
      else if (aggMode === 2) { let sum = 0; for (let i = 0; i < k; i++) sum += expM[i]; if (sum > 0) m = sum; }
      else { let p = 1, any = false; for (let i = 0; i < k; i++) if (expM[i] > 0) { p *= expM[i]; any = true; } if (any) m = p; }
    }
    if (raw > 0) { _multWeightedNum += raw * m; _multWeightedDen += raw; }
    line += raw * m;
  }
  _lineWin = line;
}

// ── PRNG ────────────────────────────────────────────────────────────────────
function splitmix32(a) {
  return function () {
    a |= 0; a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ (t >>> 15)) >>> 0);
  };
}
function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
}
function makeRng(seed) { const sm = splitmix32(seed); return sfc32(sm(), sm(), sm(), sm()); }
function randomness256(rng) { let hex = ''; for (let i = 0; i < 8; i++) hex += rng().toString(16).padStart(8, '0'); return hex; }
function deriveStops(seed, bigLens) {
  let s = seed;
  const stops = new Array(bigLens.length);
  for (let i = 0; i < bigLens.length; i++) { stops[i] = Number(s % bigLens[i]); s = s / bigLens[i]; }
  return stops;
}
const BIG = arr => arr.map(n => BigInt(n));
const BLENS_BASE = BIG(LENS_BASE), BLENS_FS = BIG(LENS_FS);
const BLENS_ANTE = LENS_ANTE ? BIG(LENS_ANTE) : null;
const BLENS_STAGE = new Map();
for (const [k, v] of STAGE_VIEWS) BLENS_STAGE.set(k, BIG(v.fsLens));
const _fsBuf = Buffer.alloc(64);
function fsSeed(rndHex, idx) {
  _fsBuf.write(rndHex, 0, 32, 'hex'); _fsBuf.fill(0, 32, 64); _fsBuf.writeUInt32BE(idx >>> 0, 60);
  return BigInt('0x' + createHash('sha256').update(_fsBuf).digest('hex'));
}
function forceScatterStops(stops, rndBig, want, views, lens) {
  let seed = rndBig >> 128n;
  const order = Array.from({ length: REELS }, (_, i) => i);
  for (let i = REELS - 1; i > 0; i--) { const j = Number(seed % BigInt(i + 1)); seed >>= 8n; const t = order[i]; order[i] = order[j]; order[j] = t; }
  const scatterReels = new Set(order.slice(0, want));
  const out = stops.slice();
  for (let reel = 0; reel < REELS; reel++) {
    const target = scatterReels.has(reel) ? 1 : 0;
    const len = lens[reel];
    for (let off = 0; off < len; off++) { const pos = (stops[reel] + off) % len; if (views[reel][pos].scat === target) { out[reel] = pos; break; } }
  }
  return out;
}

// ── GUARANTEED-TOWER nudge ──────────────────────────────────────────────────
// Slide ONE reel's stop FORWARD to the nearest stop whose 5-row window carries
// at least one wild — the same forward scan forceScatterStops uses to place the
// bought trigger board. The reel is picked from the spin seed's HIGH bits:
// deriveStops consumes only the low ~56 bits of a 256-bit seed against 2406-stop
// strips, so (seed >> 128) % REELS is free, unused entropy and the choice stays
// deterministic from the round's randomness.
// NUDGE_W = relative weights for which reel the nudge lands on. Uniform by
// default; --nudgew=1,0,0,0,0 pins it to reel 0. Cost order of a tower under the
// engine evaluator (measured): reel0 ≪ reel4 < reel3 ≈ reel2 < reel1.
let NUDGE_CUM = null, NUDGE_TOT = 0;
function setNudgeWeights(w) {
  NUDGE_TOT = w.reduce((a, b) => a + b, 0);
  NUDGE_CUM = []; let acc = 0;
  for (const x of w) { acc += x; NUDGE_CUM.push(acc); }
}
function pickNudgeReel(seedBig) {
  const x = Number((seedBig >> 128n) % BigInt(NUDGE_TOT));
  for (let i = 0; i < NUDGE_CUM.length; i++) if (x < NUDGE_CUM[i]) return i;
  return 0;
}
function nudgeToWild(reel, stop, views, lens) {
  const len = lens[reel];
  for (let off = 0; off < len; off++) {
    const pos = (stop + off) % len;
    if (views[reel][pos].wilds > 0) return pos;
  }
  return stop;
}

// ── badge draw ──────────────────────────────────────────────────────────────
function makeBadgeDraw(weights) {
  const tot = weights.reduce((a, b) => a + b, 0);
  const cum = []; let acc = 0;
  for (const w of weights) { acc += w / tot; cum.push(acc); }
  return rng => { const u = rng() / 4294967296; for (let i = 0; i < cum.length; i++) if (u < cum[i]) return i + 1; return cum.length; };
}

const nudgeReelHist = new Array(REELS).fill(0);
const MODES = { natural: {}, buy3: {}, buy4: {}, ante: {} };
const _views = new Array(REELS);
const _expM = new Int32Array(REELS);

// badge draws run on a SEPARATE PRNG stream so the board sequence is byte-identical
// across every aggregation / weight set (common random numbers) and agg=none
// reproduces custom-math/sim_vice.mjs exactly.
function playRound(rng, brng, mode, bet, opts, tally) {
  const stageDef = mode === 'buy3' ? CFG.viceBuyStages.find(s => s.stage === 1)
    : mode === 'buy4' ? CFG.viceBuyStages.find(s => s.stage === 2) : null;
  const isAnte = mode === 'ante';
  const corrected = opts.corrected;
  const agg = opts.agg;
  const draw = opts.draw;
  const guar = opts.guar && opts.guar !== 'none' ? opts.guar : null;
  let nudges = 0;

  let wager;
  if (stageDef) wager = bet * stageDef.costMult;
  else if (isAnte) wager = (bet * Math.round(CFG.anteBet.costMult * 100)) / 100;
  else wager = bet;
  const settleBet = stageDef ? Math.floor(wager / stageDef.costMult)
    : isAnte ? Math.floor((wager * 100) / Math.round(CFG.anteBet.costMult * 100)) : wager;
  const maxWin = settleBet * CFG.maxWinMultiplier;

  const rndHex = randomness256(rng);
  const rndBig = BigInt('0x' + rndHex);

  const baseViews = isAnte ? VIEWS_ANTE : VIEWS_BASE;
  const baseBLens = isAnte ? BLENS_ANTE : BLENS_BASE;
  const baseLens = isAnte ? LENS_ANTE : LENS_BASE;
  let stops = deriveStops(rndBig, baseBLens);
  if (stageDef) stops = forceScatterStops(stops, rndBig, stageDef.scatters, baseViews, baseLens);
  for (let i = 0; i < REELS; i++) { _views[i] = baseViews[i][stops[i]]; _expM[i] = 0; }

  let hot = false, hotTowers = 0;
  if (opts.hot && CFG.hotChance1In > 0 && !stageDef) {
    hot = (rng() % CFG.hotChance1In) === 0;
    if (hot) {
      for (let i = 0; i < REELS; i++) {
        if (_views[i].wilds > 0) { _views[i] = FULL; hotTowers++; if (opts.hotMult) _expM[i] = draw(brng); }
      }
    }
  }

  const baseInstantMax = hot && hotTowers >= REELS && CFG.fullBoardInstantMaxWin;
  evalSpin(_views, settleBet, corrected, _expM, hot && opts.hotMult ? agg : 0);
  const scatterCount = _scat;
  let baseRaw = baseInstantMax ? maxWin : (_lineWin + _scatWin);
  if (hot && opts.simul) baseRaw *= (CFG.simulExpandMultipliers[String(hotTowers)] ?? 1);

  let totalWin = baseRaw;
  if (totalWin > maxWin) totalWin = maxWin;
  const baseCredit = totalWin;
  const freeSpinsTriggered = scatterCount >= 3;

  let fsPlayed = 0, fsCredit = 0, sticky = false, round5x = 0, roundTower = 0;
  let endTowers = 0, firstTowerSpin = -1, roundHiBadge = 0;
  if (freeSpinsTriggered) {
    const sv = stageDef ? STAGE_VIEWS.get(stageDef.stage) : null;
    const fsViews = sv ? sv.fsViews : VIEWS_FS;
    const fsBLens = sv ? BLENS_STAGE.get(stageDef.stage) : BLENS_FS;
    const expandFS = CFG.expandingWildsInFS;
    sticky = expandFS && scatterCount >= 4;
    const stickyCap = stageDef?.stickyTowerCap ?? CFG.stickyTowerCap ?? 2;
    const stickyReels = [];
    const stickyMult = new Int32Array(REELS);
    let remaining = stageDef?.freeSpinsCount ?? CFG.freeSpinsCount;
    if (sticky) remaining = stageDef?.freeSpinsCount ?? CFG.stickyRoundSpins ?? CFG.freeSpinsCount;
    const fsCap = stageDef?.fsCap ?? (sticky ? (CFG.stickyRoundCap ?? CFG.freeSpinsCap) : CFG.freeSpinsCap);
    const simulTable = stageDef?.simulExpandMultipliers ?? CFG.simulExpandMultipliers ?? {};
    const retrig = stageDef?.retriggerSpins ?? CFG.retriggerSpins ?? CFG.freeSpinsCount;
    const fullBoardMult = stageDef?.stickyFullBoardMultiplier ?? CFG.stickyFullBoardMultiplier ?? 1;

    while (remaining > 0 && fsPlayed < fsCap) {
      const spinSeedBig = fsSeed(rndHex, fsPlayed);
      const fsStops = deriveStops(spinSeedBig, fsBLens);

      // ── GUARANTEED TOWER (bought 4-scatter stage only) ─────────────────────
      if (guar && stageDef?.stage === 2 && sticky) {
        let anyWild = false;
        for (let i = 0; i < REELS; i++) if (fsViews[i][fsStops[i]].wilds > 0) { anyWild = true; break; }
        const lastSpin = remaining === 1 || fsPlayed === fsCap - 1;
        const fire =
          guar === 'first' || guar === 'firstReel0' ? (fsPlayed === 0 && !anyWild)
          : guar === 'round' ? (lastSpin && stickyReels.length === 0 && !anyWild)
          : false;
        if (fire) {
          const reel = guar === 'firstReel0' ? 0 : pickNudgeReel(spinSeedBig);
          nudgeReelHist[reel]++;
          fsStops[reel] = nudgeToWild(reel, fsStops[reel], fsViews, sv ? sv.fsLens : LENS_FS);
          nudges++;
        }
      }

      for (let i = 0; i < REELS; i++) { _views[i] = fsViews[i][fsStops[i]]; _expM[i] = 0; }

      let simulTowers = 0;
      if (expandFS) {
        if (sticky) {
          for (let reel = 0; reel < REELS; reel++) {
            if (stickyReels.length >= stickyCap) break;
            if (!stickyReels.includes(reel) && _views[reel].wilds > 0) { stickyReels.push(reel); stickyMult[reel] = draw(brng); }
          }
          for (const reel of stickyReels) {
            _views[reel] = FULL;
            _expM[reel] = opts.stickyReroll ? draw(brng) : stickyMult[reel];
          }
        } else {
          for (let reel = 0; reel < REELS; reel++) {
            if (_views[reel].wilds > 0) { _views[reel] = FULL; _expM[reel] = draw(brng); simulTowers++; }
          }
        }
      }
      let fullReels = 0;
      for (let i = 0; i < REELS; i++) if (_views[i].wilds >= ROWS) fullReels++;
      const instantMax = expandFS && fullReels >= REELS && CFG.fullBoardInstantMaxWin;

      if (sticky) {
        if (stickyReels.length > endTowers) endTowers = stickyReels.length;
        if (firstTowerSpin < 0 && stickyReels.length > 0) firstTowerSpin = fsPlayed;
        for (const r of stickyReels) if (stickyMult[r] > roundHiBadge) roundHiBadge = stickyMult[r];
      }

      if (tally) {
        tally.fsSpins++;
        let towers = 0, has5 = 0, hi = 0;
        for (let i = 0; i < REELS; i++) if (_expM[i] > 0) { towers++; if (_expM[i] === 5) has5 = 1; if (_expM[i] > hi) hi = _expM[i]; }
        tally.towerHist[towers]++;
        if (has5) { tally.fsSpinsWith5++; round5x = 1; }
        if (towers > 0) { tally.fsSpinsWithTower++; tally.hiHist[hi]++; roundTower = 1; }
        if (sticky) { tally.fsStickySpins++; if (has5) tally.fsStickySpinsWith5++; }
        else { tally.fs3Spins++; if (has5) tally.fs3SpinsWith5++; }
      }

      evalSpin(_views, settleBet, corrected, _expM, agg);
      const rawFsWin = instantMax ? maxWin : (_lineWin + _scatWin);
      const fsScatter = _scat;
      const simulMult = opts.simul ? (simulTable[String(simulTowers)] ?? 1) : 1;
      const fullMult = (sticky && stickyReels.length >= stickyCap) ? fullBoardMult : 1;
      const fsWin = rawFsWin * simulMult * fullMult * CFG.freeSpinsMultiplier;

      const prev = totalWin;
      totalWin += fsWin;
      if (totalWin > maxWin) totalWin = maxWin;
      fsCredit += totalWin - prev;

      if (fsScatter >= 3) remaining += retrig;
      remaining--; fsPlayed++;
      if (totalWin >= maxWin) break;
    }
  }

  if (tally) {
    if (round5x) tally.roundsWith5x++; if (roundTower) tally.roundsWithTower++; if (freeSpinsTriggered) tally.fsRounds++;
    if (sticky) {
      tally.stickyRounds++;
      tally.endTowerHist[endTowers]++;
      tally.nudgedRounds += nudges > 0 ? 1 : 0;
      tally.nudges += nudges;
      if (firstTowerSpin >= 0) { tally.firstTowerSpinHist[firstTowerSpin]++; tally.firstTowerSum += firstTowerSpin; tally.firstTowerN++; }
      if (roundHiBadge > 0) tally.roundHiBadgeHist[roundHiBadge]++;
      tally.stickyFsSpinsInRound += fsPlayed;
    }
  }
  return { wager, settleBet, maxWin, totalWin, baseCredit, fsCredit, scatterCount, hot, sticky, fsPlayed, freeSpinsTriggered, endTowers, nudges };
}

function pct(sorted, q) { if (!sorted.length) return 0; return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; }

function simulate(mode, rounds, bet, opts) {
  const rng = makeRng(opts.seed);
  const brng = makeRng((opts.seed ^ 0xbadc0de5) >>> 0);
  _multWeightedNum = 0; _multWeightedDen = 0;
  nudgeReelHist.fill(0);
  setNudgeWeights(opts.nudgeW ?? new Array(REELS).fill(1));
  const tally = { fsSpins: 0, fsSpinsWith5: 0, fsSpinsWithTower: 0, fs3Spins: 0, fs3SpinsWith5: 0, fsStickySpins: 0, fsStickySpinsWith5: 0, towerHist: new Array(REELS + 1).fill(0), hiHist: new Array(6).fill(0), roundsWith5x: 0, roundsWithTower: 0, fsRounds: 0,
    stickyRounds: 0, endTowerHist: new Array(REELS + 1).fill(0), nudgedRounds: 0, nudges: 0, firstTowerSpinHist: new Array(16).fill(0), firstTowerSum: 0, firstTowerN: 0, roundHiBadgeHist: new Array(6).fill(0), stickyFsSpinsInRound: 0 };
  let staked = 0, paid = 0, hits = 0, maxed = 0, capViolations = 0;
  let sumStakeX = 0, sumStakeX2 = 0, sumBetX = 0, sumBetX2 = 0;
  let basePct = 0, hotPct = 0, fs3Pct = 0, fs4Pct = 0, baseOnly = 0;
  let n3 = 0, n4 = 0;
  const r3 = [], r4 = [];
  let maxRoundX = 0;

  for (let i = 0; i < rounds; i++) {
    const r = playRound(rng, brng, mode, bet, opts, tally);
    staked += r.wager; paid += r.totalWin;
    if (r.totalWin > r.maxWin) capViolations++;
    if (r.totalWin > 0) hits++;
    if (r.totalWin >= r.maxWin) maxed++;
    const sx = r.totalWin / r.wager, bx = r.totalWin / r.settleBet;
    sumStakeX += sx; sumStakeX2 += sx * sx; sumBetX += bx; sumBetX2 += bx * bx;
    if (bx > maxRoundX) maxRoundX = bx;
    if (r.hot) hotPct += r.baseCredit; else basePct += r.baseCredit;
    baseOnly += r.baseCredit;
    if (r.freeSpinsTriggered) {
      if (r.sticky) { n4++; fs4Pct += r.fsCredit; r4.push(r.fsCredit / r.settleBet); }
      else { n3++; fs3Pct += r.fsCredit; r3.push(r.fsCredit / r.settleBet); }
    }
  }
  r3.sort((a, b) => a - b); r4.sort((a, b) => a - b);
  const meanStake = sumStakeX / rounds;
  const varStake = Math.max(0, sumStakeX2 / rounds - meanStake * meanStake);
  const meanBet = sumBetX / rounds;
  const varBet = Math.max(0, sumBetX2 / rounds - meanBet * meanBet);
  const P = x => x / staked * 100;
  return {
    mode, rounds, seed: opts.seed,
    evaluator: opts.corrected ? 'corrected' : 'engine',
    agg: opts.aggName, weights: opts.weights, sticky: opts.stickyReroll ? 'reroll' : 'keep', hotMult: !!opts.hotMult,
    simulMults: !!opts.simul, hotSpins: !!opts.hot,
    costMultiplier: staked / rounds / bet,
    rtpPct: paid / staked * 100,
    rtpCi99Pp: 2.576 * Math.sqrt(varStake) / Math.sqrt(rounds) * 100,
    hitFreqPct: hits / rounds * 100,
    perRoundStdXOfStake: Math.sqrt(varStake),
    perRoundStdXOfBet: Math.sqrt(varBet),
    maxRoundXOfBet: maxRoundX,
    maxWinRatePct: maxed / rounds * 100,
    maxWin1In: maxed ? rounds / maxed : null,
    fs3Trigger1In: n3 ? rounds / n3 : null,
    fs4Trigger1In: n4 ? rounds / n4 : null,
    fs3Rounds: n3, fs4Rounds: n4,
    fs3RoundX: { avg: n3 ? r3.reduce((a, b) => a + b, 0) / n3 : 0, p50: pct(r3, .5), p90: pct(r3, .9), p99: pct(r3, .99), max: r3.length ? r3[r3.length - 1] : 0 },
    fs4RoundX: { avg: n4 ? r4.reduce((a, b) => a + b, 0) / n4 : 0, p50: pct(r4, .5), p90: pct(r4, .9), p99: pct(r4, .99), max: r4.length ? r4[r4.length - 1] : 0 },
    attributionPctOfWager: { base: P(basePct), hot: P(hotPct), fs3: P(fs3Pct), fs4: P(fs4Pct) },
    baseGameOnlyRtpPct: P(baseOnly),
    featureStats: {
      fsSpins: tally.fsSpins,
      fsSpinsWithAnyTowerPct: tally.fsSpins ? 100 * tally.fsSpinsWithTower / tally.fsSpins : 0,
      fsSpinsWith5xPct: tally.fsSpins ? 100 * tally.fsSpinsWith5 / tally.fsSpins : 0,
      fs3SpinsWith5xPct: tally.fs3Spins ? 100 * tally.fs3SpinsWith5 / tally.fs3Spins : 0,
      fs4SpinsWith5xPct: tally.fsStickySpins ? 100 * tally.fsStickySpinsWith5 / tally.fsStickySpins : 0,
      towersPerFsSpinHistPct: tally.towerHist.map(c => tally.fsSpins ? +(100 * c / tally.fsSpins).toFixed(3) : 0),
      highestBadgeGivenTowerHistPct: tally.hiHist.slice(1).map(c => tally.fsSpinsWithTower ? +(100 * c / tally.fsSpinsWithTower).toFixed(3) : 0),
      roundsWith5xPct: 100 * tally.roundsWith5x / rounds,
      fsRoundsWith5xPct: tally.fsRounds ? 100 * tally.roundsWith5x / tally.fsRounds : 0,
      oneFiveXEveryNRounds: tally.roundsWith5x ? rounds / tally.roundsWith5x : null,
      payWeightedMeanCombinationMultiplier: _multWeightedDen ? _multWeightedNum / _multWeightedDen : 1,
    },
    guarantee: opts.guar ?? 'none',
    nudgeWeights: opts.nudgeW ?? null,
    nudgeReelHist: nudgeReelHist.slice(),
    roundTowerStats: {
      stickyRounds: tally.stickyRounds,
      endTowerCountHistPct: tally.endTowerHist.map(c => tally.stickyRounds ? +(100 * c / tally.stickyRounds).toFixed(4) : 0),
      endTowerCounts: tally.endTowerHist.slice(),
      zeroTowerRoundsPct: tally.stickyRounds ? +(100 * tally.endTowerHist[0] / tally.stickyRounds).toFixed(4) : 0,
      zeroTowerRounds1In: tally.endTowerHist[0] ? +(tally.stickyRounds / tally.endTowerHist[0]).toFixed(1) : null,
      meanEndTowers: tally.stickyRounds ? +(tally.endTowerHist.reduce((a, c, i) => a + c * i, 0) / tally.stickyRounds).toFixed(4) : 0,
      nudgedRoundsPct: tally.stickyRounds ? +(100 * tally.nudgedRounds / tally.stickyRounds).toFixed(3) : 0,
      nudgesPerRound: tally.stickyRounds ? +(tally.nudges / tally.stickyRounds).toFixed(4) : 0,
      meanFirstTowerSpinIdx: tally.firstTowerN ? +(tally.firstTowerSum / tally.firstTowerN).toFixed(3) : null,
      firstTowerSpinHistPct: tally.firstTowerSpinHist.slice(0, 14).map(c => tally.stickyRounds ? +(100 * c / tally.stickyRounds).toFixed(3) : 0),
      highestBadgeInRoundHistPct: tally.roundHiBadgeHist.slice(1).map(c => tally.stickyRounds ? +(100 * c / tally.stickyRounds).toFixed(3) : 0),
      meanFsSpinsPerStickyRound: tally.stickyRounds ? +(tally.stickyFsSpinsInRound / tally.stickyRounds).toFixed(3) : 0,
    },
    checks: { maxWinCapViolations: capViolations },
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const ROUNDS = Number(argv.find(a => /^\d+$/.test(a))) || 500_000;
const BUY_ROUNDS = Number(val('buy-rounds', Math.max(50_000, Math.round(ROUNDS / 4))));
const SEED = Number(val('seed', 20260727));
const BET = 1_000_000;

// DEFAULTS = the SHIPPED manifest rule (highest badge, manifest weights, keep).
const AGG_NAME = val('agg', 'highest');
const WEIGHTS = val('w', (M.custom.towerMultiplierWeights ?? [55, 20, 9, 6, 10]).join(',')).split(',').map(Number);
const STICKY_REROLL = val('sticky', 'keep') === 'reroll';
const GUAR = val('guar', 'none');
const NUDGE_W = val('nudgew', new Array(5).fill(1).join(',')).split(',').map(Number);
const HOT_MULT = val('hotmult', 'off') === 'on';
const CORRECTED = val('eval', 'engine') === 'corrected';

const fmt = (x, d = 2) => (x === null || x === undefined ? '  —  ' : Number(x).toFixed(d));
function printRun(r) {
  const a = r.attributionPctOfWager, f = r.featureStats;
  console.log(`\n── ${r.mode.toUpperCase()}  (${r.rounds.toLocaleString()} rounds, cost ${fmt(r.costMultiplier)}× bet, eval=${r.evaluator}, agg=${r.agg}, w=[${r.weights}], sticky=${r.sticky}, hotMult=${r.hotMult ? 'ON' : 'OFF'}, hot=${r.hotSpins ? 'ON' : 'OFF'})`);
  console.log(`   RTP            ${fmt(r.rtpPct)}%  ±${fmt(r.rtpCi99Pp)} pp (99% CI)`);
  console.log(`   hit frequency  ${fmt(r.hitFreqPct)}%`);
  console.log(`   volatility     std ${fmt(r.perRoundStdXOfStake)}× of stake  |  ${fmt(r.perRoundStdXOfBet)}× of bet`);
  console.log(`   max win        ${fmt(r.maxWinRatePct, 4)}%  ${r.maxWin1In ? `(1 in ${fmt(r.maxWin1In, 0)})` : '(none)'}   biggest round ${fmt(r.maxRoundXOfBet, 1)}× bet`);
  console.log(`   FS trigger     3sc 1-in-${fmt(r.fs3Trigger1In, 1)} (${r.fs3Rounds})   4+sc 1-in-${fmt(r.fs4Trigger1In, 1)} (${r.fs4Rounds})`);
  console.log(`   FS 3sc round×  avg ${fmt(r.fs3RoundX.avg)}  p50 ${fmt(r.fs3RoundX.p50)}  p90 ${fmt(r.fs3RoundX.p90)}  p99 ${fmt(r.fs3RoundX.p99)}  max ${fmt(r.fs3RoundX.max, 1)}`);
  console.log(`   FS 4sc round×  avg ${fmt(r.fs4RoundX.avg)}  p50 ${fmt(r.fs4RoundX.p50)}  p90 ${fmt(r.fs4RoundX.p90)}  p99 ${fmt(r.fs4RoundX.p99)}  max ${fmt(r.fs4RoundX.max, 1)}`);
  console.log(`   ATTRIBUTION    base ${fmt(a.base)}%  hot ${fmt(a.hot)}%  fs3 ${fmt(a.fs3)}%  fs4 ${fmt(a.fs4)}%   (of wager)`);
  console.log(`   FEATURE        FS spins ${f.fsSpins.toLocaleString()} | any tower ${fmt(f.fsSpinsWithAnyTowerPct)}% | a 5× on board ${fmt(f.fsSpinsWith5xPct)}% (3sc ${fmt(f.fs3SpinsWith5xPct)}% / 4sc ${fmt(f.fs4SpinsWith5xPct)}%)`);
  console.log(`                  towers/spin ${f.towersPerFsSpinHistPct.map((p, i) => `${i}:${fmt(p, 1)}%`).join(' ')}`);
  console.log(`                  a 5× lands in ${fmt(f.roundsWith5xPct,3)}% of ALL rounds (1 in ${f.oneFiveXEveryNRounds ? fmt(f.oneFiveXEveryNRounds,0) : '—'}) | ${fmt(f.fsRoundsWith5xPct,1)}% of FS rounds`);
  console.log(`                  pay-weighted mean combo multiplier ${fmt(f.payWeightedMeanCombinationMultiplier, 3)}×   maxWin-cap violations ${r.checks.maxWinCapViolations}`);
  const g = r.roundTowerStats;
  if (g.stickyRounds > 0) {
    console.log(`   GUARANTEE      ${r.guarantee}${r.nudgeWeights ? ` nudgew=[${r.nudgeWeights}]` : ''}   fired in ${fmt(g.nudgedRoundsPct, 2)}% of sticky rounds (${fmt(g.nudgesPerRound, 3)} nudges/round)   nudged reel ${r.nudgeReelHist.join('/')}`);
    console.log(`   TOWERS/ROUND   ${g.endTowerCountHistPct.map((p, i) => `${i}:${fmt(p, 2)}%`).join('  ')}   mean ${fmt(g.meanEndTowers, 3)}`);
    console.log(`                  ZERO-TOWER ROUNDS ${fmt(g.zeroTowerRoundsPct, 3)}%${g.zeroTowerRounds1In ? ` (1 in ${fmt(g.zeroTowerRounds1In, 1)})` : ''}   first tower on spin idx ${g.meanFirstTowerSpinIdx === null ? '—' : fmt(g.meanFirstTowerSpinIdx, 2)} (mean)`);
    console.log(`                  highest badge in round 1×:${fmt(g.highestBadgeInRoundHistPct[0], 1)}% 2×:${fmt(g.highestBadgeInRoundHistPct[1], 1)}% 3×:${fmt(g.highestBadgeInRoundHistPct[2], 1)}% 4×:${fmt(g.highestBadgeInRoundHistPct[3], 1)}% 5×:${fmt(g.highestBadgeInRoundHistPct[4], 1)}%`);
  }
}

const out = { manifest: 'src/data/math_vice_heat.json', bet: BET, seed: SEED, rounds: ROUNDS, buyRounds: BUY_ROUNDS, stripEdits: STRIP_EDITS, runs: [] };

if (!flag('quiet')) {
  console.log('VICE HEAT + TOWER MULTIPLIERS');
  console.log(`grid ${REELS}×${ROWS}  base ${LENS_BASE.join('/')}  FS ${LENS_FS.join('/')} (wilds ${CFG.fsReelStrips.map(s => s.filter(x => x === 0).length).join('/')})  ante ${LENS_ANTE ? LENS_ANTE.join('/') : '—'}`);
  console.log(`fsMult ×${CFG.freeSpinsMultiplier} | fsCount ${CFG.freeSpinsCount} cap ${CFG.freeSpinsCap} | sticky ${CFG.stickyRoundSpins} cap ${CFG.stickyRoundCap} towerCap ${CFG.stickyTowerCap} | retrig +${CFG.retriggerSpins} | maxWin ${CFG.maxWinMultiplier}×`);
  console.log(`simulExpandMultipliers ${JSON.stringify(CFG.simulExpandMultipliers)} (manifest) | fullBoardInstantMaxWin ${CFG.fullBoardInstantMaxWin}`);
  for (const e of STRIP_EDITS) console.log(`STRIP OVERRIDE ${e.tag}: wilds ${e.wildsBefore} → ${e.wildsAfter}  len ${e.len}`);
}

if (flag('dump-strips')) {
  const p = val('dump-strips', '');
  writeFileSync(p, JSON.stringify({ fsReelStrips: CFG.fsReelStrips, buyStages: CFG.viceBuyStages.map(s => ({ stage: s.stage, fsReelStrips: s.fsReelStrips })), anteReelStrips: CFG.anteBet?.reelStrips, edits: STRIP_EDITS }, null, 1));
  console.log(`wrote strips ${p}`);
}

const ALL_MODES = ['natural', 'buy3', 'buy4', 'ante'];
const modeArg = val('mode', 'all');
const modes = modeArg === 'all' ? ALL_MODES : modeArg.split(',');

function runOne(mode, aggName, weights, opts2) {
  const n = (mode === 'buy3' || mode === 'buy4') ? BUY_ROUNDS : ROUNDS;
  const o = {
    corrected: CORRECTED, simul: !flag('no-simul'), hot: flag('hot'), seed: SEED,
    agg: AGG[aggName], aggName, weights, draw: makeBadgeDraw(weights),
    stickyReroll: opts2?.stickyReroll ?? STICKY_REROLL, hotMult: opts2?.hotMult ?? HOT_MULT,
    guar: opts2?.guar ?? GUAR, nudgeW: opts2?.nudgeW ?? NUDGE_W,
  };
  const t0 = Date.now();
  const r = simulate(mode, n, BET, o);
  r.elapsedMs = Date.now() - t0;
  return r;
}

if (flag('grid')) {
  const WSETS = (val('wsets', '60,25,10,4,1|40,30,18,8,4|30,28,22,13,7|20,20,20,20,20') || '').split('|').map(s => s.split(',').map(Number));
  const AGGS = (val('aggs', 'none,highest,sum,product')).split(',');
  const STICKIES = (val('stickies', 'keep,reroll')).split(',');
  console.log(`\n${'agg'.padEnd(9)}${'weights'.padEnd(18)}${'sticky'.padEnd(8)}${'mode'.padEnd(9)}${'RTP%'.padStart(9)}${'±99%'.padStart(8)}${'std/bet'.padStart(10)}${'hit%'.padStart(8)}${'maxwin1in'.padStart(12)}${'meanCombo×'.padStart(12)}`);
  for (const aggName of AGGS) {
    for (const w of (aggName === 'none' ? [WSETS[0]] : WSETS)) {
      for (const st of (aggName === 'none' ? ['keep'] : STICKIES)) {
        for (const mode of modes) {
          const r = runOne(mode, aggName, w, { stickyReroll: st === 'reroll' });
          out.runs.push(r);
          console.log(`${aggName.padEnd(9)}${('[' + w + ']').padEnd(18)}${st.padEnd(8)}${mode.padEnd(9)}${fmt(r.rtpPct).padStart(9)}${fmt(r.rtpCi99Pp).padStart(8)}${fmt(r.perRoundStdXOfBet, 1).padStart(10)}${fmt(r.hitFreqPct, 1).padStart(8)}${(r.maxWin1In ? fmt(r.maxWin1In, 0) : '—').padStart(12)}${fmt(r.featureStats.payWeightedMeanCombinationMultiplier, 3).padStart(12)}`);
        }
      }
    }
  }
} else {
  for (const mode of modes) {
    if (!MODES[mode]) { console.log(`unknown mode ${mode}`); continue; }
    const r = runOne(mode, AGG_NAME, WEIGHTS);
    out.runs.push(r);
    if (flag('quiet')) console.log(`${mode.padEnd(6)} guar=${String(r.guarantee).padEnd(11)} RTP ${fmt(r.rtpPct).padStart(7)}% ±${fmt(r.rtpCi99Pp)}  std ${fmt(r.perRoundStdXOfBet, 1).padStart(6)}  hit ${fmt(r.hitFreqPct, 1)}%  maxwin 1-in-${(r.maxWin1In ? fmt(r.maxWin1In, 0) : '—').padStart(6)}  zeroTower ${fmt(r.roundTowerStats.zeroTowerRoundsPct, 3).padStart(7)}%  towers[${r.roundTowerStats.endTowerCountHistPct.map(p => fmt(p, 1)).join('|')}] mean ${fmt(r.roundTowerStats.meanEndTowers, 3)}`);
    else printRun(r);
  }
}

if (flag('json')) {
  const p = val('json', '');
  const js = JSON.stringify(out, null, 1);
  if (p) { writeFileSync(p, js); console.log(`\nwrote ${p}`); }
  else console.log('\n' + js);
}
