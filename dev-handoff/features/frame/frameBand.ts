// frameBand.ts — the flat band frame around the reel grid (Hacksaw-base look).
//
// ONE flat colour band whose inner edge is the reel window and whose outer
// edge extends `width` px OUTWARD, hole-punched over the window (Graphics.cut)
// with hairline outer/inner edge rings for definition. No bevels, no sheen,
// no hardware. Universal neutral grey by default; colour/opacity/thickness
// are live params. This is the EXACT drawing used in the preview studio.

import type { Graphics } from 'pixi.js';
import { hslToNum, numToHsl, hexToNum } from './color';

/** Linear blend between two 0xRRGGBB colours (t = 0..1). */
function blendHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
  const br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
  return (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t);
}

export class FrameBand {
  // Defaults = universal neutral grey band, 22px, solid. Must match the
  // `default` values in frameParams.ts.
  hue = 0;        // 0–360
  sat = 0;        // 0–100
  light = 26;     // 0–100  (#424242-ish)
  opacity = 100;  // 0–100
  width = 22;     // px the band extends OUT from the reel-grid edge

  /** Apply a frame* param change. Returns true if this id belonged to us
   *  (then redraw — see draw()). */
  set(id: string, value: string | number): boolean {
    switch (id) {
      case 'frameColor': {
        const { h, s, l } = numToHsl(hexToNum(String(value)));
        this.hue = h; this.sat = s; this.light = l;
        return true;
      }
      case 'frameHue':        this.hue = Number(value); return true;
      case 'frameSaturation': this.sat = Number(value); return true;
      case 'frameLightness':  this.light = Number(value); return true;
      case 'frameOpacity':    this.opacity = Number(value); return true;
      case 'frameWidth':      this.width = Number(value); return true;
      default: return false;
    }
  }

  /** Current colour as "#rrggbb" — keeps a colour <input> in sync with the
   *  H/S/L sliders (same two-way pattern as the reel-background handoff). */
  get hex(): string {
    return '#' + (hslToNum(this.hue, this.sat, this.light) & 0xffffff).toString(16).padStart(6, '0');
  }

  /** Redraw the band into `g` around the reel window rect (winX/winY/winW/winH
   *  in the same local space as `g`). Call on every param change — cheap.
   *  Hairlines are FILLED RINGS, not strokes (strokes flicker at non-integer
   *  scale). */
  draw(g: Graphics, winX: number, winY: number, winW: number, winH: number): void {
    const t = Math.max(0, this.width);
    const a = Math.max(0, Math.min(100, this.opacity)) / 100;
    g.clear();
    if (t <= 0 || a <= 0) return;
    const base = hslToNum(this.hue, this.sat, this.light);
    const edge = blendHex(base, 0x000000, 0.35);
    const oX = winX - t, oY = winY - t, oW = winW + t * 2, oH = winH + t * 2;
    // the band itself (hole-punched over the reel window)
    g.roundRect(oX, oY, oW, oH, 12).fill({ color: base, alpha: a });
    g.roundRect(winX, winY, winW, winH, 10).cut();
    // hairline definition: outer edge…
    g.roundRect(oX, oY, oW, oH, 12).fill({ color: edge, alpha: a });
    g.roundRect(oX + 1.5, oY + 1.5, oW - 3, oH - 3, 11).cut();
    // …and inner (grid) edge
    g.roundRect(winX - 1.5, winY - 1.5, winW + 3, winH + 3, 11).fill({ color: edge, alpha: a });
    g.roundRect(winX, winY, winW, winH, 10).cut();
  }
}
