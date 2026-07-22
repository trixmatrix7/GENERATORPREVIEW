// STUDIO-ONLY math resolution — the single source the generated config files
// (reels.ts, paytable.ts) read to serve the ACTIVE math profile.
//
// Why this exists: in the dev's pipeline every stamped game gets its own
// reels.ts/paytable.ts baked by contractRenderer — the client-side outcome
// decode (SlotEngine.decodeSpinOutcome → buildBoard + evaluateWins with
// DEFAULT_GAME_CONFIG) therefore ALWAYS matches the display. Our studio swaps
// math profiles at runtime instead of re-stamping, so without this the decode
// kept evaluating the ORIGINAL Fantasy strips/pays while the reels displayed
// the profile's — win combos landed on cells showing unrelated symbols
// ("random connections"). Resolving the profile HERE, at module load, makes
// DEFAULT_GAME_CONFIG itself carry the active math (its strips/pays/grid all
// derive from these config files) while src/engine/* stays byte-identical.
//
// Constant-per-page-load is safe: every profile/grid switch in the studio
// does a full window.location.reload().
//
// Must stay import-light (symbols + data JSONs only) — paytable.ts imports us,
// so importing paytable types here would be a cycle.

import { SymbolId } from './symbols';
import vol3x5 from '@/data/math_vol3_5x5.json';
import vol3x3 from '@/data/math_vol3_5x3.json';
import viceHeat from '@/data/math_vice_heat.json';
import crackFarm from '@/data/math_crack_farm.json';
import crackFarm10k from '@/data/math_crack_farm_10k.json';
import crackFarm15k from '@/data/math_crack_farm_15k.json';
import fruitStacks from '@/data/math_fruit_stacks.json';

type Pay3 = [number, number, number];

export interface ActiveMathOverride {
  reelStrips: number[][];
  visibleRows: number;
  payTable: Partial<Record<number, Pay3>>;
  scatterPay: Pay3;
}

// Same manifest→profile ids and symbol-key mapping as mathProfiles.fromManifest
// (kept in sync — both must agree or display and decode diverge again).
const MANIFESTS: Record<string, Record<string, unknown>> = {
  'vol3-5x5': vol3x5 as Record<string, unknown>,
  'vol3-5x3': vol3x3 as Record<string, unknown>,
  'vice-heat-custom': viceHeat as Record<string, unknown>,
  'crack-farm-lines': crackFarm as Record<string, unknown>,
  'crack-farm-lines-10k': crackFarm10k as Record<string, unknown>,
  'crack-farm-lines-15k': crackFarm15k as Record<string, unknown>,
  'fruit-stacks-tumble': fruitStacks as Record<string, unknown>,
};

/** Raw math-manifest JSON for a profile id (null for manifest-less profiles
 *  like 'fantasy-extreme'). Used by the v2 preset exporter so the export
 *  always ships the CURRENT certified manifest of the active profile — the
 *  partner once received a hard-coded stale one. */
export function manifestForProfile(id: string): Record<string, unknown> | null {
  return MANIFESTS[id] ?? null;
}

const KEY_TO_ID: Record<string, number> = {
  wild: SymbolId.WILD, scatter: SymbolId.SCATTER,
  highA: SymbolId.HIGH_A, highB: SymbolId.HIGH_B,
  midC: SymbolId.MID_C, midD: SymbolId.MID_D,
  lowE: SymbolId.LOW_E, lowF: SymbolId.LOW_F, lowG: SymbolId.LOW_G,
  coin: SymbolId.COIN,
};

function readLS(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** The active profile's math, or null when the baked Fantasy math is active. */
export const ACTIVE_MATH: ActiveMathOverride | null = (() => {
  // Same game-aware default as mathProfiles.loadMathProfileId — the two
  // registries MUST agree or display and decode diverge (fresh visitors
  // used to fall back to the legacy fantasy math with its x18 FS wins).
  const gameDefault = readLS('active-game') === 'crackfarm' ? 'crack-farm-lines'
    : readLS('active-game') === 'fruitstacks' ? 'fruit-stacks-tumble'
    : 'vice-heat-custom';
  const m = MANIFESTS[readLS('studio-math') ?? gameDefault];
  if (!m) return null;
  const payTable: Partial<Record<number, Pay3>> = {};
  for (const [k, v] of Object.entries(m['payTable'] as Record<string, Pay3>)) {
    const id = KEY_TO_ID[k] ?? Number(k);
    if (Number.isFinite(id)) payTable[id] = v;
  }
  return {
    reelStrips: m['reelStrips'] as number[][],
    visibleRows: m['gridId'] === '5x5' || m['gridId'] === '6x5' ? 5 : 3,
    payTable,
    scatterPay: (m['scatterPay'] as Pay3) ?? [40, 219, 1495],
  };
})();

/** Rows for the DEFAULT (Fantasy) math — follows the studio grid toggle so a
 *  5×3 session decodes/evaluates 3 rows, matching what the reels display. */
export const DEFAULT_MATH_ROWS: number = readLS('studio-grid') === '5x3' ? 3 : 5;
