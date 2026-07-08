// frameIntegration.ts — how to wire the flat band frame.
//
// One FrameBand instance owns the five values; one Graphics shows the band.
// Two touch-points: (A) build it once, (B) route the frame* params to it.
// Just as important: REMOVE the old decorations around the grid — see the
// "What we removed (and why)" section in the README.

import { FrameBand } from './frameBand';
import type { Graphics } from 'pixi.js';

// ── A) build once ─────────────────────────────────────────────────────────────
// Add ONE Graphics to your game container, layered UNDER the reels (the band
// only draws outside the window, so exact z vs. the reels doesn't matter as
// long as it's under any overlays). Then draw:
//
//   private frameBand = new FrameBand();
//   private frameGraphic = new Graphics();
//   this.gameContainer.addChild(this.frameGraphic);
//   this.redrawFrame();
//
//   private redrawFrame() {
//     // the reel window rect in the SAME local space as frameGraphic:
//     this.frameBand.draw(this.frameGraphic, WIN_X, WIN_Y, WIN_W, WIN_H);
//   }
//
// IMPORTANT — theme independence: if your setTheme()/skin pass repaints frame
// graphics, replace that repaint with a plain this.redrawFrame() call. The
// band must NOT be overdrawn from theme colours (that was the bug where the
// old border kept reappearing on top).

// ── B) route the params ───────────────────────────────────────────────────────
// In applyVisualParam:
//
//   applyVisualParam(id, value) {
//     if (this.frameBand.set(id, value as string | number)) {
//       this.redrawFrame();
//       return;
//     }
//     // ...your other params...
//   }
//
// Colour picker ⇄ slider sync in the params panel: identical pattern to the
// reel-background handoff — on 'frameColor' write hue/sat/light into the
// slider values (frameBand already updates its own state), on any of the
// three sliders write frameBand.hex back into the picker value.

export { FrameBand };
export type { Graphics };
