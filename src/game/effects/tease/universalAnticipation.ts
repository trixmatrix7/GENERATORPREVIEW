// UNIVERSAL ANTICIPATION — the near-miss tease as real slots stage it.
//
// No particle spam, no cheap additive washes. Three classic ingredients:
//   1. STAGE DIM — when a scatter lands, its reel's other symbols recede
//      (the runtime restores them when the tease resolves). The board
//      literally makes room for the tension.
//   2. LANDED SCATTER — one calm warm under-glow that breathes + a single
//      announcing gold ring. The scatter's own 'featured' state (deferred by
//      the runtime) carries the symbol motion — this preset only stages it.
//   3. PENDING REEL — the slot-machine marquee: a glowing frame around the
//      still-spinning reel with a bright light RUNNING around its perimeter
//      (trail behind the head), faster and brighter the deeper the tease
//      ladder goes. Entry stinger flash announces each new pending reel.
//
// Grid-agnostic (all geometry from ctx rects), theme-agnostic (ctx.accent /
// ctx.gold), zero own cleanup (ctx.layer + tracked tweens + dimCell restores
// are torn down by the runtime on hit or miss). Works unchanged for any
// game the generator stamps — this is the drop-in default.

import { Graphics } from 'pixi.js';
import type { TeasePreset, TeaseContext } from '../teaseTypes';

function softGlow(g: Graphics, cx: number, cy: number, radius: number, color: number, peak: number): void {
  const steps = 7;
  for (let i = steps; i >= 1; i--) {
    g.circle(cx, cy, radius * (i / steps));
    g.fill({ color, alpha: peak / steps });
  }
}

export const universalAnticipation: TeasePreset = {
  id: 'universal-anticipation',
  name: 'Universal Anticipation',
  description: 'Stage dim + breathing scatter glow + marquee running-light frame on the pending reel — the classic slot near-miss, theme/grid-agnostic.',

  onScatterLanded(ctx: TeaseContext, reel: number, row: number): void {
    const r = ctx.cellRect(reel, row);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    // 1. Stage dim: the landed reel's other symbols recede behind the scatter.
    for (let other = 0; other < ctx.grid.rows; other++) {
      if (other !== row) ctx.dimCell(reel, other, 0.42);
    }

    // 2. One calm warm under-glow, breathing slowly.
    const glow = new Graphics();
    softGlow(glow, cx, cy, Math.max(r.w, r.h) * 0.78, ctx.gold, 0.5);
    glow.alpha = 0;
    glow.eventMode = 'none';
    ctx.layer.addChild(glow);
    ctx.track(ctx.gsap.to(glow, { alpha: 1, duration: 0.3, ease: 'power2.out' }));
    ctx.track(ctx.gsap.to(glow, {
      alpha: 0.55, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.3,
    }));

    // 3. A single announcing ring — expands once and is gone.
    const ring = new Graphics();
    ring.circle(0, 0, Math.min(r.w, r.h) * 0.5)
      .stroke({ color: ctx.gold, width: 3, alpha: 1 });
    ring.position.set(cx, cy);
    ring.scale.set(0.7);
    ring.eventMode = 'none';
    ctx.layer.addChild(ring);
    ctx.track(ctx.gsap.to(ring.scale, { x: 1.6, y: 1.6, duration: 0.55, ease: 'power2.out' }));
    ctx.track(ctx.gsap.to(ring, {
      alpha: 0, duration: 0.55, ease: 'power1.in',
      onComplete: () => { if (ring.parent) ring.parent.removeChild(ring); ring.destroy(); },
    }));
  },

  onPendingReel(ctx: TeaseContext, reel: number, position: number): void {
    const rr = ctx.reelRect(reel);
    const pad = 3;
    const x0 = rr.x - pad;
    const y0 = rr.y - pad;
    const w = rr.w + pad * 2;
    const h = rr.h + pad * 2;

    // Marquee frame — glowing border that breathes, harder further up the
    // tease ladder.
    const border = new Graphics();
    border.roundRect(x0, y0, w, h, 14).stroke({ color: ctx.accent, width: 2.5, alpha: 1 });
    border.alpha = 0;
    border.eventMode = 'none';
    ctx.layer.addChild(border);
    const breathe = Math.min(0.85, 0.45 + position * 0.15);
    // Entry stinger: flash bright, then settle into the breathing loop.
    ctx.track(ctx.gsap.to(border, { alpha: 1, duration: 0.12, ease: 'power2.out' }));
    ctx.track(ctx.gsap.to(border, {
      alpha: breathe * 0.55, duration: 0.55, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.15,
    }));

    // The RUNNING LIGHT: a bright head + fading trail cycling the frame's
    // perimeter — the slot-machine lightbulb chase. Deeper ladder = faster.
    const per = 2 * (w + h);
    const posAt = (t: number): { x: number; y: number } => {
      let d = ((t % 1) + 1) % 1 * per;
      if (d < w) return { x: x0 + d, y: y0 };
      d -= w;
      if (d < h) return { x: x0 + w, y: y0 + d };
      d -= h;
      if (d < w) return { x: x0 + w - d, y: y0 + h };
      d -= w;
      return { x: x0, y: y0 + h - d };
    };
    const head = new Graphics();
    head.circle(0, 0, 8).fill({ color: ctx.gold, alpha: 0.35 });
    head.circle(0, 0, 4.5).fill({ color: 0xFFFFFF, alpha: 1 });
    head.blendMode = 'add';
    head.eventMode = 'none';
    const trail = [0.5, 0.28, 0.12].map(a => {
      const t = new Graphics();
      t.circle(0, 0, 3.5).fill({ color: ctx.gold, alpha: a });
      t.blendMode = 'add';
      t.eventMode = 'none';
      ctx.layer.addChild(t);
      return t;
    });
    ctx.layer.addChild(head);
    const prog = { t: ctx.rand(0, 1) };
    const lap = Math.max(0.7, 1.5 - position * 0.3);
    const place = () => {
      const p = posAt(prog.t);
      head.position.set(p.x, p.y);
      trail.forEach((tr, i) => {
        const q = posAt(prog.t - (i + 1) * 0.03);
        tr.position.set(q.x, q.y);
      });
    };
    place();
    ctx.track(ctx.gsap.to(prog, {
      t: '+=1', duration: lap, ease: 'none', repeat: -1, onUpdate: place,
    }));
  },
};
