// A single symbol cell with pluggable animation states.
//
// Rendering modes (chosen per symbol, automatically):
//   - Sprite mode:  an atlas was loaded for this symbol → plays named clips
//                   from a PixiJS AnimatedSprite.
//   - Static mode:  no atlas → placeholder tile (coloured Graphics + labels),
//                   animation states play as programmatic GSAP tweens on the
//                   tile itself.
//
// Public contract — all other game code talks to this through:
//   setSymbol(id)           — swap which symbol this cell displays
//   play(state)             — transition to an animation state
//   highlight(isWinning)    — dim non-winning cells during a win reveal
//   clearState()            — return to 'static' and reset any visual tweens
//
// This file is the only place that needs to change when a new animation style
// is introduced (e.g. Spine, particles). Reel/ReelSet never touch tween code.

import { AnimatedSprite, Container, Graphics, Sprite, Spritesheet, Text, TextStyle, Texture } from 'pixi.js';
import { OutlineFilter } from 'pixi-filters';
import { gsap } from 'gsap';
import { SYMBOLS, type SymbolIdType } from '@/config/symbols';
import {
  SYMBOL_ANIMATIONS,
  type SymbolState,
} from '@/config/symbolAnimations';
import { symbolSizing } from '@/config/symbolSizing';
import { presetTimings } from '@/config/statePresets';
import { drawCellPocket } from '@/config/cellBackdrop';
import { waysImmersiveConfig } from './effects/WaysImmersive';
import { landingImpactConfig, impactSquash, impactStretch } from './effects/LandingImpact';
import type { SymbolAtlasMap } from './SymbolAtlasLoader';
import type { GameTheme } from '@/engine/GameConfig';
import { SYMBOL_HEIGHT, SYMBOL_WIDTH } from './symbolMetrics';

/** symbolId → win-state spritesheet frames (looped while the cell is in the
 *  'win' state, replacing the static art). Filled by PixiApp.setSymbolWinSheet. */
export const SYMBOL_WIN_SHEETS = new Map<number, { frames: Texture[]; fps: number }>();

/** Soft-edge mask for win-sheet overlays: the source video frames are square
 *  portraits whose art touches the frame edges — unmasked they pop as a hard
 *  CARD. A feathered rounded-rect alpha mask melts the edges away so only the
 *  character reads. Built once, shared. */
let softEdgeMask: Texture | null = null;
function getSoftEdgeMask(): Texture {
  if (softEdgeMask) return softEdgeMask;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'blur(16px)';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(26, 26, 204, 204, 48);
  ctx.fill();
  softEdgeMask = Texture.from(c);
  return softEdgeMask;
}

// Re-export so existing consumers (Reel, tests) can keep their
// `from './AnimatedSymbol'` import paths working. The canonical source is
// `./symbolMetrics`, which mirrors `DEFAULT_CELL_METRICS` in gridConfig.
export { SYMBOL_HEIGHT, SYMBOL_WIDTH };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Bright colour for the outline traced around a WINNING symbol's silhouette. */
const WIN_OUTLINE_COLOR = 0xFFF4C0;

function luminance(hex: number): number {
  return ((hex >> 16) & 0xFF) * 0.299
    + ((hex >> 8) & 0xFF) * 0.587
    + (hex & 0xFF) * 0.114;
}

function darken(hex: number, factor: number): number {
  const r = Math.round(((hex >> 16) & 0xFF) * factor);
  const g = Math.round(((hex >> 8) & 0xFF) * factor);
  const b = Math.round((hex & 0xFF) * factor);
  return (r << 16) | (g << 8) | b;
}

/** Move each channel toward white by `factor` (0 = unchanged, 1 = white). */
function lighten(hex: number, factor: number): number {
  const ch = (c: number) => Math.round(c + (255 - c) * factor);
  return (ch((hex >> 16) & 0xFF) << 16) | (ch((hex >> 8) & 0xFF) << 8) | ch(hex & 0xFF);
}

export class AnimatedSymbol extends Container {
  private readonly atlases: SymbolAtlasMap;
  /** Optional per-game theme — overrides placeholder colour + label per symbol.
   *  Atlas-driven sprites ignore this; only the static-mode tile uses it. */
  private readonly theme: GameTheme | undefined;
  /** Inner container — holds all visuals, pivoted so scale tweens stay centred. */
  private readonly inner: Container;
  private readonly bg: Graphics;
  private readonly bigLabel: Text;
  private readonly nameLabel: Text;
  private sprite: AnimatedSprite | null = null;
  /** Lucide vector icon sprite, rendered when theme.iconTextures has a hit
   *  for the current symbolId. Replaces bigLabel as the dominant glyph. */
  private iconSprite: Sprite | null = null;
  /** Dark offset copy of the icon, behind it — a cast shadow that lifts the
   *  glyph off the gem (molded object, not a flat decal). Themed icons only. */
  private iconShadow: Sprite | null = null;

  private symbolId: SymbolIdType = 0 as SymbolIdType;
  /** Win-spritesheet overlay (see SYMBOL_WIN_SHEETS / startWinSheet). */
  private winSheetSprite: Sprite | null = null;
  private winSheetTween: gsap.core.Tween | null = null;
  private preSheetIconVisible = false;
  private preSheetShadowVisible = false;
  private activeState: SymbolState = 'static';
  private tween: gsap.core.Tween | gsap.core.Timeline | null = null;
  /** Bright outline traced around the symbol's silhouette while it's winning. */
  private outline: OutlineFilter | null = null;

  constructor(atlases: SymbolAtlasMap, theme?: GameTheme) {
    super();
    this.atlases = atlases;
    this.theme = theme;

    // Static tile backdrop — a DIRECT child (behind `inner`), never scaled.
    // The cell background stays put; only the object on top of it animates.
    this.bg = new Graphics();
    this.bg.x = 0;
    this.bg.y = 0;
    this.addChild(this.bg);

    // Object layer — ONLY this is scaled by win/landing/idle, so the symbol art
    // grows WITHIN the cell while the tile stays put. Mirrors real slots and the
    // studio's transparent-object sprite sheets (120×110 cell, Spec v1.0): the
    // tile is the cell, the object lives inside it.
    this.inner = new Container();
    this.inner.x = SYMBOL_WIDTH / 2;
    this.inner.y = SYMBOL_HEIGHT / 2;
    this.addChild(this.inner);

    this.bigLabel = new Text({
      text: '?',
      style: new TextStyle({
        fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
        fontSize: 34,
        fontWeight: '800',
        fontStyle: 'italic',
        fill: 0xffffff,
      }),
    });
    this.bigLabel.anchor.set(0.5);
    this.bigLabel.y = -SYMBOL_HEIGHT * 0.1;
    this.inner.addChild(this.bigLabel);

    // Caption (placeholder dev aid) — static DIRECT child, sits on top.
    this.nameLabel = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: "'Rubik', ui-sans-serif, system-ui, sans-serif",
        fontSize: 10,
        fontWeight: '500',
        fill: 0xffffff,
        letterSpacing: 1.5,
      }),
    });
    this.nameLabel.anchor.set(0.5);
    this.nameLabel.x = SYMBOL_WIDTH / 2;
    this.nameLabel.y = SYMBOL_HEIGHT * 0.74;
    this.addChild(this.nameLabel);
  }

  /** Swap which symbol is displayed in this cell. Idempotent. */
  setSymbol(id: SymbolIdType) {
    if (id === this.symbolId && this.hasRendered) return;
    this.symbolId = id;
    this.hasRendered = true;
    this.resetVisuals();
    this.applyMode(id);
  }

  /** Pick atlas vs static mode for this symbol, with user-asset uploads
   *  taking precedence over atlas art — a user who uploads a custom PNG
   *  expects to see it regardless of whether the bundled atlas exists. */
  private applyMode(id: SymbolIdType): void {
    const userAsset = this.theme?.userAssetTextures?.get(id);
    const atlas = this.atlases[id];
    if (atlas && !userAsset) {
      this.enableSpriteMode(atlas);
    } else {
      this.enableStaticMode();
    }
  }

  /**
   * Transition to a new animation state. No-op if already in that state.
   * @param delay  Optional delay in seconds before the animation begins
   *               (used for per-row stagger on landing, per-cell stagger on win).
   */
  play(state: SymbolState, delay = 0) {
    if (state === this.activeState) return;
    this.killTween();
    this.resetVisuals();
    this.activeState = state;

    // Premiums with a WIN spritesheet get ONLY that animation: no white
    // outline (it flickered over the art), no win-juice pulse — the sheet IS
    // the whole win presentation. Everything else keeps the outline.
    const winSheetAvailable = SYMBOL_WIN_SHEETS.has(this.symbolId);
    this.setWinOutline(state === 'win' && (!winSheetAvailable || prefersReducedMotion()));

    if (state === 'static' || prefersReducedMotion()) { this.stopWinSheet(); return; }

    if (state === 'win' && winSheetAvailable) {
      this.startWinSheet();
      return; // no other win effect on top
    }
    this.stopWinSheet();

    const supported = this.supportedStates();
    if (!supported.includes(state)) return;

    if (this.sprite) {
      this.playSpriteState(state);
    } else {
      this.playFallbackState(state, delay);
    }
  }

  /** Per-symbol WIN spritesheet overlay: while the cell is in the 'win' state
   *  the sheet loops IN PLACE OF the static art (icon hidden, restored after).
   *  Filled by PixiApp.setSymbolWinSheet. */
  private startWinSheet(): void {
    if (this.winSheetSprite) return;
    const sheet = SYMBOL_WIN_SHEETS.get(this.symbolId);
    if (!sheet || sheet.frames.length === 0) return;
    // Bigger than the resting art — the win animation pops OVER the cell
    // (the lift keeps it above neighbours), with a quick back.out scale-in.
    const size = Math.min(SYMBOL_WIDTH, SYMBOL_HEIGHT) * 1.22;
    const spr = new Sprite(sheet.frames[0]);
    spr.anchor.set(0.5);
    const target = size / (sheet.frames[0].width || 256);
    spr.scale.set(target * 0.78);
    gsap.to(spr.scale, { x: target, y: target, duration: 0.28, ease: 'back.out(2.2)' });
    spr.eventMode = 'none';
    this.inner.addChild(spr);
    // Soft-edge mask: melts the square frame edges away so only the CHARACTER
    // pops — never a hard card. Parented to the sprite so it scales with it.
    const mask = new Sprite(getSoftEdgeMask());
    mask.anchor.set(0.5);
    mask.width = (sheet.frames[0].width || 256);
    mask.height = (sheet.frames[0].height || 256);
    mask.eventMode = 'none';
    spr.addChild(mask);
    spr.mask = mask;
    this.preSheetIconVisible = this.iconSprite?.visible ?? false;
    this.preSheetShadowVisible = this.iconShadow?.visible ?? false;
    if (this.iconSprite) this.iconSprite.visible = false;
    if (this.iconShadow) this.iconShadow.visible = false;
    this.winSheetSprite = spr;
    const proxy = { f: 0 };
    this.winSheetTween = gsap.to(proxy, {
      f: sheet.frames.length - 1,
      duration: sheet.frames.length / sheet.fps,
      ease: 'none',
      repeat: -1,
      onUpdate: () => { spr.texture = sheet.frames[Math.round(proxy.f) % sheet.frames.length]; },
    });
  }

  private stopWinSheet(): void {
    if (this.winSheetTween) { this.winSheetTween.kill(); this.winSheetTween = null; }
    const spr = this.winSheetSprite;
    if (!spr) return;
    this.winSheetSprite = null;
    gsap.killTweensOf(spr.scale);
    // Clean handoff: the static art comes back UNDER the overlay, then the
    // overlay shrinks back to symbol size while fading out — no hard snap
    // from the zoomed animation to the resting art.
    if (this.iconSprite) this.iconSprite.visible = this.preSheetIconVisible;
    if (this.iconShadow) this.iconShadow.visible = this.preSheetShadowVisible;
    const back = (Math.min(SYMBOL_WIDTH, SYMBOL_HEIGHT) * 0.94) / (spr.texture.width || 256);
    gsap.to(spr.scale, { x: back, y: back, duration: 0.22, ease: 'power2.inOut' });
    gsap.to(spr, {
      alpha: 0, duration: 0.24, ease: 'power1.in',
      onComplete: () => {
        spr.parent?.removeChild(spr);
        try { spr.destroy({ children: true }); } catch { /* torn down */ }
      },
    });
  }

  /** Trace a bright outline around the symbol's silhouette (the object only —
   *  `bg`/caption are static direct children, untouched). Outlines whatever the
   *  object is: placeholder glyph, themed icon, uploaded PNG, or studio sprite.
   *  The filter lives on `inner`, so it lifts above the win line with it. */
  private setWinOutline(on: boolean): void {
    if (on) {
      if (!this.outline) {
        this.outline = new OutlineFilter({ thickness: 3.5, color: WIN_OUTLINE_COLOR, quality: 0.3, alpha: 1 });
      }
      this.outline.alpha = 1; // full by default; the win pulse fades it with size
      this.inner.filters = [this.outline];
    } else {
      this.inner.filters = [];
    }
  }

  /** Dim when the cell is not part of the winning connection. Ways-immersive
   *  dims deeper and EASES the change (the smooth drop reads premium, a snap
   *  reads mechanical); the classic path keeps the instant 25% dim. The alpha
   *  tween is always killed first so rapid combo cycling never stacks. */
  highlight(isWinning: boolean) {
    gsap.killTweensOf(this, 'alpha');
    if (waysImmersiveConfig.enabled) {
      const target = isWinning ? 1.0 : waysImmersiveConfig.dimAlpha;
      gsap.to(this, { alpha: target, duration: 0.18, ease: 'power2.out' });
    } else {
      this.alpha = isWinning ? 1.0 : 0.25;
    }
  }

  clearHighlight() {
    gsap.killTweensOf(this, 'alpha');
    this.alpha = 1.0;
  }

  /** Stop any active state animation and return to neutral visuals. */
  clearState() {
    this.play('static');
  }

  /** Statically scale the OBJECT layer (icon/glyph) within the cell — the tile
   *  backdrop stays put. Used to render a bigger symbol (e.g. the sticky-wild
   *  reveal) when the default art reads too small in the cell. Call AFTER
   *  setSymbol(); a subsequent play()/clearState() resets it back to 1. */
  enlargeObject(mul: number): void {
    this.inner.scale.set(mul);
  }

  /** The symbol's OBJECT LAYER (icon/glyph/win-sheet root) — exposed so the
   *  ways-immersive presentation can move the symbol itself (leap/wiggle);
   *  win-state pulses and sheets live on the same container, so they compose. */
  get objectLayer(): Container {
    return this.inner;
  }

  private lifted = false;

  /** Lift the OBJECT layer (`inner`) out into a higher container so the win
   *  connecting line renders BEHIND the symbol. `x`/`y` are the cell centre in
   *  the target container's coordinates. GSAP keeps animating `inner` (same
   *  reference). Only used while a win is on screen (reels stopped). */
  liftObject(target: Container, x: number, y: number): void {
    if (this.lifted) return;
    this.lifted = true;
    this.inner.x = x;
    this.inner.y = y;
    target.addChild(this.inner);
  }

  /** Return the object layer to this cell and its normal z-order
   *  (bg behind, object middle, caption on top). */
  restoreObject(): void {
    if (!this.lifted) return;
    this.lifted = false;
    this.inner.x = SYMBOL_WIDTH / 2;
    this.inner.y = SYMBOL_HEIGHT / 2;
    this.addChild(this.inner);
    this.setChildIndex(this.inner, Math.min(1, this.children.length - 1));
  }

  /** One-shot squash→settle played on EVERY symbol when its reel stops, giving
   *  each stop a tactile "thunk". Lighter than the 'landing' state (no rotation,
   *  no idle follow-up) so it can run on the whole grid each spin without it
   *  feeling busy. No-op under reduced motion or if a richer state is active. */
  playLandBounce(delay = 0): void {
    if (prefersReducedMotion()) return;
    // Don't fight a richer active state (win / featured / full landing).
    if (this.activeState !== 'static') return;
    this.killTween();
    this.activeState = 'landing';
    this.inner.rotation = 0;
    this.inner.scale.set(1);
    const t = presetTimings('landBounce');
    // Landing-impact treatment: deeper squash, taller rebound, snappier hit —
    // applied on top of whatever state preset is active (LandingImpact.ts).
    const squashY = impactSquash(t.scaleSquashY);
    const stretchY = impactStretch(t.scaleStretchY);
    const snap = landingImpactConfig.enabled ? landingImpactConfig.snapMul : 1;
    this.tween = gsap
      .timeline({ delay })
      .to(this.inner.scale, {
        x: 1 / squashY, y: squashY,
        duration: t.squashDuration * snap, ease: 'power3.in',
      })
      .to(this.inner.scale, {
        x: 1 / stretchY, y: stretchY,
        duration: t.overshootDuration, ease: 'power2.out',
      })
      .to(this.inner.scale, {
        x: 1, y: 1,
        duration: t.settleDuration, ease: 'back.out(2.6)',
      });
  }

  /** Re-render the cell — used when external state the cell reads
   *  (theme.userAssetTextures, theme.iconTextures) has changed. Forces
   *  re-evaluation of atlas-vs-static mode so a user-asset upload over a
   *  symbol whose atlas was loaded correctly switches to static mode. */
  refreshTile() {
    if (!this.hasRendered) return;
    this.applyMode(this.symbolId);
  }

  /** Dispose of GSAP tweens and owned sprites before Pixi tears down the
   *  scene graph. Container itself is destroyed by the parent's recursive
   *  `app.destroy({ children: true })`; this method exists purely to stop
   *  tweens from ticking on destroyed containers. */
  dispose(): void {
    gsap.killTweensOf(this); // stray highlight-alpha tweens die with the cell
    this.killTween();
    if (this.sprite) {
      try {
        this.sprite.destroy();
      } catch {
        /* sprite may already be partially destroyed */
      }
      this.sprite = null;
    }
    // iconSprite/iconShadow share textures owned by PixiApp's lucideCache or
    // userAssetTextures map. Don't destroy the texture here — PixiApp
    // does that. Just drop our references.
    this.iconSprite = null;
    this.iconShadow = null;
    this.inner.filters = [];
    this.outline?.destroy();
    this.outline = null;
  }

  get currentState(): SymbolState {
    return this.activeState;
  }

  /** The symbol id this cell currently displays (for click-to-edit hit tests). */
  get symbol(): SymbolIdType {
    return this.symbolId;
  }

  // ─────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────
  private hasRendered = false;

  private supportedStates(): readonly SymbolState[] {
    return SYMBOL_ANIMATIONS[this.symbolId]?.states ?? [];
  }

  private enableSpriteMode(atlas: Spritesheet) {
    this.bg.visible = false;
    this.bigLabel.visible = false;
    this.nameLabel.visible = false;
    if (this.iconSprite) this.iconSprite.visible = false;
    if (this.iconShadow) this.iconShadow.visible = false;

    const initialClip =
      atlas.animations.idle ??
      atlas.animations.landing ??
      Object.values(atlas.animations)[0];

    if (!initialClip || initialClip.length === 0) {
      // Atlas present but no usable clips — fall back.
      this.enableStaticMode();
      return;
    }

    if (this.sprite) {
      this.inner.removeChild(this.sprite);
      this.sprite.destroy();
    }

    this.sprite = new AnimatedSprite(initialClip);
    this.sprite.anchor.set(0.5);
    this.sprite.width = SYMBOL_WIDTH;
    this.sprite.height = SYMBOL_HEIGHT;
    this.sprite.loop = true;
    this.sprite.animationSpeed = 0.25;
    this.sprite.play();
    this.inner.addChild(this.sprite);
  }

  private enableStaticMode() {
    if (this.sprite) {
      this.inner.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
    this.bg.visible = true;
    this.bigLabel.visible = true;
    this.nameLabel.visible = true;
    this.drawStaticTile();
  }

  private drawStaticTile() {
    const def = SYMBOLS[this.symbolId];
    const isSpecial = def.isWild || def.isScatter;
    // Rarity hierarchy — highs/specials read brighter + larger, lows recede.
    const isHigh = def.key.startsWith('high');
    const isLow = def.key.startsWith('low');
    // Theme overrides per-symbol colour. Lucide vector textures (when
    // present in theme.iconTextures) replace the big text glyph for
    // proper game-style iconography; otherwise fall back to the themed
    // emoji glyph or the production single-letter code.
    const color = this.theme?.symbolColors[this.symbolId] ?? def.placeholderColor;
    const themedGlyph = this.theme?.symbolLabels[this.symbolId];
    const userAssetTexture = this.theme?.userAssetTextures?.get(this.symbolId);
    const iconTexture = userAssetTexture ?? this.theme?.iconTextures?.get(this.symbolId);
    const isUserAsset = !!userAssetTexture;
    const bigText = themedGlyph ?? def.label;

    const g = this.bg;
    g.clear();
    const w = SYMBOL_WIDTH;
    const h = SYMBOL_HEIGHT;
    const r = 16;

    // Per-symbol cell backdrop pocket (chat-config cellBg*): drawn FIRST so it
    // sits behind the symbol art and travels with the symbol (spins + lands).
    drawCellPocket(g, w, h);

    if (!isUserAsset) {
      // Themed "gem" tile — placeholder visual when no user art is set.
      // Skipped entirely for user-uploaded PNGs so transparent backgrounds
      // show the parent frame fill through the cell instead of bleeding the
      // per-symbol colour through the alpha channel.
      // Premium recipe (all rounded rects → clean corners, no banding):
      // beveled metallic frame → inner colour panel → bottom inner shadow →
      // stacked top gloss → bright top-lit rim. Specials get a gold rim.
      const mid = color;
      const frameDark = darken(mid, 0.34);
      const topTint = lighten(mid, 0.40);   // lit top face
      const bottom = darken(mid, 0.30);     // shaded base
      const rim = isSpecial ? 0xFFE08A : lighten(mid, 0.62);
      const shade = darken(mid, 0.58);

      // Beveled outer frame (dark) — reads as a raised metallic edge.
      g.roundRect(0, 0, w, h, r);
      g.fill({ color: frameDark });

      // Inner panel: base = shaded bottom colour…
      const bx = 3, by = 3, bw = w - 6, bh = h - 6, br = r - 3;
      g.roundRect(bx, by, bw, bh, br);
      g.fill({ color: bottom });
      // …lit top face (~62%) → a real vertical light-to-dark gem gradient…
      g.roundRect(bx, by, bw, bh * 0.62, br);
      g.fill({ color: topTint, alpha: 0.92 });
      // …mid band so the two stops meet without a hard seam.
      g.roundRect(bx, by + bh * 0.40, bw, bh * 0.30, br - 1);
      g.fill({ color: mid, alpha: 0.65 });

      // Deep bottom inner shadow → seats the gem in its frame.
      g.roundRect(bx + 2, by + bh * 0.68, bw - 4, bh * 0.30, br - 1);
      g.fill({ color: shade, alpha: 0.55 });

      // Crisp top specular — stronger on highs/specials, softer on lows, so
      // rarity reads through shine as well as colour.
      const gloss1 = isSpecial ? 0.30 : isHigh ? 0.24 : isLow ? 0.13 : 0.20;
      const gloss2 = isSpecial ? 0.46 : isHigh ? 0.40 : isLow ? 0.24 : 0.34;
      g.roundRect(bx + 4, by + 3, bw - 8, bh * 0.30, br - 2);
      g.fill({ color: 0xffffff, alpha: gloss1 });
      g.roundRect(bx + 6, by + 4, bw - 12, bh * 0.14, br - 3);
      g.fill({ color: 0xffffff, alpha: gloss2 });

      // Bright top-lit rim on the panel edge + a faint outer frame highlight.
      g.roundRect(bx, by, bw, bh, br);
      g.stroke({ color: rim, width: isSpecial ? 2.5 : isHigh ? 1.9 : 1.4, alpha: isLow ? 0.5 : 0.7 });
      g.roundRect(1, 1, w - 2, h - 2, r - 1);
      g.stroke({ color: lighten(frameDark, 0.4), width: 1, alpha: 0.55 });
    }

    const textColor = luminance(color) > 160 ? 0x000000 : 0xffffff;

    if (iconTexture) {
      // Vector icon path — hide bigLabel, show the icon as a molded object.
      this.bigLabel.visible = false;
      if (!this.iconSprite) {
        this.iconSprite = new Sprite(iconTexture);
        this.iconSprite.anchor.set(0.5);
        this.inner.addChild(this.iconSprite);
      } else {
        this.iconSprite.texture = iconTexture;
      }
      // User PNGs render near-full-bleed, untinted; themed glyphs sit slightly
      // up and a touch larger now there's no caption competing for space.
      const iy = isUserAsset ? 0 : -SYMBOL_HEIGHT * 0.04;
      const baseTargetSize = isUserAsset
        // Uploaded PNGs are transparent OBJECTS placed inside the cell with
        // padding (~72%), so the win enlarge-pulse grows them within the cell.
        ? Math.round(Math.min(SYMBOL_WIDTH, SYMBOL_HEIGHT) * 0.72)
        : (isSpecial ? 64 : isHigh ? 58 : isLow ? 48 : 53);
      // Preview 'symbolSize' preset scales the object bigger/smaller in the cell.
      // Scatter renders 20% bigger — the round BONUS badge needs more presence.
      const perSymbolMul = def.isScatter ? 1.2 : 1;
      const targetSize = Math.round(baseTargetSize * symbolSizing.objectScale * perSymbolMul);
      this.iconSprite.y = iy;
      this.iconSprite.width = targetSize;
      this.iconSprite.height = targetSize;
      // Off-white (not flat #FFF) reads as polished enamel; specials get a warm
      // gold-white; dark glyphs on light tiles stay near-black for contrast.
      this.iconSprite.tint = isUserAsset
        ? 0xFFFFFF
        : (textColor === 0x000000 ? 0x1B1F27 : (isSpecial ? 0xFFF1C8 : 0xF3F6FF));
      this.iconSprite.visible = true;

      // Cast shadow — a dark, offset copy BEHIND the icon. Themed glyphs only
      // (user PNGs carry their own depth). A sprite, not a filter: ~free.
      if (!isUserAsset) {
        if (!this.iconShadow) {
          this.iconShadow = new Sprite(iconTexture);
          this.iconShadow.anchor.set(0.5);
          this.inner.addChildAt(this.iconShadow, 0);
        } else {
          this.iconShadow.texture = iconTexture;
        }
        this.iconShadow.width = targetSize;
        this.iconShadow.height = targetSize;
        this.iconShadow.x = 1.5;
        this.iconShadow.y = iy + 3;
        this.iconShadow.tint = 0x000000;
        this.iconShadow.alpha = textColor === 0x000000 ? 0.18 : 0.36;
        this.iconShadow.visible = true;
        this.inner.setChildIndex(this.iconShadow, 0); // stay directly behind
      } else if (this.iconShadow) {
        this.iconShadow.visible = false;
      }
    } else {
      // Text/emoji fallback path — hide icon + shadow, show bigLabel.
      if (this.iconSprite) this.iconSprite.visible = false;
      if (this.iconShadow) this.iconShadow.visible = false;
      this.bigLabel.visible = true;
      this.bigLabel.text = bigText;
      this.bigLabel.style.fill = textColor;
      const baseFont = themedGlyph ? 60 : (isSpecial ? 40 : isHigh ? 38 : isLow ? 30 : 34);
      // Preview 'symbolSize' preset scales text glyphs (e.g. WILD) too.
      this.bigLabel.style.fontSize = Math.round(baseFont * symbolSizing.objectScale);
      // Soft drop shadow lifts the glyph off the panel (depth, not flat ink).
      this.bigLabel.style.dropShadow = {
        alpha: 0.5, angle: Math.PI / 2, blur: 2, color: 0x000000, distance: 2,
      };
    }

    // No caption. Real slots never print the symbol code ("LOW G") on a tile —
    // the gem colour, the icon, and the special gold rim carry identity (the
    // Gift Bonanza / Fruit Fortune convention). Caption stays hidden by default.
    this.nameLabel.visible = false;
  }

  private playSpriteState(state: SymbolState) {
    if (!this.sprite) return;
    const atlas = this.atlases[this.symbolId];
    if (!atlas) return;
    const clip = atlas.animations[state];
    if (!clip || clip.length === 0) {
      this.resetVisuals();
      return;
    }
    this.sprite.textures = clip;
    this.sprite.loop = state === 'idle' || state === 'featured';
    this.sprite.onComplete =
      state === 'landing' ? () => this.transitionAfterLanding() : undefined;
    this.sprite.gotoAndPlay(0);
  }

  private playFallbackState(state: SymbolState, delay = 0) {
    switch (state) {
      case 'landing':
        this.playFallbackLanding(delay);
        return;
      case 'win':
        this.playFallbackWin(delay);
        return;
      case 'idle':
        this.playFallbackIdle();
        return;
      case 'featured':
        this.playFallbackFeatured();
        return;
    }
  }

  private playFallbackLanding(delay = 0) {
    const t = presetTimings('landing');
    this.inner.scale.set(1);
    this.inner.rotation = 0;
    // Landing-impact treatment (LandingImpact.ts): harder slam on the rich
    // wild/scatter landing too — deeper compress, taller overshoot, bigger
    // rotation kick, faster down-phase.
    const compress = impactSquash(t.scaleCompress);
    const overshoot = impactStretch(t.scaleOvershoot);
    const snap = landingImpactConfig.enabled ? landingImpactConfig.snapMul : 1;
    const rotMul = landingImpactConfig.enabled ? landingImpactConfig.rotationMul : 1;
    const rotRad = (t.rotationKick * rotMul * Math.PI) / 180;
    this.tween = gsap
      .timeline({ delay, onComplete: () => this.transitionAfterLanding() })
      // Squash down
      .to(this.inner.scale, {
        x: 1 / compress, // horizontal stretch during vertical squash
        y: compress,
        duration: t.downDuration * snap,
        ease: 'power3.in',
      })
      // Stretch up (overshoot) with rotation kick
      .to(this.inner.scale, {
        x: compress, // narrow on stretch
        y: overshoot,
        duration: t.upDuration,
        ease: 'back.out(3)',
      })
      .to(this.inner, {
        rotation: rotRad,
        duration: t.upDuration * 0.5,
        ease: 'power2.out',
      }, '<')
      // Settle back to rest
      .to(this.inner.scale, {
        x: 1,
        y: 1,
        duration: t.settleDuration,
        ease: 'elastic.out(1.2, 0.5)',
      })
      .to(this.inner, {
        rotation: 0,
        duration: t.settleDuration,
        ease: 'power2.out',
      }, '<');
  }

  /**
   * When landing finishes, transition to 'idle' if this symbol supports it
   * (typically wilds and scatters). Otherwise drop back to neutral 'static'.
   */
  private transitionAfterLanding() {
    if (this.activeState !== 'landing') return;
    if (this.supportedStates().includes('idle')) {
      this.activeState = 'static'; // reset so play('idle') proceeds
      this.play('idle');
    } else {
      this.activeState = 'static';
      this.resetVisuals();
    }
  }

  private playFallbackWin(delay = 0) {
    const t = presetTimings('win');
    this.inner.scale.set(1);
    this.inner.rotation = 0;
    this.inner.alpha = 1;

    // Clean repeating enlarge pulse (no rotation): grow big, hold, shrink back,
    // pause. The bright border highlight (outline) fades IN as the symbol grows
    // and OUT as it shrinks — so the symbol is only highlighted while bigger.
    const o = this.outline;
    if (o) o.alpha = 0;
    const tl = gsap.timeline({ delay, repeat: -1 });
    tl.to(this.inner.scale, { x: t.scalePeak, y: t.scalePeak, duration: t.pulseUp, ease: 'back.out(2)' }, 0);
    if (o) tl.to(o, { alpha: 1, duration: t.pulseUp, ease: 'power2.out' }, 0);
    tl.to(this.inner.scale, { x: t.scalePeak, y: t.scalePeak, duration: t.pulseHold }, t.pulseUp);
    tl.to(this.inner.scale, { x: 1, y: 1, duration: t.pulseDown, ease: 'power2.inOut' }, t.pulseUp + t.pulseHold);
    if (o) tl.to(o, { alpha: 0, duration: t.pulseDown, ease: 'power2.in' }, t.pulseUp + t.pulseHold);
    tl.to({}, { duration: t.pulsePause }, t.pulseUp + t.pulseHold + t.pulseDown);
    this.tween = tl;
  }

  private playFallbackIdle() {
    const t = presetTimings('idle');
    this.inner.scale.set(1);
    const baseY = this.inner.y;
    // Gentle breathe: scale pulse + vertical float for a living feel
    this.tween = gsap.timeline({ repeat: -1, yoyo: true })
      .to(this.inner.scale, {
        x: t.scalePeak,
        y: t.scalePeak,
        duration: t.breatheDuration / 2,
        ease: 'sine.inOut',
      }, 0)
      .to(this.inner, {
        y: baseY - t.floatAmplitude,
        duration: t.breatheDuration / 2,
        ease: 'sine.inOut',
      }, 0);
  }

  private playFallbackFeatured() {
    const t = presetTimings('featured');
    this.inner.alpha = 1;
    this.inner.scale.set(1);
    this.inner.rotation = 0;
    const rotRad = (t.rotationSwing * Math.PI) / 180;
    // Aggressive alpha + scale + rotation pulse — impossible to miss.
    this.tween = gsap
      .timeline({ repeat: -1, yoyo: true })
      .to(this.inner, {
        alpha: t.alphaMin,
        duration: t.glowDuration / 2,
        ease: 'power2.inOut',
      }, 0)
      .to(this.inner.scale, {
        x: t.scalePeak,
        y: t.scalePeak,
        duration: t.glowDuration / 2,
        ease: 'back.out(2)',
      }, 0)
      .to(this.inner, {
        rotation: rotRad,
        duration: t.glowDuration / 2,
        ease: 'sine.inOut',
      }, 0);
  }

  private resetVisuals() {
    this.inner.scale.set(1);
    this.inner.alpha = 1;
    this.inner.rotation = 0;
  }

  private killTween() {
    this.tween?.kill();
    this.tween = null;
  }
}
