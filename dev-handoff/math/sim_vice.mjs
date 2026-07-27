// VICE HEAT — RUNTIME-FAITHFUL Monte-Carlo certification simulator.
//
// This models what the ACTUAL GAME CODE does, not what simulate_vice_heat_v2.py
// did. Ground truth, in order of authority:
//   src/dev/mockHost.ts        settleSession() — the whole vice settlement path
//   src/engine/WinEvaluator.ts evaluateWins() — ways eval, scatter pay, bps math
//   src/game/winEval.ts        façade (vice → 'ways')
//   src/config/mathProfiles.ts fromManifest() — manifest → GameConfig mapping
//   src/data/math_vice_heat.json  strips / paytable / custom rules
//
// KNOWN DIVERGENCES between the shipped runtime and the old certification
// (each one is a toggle here so it is measurable, never hidden):
//   1. evalEngine  — the runtime seeds its ways candidate set ONLY from column 0
//                    and maps a WILD there to HIGH_A (WinEvaluator.ts:113-123).
//                    A full wild tower on reel 0 therefore pays ONE combination.
//      evalCorrected— seeds from every paying symbol, wilds substitute.
//   2. --simul / --no-simul — custom.simulExpandMultipliers {"3":2,"4":10} is in
//                    the manifest and mockHost applies it; the certification
//                    retired it (SIMUL_MULTS = {}).
//   3. --hot       — custom.hotSpinChance1In / hotSpinExpandsWilds are in the
//                    manifest and the python sim counts them (~4.15% RTP), but
//                    they are implemented NOWHERE in the runtime. OFF by default.
//
// DEFAULTS MODEL THE CURRENT RUNTIME: engine evaluator, simul mults ON, hot OFF.
//
// Usage:
//   node custom-math/sim_vice.mjs [rounds] [flags]
//     --mode=natural|buy3|buy4|ante|all   (default all)
//     --eval=engine|corrected             (default engine = current runtime)
//     --no-simul                          drop custom.simulExpandMultipliers
//     --hot                               simulate the unimplemented hot spins
//     --seed=N                            PRNG seed (default 20260727)
//     --buy-rounds=N                      rounds for buy3/buy4 (default rounds/4)
//     --json[=path]                       machine-readable output
//     --matrix                            run the full deliverable matrix
//                                         (4 evaluator×simul configs, no hot,
//                                          + corrected/no-simul/WITH hot)
//     --selftest-only                     just run the correctness self-tests

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, '..', 'src', 'data', 'math_vice_heat.json');
const M = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

// ── engine constants (src/config/paytable.ts, src/config/symbols.ts) ─────────
const BPS_DIVISOR = 10_000;
const MIN_MATCHING_REELS = 3;
const S_WILD = 0, S_SCATTER = 1, S_HIGH_A = 2;

// ── manifest → GameConfig (mirrors mathProfiles.fromManifest) ────────────────
const KEY_TO_ID = { wild: 0, scatter: 1, highA: 2, highB: 3, midC: 4, midD: 5, lowE: 6, lowF: 7, lowG: 8, coin: 9 };
const PAY = [];                                  // PAY[symbolId] = [bps3, bps4, bps5]
for (const [k, v] of Object.entries(M.payTable)) {
  const id = KEY_TO_ID[k] ?? Number(k);
  if (Number.isFinite(id)) PAY[id] = v;
}
const SCATTER_PAY = M.scatterPay;
const ROWS = M.gridId === '5x5' ? 5 : 3;         // fromManifest: gridId → GRID_5x5
const REELS = M.reelStrips.length;               // 5
const CFG = {
  reelStrips: M.reelStrips,
  fsReelStrips: M.fsReelStrips,
  freeSpinsCount: M.freeSpinsCount ?? 12,
  freeSpinsCap: M.freeSpinsCap ?? 50,
  freeSpinsMultiplier: M.freeSpinMultiplier ?? 5,   // note: manifest key is singular
  maxWinMultiplier: M.maxWinMultiplier ?? 5000,
  expandingWildsInFS: !!M.custom.expandingWildsInFreeSpins,
  stickyTowerCap: M.custom.stickyTowerCap ?? 2,
  retriggerSpins: M.custom.retriggerSpins,
  stickyRoundSpins: M.custom.stickyRoundSpins,
  stickyRoundCap: M.custom.stickyRoundCap,
  simulExpandMultipliers: M.custom.simulExpandMultipliers ?? {},
  stickyFullBoardMultiplier: M.custom.stickyFullBoardMultiplier ?? 1,
  fullBoardInstantMaxWin: !!M.custom.fullBoardInstantMaxWin,
  viceBuyStages: M.custom.viceBuyStages,
  anteBet: M.custom.anteBet,
  hotChance1In: M.custom.hotSpinChance1In ?? 0,
};

// ── paying symbols (ways candidates for the CORRECTED evaluator) ────────────
const PAY_SYMS = [];
for (let s = 2; s <= 9; s++) if (PAY[s]) PAY_SYMS.push(s);   // excludes wild(0)+scatter(1)
let ALL_MASK = 0;
for (const s of PAY_SYMS) ALL_MASK |= 1 << s;

// ── per-reel / per-stop window precompute ───────────────────────────────────
// cnt[s] = (# of s in window) + (# wilds)   — wilds substitute for any symbol
// mask   = the ENGINE's column-0 candidate set (wild → HIGH_A, scatter skipped)
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
      // engine column-0 seeding (WinEvaluator.ts:113-126)
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
// A fully-expanded (all-wild) reel: every symbol matches on all rows, no
// scatters survive, and the engine sees only HIGH_A in column 0.
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
const STAGE_VIEWS = new Map();   // stage → { fsViews, fsLens }
for (const st of (CFG.viceBuyStages ?? [])) {
  const strips = st.fsReelStrips ?? CFG.fsReelStrips;
  STAGE_VIEWS.set(st.stage, { fsViews: strips.map(buildViews), fsLens: strips.map(s => s.length) });
}

// ── evaluator (mirrors WinEvaluator.evaluateWins) ────────────────────────────
// Integer arithmetic: mockHost computes (ways*payBps*wager)/BPS_DIVISOR in
// BigInt (floor). Bets are multiples of BPS_DIVISOR here, so wager/1e4 is exact
// and the whole product stays far below 2^53 — identical results, no BigInt.
let _lineWin = 0, _scatWin = 0, _scat = 0;
function evalSpin(views, wager, corrected) {
  const unit = wager / BPS_DIVISOR;
  let scat = 0;
  for (let i = 0; i < REELS; i++) scat += views[i].scat;
  _scat = scat;
  _scatWin = 0;
  if (scat >= MIN_MATCHING_REELS) {
    const bps = SCATTER_PAY[Math.min(scat - MIN_MATCHING_REELS, 2)];
    _scatWin = Math.floor(unit * bps);
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
    line += Math.floor(ways * bps * unit);
  }
  _lineWin = line;
}

// ── seeded PRNG (sfc32, 128-bit state) + 256-bit randomness ────────────────
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
function makeRng(seed) {
  const sm = splitmix32(seed);
  return sfc32(sm(), sm(), sm(), sm());
}

// mockHost: randomness = crypto.getRandomValues(32 bytes). Here: 8 PRNG words,
// so every run is reproducible from --seed.
function randomness256(rng) {
  let hex = '';
  for (let i = 0; i < 8; i++) hex += rng().toString(16).padStart(8, '0');
  return hex;
}

// mockHost.deriveStops — sequential mod/div against THIS config's reelLengths.
function deriveStops(seed, bigLens) {
  let s = seed;
  const stops = new Array(bigLens.length);
  for (let i = 0; i < bigLens.length; i++) {
    stops[i] = Number(s % bigLens[i]);
    s = s / bigLens[i];
  }
  return stops;
}
const BIG = arr => arr.map(n => BigInt(n));
const BLENS_BASE = BIG(LENS_BASE), BLENS_FS = BIG(LENS_FS);
const BLENS_ANTE = LENS_ANTE ? BIG(LENS_ANTE) : null;
const BLENS_STAGE = new Map();
for (const [k, v] of STAGE_VIEWS) BLENS_STAGE.set(k, BIG(v.fsLens));

// mockHost derives each free spin's seed as keccak256(abi.encode(bytes32
// randomness, uint256 spinIndex)). keccak is unavailable without viem; sha256
// over the SAME 64-byte abi encoding is used instead. This is a pure PRF swap —
// both are uniform and independent of the base stops, so the distribution is
// identical. Documented, not hidden.
const _fsBuf = Buffer.alloc(64);
function fsSeed(rndHex, idx) {
  _fsBuf.write(rndHex, 0, 32, 'hex');
  _fsBuf.fill(0, 32, 64);
  _fsBuf.writeUInt32BE(idx >>> 0, 60);
  return BigInt('0x' + createHash('sha256').update(_fsBuf).digest('hex'));
}

// mockHost.forceScatterStops — staged vice buy: slide each reel forward to the
// nearest window with EXACTLY one scatter (chosen reels) or none (the rest).
function forceScatterStops(stops, rndBig, want, views, lens) {
  let seed = rndBig >> 128n;
  const order = Array.from({ length: REELS }, (_, i) => i);
  for (let i = REELS - 1; i > 0; i--) {
    const j = Number(seed % BigInt(i + 1));
    seed >>= 8n;
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  const scatterReels = new Set(order.slice(0, want));
  const out = stops.slice();
  for (let reel = 0; reel < REELS; reel++) {
    const target = scatterReels.has(reel) ? 1 : 0;
    const len = lens[reel];
    for (let off = 0; off < len; off++) {
      const pos = (stops[reel] + off) % len;
      if (views[reel][pos].scat === target) { out[reel] = pos; break; }
    }
  }
  return out;
}

// ── one settled round (mirrors mockHost.settleSession, vice branch) ─────────
const MODES = {
  natural: { stage: 0, costMult: 1 },
  buy3: { stage: 1, costMult: 100 },
  buy4: { stage: 2, costMult: 200 },
  ante: { stage: 3, costMult: null },   // costMult from anteBet
};

const _views = new Array(REELS);

function playRound(rng, mode, bet, opts) {
  const stageDef = mode === 'buy3' ? CFG.viceBuyStages.find(s => s.stage === 1)
    : mode === 'buy4' ? CFG.viceBuyStages.find(s => s.stage === 2) : null;
  const isAnte = mode === 'ante';
  const corrected = opts.corrected;

  // wager (exactly what useGameState sends) → bet (exactly what mockHost derives)
  let wager;
  if (stageDef) wager = bet * stageDef.costMult;
  else if (isAnte) wager = (bet * Math.round(CFG.anteBet.costMult * 100)) / 100;
  else wager = bet;
  // mockHost: bet = wager/costMult (buys) or wager*100/round(costMult*100) (ante)
  const settleBet = stageDef ? Math.floor(wager / stageDef.costMult)
    : isAnte ? Math.floor((wager * 100) / Math.round(CFG.anteBet.costMult * 100))
      : wager;
  const maxWin = settleBet * CFG.maxWinMultiplier;

  const rndHex = randomness256(rng);
  const rndBig = BigInt('0x' + rndHex);

  // 1. base spin — ante swaps in its own strips (and reelLengths) for THIS spin
  const baseViews = isAnte ? VIEWS_ANTE : VIEWS_BASE;
  const baseBLens = isAnte ? BLENS_ANTE : BLENS_BASE;
  const baseLens = isAnte ? LENS_ANTE : LENS_BASE;
  let stops = deriveStops(rndBig, baseBLens);
  if (stageDef) stops = forceScatterStops(stops, rndBig, stageDef.scatters, baseViews, baseLens);
  for (let i = 0; i < REELS; i++) _views[i] = baseViews[i][stops[i]];

  // HOT SPIN (NOT in the runtime — manifest-only rule, opt-in via --hot).
  // A hot base spin runs per-spin expansion, exactly like a 3sc free spin.
  let hot = false, hotTowers = 0;
  if (opts.hot && CFG.hotChance1In > 0 && !stageDef) {
    hot = (rng() % CFG.hotChance1In) === 0;
    if (hot) {
      for (let i = 0; i < REELS; i++) {
        if (_views[i].wilds > 0) { _views[i] = FULL; hotTowers++; }
      }
    }
  }

  const baseInstantMax = hot && hotTowers >= REELS && CFG.fullBoardInstantMaxWin;
  evalSpin(_views, settleBet, corrected);
  const scatterCount = _scat;
  let baseRaw = baseInstantMax ? maxWin : (_lineWin + _scatWin);
  if (hot && opts.simul) baseRaw *= (CFG.simulExpandMultipliers[String(hotTowers)] ?? 1);

  let totalWin = baseRaw;
  if (totalWin > maxWin) totalWin = maxWin;
  const baseCredit = totalWin;
  const freeSpinsTriggered = scatterCount >= 3;

  // (mockHost 1b) base-game plant feature: baseFeatureOdds is undefined for
  // vice → baseFeaturePlants() returns null. Never fires. Not modelled.
  // (mockHost 3) Hold & Win: no COIN(9) on any vice strip. Never fires.

  // 2. free-spins loop
  let fsPlayed = 0, fsCredit = 0, sticky = false;
  if (freeSpinsTriggered) {
    const sv = stageDef ? STAGE_VIEWS.get(stageDef.stage) : null;
    const fsViews = sv ? sv.fsViews : VIEWS_FS;
    const fsBLens = sv ? BLENS_STAGE.get(stageDef.stage) : BLENS_FS;
    const expandFS = CFG.expandingWildsInFS;
    sticky = expandFS && scatterCount >= 4;
    const stickyCap = stageDef?.stickyTowerCap ?? CFG.stickyTowerCap ?? 2;
    const stickyReels = [];
    let remaining = stageDef?.freeSpinsCount ?? CFG.freeSpinsCount;
    if (sticky) remaining = stageDef?.freeSpinsCount ?? CFG.stickyRoundSpins ?? CFG.freeSpinsCount;
    const fsCap = stageDef?.fsCap ?? (sticky ? (CFG.stickyRoundCap ?? CFG.freeSpinsCap) : CFG.freeSpinsCap);
    const simulTable = stageDef?.simulExpandMultipliers ?? CFG.simulExpandMultipliers ?? {};
    const retrig = stageDef?.retriggerSpins ?? CFG.retriggerSpins ?? CFG.freeSpinsCount;
    const fullBoardMult = stageDef?.stickyFullBoardMultiplier ?? CFG.stickyFullBoardMultiplier ?? 1;

    while (remaining > 0 && fsPlayed < fsCap) {
      const fsStops = deriveStops(fsSeed(rndHex, fsPlayed), fsBLens);
      for (let i = 0; i < REELS; i++) _views[i] = fsViews[i][fsStops[i]];

      let simulTowers = 0;
      if (expandFS) {
        if (sticky) {
          for (let reel = 0; reel < REELS; reel++) {
            if (stickyReels.length >= stickyCap) break;
            if (!stickyReels.includes(reel) && _views[reel].wilds > 0) stickyReels.push(reel);
          }
          for (const reel of stickyReels) _views[reel] = FULL;
        } else {
          for (let reel = 0; reel < REELS; reel++) {
            if (_views[reel].wilds > 0) { _views[reel] = FULL; simulTowers++; }
          }
        }
      }
      let fullReels = 0;
      for (let i = 0; i < REELS; i++) if (_views[i].wilds >= ROWS) fullReels++;
      const instantMax = expandFS && fullReels >= REELS && CFG.fullBoardInstantMaxWin;

      evalSpin(_views, settleBet, corrected);
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
      if (totalWin >= maxWin) break;   // HARD SESSION CAP — round stops
    }
  }

  return { wager, settleBet, maxWin, totalWin, baseCredit, fsCredit, scatterCount, hot, sticky, fsPlayed, freeSpinsTriggered };
}

// ── stats helpers ───────────────────────────────────────────────────────────
function pct(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function simulate(mode, rounds, bet, opts) {
  const rng = makeRng(opts.seed);
  let staked = 0, paid = 0, hits = 0, maxed = 0, capViolations = 0;
  let sumStakeX = 0, sumStakeX2 = 0, sumBetX = 0, sumBetX2 = 0;
  let basePct = 0, hotPct = 0, fs3Pct = 0, fs4Pct = 0, baseOnly = 0;
  let n3 = 0, n4 = 0;
  const r3 = [], r4 = [];
  let maxRoundX = 0;

  for (let i = 0; i < rounds; i++) {
    const r = playRound(rng, mode, bet, opts);
    staked += r.wager;
    paid += r.totalWin;
    if (r.totalWin > r.maxWin) capViolations++;
    if (r.totalWin > 0) hits++;
    if (r.totalWin >= r.maxWin) maxed++;
    const sx = r.totalWin / r.wager;
    const bx = r.totalWin / r.settleBet;
    sumStakeX += sx; sumStakeX2 += sx * sx;
    sumBetX += bx; sumBetX2 += bx * bx;
    if (bx > maxRoundX) maxRoundX = bx;
    // attribution (credited amounts — they always sum to totalWin)
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
    checks: { maxWinCapViolations: capViolations },
  };
}

// ── self-tests ──────────────────────────────────────────────────────────────
// 1. evalEngine === evalCorrected on every board without a wild in column 0.
// 2. Where column 0 HAS a wild, record how often / how far they diverge.
function selfTestEvaluators(n, seed) {
  const rng = makeRng(seed);
  const sets = [{ name: 'base', v: VIEWS_BASE, l: LENS_BASE }, { name: 'fs', v: VIEWS_FS, l: LENS_FS }];
  const out = [];
  for (const set of sets) {
    let noWild0 = 0, mismatches = 0, wild0 = 0, wild0Diff = 0;
    let engineSum = 0, corrSum = 0;
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < REELS; r++) _views[r] = set.v[r][rng() % set.l[r]];
      evalSpin(_views, 1_000_000, false); const e = _lineWin;
      evalSpin(_views, 1_000_000, true); const c = _lineWin;
      engineSum += e; corrSum += c;
      if (_views[0].wilds === 0) { noWild0++; if (e !== c) mismatches++; }
      else { wild0++; if (e !== c) wild0Diff++; }
    }
    out.push({ strips: set.name, boards: n, boardsWithoutWildInCol0: noWild0, mismatchesWithoutWildInCol0: mismatches, boardsWithWildInCol0: wild0, divergingWithWildInCol0: wild0Diff, engineLineSum: engineSum, correctedLineSum: corrSum, engineVsCorrectedPct: corrSum ? engineSum / corrSum * 100 : 100 });
  }
  return out;
}
// 3. A full wild tower on reel 0 must pay exactly ONE combination in the engine.
function selfTestFullTower() {
  for (let i = 0; i < REELS; i++) _views[i] = FULL;
  evalSpin(_views, 1_000_000, false); const e = _lineWin;
  evalSpin(_views, 1_000_000, true); const c = _lineWin;
  const oneWay = Math.floor(Math.pow(ROWS, REELS) * PAY[S_HIGH_A][2] * 100);
  let all = 0;
  for (const s of PAY_SYMS) all += Math.floor(Math.pow(ROWS, REELS) * PAY[s][2] * 100);
  return { allWildBoardEngine: e, allWildBoardCorrected: c, expectedEngineHighAOnly: oneWay, expectedCorrectedAllSymbols: all, engineOk: e === oneWay, correctedOk: c === all };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = k => argv.some(a => a === `--${k}` || a.startsWith(`--${k}=`));
const val = (k, d) => { const a = argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ROUNDS = Number(argv.find(a => /^\d+$/.test(a))) || 500_000;
const BUY_ROUNDS = Number(val('buy-rounds', Math.max(50_000, Math.round(ROUNDS / 4))));
const SEED = Number(val('seed', 20260727));
const BET = 1_000_000;   // 1.00 USDC @ 6 decimals — a multiple of BPS_DIVISOR

const fmt = (x, d = 2) => (x === null || x === undefined ? '  —  ' : Number(x).toFixed(d));
function printRun(r) {
  const a = r.attributionPctOfWager;
  console.log(`\n── ${r.mode.toUpperCase()}  (${r.rounds.toLocaleString()} rounds, cost ${fmt(r.costMultiplier)}× bet, eval=${r.evaluator}, simul=${r.simulMults ? 'ON' : 'OFF'}, hot=${r.hotSpins ? 'ON' : 'OFF'})`);
  console.log(`   RTP            ${fmt(r.rtpPct)}%  ±${fmt(r.rtpCi99Pp)} pp (99% CI)`);
  console.log(`   hit frequency  ${fmt(r.hitFreqPct)}%`);
  console.log(`   volatility     std ${fmt(r.perRoundStdXOfStake)}× of stake  |  ${fmt(r.perRoundStdXOfBet)}× of bet`);
  console.log(`   max win        ${fmt(r.maxWinRatePct, 4)}%  ${r.maxWin1In ? `(1 in ${fmt(r.maxWin1In, 0)})` : '(none)'}   biggest round ${fmt(r.maxRoundXOfBet, 1)}× bet`);
  console.log(`   FS trigger     3sc 1-in-${fmt(r.fs3Trigger1In, 1)} (${r.fs3Rounds})   4+sc 1-in-${fmt(r.fs4Trigger1In, 1)} (${r.fs4Rounds})`);
  console.log(`   FS 3sc round×  avg ${fmt(r.fs3RoundX.avg)}  p50 ${fmt(r.fs3RoundX.p50)}  p90 ${fmt(r.fs3RoundX.p90)}  p99 ${fmt(r.fs3RoundX.p99)}  max ${fmt(r.fs3RoundX.max, 1)}`);
  console.log(`   FS 4sc round×  avg ${fmt(r.fs4RoundX.avg)}  p50 ${fmt(r.fs4RoundX.p50)}  p90 ${fmt(r.fs4RoundX.p90)}  p99 ${fmt(r.fs4RoundX.p99)}  max ${fmt(r.fs4RoundX.max, 1)}`);
  console.log(`   ATTRIBUTION    base ${fmt(a.base)}%  hot ${fmt(a.hot)}%  fs3 ${fmt(a.fs3)}%  fs4 ${fmt(a.fs4)}%   (of wager)`);
  console.log(`   base spin RTP  ${fmt(r.baseGameOnlyRtpPct)}% (= base ${fmt(a.base)}% + hot ${fmt(a.hot)}%)   maxWin-cap violations ${r.checks.maxWinCapViolations}`);
}

const CONFIGS_MATRIX = [
  { label: 'A  current runtime      (engine eval,    simul ON,  no hot)', corrected: false, simul: true, hot: false },
  { label: 'B  engine eval,         simul OFF,  no hot', corrected: false, simul: false, hot: false },
  { label: 'C  corrected eval,      simul ON,   no hot', corrected: true, simul: true, hot: false },
  { label: 'D  corrected eval,      simul OFF,  no hot', corrected: true, simul: false, hot: false },
  { label: 'E  INTENDED RULE SET    (corrected eval, simul OFF, WITH hot)', corrected: true, simul: false, hot: true },
];
const ALL_MODES = ['natural', 'buy3', 'buy4', 'ante'];

const out = { manifest: 'src/data/math_vice_heat.json', bet: BET, seed: SEED, rounds: ROUNDS, buyRounds: BUY_ROUNDS, selfTests: {}, runs: [] };

console.log('VICE HEAT — runtime-faithful simulator');
console.log(`manifest ${MANIFEST_PATH}`);
console.log(`grid ${REELS}×${ROWS}  base strips ${LENS_BASE.join('/')}  FS strips ${LENS_FS.join('/')}  ante ${LENS_ANTE ? LENS_ANTE.join('/') : '—'}`);
console.log(`freeSpinsCount ${CFG.freeSpinsCount} cap ${CFG.freeSpinsCap} | sticky ${CFG.stickyRoundSpins} cap ${CFG.stickyRoundCap} towerCap ${CFG.stickyTowerCap} | retrigger +${CFG.retriggerSpins} | fsMult ×${CFG.freeSpinsMultiplier} | maxWin ${CFG.maxWinMultiplier}×`);
console.log(`simulExpandMultipliers ${JSON.stringify(CFG.simulExpandMultipliers)} | fullBoardInstantMaxWin ${CFG.fullBoardInstantMaxWin} | hotSpinChance1In ${CFG.hotChance1In} (NOT in runtime)`);

// self-tests always run
const st1 = selfTestEvaluators(200_000, SEED ^ 0x5eed);
const st2 = selfTestFullTower();
out.selfTests.evaluatorEquivalence = st1;
out.selfTests.fullWildTower = st2;
console.log('\n── SELF-TEST: evalEngine vs evalCorrected ─────────────────────────────');
for (const t of st1) {
  console.log(`   ${t.strips.padEnd(5)} ${t.boards.toLocaleString()} boards | no-wild-in-col0 ${t.boardsWithoutWildInCol0.toLocaleString()} → mismatches ${t.mismatchesWithoutWildInCol0} ${t.mismatchesWithoutWildInCol0 === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`         wild-in-col0 ${t.boardsWithWildInCol0.toLocaleString()} → diverging ${t.divergingWithWildInCol0.toLocaleString()} | engine line pay = ${fmt(t.engineVsCorrectedPct)}% of corrected`);
}
console.log(`   all-wild board: engine ${st2.allWildBoardEngine} (${st2.engineOk ? 'PASS' : 'FAIL'} = HIGH_A only) vs corrected ${st2.allWildBoardCorrected} (${st2.correctedOk ? 'PASS' : 'FAIL'} = all 7 symbols)`);

if (!flag('selftest-only')) {
  const configs = flag('matrix') ? CONFIGS_MATRIX : [{
    label: `eval=${val('eval', 'engine')} simul=${flag('no-simul') ? 'OFF' : 'ON'} hot=${flag('hot') ? 'ON' : 'OFF'}`,
    corrected: val('eval', 'engine') === 'corrected',
    simul: !flag('no-simul'),
    hot: flag('hot'),
  }];
  const modeArg = val('mode', 'all');
  const modes = modeArg === 'all' ? ALL_MODES : modeArg.split(',');

  for (const cfg of configs) {
    console.log(`\n══════════════════════════════════════════════════════════════════════`);
    console.log(`CONFIG ${cfg.label}`);
    for (const mode of modes) {
      if (!MODES[mode]) { console.log(`  unknown mode ${mode}`); continue; }
      const n = (mode === 'buy3' || mode === 'buy4') ? BUY_ROUNDS : ROUNDS;
      const t0 = Date.now();
      const r = simulate(mode, n, BET, { corrected: cfg.corrected, simul: cfg.simul, hot: cfg.hot, seed: SEED });
      r.config = cfg.label;
      r.elapsedMs = Date.now() - t0;
      printRun(r);
      out.runs.push(r);
    }
  }
}

if (flag('json')) {
  const p = val('json', '');
  const js = JSON.stringify(out, null, 1);
  if (p) { writeFileSync(p, js); console.log(`\nwrote ${p}`); }
  else console.log('\n' + js);
}
