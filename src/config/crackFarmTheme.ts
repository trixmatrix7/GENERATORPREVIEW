// Crack Farm — a SECOND baked game theme (5×3 barn slot), shipped in
// public/theme/crackfarm/. Selected via the "Crack Farm 5×3" preset chip
// (setActiveGame('crackfarm') + grid 5x3). Everything the App theme-wiring
// effect needs for the Crack Farm branch lives here so the Vice branch stays
// byte-identical.

import { SymbolId } from './symbols';

const C = `${import.meta.env.BASE_URL}theme/crackfarm/`;

/** SymbolId → baked art URL (512×512 transparent icons). */
export const CRACKFARM_SYMBOL_URLS: Record<number, string> = {
  [SymbolId.WILD]:   `${C}symbol_wild_landing.png`,
  [SymbolId.SCATTER]:`${C}symbol_scatter_landing.png`,
  [SymbolId.HIGH_A]: `${C}symbol_high_a_landing.png`,
  [SymbolId.HIGH_B]: `${C}symbol_high_b_landing.png`,
  [SymbolId.MID_C]:  `${C}symbol_mid_c_landing.png`,
  [SymbolId.MID_D]:  `${C}symbol_mid_d_landing.png`,
  [SymbolId.LOW_E]:  `${C}symbol_low_e_landing.png`,
  [SymbolId.LOW_F]:  `${C}symbol_low_f_landing.png`,
  [SymbolId.LOW_G]:  `${C}symbol_low_g_landing.png`,
};

export function crackFarmSymbolMap(): Map<number, string> {
  return new Map(Object.entries(CRACKFARM_SYMBOL_URLS).map(([k, v]) => [Number(k), v]));
}

export const CRACKFARM = {
  base: C,
  bgBase: `${C}bg_base.webp`,
  bgFs: `${C}bg_fs.webp`,
  frame: `${C}frame.webp`,         // barn frame; alpha window auto-detected
  logo: `${C}logo.webp`,
  expandingWild: `${C}wild_column.png`, // 512×1536 tall 1×3 wild
  // Win-marquee tier art (positioned wooden-slime badges + number plate) —
  // same layered shape as Vice, so it drops into setWinTierImages.
  winTiers: {
    big: `${C}win/big.png`, mega: `${C}win/mega.png`, epic: `${C}win/epic.png`,
    max: `${C}win/max.png`, win: `${C}win/win.png`, plate: `${C}win/price-area.png`,
  },
};

/** GAME intro. The zip's separate element PNGs are each CENTRED in their own
 *  1920×1080 frame (not pre-positioned to their final left/middle/right spots),
 *  so compositing them all at centre just stacks them. `intro/full.png` is the
 *  artist's correct one-piece assembly (barn scene + CRACK FARM logo + the 3
 *  feature cards + PRESS TO CONTINUE), so we show it as a single full-cover
 *  layer — guaranteed-correct, with the iris-open + gentle cover breath. */
export function crackFarmGameIntro(): Array<{ file: string; role: string; cx: number; cy: number }> {
  return [{ file: `${C}intro/full.png`, role: 'coverbg', cx: 960, cy: 540 }];
}
