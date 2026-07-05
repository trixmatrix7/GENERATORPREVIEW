// StickyWildShine — an AAA "sticky wild" treatment on a wild cell. NO lock icon:
// a premium animated glow border + an orbiting sheen node + a diagonal shine
// sweep + a subtle breath, so the wild reads as special/locked-in without a
// literal padlock. Purely visual/additive — no logic/RTP change. Applied per
// wild cell from ReelSet after the board lands; self-cleaning on the next spin.
// Registry: baseFeatures `sticky-wild-shine`. Live-tunable via
// stickyWild / stickyWildColor / stickyWildSpeed.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
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

let _glow: Texture | null = null;
function glowTex(): Texture {
  if (_glow) return _glow;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _glow = Texture.from(cv);
  return _glow;
}

/** Point on the rounded-rect perimeter at param t∈[0,1) (corners approximated). */
function perimeterPoint(t: number, hw: number, hh: number): { x: number; y: number } {
  const w = 2 * hw, h = 2 * hh, P = 2 * (w + h);
  let d = (((t % 1) + 1) % 1) * P;
  if (d < w) return { x: -hw + d, y: -hh };
  d -= w;
  if (d < h) return { x: hw, y: -hh + d };
  d -= h;
  if (d < w) return { x: hw - d, y: hh };
  d -= w;
  return { x: -hw, y: hh - d };
}

export interface StickyHandle {
  destroy(): void;
}

/** rect = cell rect (ReelSet-local, top-left origin). Returns a handle. */
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
  layer.addChild(root);
  const tweens: gsap.core.Animation[] = [];
  const speed = Math.max(0.4, cfg.speedMs / 1000);

  // outer soft glow border (additive, pulsing)
  const outer = new Graphics();
  outer.roundRect(-hw - 3, -hh - 3, w + 6, h + 6, r + 3).stroke({ color: cfg.borderColor, width: 6, alpha: 0.35 });
  outer.blendMode = 'add';
  root.addChild(outer);

  // crisp inner border + white inset highlight (the "different" border)
  const inner = new Graphics();
  inner.roundRect(-hw, -hh, w, h, r).stroke({ color: cfg.borderColor, width: 2.5, alpha: 0.95 });
  inner.roundRect(-hw + 2.5, -hh + 2.5, w - 5, h - 5, r - 2).stroke({ color: 0xffffff, width: 1, alpha: 0.45 });
  root.addChild(inner);

  // orbiting sheen node running around the border
  const node = new Sprite(glowTex());
  node.anchor.set(0.5);
  node.blendMode = 'add';
  node.width = node.height = Math.min(w, h) * 0.42;
  root.addChild(node);

  // diagonal shine sweep, masked to the cell
  const shineWrap = new Container();
  const mask = new Graphics();
  mask.roundRect(-hw, -hh, w, h, r).fill(0xffffff);
  shineWrap.addChild(mask);
  shineWrap.mask = mask;
  root.addChild(shineWrap);
  const bandW = w * 0.42;
  const shine = new Graphics();
  // A touch stronger than a whisper — still barely there (client: "etwas
  // stärker machen, kaum erkennbar"). Two stacked bands read as a soft edge
  // + brighter core as the sweep crosses the cell.
  shine.rect(-bandW * 0.5, -h, bandW * 0.34, h * 2).fill({ color: cfg.shineColor, alpha: 0.16 });
  shine.rect(-bandW * 0.16, -h, bandW * 0.34, h * 2).fill({ color: cfg.shineColor, alpha: 0.42 });
  shine.rotation = -0.5;
  shine.blendMode = 'add';
  shineWrap.addChild(shine);

  // animations — pop in (scale + fade), then settle into the calm breath.
  root.scale.set(0.72);
  tweens.push(gsap.to(root, { alpha: 1, duration: 0.26, ease: 'power2.out' }));
  tweens.push(gsap.to(root.scale, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2.4)' }));
  tweens.push(gsap.to(outer, { alpha: 0.8, duration: speed * 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
  tweens.push(gsap.to(root.scale, { x: 1.03, y: 1.03, duration: speed * 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.42 }));
  const orbit = { t: 0 };
  tweens.push(
    gsap.to(orbit, {
      t: 1,
      duration: speed,
      repeat: -1,
      ease: 'none',
      onUpdate: () => {
        const p = perimeterPoint(orbit.t, hw, hh);
        node.position.set(p.x, p.y);
      },
    }),
  );
  const sweep = gsap.timeline({ repeat: -1, repeatDelay: speed * 0.7 });
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
