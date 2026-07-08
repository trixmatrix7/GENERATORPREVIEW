// ReelBgTint — framework-agnostic controller for the reel-window colour tint.
//
// It owns the four HSL/opacity values and keeps the colour picker + the
// hue/saturation/brightness sliders in perfect agreement. You feed it a param
// change with set(id, value); you read `.rgb` (0xRRGGBB) and `.alpha` (0..1) to
// paint your reel-backdrop layer, and `.hex` to drive a colour <input>.
//
// No engine/renderer dependency — wire it into whatever draws behind your reels.

import { hslToNum, numToHsl, hexToNum, hslToHex } from './color';

export class ReelBgTint {
  // Defaults reproduce a neutral dark backdrop (near-black @ 62%). Must match
  // the `default` values in reelBackgroundParams.ts.
  hue = 220;      // 0–360
  sat = 0;        // 0–100
  light = 4;      // 0–100
  opacity = 62;   // 0–100

  /** Apply a reelBg* param change. Returns true if this id belonged to us
   *  (so your applyVisualParam can early-return after a redraw). */
  set(id: string, value: string | number): boolean {
    switch (id) {
      case 'reelBgColor': {
        // A picked colour drives the H/S/L so the sliders mirror the picker.
        const { h, s, l } = numToHsl(hexToNum(String(value)));
        this.hue = h; this.sat = s; this.light = l;
        return true;
      }
      case 'reelBgHue':        this.hue = Number(value); return true;
      case 'reelBgSaturation': this.sat = Number(value); return true;
      case 'reelBgLightness':  this.light = Number(value); return true;
      case 'reelBgOpacity':    this.opacity = Number(value); return true;
      default: return false;
    }
  }

  /** Tint colour as 0xRRGGBB — fill your reel-window rect with this. */
  get rgb(): number { return hslToNum(this.hue, this.sat, this.light); }

  /** Tint alpha 0..1 (the transparency slider). */
  get alpha(): number { return Math.max(0, Math.min(100, this.opacity)) / 100; }

  /** Current colour as "#rrggbb" — use to keep the colour <input> in sync when
   *  a slider moves. */
  get hex(): string { return hslToHex(this.hue, this.sat, this.light); }
}

// ── Example wiring (PixiJS-style; adapt to your reel-backdrop layer) ──────────
//
//   private reelBgTint = new ReelBgTint();
//   private reelTint = new Graphics();   // added over your frosted/blurred bg,
//                                        // clipped to the reel window
//
//   applyVisualParam(id: string, value: string | number | boolean) {
//     if (this.reelBgTint.set(id, value as string | number)) {
//       this.redrawReelTint();
//       return;
//     }
//     // ...your other params...
//   }
//
//   private redrawReelTint() {
//     const { x, y, w, h } = this.reelWindowRect;   // your reel area, in px
//     this.reelTint.clear();
//     this.reelTint.roundRect(x, y, w, h, 10);
//     this.reelTint.fill({ color: this.reelBgTint.rgb, alpha: this.reelBgTint.alpha });
//   }
