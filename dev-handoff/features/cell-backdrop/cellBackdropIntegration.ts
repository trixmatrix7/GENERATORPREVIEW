// cellBackdropIntegration.ts — how to wire the per-symbol cell backdrop.
//
// The behaviour that matters: the pocket is drawn on EACH symbol's own
// background graphic, so it travels with the symbol (spins during the spin,
// lands with it, sits permanently around it). There are exactly two hooks:
//
//   A) in your per-symbol tile draw, call drawCellPocket(bg, cellW, cellH) FIRST
//   B) in applyVisualParam, call setCellBackdropParam(...) then redraw all tiles

import { cellBackdropConfig } from './cellBackdrop';
import { numToHsl, hexToNum } from './color';

// ── A) draw it on each symbol tile ───────────────────────────────────────────
// In your symbol's "draw the static tile" method (the one that fills its
// background Graphics `bg`), draw the pocket FIRST, before the symbol art:
//
//   import { drawCellPocket } from './cellBackdrop';
//   private drawTile() {
//     const g = this.bg;
//     g.clear();
//     drawCellPocket(g, CELL_WIDTH, CELL_HEIGHT);   // ← behind the art, travels with the symbol
//     // ...draw the symbol icon/PNG on top (in a child above `bg`)...
//   }
//
// Because `bg` is a child of the symbol, it scrolls + lands with it automatically.

// ── B) apply a param, then redraw every symbol tile ──────────────────────────
/** Apply a cellBg* param into the shared config. Returns true if it belonged to
 *  us — then call your "redraw every symbol tile" (so all symbols pick it up). */
export function setCellBackdropParam(id: string, value: string | number): boolean {
  const c = cellBackdropConfig;
  switch (id) {
    case 'cellBgColor': { const { h, s, l } = numToHsl(hexToNum(String(value))); c.hue = h; c.sat = s; c.light = l; return true; }
    case 'cellBgHue': c.hue = Number(value); return true;
    case 'cellBgSaturation': c.sat = Number(value); return true;
    case 'cellBgLightness': c.light = Number(value); return true;
    case 'cellBgOpacity': c.opacity = Number(value); return true;
    case 'cellBgRadius': c.radius = Number(value); return true;
    case 'cellBgInset': c.inset = Number(value); return true;
    case 'cellBgBorderColor': c.borderColor = hexToNum(String(value)); return true;
    case 'cellBgBorderWidth': c.borderWidth = Number(value); return true;
    default: return false;
  }
}

// Wiring in your applyVisualParam:
//
//   applyVisualParam(id, value) {
//     if (setCellBackdropParam(id, value)) {
//       this.reelSet.refreshAllTiles();   // your "redraw every symbol tile"
//       return;
//     }
//     // ...your other params...
//   }
