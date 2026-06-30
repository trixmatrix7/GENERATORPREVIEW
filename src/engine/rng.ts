// engine/rng.ts — provably-fair seed handling. The on-chain VRF delivers a
// `bytes32 randomness`; the board + every feature derive deterministically from
// it, byte-identically to SlotGame.sol. The preview just supplies the seed
// (random per spin, or pinned for reproducible tests) — NO Math.random in the
// outcome path beyond picking the seed itself, exactly like the contract.

import { keccak256, encodeAbiParameters } from 'viem';
import { REEL_COUNT, REEL_LENGTH } from './reels';

export type Hex = `0x${string}`;

/** Cryptographically-random 32-byte seed (the VRF word stand-in). */
export function randomSeed(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex as Hex;
}

export const toBig = (h: Hex): bigint => BigInt(h);

/** Mirror of _deriveStops: stops[i] = (seed % LEN); seed /= LEN. */
export function deriveStops(randomness: bigint): number[] {
  let seed = randomness;
  const len = BigInt(REEL_LENGTH);
  const stops: number[] = [];
  for (let i = 0; i < REEL_COUNT; i++) {
    stops.push(Number(seed % len));
    seed = seed / len;
  }
  return stops;
}

/** Mirror of the free-spins seed: keccak256(abi.encode(randomness, index)). */
export function freeSpinSeed(randomness: bigint, index: number): bigint {
  const encoded = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }],
    [randomness, BigInt(index)],
  );
  return BigInt(keccak256(encoded));
}

/** Mirror of _hwDraw: uint256(keccak256(abi.encode(randomness, tag, a, b))). */
export function hwDraw(randomness: bigint, tag: number, a: number, b: number): bigint {
  const encoded = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    [randomness, BigInt(tag), BigInt(a), BigInt(b)],
  );
  return BigInt(keccak256(encoded));
}
