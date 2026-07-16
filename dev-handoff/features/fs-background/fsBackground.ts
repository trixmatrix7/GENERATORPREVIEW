// fsBackground.ts — the free-spins-ONLY background swap.
//
// One texture that replaces the base background WHILE the free-spins round
// runs, restored when the round ends. Pure logic + an upload field — no
// transition screen required: enter() when the round starts, exit() when it
// ends. (If a transition screen exists later, move the enter() call to its
// fully-covered beat so the swap is invisible.) This is the exact logic from
// the preview studio, reduced to four methods + your background pipeline hooks.

import { Assets, Sprite, type Texture } from 'pixi.js';

export class FsBackground {
  private fsTexture: Texture | null = null;
  private savedBase: Texture | null = null;
  private active = false;

  // ── your background pipeline, injected once ──────────────────────────────
  // present(tex): point your background layer at `tex` WITHOUT destroying the
  //               current base texture (cover-fit sprite + any derived layers
  //               like a frosted reel backdrop must rebuild from it).
  // clear():      remove the background sprite entirely and restore whatever
  //               you show with no bg image (e.g. a gradient stage). Must NOT
  //               destroy the texture passed to the last present() call.
  // current():    the texture currently shown (null when none).
  constructor(private hooks: {
    present: (tex: Texture) => void;
    clear: () => void;
    current: () => Texture | null;
  }) {}

  /** Load / replace / clear (url = null) the FS-only background. Safe to call
   *  mid-round — the change is reflected immediately. */
  async setImage(url: string | null): Promise<void> {
    const old = this.fsTexture;
    this.fsTexture = null;
    if (url) {
      try { this.fsTexture = await Assets.load<Texture>(url); }
      catch (err) { console.warn('[FsBackground] failed to load:', err); }
    }
    if (this.active) {
      if (this.fsTexture) this.hooks.present(this.fsTexture);
      else this.exit();
    }
    if (old && old !== this.fsTexture) { try { old.destroy(true); } catch { /* torn down */ } }
  }

  /** Swap to the FS background. Call when the free-spins round STARTS (no
   *  transition needed — it's a straight swap). If a transition screen exists
   *  later, move this call to its fully-covered beat so the swap is invisible.
   *  No-op when no FS background is set. */
  enter(): void {
    if (!this.fsTexture || this.active) return;
    this.savedBase = this.hooks.current();
    this.active = true;
    this.hooks.present(this.fsTexture);
  }

  /** Restore the base background. Call when the free-spins round ends (right
   *  where you hide the round's counter/overlay). */
  exit(): void {
    if (!this.active) return;
    this.active = false;
    const base = this.savedBase;
    this.savedBase = null;
    if (base) this.hooks.present(base);
    else this.hooks.clear();
  }

  /** Teardown (call from your destroy). Handles dying mid-round without a
   *  double-destroy: the presented texture may BE the FS texture. */
  dispose(destroyBase: (tex: Texture | null) => void): void {
    this.active = false;
    const base = this.savedBase;
    this.savedBase = null;
    destroyBase(base ?? null);
    if (this.fsTexture) { try { this.fsTexture.destroy(true); } catch { /* torn down */ } this.fsTexture = null; }
  }
}

// ── reference: a reversible present() (from the preview studio) ──────────────
// The important part is that present() only REPOINTS the sprite — it must not
// destroy the previous texture (the swap has to be reversible):
//
//   private presentBgTexture(tex: Texture): void {
//     this.teardownReelBackdrop();                 // derived layers rebuild below
//     if (this.bgSprite) this.bgSprite.texture = tex;
//     else {
//       this.bgSprite = new Sprite(tex);
//       this.bgSprite.anchor.set(0.5);
//       this.app.stage.addChildAt(this.bgSprite, 0);
//     }
//     this.bgTexture = tex;
//     this.gradientStage.visible = false;
//     this.fitBackground();                        // cover-fit
//     this.updateReelBackdrop();                   // frosted copy behind reels
//   }
export type { Sprite };
