// StickyWildShine — an AAA "sticky wild" treatment on a wild cell. NO lock icon
// and NO orbiting ring: a clean premium frame — a soft glow edge, a crisp gold
// double-border with a white inset, a glassy top gloss, and a subtle diagonal
// shine sweep + a calm breath. Purely visual/additive — it's an OVERLAY that
// sits on top of an existing (opaque) wild, so it draws no fill of its own.
// The reveal path (ReelSet.playStickyWildReveal) supplies the opaque wild tile
// underneath so a still-spinning reel never shows through.
// Registry: baseFeatures `sticky-wild-shine`. Live-tunable via
// stickyWild / stickyWildColor / stickyWildSpeed.

import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';

export interface StickyWildConfig {
  enabled: boolean;
  borderColor: number;
  shineColor: number;
  speedMs: number;
}
export const stickyWildConfig: StickyWildConfig = {
  enabled: true,
  borderColor: 0xffd24a,
  shineColor: 0xffffff,
  speedMs: 2400,
};

export const STICKY_WILD_PRESETS: Record<string, { color: number; label: string }> = {
  gold: { color: 0xffd24a, label: 'Gold' },
  ice: { color: 0x8fdcff, label: 'Ice' },
  emerald: { color: 0x7dffb0, label: 'Emerald' },
  violet: { color: 0xc79bff, label: 'Violet' },
  magenta: { color: 0xff8fd6, label: 'Magenta' },
  white: { color: 0xffffff, label: 'White' },
};
export const STICKY_WILD_SPEED_MS: Record<string, number> = { calm: 3200, normal: 2400, lively: 1500 };

const active = new Set<() => void>();
export function clearAllStickyWild(): void {
  for (const c of [...active]) c();
  active.clear();
}

export interface StickyHandle {
  destroy(): void;
}

/** rect = cell rect (ReelSet-local, top-left origin). Draws a border/shine
 *  OVERLAY only (transparent centre). Returns a handle. */
export function applyStickyWild(
  layer: Container,
  rect: { x: number; y: number; w: number; h: number },
  cfg: StickyWildConfig = stickyWildConfig,
): StickyHandle {
  const w = rect.w, h = rect.h, hw = w / 2, hh = h / 2;
  const r = Math.min(w, h) * 0.16;
  const root = new Container();
  root.position.set(rect.x + hw, rect.y + hh);
  root.alpha = 0;
  root.eventMode = 'none';
  layer.addChild(root);
  const tweens: gsap.core.Animation[] = [];
  const speed = Math.max(0.4, cfg.speedMs / 1000);

  // Outer soft glow edge (additive, gently pulsing) — reads as a lit frame.
  const outer = new Graphics();
  outer.roundRect(-hw - 3, -hh - 3, w + 6, h + 6, r + 3).stroke({ color: cfg.borderColor, width: 5, alpha: 0.3 });
  outer.blendMode = 'add';
  root.addChild(outer);

  // Crisp gold double-border with a white inset highlight — the premium edge.
  const inner = new Graphics();
  inner.roundRect(-hw + 0.5, -hh + 0.5, w - 1, h - 1, r).stroke({ color: cfg.borderColor, width: 2.5, alpha: 0.98 });
  inner.roundRect(-hw + 3, -hh + 3, w - 6, h - 6, r - 2).stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
  root.addChild(inner);

  // Glassy top gloss — a faint bright band hugging the inner top edge.
  const gloss = new Graphics();
  gloss.roundRect(-hw + 5, -hh + 4, w - 10, h * 0.24, r - 3).fill({ color: 0xffffff, alpha: 0.1 });
  gloss.blendMode = 'add';
  root.addChild(gloss);

  // Diagonal shine sweep, masked to the cell. A touch stronger than a whisper
  // but still barely there (client: "etwas stärker, kaum erkennbar").
  const shineWrap = new Container();
  const mask = new Graphics();
  mask.roundRect(-hw, -hh, w, h, r).fill(0xffffff);
  shineWrap.addChild(mask);
  shineWrap.mask = mask;
  root.addChild(shineWrap);
  const bandW = w * 0.42;
  const shine = new Graphics();
  shine.rect(-bandW * 0.5, -h, bandW * 0.34, h * 2).fill({ color: cfg.shineColor, alpha: 0.16 });
  shine.rect(-bandW * 0.16, -h, bandW * 0.34, h * 2).fill({ color: cfg.shineColor, alpha: 0.42 });
  shine.rotation = -0.5;
  shine.blendMode = 'add';
  shineWrap.addChild(shine);

  // Animations — pop in (scale + fade), then settle into the calm breath.
  root.scale.set(0.72);
  tweens.push(gsap.to(root, { alpha: 1, duration: 0.26, ease: 'power2.out' }));
  tweens.push(gsap.to(root.scale, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2.4)' }));
  tweens.push(gsap.to(outer, { alpha: 0.72, duration: speed * 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
  tweens.push(gsap.to(root.scale, { x: 1.02, y: 1.02, duration: speed * 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.42 }));
  const sweep = gsap.timeline({ repeat: -1, repeatDelay: speed * 0.7, delay: 0.3 });
  sweep
    .fromTo(shine, { x: -w * 0.95, alpha: 0 }, { x: w * 0.95, alpha: 1, duration: speed * 0.32, ease: 'power1.inOut' })
    .to(shine, { alpha: 0, duration: 0.18 }, '>-0.08');
  tweens.push(sweep);

  let dead = false;
  const destroy = () => {
    if (dead) return;
    dead = true;
    for (const t of tweens) t.kill();
    if (root.parent) root.parent.removeChild(root);
    root.destroy({ children: true });
    active.delete(destroy);
  };
  active.add(destroy);
  return { destroy };
}
