// SUSHI PARTY asset bundle — 6×6 cluster + PowerNudge slot, illustrated sushi
// theme (baked into public/theme/sushiparty/). Mirrors the fruitStacksTheme.ts
// pattern (SUSHI = paths object, sushiGameIntro() = layered intro descriptor,
// sushiSymbolMap() = id → asset). NOTE: the asset folder is 'sushiparty', not
// 'sushi'; symbol art lives under a symbols/ subfolder.

import { SymbolId } from './symbols';

const S = `${import.meta.env.BASE_URL}theme/sushiparty/`;
const SF = `${S}fs/`; // free-spins art bundle (award plaque + counter plaque)

export const SUSHI = {
  base: S,
  bgBase: `${S}bg_base.png`,        // painted sushi-bar stage
  frame: `${S}frame.png`,           // grid frame (RIGHT bamboo rail = FS scatter collector)
  // NOTE: sushiparty ships no standalone logo/alt-bg export (unlike fruitstacks'
  // logo.png / bg_orchard.webp). The win-tier plates and boat are addressed
  // inline off SUSHI.base by the app's sushi branch (`${SUSHI.base}winscreen/…`).
  // FREE-SPINS art (GRATULATION award + remaining-spins counter plaque). The
  // counter digit glyphs ship 0..10 only; higher counts (retrigger → 20+) are
  // composed from the single-digit glyphs n0..n9 at render time.
  fs: {
    base: SF,
    awardBanner: `${SF}award_banner.png`,   // GRATULATION plaque backdrop
    awardText: `${SF}award_text.png`,       // baked "GRATULATION" title
    awardPress: `${SF}award_press.png`,     // breathing "CLICK TO START" prompt
    counterFrame: `${SF}counter_frame.png`, // counter plaque frame
    counterEmpty: `${SF}counter_empty.png`, // counter plaque empty face
    counterNumBase: `${SF}counter_num/`,    // n0..n10.png digit glyphs
  },
} as const;

/** Layered GAME intro descriptor — same shape/return type as
 *  fruitStacksGameIntro() so the app's intro plumbing stays uniform. The
 *  sushiparty bundle ships no dedicated intro/game/ layer art, so this returns
 *  an empty layer set; the sushi theme branch should skip setLayeredIntro when
 *  the array is empty. */
export function sushiGameIntro(): Array<{ file: string; role: string; cx: number; cy: number; tw?: number }> {
  return [];
}

/** Static symbol art (id → URL). Cluster construct: no board wild, id 1 is the
 *  scatter, ids 2-9 are the paying tiles. Same Map<number,string> shape as
 *  fruitStacksSymbolMap(). Asset filenames per the sushiparty bundle. */
export function sushiSymbolMap(): Map<number, string> {
  return new Map<number, string>([
    [SymbolId.SCATTER, `${S}symbols/symbol_scatter.png`], // 1
    [SymbolId.HIGH_A,  `${S}symbols/symbol_high_a.png`],  // 2
    [SymbolId.HIGH_B,  `${S}symbols/symbol_high_b.png`],  // 3
    [SymbolId.MID_C,   `${S}symbols/symbol_high_c.png`],  // 4
    [SymbolId.MID_D,   `${S}symbols/symbol_high_d.png`],  // 5
    [SymbolId.LOW_E,   `${S}symbols/symbol_low_e.png`],   // 6
    [SymbolId.LOW_F,   `${S}symbols/symbol_low_f.png`],   // 7
    [SymbolId.LOW_G,   `${S}symbols/symbol_low_g.png`],   // 8
    [SymbolId.COIN,    `${S}symbols/symbol_low_h.png`],   // 9
  ]);
}
