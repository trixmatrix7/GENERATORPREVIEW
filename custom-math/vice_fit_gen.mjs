// VICE HEAT — candidate-manifest generator for the buy/ante re-calibration.
//
// Writes a CANDIDATE copy of src/data/math_vice_heat.json with re-fitted
// custom.viceBuyStages[].fsReelStrips and custom.anteBet.reelStrips, so that the
// UNMODIFIED custom-math/sim_vice.mjs can be pointed at it (drop the candidate at
// <sandbox>/src/data/math_vice_heat.json next to <sandbox>/custom-math/sim_vice.mjs).
//
// The repo manifest is never written.
//
// Levers (all of them are wild/scatter DENSITY, never the paytable):
//   repeat k        strip = base strip concatenated k times (mix EXACTLY in
//                   proportion, wild+scatter density unchanged) — this only buys
//                   finer granularity for the next two levers.
//   wilds +n        n extra wilds inserted by repeatedly splitting the LARGEST
//                   circular gap between existing wilds (max-min spacing), each
//                   one REPLACING the paying symbol already at that stop
//                   (scatters and existing wilds are never overwritten).
//   pad +m          m extra stops inserted at evenly spread positions, drawn in
//                   proportion to the strip's own paying mix, with scatters
//                   added so the SCATTER density is held constant. Wild density
//                   therefore falls as 1/(L+m).
//
// Usage:
//   node custom-math/vice_fit_gen.mjs --out=PATH --spec='{"buy3":{"k":3,"wilds":6},
//        "buy4":{"k":3,"pad":150},"ante":{"base":"documented","k":4,"wilds":[1,1,1,1,1]}}'
//   node custom-math/vice_fit_gen.mjs --out=PATH --spec-file=PATH
//   ... --report        print per-reel composition + exact P(wild in 5-window)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src', 'data', 'math_vice_heat.json');
const WILD = 0, SCAT = 1, ROWS = 5;

// ── helpers ────────────────────────────────────────────────────────────────
const counts = s => { const c = {}; for (const v of s) c[v] = (c[v] || 0) + 1; return c; };

/** exact P(a 5-row window contains >= 1 wild) and >= 1 scatter, by scanning. */
function windowProbs(strip) {
  const L = strip.length;
  let w = 0, sc = 0;
  for (let i = 0; i < L; i++) {
    let hw = false, hs = false;
    for (let r = 0; r < ROWS; r++) {
      const v = strip[(i + r) % L];
      if (v === WILD) hw = true; else if (v === SCAT) hs = true;
    }
    if (hw) w++; if (hs) sc++;
  }
  return { pWild: w / L, pScat: sc / L };
}

function repeatStrip(base, k) {
  const out = [];
  for (let i = 0; i < k; i++) out.push(...base);
  return out;
}

/** circular distance */
const cdist = (a, b, L) => { const d = Math.abs(a - b) % L; return Math.min(d, L - d); };

/**
 * Insert `extra` wilds. Each new wild AIMS at the midpoint of the currently
 * largest circular gap between wilds (max-min spacing — that is what makes
 * P(wild in window) = ROWS * W / L hold), then lands on the stop within half a
 * gap of that aim whose symbol is currently the most OVER-represented relative
 * to the strip's original paying proportions.
 *
 * The second half matters: these strips are k-fold repeats of a 40/120-stop
 * pattern, so plain "nearest legal stop" placement lands EVERY wild on the same
 * phase of the pattern, i.e. on the same symbol id every time (8 of 9 wilds ate
 * HIGH_A on ante reel 1). Proportional replacement keeps the paying mix intact;
 * only wild DENSITY changes.
 */
function addWilds(strip, extra, radiusFrac = 0.45) {
  const L = strip.length;
  const out = strip.slice();
  const c0 = counts(strip);
  const payIds = Object.keys(c0).map(Number).filter(id => id !== WILD && id !== SCAT);
  const tot0 = payIds.reduce((a, id) => a + c0[id], 0);
  const share = {}; for (const id of payIds) share[id] = c0[id] / tot0;
  const wildAt = () => { const a = []; for (let i = 0; i < L; i++) if (out[i] === WILD) a.push(i); return a; };
  for (let n = 0; n < extra; n++) {
    const W = wildAt();
    let aim = 0, bestGap = -1;
    for (let i = 0; i < W.length; i++) {
      const a = W[i], b = W[(i + 1) % W.length];
      const gap = W.length === 1 ? L : ((b - a + L) % L || L);
      if (gap > bestGap) { bestGap = gap; aim = (a + Math.floor(gap / 2)) % L; }
    }
    const R = Math.max(1, Math.floor(L / (W.length + 1) * radiusFrac));
    const cc = counts(out);
    const totNow = payIds.reduce((a, id) => a + (cc[id] || 0), 0);
    let pos = -1, bestScore = -Infinity, bestD = Infinity;
    for (let d = 0; d <= R; d++) {
      for (const cand of (d === 0 ? [aim] : [(aim + d) % L, (aim - d + L) % L])) {
        const v = out[cand];
        if (v === WILD || v === SCAT) continue;
        const score = (cc[v] || 0) - share[v] * totNow;
        if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && d < bestD)) {
          bestScore = score; pos = cand; bestD = d;
        }
      }
    }
    if (pos < 0) {                       // radius exhausted — nearest legal stop
      for (let d = 0; d < L && pos < 0; d++) {
        for (const cand of (d === 0 ? [aim] : [(aim + d) % L, (aim - d + L) % L])) {
          if (out[cand] !== WILD && out[cand] !== SCAT) { pos = cand; break; }
        }
      }
    }
    if (pos < 0) throw new Error('no legal stop for a wild');
    out[pos] = WILD;
  }
  const Wf = wildAt();                   // density lever is only linear while
  for (let i = 0; i < Wf.length; i++) {  // the wilds stay >= ROWS apart
    for (let j = i + 1; j < Wf.length; j++) {
      if (cdist(Wf[i], Wf[j], L) < ROWS) throw new Error(`wilds ${Wf[i]}/${Wf[j]} < ${ROWS} apart on ${L} stops`);
    }
  }
  return out;
}

/**
 * Pad the strip with `extra` stops so wild density falls. The pad is drawn in
 * proportion to the strip's own PAYING mix, plus enough scatters to hold the
 * scatter density constant. Pad stops are inserted at evenly spread positions.
 */
function padStrip(strip, extra, rng) {
  const L = strip.length, newL = L + extra;
  const c = counts(strip);
  const scOld = c[SCAT] || 0;
  const scNew = Math.round(scOld / L * newL);
  const scPad = Math.max(0, scNew - scOld);
  const payPad = extra - scPad;
  const payIds = Object.keys(c).map(Number).filter(id => id !== WILD && id !== SCAT).sort((a, b) => a - b);
  const payTot = payIds.reduce((a, id) => a + c[id], 0);
  // largest-remainder allocation of payPad across the paying mix
  const exact = payIds.map(id => payPad * c[id] / payTot);
  const alloc = exact.map(Math.floor);
  let left = payPad - alloc.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - alloc[i], i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < left; i++) alloc[order[i % order.length][1]]++;
  // build the pad list, spread by Sainte-Lague style round-robin so no run of
  // one symbol ends up inserted into one region of the strip
  const rem = payIds.map((id, i) => ({ id, n: alloc[i], done: 0 }));
  if (scPad > 0) rem.push({ id: SCAT, n: scPad, done: 0 });
  const pad = [];
  const total = rem.reduce((a, r) => a + r.n, 0);
  for (let t = 0; t < total; t++) {
    let pick = -1, bestScore = -Infinity;
    for (let i = 0; i < rem.length; i++) {
      if (rem[i].done >= rem[i].n) continue;
      const score = rem[i].n / (2 * rem[i].done + 1);
      if (score > bestScore + 1e-12) { bestScore = score; pick = i; }
    }
    rem[pick].done++; pad.push(rem[pick].id);
  }
  // interleave: pad stop #pi is scheduled at output index round((pi+.5)*newL/P)
  const out = [];
  let oi = 0, pi = 0;
  for (let j = 0; j < newL; j++) {
    const padDue = pi < pad.length && j >= Math.round((pi + 0.5) * newL / pad.length);
    if (oi >= L || (padDue && pi < pad.length)) out.push(pad[pi++]);
    else out.push(strip[oi++]);
  }
  if (out.length !== newL) throw new Error(`pad produced ${out.length} != ${newL}`);
  return out;
}

/** apply {k, wilds, pad} to a set of 5 strips. wilds/pad may be number or [5]. */
function build(strips, spec) {
  const k = spec.k ?? 1;
  const per = (v, i) => (Array.isArray(v) ? (v[i] ?? 0) : (v ?? 0));
  return strips.map((s, i) => {
    let out = repeatStrip(s, k);
    const pad = per(spec.pad, i);
    if (pad > 0) out = padStrip(out, pad);
    const w = per(spec.wilds, i);
    if (w > 0) out = addWilds(out, w);
    return out;
  });
}

// ── ante base rebuild ──────────────────────────────────────────────────────
// The documented rule: "base strips + 1 extra scatter on the FIRST 3 of 5 strips
// (inserted opposite the existing scatter, replacing the most common LOW,
// tie -> lower id)". Reels 1 and 2 in the shipped manifest follow it exactly
// (r1 idx37 7->1, r2 idx39 6->1). Reel 0 does NOT — its rebuild ate the WILD and
// rotated nine ids. This reproduces the rule for all three reels.
function anteDocumented(baseStrips) {
  const LOWS = [6, 7, 8];
  return baseStrips.map((s, reel) => {
    if (reel > 2) return s.slice();
    const out = s.slice(), L = out.length, c = counts(out);
    let lowId = -1, lowN = -1;
    for (const id of LOWS) if ((c[id] || 0) > lowN) { lowN = c[id] || 0; lowId = id; }
    const scIdx = out.indexOf(SCAT);
    const opposite = (scIdx + Math.floor(L / 2)) % L;
    let pos = -1, best = Infinity;
    for (let i = 0; i < L; i++) {
      if (out[i] !== lowId) continue;
      const d = cdist(i, opposite, L);
      if (d < best) { best = d; pos = i; }
    }
    out[pos] = SCAT;
    return out;
  });
}

// ── CLI ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const val = (k, d) => { const a = argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const flag = k => argv.some(a => a === `--${k}` || a.startsWith(`--${k}=`));

const OUT = val('out', '');
const specFile = val('spec-file', '');
const SPEC = JSON.parse(specFile ? readFileSync(specFile, 'utf8') : (val('spec', '{}')));

const M = JSON.parse(readFileSync(SRC, 'utf8'));
const baseFs = M.fsReelStrips;
const baseReels = M.reelStrips;

if (SPEC.buy3) {
  const st = M.custom.viceBuyStages.find(s => s.stage === 1);
  st.fsReelStrips = build(baseFs, SPEC.buy3);
  st.fsStripsRule = `REFIT ${JSON.stringify(SPEC.buy3)} (vice_fit_gen.mjs)`;
  if (SPEC.buy3.costMult) st.costMult = SPEC.buy3.costMult;
}
if (SPEC.buy4) {
  const st = M.custom.viceBuyStages.find(s => s.stage === 2);
  st.fsReelStrips = build(baseFs, SPEC.buy4);
  st.fsStripsRule = `REFIT ${JSON.stringify(SPEC.buy4)} (vice_fit_gen.mjs)`;
  if (SPEC.buy4.costMult) st.costMult = SPEC.buy4.costMult;
}
if (SPEC.ante) {
  const src = SPEC.ante.base === 'documented' ? anteDocumented(baseReels)
    : SPEC.ante.base === 'current' ? M.custom.anteBet.reelStrips
      : anteDocumented(baseReels);
  M.custom.anteBet.reelStrips = build(src, SPEC.ante);
  if (SPEC.ante.costMult) M.custom.anteBet.costMult = SPEC.ante.costMult;
}
if (SPEC.dropSimul) delete M.custom.simulExpandMultipliers;

if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(M));
}

if (flag('report')) {
  const show = (label, strips) => {
    console.log(label);
    strips.forEach((s, i) => {
      const p = windowProbs(s);
      console.log(`   r${i} len ${String(s.length).padStart(4)}  ${JSON.stringify(counts(s))}  P(wild in win) ${(p.pWild * 100).toFixed(3)}%  P(scat) ${(p.pScat * 100).toFixed(3)}%`);
    });
  };
  if (SPEC.buy3) show('BUY3 fsReelStrips', M.custom.viceBuyStages.find(s => s.stage === 1).fsReelStrips);
  if (SPEC.buy4) show('BUY4 fsReelStrips', M.custom.viceBuyStages.find(s => s.stage === 2).fsReelStrips);
  if (SPEC.ante) show('ANTE reelStrips', M.custom.anteBet.reelStrips);
}
