// Baked-in "Vice" asset pack — the user's symbol art lives in public/theme/vice/
// so it ships WITH the build and persists across deploys/reloads (no more
// re-uploading after every deploy). Keyed by SymbolId. Swap the PNGs in that
// folder to change the art; the Assets tab still overrides these live per-swap.

import { SymbolId } from './symbols';

const BASE = `${import.meta.env.BASE_URL}theme/vice/`;

/** SymbolId → baked art URL. (Coin has no supplied art → falls back to theme.) */
export const VICE_SYMBOL_URLS: Record<number, string> = {
  [SymbolId.WILD]: `${BASE}symbol_wild_landing.png`,
  [SymbolId.SCATTER]: `${BASE}symbol_scatter_landing.png`,
  [SymbolId.HIGH_A]: `${BASE}symbol_high_a_landing.png`,
  [SymbolId.HIGH_B]: `${BASE}symbol_high_b_landing.png`,
  [SymbolId.MID_C]: `${BASE}symbol_mid_c_landing.png`,
  [SymbolId.MID_D]: `${BASE}symbol_mid_d_landing.png`,
  [SymbolId.LOW_E]: `${BASE}symbol_low_e_landing.png`,
  [SymbolId.LOW_F]: `${BASE}symbol_low_f_landing.png`,
  [SymbolId.LOW_G]: `${BASE}symbol_low_g_landing.png`,
};

/** Baked Vice background (Miami waterfront sunset), shipped in public/theme/vice/. */
export const VICE_BACKGROUND_URL: string | null = `${BASE}background.jpg`;

/** Fresh Map<symbolId, url> for setUserAssetTextures. */
export function viceSymbolMap(): Map<number, string> {
  return new Map(Object.entries(VICE_SYMBOL_URLS).map(([k, v]) => [Number(k), v]));
}
