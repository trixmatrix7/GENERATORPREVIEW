// FRUIT STACKS asset bundle — 6×5 scatter-pays tumbler, illustrated fruit
// theme (Noski's Higgsfield art, baked via the chroma-key pipeline into
// public/theme/fruitstacks/). Mirrors the crackFarmTheme.ts pattern.

import { SymbolId } from './symbols';

const F = `${import.meta.env.BASE_URL}theme/fruitstacks/`;

export const FRUITSTACKS = {
  base: F,
  bgBase: `${F}bg_base.webp`,
  logo: `${F}logo.png`,
} as const;

/** Static symbol art (id → URL). Slot 0 (the engine's wild slot) is the
 *  MULTIPLIER CRATE — Fruit Stacks has no wild; the ×N value renders as an
 *  engine text badge over the crate, never baked into the art. */
export function fruitStacksSymbolMap(): Map<number, string> {
  return new Map<number, string>([
    [SymbolId.WILD, `${F}symbol_multi.png`],      // crate (multiplier)
    [SymbolId.SCATTER, `${F}symbol_scatter.png`], // B starfruit
    [SymbolId.HIGH_A, `${F}symbol_high_a.png`],   // pineapple
    [SymbolId.HIGH_B, `${F}symbol_high_b.png`],   // watermelon
    [SymbolId.MID_C, `${F}symbol_mid_c.png`],     // grapes
    [SymbolId.MID_D, `${F}symbol_mid_d.png`],     // strawberry
    [SymbolId.LOW_E, `${F}symbol_low_e.png`],     // orange
    [SymbolId.LOW_F, `${F}symbol_low_f.png`],     // lemon
    [SymbolId.LOW_G, `${F}symbol_low_g.png`],     // cherries
  ]);
}
