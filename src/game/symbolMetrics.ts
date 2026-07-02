// Symbol cell metrics — single source of truth.
//
// V1 declared SYMBOL_WIDTH / SYMBOL_HEIGHT inside `AnimatedSymbol.ts`,
// SYMBOL_GAP / CELL_HEIGHT inside `Reel.ts`, and REEL_GAP inside
// `ReelSet.ts`. Each was an independent module-level `const` — silent
// drift between them and `DEFAULT_CELL_METRICS` in `src/config/gridConfig.ts`
// was possible without anything raising an alarm.
//
// This module is the side-effect-free re-export point: every renderer
// file imports its metrics from here, and the anchor resolver shares the
// same source via `DEFAULT_CELL_METRICS`. The anchor-parity test now
// runtime-imports from this file too, so any change in one place
// surfaces immediately at the gate.
//
// Pure re-export only — no behaviour, no Pixi/GSAP dependencies.

import { DEFAULT_CELL_METRICS } from '@/config/gridConfig';

/** Width of a single symbol cell in CSS pixels (120 in V1). */
export const SYMBOL_WIDTH = DEFAULT_CELL_METRICS.symbolWidth;

/** Height of a single symbol cell in CSS pixels (110 in V1). */
export const SYMBOL_HEIGHT = DEFAULT_CELL_METRICS.symbolHeight;

/** Vertical gap between cells within a reel column (6 in V1).
 *  Each row owns its bottom gap — see gridConfig.buildLayout's height note. */
export const SYMBOL_GAP = DEFAULT_CELL_METRICS.symbolGap;

/** Horizontal gap between adjacent reel columns (8 in V1). */
export const REEL_GAP = DEFAULT_CELL_METRICS.reelGap;

/** Vertical spacing between adjacent symbol cells: symbolHeight + symbolGap.
 *  Reel.ts and the anchor resolver use this as the per-row pitch (116 in V1). */
export const CELL_HEIGHT = SYMBOL_HEIGHT + SYMBOL_GAP;
