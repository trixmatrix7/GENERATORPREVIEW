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

/** Layered GAME intro. Each element PNG is a full 1920×1080 pre-positioned
 *  frame, so every layer sits at the design centre (cx 960, cy 540) at natural
 *  size and they composite into the full intro. Roles drive the motion
 *  (logo floats/swells, press pulses, background + cards + text stay static). */
export function crackFarmGameIntro(): Array<{ file: string; role: string; cx: number; cy: number }> {
  const I = `${C}intro/`;
  const L = (name: string, role: string) => ({ file: `${I}${name}`, role, cx: 960, cy: 540 });
  return [
    L('bg.png', 'card'),  // the intro's own bg (static, shown)
    L('card-left.png', 'card'),
    L('card-mid.png', 'card'),
    L('card-right.png', 'card'),
    L('text-sticky.png', 'text'),
    L('text-expanding.png', 'text'),
    L('text-bonus.png', 'text'),
    L('text-max.png', 'text'),
    L('text-win.png', 'text'),
    L('text-crack.png', 'text'),
    L('logo.png', 'logo'),
    L('press.png', 'press'),
  ];
}
