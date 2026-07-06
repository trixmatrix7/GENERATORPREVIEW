// ─────────────────────────────────────────────────────────────────────────────
// StickyWildPop — DEV DROP-IN (visual only)
//
// This is JUST the AAA "sticky wild" POP + SHINE animation on a single cell.
// It is intentionally self-contained and carries NO game logic:
//   • NO random 3–25 wild count
//   • NO math / RTP / board / persistence
//   • NO project-specific art (uses a plain placeholder "WILD" box)
//
// You (the dev) wire this to YOUR real wild cells for your use case: call
// applyStickyWildPop(layer, cellRect) for each cell that should get the
// treatment, and keep the returned handle to remove it. Everything about the
// LOOK is driven by the config object below — tune those values (pop speed,
// shine speed / thickness / strength, border, glow, breath) to taste.
//
// Deps: pixi.js v8, gsap v3 (both already in the project).
// ─────────────────────────────────────────────────────────────────────────────

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';

/** Everything tunable about the look. Change these to edit the animation. */
export interface StickyWildPopConfig {
  /** Border / rim colour (0xRRGGBB). */
  borderColor: number;
  /** Diagonal shine-sweep colour. */
  shineColor: number;

  // ── Pop-in (the "pop" when the wild appears) ──
  /** Pop-in duration in ms — BIGGER = slower pop. */
  popMs: number;
  /** Scale the cell pops in FROM (0.72 = a punchy pop; 1 = no pop). */
  popFromScale: number;

  // ── Breath (subtle idle pulse after the pop) ──
  /** Breath cycle in ms (one direction). 0 disables the breath. */
  breathMs: number;
  /** Max breath scale (1.02 = very subtle; 1 = off). */
  breathScale: number;

  // ── Shine sweep (the light that runs across the cell) ──
  /** One sweep crossing in ms — SMALLER = faster shine. */
  shineSweepMs: number;
  /** Pause between sweeps in ms. */
  shineGapMs: number;
  /** Shine band width as a fraction of the cell width — SMALLER = thinner. */
  shineWidthFactor: number;
  /** Shine brightness 0..1 — keep it subtle. */
  shineStrength: number;

  // ── Border + glow ──
  /** Crisp inner border thickness in px — thinner/thicker. */
  borderWidth: number;
  /** Soft outer glow thickness in px. */
  glowWidth: number;
  /** Soft outer glow max alpha 0..1. */
  glowStrength: number;

  /** Corner radius as a fraction of the smaller cell side (0.16 ≈ slot cell). */
  cornerRadiusFactor: number;
}

/** Default look — matches the preview 1:1. Copy + tweak per use case. */
export const DEFAULT_STICKY_WILD_POP: StickyWildPopConfig = {
  borderColor: 0xffd24a,
  shineColor: 0xffffff,
  popMs: 400,
  popFromScale: 0.72,
  breathMs: 1440,
  breathScale: 1.02,
  shineSweepMs: 770,
  shineGapMs: 1680,
  shineWidthFactor: 0.42,
  shineStrength: 0.42,
  borderWidth: 2.5,
  glowWidth: 5,
  glowStrength: 0.3,
  cornerRadiusFactor: 0.16,
};

/** A few ready colour presets (feed .borderColor). */
export const STICKY_WILD_POP_COLORS: Record<string, number> = {
  gold: 0xffd24a,
  ice: 0x8fdcff,
  emerald: 0x7dffb0,
  violet: 0xc79bff,
  magenta: 0xff8fd6,
  white: 0xffffff,
};

export interface CellRect { x: number; y: number; w: number; h: number; }
export interface StickyWildPopHandle { destroy(): void; }

/**
 * Apply the sticky-wild POP + SHINE overlay to one cell. Pure visual: draws an
 * animated border + glow + shine sweep + breath over the given rect. Returns a
 * handle — call .destroy() to remove it (e.g. when the wild leaves the board).
 *
 * @param layer  a Pixi Container that sits ABOVE your reel cells.
 * @param rect   the cell rectangle in `layer`'s local space (top-left origin).
 * @param cfg    look config (defaults to DEFAULT_STICKY_WILD_POP).
 */
export function applyStickyWildPop(
  layer: Container,
  rect: CellRect,
  cfg: StickyWildPopConfig = DEFAULT_STICKY_WILD_POP,
): StickyWildPopHandle {
  const w = rect.w, h = rect.h, hw = w / 2, hh = h / 2;
  const r = Math.min(w, h) * cfg.cornerRadiusFactor;
  const root = new Container();
  root.position.set(rect.x + hw, rect.y + hh); // centred so it pops/breathes from the middle
  root.alpha = 0;
  root.eventMode = 'none';
  layer.addChild(root);

  const tweens: gsap.core.Animation[] = [];
  const popS = Math.max(0.05, cfg.popMs / 1000);
  const breathS = Math.max(0.1, cfg.breathMs / 1000);

  // Soft outer glow (additive, gently pulsing) — reads as a lit frame.
  const outer = new Graphics();
  outer.roundRect(-hw - 3, -hh - 3, w + 6, h + 6, r + 3)
    .stroke({ color: cfg.borderColor, width: cfg.glowWidth, alpha: cfg.glowStrength });
  outer.blendMode = 'add';
  root.addChild(outer);

  // Crisp border + a thin white inset highlight.
  const inner = new Graphics();
  inner.roundRect(-hw + 0.5, -hh + 0.5, w - 1, h - 1, r)
    .stroke({ color: cfg.borderColor, width: cfg.borderWidth, alpha: 0.98 });
  inner.roundRect(-hw + 3, -hh + 3, w - 6, h - 6, r - 2)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
  root.addChild(inner);

  // Glassy top gloss.
  const gloss = new Graphics();
  gloss.roundRect(-hw + 5, -hh + 4, w - 10, h * 0.24, r - 3).fill({ color: 0xffffff, alpha: 0.1 });
  gloss.blendMode = 'add';
  root.addChild(gloss);

  // Diagonal shine sweep, masked to the cell.
  const shineWrap = new Container();
  const mask = new Graphics();
  mask.roundRect(-hw, -hh, w, h, r).fill(0xffffff);
  shineWrap.addChild(mask);
  shineWrap.mask = mask;
  root.addChild(shineWrap);
  const bandW = w * cfg.shineWidthFactor;
  const shine = new Graphics();
  shine.rect(-bandW * 0.5, -h, bandW * 0.34, h * 2).fill({ color: cfg.shineColor, alpha: cfg.shineStrength * 0.38 });
  shine.rect(-bandW * 0.16, -h, bandW * 0.34, h * 2).fill({ color: cfg.shineColor, alpha: cfg.shineStrength });
  shine.rotation = -0.5;
  shine.blendMode = 'add';
  shineWrap.addChild(shine);

  // ── Animations ──
  // Pop in (scale + fade), then settle into the calm breath.
  root.scale.set(cfg.popFromScale);
  tweens.push(gsap.to(root, { alpha: 1, duration: popS * 0.65, ease: 'power2.out' }));
  tweens.push(gsap.to(root.scale, { x: 1, y: 1, duration: popS, ease: 'back.out(2.4)' }));
  tweens.push(gsap.to(outer, { alpha: Math.min(1, cfg.glowStrength * 2.4), duration: breathS * 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
  if (cfg.breathScale > 1) {
    tweens.push(gsap.to(root.scale, {
      x: cfg.breathScale, y: cfg.breathScale, duration: breathS,
      yoyo: true, repeat: -1, ease: 'sine.inOut', delay: popS + 0.02,
    }));
  }
  const sweepS = Math.max(0.05, cfg.shineSweepMs / 1000);
  const sweep = gsap.timeline({ repeat: -1, repeatDelay: cfg.shineGapMs / 1000, delay: 0.3 });
  sweep
    .fromTo(shine, { x: -w * 0.95, alpha: 0 }, { x: w * 0.95, alpha: 1, duration: sweepS, ease: 'power1.inOut' })
    .to(shine, { alpha: 0, duration: 0.18 }, '>-0.08');
  tweens.push(sweep);

  let dead = false;
  const destroy = () => {
    if (dead) return;
    dead = true;
    for (const t of tweens) t.kill();
    if (root.parent) root.parent.removeChild(root);
    root.destroy({ children: true });
  };
  return { destroy };
}

/**
 * PLACEHOLDER wild cell — a plain gem-style box with a "WILD" label, so you can
 * see the pop 1:1 WITHOUT any project art. Replace this with your real wild
 * symbol when you wire the feature in. Returns the Container (add to your scene).
 */
export function drawPlaceholderWildCell(rect: CellRect, label = 'WILD'): Container {
  const w = rect.w, h = rect.h, r = Math.min(w, h) * 0.16;
  const cell = new Container();
  cell.position.set(rect.x, rect.y);
  const g = new Graphics();
  g.roundRect(0, 0, w, h, r).fill({ color: 0x141019 });                 // dark cell base
  g.roundRect(3, 3, w - 6, h * 0.5, r - 2).fill({ color: 0x2a2340, alpha: 0.9 }); // top sheen panel
  g.roundRect(1, 1, w - 2, h - 2, r - 1).stroke({ color: 0x3a3350, width: 1, alpha: 0.7 });
  cell.addChild(g);
  const txt = new Text({
    text: label,
    style: new TextStyle({
      fontFamily: 'system-ui, sans-serif', fontSize: Math.round(Math.min(w, h) * 0.24),
      fontWeight: '800', fontStyle: 'italic', fill: 0xffe08a, letterSpacing: 1,
    }),
  });
  txt.anchor.set(0.5);
  txt.position.set(w / 2, h / 2);
  cell.addChild(txt);
  return cell;
}

/**
 * One-call DEMO: draw a placeholder wild cell into `layer` and pop the sticky-
 * wild treatment on it. Handy to eyeball the look; delete for production.
 */
export function demoStickyWildPop(
  layer: Container,
  rect: CellRect,
  cfg: StickyWildPopConfig = DEFAULT_STICKY_WILD_POP,
): StickyWildPopHandle {
  layer.addChild(drawPlaceholderWildCell(rect));
  return applyStickyWildPop(layer, rect, cfg);
}
