// Mock host — simulates the chain.wtf host Penpal API for local development.
// Generates randomness using crypto.getRandomValues (NOT Math.random).
// Implements Option 1: all free spins resolved in a single settleSession call
// by deriving seeds via keccak256(randomness, spinIndex) — mirrors SlotGame.sol.

import { encodeAbiParameters, decodeAbiParameters, keccak256 } from 'viem';
const encodeAbi = encodeAbiParameters;
import type { HostApiV1, HostSnapshotV1 } from '@/bridge/types';
import { buildBoard } from '@/config/reels';
import { evalWins, activePayModel } from '@/game/winEval';
import { deriveFruitStacksRound } from '@/game/fruitStacksSpin';
import { FRUIT_STACKS_MATH, FRUIT_BUY_STAGES } from '@/game/fruitStacksMath';
import { FRUIT_GAME_STATE } from '@/game/decodeFruitStacks';
import { deriveStopsFromRandomness } from '@/engine/SlotEngine';
import { GAME_CONFIG } from '@/config/gameConfig';
import type { GameConfig } from '@/engine/GameConfig';
import { SymbolId } from '@/config/symbols';
import { playDeterministicHoldAndWin, HW_TRIGGER_MIN } from '@/engine/holdAndWin';
import { baseFeaturePlants, type PlantFeatureConfig } from '@/game/plantFeature';

const MOCK_CHAIN_ID = 84532; // Base Sepolia
const MOCK_GAME_ADDRESS = '0x0000000000000000000000000000000000001234' as const;
const MOCK_VAULT_ADDRESS = '0x0000000000000000000000000000000000005678' as const;
const MOCK_PLAYER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as const;
const DECIMALS = 6;
const TOKEN_SYMBOL = 'USDC';
const INITIAL_BALANCE = '10000000000'; // 10,000 USDC

type OnStateChange = (snap: HostSnapshotV1) => void;

export class MockHost {
  private balance = BigInt(INITIAL_BALANCE);
  private sessionCounter = 1;
  private onStateChange: OnStateChange;

  /** The ACTIVE game config — outcomes (stops, board, evaluation, FS params)
   *  must derive from the SAME config the display renders, or win combos point
   *  at cells showing different symbols. Defaults to the baked Fantasy spec. */
  private readonly config: GameConfig;

  constructor(onStateChange: OnStateChange, config: GameConfig = GAME_CONFIG as unknown as GameConfig) {
    this.onStateChange = onStateChange;
    this.config = config;
  }

  /** Stops from randomness against THIS config's strip lengths (mirrors
   *  SlotEngine.deriveStopsFromRandomness, config-injected). */
  private deriveStops(randomness: `0x${string}`): number[] {
    let seed = BigInt(randomness);
    const stops: number[] = [];
    for (let i = 0; i < this.config.reelLengths.length; i++) {
      stops.push(Number(seed % BigInt(this.config.reelLengths[i])));
      seed = seed / BigInt(this.config.reelLengths[i]);
    }
    return stops;
  }

  /** FORCE a board with exactly `want` scatters for a staged vice buy:
   *  reels are picked from the randomness (variety), each scatter reel's
   *  stop slides forward to the nearest window with EXACTLY one scatter,
   *  every other reel to the nearest scatter-free window. Deterministic —
   *  settlement encodes the final stops, the display just renders them. */
  private forceScatterStops(stops: number[], randomness: `0x${string}`, want: number): number[] {
    const reels = this.config.reelStrips.length;
    const rows = this.config.gridConfig.visibleRows;
    const scatterId = 1;
    const windowScatters = (reel: number, stop: number): number => {
      const strip = this.config.reelStrips[reel];
      let n = 0;
      for (let row = 0; row < rows; row++) if (strip[(stop + row) % strip.length] === scatterId) n++;
      return n;
    };
    // Reel pick: seeded shuffle from the tail of the randomness.
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
      const len = this.config.reelStrips[reel].length;
      for (let off = 0; off < len; off++) {
        const pos = (stops[reel] + off) % len;
        if (windowScatters(reel, pos) === target) { out[reel] = pos; break; }
      }
    }
    return out;
  }

  /** Visible board from stops against THIS config's strips + grid. */
  private buildBoardCfg(stops: number[]): number[][] {
    const rows = this.config.gridConfig.visibleRows;
    const reels = this.config.reelStrips.length;
    const board: number[][] = [];
    for (let row = 0; row < rows; row++) {
      const r: number[] = [];
      for (let reel = 0; reel < reels; reel++) {
        const strip = this.config.reelStrips[reel];
        r.push(strip[(stops[reel] + row) % strip.length]);
      }
      board.push(r);
    }
    return board;
  }

  getSnapshot(): HostSnapshotV1 {
    return {
      apiVersion: 1,
      integration: {
        chainId: MOCK_CHAIN_ID,
        slug: 'slot',
        gameAddress: MOCK_GAME_ADDRESS,
        manifest: {
          schemaVersion: 1,
          gameId: 'SlotGame',
          apiVersion: 1,
          defaultLocale: 'en',
          locales: { en: { name: 'Slot', description: 'Dev harness' } },
        },
      },
      wallet: {
        address: MOCK_PLAYER,
        smartVaultAddress: MOCK_VAULT_ADDRESS,
        status: 'ready',
      },
      token: {
        symbol: TOKEN_SYMBOL,
        decimals: DECIMALS,
      },
      balances: {
        smartVaultBalance: this.balance.toString(),
      },
      casino: {
        availableLiquidity: '100000000000',
        maxBetRiskBps: 100,
        maxAllowedReservedProfit: '500000000000',
      },
      sessions: { items: [] },
      ui: { locale: 'en', theme: 'dark' },
    };
  }

  getHostApi(): HostApiV1 {
    return {
      openSession: async ({ wager, gameData }) => {
        const wagerBig = BigInt(wager);

        if (wagerBig < GAME_CONFIG.minBetBaseUnits) {
          throw new Error('Bet below minimum.');
        }
        if (wagerBig > this.balance) {
          throw new Error('Insufficient balance.');
        }

        this.balance -= wagerBig;
        this.onStateChange(this.getSnapshot());

        const sessionId = String(this.sessionCounter++);
        const sessionKey = `${MOCK_CHAIN_ID}:${sessionId}`;
        const txHash = `0x${sessionId.padStart(64, '0')}` as `0x${string}`;

        // Simulate VRF fulfillment delay ~0.9s — devnet-realistic while the
        // roll still masks it (Noski: click→drop was too slow; the live
        // chain dictates the real value, the reels stop whenever it lands).
        setTimeout(() => {
          this.settleSession(sessionId, sessionKey, wagerBig, gameData);
        }, 900);

        return { sessionKey, transactionHash: txHash };
      },

      submitAction: async () => {
        throw new Error('SlotGame: no player actions.');
      },

      cancelStuckRandomness: async () => {
        throw new Error('No stuck session to cancel.');
      },
    };
  }

  private settleSession(sessionId: string, sessionKey: string, wager: bigint, gameData?: string) {
    const randBytes = crypto.getRandomValues(new Uint8Array(32));
    const randomness = ('0x' + Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;

    // ── FRUIT STACKS (scatter-pays tumbler) ────────────────────────────────
    // The whole round (tumble chains, crates, FS pool) settles through the
    // pure math core; the decode façade re-derives the identical round from
    // the same randomness, so display == payout by construction. The frozen
    // uint8[5] schema can't carry 6 reels — this branch encodes its own.
    if (activePayModel() === 'scatterpays') {
      // gameData = abi.encode(uint8 stage) marks a purchased FS round.
      let buyStage = 0;
      if (typeof gameData === 'string' && gameData.length >= 66) {
        try { buyStage = Number(decodeAbiParameters([{ type: 'uint8' }], gameData as `0x${string}`)[0]); } catch { buyStage = 0; }
      }
      this.settleFruitStacks(sessionId, sessionKey, wager, randomness, buyStage);
      return;
    }

    // Bonus buy (gameData = abi.encode(true)): the wager is the premium, and the
    // free-spins round plays at the BASE bet derived from the configured cost.
    // Mirrors SlotGame.sol onRandomness exactly.
    const bonusBuyCost = (this.config as { bonusBuyCost?: number }).bonusBuyCost;
    // VICE staged buys + ante (gameData = abi.encode(uint8)): 1 = buy 3sc,
    // 2 = buy 4sc, 3 = ante spin (3x-FS-chance strips). bool(true) from the
    // legacy path decodes as 1 too — games WITHOUT viceBuyStages keep the
    // old jump-to-FS behaviour below.
    const viceStages = (this.config as { viceBuyStages?: Array<{ stage: number; scatters: number; costMult: number }> }).viceBuyStages;
    const anteBet = (this.config as { anteBet?: { costMult: number; reelStrips: number[][] } }).anteBet;
    let stageCode = 0;
    if (typeof gameData === 'string' && gameData.length >= 66) {
      try { stageCode = Number(decodeAbiParameters([{ type: 'uint8' }], gameData as `0x${string}`)[0]); } catch { stageCode = 0; }
    }
    const viceBuy = viceStages?.find(st => st.stage === stageCode);
    const viceAnte = stageCode === 3 && !!anteBet;
    const buyBonus = !viceBuy && !viceAnte && !!bonusBuyCost && stageCode === 1;
    const bet = viceBuy ? wager / BigInt(viceBuy.costMult)
      : viceAnte ? (wager * 100n) / BigInt(Math.round(anteBet!.costMult * 100))
      : buyBonus ? (wager * 100n) / BigInt(Math.round(bonusBuyCost! * 100)) : wager;
    // Ante spins run on the 3x-scatter strips for THIS spin (the certified
    // ante model swaps the reels; FS rounds inside keep the base strips).
    const baseStrips = this.config.reelStrips;
    if (viceAnte) (this.config as unknown as { reelStrips: readonly (readonly number[])[] }).reelStrips = anteBet!.reelStrips;
    // Session cap is the VERSION's max win — 5000x / 10000x / 15000x. Reading it
    // from config (not a hardcoded 5000) keeps settlement's clamp identical to
    // the display's capAmount (PixiApp) and the simulator's per-version cap.
    const maxWin = bet * BigInt((this.config as { maxWinMultiplier?: number }).maxWinMultiplier ?? 5000);

    // 1. Base spin (evaluated at the base bet; a purchased round skips its win)
    let stops = this.deriveStops(randomness);
    // Staged VICE buy: the stops are FORCED so the visible board carries
    // EXACTLY the bought scatter count — the presentation then lands 2,
    // arms the tease and drops the rest like a natural trigger, and the
    // board is evaluated in full (scatter pay + incidental line wins are
    // part of the certified buy price; display == payout).
    if (viceBuy) stops = this.forceScatterStops(stops, randomness, viceBuy.scatters);
    const board = this.buildBoardCfg(stops);
    const baseEval = evalWins(board, bet, this.config);
    const scatterCount = baseEval.scatterCount;
    let totalWin = 0n;
    let freeSpinsTriggered: boolean;
    if (buyBonus) {
      freeSpinsTriggered = true;
    } else {
      totalWin = baseEval.totalWin;
      if (totalWin > maxWin) totalWin = maxWin;
      freeSpinsTriggered = scatterCount >= 3;
    }
    if (viceAnte) (this.config as unknown as { reelStrips: readonly (readonly number[])[] }).reelStrips = baseStrips;

    // 1b. BASE-GAME PLANT FEATURE — the screen darkens, the pads light up and
    // 1..5 multiplied plants slide in; THIS spin is then re-evaluated with the
    // plants standing as full-reel wilds (it replaces the plain result, it does
    // not stack on top). Derived from the stops so the display reaches the same
    // plants without a new game-state field — see src/game/plantFeature.ts.
    if (!buyBonus && scatterCount < 3) {
      const featPlants = baseFeaturePlants(
        stops,
        this.config.reelStrips.map((_, i) => i),
        this.config as PlantFeatureConfig,
      );
      if (featPlants) {
        const fb = this.buildBoardCfg(stops);
        for (const reel of featPlants.keys()) {
          for (let row = 0; row < fb.length; row++) fb[row][reel] = SymbolId.WILD;
        }
        const fe = evalWins(fb, bet, this.config);
        let sum = 0n;
        for (const c of fe.combinations) {
          if (c.symbolId === SymbolId.SCATTER) { sum += c.winAmount; continue; }
          let best = 1;
          for (const [, reel] of c.cells) {
            const m = featPlants.get(reel);
            if (m !== undefined && m > best) best = m;
          }
          sum += c.winAmount * BigInt(best);
        }
        totalWin = sum > maxWin ? maxWin : sum;
      }
    }

    // 2. Free spins loop — mirrors SlotGame.sol onRandomness exactly
    let freeSpinsPlayed = 0;
    if (freeSpinsTriggered) {
      let remaining = this.config.freeSpinsCount;
      // TIERED Vice-Heat bonus: a 4+-scatter trigger plays STICKY expanding
      // wilds — the FIRST `stickyTowerCap` wild-landing reels become permanent
      // full-wild towers (leftmost joins first) for the rest of the round;
      // later wilds play as regular 1:1 wilds. 3 scatters keep the per-spin
      // expansion. Uncapped sticky blows the math up (avg round 317x, pays
      // would have to shrink to 34% — see custom-math/simulate_vice_heat.py).
      const expandFS = !!(this.config as { expandingWildsInFS?: boolean }).expandingWildsInFS;
      const stickyFS = expandFS && !buyBonus && scatterCount >= 4;
      const stickyCap = (this.config as { stickyTowerCap?: number }).stickyTowerCap ?? 2;
      const stickyReels = new Set<number>();
      // ── CRACK FARM tiered bonus (paylines game) ────────────────────────
      // 3 SC: ROAMING PLANT — every FS spin exactly ONE wild-capable reel
      //   sprouts fully wild for that spin (seed-derived, guaranteed action).
      // 4 SC: STICKY PLANTS — wild-landing reels become permanent plant
      //   towers; a shared MULTIPLIER starts at 1× and grows +1 per WINNING
      //   CONNECTION while ≥1 tower stands; line wins CROSSING a tower pay
      //   × the multiplier. (Mirrors custom-math/simulate_crack_farm.py.)
      const cfCfg = this.config as {
        roamingWildFrom3Scatters?: boolean; stickyPlantFrom4Scatters?: boolean;
        plantMultiIncrement?: number; plantMultiCap?: number;
        plantStartMultipliers?: Record<string, number>;
        plantCountWeights?: number[];
      };
      const crackFS = !!(cfCfg.roamingWildFrom3Scatters || cfCfg.stickyPlantFrom4Scatters);
      // ── CRACK FARM v2 ───────────────────────────────────────────────────
      // 3, 4 and 5 scatters all play the SAME round length; only the plants'
      // STARTING multiplier differs (1x / 8x / 32x). Every plant carries its
      // OWN multiplier, plants RELOCATE each spin, a line win pays x the
      // HIGHEST plant it crosses, and each plant that took part in a spin
      // then DOUBLES (capped). Mirrors simulate_crack_farm_v2.py.
      const plantRound = crackFS && !buyBonus && scatterCount >= 3;
      const startMulti = cfCfg.plantStartMultipliers?.[String(Math.min(scatterCount, 5))] ?? 1;
      const plantCap = cfCfg.plantMultiCap ?? 1024;
      const countWeights = cfCfg.plantCountWeights ?? [575, 280, 130, 12, 3];
      // A plant is a FEATURE OVERLAY, so it can rise on ANY reel — including
      // reel 0, whose strip carries no wild. The certified model uses all five
      // (PLANT_REELS); restricting to wild-carrying reels capped a round at 4
      // plants and diverged from the RTP. `plantCapable` stays ONLY for the
      // landing-wild "gained" check below.
      const plantReels = this.config.reelStrips.map((_, i) => i);
      const plantCapable: number[] = [];
      for (let reel = 0; reel < this.config.reelStrips.length; reel++) {
        if (this.config.reelStrips[reel].includes(SymbolId.WILD)) plantCapable.push(reel);
      }
      // How many plants this round grows — drawn once, seed-derived.
      const targetPlants = (() => {
        const total = countWeights.reduce((a, b) => a + b, 0);
        let x = Number(BigInt(randomness) % BigInt(total));
        for (let i = 0; i < countWeights.length; i++) {
          x -= countWeights[i];
          if (x < 0) return Math.min(i + 1, plantReels.length);
        }
        return 1;
      })();
      // reel -> that plant's current multiplier
      let plants = new Map<number, number>();
      // Sticky rounds run LONGER (towers need spins to accumulate) — their
      // own count/cap via the custom rules; 3sc rounds use the template's.
      if (stickyFS || plantRound) {
        remaining = (this.config as { stickyRoundSpins?: number }).stickyRoundSpins
          ?? this.config.freeSpinsCount;
      }
      const fsCap = (stickyFS || plantRound)
        ? ((this.config as { stickyRoundCap?: number }).stickyRoundCap ?? this.config.freeSpinsCap)
        : this.config.freeSpinsCap;
      while (remaining > 0 && freeSpinsPlayed < fsCap) {
        const seed = keccak256(
          encodeAbi(
            [{ type: 'bytes32' }, { type: 'uint256' }],
            [randomness, BigInt(freeSpinsPlayed)],
          ),
        );
        const fsStops = this.deriveStops(seed);
        const fsBoard = this.buildBoardCfg(fsStops);
        // Reels expanding in THIS spin (per-spin mode) — drives the
        // simultaneous-expansion multiplier below.
        let simulTowers = 0;
        // Crack Farm FS board transforms (before evaluation).
        if (crackFS) {
          if (plantRound) {
            // RELOCATE: every standing plant sinks and rises again on a fresh
            // reel each spin (seed-derived). A landing wild grows one more,
            // up to the round's drawn count. Multipliers travel WITH the
            // plants — the strongest ones are kept when the count shrinks.
            const gained = plants.size < targetPlants
              && fsBoard.some(r => plantCapable.some(reel => r[reel] === SymbolId.WILD)) ? 1 : 0;
            const want = Math.min(targetPlants, Math.max(plants.size, 1) + gained);
            const carried = [...plants.values()].sort((a, b) => b - a).slice(0, want);
            while (carried.length < want) carried.push(startMulti);
            // Shuffle ALL reels deterministically, then take `want` (plants can
            // stand on any reel — matches the certified PLANT_REELS).
            const pool = [...plantReels];
            let s = BigInt(seed);
            for (let i = pool.length - 1; i > 0; i--) {
              const j = Number(s % BigInt(i + 1));
              s /= BigInt(i + 1);
              [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            plants = new Map(pool.slice(0, want).map((reel, i) => [reel, carried[i]]));
            for (const reel of plants.keys()) {
              for (let row = 0; row < fsBoard.length; row++) fsBoard[row][reel] = SymbolId.WILD;
            }
          } else {
            // ROAMING PLANT: exactly one wild-capable reel, seed-derived.
            const capable: number[] = [];
            for (let reel = 0; reel < fsBoard[0].length; reel++) {
              if (this.config.reelStrips[reel].includes(SymbolId.WILD)) capable.push(reel);
            }
            if (capable.length > 0) {
              const roam = capable[Number(BigInt(seed) % BigInt(capable.length))];
              for (let row = 0; row < fsBoard.length; row++) fsBoard[row][roam] = 0;
            }
          }
        }
        // Vice-Heat style FS: wild-carrying reels become FULLY WILD before
        // ways evaluation (settlement matches the displayed expansion).
        if (expandFS) {
          if (stickyFS) {
            // Sticky round: first `stickyCap` wild-landing reels become
            // permanent towers (leftmost joins first); ONLY towers are
            // overwritten — later wilds stay regular 1:1 wilds on the board.
            for (let reel = 0; reel < fsBoard[0].length; reel++) {
              if (stickyReels.size >= stickyCap) break;
              if (!stickyReels.has(reel) && fsBoard.some(r => r[reel] === 0)) stickyReels.add(reel);
            }
            for (const reel of stickyReels) {
              for (let row = 0; row < fsBoard.length; row++) fsBoard[row][reel] = 0;
            }
          } else {
            for (let reel = 0; reel < fsBoard[0].length; reel++) {
              if (fsBoard.some(r => r[reel] === 0)) {
                for (let row = 0; row < fsBoard.length; row++) fsBoard[row][reel] = 0;
                simulTowers++;
              }
            }
          }
        }
        const fsEval = evalWins(fsBoard, bet, this.config);
        let rawFsWin = fsEval.totalWin;
        const fsScatter = fsEval.scatterCount;
        // PLANT MULTIPLIER (4sc crack-farm rounds): line wins CROSSING a
        // standing tower pay × the shared multi; each tower-CROSSING winning
        // connection then grows the multi by +plantMultiIncrement (capped) —
        // mirrors custom-math/simulate_crack_farm.py exactly.
        if (plantRound && plants.size > 0) {
          let adjusted = 0n;
          const tookPart = new Set<number>();
          for (const c of fsEval.combinations) {
            if (c.symbolId === SymbolId.SCATTER) { adjusted += c.winAmount; continue; }
            // A line pays x the HIGHEST plant it crosses. Multiplying every
            // crossed plant together reads well on paper but is explosive:
            // three plants at 16x would be 4096x on one line (measured RTP
            // 3125% — see simulate_crack_farm_v2.py).
            let best = 1;
            for (const [, reel] of c.cells) {
              const m = plants.get(reel);
              if (m !== undefined) { tookPart.add(reel); if (m > best) best = m; }
            }
            adjusted += c.winAmount * BigInt(best);
          }
          rawFsWin = adjusted;
          // Each plant that took part DOUBLES — once per SPIN, not once per
          // line (per-line doubling let a plant crossed by all 10 paylines
          // jump 2^10 in a single spin).
          for (const reel of tookPart) {
            plants.set(reel, Math.min(plantCap, (plants.get(reel) ?? startMulti) * 2));
          }
        }
        // SIMULTANEOUS-EXPANSION MULTIPLIERS (3-scatter rounds only): n reels
        // expanding in the SAME spin multiply the spin's win per the custom
        // table (late ladder: 3 towers x2, 4 towers x8) — the four-tower
        // simultaneous spin is the 3sc bonus' max-win pattern.
        const simulTable = (this.config as { simulExpandMultipliers?: Record<string, number> }).simulExpandMultipliers ?? {};
        const simulMult = BigInt(simulTable[String(simulTowers)] ?? 1);
        // FULL HOUSE (sticky rounds): while ALL stickyTowerCap towers stand,
        // the spin pays x stickyFullBoardMultiplier — the 4-scatter route's
        // max-win engine (mirrors custom-math/simulate_vice_heat.py).
        const fullMult = stickyFS && stickyReels.size >= stickyCap
          ? BigInt((this.config as { stickyFullBoardMultiplier?: number }).stickyFullBoardMultiplier ?? 1)
          : 1n;
        const fsWin = rawFsWin * simulMult * fullMult * BigInt(this.config.freeSpinsMultiplier);
        totalWin += fsWin;
        if (totalWin > maxWin) totalWin = maxWin;
        // RETRIGGER. Crack Farm v2: EVERY scatter landing in a free spin adds
        // that many spins (1 sc → +1, 2 sc → +2 …) so the multiplier can climb
        // past 128x — the fsCap keeps a streak from running away. Vice Heat
        // keeps its 3+-scatter re-award.
        if (plantRound) {
          if (fsScatter >= 1) remaining += fsScatter;
        } else if (fsScatter >= 3) {
          remaining += (this.config as { retriggerSpins?: number }).retriggerSpins
            ?? this.config.freeSpinsCount;
        }
        remaining--;
        freeSpinsPlayed++;
        // HARD SESSION CAP: totalWin is already clamped to maxWin above —
        // the round STOPS the moment the cap is reached (no further spins;
        // payout locked at maxWinMultiplier x bet, mirrors the simulator).
        if (totalWin >= maxWin) break;
      }
    }

    // 3. Hold & Win — base-game feature; NOT played on a purchased FS round.
    const cols = board[0].length;
    let holdWinTriggered = false;
    let holdWinWin = 0n;
    if (!buyBonus) {
      const coinIdxs: number[] = [];
      for (let row = 0; row < board.length; row++) {
        for (let reel = 0; reel < cols; reel++) {
          if (board[row][reel] === SymbolId.COIN) coinIdxs.push(row * cols + reel);
        }
      }
      if (coinIdxs.length >= HW_TRIGGER_MIN) {
        const round = playDeterministicHoldAndWin(BigInt(randomness), coinIdxs, board.length * cols);
        holdWinTriggered = true;
        holdWinWin = bet * BigInt(round.totalMultiplier);
        const preHoldWin = totalWin;
        totalWin += holdWinWin;
        if (totalWin > maxWin) {
          totalWin = maxWin;
          holdWinWin = maxWin > preHoldWin ? maxWin - preHoldWin : 0n; // keep breakdown <= total
        }
      }
    }

    const gameState = encodeAbiParameters(
      [
        { type: 'uint8[5]', name: 'stops' },
        { type: 'uint256', name: 'totalWin' },
        { type: 'uint8', name: 'scatterCount' },
        { type: 'uint8', name: 'freeSpinsPlayed' },
        { type: 'bool', name: 'freeSpinsTriggered' },
        { type: 'bool', name: 'holdWinTriggered' },
        { type: 'uint256', name: 'holdWinWin' },
      ],
      [stops as [number, number, number, number, number], totalWin, scatterCount, freeSpinsPlayed, freeSpinsTriggered, holdWinTriggered, holdWinWin],
    );

    this.balance += totalWin;

    const now = Math.floor(Date.now() / 1000);
    const snapshot = this.getSnapshot();
    snapshot.sessions = {
      items: [
        {
          sessionId,
          sessionKey,
          gameAddress: MOCK_GAME_ADDRESS,
          phase: 3, // SETTLED
          phaseName: 'SETTLED',
          wager: wager.toString(),
          payout: totalWin.toString(),
          outcome: totalWin > 0n ? 1 : 0,
          isSettled: true,
          openedAt: now - 2,
          settledAt: now,
          lastEventTimestamp: now,
          raw: {
            gameData: (gameData ?? '0x') as `0x${string}`, // preserve the actual gameData (e.g. a bonus-buy flag)
            gameState,
            randomness,
          },
        },
      ],
    };

    this.onStateChange(snapshot);
  }

  /** FRUIT STACKS settlement — the certified pure core derives the whole
   *  round (base tumble chain + crates + FS pool) from the randomness; only
   *  the authoritative totals are encoded. Mirrors what a SlotGame.sol
   *  variant would compute on-chain from the same seed. */
  private settleFruitStacks(sessionId: string, sessionKey: string, wager: bigint, randomness: `0x${string}`, buyStage = 0) {
    // A purchase pays the COST as the wager; the round plays at the base bet.
    const costMult = buyStage > 0 ? FRUIT_BUY_STAGES[buyStage - 1].costMult : 0;
    const bet = buyStage > 0 ? (wager * 10n) / BigInt(Math.round(costMult * 10)) : wager;
    const round = deriveFruitStacksRound(randomness, bet, FRUIT_STACKS_MATH, buyStage);
    const totalWin = round.totalWin;

    const gameState = encodeAbiParameters(
      FRUIT_GAME_STATE as unknown as { type: string; name: string }[],
      [
        round.base.stops as unknown as [number, number, number, number, number, number],
        totalWin,
        Math.min(round.base.scatters, 255),
        round.fsSpins.length,
        round.fsTriggered,
        buyStage,
      ],
    );

    this.balance += totalWin;

    const now = Math.floor(Date.now() / 1000);
    const snapshot = this.getSnapshot();
    snapshot.sessions = {
      items: [
        {
          sessionId,
          sessionKey,
          gameAddress: MOCK_GAME_ADDRESS,
          phase: 3,
          phaseName: 'SETTLED',
          wager: wager.toString(),
          payout: totalWin.toString(),
          outcome: totalWin > 0n ? 1 : 0,
          isSettled: true,
          openedAt: now - 2,
          settledAt: now,
          lastEventTimestamp: now,
          raw: {
            gameData: '0x' as `0x${string}`,
            gameState,
            randomness,
          },
        },
      ],
    };
    this.onStateChange(snapshot);
  }
}
