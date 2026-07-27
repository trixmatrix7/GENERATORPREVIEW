// VICE HEAT — the ONE deterministic round derivation (math core).
//
// 5×5 / 3125 WAYS + EXPANDING WILDS:
//   • base spin: plain ways evaluation on the base strips (ante spins swap in
//     the 3×-scatter ante strips, a staged buy FORCES its scatter count).
//   • HOT SPIN: 1-in-`hotSpinChance1In` NATURAL or ANTE base spins run in
//     per-spin expansion mode — every wild-carrying reel becomes a full wild
//     tower BEFORE evaluation. Expanded reels carry no scatters any more, so a
//     hot spin can SUPPRESS a trigger; that is the certified behaviour. Never
//     on a bought round (it would expand over the forced scatters and erase the
//     trigger the player paid for).
//   • 3 scatters → per-spin expansion free spins; 4+ scatters → STICKY towers
//     (the first `stickyTowerCap` wild-landing reels stand for the rest of the
//     round). 5 full wild reels = INSTANT MAX WIN (fullBoardInstantMaxWin).
//   • Retrigger ≥3 scatters → +`retriggerSpins`. Hard session cap at
//     `maxWinMultiplier` × bet — the round STOPS the moment it is reached.
//
// `custom.simulExpandMultipliers` is DELIBERATELY NOT APPLIED: the certification
// retired the simultaneous-expansion ladder ({3:2, 4:10}). It stays in the
// manifest for the record; the round derivation ignores it.
//
// PURE and seed-deterministic: same (randomness, bet, config, stageCode) ⇒ same
// round. Settlement (mockHost.settleVice), the decode façade (decodeVice) and
// the presentation all call THIS function, so display-math == settlement-math by
// construction — the round can never be re-invented with a second RNG stream.
// Ways evaluation goes through the winEval façade, which routes 'ways' to the
// CORRECTED evaluator (src/game/viceWays.ts).

import { keccak256, encodeAbiParameters } from 'viem';
import { SymbolId } from '@/config/symbols';
import type { WinResult } from '@/engine/WinEvaluator';
import type { GameConfig } from '@/engine/GameConfig';
import { evalWins } from './winEval';

/** A staged Vice buy (custom.viceBuyStages[]) — a bought round may override the
 *  round shape (strips, spin count, caps, tower cap) for tail calibration. */
export interface ViceBuyStage {
  stage: number;
  scatters: number;
  costMult: number;
  fsReelStrips?: number[][];
  freeSpinsCount?: number;
  fsCap?: number;
  retriggerSpins?: number;
  stickyTowerCap?: number;
  stickyFullBoardMultiplier?: number;
}

/** Everything the round derivation reads off the active GameConfig. The Vice
 *  extras are mapped from the manifest's `custom` block by
 *  mathProfiles.fromManifest. */
export interface ViceMathConfig extends Pick<GameConfig, 'gridConfig' | 'payTable' | 'scatterPay'> {
  reelStrips: ReadonlyArray<ReadonlyArray<number>>;
  /** FS strips for NATURAL triggers (rare wilds — a full board is a jackpot). */
  fsReelStrips?: ReadonlyArray<ReadonlyArray<number>>;
  freeSpinsCount: number;
  freeSpinsCap: number;
  freeSpinsMultiplier: number;
  maxWinMultiplier: number;
  expandingWildsInFS?: boolean;
  stickyTowerCap?: number;
  stickyRoundSpins?: number;
  stickyRoundCap?: number;
  retriggerSpins?: number;
  stickyFullBoardMultiplier?: number;
  fullBoardInstantMaxWin?: boolean;
  /** HOT SPIN: 1-in-N base spins play in per-spin expansion mode. */
  hotSpinChance1In?: number;
  hotSpinExpandsWilds?: boolean;
  viceBuyStages?: ViceBuyStage[];
  anteBet?: { costMult: number; reelStrips: number[][] };
}

// ── types the presentation replays ─────────────────────────────────────────

/** One settled spin — base or free. Everything the presentation needs to REPLAY
 *  exactly what settlement scored. */
export interface ViceSpin {
  /** Stops on the strips in force for THIS spin (base / ante / FS / bought FS). */
  stops: number[];
  /** Board AS LANDED, before any wild expansion — what the reels stop on. */
  board: number[][];
  /** Board AS EVALUATED — expanded reels overwritten to full wild towers.
   *  Identical to `board` when nothing expanded. */
  evalBoard: number[][];
  /** Reels standing FULLY WILD for this spin (ascending): hot expansion, the
   *  3-scatter per-spin expansion, or the standing sticky towers. */
  expandedReels: number[];
  /** Subset of `expandedReels` that are PERMANENT towers (4+ scatter round), in
   *  JOIN order — index 0 is the tower that locked in first, so the
   *  presentation can tell a NEW tower from ones already standing. */
  stickyReels: number[];
  /** Scatters on the EVALUATED board — expanded reels carry none. */
  scatters: number;
  /** Base spin only: this spin rolled HOT (per-spin expansion in the base game). */
  hot: boolean;
  /** Free spin only: this spin re-awarded free spins (≥3 scatters). */
  retriggered: boolean;
  /** 5 full wild reels + fullBoardInstantMaxWin — this spin pays the max win. */
  instantMaxWin: boolean;
  /** Evaluation of `evalBoard` at the base bet — the combos to highlight. */
  winResult: WinResult;
  /** The spin's win after its own multipliers, BEFORE the session cap. */
  rawWin: bigint;
  /** What the round actually CREDITED for this spin (clamped by the remaining
   *  session cap). base.credited + Σ fsSpins.credited === totalWin, exactly. */
  credited: bigint;
}

export interface ViceRound {
  base: ViceSpin;
  fsTriggered: boolean;
  /** 4+ scatters → STICKY tower round; 3 scatters → per-spin expansion round. */
  sticky: boolean;
  /** Tower cap in force for a sticky round (0 when not sticky). */
  stickyTowerCap: number;
  fsSpins: ViceSpin[];
  totalWin: bigint;
  /** The session cap (maxWinMultiplier × bet) was reached — the round stopped. */
  capped: boolean;
  /** 0 = natural, 1 = bought 3sc, 2 = bought 4sc, 3 = ante spin. */
  stageCode: number;
}

// ── seed chain (identical to mockHost's) ───────────────────────────────────

/** keccak256(abi.encode(bytes32 randomness, uint256 index)) — the same per-spin
 *  seed chain mockHost/SlotGame.sol use for free spins. */
function spinSeed(randomness: `0x${string}`, index: bigint): `0x${string}` {
  return keccak256(
    encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [randomness, index]),
  );
}

/** Reserved seed index for the HOT-SPIN roll. Free-spin indices run 0…fsCap-1
 *  (≤ 13), so 2^64 can never collide with a free spin's seed. */
const HOT_SEED_INDEX = 1n << 64n;

/** Stops from a seed against THIS strip set's lengths — mirrors
 *  mockHost.deriveStops (sequential mod/div over the in-force reelLengths). */
function deriveStops(seed: `0x${string}`, strips: ReadonlyArray<ReadonlyArray<number>>): number[] {
  let s = BigInt(seed);
  const stops: number[] = [];
  for (let i = 0; i < strips.length; i++) {
    const len = BigInt(strips[i].length);
    stops.push(Number(s % len));
    s = s / len;
  }
  return stops;
}

function boardFromStops(
  stops: number[],
  strips: ReadonlyArray<ReadonlyArray<number>>,
  rows: number,
): number[][] {
  const board: number[][] = [];
  for (let row = 0; row < rows; row++) {
    const r: number[] = [];
    for (let reel = 0; reel < strips.length; reel++) {
      const strip = strips[reel];
      r.push(strip[(stops[reel] + row) % strip.length]);
    }
    board.push(r);
  }
  return board;
}

/** FORCE a board with exactly `want` scatters for a staged buy — mirrors
 *  mockHost.forceScatterStops byte for byte: reels are picked by a seeded
 *  shuffle off the randomness tail, each scatter reel's stop slides forward to
 *  the nearest window with EXACTLY one scatter, every other reel to the nearest
 *  scatter-free window. */
function forceScatterStops(
  stops: number[],
  randomness: `0x${string}`,
  want: number,
  strips: ReadonlyArray<ReadonlyArray<number>>,
  rows: number,
): number[] {
  const reels = strips.length;
  const windowScatters = (reel: number, stop: number): number => {
    const strip = strips[reel];
    let n = 0;
    for (let row = 0; row < rows; row++) if (strip[(stop + row) % strip.length] === SymbolId.SCATTER) n++;
    return n;
  };
  let seed = BigInt(randomness) >> 128n;
  const order = Array.from({ length: reels }, (_, i) => i);
  for (let i = reels - 1; i > 0; i--) {
    const j = Number(seed % BigInt(i + 1));
    seed >>= 8n;
    [order[i], order[j]] = [order[j], order[i]];
  }
  const scatterReels = new Set(order.slice(0, want));
  const out = [...stops];
  for (let reel = 0; reel < reels; reel++) {
    const target = scatterReels.has(reel) ? 1 : 0;
    const len = strips[reel].length;
    for (let off = 0; off < len; off++) {
      const pos = (stops[reel] + off) % len;
      if (windowScatters(reel, pos) === target) { out[reel] = pos; break; }
    }
  }
  return out;
}

/** Does this reel carry at least one WILD in its visible window? */
function reelHasWild(board: number[][], reel: number): boolean {
  for (let row = 0; row < board.length; row++) if (board[row][reel] === SymbolId.WILD) return true;
  return false;
}

/** Overwrite a reel into a full wild tower (scatters on it are lost — that is
 *  why an expansion can suppress a trigger). */
function makeFullWild(board: number[][], reel: number): void {
  for (let row = 0; row < board.length; row++) board[row][reel] = SymbolId.WILD;
}

/** Every reel of the board standing fully wild? */
function fullWildReelCount(board: number[][], reels: number): number {
  let n = 0;
  for (let reel = 0; reel < reels; reel++) {
    let all = true;
    for (let row = 0; row < board.length; row++) if (board[row][reel] !== SymbolId.WILD) { all = false; break; }
    if (all) n++;
  }
  return n;
}

/** True when this profile carries the Vice custom rule set (expanding wilds in
 *  free spins). The generic ways profiles (vol3-5x3, vol3-5x5, fantasy) do not,
 *  so they keep the engine's plain ways settlement. */
export function isViceMathConfig(config: unknown): boolean {
  return !!(config as ViceMathConfig | null)?.expandingWildsInFS;
}

/** THE round derivation — settlement, decode façade and presentation all call
 *  this. `stageCode`: 0 = natural, 1 = bought 3sc, 2 = bought 4sc, 3 = ante. */
export function deriveViceRound(
  randomness: `0x${string}`,
  bet: bigint,
  config: ViceMathConfig,
  stageCode = 0,
): ViceRound {
  const rows = config.gridConfig.visibleRows;
  const reels = config.reelStrips.length;
  const maxWin = bet * BigInt(config.maxWinMultiplier ?? 5000);
  const expandFS = !!config.expandingWildsInFS;
  const buyStage = config.viceBuyStages?.find(st => st.stage === stageCode);
  const isAnte = stageCode === 3 && !!config.anteBet;

  // ── 1. BASE SPIN ─────────────────────────────────────────────────────────
  // An ante spin runs on the 3×-scatter ante strips for THIS spin only; the FS
  // round inside it goes back to the normal strips (mirrors mockHost).
  const baseStrips: ReadonlyArray<ReadonlyArray<number>> =
    isAnte ? config.anteBet!.reelStrips : config.reelStrips;
  let stops = deriveStops(randomness, baseStrips);
  if (buyStage) stops = forceScatterStops(stops, randomness, buyStage.scatters, baseStrips, rows);
  const board = boardFromStops(stops, baseStrips, rows);
  const evalBoard = board.map(r => [...r]);

  // HOT SPIN — NATURAL and ANTE spins only. A bought round must never go hot:
  // the expansion would run over the FORCED scatters and erase the trigger the
  // player paid for.
  const hotChance = config.hotSpinChance1In ?? 0;
  const hot = !buyStage && !!config.hotSpinExpandsWilds && hotChance > 0
    && BigInt(spinSeed(randomness, HOT_SEED_INDEX)) % BigInt(hotChance) === 0n;
  const hotReels: number[] = [];
  if (hot) {
    for (let reel = 0; reel < reels; reel++) {
      if (reelHasWild(evalBoard, reel)) { makeFullWild(evalBoard, reel); hotReels.push(reel); }
    }
  }

  const baseInstantMax = hot && hotReels.length >= reels && !!config.fullBoardInstantMaxWin;
  const baseEval = evalWins(evalBoard, bet, config);
  const scatterCount = baseEval.scatterCount;
  // NOTE: custom.simulExpandMultipliers is NOT applied — retired by the
  // certification. A hot spin pays its natural ways win, nothing more.
  const baseRaw = baseInstantMax ? maxWin : baseEval.totalWin;

  let totalWin = baseRaw > maxWin ? maxWin : baseRaw;
  let capped = totalWin >= maxWin;
  const base: ViceSpin = {
    stops, board, evalBoard,
    expandedReels: hotReels,
    stickyReels: [],
    scatters: scatterCount,
    hot,
    retriggered: false,
    instantMaxWin: baseInstantMax,
    winResult: baseEval,
    rawWin: baseRaw,
    credited: totalWin,
  };

  // ── 2. FREE SPINS ────────────────────────────────────────────────────────
  const fsTriggered = scatterCount >= 3;
  const sticky = fsTriggered && expandFS && scatterCount >= 4;
  const stickyCap = buyStage?.stickyTowerCap ?? config.stickyTowerCap ?? 2;
  const fsSpins: ViceSpin[] = [];

  if (fsTriggered) {
    // A staged buy plays its OWN certified FS strips; natural/ante triggers use
    // the top-level rare-wild fsReelStrips.
    const fsStrips: ReadonlyArray<ReadonlyArray<number>> =
      buyStage?.fsReelStrips ?? config.fsReelStrips ?? config.reelStrips;
    let remaining = buyStage?.freeSpinsCount ?? config.freeSpinsCount;
    if (sticky) remaining = buyStage?.freeSpinsCount ?? config.stickyRoundSpins ?? config.freeSpinsCount;
    const fsCap = buyStage?.fsCap
      ?? (sticky ? (config.stickyRoundCap ?? config.freeSpinsCap) : config.freeSpinsCap);
    const retrig = buyStage?.retriggerSpins ?? config.retriggerSpins ?? config.freeSpinsCount;
    // FULL HOUSE: while ALL towers stand a sticky spin pays × this (currently 1
    // for natural rounds; a bought 4sc round carries its own).
    const fullHouseMult = BigInt(
      buyStage?.stickyFullBoardMultiplier ?? config.stickyFullBoardMultiplier ?? 1,
    );
    const stickyReels: number[] = [];

    while (remaining > 0 && fsSpins.length < fsCap) {
      const seed = spinSeed(randomness, BigInt(fsSpins.length));
      const fsStops = deriveStops(seed, fsStrips);
      const fsBoard = boardFromStops(fsStops, fsStrips, rows);
      const fsEvalBoard = fsBoard.map(r => [...r]);
      const expandedReels: number[] = [];

      if (expandFS) {
        if (sticky) {
          // The first `stickyCap` wild-landing reels become PERMANENT towers
          // (leftmost joins first); later wilds stay regular 1:1 wilds.
          for (let reel = 0; reel < reels; reel++) {
            if (stickyReels.length >= stickyCap) break;
            if (!stickyReels.includes(reel) && reelHasWild(fsEvalBoard, reel)) stickyReels.push(reel);
          }
          for (const reel of stickyReels) { makeFullWild(fsEvalBoard, reel); expandedReels.push(reel); }
          expandedReels.sort((a, b) => a - b);
        } else {
          for (let reel = 0; reel < reels; reel++) {
            if (reelHasWild(fsEvalBoard, reel)) { makeFullWild(fsEvalBoard, reel); expandedReels.push(reel); }
          }
        }
      }

      const instantMaxWin = expandFS
        && fullWildReelCount(fsEvalBoard, reels) >= reels
        && !!config.fullBoardInstantMaxWin;
      const fsEval = evalWins(fsEvalBoard, bet, config);
      const rawFsWin = instantMaxWin ? maxWin : fsEval.totalWin;
      // simulExpandMultipliers RETIRED — see the header note.
      const fullMult = sticky && stickyReels.length >= stickyCap ? fullHouseMult : 1n;
      const spinWin = rawFsWin * fullMult * BigInt(config.freeSpinsMultiplier);

      const before = totalWin;
      totalWin += spinWin;
      if (totalWin > maxWin) { totalWin = maxWin; capped = true; }
      const retriggered = fsEval.scatterCount >= 3;

      fsSpins.push({
        stops: fsStops,
        board: fsBoard,
        evalBoard: fsEvalBoard,
        expandedReels,
        stickyReels: sticky ? [...stickyReels] : [],
        scatters: fsEval.scatterCount,
        hot: false,
        retriggered,
        instantMaxWin,
        winResult: fsEval,
        rawWin: spinWin,
        credited: totalWin - before,
      });

      if (retriggered) remaining += retrig;
      remaining--;
      // HARD SESSION CAP: the round STOPS the moment the cap is reached.
      if (totalWin >= maxWin) { capped = true; break; }
    }
  }

  return {
    base,
    fsTriggered,
    sticky,
    stickyTowerCap: sticky ? stickyCap : 0,
    fsSpins,
    totalWin,
    capped,
    stageCode,
  };
}
