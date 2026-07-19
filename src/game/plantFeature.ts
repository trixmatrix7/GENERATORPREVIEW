// CRACK FARM — base-game PLANT FEATURE (shared derivation).
//
// The screen darkens mid-spin, the green pads light up and 1..5 plants slide
// in, each carrying its own multiplier; that spin is then evaluated with the
// plants standing as full-reel wilds.
//
// Why it derives from the STOPS instead of riding in the game state: the
// settled state is encoded with a fixed field list and decoded by
// src/engine/* , which is byte-identical to the dev repo and must not change.
// Adding a "featureTriggered" field would fork the decode. So both sides —
// mockHost when it settles, PixiApp when it presents — call THIS function with
// the same stops and independently arrive at the same plants and multipliers.
// Anything that changes here changes payouts; keep the two callers in sync.
//
// Weights + odds are certified in custom-math/simulate_crack_farm_v2.py.

/** Small deterministic hash → a 32-bit unsigned int.
 *
 *  The murmur3 finalizer at the end is not optional: without it the low bits
 *  barely move across the small input space (stops are all < 64), and
 *  `hash % 150` only ever reached 37 of the 150 residues — zero among them,
 *  so the feature never fired once in 300k spins. */
function hash32(nums: readonly number[], salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (const n of nums) {
    h ^= n + 0x9e3779b9;
    h = Math.imul(h, 0x01000193) >>> 0;
    h = ((h << 13) | (h >>> 19)) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function pickWeighted(weights: readonly number[], r: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;            // guard: empty/zero table → r % 0 is NaN
  let x = r % total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return 0;
}

export interface PlantFeatureConfig {
  baseFeatureOdds?: number;
  /** [multiplier, weight] pairs. */
  baseFeatureMultipliers?: [number, number][];
  plantCountWeights?: number[];
}

// Safety-net fallback only — the real values ride in the math JSON's `custom`
// block. These MATCH the certified BASE_MULTI_TABLE in
// custom-math/simulate_crack_farm_v2.py (top 256x); the earlier 512x draft was
// the pre-tuning table the certification rejected.
const DEFAULT_MULTIS: [number, number][] = [
  [2, 620], [4, 240], [8, 90], [16, 32], [32, 11],
  [64, 4], [128, 2], [256, 1],
];
const DEFAULT_COUNT_WEIGHTS = [575, 280, 130, 12, 3];

/**
 * The base-game plant feature for this spin, or null when it does not fire.
 *
 * @param stops        the spin's reel stops (the shared seed)
 * @param wildCapable  reels a plant may occupy
 * @returns reel -> that plant's multiplier
 */
export function baseFeaturePlants(
  stops: readonly number[],
  wildCapable: readonly number[],
  cfg: PlantFeatureConfig,
): Map<number, number> | null {
  const odds = cfg.baseFeatureOdds ?? 0;
  if (odds <= 0 || wildCapable.length === 0) return null;
  if (hash32(stops, 0x5eed) % odds !== 0) return null;

  const countWeights = cfg.plantCountWeights ?? DEFAULT_COUNT_WEIGHTS;
  const want = Math.min(
    pickWeighted(countWeights, hash32(stops, 0xc0117)) + 1,
    wildCapable.length,
  );

  // Deterministic shuffle of the capable reels.
  const pool = [...wildCapable];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = hash32(stops, 0x5117 + i) % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const table = cfg.baseFeatureMultipliers ?? DEFAULT_MULTIS;
  const weights = table.map(([, w]) => w);
  const out = new Map<number, number>();
  pool.slice(0, want).forEach((reel, i) => {
    out.set(reel, table[pickWeighted(weights, hash32(stops, 0x11117 + i * 7919))][0]);
  });
  return out;
}
