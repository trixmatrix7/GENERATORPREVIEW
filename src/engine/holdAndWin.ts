// Hold & Win — shared round model. Single source of truth for BOTH the studio
// preview overlay and the math simulator, so the demoed economics match the
// validated numbers. Pure logic, no DOM/engine deps.
//
// Values + odds here are the tunable knobs of the bonus's economics. Step 1 of
// the math model measures the round EV from these (scripts/simulate-hold-and-
// win.ts). Step 2 (reel integration) sets the trigger frequency so the round's
// RTP contribution fits the total RTP budget.

import { keccak256, encodeAbiParameters } from 'viem';

export interface HwCoin { label: string; value: number; tier?: string }

export const HW_INITIAL_COINS = 6;
export const HW_LAND_P = 0.055;       // chance a blank lands a coin per respin
export const HW_START_RESPINS = 3;
export const HW_JACKPOT_P = 0.04;     // chance a landed coin is a jackpot tier
export const HW_GRAND_VALUE = 500;    // awarded only when the whole board fills
export const HW_COIN_VALUES = [1, 1, 1, 2, 2, 3, 5, 10]; // weighted small values (× bet)
export const HW_JACKPOTS: readonly HwCoin[] = [
  { label: 'MINI', value: 15, tier: 'MINI' },
  { label: 'MINOR', value: 40, tier: 'MINOR' },
  { label: 'MAJOR', value: 150, tier: 'MAJOR' },
];

/** One coin landing, using the supplied RNG (() => float in [0,1)). */
export function rollCoin(rng: () => number): HwCoin {
  if (rng() < HW_JACKPOT_P) return HW_JACKPOTS[Math.floor(rng() * HW_JACKPOTS.length)];
  const v = HW_COIN_VALUES[Math.floor(rng() * HW_COIN_VALUES.length)];
  return { label: `${v}×`, value: v };
}

/**
 * Auto-play a full Hold & Win round (for the math simulator). Mirrors the
 * overlay's interactive rules exactly: seed the initial coins, then respin —
 * a new coin resets respins to the start count, a dry respin decrements; a full
 * board wins GRAND. Returns the total win in bet-multiples.
 */
export function playHoldAndWinRound(rng: () => number, size: number): { totalMultiplier: number; grand: boolean; coins: number } {
  const cells: (HwCoin | null)[] = Array.from({ length: size }, () => null);
  let placed = 0;
  while (placed < Math.min(HW_INITIAL_COINS, size)) {
    const i = Math.floor(rng() * size);
    if (!cells[i]) { cells[i] = rollCoin(rng); placed++; }
  }
  let respins = HW_START_RESPINS;
  while (respins > 0 && !cells.every(c => c)) {
    let landed = 0;
    for (let i = 0; i < size; i++) {
      if (!cells[i] && rng() < HW_LAND_P) { cells[i] = rollCoin(rng); landed++; }
    }
    respins = landed > 0 ? HW_START_RESPINS : respins - 1;
  }
  const grand = cells.every(c => c);
  const sum = cells.reduce((s, c) => s + (c ? c.value : 0), 0);
  return { totalMultiplier: sum + (grand ? HW_GRAND_VALUE : 0), grand, coins: cells.filter(Boolean).length };
}

// ── Deterministic, contract-mirrorable round ────────────────────────────────
// The LIVE game's Hold & Win must be provably fair: the on-chain contract
// computes the round from the spin's `randomness` (a bytes32), and the client
// re-derives the SAME round from the same randomness purely to animate it. The
// authoritative payout still travels in gameState — the client never invents an
// outcome, it only replays one. Every coin-land + value-roll is a draw from
// keccak256(abi.encode(randomness, tag, step, cell)), the same keccak primitive
// MockHost/SlotGame.sol already use for free-spin seeds, so a Solidity mirror is
// a direct byte-for-byte port of the logic below.

/** Trigger: this many coin symbols visible on the base spin opens the bonus. */
export const HW_TRIGGER_MIN = 6;
export const HW_LAND_P_BPS = Math.round(HW_LAND_P * 10_000);       // 550
export const HW_JACKPOT_P_BPS = Math.round(HW_JACKPOT_P * 10_000); // 400

export interface HwLanded { idx: number; value: number; tier?: string }
export interface HwStep { landed: HwLanded[]; respinsAfter: number }
export interface HwRound {
  initial: HwLanded[];   // coins present on the trigger board (locked at start)
  steps: HwStep[];       // one entry per respin — drives the animation
  finalIdxs: number[];   // every locked cell index at the end
  grand: boolean;        // board filled → GRAND jackpot
  totalMultiplier: number; // Σ coin values (+ GRAND) in bet-multiples — authoritative
  coins: number;
}

// keccak256(abi.encode(randomness, tag, a, b)) reduced to a uint256. Distinct
// `tag`s keep the land / land-value / initial-value streams independent.
function hwDraw(randomness: bigint, tag: number, a: number, b: number): bigint {
  const h = keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    [randomness, BigInt(tag), BigInt(a), BigInt(b)],
  ));
  return BigInt(h);
}

function hwValueFromWord(word: bigint): { value: number; tier?: string } {
  if (word % 10_000n < BigInt(HW_JACKPOT_P_BPS)) {
    const j = HW_JACKPOTS[Number((word / 10_000n) % BigInt(HW_JACKPOTS.length))];
    return { value: j.value, tier: j.tier };
  }
  return { value: HW_COIN_VALUES[Number((word / 10_000n) % BigInt(HW_COIN_VALUES.length))] };
}

/**
 * Deterministically play a Hold & Win round from the spin's randomness.
 * `initialCoinIdxs` are the flat cell indices (row * reels + reel) of the coin
 * symbols on the trigger board. Returns the full respin sequence for animation
 * plus the authoritative total. Always terminates: each step either locks ≥1
 * cell (≤ size total) or decrements respins.
 */
export function playDeterministicHoldAndWin(
  randomness: bigint,
  initialCoinIdxs: readonly number[],
  size: number,
): HwRound {
  const locked = new Map<number, { value: number; tier?: string }>();
  const initial: HwLanded[] = [];
  for (const idx of initialCoinIdxs) {
    if (locked.has(idx) || idx < 0 || idx >= size) continue;
    const v = hwValueFromWord(hwDraw(randomness, 3, idx, 0));
    locked.set(idx, v);
    initial.push({ idx, ...v });
  }

  const steps: HwStep[] = [];
  let respins = HW_START_RESPINS;
  let step = 0;
  const maxSteps = size * (HW_START_RESPINS + 1) + HW_START_RESPINS + 5; // hard termination guard
  while (respins > 0 && locked.size < size && step < maxSteps) {
    const landed: HwLanded[] = [];
    for (let i = 0; i < size; i++) {
      if (locked.has(i)) continue;
      if (hwDraw(randomness, 1, step, i) % 10_000n < BigInt(HW_LAND_P_BPS)) {
        const v = hwValueFromWord(hwDraw(randomness, 2, step, i));
        locked.set(i, v);
        landed.push({ idx: i, ...v });
      }
    }
    respins = landed.length > 0 ? HW_START_RESPINS : respins - 1;
    steps.push({ landed, respinsAfter: respins });
    step++;
  }

  const grand = locked.size === size;
  let sum = 0;
  for (const v of locked.values()) sum += v.value;
  return {
    initial,
    steps,
    finalIdxs: [...locked.keys()],
    grand,
    totalMultiplier: sum + (grand ? HW_GRAND_VALUE : 0),
    coins: locked.size,
  };
}
