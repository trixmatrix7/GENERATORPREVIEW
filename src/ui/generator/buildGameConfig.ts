// Bridge wizard math profile → engine GameConfig.
// Centralises key normalisation (math agent emits string keys like 'wild' /
// 'highA'; engine uses numeric SymbolId) and theme lookup so the wizard
// preview is fed exactly the same shape as production game code.

import { SymbolId } from '@/config/symbols';
import { getThemeByName } from '@/config/themes';
import { GRID_5x3, GRID_5x5, type GridConfig } from '@/config/gridConfig';
import type { GameConfig } from '@/engine/GameConfig';
import type { PayEntry } from '@/config/paytable';

const KEY_TO_ID: Record<string, number> = {
  wild: SymbolId.WILD, WILD: SymbolId.WILD, '0': SymbolId.WILD,
  scatter: SymbolId.SCATTER, SCATTER: SymbolId.SCATTER, '1': SymbolId.SCATTER,
  highA: SymbolId.HIGH_A, HIGH_A: SymbolId.HIGH_A, high_a: SymbolId.HIGH_A, '2': SymbolId.HIGH_A,
  highB: SymbolId.HIGH_B, HIGH_B: SymbolId.HIGH_B, high_b: SymbolId.HIGH_B, '3': SymbolId.HIGH_B,
  midC: SymbolId.MID_C, MID_C: SymbolId.MID_C, mid_c: SymbolId.MID_C, '4': SymbolId.MID_C,
  midD: SymbolId.MID_D, MID_D: SymbolId.MID_D, mid_d: SymbolId.MID_D, '5': SymbolId.MID_D,
  lowE: SymbolId.LOW_E, LOW_E: SymbolId.LOW_E, low_e: SymbolId.LOW_E, '6': SymbolId.LOW_E,
  lowF: SymbolId.LOW_F, LOW_F: SymbolId.LOW_F, low_f: SymbolId.LOW_F, '7': SymbolId.LOW_F,
  lowG: SymbolId.LOW_G, LOW_G: SymbolId.LOW_G, low_g: SymbolId.LOW_G, '8': SymbolId.LOW_G,
  coin: SymbolId.COIN, COIN: SymbolId.COIN, '9': SymbolId.COIN, // Hold & Win money symbol
};

/**
 * Build a complete GameConfig from a math agent's output + theme name.
 * Returns null if math is unusable so callers can fall through to the default.
 *
 * Math agents use `freeSpinMultiplier` (singular); the engine's GameConfig
 * uses `freeSpinsMultiplier` (plural). Helper adapts the name and applies
 * sensible fallbacks for any missing FS params.
 */
export function buildGameConfigFromMathProfile(
  profile: Record<string, unknown> | null | undefined,
  themeName: string | undefined,
  features?: readonly string[],
): GameConfig | null {
  if (!profile) return null;

  const reelStrips = profile['reelStrips'] as number[][] | undefined;
  const rawPayTable = profile['payTable'] as Record<string, PayEntry> | undefined;
  const scatterPay = profile['scatterPay'] as PayEntry | undefined;
  if (!reelStrips || !rawPayTable || !scatterPay) return null;

  const payTable: Partial<Record<number, PayEntry>> = {};
  for (const [k, v] of Object.entries(rawPayTable)) {
    const id = KEY_TO_ID[k] ?? Number(k);
    if (Number.isFinite(id)) payTable[id] = v;
  }

  return {
    gridConfig: resolveGridConfig(profile),
    reelStrips,
    reelLengths: reelStrips.map(s => s.length),
    payTable,
    scatterPay,
    freeSpinsCount: (profile['freeSpinsCount'] as number) ?? 12,
    freeSpinsCap: (profile['freeSpinsCap'] as number) ?? 50,
    freeSpinsMultiplier:
      (profile['freeSpinsMultiplier'] as number | undefined) ??
      (profile['freeSpinMultiplier'] as number | undefined) ??
      5,
    maxWinMultiplier: (profile['maxWinMultiplier'] as number) ?? 5000,
    theme: getThemeByName(themeName),
    // Gate the anticipation tease on the build's feature list. Undefined when
    // no features are supplied → enabled (default behaviour preserved).
    nearMissTease: features ? features.includes('near-miss-tease') : undefined,
    // Bonus-buy cost (× bet) when the feature is selected. Uses the manifest's
    // RTP-fair value (stamped by scripts/compute-bonus-buy.ts); falls back to
    // 100× if a manifest predates the math pass. Loose sanity clamp only.
    bonusBuyCost: features?.includes('bonus-buy')
      ? Math.max(5, Math.min(1000, Number(profile['bonusBuyCost']) || 100))
      : undefined,
  };
}

/** Resolve the grid shape from a math profile. Stage 1 math profiles are
 *  all 5×3 (V1 carry-over); when Stage 2 ships 5×5 profiles they declare
 *  `gridId: '5x5'` or `visibleRows: 5` on the manifest. Falls back to 5×3
 *  for any V1 manifest without grid metadata. */
function resolveGridConfig(profile: Record<string, unknown>): GridConfig {
  const id = profile['gridId'] ?? profile['grid'];
  if (id === '5x5') return GRID_5x5;
  if (id === '5x3') return GRID_5x3;
  const visibleRows = profile['visibleRows'] as number | undefined;
  if (visibleRows === 5) return GRID_5x5;
  return GRID_5x3;
}
