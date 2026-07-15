// UNIVERSAL ANTICIPATION v2 — "GOLD STRIKE".
//
// No bulb chases, no cheap glow washes. Four ingredients, all vector-drawn
// (crisp at any grid/theme — this is the generator's drop-in default):
//   1. STAGE DIM — the landed reel's other symbols recede (runtime restores).
//   2. LANDED SCATTER — a one-shot golden RAY BURST + ballistic spark pops
//      announce the hit; then premium CORNER BRACKETS breathe around the cell
//      while the symbol itself drifts as a WHOLE OBJECT (bounce-in + gentle
//      float via ctx.cellNode — never in-place scaling, which warps art).
//   3. PENDING REEL — a clean double GOLD BORDER (no running lights) with
//      rising golden energy INSIDE the spinning reel: a soft sheen sweep +
//      ember particles floating up, masked to the reel window.
//   4. SEQUENTIAL — reels arm ONE AFTER ANOTHER (position-staggered), not
//      all at once: the gate lights up just as the previous reel stops.
//
// Grid-agnostic (all geometry from ctx rects), theme-agnostic (ctx.gold),
// zero own cleanup (ctx.layer + tracked tweens + dim/node restores are torn
// down by the runtime on hit or miss).

import { Container, Graphics } from 'pixi.js';
import type { TeasePreset, TeaseContext } from '../teaseTypes';

export const universalAnticipation: TeasePreset = {
  id: 'universal-anticipation',
  name: 'Universal Anticipation',
  description: 'Gold-strike burst + breathing corner brackets on landed scatters; sequential gold-gate reels with rising ember energy — theme/grid-agnostic.',

  onScatterLanded(ctx: TeaseContext, reel: number, row: number): void {
    const r = ctx.cellRect(reel, row);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    // 1. Stage dim: the landed reel's other symbols recede behind the scatter.
    for (let other = 0; other < ctx.grid.rows; other++) {
      if (other !== row) ctx.dimCell(reel, other, 0.42);
    }

    // 2. RAY BURST — twelve golden rays snap outward once and are gone.
    const burst = new Graphics();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + ctx.rand(-0.09, 0.09);
      const len = Math.max(r.w, r.h) * ctx.rand(0.6, 0.9);
      const half = 0.05 + (i % 2) * 0.03;
      burst.moveTo(Math.cos(a - half) * len * 0.22, Math.sin(a - half) * len * 0.22);
      burst.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      burst.lineTo(Math.cos(a + half) * len * 0.22, Math.sin(a + half) * len * 0.22);
      burst.closePath();
    }
    burst.fill({ color: ctx.gold, alpha: 0.95 });
    burst.blendMode = 'add';
    burst.position.set(cx, cy);
    burst.scale.set(0.25);
    burst.eventMode = 'none';
    ctx.layer.addChild(burst);
    ctx.track(ctx.gsap.to(burst.scale, { x: 1.25, y: 1.25, duration: 0.42, ease: 'power3.out' }));
    ctx.track(ctx.gsap.to(burst, {
      rotation: 0.24, alpha: 0, duration: 0.52, ease: 'power1.in',
      onComplete: () => { if (burst.parent) burst.parent.removeChild(burst); burst.destroy(); },
    }));

    // 3. SPARK POPS — a handful of gold/white particles arc out and die.
    for (let i = 0; i < 9; i++) {
      const s = new Graphics();
      s.circle(0, 0, ctx.rand(2, 3.6)).fill({ color: i % 3 === 0 ? 0xFFFFFF : ctx.gold, alpha: 1 });
      s.blendMode = 'add';
      s.position.set(cx, cy);
      s.eventMode = 'none';
      ctx.layer.addChild(s);
      const ang = ctx.rand(-Math.PI, Math.PI);
      const dist = Math.max(r.w, r.h) * ctx.rand(0.5, 1.0);
      const px = cx + Math.cos(ang) * dist;
      const py = cy + Math.sin(ang) * dist * 0.7 - r.h * 0.28;
      const d = ctx.rand(0.5, 0.75);
      ctx.track(ctx.gsap.to(s, { x: px, duration: d, ease: 'power1.out' }));
      ctx.track(ctx.gsap.to(s, {
        keyframes: [
          { y: py, duration: d * 0.55, ease: 'power2.out' },
          { y: py + r.h * 0.5, duration: d * 0.45, ease: 'power2.in' },
        ],
      }));
      ctx.track(ctx.gsap.to(s, {
        alpha: 0, duration: 0.4, delay: d * 0.55, ease: 'power1.in',
        onComplete: () => { if (s.parent) s.parent.removeChild(s); s.destroy(); },
      }));
    }

    // 4. CORNER BRACKETS — four premium gold corners hug the cell and breathe
    //    (vector, so the pulse never pixelates anything).
    const br = new Graphics();
    const arm = Math.min(r.w, r.h) * 0.26;
    const th = 3;
    const p = 4;
    const x0 = r.x - p, y0 = r.y - p, x1 = r.x + r.w + p, y1 = r.y + r.h + p;
    br.rect(x0, y0, arm, th).rect(x0, y0, th, arm)
      .rect(x1 - arm, y0, arm, th).rect(x1 - th, y0, th, arm)
      .rect(x0, y1 - th, arm, th).rect(x0, y1 - arm, th, arm)
      .rect(x1 - arm, y1 - th, arm, th).rect(x1 - th, y1 - arm, th, arm)
      .fill({ color: ctx.gold, alpha: 0.95 });
    br.pivot.set(cx, cy);
    br.position.set(cx, cy);
    br.alpha = 0;
    br.eventMode = 'none';
    ctx.layer.addChild(br);
    ctx.track(ctx.gsap.fromTo(br.scale, { x: 1.28, y: 1.28 }, { x: 1, y: 1, duration: 0.38, ease: 'back.out(2.4)' }));
    ctx.track(ctx.gsap.to(br, { alpha: 1, duration: 0.2, ease: 'power2.out' }));
    ctx.track(ctx.gsap.to(br, { alpha: 0.55, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.45 }));
    ctx.track(ctx.gsap.to(br.scale, { x: 1.035, y: 1.035, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.45 }));

    // 5. The SYMBOL ITSELF: whole-object bounce-in, then a calm float —
    //    position drift only, restored by the runtime on tease end.
    const node = ctx.cellNode(reel, row);
    if (node) {
      const restY = node.y;
      ctx.track(ctx.gsap.fromTo(node, { y: restY - 8 }, { y: restY, duration: 0.55, ease: 'bounce.out' }));
      ctx.track(ctx.gsap.to(node, { y: restY - 3.5, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.6 }));
      ctx.track(ctx.gsap.to(node, { x: node.x + 1.5, duration: 2.1, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.6 }));
    }
  },

  onPendingReel(ctx: TeaseContext, reel: number, position: number): void {
    // SEQUENTIAL arming: the runtime announces every pending reel at once —
    // this gate delays each reel's visuals so they ignite ONE AFTER ANOTHER,
    // roughly as the previous teased reel stops.
    const armAt = position * 1.05;
    ctx.track(ctx.gsap.delayedCall(armAt, () => {
      const rr = ctx.reelRect(reel);

      // GOLD GATE — clean double border, entry flash, calm breathing.
      // No running lights, no bulbs.
      const border = new Graphics();
      border.roundRect(rr.x - 3, rr.y - 3, rr.w + 6, rr.h + 6, 14)
        .stroke({ color: ctx.gold, width: 3, alpha: 1 });
      border.roundRect(rr.x + 1, rr.y + 1, rr.w - 2, rr.h - 2, 11)
        .stroke({ color: 0xFFF1B0, width: 1, alpha: 0.5 });
      border.alpha = 0;
      border.eventMode = 'none';
      ctx.layer.addChild(border);
      const breathe = Math.min(0.9, 0.55 + position * 0.12);
      ctx.track(ctx.gsap.to(border, { alpha: 1, duration: 0.14, ease: 'power2.out' }));
      ctx.track(ctx.gsap.to(border, {
        alpha: breathe * 0.6, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.18,
      }));

      // RISING ENERGY inside the spinning reel, clipped to the reel window.
      const clip = new Graphics();
      clip.roundRect(rr.x, rr.y, rr.w, rr.h, 10).fill(0xffffff);
      const inner = new Container();
      inner.mask = clip;
      inner.eventMode = 'none';
      ctx.layer.addChild(clip);
      ctx.layer.addChild(inner);

      // a) soft golden sheen band sweeping bottom → top on loop.
      const sheen = new Graphics();
      const bandH = rr.h * 0.3;
      for (let i = 0; i < 5; i++) {
        sheen.rect(rr.x, (bandH / 5) * i, rr.w, bandH / 5)
          .fill({ color: ctx.gold, alpha: 0.028 * (5 - i) });
      }
      sheen.blendMode = 'add';
      sheen.y = rr.y + rr.h;
      inner.addChild(sheen);
      ctx.track(ctx.gsap.fromTo(sheen,
        { y: rr.y + rr.h },
        { y: rr.y - bandH, duration: Math.max(0.8, 1.25 - position * 0.12), ease: 'none', repeat: -1 },
      ));

      // b) gold embers floating up with a gentle sway, fading out.
      const spawnEmber = () => {
        const e = new Graphics();
        e.circle(0, 0, ctx.rand(1.6, 3)).fill({ color: ctx.gold, alpha: ctx.rand(0.5, 0.9) });
        e.blendMode = 'add';
        e.position.set(rr.x + ctx.rand(6, rr.w - 6), rr.y + rr.h + 4);
        e.eventMode = 'none';
        inner.addChild(e);
        const rise = rr.h * ctx.rand(0.55, 1.0);
        const dur = ctx.rand(0.9, 1.4);
        ctx.track(ctx.gsap.to(e, { y: `-=${rise}`, duration: dur, ease: 'power1.out' }));
        ctx.track(ctx.gsap.to(e, { x: `+=${ctx.rand(-10, 10)}`, duration: dur, ease: 'sine.inOut' }));
        ctx.track(ctx.gsap.to(e, {
          alpha: 0, duration: dur * 0.45, delay: dur * 0.55, ease: 'power1.in',
          onComplete: () => { if (e.parent) e.parent.removeChild(e); e.destroy(); },
        }));
      };
      spawnEmber();
      ctx.track(ctx.gsap.to({}, {
        duration: Math.max(0.1, 0.17 - position * 0.02), repeat: -1, onRepeat: spawnEmber,
      }));
    }));
  },
};
