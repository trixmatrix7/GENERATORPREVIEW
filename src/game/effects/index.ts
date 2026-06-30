// game/effects/index.ts — Layer 6/8 grid effects + Layer 9 transition. Each
// effect is grid-relative (positions resolved from the layout, never raw px) so
// it works on both 5x5 and 5x3.

import { Container, Sprite, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { glowTexture, ringTexture, discTexture } from '../textures';
import type { GridLayout } from '../../config/gridConfig';
import type { CanvasTheme } from '../../config/canvasTheme';

// ── Police lights (full-grid red/blue alternating wash) ──────────────────────
export class PoliceLights {
  private left: Sprite;
  private right: Sprite;
  private tl?: gsap.core.Timeline;
  constructor(private layer: Container, layout: GridLayout, theme: CanvasTheme) {
    const w = layout.width * 1.2;
    const h = layout.height * 1.6;
    this.left = new Sprite(glowTexture(theme.policeRed));
    this.right = new Sprite(glowTexture(theme.policeBlue));
    for (const s of [this.left, this.right]) {
      s.anchor.set(0.5);
      s.width = w;
      s.height = h;
      s.blendMode = 'add';
      s.alpha = 0;
      s.y = layout.height / 2;
      layer.addChild(s);
    }
    this.left.x = layout.width * 0.16;
    this.right.x = layout.width * 0.84;
  }
  start(intensity = 1): void {
    if (this.tl) return;
    this.left.alpha = 0.6 * intensity;
    this.right.alpha = 0.12 * intensity;
    this.tl = gsap.timeline({ repeat: -1, yoyo: true });
    this.tl.to(this.left, { alpha: 0.12 * intensity, duration: 0.23, ease: 'none' }, 0);
    this.tl.to(this.right, { alpha: 0.6 * intensity, duration: 0.23, ease: 'none' }, 0);
  }
  stop(): void {
    this.tl?.kill();
    this.tl = undefined;
    gsap.to([this.left, this.right], { alpha: 0, duration: 0.26 });
  }
  destroy(): void {
    this.tl?.kill();
    this.left.destroy();
    this.right.destroy();
  }
}

// ── Scatter orbit light (per landed scatter cell) ────────────────────────────
export interface OrbitHandle {
  stop(): void;
}
export function orbitScatter(
  layer: Container,
  center: { x: number; y: number },
  cell: number,
  theme: CanvasTheme,
): OrbitHandle {
  const ring = new Sprite(ringTexture(theme.glow));
  ring.anchor.set(0.5);
  ring.width = ring.height = cell * 1.1;
  ring.position.set(center.x, center.y);
  ring.blendMode = 'add';
  ring.alpha = 0;
  layer.addChild(ring);
  gsap.to(ring, { alpha: 0.6, duration: 0.3 });

  const big = new Sprite(discTexture(theme.glow));
  const small = new Sprite(discTexture(0xffffff));
  big.anchor.set(0.5);
  small.anchor.set(0.5);
  big.width = big.height = cell * 0.34;
  small.width = small.height = cell * 0.2;
  big.blendMode = 'add';
  small.blendMode = 'add';
  layer.addChild(big, small);

  const R = cell * 0.48;
  const proxy = { a: 0 };
  const spin = gsap.to(proxy, {
    a: Math.PI * 2,
    duration: 0.82,
    ease: 'none',
    repeat: -1,
    onUpdate: () => {
      big.position.set(center.x + Math.cos(proxy.a) * R * 0.92, center.y + Math.sin(proxy.a) * R * 0.92);
      small.position.set(center.x + Math.cos(proxy.a + Math.PI) * R * 0.58, center.y + Math.sin(proxy.a + Math.PI) * R * 0.58);
    },
  });

  return {
    stop() {
      spin.kill();
      gsap.to([ring, big, small], { alpha: 0, duration: 0.2, onComplete: () => { ring.destroy(); big.destroy(); small.destroy(); } });
    },
  };
}

// ── Sweat column highlight (gold frame on pending reels) ─────────────────────
export class SweatColumns {
  private strips = new Map<number, { frame: Graphics; glow: Sprite; pulse?: gsap.core.Tween }>();
  constructor(private layer: Container, private layout: GridLayout, private theme: CanvasTheme) {}

  setPending(reels: number[], activeReel: number): void {
    for (const reel of reels) {
      if (!this.strips.has(reel)) this.strips.set(reel, this.makeStrip(reel));
      const s = this.strips.get(reel)!;
      const active = reel === activeReel;
      gsap.to(s.frame, { alpha: active ? 1 : 0.6, duration: 0.2 });
      gsap.to(s.glow, { alpha: active ? 0.95 : 0.4, duration: 0.2 });
      if (active && !s.pulse) {
        s.pulse = gsap.to(s.glow, { alpha: 0.6, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      } else if (!active && s.pulse) {
        s.pulse.kill();
        s.pulse = undefined;
      }
    }
  }

  private makeStrip(reel: number): { frame: Graphics; glow: Sprite } {
    const x = this.layout.reelX(reel);
    const w = this.layout.cellW;
    const h = this.layout.height;
    const glow = new Sprite(glowTexture(this.theme.goldFrame));
    glow.anchor.set(0.5);
    glow.width = w * 1.6;
    glow.height = h * 1.05;
    glow.position.set(x + w / 2, h / 2);
    glow.blendMode = 'add';
    glow.alpha = 0;
    const frame = new Graphics();
    frame.roundRect(x + 2, 2, w - 4, h - 4, 10);
    frame.stroke({ width: 4.5, color: this.theme.goldFrame, alpha: 1 });
    frame.roundRect(x + 5, 5, w - 10, h - 10, 8);
    frame.stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });
    frame.alpha = 0;
    this.layer.addChild(glow, frame);
    return { frame, glow };
  }

  clear(): void {
    for (const [, s] of this.strips) {
      s.pulse?.kill();
      gsap.to([s.frame, s.glow], { alpha: 0, duration: 0.24, onComplete: () => { s.frame.destroy(); s.glow.destroy(); } });
    }
    this.strips.clear();
  }

  destroy(): void {
    this.clear();
  }
}

// ── Free Spins transition (spin/shrink out, spin/scale in) ───────────────────
export function fsSpinOut(target: Container, layout: GridLayout): Promise<void> {
  target.pivot.set(layout.width / 2, layout.height / 2);
  target.position.set(target.position.x + layout.width / 2, target.position.y + layout.height / 2);
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(target, { rotation: Math.PI * 2.5, duration: 0.6, ease: 'power2.in' }, 0);
    tl.to(target.scale, { x: 0.02, y: 0.02, duration: 0.6, ease: 'power2.in' }, 0);
    tl.to(target, { alpha: 0, duration: 0.6, ease: 'power2.in' }, 0);
  });
}

export function fsSpinIn(target: Container): Promise<void> {
  target.rotation = -Math.PI * 2;
  target.scale.set(0.05);
  target.alpha = 0;
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: () => { target.rotation = 0; resolve(); } });
    tl.to(target, { rotation: 0, duration: 0.52, ease: 'power3.out' }, 0);
    tl.to(target.scale, { x: 1, y: 1, duration: 0.52, ease: 'back.out(1.2)' }, 0);
    tl.to(target, { alpha: 1, duration: 0.36, ease: 'power2.out' }, 0);
  });
}
