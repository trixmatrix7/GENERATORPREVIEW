// Per-symbol cell backdrop (chat-config cellBg* params). A rounded pocket drawn
// behind EACH symbol tile, so it travels with the symbol — spins during the
// spin, lands with it, and sits permanently around the resting symbol. Module
// singleton so every AnimatedSymbol reads the same live config; ReelSet updates
// it and calls refreshAllTiles() to redraw.

import type { Graphics } from 'pixi.js';
import { hslToNum } from './color';

export const cellBackdropConfig = {
  hue: 240, sat: 20, light: 8, opacity: 45,   // fill (default: subtle dark pocket)
  radius: 14, inset: 3,                        // shape
  borderColor: 0xffffff, borderWidth: 0,       // outline (0 = none)
};

/** Draw the cell pocket onto `g` for a w×h symbol tile (origin at 0,0). */
export function drawCellPocket(g: Graphics, w: number, h: number): void {
  const c = cellBackdropConfig;
  const color = hslToNum(c.hue, c.sat, c.light);
  const alpha = Math.max(0, Math.min(100, c.opacity)) / 100;
  const pw = Math.max(1, w - c.inset * 2), ph = Math.max(1, h - c.inset * 2);
  const rad = Math.max(0, Math.min(c.radius, pw / 2, ph / 2));
  if (alpha > 0) g.roundRect(c.inset, c.inset, pw, ph, rad).fill({ color, alpha });
  if (c.borderWidth > 0) g.roundRect(c.inset, c.inset, pw, ph, rad).stroke({ color: c.borderColor, width: c.borderWidth, alpha: 1 });
}
