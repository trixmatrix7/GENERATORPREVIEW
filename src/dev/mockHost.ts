// Mock host — simulates the chain.wtf host Penpal API for local development.
// Generates randomness using crypto.getRandomValues (NOT Math.random).
// Implements Option 1: all free spins resolved in a single settleSession call
// by deriving seeds via keccak256(randomness, spinIndex) — mirrors SlotGame.sol.

import { encodeAbiParameters, decodeAbiParameters, keccak256 } from 'viem';
const encodeAbi = encodeAbiParameters;
import type { HostApiV1, HostSnapshotV1 } from '@/bridge/types';
import { buildBoard } from '@/config/reels';
import { evalWins } from '@/game/winEval';
import { deriveStopsFromRandomness } from '@/engine/SlotEngine';
import { GAME_CONFIG } from '@/config/gameConfig';
import type { GameConfig } from '@/engine/GameConfig';
import { SymbolId } from '@/config/symbols';
import { playDeterministicHoldAndWin, HW_TRIGGER_MIN } from '@/engine/holdAndWin';

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

    // Bonus buy (gameData = abi.encode(true)): the wager is the premium, and the
    // free-spins round plays at the BASE bet derived from the configured cost.
    // Mirrors SlotGame.sol onRandomness exactly.
    const bonusBuyCost = (this.config as { bonusBuyCost?: number }).bonusBuyCost;
    const buyBonus = !!bonusBuyCost
      && typeof gameData === 'string' && gameData.length >= 66
      && decodeAbiParameters([{ type: 'bool' }], gameData as `0x${string}`)[0] === true;
    const bet = buyBonus ? (wager * 100n) / BigInt(Math.round(bonusBuyCost! * 100)) : wager;
    const maxWin = bet * BigInt(5000);

    // 1. Base spin (evaluated at the base bet; a purchased round skips its win)
    const stops = this.deriveStops(randomness);
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
      };
      const crackFS = !!(cfCfg.roamingWildFrom3Scatters || cfCfg.stickyPlantFrom4Scatters);
      const plantRound = !!cfCfg.stickyPlantFrom4Scatters && !buyBonus && scatterCount >= 4;
      const plantTowers = new Set<number>();
      let plantMulti = 1;
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
            // Towers accumulate where wilds naturally land (leftmost first).
            for (let reel = 0; reel < fsBoard[0].length; reel++) {
              if (plantTowers.size >= stickyCap) break;
              if (!plantTowers.has(reel) && fsBoard.some(r => r[reel] === 0)) plantTowers.add(reel);
            }
            for (const reel of plantTowers) {
              for (let row = 0; row < fsBoard.length; row++) fsBoard[row][reel] = 0;
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
        if (plantRound && plantTowers.size > 0) {
          let adjusted = 0n;
          let crossings = 0;
          for (const c of fsEval.combinations) {
            if (c.symbolId === SymbolId.SCATTER) { adjusted += c.winAmount; continue; }
            const crosses = c.cells.some(([, reel]) => plantTowers.has(reel));
            if (crosses) crossings++;
            adjusted += crosses ? c.winAmount * BigInt(plantMulti) : c.winAmount;
          }
          rawFsWin = adjusted;
          plantMulti = Math.min(cfCfg.plantMultiCap ?? 20, plantMulti + crossings * (cfCfg.plantMultiIncrement ?? 1));
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
        // Retrigger awards the custom `retriggerSpins` (small, the tight
        // freeSpinsCap allows at most one) — falls back to the template's
        // re-award-freeSpinsCount when the rule is absent.
        if (fsScatter >= 3) {
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
}
