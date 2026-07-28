// Assemble the Vice Heat tower-multiplier recommendation JSON from the measured
// runs produced by custom-math/sim_vice_towermult.mjs.
//
// Every RTP / volatility / frequency number in the output is COPIED from a
// measured run — nothing is interpolated or estimated. Scalars that came from a
// --quiet console line (no --json file) are listed in MEASURED_SCALARS below
// together with the exact command that produced them.
//
//   node custom-math/emit_vice_tower_deliverable.mjs <scratchpadDir> <outPath>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const SP = process.argv[2];
const OUT = process.argv[3];
const load = f => (existsSync(join(SP, f)) ? JSON.parse(readFileSync(join(SP, f), 'utf8')) : null);
const pick = (f, mode) => { const j = load(f); return j ? (j.runs.find(x => x.mode === mode) ?? null) : null; };

const slim = r => r && ({
  rtpPct: +r.rtpPct.toFixed(3),
  ci99Pp: +r.rtpCi99Pp.toFixed(3),
  rounds: r.rounds,
  seed: r.seed,
  costMultiplierOfBet: +r.costMultiplier.toFixed(3),
  hitFrequencyPct: +r.hitFreqPct.toFixed(2),
  volatilityPerRoundStdXOfBet: +r.perRoundStdXOfBet.toFixed(2),
  volatilityPerRoundStdXOfStake: +r.perRoundStdXOfStake.toFixed(2),
  maxWinRatePct: +r.maxWinRatePct.toFixed(5),
  maxWin1InRounds: r.maxWin1In ? Math.round(r.maxWin1In) : null,
  biggestRoundXOfBet: +r.maxRoundXOfBet.toFixed(1),
  fsTrigger3sc1In: r.fs3Trigger1In ? +r.fs3Trigger1In.toFixed(1) : null,
  fsTrigger4sc1In: r.fs4Trigger1In ? +r.fs4Trigger1In.toFixed(1) : null,
  fs3RoundXOfBet: r.fs3RoundX,
  fs4RoundXOfBet: r.fs4RoundX,
  rtpAttributionPctOfWager: Object.fromEntries(Object.entries(r.attributionPctOfWager).map(([k, v]) => [k, +v.toFixed(2)])),
  towerFeature: {
    fsSpinsSampled: r.featureStats.fsSpins,
    fsSpinsWithAnyExpandedReelPct: +r.featureStats.fsSpinsWithAnyTowerPct.toFixed(2),
    fsSpinsShowingA5xPct: +r.featureStats.fsSpinsWith5xPct.toFixed(2),
    fs3SpinsShowingA5xPct: +r.featureStats.fs3SpinsWith5xPct.toFixed(2),
    fs4SpinsShowingA5xPct: +r.featureStats.fs4SpinsWith5xPct.toFixed(2),
    roundsShowingA5xPct: +r.featureStats.roundsWith5xPct.toFixed(3),
    a5xEveryNRounds: r.featureStats.oneFiveXEveryNRounds ? Math.round(r.featureStats.oneFiveXEveryNRounds) : null,
    fsRoundsShowingA5xPct: +r.featureStats.fsRoundsWith5xPct.toFixed(1),
    expandedReelsPerFsSpinHistPct: r.featureStats.towersPerFsSpinHistPct,
    payWeightedMeanCombinationMultiplier: +r.featureStats.payWeightedMeanCombinationMultiplier.toFixed(3),
  },
  maxWinCapViolations: r.checks.maxWinCapViolations,
});

const strips = load('vice_tower_strips_FINAL.json');
const stage = n => strips?.buyStages?.find(s => s.stage === n)?.fsReelStrips ?? null;
const wc = s => s.filter(v => v === 0).length;
const sc = s => s.filter(v => v === 1).length;

// ── scalars measured on the console (no --json), with their commands ─────────
const CMD = 'node custom-math/sim_vice_towermult.mjs <rounds> --mode=<mode> --eval=engine --no-simul [--hot] --seed=90210 --agg=<agg> --w=<weights> --sticky=<keep|reroll>';
const MEASURED_SCALARS = {
  note: 'natural, 4,000,000 rounds, seed 90210, --eval=engine --no-simul --hot, sticky=keep. Common random numbers: the board stream is identical across every row, only the badge stream differs, so the DIFFERENCES between rows are far tighter than the absolute 99% CI.',
  command: CMD,
  aggregationComparison: [
    { agg: 'none (today, no badges)', weights: null, rtpPct: 71.56, ci99Pp: 1.89, stdXOfBet: 14.7, hitPct: 68.2, maxWin1In: 173913, payWeightedComboX: 1.000 },
    { agg: 'highest', weights: '100/0/0/0/0 (all 1x = floor)', rtpPct: 71.56, ci99Pp: 1.89, stdXOfBet: 14.7, hitPct: 68.2, maxWin1In: 173913, payWeightedComboX: 1.000 },
    { agg: 'highest', weights: '0/0/0/0/100 (all 5x = ceiling)', rtpPct: 128.09, ci99Pp: 4.49, stdXOfBet: 34.9, hitPct: 68.2, maxWin1In: 61538, payWeightedComboX: 1.891 },
    { agg: 'highest', weights: '88/7/3/1/1', rtpPct: 77.63, ci99Pp: 2.35, stdXOfBet: 18.2, hitPct: 68.2, maxWin1In: 142857, payWeightedComboX: 1.100 },
    { agg: 'highest', weights: '67/19/8/4/2', rtpPct: 86.41, ci99Pp: 2.85, stdXOfBet: 22.2, hitPct: 68.2, maxWin1In: 129032, payWeightedComboX: 1.240 },
    { agg: 'highest', weights: '55/19/9/6/11', rtpPct: 96.36, ci99Pp: 3.43, stdXOfBet: 26.7, hitPct: 68.2, maxWin1In: 86957, payWeightedComboX: 1.406 },
    { agg: 'sum', weights: '100/0/0/0/0 (all 1x = floor)', rtpPct: 90.53, ci99Pp: 3.36, stdXOfBet: 26.1, hitPct: 68.2, maxWin1In: 95238, payWeightedComboX: 1.329 },
    { agg: 'sum', weights: '0/0/0/0/100 (all 5x = ceiling)', rtpPct: 177.93, ci99Pp: 7.20, stdXOfBet: 55.9, hitPct: 68.2, maxWin1In: 12618, payWeightedComboX: 3.039 },
    { agg: 'sum', weights: '88/7/3/1/1', rtpPct: 96.23, ci99Pp: 3.76, stdXOfBet: 29.2, hitPct: 68.2, maxWin1In: 66667, payWeightedComboX: 1.431 },
    { agg: 'sum', weights: '67/19/8/4/2', rtpPct: 106.59, ci99Pp: 4.39, stdXOfBet: 34.1, hitPct: 68.2, maxWin1In: 45455, payWeightedComboX: 1.617 },
    { agg: 'sum', weights: '55/19/9/6/11', rtpPct: 117.43, ci99Pp: 4.96, stdXOfBet: 38.5, hitPct: 68.2, maxWin1In: 32000, payWeightedComboX: 1.818 },
    { agg: 'product', weights: '100/0/0/0/0 (all 1x = floor)', rtpPct: 71.56, ci99Pp: 1.89, stdXOfBet: 14.7, hitPct: 68.2, maxWin1In: 173913, payWeightedComboX: 1.000 },
    { agg: 'product', weights: '0/0/0/0/100 (all 5x = ceiling)', rtpPct: 273.56, ci99Pp: 10.99, stdXOfBet: 85.3, hitPct: 68.2, maxWin1In: 4228, payWeightedComboX: 14.875 },
    { agg: 'product', weights: '88/7/3/1/1', rtpPct: 78.72, ci99Pp: 2.51, stdXOfBet: 19.5, hitPct: 68.2, maxWin1In: 121212, payWeightedComboX: 1.120 },
    { agg: 'product', weights: '67/19/8/4/2', rtpPct: 95.01, ci99Pp: 3.76, stdXOfBet: 29.2, hitPct: 68.2, maxWin1In: 50633, payWeightedComboX: 1.451 },
    { agg: 'product', weights: '55/19/9/6/11', rtpPct: 115.14, ci99Pp: 5.02, stdXOfBet: 39.0, hitPct: 68.2, maxWin1In: 26846, payWeightedComboX: 2.000 },
  ],
  stickyKeepVsReroll: {
    note: 'identical badge weights, identical boards; only the sticky-round rule differs',
    rows: [
      { mode: 'natural', rounds: 4000000, weights: '45/27/16/8/4', keepRtpPct: 95.02, keepMaxWin1In: 97561, rerollRtpPct: 94.97, rerollMaxWin1In: 111111 },
      { mode: 'natural', rounds: 4000000, weights: '55/18/9/7/11', keepRtpPct: 96.81, keepMaxWin1In: 86957, rerollRtpPct: 97.15, rerollMaxWin1In: 111111 },
      { mode: 'ante', rounds: 3000000, weights: '55/19/9/6/11', keepRtpPct: 96.33, keepMaxWin1In: 12245, rerollRtpPct: 97.18, rerollMaxWin1In: 12987 },
      { mode: 'buy4 (pre-refit strips)', rounds: 200000, weights: '55/19/9/6/11', agg: 'highest', keepRtpPct: 115.30, keepMaxWin1In: 112, rerollRtpPct: 116.47, rerollMaxWin1In: 117 },
      { mode: 'buy4 (pre-refit strips)', rounds: 200000, weights: '55/19/9/6/11', agg: 'sum', keepRtpPct: 176.59, keepMaxWin1In: 47, rerollRtpPct: 179.41, rerollMaxWin1In: 46 },
      { mode: 'buy4 (pre-refit strips)', rounds: 200000, weights: '55/19/9/6/11', agg: 'product', keepRtpPct: 168.51, keepMaxWin1In: 39, rerollRtpPct: 187.43, rerollMaxWin1In: 34 },
    ],
  },
  otherLevers: {
    'natural, tower badges also on HOT base-spin expansions (--hotmult=on)': { rounds: 3000000, rtpPct: 103.09, vsOffRtpPct: 96.36, note: 'rejected — +6.7pp, and hot spins are not implemented in the runtime anyway' },
    'natural, simulExpandMultipliers {3:2,4:10} re-added on top of the badges': { rounds: 3000000, rtpPct: 101.81, vsOffRtpPct: 96.36, note: 'rejected — +5.5pp overshoot; the key is already absent from the manifest' },
    'natural with the badge feature but hot spins OFF': { rounds: 8000000, weights: '55/19/9/6/11 (the slightly richer pre-trim set, which measures 96.36% WITH hot spins at 4M)', rtpPct: 94.50, ci99Pp: 2.55, note: 'the ante/natural fit still leans on the (unimplemented) hot-spin rule, exactly as the shipped manifest already warns' },
    'natural free-spin wild density sweep (agg=none, 2M rounds each)': [
      { fsWildsPerReel: 10, stops: 1170, rtpPct: 72.37 },
      { fsWildsPerReel: 16, stops: 1170, rtpPct: 102.49 },
      { fsWildsPerReel: 22, stops: 1170, rtpPct: 156.11 },
      { fsWildsPerReel: 30, stops: 1170, rtpPct: 244.83 },
      { fsWildsPerReel: 40, stops: 1170, rtpPct: 362.36 },
    ],
  },
  stripArrangementSensitivity: {
    note: 'IDENTICAL symbol multiset, IDENTICAL wild count, only the deterministic shuffle seed differs (--shuf). The arrangement is a first-order lever at these wild elasticities: the exact stop arrays must ship verbatim, they cannot be regenerated.',
    buy3_42wildsPer1215_1MroundsEach: [
      { shuf: 0, rtpPct: 96.19 }, { shuf: 1, rtpPct: 92.47 }, { shuf: 2, rtpPct: 90.56 }, { shuf: 3, rtpPct: 92.61 },
    ],
    buy4_18_17_17_17_17per2406_1_2MroundsEach: [
      { shuf: 0, rtpPct: 94.61 }, { shuf: 1, rtpPct: 98.30 }, { shuf: 2, rtpPct: 96.06 },
      { shuf: 3, rtpPct: 97.98 }, { shuf: 4, rtpPct: 99.15 }, { shuf: 5, rtpPct: 91.79 },
    ],
    summary: 'buy3 spread 90.56-96.19 (5.6pp) over 4 shuffles; buy4 spread 91.79-99.15 (7.4pp) over 6 shuffles, all at fixed density and 1-1.2M rounds each (99% CI ~0.7pp, so the spread is arrangement, not sampling).',
  },
  buyStripFits: {
    note: 'buy rounds, weights 55/20/9/6/10, agg=highest, sticky=keep, engine evaluator',
    buy3_1215stops: [
      { wildsPerReel: '42,42,42,41,41', rounds: 2000000, rtpPct: 93.98 },
      { wildsPerReel: '42,42,42,42,41', rounds: 2000000, rtpPct: 95.41 },
      { wildsPerReel: '42,42,42,42,42', rounds: 2000000, rtpPct: 96.21, chosen: true },
      { wildsPerReel: '14,14,14,14,14 @405 stops (SAME density, different arrangement)', rounds: 2000000, rtpPct: 97.07 },
    ],
    buy4_2406stops: [
      { wildsPerReel: '17,17,17,17,17', rounds: 500000, rtpPct: 95.23, weights: '55/19/9/6/11' },
      { wildsPerReel: '18,17,17,17,17', rounds: 3000000, rtpPct: 94.93 },
      { wildsPerReel: '19,17,17,17,17', rounds: 1200000, rtpPct: 94.92 },
      { wildsPerReel: '20,17,17,17,17', rounds: 1200000, rtpPct: 95.18 },
      { wildsPerReel: '21,17,17,17,17', rounds: 1200000, rtpPct: 95.73 },
      { wildsPerReel: '22,17,17,17,17', rounds: 1200000, rtpPct: 96.11, chosen: true },
      { wildsPerReel: '18,18,17,17,17', rounds: 500000, rtpPct: 102.32, weights: '55/19/9/6/11', note: 'a single extra wild on REEL 1 is worth ~6pp; on REEL 0 it is worth ~0.3pp' },
      { wildsPerReel: '18,17,17,17,18', rounds: 1200000, rtpPct: 97.78 },
      { wildsPerReel: '18,17,17,18,17', rounds: 1200000, rtpPct: 100.05 },
    ],
  },
};

const doc = {
  feature: 'Vice Heat — every EXPANDED WILD REEL carries its own multiplier badge, 1x-5x, drawn per reel',
  producedBy: 'custom-math/sim_vice_towermult.mjs (new) + custom-math/emit_vice_tower_deliverable.mjs (new). custom-math/sim_vice.mjs was NOT modified.',
  parityCheck: 'with --agg=none the new simulator reproduces sim_vice.mjs bit for bit: natural 1M rounds seed 90210 --eval=engine --no-simul --hot -> 73.79% in both, identical attribution 47.86/3.57/7.65/14.71.',
  evaluator: 'engine ONLY. WinEvaluator.ts:120 seeds the ways candidate set from column 0 and folds a WILD there into HIGH_A; SlotGame.sol:341 does the same. Every number here was measured with --eval=engine. --eval=corrected was never used for a fit.',
  startingPoint: 'the game without this feature measures 71.56% +/-1.89 natural (4,000,000 rounds, seed 90210, --eval=engine --no-simul --hot --agg=none), hit 68.23%, std 14.69x of bet, max win 1-in-173,913, attribution base 47.82 / hot 3.77 / fs3 7.64 / fs4 12.33. Expanded reels already appear on 23.54% of free-spin spins at that point; the feature adds nothing to their frequency, only a badge.',

  recommendation: {
    aggregation: 'HIGHEST',
    aggregationRule: 'A ways combination starts on reel 0 and runs across k consecutive reels. Multiply that combination by the HIGHEST badge among the expanded wild reels inside reels 0..k-1. A combination that crosses no expanded reel is unmultiplied. Scatter pay is never multiplied.',
    badgeWeightsPercent: { '1x': 55, '2x': 20, '3x': 9, '4x': 6, '5x': 10 },
    badgeMean: 1.96,
    badgeShape: 'deliberately bimodal — 75% of badges are 1x or 2x, then a hard jump to a 10% 5x. A smooth ladder with the same mean needs ~4% at 5x and makes the 5x almost invisible; the bimodal shape buys the same RTP with 2.5x more 5x events.',
    stickyRoundRule: 'KEEP — a 4-scatter sticky tower is dealt its badge when it lands and holds it for the whole round. A 3-scatter round re-expands from scratch every spin, so it necessarily draws fresh badges each spin.',
    hotSpinExpansionsCarryBadges: false,
    simulExpandMultipliers: 'STAYS RETIRED (the key is already absent from the shipped manifest)',
  },

  answers: {
    '1_aggregation': {
      controllable: ['HIGHEST', 'PRODUCT (but fragile)'],
      notControllable: ['SUM'],
      why: {
        HIGHEST: 'floor 71.56% (every badge 1x) to ceiling 128.09% (every badge 5x). 96% sits at 44% of that range, so the badge distribution has real room in BOTH directions. Sensitivity 14.1pp of RTP per +1 of mean badge — the flattest of the three, i.e. the most forgiving to future tuning.',
        SUM: 'floor is 90.53% with EVERY badge locked at 1x, because two expanded reels already double the win on their own. Only 5.5pp of the 24.5pp gap is left for the badge values, which forces ~88% of badges to 1x and the 5x down to ~1%. The badge would be decoration, not a mechanic. Not controllable for this feature.',
        PRODUCT: 'spans the target (floor = baseline, ceiling 273.56%) but its sensitivity is 50.5pp per +1 of mean badge — 3.6x steeper than HIGHEST — and its value is multiplicative in the NUMBER of standing towers. At matched 96% RTP its max-win rate is 1-in-50,633 vs 1-in-173,913 for the no-badge game and 1-in-86,957 for HIGHEST. On a bought 4-scatter round with the same weights it reads 168.51% (keep) / 187.43% (reroll) with max win hit on 1 round in 39 / 1 in 34. This is the Crack Farm 3125% failure mode in miniature: any later change to free-spin wild density or stickyTowerCap re-prices it violently.',
      },
      volatilityAtMatched96Pct: { highest: { stdXOfBet: 26.7, maxWin1In: 86957 }, sum: { stdXOfBet: 29.2, maxWin1In: 66667 }, product: { stdXOfBet: 29.2, maxWin1In: 50633 } },
    },
    '2_weights': {
      chosen: { '1x': 55, '2x': 20, '3x': 9, '4x': 6, '5x': 10 },
      reachable: 'yes — the target is reachable with the CURRENT free-spin strips; no re-fit of fsReelStrips was needed for natural or ante.',
      whyNotMostly1and2WithARare5x: 'it IS mostly 1-2x (75%), but a genuinely RARE 5x is not reachable at 96%. Expanded reels only appear on 23.5% of natural free-spin spins, so the badge has to carry a mean of ~1.96 to close a 24.5pp gap. A smooth 45/27/16/8/4 ladder reaches the same RTP with only 4% 5x, but then a 5x lands in just 1 round in ~1200. The 55/20/9/6/10 shape holds the same mean while putting the 5x on the board 2.5x more often.',
      rejectedAlternativeRaisingWildDensity: 'raising free-spin wild density to make towers commoner is not available: 10 -> 16 wilds per 1170-stop reel moves natural RTP 72.37% -> 102.49% with agg=none, i.e. before any badge exists. Every extra wild costs ~5pp, so a denser board forces a near-1x badge distribution and makes the 5x RARER, not commoner.',
    },
    '3_stickyRounds': {
      chosen: 'KEEP',
      bothAreControllableUnderHIGHEST: 'neither runs away, because HIGHEST is bounded by 5 no matter how many towers stand. Measured difference is +0.4 to +0.9pp for reroll with a slightly THINNER max-win tail (keep 1-in-86,957 vs reroll 1-in-111,111 on natural), because keeping one high badge for a whole round correlates the spins and fattens the top end into the 5000x cap.',
      whatActuallyRunsAway: 'the runaway is a property of the AGGREGATION, not of keep/reroll. On a bought 4-scatter round (10 spins, towers accumulating to cap 5) with the same badge weights: HIGHEST 115.30% keep / 116.47% reroll; SUM 176.59% / 179.41% (max win on 1 round in 47 / 46); PRODUCT 168.51% / 187.43% (max win on 1 round in 39 / 34, pay-weighted mean combination multiplier 6.44x / 8.64x). PRODUCT + reroll is the configuration that runs away: it re-rolls five badges every spin, so a five-tower board is worth (E[badge])^5 per spin and 3% of bought rounds terminate on the max-win cap.',
      presentationReason: 'KEEP is also the only rule that matches the art brief — the badge is painted on the lower third of a tower that is standing there for the rest of the round.',
    },
    '4_simulExpandMultipliers': {
      verdict: 'STAYS RETIRED. It is not needed and it must not come back.',
      evidence: 'custom.simulExpandMultipliers no longer exists in src/data/math_vice_heat.json at all (retired in commit 2035566), so --no-simul is already a no-op. Injecting {3:2,4:10} back on top of the recommended badge set measures natural 101.81% vs 96.36% without it (3M rounds, seed 90210) — a 5.5pp overshoot. Two stacked multiplier systems are neither needed to reach target nor affordable.',
    },
  },

  stripChanges: {},
  measured: { fitSeed90210: {}, verifySeed4242424: {} },
  supportingMeasurements: MEASURED_SCALARS,
  caveats: [],
};

if (strips) {
  doc.stripChanges = {
    'reelStrips (base game, 40 stops)': 'UNCHANGED',
    'fsReelStrips (top level — natural AND ante free spins, 1170 stops, 10 wilds + 10 scatters per reel)': 'UNCHANGED. The feature reaches 96% on the strips that are in the repo today.',
    'custom.anteBet.reelStrips (320 stops, 17/17/16/16/16 wilds)': 'UNCHANGED',
    'custom.viceBuyStages[stage 1].fsReelStrips': {
      wasLenPerReel: [405, 405, 405, 405, 405], wasWildsPerReel: [15, 15, 15, 15, 15], wasWildDensityPct: 3.7037,
      nowLenPerReel: stage(1).map(s => s.length), nowWildsPerReel: stage(1).map(wc), nowScattersPerReel: stage(1).map(sc),
      nowWildDensityPct: +(100 * wc(stage(1)[0]) / stage(1)[0].length).toFixed(4),
      how: 'the shipped 405-stop strip repeated x3 (scatter density unchanged at 0.7407%) and re-shuffled with the wild count cut 45 -> 42, i.e. exactly the 14-wilds-per-405 density. The x3 length is kept for two measured reasons: it makes the per-reel search grid 3x finer, and the 1215-stop arrangement measures 96.21% while a 405-stop strip at the IDENTICAL 3.4568% density measures 97.07% (2M rounds each, seed 90210).',
      why: 'the bought 3-scatter round is a per-spin-expansion round on wild-dense strips, so it is where the badge earns the most: at the shipped density it measures 131.07% once badges exist.',
    },
    'custom.viceBuyStages[stage 2].fsReelStrips': {
      wasLenPerReel: [401, 401, 401, 401, 401], wasWildsPerReel: [3, 3, 3, 3, 3], wasWildDensityPct: 0.7481,
      nowLenPerReel: stage(2).map(s => s.length), nowWildsPerReel: stage(2).map(wc), nowScattersPerReel: stage(2).map(sc),
      nowWildDensityPctPerReel: stage(2).map(s => +(100 * wc(s) / s.length).toFixed(4)),
      how: 'the shipped 401-stop strip repeated x6 and re-shuffled; reels 1-4 cut 18 -> 17 wilds (0.7481% -> 0.7066%) and reel 0 raised to 22 (0.9144%).',
      why: 'the sticky round needed a 13pp cut and the 401/1203-stop grids only offer 89.9% or 98.1%. Reel 0 is the fine lever: under the engine evaluator a tower on reel 0 collapses the candidate set to HIGH_A, so reel-0 wilds are worth ~0.3pp each while reel-1 wilds are worth ~6pp each.',
    },
  };
  const sha = a => createHash('sha256').update(JSON.stringify(a)).digest('hex').slice(0, 16);
  doc.stripChanges['custom.viceBuyStages[stage 1].fsReelStrips'].sha256_16PerReel = stage(1).map(sha);
  doc.stripChanges['custom.viceBuyStages[stage 2].fsReelStrips'].sha256_16PerReel = stage(2).map(sha);
  doc.recommendedStripArrays = 'vice_tower_strips_FINAL.json (same directory) — the full stop arrays. SHIP THESE VERBATIM, see caveats.';
}

for (const [k, f] of [['natural', 'final_natural_90210.json'], ['buy3', 'final_buy3_90210.json'], ['buy4', 'final_buy4_90210.json'], ['ante', 'final_ante_90210.json']]) {
  doc.measured.fitSeed90210[k] = slim(pick(f, k));
}
for (const [k, f] of [['natural', 'verify_natural_4242424.json'], ['buy3', 'verify_buy3_4242424.json'], ['buy4', 'verify_buy4_4242424.json'], ['ante', 'verify_ante_4242424.json']]) {
  doc.measured.verifySeed4242424[k] = slim(pick(f, k));
}

doc.caveats = [
  'SHIP THE STOP ARRAYS VERBATIM. At these wild elasticities the ARRANGEMENT of the strip is a first-order lever, not a rounding detail: the same 42-wilds-per-1215-stops multiset re-shuffled four different ways measures 96.19 / 92.47 / 90.56 / 92.61 on buy3, and 18/17/17/17/17-per-2406 measures 94.61 / 98.30 on buy4. The recommended arrays are certified artifacts; regenerating them from the wild counts will NOT reproduce these numbers.',
  'Swapping in the new buy strips must swap reelLengths with them (mockHost.ts:269-281 already does this for the vice buy path, and deriveStops indexes by reelLengths).',
  'The natural and ante fits still include the hot-spin rule (custom.hotSpinChance1In 80), which the manifest itself documents as NOT implemented anywhere in the runtime; it contributes 3.85pp of the natural 96.15% (see rtpAttributionPctOfWager.hot). Measured directly: with hot spins off and the pre-trim 55/19/9/6/11 weights natural drops to 94.50% (8M, seed 90210) from 96.36% with them on. Implementing or dropping hot spins requires a re-fit, exactly as the shipped manifest already warns for the ante.',
  'The 30M-round 99% CI on natural is +/-1.27pp; on ante +/-1.50pp. The two seeds bracket the target from both sides (natural 96.15 fit / 96.48 verify, ante 95.87 fit / 97.19 verify), so the point estimates are trustworthy to roughly half a point, not to a hundredth.',
  'The badge only ever touches free-spin income. Measured natural attribution, before -> after: base 47.82 -> 47.91, hot 3.77 -> 3.85 (both unchanged, as expected), fs3 7.64 -> 14.28, fs4 12.33 -> 30.12. If the base game is ever retuned, this fit is unaffected; if the free-spin strips are retuned, the badge weights must be re-fitted.',
];

writeFileSync(OUT, JSON.stringify(doc, null, 1));
console.log('wrote', OUT);
