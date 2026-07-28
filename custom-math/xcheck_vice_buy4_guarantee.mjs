// VICE HEAT buy4 GUARANTEED TOWER — cross-check against the LIVE TypeScript core.
//
// Counterpart to custom-math/sim_vice_buy4_guarantee.mjs (an independent
// re-implementation). This one drives src/game/viceSpin.ts itself — the real
// ways evaluator (winEval → viceWays), the real sticky-tower bookkeeping, the
// real keccak badge draws, the real maxWin cap — exactly like
// custom-math/sim_vice_core.mjs, which it is copied from.
//
// TWO in-memory overrides, NEITHER of which touches a repo file:
//   1. the stage-2 (bought 4-scatter) fsReelStrips are replaced with the refit
//      arrays read from --strips=<json>;
//   2. an esbuild onLoad PLUGIN rewrites the TEXT of viceSpin.ts as it is
//      bundled, inserting the guarantee immediately after the free spin's stops
//      are derived. The inserted block is printed with --show-patch and IS the
//      proposed runtime patch — it is not a re-implementation of the round.
//
//   node custom-math/xcheck_vice_buy4_guarantee.mjs [rounds]
//     --strips=<json>     {"fsReelStrips":[[...]x5]} for the buy4 stage
//     --guar=none|first   first = guarantee on, pinned to --guar-reel (default 0)
//     --guar-reel=N
//     --seed=N            default 20260727
//     --show-patch        print the source patch and exit
//     --json[=path]

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MANIFEST_PATH = join(ROOT, 'src', 'data', 'math_vice_heat.json');
const M = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

const argv = process.argv.slice(2);
const flag = k => argv.some(a => a === `--${k}` || a.startsWith(`--${k}=`));
const val = (k, d) => { const a = argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

// ── THE PATCH ───────────────────────────────────────────────────────────────
// Anchor: the two lines that open every free spin in viceSpin.ts.
const ANCHOR = `      const seed = spinSeed(randomness, BigInt(fsSpins.length));
      const fsStops = deriveStops(seed, fsStrips);`;

const PATCH = `
      // ── GUARANTEED TOWER (bought round that asks for it) ──────────────────
      // A bought STICKY round is sold as a tower round, so free spin 1 must show
      // a tower. If NO reel would expand, exactly one reel's stop slides FORWARD
      // to the nearest stop whose 5-row window carries a wild — the same forward
      // scan forceScatterStops already uses to place the bought trigger board, so
      // the result stays a pure function of \`randomness\`.
      if (sticky && (buyStage as any)?.guaranteedTowerOnFirstSpin && fsSpins.length === 0) {
        const windowHasWild = (reel: number, stop: number): boolean => {
          const strip = fsStrips[reel];
          for (let row = 0; row < rows; row++) {
            if (strip[(stop + row) % strip.length] === SymbolId.WILD) return true;
          }
          return false;
        };
        let anyWild = false;
        for (let r = 0; r < reels; r++) if (windowHasWild(r, fsStops[r])) { anyWild = true; break; }
        if (!anyWild) {
          const reel = (buyStage as any).guaranteedTowerReel ?? 0;
          const len = fsStrips[reel].length;
          for (let off = 0; off < len; off++) {
            const pos = (fsStops[reel] + off) % len;
            if (windowHasWild(reel, pos)) { fsStops[reel] = pos; break; }
          }
        }
      }`;

if (flag('show-patch')) {
  console.log('INSERT AFTER (src/game/viceSpin.ts, top of the free-spin while loop):\n');
  console.log(ANCHOR);
  console.log('\nTHE INSERT:');
  console.log(PATCH);
  process.exit(0);
}

// ── bundle the LIVE core with the patch applied in memory ───────────────────
const VICE_SPIN = join(ROOT, 'src', 'game', 'viceSpin.ts').replace(/\\/g, '/');
let patched = false;
const patchPlugin = {
  name: 'vice-guarantee-patch',
  setup(b) {
    b.onLoad({ filter: /viceSpin\.ts$/ }, args => {
      if (args.path.replace(/\\/g, '/') !== VICE_SPIN) return null;
      const src = readFileSync(args.path, 'utf8');
      if (!src.includes(ANCHOR)) throw new Error('PATCH ANCHOR NOT FOUND in viceSpin.ts — the runtime moved, re-anchor the patch');
      patched = true;
      return { contents: src.replace(ANCHOR, ANCHOR + PATCH), loader: 'ts' };
    });
  },
};

const outdir = mkdtempSync(join(tmpdir(), 'vice-guar-'));
const outfile = join(outdir, 'viceSpin.bundle.mjs');
await build({
  entryPoints: [join(ROOT, 'src', 'game', 'viceSpin.ts')],
  outfile, bundle: true, format: 'esm', platform: 'node', target: 'node20',
  alias: { '@': join(ROOT, 'src') },
  plugins: [patchPlugin],
  logLevel: 'error',
});
if (!patched) throw new Error('the onLoad plugin never fired — bundle is UNPATCHED');
const { deriveViceRound } = await import(`file://${outfile.replace(/\\/g, '/')}`);

// ── manifest → ViceMathConfig (mirrors mathProfiles.fromManifest) ───────────
const KEY_TO_ID = { wild: 0, scatter: 1, highA: 2, highB: 3, midC: 4, midD: 5, lowE: 6, lowF: 7, lowG: 8, coin: 9 };
const payTable = {};
for (const [k, v] of Object.entries(M.payTable)) {
  const id = KEY_TO_ID[k] ?? Number(k);
  if (Number.isFinite(id)) payTable[id] = v;
}
const ROWS = M.gridId === '5x5' ? 5 : 3;

const STRIPS_PATH = val('strips', null);
const NEW_STRIPS = STRIPS_PATH ? JSON.parse(readFileSync(STRIPS_PATH, 'utf8')) : null;
// PRECEDENCE: a --dump-strips file carries BOTH the top-level fsReelStrips
// (1170 stops) and the per-stage ones, so the stage-2 entry must win. Reading
// the top-level key by mistake silently measures the wrong strips (it measured
// 161% once) — hence the length assert below.
const newBuy4 = NEW_STRIPS
  ? (NEW_STRIPS.buyStages?.find(s => s.stage === 2)?.fsReelStrips ?? NEW_STRIPS.fsReelStrips)
  : null;

const GUAR = val('guar', 'none');
const GUAR_REEL = Number(val('guar-reel', 0));

const EXPECT_LEN = Number(val('expect-len', 0));
if (newBuy4 && EXPECT_LEN && newBuy4.some(s => s.length !== EXPECT_LEN)) {
  throw new Error(`buy4 strips are ${newBuy4.map(s => s.length).join('/')} stops, expected ${EXPECT_LEN} — wrong key read out of the strips file`);
}

const stages = (M.custom.viceBuyStages ?? []).map(st => {
  if (st.stage !== 2) return st;
  return {
    ...st,
    fsReelStrips: newBuy4 ?? st.fsReelStrips,
    guaranteedTowerOnFirstSpin: GUAR !== 'none',
    guaranteedTowerReel: GUAR_REEL,
  };
});

const CFG = {
  gridConfig: { reelCount: M.reelStrips.length, visibleRows: ROWS, stripLength: M.reelLength ?? 40, payModel: 'ways', id: M.gridId },
  reelStrips: M.reelStrips,
  fsReelStrips: M.fsReelStrips,
  payTable,
  scatterPay: M.scatterPay,
  freeSpinsCount: M.freeSpinsCount ?? 12,
  freeSpinsCap: M.freeSpinsCap ?? 50,
  freeSpinsMultiplier: M.freeSpinMultiplier ?? 1,
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
  towerMultiplierWeights: M.custom.towerMultiplierWeights,
  viceBuyStages: stages,
  anteBet: M.custom.anteBet,
};

// ── seeded PRNG — byte-identical to sim_vice.mjs / sim_vice_core.mjs ────────
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
function randomness256(rng) { let hex = ''; for (let i = 0; i < 8; i++) hex += rng().toString(16).padStart(8, '0'); return '0x' + hex; }
function pct(sorted, q) { if (!sorted.length) return 0; return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; }

const ROUNDS = Number(argv.find(a => /^\d+$/.test(a))) || 500_000;
const SEED = Number(val('seed', 20260727));
const BET = 1_000_000n;

const stage2 = CFG.viceBuyStages.find(s => s.stage === 2);
const wager = BET * BigInt(stage2.costMult);
const settleBet = BET;
const maxWin = settleBet * BigInt(CFG.maxWinMultiplier);
const wagerN = Number(wager), betN = Number(settleBet);

const rng = makeRng(SEED);
let staked = 0, paid = 0, maxed = 0, capViolations = 0, sumViolations = 0, nondeterministic = 0;
const DETERMINISM_SAMPLE = Number(val('determinism-sample', 2000));
let sumStakeX = 0, sumStakeX2 = 0, sumBetX = 0, sumBetX2 = 0;
let baseOnly = 0, fs4 = 0, maxRoundX = 0;
const endTowerHist = new Array(6).fill(0);
const towersPerSpinHist = new Array(6).fill(0);
let fsSpinsTotal = 0, fsSpinsWithTower = 0, roundsWith5x = 0, firstTowerSum = 0, firstTowerN = 0;
const r4 = [];

const t0 = Date.now();
for (let i = 0; i < ROUNDS; i++) {
  const randomness = randomness256(rng);
  const round = deriveViceRound(randomness, settleBet, CFG, 2);

  let sum = round.base.credited;
  for (const s of round.fsSpins) sum += s.credited;
  if (sum !== round.totalWin) sumViolations++;
  if (round.totalWin > maxWin) capViolations++;
  // The nudge must stay a pure function of `randomness` — replay and compare.
  if (i < DETERMINISM_SAMPLE) {
    const again = deriveViceRound(randomness, settleBet, CFG, 2);
    if (again.totalWin !== round.totalWin
      || again.fsSpins.length !== round.fsSpins.length
      || JSON.stringify(again.fsSpins.map(s => s.stops)) !== JSON.stringify(round.fsSpins.map(s => s.stops))) nondeterministic++;
  }

  const total = Number(round.totalWin);
  staked += wagerN; paid += total;
  if (round.capped) maxed++;
  const sx = total / wagerN, bx = total / betN;
  sumStakeX += sx; sumStakeX2 += sx * sx; sumBetX += bx; sumBetX2 += bx * bx;
  if (bx > maxRoundX) maxRoundX = bx;
  baseOnly += Number(round.base.credited);
  let fsCredit = 0;
  for (const s of round.fsSpins) fsCredit += Number(s.credited);
  fs4 += fsCredit; r4.push(fsCredit / betN);

  let end = 0, first = -1, has5 = false;
  for (let k = 0; k < round.fsSpins.length; k++) {
    const s = round.fsSpins[k];
    const n = s.stickyReels.length;
    fsSpinsTotal++;
    towersPerSpinHist[Math.min(5, s.expandedReels.length)]++;
    if (s.expandedReels.length > 0) fsSpinsWithTower++;
    for (const r of Object.keys(s.towerMultipliers)) if (s.towerMultipliers[r] === 5) has5 = true;
    if (n > end) end = n;
    if (first < 0 && n > 0) first = k;
  }
  endTowerHist[end]++;
  if (has5) roundsWith5x++;
  if (first >= 0) { firstTowerSum += first; firstTowerN++; }
}
const elapsedMs = Date.now() - t0;
r4.sort((a, b) => a - b);

const meanStake = sumStakeX / ROUNDS;
const varStake = Math.max(0, sumStakeX2 / ROUNDS - meanStake * meanStake);
const meanBet = sumBetX / ROUNDS;
const varBet = Math.max(0, sumBetX2 / ROUNDS - meanBet * meanBet);

const out = {
  source: 'src/game/viceSpin.ts (LIVE core, guarantee patched in at bundle time)',
  mode: 'buy4', rounds: ROUNDS, seed: SEED,
  guarantee: GUAR === 'none' ? 'none' : `firstSpin,reel${GUAR_REEL}`,
  stripsFrom: STRIPS_PATH ?? 'manifest (unchanged)',
  buy4WildsPerReel: stage2.fsReelStrips.map(s => s.filter(v => v === 0).length),
  buy4ScattersPerReel: stage2.fsReelStrips.map(s => s.filter(v => v === 1).length),
  buy4StripLengths: stage2.fsReelStrips.map(s => s.length),
  costMultiplierOfBet: wagerN / betN,
  rtpPct: paid / staked * 100,
  rtpCi99Pp: 2.576 * Math.sqrt(varStake) / Math.sqrt(ROUNDS) * 100,
  perRoundStdXOfBet: Math.sqrt(varBet),
  perRoundStdXOfStake: Math.sqrt(varStake),
  maxWinRatePct: maxed / ROUNDS * 100,
  maxWin1In: maxed ? ROUNDS / maxed : null,
  biggestRoundXOfBet: maxRoundX,
  fs4RoundX: { avg: r4.reduce((a, b) => a + b, 0) / ROUNDS, p50: pct(r4, .5), p90: pct(r4, .9), p99: pct(r4, .99), max: r4[r4.length - 1] },
  attributionPctOfWager: { base: baseOnly / staked * 100, fs4: fs4 / staked * 100 },
  endTowerCountHistPct: endTowerHist.map(c => +(100 * c / ROUNDS).toFixed(4)),
  zeroTowerRoundsPct: +(100 * endTowerHist[0] / ROUNDS).toFixed(4),
  meanEndTowers: endTowerHist.reduce((a, c, i) => a + c * i, 0) / ROUNDS,
  towersPerFsSpinHistPct: towersPerSpinHist.map(c => +(100 * c / fsSpinsTotal).toFixed(3)),
  fsSpinsWithAnyTowerPct: 100 * fsSpinsWithTower / fsSpinsTotal,
  roundsShowingA5xPct: 100 * roundsWith5x / ROUNDS,
  meanFirstTowerSpinIdx: firstTowerN ? firstTowerSum / firstTowerN : null,
  checks: { creditSumViolations: sumViolations, maxWinCapViolations: capViolations, nondeterministicRounds: nondeterministic, determinismSample: DETERMINISM_SAMPLE },
  elapsedMs,
};

const fmt = (x, d = 2) => (x === null || x === undefined ? '—' : Number(x).toFixed(d));
console.log(`\n── LIVE CORE buy4  (${ROUNDS.toLocaleString()} rounds, seed ${SEED}, guarantee ${out.guarantee})`);
console.log(`   strips        ${out.stripsFrom}   wilds ${out.buy4WildsPerReel.join('/')}  scat ${out.buy4ScattersPerReel.join('/')}  len ${out.buy4StripLengths.join('/')}`);
console.log(`   RTP           ${fmt(out.rtpPct)}%  ±${fmt(out.rtpCi99Pp)} pp (99% CI)   cost ${fmt(out.costMultiplierOfBet)}× bet`);
console.log(`   volatility    std ${fmt(out.perRoundStdXOfBet, 1)}× of bet   max win ${fmt(out.maxWinRatePct, 4)}% (1 in ${fmt(out.maxWin1In, 0)})`);
console.log(`   TOWERS/ROUND  ${out.endTowerCountHistPct.slice(0, 6).map((p, i) => `${i}:${fmt(p, 2)}%`).join('  ')}   mean ${fmt(out.meanEndTowers, 3)}`);
console.log(`   ZERO TOWERS   ${fmt(out.zeroTowerRoundsPct, 4)}%   first tower on spin idx ${fmt(out.meanFirstTowerSpinIdx, 3)}   a 5× in ${fmt(out.roundsShowingA5xPct, 2)}% of rounds`);
console.log(`   INVARIANTS    credited-sum ≠ total ${out.checks.creditSumViolations} | over cap ${out.checks.maxWinCapViolations} | non-deterministic ${out.checks.nondeterministicRounds}/${out.checks.determinismSample}`);

if (flag('json')) {
  const p = val('json', '');
  const js = JSON.stringify(out, null, 1);
  if (p) { writeFileSync(p, js); console.log(`\nwrote ${p}`); }
  else console.log('\n' + js);
}
