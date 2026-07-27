// VICE HEAT — certification harness for the LIVE round core (src/game/viceSpin.ts).
//
// This drives the SAME function settlement (mockHost.settleVice) and the decode
// façade (decodeVice) call, so what it measures is literally what the game pays.
// It is the counterpart to custom-math/sim_vice.mjs, which re-implements the
// runtime independently — the two must agree, or the extraction changed the math.
//
//   node custom-math/sim_vice_core.mjs [rounds] [flags]
//     --mode=natural|buy3|buy4|ante|all   (default natural)
//     --seed=N                            PRNG seed (default 20260727, = sim_vice)
//     --no-align                          do not mirror sim_vice's extra hot-roll
//                                         PRNG draw (see STREAM ALIGNMENT below)
//     --json[=path]                       machine-readable output
//
// TARGET RULE SET (what viceSpin.ts implements, and what sim_vice.mjs models
// with `--eval=corrected --no-simul --hot`):
//   • corrected ways evaluator (src/game/viceWays.ts via the winEval façade)
//   • custom.simulExpandMultipliers RETIRED (never applied)
//   • HOT SPINS live (1-in-hotSpinChance1In natural/ante base spins expand)
//
// STREAM ALIGNMENT: sim_vice.mjs draws its randomness as 8 sfc32 words and then
// burns ONE more word for its hot roll (natural/ante only). This harness draws
// the identical 8 words and burns the same word, so both walk the *identical*
// randomness stream and their base spins are the SAME BOARDS — scatter counts
// and FS-trigger counts then match exactly. The hot roll itself and the per-free-
// spin seeds are the two documented divergences: this harness derives the hot
// roll from the seed (keccak, index 2^64) because the runtime must be
// seed-deterministic, and mockHost/viceSpin use keccak256 for FS seeds where
// sim_vice substitutes sha256 (a pure PRF swap).

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MANIFEST_PATH = join(ROOT, 'src', 'data', 'math_vice_heat.json');
const M = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

// ── load the LIVE TS core ───────────────────────────────────────────────────
// esbuild bundles src/game/viceSpin.ts (and its winEval → viceWays chain, plus
// viem) into one ESM file so Node can import the real runtime code, '@/' path
// alias and all. Nothing is re-implemented here.
const outdir = mkdtempSync(join(tmpdir(), 'vice-core-'));
const outfile = join(outdir, 'viceSpin.bundle.mjs');
await build({
  entryPoints: [join(ROOT, 'src', 'game', 'viceSpin.ts')],
  outfile, bundle: true, format: 'esm', platform: 'node', target: 'node20',
  alias: { '@': join(ROOT, 'src') },
  logLevel: 'error',
});
const { deriveViceRound } = await import(`file://${outfile.replace(/\\/g, '/')}`);

// ── manifest → ViceMathConfig (mirrors mathProfiles.fromManifest) ───────────
const KEY_TO_ID = { wild: 0, scatter: 1, highA: 2, highB: 3, midC: 4, midD: 5, lowE: 6, lowF: 7, lowG: 8, coin: 9 };
const payTable = {};
for (const [k, v] of Object.entries(M.payTable)) {
  const id = KEY_TO_ID[k] ?? Number(k);
  if (Number.isFinite(id)) payTable[id] = v;
}
const ROWS = M.gridId === '5x5' ? 5 : 3;
const CFG = {
  gridConfig: { reelCount: M.reelStrips.length, visibleRows: ROWS, stripLength: M.reelLength ?? 40, payModel: 'ways', id: M.gridId },
  reelStrips: M.reelStrips,
  fsReelStrips: M.fsReelStrips,
  payTable,
  scatterPay: M.scatterPay,
  freeSpinsCount: M.freeSpinsCount ?? 12,
  freeSpinsCap: M.freeSpinsCap ?? 50,
  freeSpinsMultiplier: M.freeSpinMultiplier ?? 5,
  maxWinMultiplier: M.maxWinMultiplier ?? 5000,
  expandingWildsInFS: !!M.custom.expandingWildsInFreeSpins,
  stickyTowerCap: M.custom.stickyTowerCap ?? 2,
  stickyRoundSpins: M.custom.stickyRoundSpins,
  stickyRoundCap: M.custom.stickyRoundCap,
  retriggerSpins: M.custom.retriggerSpins,
  stickyFullBoardMultiplier: M.custom.stickyFullBoardMultiplier ?? 1,
  fullBoardInstantMaxWin: !!M.custom.fullBoardInstantMaxWin,
  hotSpinChance1In: M.custom.hotSpinChance1In,
  hotSpinExpandsWilds: !!M.custom.hotSpinExpandsWilds,
  viceBuyStages: M.custom.viceBuyStages,
  anteBet: M.custom.anteBet,
};

// ── seeded PRNG — byte-identical to sim_vice.mjs ────────────────────────────
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
function randomness256(rng) {
  let hex = '';
  for (let i = 0; i < 8; i++) hex += rng().toString(16).padStart(8, '0');
  return '0x' + hex;
}

// ── modes (wager → settlement bet, exactly as mockHost.settleVice derives) ──
const MODES = ['natural', 'buy3', 'buy4', 'ante'];
function stageOf(mode) {
  return mode === 'buy3' ? 1 : mode === 'buy4' ? 2 : mode === 'ante' ? 3 : 0;
}
function wagerFor(mode, bet) {
  const st = CFG.viceBuyStages?.find(s => s.stage === stageOf(mode));
  if (st) return bet * BigInt(st.costMult);
  if (mode === 'ante') return (bet * BigInt(Math.round(CFG.anteBet.costMult * 100))) / 100n;
  return bet;
}
function settleBetFor(mode, wager) {
  const st = CFG.viceBuyStages?.find(s => s.stage === stageOf(mode));
  if (st) return wager / BigInt(st.costMult);
  if (mode === 'ante') return (wager * 100n) / BigInt(Math.round(CFG.anteBet.costMult * 100));
  return wager;
}

function pct(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function simulate(mode, rounds, bet, opts) {
  const rng = makeRng(opts.seed);
  const stage = stageOf(mode);
  const wager = wagerFor(mode, bet);
  const settleBet = settleBetFor(mode, wager);
  const maxWin = settleBet * BigInt(CFG.maxWinMultiplier);
  const wagerN = Number(wager), betN = Number(settleBet);

  let staked = 0, paid = 0, hits = 0, maxed = 0;
  let sumStakeX = 0, sumStakeX2 = 0, sumBetX = 0, sumBetX2 = 0;
  let basePct = 0, hotPct = 0, fs3Pct = 0, fs4Pct = 0, baseOnly = 0;
  let n3 = 0, n4 = 0, hotRounds = 0, hotSuppressedTriggers = 0, instantMaxRounds = 0;
  let maxRoundX = 0;
  const r3 = [], r4 = [];
  // invariant counters
  let sumViolations = 0, capViolations = 0, negativeCredits = 0, nondeterministic = 0;

  for (let i = 0; i < rounds; i++) {
    const randomness = randomness256(rng);
    // STREAM ALIGNMENT (see header): sim_vice burns one word for its hot roll on
    // natural/ante rounds. Burn the same word so both walk the same stream.
    if (opts.align && stage !== 1 && stage !== 2) rng();

    const round = deriveViceRound(randomness, settleBet, CFG, stage);

    // ── invariants ──────────────────────────────────────────────────────────
    let sum = round.base.credited;
    for (const s of round.fsSpins) {
      sum += s.credited;
      if (s.credited < 0n) negativeCredits++;
    }
    if (round.base.credited < 0n) negativeCredits++;
    if (sum !== round.totalWin) sumViolations++;
    if (round.totalWin > maxWin) capViolations++;
    if (opts.determinismSample && i < opts.determinismSample) {
      const again = deriveViceRound(randomness, settleBet, CFG, stage);
      if (again.totalWin !== round.totalWin
        || JSON.stringify(again.base.stops) !== JSON.stringify(round.base.stops)
        || again.fsSpins.length !== round.fsSpins.length
        || again.base.hot !== round.base.hot) nondeterministic++;
    }

    // ── stats ───────────────────────────────────────────────────────────────
    const total = Number(round.totalWin);
    const baseCredit = Number(round.base.credited);
    let fsCredit = 0;
    for (const s of round.fsSpins) fsCredit += Number(s.credited);
    staked += wagerN;
    paid += total;
    if (total > 0) hits++;
    if (round.capped) maxed++;
    const sx = total / wagerN, bx = total / betN;
    sumStakeX += sx; sumStakeX2 += sx * sx;
    sumBetX += bx; sumBetX2 += bx * bx;
    if (bx > maxRoundX) maxRoundX = bx;

    if (round.base.hot) {
      hotRounds++;
      hotPct += baseCredit;
      // scatters on the AS-LANDED board vs the EVALUATED (expanded) board
      let landed = 0;
      for (const row of round.base.board) for (const v of row) if (v === 1) landed++;
      if (landed >= 3 && round.base.scatters < 3) hotSuppressedTriggers++;
    } else {
      basePct += baseCredit;
    }
    baseOnly += baseCredit;
    if (round.base.instantMaxWin) instantMaxRounds++;
    if (round.fsTriggered) {
      if (round.sticky) { n4++; fs4Pct += fsCredit; r4.push(fsCredit / betN); }
      else { n3++; fs3Pct += fsCredit; r3.push(fsCredit / betN); }
    }
  }

  r3.sort((a, b) => a - b); r4.sort((a, b) => a - b);
  const meanStake = sumStakeX / rounds;
  const varStake = Math.max(0, sumStakeX2 / rounds - meanStake * meanStake);
  const meanBet = sumBetX / rounds;
  const varBet = Math.max(0, sumBetX2 / rounds - meanBet * meanBet);
  const P = x => x / staked * 100;
  return {
    source: 'src/game/viceSpin.ts (live core)',
    mode, rounds, seed: opts.seed, aligned: !!opts.align,
    costMultiplier: wagerN / betN,
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
    hotRounds, hotRate1In: hotRounds ? rounds / hotRounds : null,
    hotSuppressedTriggers, baseInstantMaxWins: instantMaxRounds,
    fs3RoundX: { avg: n3 ? r3.reduce((a, b) => a + b, 0) / n3 : 0, p50: pct(r3, .5), p90: pct(r3, .9), p99: pct(r3, .99), max: r3.length ? r3[r3.length - 1] : 0 },
    fs4RoundX: { avg: n4 ? r4.reduce((a, b) => a + b, 0) / n4 : 0, p50: pct(r4, .5), p90: pct(r4, .9), p99: pct(r4, .99), max: r4.length ? r4[r4.length - 1] : 0 },
    attributionPctOfWager: { base: P(basePct), hot: P(hotPct), fs3: P(fs3Pct), fs4: P(fs4Pct) },
    baseGameOnlyRtpPct: P(baseOnly),
    checks: {
      creditSumViolations: sumViolations,
      maxWinCapViolations: capViolations,
      negativeCredits,
      nondeterministicRounds: nondeterministic,
      determinismSample: opts.determinismSample,
    },
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = k => argv.some(a => a === `--${k}` || a.startsWith(`--${k}=`));
const val = (k, d) => { const a = argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ROUNDS = Number(argv.find(a => /^\d+$/.test(a))) || 500_000;
const SEED = Number(val('seed', 20260727));
const BUY_ROUNDS = Number(val('buy-rounds', Math.max(50_000, Math.round(ROUNDS / 4))));
const BET = 1_000_000n;   // 1.00 USDC @ 6 decimals — a multiple of BPS_DIVISOR

const fmt = (x, d = 2) => (x === null || x === undefined ? '  —  ' : Number(x).toFixed(d));
function printRun(r) {
  const a = r.attributionPctOfWager, c = r.checks;
  console.log(`\n── ${r.mode.toUpperCase()}  (${r.rounds.toLocaleString()} rounds, cost ${fmt(r.costMultiplier)}× bet, LIVE CORE)`);
  console.log(`   RTP            ${fmt(r.rtpPct)}%  ±${fmt(r.rtpCi99Pp)} pp (99% CI)`);
  console.log(`   hit frequency  ${fmt(r.hitFreqPct)}%`);
  console.log(`   volatility     std ${fmt(r.perRoundStdXOfStake)}× of stake  |  ${fmt(r.perRoundStdXOfBet)}× of bet`);
  console.log(`   max win        ${fmt(r.maxWinRatePct, 4)}%  ${r.maxWin1In ? `(1 in ${fmt(r.maxWin1In, 0)})` : '(none)'}   biggest round ${fmt(r.maxRoundXOfBet, 1)}× bet`);
  console.log(`   FS trigger     3sc 1-in-${fmt(r.fs3Trigger1In, 1)} (${r.fs3Rounds})   4+sc 1-in-${fmt(r.fs4Trigger1In, 1)} (${r.fs4Rounds})`);
  console.log(`   HOT spins      ${r.hotRounds} (1-in-${fmt(r.hotRate1In, 1)})   triggers suppressed by expansion ${r.hotSuppressedTriggers}   base instant-max ${r.baseInstantMaxWins}`);
  console.log(`   FS 3sc round×  avg ${fmt(r.fs3RoundX.avg)}  p50 ${fmt(r.fs3RoundX.p50)}  p90 ${fmt(r.fs3RoundX.p90)}  p99 ${fmt(r.fs3RoundX.p99)}  max ${fmt(r.fs3RoundX.max, 1)}`);
  console.log(`   FS 4sc round×  avg ${fmt(r.fs4RoundX.avg)}  p50 ${fmt(r.fs4RoundX.p50)}  p90 ${fmt(r.fs4RoundX.p90)}  p99 ${fmt(r.fs4RoundX.p99)}  max ${fmt(r.fs4RoundX.max, 1)}`);
  console.log(`   ATTRIBUTION    base ${fmt(a.base)}%  hot ${fmt(a.hot)}%  fs3 ${fmt(a.fs3)}%  fs4 ${fmt(a.fs4)}%   (of wager)`);
  console.log(`   base spin RTP  ${fmt(r.baseGameOnlyRtpPct)}% (= base ${fmt(a.base)}% + hot ${fmt(a.hot)}%)`);
  console.log(`   INVARIANTS     credited-sum ≠ total: ${c.creditSumViolations} | over cap: ${c.maxWinCapViolations} | negative credits: ${c.negativeCredits} | non-deterministic: ${c.nondeterministicRounds}/${c.determinismSample}`);
}

console.log('VICE HEAT — LIVE CORE certification (src/game/viceSpin.ts)');
console.log(`manifest ${MANIFEST_PATH}`);
console.log(`grid ${CFG.reelStrips.length}×${ROWS}  base strips ${CFG.reelStrips.map(s => s.length).join('/')}  FS strips ${CFG.fsReelStrips.map(s => s.length).join('/')}`);
console.log(`freeSpinsCount ${CFG.freeSpinsCount} cap ${CFG.freeSpinsCap} | sticky ${CFG.stickyRoundSpins} cap ${CFG.stickyRoundCap} towerCap ${CFG.stickyTowerCap} | retrigger +${CFG.retriggerSpins} | fsMult ×${CFG.freeSpinsMultiplier} | maxWin ${CFG.maxWinMultiplier}×`);
console.log(`hotSpinChance1In ${CFG.hotSpinChance1In} (LIVE) | simulExpandMultipliers RETIRED (never applied) | fullBoardInstantMaxWin ${CFG.fullBoardInstantMaxWin}`);

const modeArg = val('mode', 'natural');
const modes = modeArg === 'all' ? MODES : modeArg.split(',');
const out = { manifest: 'src/data/math_vice_heat.json', bet: Number(BET), seed: SEED, rounds: ROUNDS, runs: [] };
for (const mode of modes) {
  if (!MODES.includes(mode)) { console.log(`  unknown mode ${mode}`); continue; }
  const n = (mode === 'buy3' || mode === 'buy4') ? BUY_ROUNDS : ROUNDS;
  const t0 = Date.now();
  const r = simulate(mode, n, BET, {
    seed: SEED, align: !flag('no-align'), determinismSample: 2000,
  });
  r.elapsedMs = Date.now() - t0;
  printRun(r);
  out.runs.push(r);
}

if (flag('json')) {
  const p = val('json', '');
  const js = JSON.stringify(out, null, 1);
  if (p) { writeFileSync(p, js); console.log(`\nwrote ${p}`); }
  else console.log('\n' + js);
}
