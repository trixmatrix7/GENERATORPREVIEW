// Assemble the "bought 4-scatter round always shows a tower" deliverable from
// the measured runs of custom-math/sim_vice_buy4_guarantee.mjs (independent
// re-implementation) and custom-math/xcheck_vice_buy4_guarantee.mjs (the LIVE
// src/game/viceSpin.ts with the guarantee patched in at bundle time).
//
// Every RTP / distribution number below is COPIED from a measured run. Scalars
// that came off a --quiet console line are in MEASURED_SCALARS with the exact
// command that produced them.
//
//   node custom-math/emit_vice_buy4_guarantee.mjs <scratchpadDir> <outPath>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const SP = process.argv[2];
const OUT = process.argv[3];
const load = f => (existsSync(join(SP, f)) ? JSON.parse(readFileSync(join(SP, f), 'utf8')) : null);
const run = f => { const j = load(f); return j ? j.runs[0] : null; };

const A_FIT = run('A_final_seed20260727.json');
const A_VER = run('A_final_seed90210.json');
const B_FIT = run('BASE_seed20260727.json');
const B_VER = run('BASE_seed90210.json');
const XC_FIT = load('xcheck_A_fitseed.json');
const XC_VER = load('xcheck_A_verifyseed.json');
const STRIPS = load('buy4_strips_A.json');
const FS = STRIPS.buyStages.find(s => s.stage === 2).fsReelStrips;

const slim = r => r && ({
  rtpPct: +r.rtpPct.toFixed(3),
  ci99Pp: +r.rtpCi99Pp.toFixed(3),
  rounds: r.rounds,
  seed: r.seed,
  costMultiplierOfBet: +r.costMultiplier.toFixed(2),
  volatilityPerRoundStdXOfBet: +r.perRoundStdXOfBet.toFixed(1),
  volatilityPerRoundStdXOfStake: +r.perRoundStdXOfStake.toFixed(3),
  maxWinRatePct: +r.maxWinRatePct.toFixed(4),
  maxWin1InRounds: r.maxWin1In ? Math.round(r.maxWin1In) : null,
  roundXOfBet: { avg: +r.fs4RoundX.avg.toFixed(2), p50: +r.fs4RoundX.p50.toFixed(2), p90: +r.fs4RoundX.p90.toFixed(1), p99: +r.fs4RoundX.p99.toFixed(1), max: +r.fs4RoundX.max.toFixed(1) },
  towerCountsAtRoundEndPct: r.roundTowerStats.endTowerCountHistPct,
  meanTowersAtRoundEnd: +r.roundTowerStats.meanEndTowers.toFixed(3),
  zeroTowerRoundsPct: r.roundTowerStats.zeroTowerRoundsPct,
  zeroTowerRounds1In: r.roundTowerStats.zeroTowerRounds1In,
  guaranteeFiredInPctOfRounds: r.roundTowerStats.nudgedRoundsPct,
  meanFirstTowerSpinIndex: r.roundTowerStats.meanFirstTowerSpinIdx,
  highestBadgeInRoundHistPct: { '1x': r.roundTowerStats.highestBadgeInRoundHistPct[0], '2x': r.roundTowerStats.highestBadgeInRoundHistPct[1], '3x': r.roundTowerStats.highestBadgeInRoundHistPct[2], '4x': r.roundTowerStats.highestBadgeInRoundHistPct[3], '5x': r.roundTowerStats.highestBadgeInRoundHistPct[4] },
  towersPerFsSpinHistPct: r.featureStats.towersPerFsSpinHistPct,
  fsSpinsShowingAtLeastOneTowerPct: +r.featureStats.fsSpinsWithAnyTowerPct.toFixed(2),
  roundsShowingA5xBadgePct: +r.featureStats.roundsWith5xPct.toFixed(3),
  payWeightedMeanCombinationMultiplier: +r.featureStats.payWeightedMeanCombinationMultiplier.toFixed(3),
  maxWinCapViolations: r.checks.maxWinCapViolations,
});

const slimCore = r => r && ({
  source: r.source,
  rtpPct: +r.rtpPct.toFixed(3),
  ci99Pp: +r.rtpCi99Pp.toFixed(3),
  rounds: r.rounds,
  seed: r.seed,
  towerCountsAtRoundEndPct: r.endTowerCountHistPct,
  meanTowersAtRoundEnd: +r.meanEndTowers.toFixed(3),
  zeroTowerRoundsPct: r.zeroTowerRoundsPct,
  maxWin1InRounds: r.maxWin1In ? Math.round(r.maxWin1In) : null,
  volatilityPerRoundStdXOfBet: +r.perRoundStdXOfBet.toFixed(1),
  invariants: r.checks,
});

// ── console-measured scalars, with the command that produced them ───────────
const CMD = 'node custom-math/sim_vice_buy4_guarantee.mjs --mode=buy4 --buy-rounds=<n> --eval=engine --no-simul --seed=<seed> --guar=<none|first|firstReel0|round> [--nudgew=w0,..,w4] [--b4w=<per-reel wilds>] [--shuf=N] --quiet';
const MEASURED_SCALARS = {
  command: CMD,
  note: 'Tower multipliers are the SHIPPED manifest rule throughout: agg=highest, weights custom.towerMultiplierWeights [55,20,9,6,10], sticky=keep. Engine (column-0) ways evaluator. No simulExpandMultipliers, no hot spins (they never fire on a bought round).',

  mechanismCostOnTheSHIPPEDStrips: {
    note: 'GROSS cost of each mechanism BEFORE any re-fit — same strips (22/17/17/17/17 @2406), same seed 20260727, 500,000 rounds each, 99% CI ±1.10pp.',
    rows: [
      { mechanism: 'none (today)', rtpPct: 96.20, deltaPp: 0.00, zeroTowerRoundsPct: 15.512, towerCountsPct: [15.5, 35.2, 31.7, 14.2, 3.1, 0.3], meanTowers: 1.550, stdXOfBet: 603.5, maxWin1In: 143 },
      { mechanism: '(b) ROUND guarantee — last spin only, only if no tower yet', rtpPct: 96.28, deltaPp: 0.08, zeroTowerRoundsPct: 0.000, towerCountsPct: [0.0, 50.7, 31.7, 14.2, 3.1, 0.3], meanTowers: 1.706, stdXOfBet: 602.8, maxWin1In: 145 },
      { mechanism: '(a) FIRST-SPIN guarantee, nudge pinned to REEL 0', rtpPct: 110.08, deltaPp: 13.88, zeroTowerRoundsPct: 0.000, towerCountsPct: [0.0, 27.8, 41.9, 23.8, 6.0, 0.5], meanTowers: 2.095, stdXOfBet: 668.1, maxWin1In: 109 },
      { mechanism: '(a) FIRST-SPIN guarantee, nudge on a SEED-PICKED reel (uniform 0..4)', rtpPct: 197.86, deltaPp: 101.66, zeroTowerRoundsPct: 0.000, towerCountsPct: [0.0, 25.9, 41.7, 25.1, 6.7, 0.6], meanTowers: 2.144, stdXOfBet: 882.0, maxWin1In: 60 },
    ],
  },

  perReelCostOfAGuaranteedFirstSpinTower: {
    note: 'Same guarantee, nudge PINNED to one reel. 200,000 rounds each, seed 20260727, shipped strips; the guar=none baseline on the identical sample is 96.86%. This is the column-0 evaluator showing up as money: WinEvaluator.ts:120 seeds the candidate set from column 0 and folds a wild there into HIGH_A, so a reel-0 tower COLLAPSES the board to one HIGH_A combination instead of adding one to every symbol.',
    command: CMD + '  (--guar=first --nudgew=<one-hot>)',
    rows: [
      { nudgeReel: 0, rtpPct: 111.32, costPp: 14.46 },
      { nudgeReel: 4, rtpPct: 180.52, costPp: 83.66 },
      { nudgeReel: 2, rtpPct: 214.82, costPp: 117.96 },
      { nudgeReel: 3, rtpPct: 231.44, costPp: 134.58 },
      { nudgeReel: 1, rtpPct: 256.06, costPp: 159.20 },
    ],
    consequence: 'Only a reel-0-pinned nudge is affordable. A uniform seed pick costs 101.7pp gross and, once re-fitted, leaves the round with a WORSE tower distribution than doing nothing (see mechanismComparisonAt96Pct row D).',
  },

  densityOnlySweep: {
    note: '(c) NO RULE — raise the wild count on reel 0 only (the cheap reel) and read off what P(zero towers) costs. 300,000 rounds each, seed 20260727, reels 1-4 held at 17 wilds.',
    command: CMD + '  (--guar=none --b4w=<r0>,17,17,17,17)',
    rows: [
      { reel0Wilds: 22, reel0WildStopsPct: 0.91, pWindowHasWildPct: 4.57, rtpPct: 96.51, zeroTowerRoundsPct: 15.542, meanTowers: 1.550 },
      { reel0Wilds: 60, reel0WildStopsPct: 2.49, rtpPct: 106.52, zeroTowerRoundsPct: 6.989, meanTowers: 1.895 },
      { reel0Wilds: 110, reel0WildStopsPct: 4.57, rtpPct: 112.34, zeroTowerRoundsPct: 2.386, meanTowers: 2.081 },
      { reel0Wilds: 170, reel0WildStopsPct: 7.07, rtpPct: 115.29, zeroTowerRoundsPct: 0.678, meanTowers: 2.149 },
      { reel0Wilds: 230, reel0WildStopsPct: 9.56, rtpPct: 116.58, zeroTowerRoundsPct: 0.179, meanTowers: 2.169 },
      { reel0Wilds: 260, reel0WildStopsPct: 10.81, rtpPct: 116.80, zeroTowerRoundsPct: 0.083, meanTowers: 2.173 },
    ],
    whatAcceptablySmallCosts: 'The curve SATURATES. 0.68% zero-tower rounds costs +18.8pp gross; 0.18% costs +20.1pp; 0.083% costs +20.3pp — and 0% is unreachable at any density, because P(zero towers) = P(no wild in any 5-row window)^10 is strictly positive. Buying the last factor of 8 (0.68% -> 0.083%) costs 1.5pp and needs reel 0 to carry 260 of 2406 stops as wilds: 10.8% of the reel, up from 0.91%. That drags reel 0 paying symbols from 98.34% to 88.44% of the strip, i.e. it violates the "keep the paying-symbol mix close" constraint far harder than the 1-2 wilds the rule-based options need.',
  },

  payingSymbolElasticity: {
    note: 'How much RTP one wild per reel is worth on the buy4 stage — the lever used to pay for each mechanism. 300,000 rounds each, seed 20260727, guar=none, reel 0 held at 22.',
    command: CMD + '  (--guar=none --b4w=22,W,W,W,W)',
    rows: [
      { reels1to4Wilds: 17, rtpPct: 96.51, zeroTowerRoundsPct: 15.542, meanTowers: 1.550 },
      { reels1to4Wilds: 16, rtpPct: 85.85, zeroTowerRoundsPct: 16.929, meanTowers: 1.490 },
      { reels1to4Wilds: 15, rtpPct: 75.48, zeroTowerRoundsPct: 18.431, meanTowers: 1.428 },
      { reels1to4Wilds: 14, rtpPct: 66.04, zeroTowerRoundsPct: 20.077, meanTowers: 1.363 },
      { reels1to4Wilds: 13, rtpPct: 56.69, zeroTowerRoundsPct: 21.842, meanTowers: 1.298 },
      { reels1to4Wilds: 12, rtpPct: 48.70, zeroTowerRoundsPct: 23.773, meanTowers: 1.231 },
      { reels1to4Wilds: 10, rtpPct: 36.91, zeroTowerRoundsPct: 27.254, meanTowers: 1.123 },
    ],
    reading: 'About 10.5pp per wild REMOVED from all four of reels 1-4, but only 0.06 mean towers. Thinning is 175x cheaper in towers than in RTP — which is exactly why spending RTP on a guaranteed tower and paying it back with density is a net win for the distribution.',
  },

  refitSearch: {
    note: 'Landing each mechanism back on 96% by re-cutting the stage-2 wild counts. 1,500,000-2,000,000 rounds, seed 20260727.',
    command: CMD,
    rows: [
      { mechanism: 'firstSpin/reel0', b4Wilds: '22,16,16,16,16', rtpPct: 98.60, rounds: 300000 },
      { mechanism: 'firstSpin/reel0', b4Wilds: '22,16,16,16,15', rtpPct: 95.88, rounds: 1500000 },
      { mechanism: 'firstSpin/reel0', b4Wilds: '24,16,16,16,15', rtpPct: 96.28, rounds: 2000000, chosen: true },
      { mechanism: 'firstSpin/reel0', b4Wilds: '26,16,16,16,15', rtpPct: 96.49, rounds: 2000000 },
      { mechanism: 'firstSpin/reel0', b4Wilds: '34,16,16,16,15', rtpPct: 96.79, rounds: 1000000 },
      { mechanism: 'firstSpin/reel0', b4Wilds: '22,16,16,16,15 --shuf=1 (SAME multiset, different arrangement)', rtpPct: 99.21, rounds: 1000000 },
      { mechanism: 'firstSpin/uniform-seed-pick', b4Wilds: '22,9,9,10,10', rtpPct: 97.30, rounds: 300000 },
      { mechanism: 'density only', b4Wilds: '260,16,15,15,15', rtpPct: 94.70, rounds: 300000 },
      { mechanism: 'density only', b4Wilds: '260,16,15,15,16', rtpPct: 96.79, rounds: 1500000 },
      { mechanism: 'density only', b4Wilds: '230,16,15,15,15', rtpPct: 94.31, rounds: 1500000 },
    ],
    arrangementIsAFirstOrderLever: 'The same multiset 22/16/16/16/15 measures 95.88% with shuffle seed 0 and 99.21% with shuffle seed 1 (1.0-1.5M rounds, 99% CI ~0.6-0.8pp). The stop arrays therefore CANNOT be regenerated from wild counts and are shipped verbatim below.',
  },

  mechanismComparisonAt96Pct: {
    note: 'Each mechanism re-fitted to 96% and then measured on the VERIFICATION seed 90210, 2,000,000 rounds (A: 4,000,000). This is the apples-to-apples comparison: identical price (200x bet), identical RTP band, only the feel differs.',
    rows: [
      { id: 'today', mechanism: 'none', b4Wilds: '22,17,17,17,17 (shipped)', rtpPct: 96.23, ci99Pp: 0.55, rounds: 2000000, zeroTowerRoundsPct: 15.481, towerCountsPct: [15.5, 35.2, 31.8, 14.2, 3.2, 0.3], meanTowers: 1.552, stdXOfBet: 602.8, maxWin1In: 146 },
      { id: 'B', mechanism: '(b) ROUND guarantee', b4Wilds: '22,17,17,17,17 (shipped, NO re-fit needed)', rtpPct: 96.33, ci99Pp: 0.55, rounds: 2000000, zeroTowerRoundsPct: 0.000, towerCountsPct: [0.0, 50.6, 31.8, 14.2, 3.2, 0.3], meanTowers: 1.706, stdXOfBet: 601.5, maxWin1In: 146 },
      { id: 'A', mechanism: '(a) FIRST-SPIN guarantee, reel 0  ** RECOMMENDED **', b4Wilds: '24,16,16,16,15', rtpPct: 96.08, ci99Pp: 0.39, rounds: 4000000, zeroTowerRoundsPct: 0.000, towerCountsPct: [0.0, 30.49, 42.15, 21.88, 5.06, 0.42], meanTowers: 2.028, stdXOfBet: 611.1, maxWin1In: 138 },
      { id: 'C', mechanism: '(c) DENSITY only, no rule', b4Wilds: '260,16,15,15,16', rtpPct: 96.52, ci99Pp: 0.57, rounds: 2000000, zeroTowerRoundsPct: 0.092, towerCountsPct: [0.1, 28.2, 41.9, 23.4, 5.8, 0.5], meanTowers: 2.081, stdXOfBet: 623.3, maxWin1In: 128 },
      { id: 'D', mechanism: '(a) FIRST-SPIN guarantee, uniform seed-picked reel', b4Wilds: '22,9,9,10,10', rtpPct: 97.17, ci99Pp: 0.48, rounds: 2000000, zeroTowerRoundsPct: 0.000, towerCountsPct: [0.0, 40.3, 41.8, 15.4, 2.4, 0.1], meanTowers: 1.803, stdXOfBet: 529.2, maxWin1In: 237 },
    ],
    verdict: 'A wins on every axis that matters and is the only option that is both exactly 0% zero-tower and distribution-positive. B is 170x cheaper per removed zero-tower round, but at a matched 96% it buys only +0.15 mean towers and it hands the tower over on the LAST spin, where it can no longer earn anything — and always on the last spin, which is its own tell. C never actually reaches 0 (1 in 1090 rounds still shows nothing), needs reel 0 to be 10.8% wilds, and costs volatility (max win rarer: 1-in-128 vs 1-in-146). D pays 101.7pp for a prettier nudge and then has to strip reels 1-4 from 17 wilds to 9-10 to afford it, which leaves the WORST distribution of the four and pushes the max win from 1-in-146 out to 1-in-237.',
  },
};

const sha = createHash('sha256').update(JSON.stringify(FS)).digest('hex').slice(0, 16);

const doc = {
  task: 'Vice Heat — make the BOUGHT 4-scatter round (costMult 200) always deliver at least one wild tower, and re-fit it to 96% RTP.',
  producedBy: [
    'custom-math/sim_vice_buy4_guarantee.mjs — NEW. Byte-copy of custom-math/sim_vice_towermult.mjs (itself a copy of the runtime-faithful custom-math/sim_vice.mjs) plus the guarantee mechanisms and per-ROUND tower bookkeeping. Neither original was modified.',
    'custom-math/xcheck_vice_buy4_guarantee.mjs — NEW. Drives the LIVE src/game/viceSpin.ts, with the guarantee inserted into the source TEXT by an esbuild onLoad plugin at bundle time. The inserted block is the proposed runtime patch verbatim (node custom-math/xcheck_vice_buy4_guarantee.mjs --show-patch).',
    'custom-math/emit_vice_buy4_guarantee.mjs — NEW. This assembler.',
  ],
  parityCheck: 'With --guar=none the new simulator reproduces custom-math/sim_vice_towermult.mjs exactly: buy4, 200,000 rounds, seed 20260727, --agg=highest --w=55,20,9,6,10 --sticky=keep -> 96.86% in both, identical tower histogram.',
  evaluator: 'ENGINE ONLY. WinEvaluator.ts:120 seeds the ways candidate set from column 0 and folds a column-0 WILD into HIGH_A; SlotGame.sol:341 does the identical thing. A full wild reel pays ONE combination at the wild/HIGH_A rate. Every number here was measured that way; --eval=corrected was never used.',
  ruleSetModelled: {
    towerMultipliers: 'LIVE. Every reel standing fully wild in a free spin is dealt a badge 1x-5x from custom.towerMultiplierWeights [55,20,9,6,10]; a combination pays x the HIGHEST badge among the reels it crosses; scatter pay is never multiplied; nothing stacks on the 5-wild instant max win; a sticky tower KEEPS the badge it was dealt when it joined.',
    simulExpandMultipliers: 'absent from the manifest — never applied',
    hotSpins: 'never fire on a bought round',
    stickyTowerCap: 5, stickyRoundSpins: 10, stickyRoundCap: 13, retriggerSpins: 3, maxWinMultiplier: 5000,
    costMult: 200,
  },

  problem: {
    statement: 'The bought 4-scatter round is sold as a STICKY TOWER round but its FS strips are deliberately thin, so a large share of rounds finish with no tower at all.',
    measuredOnTheShippedStrips: {
      stopsPerReel: 2406,
      wildsPerReel: [22, 17, 17, 17, 17],
      pWindowCarriesAWildPct: [4.572, 3.408, 3.533, 3.367, 3.367],
      pNoWildOnAnyReelPerSpinPct: 83.033,
      analyticZeroTowerRoundsPct: 15.578,
      simulatedZeroTowerRoundsPct: B_VER ? B_VER.roundTowerStats.zeroTowerRoundsPct : null,
      liveCoreZeroTowerRoundsPct: 15.579,
      zeroTowerRounds1In: 6.4,
      note: 'The analytic P(no wild in any of the five 5-row windows)^10 = 15.578% and the LIVE core measured 15.579% over 300,000 rounds — the model of the round is exact.',
    },
    beforeTowerDistribution: {
      seed20260727: B_FIT ? { rounds: B_FIT.rounds, towerCountsAtRoundEndPct: B_FIT.roundTowerStats.endTowerCountHistPct, meanTowers: +B_FIT.roundTowerStats.meanEndTowers.toFixed(3), zeroTowerRoundsPct: B_FIT.roundTowerStats.zeroTowerRoundsPct, rtpPct: +B_FIT.rtpPct.toFixed(3), ci99Pp: +B_FIT.rtpCi99Pp.toFixed(3) } : null,
      seed90210: B_VER ? { rounds: B_VER.rounds, towerCountsAtRoundEndPct: B_VER.roundTowerStats.endTowerCountHistPct, meanTowers: +B_VER.roundTowerStats.meanEndTowers.toFixed(3), zeroTowerRoundsPct: B_VER.roundTowerStats.zeroTowerRoundsPct, rtpPct: +B_VER.rtpPct.toFixed(3), ci99Pp: +B_VER.rtpCi99Pp.toFixed(3) } : null,
    },
  },

  recommendation: {
    id: 'A',
    name: 'FIRST-SPIN GUARANTEE, nudge pinned to reel 0',
    oneLine: 'On free spin 1 of a bought 4-scatter round, if no reel would expand, reel 0\'s stop slides FORWARD to the nearest stop whose 5-row window carries a wild. Nothing else changes.',
    spec: [
      'SCOPE: the bought 4-scatter stage only (custom.viceBuyStages[stage=2]). A NATURAL 4-scatter trigger is left alone, so no other certified round moves.',
      'WHEN: the first free spin of the round only — fsSpins.length === 0 — and only if NO reel would expand, i.e. no reel\'s 5-row window on the stage FS strips contains a WILD. Measured fire rate: 83.59% of bought rounds (= P(no wild anywhere) on the new strips).',
      'WHAT: reel 0\'s stop is advanced to the FIRST stop at or after it (modulo the 2406-stop strip) whose 5-row window contains a WILD. Forward scan, exactly the scan mockHost.forceScatterStops / viceSpin.forceScatterStops already use to place the bought trigger board.',
      'DETERMINISM: the nudge is a pure function of the free spin\'s stops, which are a pure function of `randomness` — no new randomness is consumed and no previously certified board changes anywhere else. Verified 0/2000 non-deterministic replays on the live core.',
      'WHICH REEL: reel 0, fixed. This is not cosmetic. Measured cost of a guaranteed first-spin tower, per reel: reel0 +14.5pp, reel4 +83.7pp, reel2 +118.0pp, reel3 +134.6pp, reel1 +159.2pp. The engine\'s column-0 rule is what makes reel 0 cheap: a full wild reel 0 collapses the candidate set to a single HIGH_A combination instead of adding a way to every symbol. Reel 0 is the only reel whose tower the round can afford to give away.',
      'PRICE: costMult stays 200. The 13.9pp gross cost is paid back by cutting reels 1-4 from 17/17/17/17 wilds to 16/16/16/15 and adding 2 wilds to reel 0 (22 -> 24). Scatters stay 18 per reel, strip length stays 2406, the paying-symbol proportions of each reel are preserved (each reel keeps its own current mix; the removed/added stops are taken from whichever paying symbol is furthest above its current share).',
    ],
    runtimePatch: {
      file: 'src/game/viceSpin.ts',
      insertAfter: 'const fsStops = deriveStops(seed, fsStrips);   // top of the free-spin while loop',
      code: [
        'if (sticky && buyStage?.guaranteedTowerOnFirstSpin && fsSpins.length === 0) {',
        '  const windowHasWild = (reel: number, stop: number): boolean => {',
        '    const strip = fsStrips[reel];',
        '    for (let row = 0; row < rows; row++) {',
        '      if (strip[(stop + row) % strip.length] === SymbolId.WILD) return true;',
        '    }',
        '    return false;',
        '  };',
        '  let anyWild = false;',
        '  for (let r = 0; r < reels; r++) if (windowHasWild(r, fsStops[r])) { anyWild = true; break; }',
        '  if (!anyWild) {',
        '    const reel = buyStage.guaranteedTowerReel ?? 0;',
        '    const len = fsStrips[reel].length;',
        '    for (let off = 0; off < len; off++) {',
        '      const pos = (fsStops[reel] + off) % len;',
        '      if (windowHasWild(reel, pos)) { fsStops[reel] = pos; break; }',
        '    }',
        '  }',
        '}',
      ].join('\n'),
      note: 'This exact block was compiled into src/game/viceSpin.ts by custom-math/xcheck_vice_buy4_guarantee.mjs and the numbers under measured.liveCore were produced by it. Print it with --show-patch.',
    },
    manifestKeys: {
      'custom.viceBuyStages[stage=2].guaranteedTowerOnFirstSpin': true,
      'custom.viceBuyStages[stage=2].guaranteedTowerReel': 0,
      'custom.viceBuyStages[stage=2].fsReelStrips': 'the arrays in fsReelStrips below, VERBATIM',
    },
    presentationNote: 'The nudge fires in 83.6% of bought rounds and always on reel 0, so a reel-0 tower on free spin 1 becomes the signature of the bought round. Sell it that way ("your bought round OPENS with a tower") rather than hiding it — a promise the player can see kept is the opposite of the tell Noski objected to.',
  },

  fsReelStripsRule: 'buy4 BOUGHT round, stage 2: its own 2406-stop FS strips, 24/16/16/16/15 wilds and 18 scatters per reel, re-fitted together with the first-spin reel-0 tower guarantee and the tower multipliers. Ship the stop arrays VERBATIM — at this wild density the ARRANGEMENT is a first-order lever (the same 22/16/16/16/15 multiset measured 95.88% in one shuffle and 99.21% in another), so they cannot be regenerated from the wild counts.',
  fsReelStrips: FS,
  fsReelStripsFacts: {
    sha256_16: sha,
    stopsPerReel: FS.map(s => s.length),
    wildsPerReel: FS.map(s => s.filter(v => v === 0).length),
    scattersPerReel: FS.map(s => s.filter(v => v === 1).length),
    pWindowCarriesAWildPct: [4.988, 3.200, 3.325, 3.159, 2.951],
    pNoWildOnAnyReelPerSpinPct: 83.564,
    guaranteeFireRatePct: 83.564,
    zeroTowerRoundsWITHOUTTheGuaranteePct: 16.604,
    symbolIds: '0 WILD, 1 SCATTER, 2 highA, 3 highB, 4 midC, 5 midD, 6 lowE, 7 lowF, 8 lowG',
    reelMixPct: FS.map(s => {
      const c = {}; for (const v of s) c[v] = (c[v] ?? 0) + 1;
      return Object.fromEntries(Object.keys(c).map(Number).sort((a, b) => a - b).map(k => [k, +(100 * c[k] / s.length).toFixed(2)]));
    }),
    unchanged: 'payTable, scatterPay, the base reelStrips, the top-level fsReelStrips, the ante strips and the buy3 (stage 1) strips are NOT touched.',
  },

  measured: {
    independentSimulator: {
      fitSeed: slim(A_FIT),
      verificationSeed: slim(A_VER),
    },
    liveCore: {
      note: 'src/game/viceSpin.ts itself, with the patch above compiled in and the strips above loaded. Different randomness plumbing than the simulator (keccak badge draws vs a separate sfc32 stream), so agreement here is a real cross-check, not a tautology.',
      fitSeed: slimCore(XC_FIT),
      verificationSeed: slimCore(XC_VER),
    },
    agreement: {
      simulatorVsLiveCore_towerDistribution: 'sim [0, 30.49, 42.16, 21.88, 5.04, 0.43] vs live core [0, 30.50, 42.14, 21.86, 5.06, 0.44] — equal to 0.02pp on every bucket.',
      simulatorVsLiveCore_rtp: 'sim 96.22% ±0.39 (4M, fit seed) vs live core 96.53% ±0.79 (1M, fit seed); sim 96.08% ±0.39 vs live core 95.99% ±0.79 (verification seed). All four confidence intervals overlap and all four sit inside 96% ±1pp.',
    },
  },

  towerDistributionBeforeAfter: {
    note: 'Share of bought rounds that END with N sticky towers standing, N = 0..5. Both rows at 96% RTP and costMult 200, verification seed 90210.',
    before: { config: 'shipped strips, no guarantee', rounds: B_VER ? B_VER.rounds : null, pct: B_VER ? B_VER.roundTowerStats.endTowerCountHistPct : null, meanTowers: B_VER ? +B_VER.roundTowerStats.meanEndTowers.toFixed(3) : null, rtpPct: B_VER ? +B_VER.rtpPct.toFixed(2) : null },
    after: { config: 'first-spin reel-0 guarantee + re-fitted strips', rounds: A_VER ? A_VER.rounds : null, pct: A_VER ? A_VER.roundTowerStats.endTowerCountHistPct : null, meanTowers: A_VER ? +A_VER.roundTowerStats.meanEndTowers.toFixed(3) : null, rtpPct: A_VER ? +A_VER.rtpPct.toFixed(2) : null },
    zeroTowerRoundsPct: { before: B_VER ? B_VER.roundTowerStats.zeroTowerRoundsPct : null, after: A_VER ? A_VER.roundTowerStats.endTowerCountHistPct[0] : null },
    alsoImproved: 'Every free spin of every bought round now shows at least one tower (fsSpinsShowingAtLeastOneTowerPct 100.00%, was 58.75%), a 5x badge lands in 18.92% of bought rounds (was 14.68%), and the pay-weighted mean combination multiplier rises from 2.840x to 3.028x — all at the same 96% and the same 200x price.',
  },

  isolationCheck: {
    note: 'The stage-2 fsReelStrips are read ONLY by the bought 4-scatter round (viceSpin.ts:375 `buyStage?.fsReelStrips ?? config.fsReelStrips`), and the guarantee is gated on the stage-2 flag. Measured, not just argued: natural / buy3 / ante run bit-identical with the change in and out.',
    command: 'node custom-math/sim_vice_buy4_guarantee.mjs 300000 --mode=natural,buy3,ante --buy-rounds=300000 --eval=engine --no-simul --hot --seed=20260727 --guar=<firstReel0|none> [--b4w=24,16,16,16,15] --quiet',
    rows: [
      { mode: 'natural', withChangeRtpPct: 104.21, withoutChangeRtpPct: 104.21, ci99Pp: 15.74, rounds: 300000 },
      { mode: 'buy3', withChangeRtpPct: 96.16, withoutChangeRtpPct: 96.16, ci99Pp: 1.27, rounds: 300000 },
      { mode: 'ante', withChangeRtpPct: 102.99, withoutChangeRtpPct: 102.99, ci99Pp: 10.43, rounds: 300000 },
    ],
    reading: 'Identical to every printed digit including hit frequency, volatility and max-win rate — the three other round types do not move. (These 300k-round RTPs are small-sample readings of the high-variance modes, not certifications; the point is that both columns are the same number.)',
  },

  mechanismsMeasured: MEASURED_SCALARS,

  couldNotAchieve: [
    'The guarantee is NOT in the shipped TypeScript yet. It was measured by compiling the patch above into src/game/viceSpin.ts in memory (esbuild onLoad plugin) — no repo file was modified, per the task constraint. Applying the patch and setting the two manifest keys is the remaining work.',
    'Density-only (mechanism c) cannot reach 0% zero-tower rounds at any density: P(zero towers) = P(no wild in any window)^10 is strictly positive. The best measured was 0.083% (1 in 1200) at 260 wilds on reel 0, and that costs +20.3pp gross plus a reel-0 mix that is 10.8% wilds.',
    'At 2406 stops one wild is a coarse step (~2.6-3.6pp on reels 1-4), so the fit is centred by the reel-0 count and the shuffle arrangement rather than by a fine density dial. Landing exactly on 96.00 would need either longer strips or a chosen shuffle; the shipped fit measures 96.08-96.53% across four independent runs.',
  ],
};

writeFileSync(OUT, JSON.stringify(doc, null, 1));
console.log(`wrote ${OUT}`);
console.log(`fsReelStrips sha256:16 ${sha}  wilds ${doc.fsReelStripsFacts.wildsPerReel.join('/')}  scat ${doc.fsReelStripsFacts.scattersPerReel.join('/')}  len ${doc.fsReelStripsFacts.stopsPerReel.join('/')}`);
