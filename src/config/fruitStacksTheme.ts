// FRUIT STACKS asset bundle — 6×5 scatter-pays tumbler, illustrated fruit
// theme (Noski's Higgsfield art, baked via the chroma-key pipeline into
// public/theme/fruitstacks/). Mirrors the crackFarmTheme.ts pattern.

import { SymbolId, FRUIT_LOW_I, FRUIT_GIFT_T1, FRUIT_GIFT_T2, FRUIT_GIFT_T3 } from './symbols';

const F = `${import.meta.env.BASE_URL}theme/fruitstacks/`;

export const FRUITSTACKS = {
  base: F,
  bgBase: `${F}bg_base.webp`,      // purple bokeh stage (Noski 2026-07-21)
  bgOrchard: `${F}bg_orchard.webp`,// warm cartoon orchard (alternative)
  logo: `${F}logo.png`,
  frame: `${F}frame.png`,          // gold rounded frame (frame_a.png = red alt)
} as const;

/** Static symbol art (id → URL) — Noski's glossy pack ("symbols transparent",
 *  2026-07-21), the full 9-pay reference construct. Slot 0 is the GIFT
 *  (multiplier) — no board wild in this construct (wild_w.png reserved);
 *  the ×N value renders as an engine badge hanging at the gift's bottom,
 *  never baked into the art. Id 9 doubles as lemon, id 10 = watermelon. */
/** Layered GAME intro ("intro screen (1).zip", 1920×1080 design space).
 *  Every element re-measured against the composite: the grids are 'card'
 *  (static — they carry pay-text that must not warp), the centre pieces are
 *  'symbol' (whole-object y-float, no in-place scaling → stays sharp), the
 *  logo breathes+sways as hero, CLICK TO START pulses. The bokeh bg is
 *  'coverbg' so it drift-zooms behind everything. The left grid has no solo
 *  export — it is diff-extracted from the composite (composite − background). */
export function fruitStacksGameIntro(): Array<{ file: string; role: string; cx: number; cy: number; tw?: number }> {
  // v2-Pack "BONUS (30)" (2026-07-24): Grids kamen VOR-positioniert, die
  // Mitte-Elemente zentriert → Positionen aus dem Komposit diff-vermessen.
  const I = `${F}intro/game/`;
  return [
    { file: `${I}bg_intro2.webp`, role: 'coverbg', cx: 960, cy: 540 },
    { file: `${I}left_grid2.webp`, role: 'card', cx: 484.5, cy: 590.5, tw: 607 },
    { file: `${I}right_grid2.webp`, role: 'card', cx: 1433.5, cy: 620.5, tw: 619 },
    { file: `${I}logo2.webp`, role: 'logo', cx: 960, cy: 179, tw: 354 },
    { file: `${I}gift2.webp`, role: 'symbol', cx: 961.5, cy: 469.5, tw: 231 },
    { file: `${I}maxwin2.webp`, role: 'symbol', cx: 960, cy: 702.5, tw: 288 },
    { file: `${I}x50002.webp`, role: 'symbol', cx: 961.5, cy: 832.5, tw: 225 },
    { file: `${I}press2.webp`, role: 'press', cx: 957, cy: 991, tw: 330 },
  ];
}

export function fruitStacksSymbolMap(): Map<number, string> {
  return new Map<number, string>([
    [SymbolId.WILD, `${F}gift_tier1.png`],        // GIFT base = silver tier (no gold base in this construct)
    // FS-Lettern FREISTEHEND (Noski 2026-07-23, "nimm was besser passt"):
    // wie das Winna-W wirkt der Scatter als zellsprengendes Letterform-Objekt;
    // die gerahmte Kachel-Variante hätte den Free-Floating-Look gebrochen.
    [SymbolId.SCATTER, `${F}symbol_scatter_fs.png`],
    [SymbolId.HIGH_A, `${F}symbol_high_a.png`],   // heart
    [SymbolId.HIGH_B, `${F}symbol_high_b.png`],   // gold star
    [SymbolId.MID_C, `${F}symbol_mid_c.png`],     // blue star
    [SymbolId.MID_D, `${F}symbol_mid_d.png`],     // green diamond
    [SymbolId.LOW_E, `${F}symbol_low_e.png`],     // cherries
    [SymbolId.LOW_F, `${F}symbol_low_f.png`],     // grapes
    [SymbolId.LOW_G, `${F}symbol_low_g.png`],     // orange
    [SymbolId.COIN, `${F}symbol_low_h.png`],      // lemon (id 9 as LOW_H)
    [FRUIT_LOW_I, `${F}symbol_low_i.png`],        // watermelon (10)
    [FRUIT_GIFT_T1, `${F}gift_tier1.png`],        // gift ×2-5 (silver)
    [FRUIT_GIFT_T2, `${F}gift_tier2.png`],        // gift ×6-30 (red)
    [FRUIT_GIFT_T3, `${F}gift_tier3.png`],        // gift ×31-500 (gold)
  ]);
}
