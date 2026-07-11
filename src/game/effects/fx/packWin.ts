// FX_PACK_WIN — eight win-celebration effects for the FX showcase. Every
// effect is theme-agnostic (colors from ctx.accent / ctx.gold), grid-relative
// (all geometry from cellRect/reelRect/gridRect) and outcome-neutral. Each one
// is layered AAA-style: soft glow underneath, bright core, sparkle on top,
// driven by impulsive easings (back / power3-4 / elastic) — never linear-only.
//
// Contract: everything added to ctx.layer is auto-destroyed by the showcase
// runner; every tween/timeline is registered through ctx.track() so the whole
// effect is cancellable mid-flight. Core beat <= 1.5s, tails fade by ~2.5s.

import { Container, Graphics, BlurFilter } from 'pixi.js';
import type { FxEntry, FxContext } from '../fxTypes';

type Rect = { x: number; y: number; w: number; h: number };

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Soft additive radial glow built from concentric circles (no textures). */
function glowDot(color: number, r: number, intensity = 1): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.16 * intensity });
  g.circle(0, 0, r * 0.6).fill({ color, alpha: 0.3 * intensity });
  g.circle(0, 0, r * 0.3).fill({ color: 0xffffff, alpha: 0.8 * intensity });
  g.blendMode = 'add';
  return g;
}

/** Flat point list for a 5-point star centred on (0,0). */
function starPoints(outer: number, inner: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

/** Jagged lightning polyline a→b with perpendicular jitter (cosmetic rand). */
function boltPoints(ctx: FxContext, ax: number, ay: number, bx: number, by: number, jag: number): number[] {
  const pts: number[] = [ax, ay];
  const segs = 5;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < segs; i++) {
    const f = i / segs;
    const off = ctx.rand(-jag, jag);
    pts.push(ax + dx * f + nx * off, ay + dy * f + ny * off);
  }
  pts.push(bx, by);
  return pts;
}

function strokePath(pts: number[], color: number, width: number, alpha: number): Graphics {
  const g = new Graphics();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke({ color, width, alpha });
  g.blendMode = 'add';
  return g;
}

function centreOf(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/* ------------------------------------------------------------------ */
/* the pack                                                            */
/* ------------------------------------------------------------------ */

export const FX_PACK_WIN: readonly FxEntry[] = [
  /* ---------------------------------------------------------------- */
  {
    id: 'win-shockwave-ring',
    name: 'Shockwave Ring',
    group: 'win',
    description: 'Expanding accent rings from the grid centre with a screen-punch scale pulse.',
    run(ctx: FxContext): void {
      const gr = ctx.gridRect();
      const { x: cx, y: cy } = centreOf(gr);
      const maxR = Math.hypot(gr.w, gr.h) * 0.55;

      // Screen-punch: pulse the FX layer scale around the grid centre.
      // Pivot compensation keeps the layer aligned; scale returns to exactly 1.
      const layer = ctx.layer;
      layer.pivot.set(cx, cy);
      layer.position.set(layer.position.x + cx, layer.position.y + cy);
      const punch = ctx.track(ctx.gsap.timeline());
      punch
        .to(layer.scale, { x: 1.045, y: 1.045, duration: 0.09, ease: 'power3.out' })
        .to(layer.scale, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });

      // Central flash under everything.
      const flash = glowDot(ctx.accent, gr.w * 0.22, 1.2);
      flash.position.set(cx, cy);
      flash.scale.set(0.3);
      ctx.layer.addChild(flash);
      const fl = ctx.track(ctx.gsap.timeline());
      fl.to(flash.scale, { x: 1.4, y: 1.4, duration: 0.35, ease: 'power4.out' }, 0)
        .to(flash, { alpha: 0, duration: 0.4, ease: 'power2.out' }, 0.08);

      // Three staggered rings: soft blurred glow ring + crisp bright core.
      const BASE = 60;
      for (let i = 0; i < 3; i++) {
        const ring = new Container();
        ring.position.set(cx, cy);
        const glow = new Graphics();
        glow.circle(0, 0, BASE).stroke({ color: ctx.accent, width: 20, alpha: 0.35 });
        glow.blendMode = 'add';
        glow.filters = [new BlurFilter({ strength: 6 })];
        const core = new Graphics();
        core.circle(0, 0, BASE).stroke({ color: 0xffffff, width: i === 0 ? 5 : 3, alpha: 0.95 });
        core.blendMode = 'add';
        ring.addChild(glow, core);
        ring.scale.set(0.1);
        ring.alpha = 0;
        ctx.layer.addChild(ring);

        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.13 }));
        tl.to(ring, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
          .to(ring.scale, { x: maxR / BASE, y: maxR / BASE, duration: 0.85, ease: 'power3.out' }, 0)
          .to(ring, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 0.4);
      }

      // Sparkle shards riding the first wavefront.
      for (let i = 0; i < 10; i++) {
        const a = ctx.rand(0, Math.PI * 2);
        const spark = glowDot(ctx.gold, ctx.rand(5, 9));
        spark.position.set(cx, cy);
        spark.alpha = 0;
        ctx.layer.addChild(spark);
        const d = ctx.rand(maxR * 0.7, maxR);
        const tl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0, 0.08) }));
        tl.to(spark, { alpha: 1, duration: 0.05 }, 0)
          .to(spark.position, { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, duration: 0.8, ease: 'power4.out' }, 0)
          .to(spark, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.35);
      }
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'win-gold-fountain',
    name: 'Gold Fountain',
    group: 'win',
    description: 'Golden coin particles erupt from the grid bottom and arc back down.',
    run(ctx: FxContext): void {
      const gr = ctx.gridRect();
      const originY = gr.y + gr.h;
      const cx = gr.x + gr.w / 2;

      // Launch glow at the fountain mouth.
      const mouth = glowDot(ctx.gold, gr.w * 0.16, 1.1);
      mouth.position.set(cx, originY);
      mouth.scale.set(0.2, 0.1);
      ctx.layer.addChild(mouth);
      const ml = ctx.track(ctx.gsap.timeline());
      ml.to(mouth.scale, { x: 1.3, y: 0.55, duration: 0.28, ease: 'back.out(2)' }, 0)
        .to(mouth, { alpha: 0, duration: 0.5, ease: 'power2.out' }, 0.15);

      const grav = gr.h * 3.4; // px/s^2 — scales with grid size
      const count = 26;
      for (let i = 0; i < count; i++) {
        const x0 = cx + gr.w * ctx.rand(-0.1, 0.1);
        const r = ctx.rand(5, 10);

        const p = new Container();
        const halo = glowDot(ctx.gold, r * 2.1, 0.7);
        const coin = new Graphics();
        coin.circle(0, 0, r).fill({ color: ctx.gold, alpha: 1 });
        coin.circle(-r * 0.32, -r * 0.32, r * 0.42).fill({ color: 0xffffff, alpha: 0.55 });
        coin.circle(0, 0, r).stroke({ color: 0xffffff, width: 1.2, alpha: 0.7 });
        p.addChild(halo, coin);
        p.position.set(x0, originY + 6);
        ctx.layer.addChild(p);

        const vx = gr.w * ctx.rand(-0.42, 0.42); // px/s sideways
        const vy = gr.h * ctx.rand(1.35, 1.85); // px/s upward
        const dur = ctx.rand(0.95, 1.25);
        const delay = ctx.rand(0, 0.2);
        const spin = ctx.rand(6, 12);
        const phase = ctx.rand(0, Math.PI * 2);

        const state = { t: 0 };
        ctx.track(
          ctx.gsap.to(state, {
            t: 1,
            duration: dur,
            delay,
            ease: 'none',
            onUpdate: () => {
              const t = state.t * dur;
              p.x = x0 + vx * t;
              p.y = originY - vy * t + 0.5 * grav * t * t;
              // coin flip shimmer
              coin.scale.x = 0.25 + Math.abs(Math.sin(t * spin + phase)) * 0.75;
            },
          }),
        );
        ctx.track(ctx.gsap.to(p, { alpha: 0, duration: 0.3, delay: delay + dur - 0.3, ease: 'power2.in' }));
      }
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'win-chain-lightning',
    name: 'Chain Lightning',
    group: 'win',
    description: 'Jagged electric bolts chain left-to-right through random cells with impact flashes.',
    run(ctx: FxContext): void {
      const rows: number[] = [];
      for (let r = 0; r < ctx.grid.rows; r++) rows.push(r);
      const nodes: { x: number; y: number }[] = [];
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        nodes.push(centreOf(ctx.cellRect(reel, ctx.pick(rows))));
      }

      const cell = ctx.cellRect(0, 0);
      const jag = cell.h * 0.28;
      const STEP = 0.11; // s per reel hop

      for (let k = 0; k < nodes.length - 1; k++) {
        const a = nodes[k];
        const b = nodes[k + 1];
        const seg = new Container();
        seg.alpha = 0;
        ctx.layer.addChild(seg);

        // Two independent jitters overlaid = branching feel; glow under core.
        for (let dup = 0; dup < 2; dup++) {
          const pts = boltPoints(ctx, a.x, a.y, b.x, b.y, dup === 0 ? jag : jag * 0.55);
          const glow = strokePath(pts, ctx.accent, 9, 0.32);
          glow.filters = [new BlurFilter({ strength: 4 })];
          const core = strokePath(pts, 0xffffff, dup === 0 ? 2.6 : 1.6, 0.95);
          seg.addChild(glow, core);
        }

        const at = k * STEP;
        const tl = ctx.track(ctx.gsap.timeline({ delay: at }));
        tl.to(seg, { alpha: 1, duration: 0.03, ease: 'power1.out' }, 0)
          .to(seg, { alpha: 0.35, duration: 0.05, ease: 'power1.in' }, 0.06)
          .to(seg, { alpha: 1, duration: 0.04, ease: 'power1.out' }, 0.11)
          .to(seg, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 0.45);
      }

      // Impact flash + spark ring at every node as the bolt arrives.
      nodes.forEach((n, i) => {
        const hit = glowDot(ctx.accent, cell.w * 0.3, 1.2);
        hit.position.set(n.x, n.y);
        hit.scale.set(0.1);
        hit.alpha = 0;
        ctx.layer.addChild(hit);
        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.11 }));
        tl.to(hit, { alpha: 1, duration: 0.04 }, 0)
          .to(hit.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' }, 0)
          .to(hit, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.22);

        const ring = new Graphics();
        ring.circle(0, 0, cell.w * 0.42).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
        ring.blendMode = 'add';
        ring.position.set(n.x, n.y);
        ring.scale.set(0.2);
        ring.alpha = 0;
        ctx.layer.addChild(ring);
        const rl = ctx.track(ctx.gsap.timeline({ delay: i * 0.11 + 0.03 }));
        rl.to(ring, { alpha: 0.9, duration: 0.04 }, 0)
          .to(ring.scale, { x: 1, y: 1, duration: 0.35, ease: 'power3.out' }, 0)
          .to(ring, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.18);
      });
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'win-spotlight-cascade',
    name: 'Spotlight Cascade',
    group: 'win',
    description: 'Soft light cones sweep across the reels left-to-right, lighting each column of cells.',
    run(ctx: FxContext): void {
      const gr = ctx.gridRect();

      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        const rr = ctx.reelRect(reel);
        const apexX = rr.x + rr.w / 2;
        const apexY = gr.y - gr.h * 0.28;
        const reach = gr.y + gr.h + 12 - apexY;
        const halfW = rr.w * 0.72;
        const at = reel * 0.13;

        // Cone: blurred wide wash + tighter accent core, swaying around apex.
        const cone = new Container();
        cone.position.set(apexX, apexY);
        cone.alpha = 0;
        cone.rotation = -0.08;
        const wash = new Graphics();
        wash.poly([0, 0, -halfW, reach, halfW, reach]).fill({ color: 0xffffff, alpha: 0.14 });
        wash.blendMode = 'add';
        wash.filters = [new BlurFilter({ strength: 8 })];
        const beam = new Graphics();
        beam.poly([0, 0, -halfW * 0.45, reach, halfW * 0.45, reach]).fill({ color: ctx.accent, alpha: 0.2 });
        beam.blendMode = 'add';
        beam.filters = [new BlurFilter({ strength: 4 })];
        cone.addChild(wash, beam);
        ctx.layer.addChild(cone);

        const tl = ctx.track(ctx.gsap.timeline({ delay: at }));
        tl.to(cone, { alpha: 1, duration: 0.14, ease: 'power2.out' }, 0)
          .to(cone, { rotation: 0.08, duration: 0.55, ease: 'sine.inOut' }, 0)
          .to(cone, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.55);

        // Cells catch the light top-to-bottom as the beam passes.
        for (let row = 0; row < ctx.grid.rows; row++) {
          const cr = ctx.cellRect(reel, row);
          const tile = new Graphics();
          tile.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color: 0xffffff, alpha: 0.22 });
          tile.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: ctx.gold, width: 2, alpha: 0.8 });
          tile.blendMode = 'add';
          tile.position.set(cr.x + cr.w / 2, cr.y + cr.h / 2);
          tile.alpha = 0;
          tile.scale.set(0.85);
          ctx.layer.addChild(tile);

          const ttl = ctx.track(ctx.gsap.timeline({ delay: at + 0.06 + row * 0.05 }));
          ttl.to(tile, { alpha: 1, duration: 0.1, ease: 'power2.out' }, 0)
            .to(tile.scale, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2.4)' }, 0)
            .to(tile, { alpha: 0, duration: 0.42, ease: 'power2.in' }, 0.3);
        }
      }
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'win-coin-shimmer-sweep',
    name: 'Shimmer Sweep',
    group: 'win',
    description: 'A diagonal golden shine band sweeps across the grid with sparkling glints.',
    run(ctx: FxContext): void {
      const gr = ctx.gridRect();
      const diag = Math.hypot(gr.w, gr.h) * 1.25;
      const tilt = -0.32;
      const dur = 0.95;
      const startX = gr.x - gr.w * 0.45;
      const endX = gr.x + gr.w * 1.45;

      // Everything clipped to the grid so the band never spills outside.
      const clip = new Graphics();
      clip.roundRect(gr.x, gr.y, gr.w, gr.h, 14).fill({ color: 0xffffff });
      ctx.layer.addChild(clip);
      const sweep = new Container();
      sweep.mask = clip;
      ctx.layer.addChild(sweep);

      // The band: wide soft wash, mid gold body, razor-bright white core.
      const band = new Container();
      band.position.set(startX, gr.y + gr.h / 2);
      const inner = new Container();
      inner.rotation = tilt;
      const wash = new Graphics();
      wash.rect(-gr.w * 0.14, -diag / 2, gr.w * 0.28, diag).fill({ color: ctx.gold, alpha: 0.12 });
      wash.blendMode = 'add';
      wash.filters = [new BlurFilter({ strength: 10 })];
      const body = new Graphics();
      body.rect(-gr.w * 0.06, -diag / 2, gr.w * 0.12, diag).fill({ color: ctx.gold, alpha: 0.26 });
      body.blendMode = 'add';
      body.filters = [new BlurFilter({ strength: 4 })];
      const core = new Graphics();
      core.rect(-gr.w * 0.012, -diag / 2, gr.w * 0.024, diag).fill({ color: 0xffffff, alpha: 0.6 });
      core.blendMode = 'add';
      inner.addChild(wash, body, core);
      band.addChild(inner);
      sweep.addChild(band);

      ctx.track(ctx.gsap.to(band.position, { x: endX, duration: dur, ease: 'power2.inOut' }));
      ctx.track(ctx.gsap.to(band, { alpha: 0, duration: 0.2, delay: dur - 0.2, ease: 'power1.in' }));

      // Star glints that pop exactly when the band front passes them.
      for (let i = 0; i < 8; i++) {
        const gx = gr.x + gr.w * ctx.rand(0.06, 0.94);
        const gy = gr.y + gr.h * ctx.rand(0.08, 0.92);
        const when = ((gx - startX) / (endX - startX)) * dur;
        const size = ctx.rand(8, 16);

        const glint = new Container();
        const halo = glowDot(0xffffff, size * 1.6, 0.8);
        const star = new Graphics();
        star.poly(starPoints(size, size * 0.34)).fill({ color: 0xffffff, alpha: 0.95 });
        star.blendMode = 'add';
        glint.addChild(halo, star);
        glint.position.set(gx, gy);
        glint.scale.set(0);
        ctx.layer.addChild(glint);

        const tl = ctx.track(ctx.gsap.timeline({ delay: Math.max(0, when - 0.05) }));
        tl.to(glint.scale, { x: 1, y: 1, duration: 0.18, ease: 'back.out(3)' }, 0)
          .to(glint, { rotation: ctx.rand(0.6, 1.4), duration: 0.5, ease: 'power2.out' }, 0)
          .to(glint, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.24);
      }
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'win-frame-pulse',
    name: 'Frame Pulse',
    group: 'win',
    description: 'The grid border flashes and pumps outward in expanding accent waves.',
    run(ctx: FxContext): void {
      const gr = ctx.gridRect();
      const { x: cx, y: cy } = centreOf(gr);

      // Static frame flash: bright hit on the border itself.
      const frame = new Container();
      frame.position.set(cx, cy);
      const fGlow = new Graphics();
      fGlow.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 18).stroke({ color: ctx.accent, width: 14, alpha: 0.5 });
      fGlow.blendMode = 'add';
      fGlow.filters = [new BlurFilter({ strength: 6 })];
      const fCore = new Graphics();
      fCore.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 18).stroke({ color: 0xffffff, width: 3, alpha: 0.95 });
      fCore.blendMode = 'add';
      frame.addChild(fGlow, fCore);
      frame.alpha = 0;
      ctx.layer.addChild(frame);
      const ftl = ctx.track(ctx.gsap.timeline());
      ftl.to(frame, { alpha: 1, duration: 0.07, ease: 'power2.out' }, 0)
        .to(frame.scale, { x: 1.015, y: 1.015, duration: 0.12, ease: 'back.out(3)' }, 0)
        .to(frame.scale, { x: 1, y: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' }, 0.12)
        .to(frame, { alpha: 0, duration: 0.55, ease: 'power2.in' }, 0.6);

      // Three outward-travelling border waves.
      for (let i = 0; i < 3; i++) {
        const wave = new Container();
        wave.position.set(cx, cy);
        const wGlow = new Graphics();
        wGlow.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 20).stroke({ color: ctx.accent, width: 10, alpha: 0.4 });
        wGlow.blendMode = 'add';
        wGlow.filters = [new BlurFilter({ strength: 4 })];
        const wCore = new Graphics();
        wCore.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 20).stroke({ color: ctx.gold, width: 2.5, alpha: 0.9 });
        wCore.blendMode = 'add';
        wave.addChild(wGlow, wCore);
        wave.alpha = 0;
        wave.scale.set(0.99);
        ctx.layer.addChild(wave);

        const tl = ctx.track(ctx.gsap.timeline({ delay: 0.1 + i * 0.16 }));
        tl.to(wave, { alpha: 0.9, duration: 0.06, ease: 'power1.out' }, 0)
          .to(wave.scale, { x: 1.16 + i * 0.05, y: 1.2 + i * 0.06, duration: 0.75, ease: 'power3.out' }, 0)
          .to(wave, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.32);
      }

      // Corner sparks punctuate the pulse.
      const corners = [
        { x: gr.x, y: gr.y },
        { x: gr.x + gr.w, y: gr.y },
        { x: gr.x, y: gr.y + gr.h },
        { x: gr.x + gr.w, y: gr.y + gr.h },
      ];
      corners.forEach((c, i) => {
        const s = glowDot(ctx.gold, 14, 1.1);
        s.position.set(c.x, c.y);
        s.scale.set(0);
        ctx.layer.addChild(s);
        const tl = ctx.track(ctx.gsap.timeline({ delay: 0.05 + i * 0.04 }));
        tl.to(s.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(4)' }, 0)
          .to(s, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 0.25);
      });
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'win-star-burst',
    name: 'Star Burst',
    group: 'win',
    description: 'Five-point stars pop from the grid centre and scatter outward, spinning.',
    run(ctx: FxContext): void {
      const gr = ctx.gridRect();
      const { x: cx, y: cy } = centreOf(gr);
      const maxR = Math.hypot(gr.w, gr.h) * 0.5;

      // Centre pop.
      const pop = glowDot(0xffffff, gr.w * 0.15, 1.3);
      pop.position.set(cx, cy);
      pop.scale.set(0.2);
      ctx.layer.addChild(pop);
      const ptl = ctx.track(ctx.gsap.timeline());
      ptl.to(pop.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(2.5)' }, 0)
        .to(pop, { alpha: 0, duration: 0.35, ease: 'power2.out' }, 0.1);

      const palette: readonly number[] = [ctx.gold, ctx.accent, 0xffffff];
      const count = 14;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ctx.rand(-0.25, 0.25);
        const dist = ctx.rand(maxR * 0.35, maxR * 0.95);
        const size = ctx.rand(10, 22);
        const color = ctx.pick(palette);

        const star = new Container();
        const halo = glowDot(color, size * 1.5, 0.65);
        const body = new Graphics();
        body.poly(starPoints(size, size * 0.4)).fill({ color, alpha: 0.95 });
        body.poly(starPoints(size, size * 0.4)).stroke({ color: 0xffffff, width: 1.4, alpha: 0.8 });
        body.blendMode = 'add';
        star.addChild(halo, body);
        star.position.set(cx, cy);
        star.scale.set(0);
        star.rotation = ctx.rand(0, Math.PI);
        ctx.layer.addChild(star);

        const tl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0, 0.12) }));
        tl.to(star.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(2.8)' }, 0)
          .to(star.position, { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, duration: 0.9, ease: 'power3.out' }, 0)
          .to(star, { rotation: star.rotation + ctx.rand(-3, 3), duration: 0.9, ease: 'power2.out' }, 0)
          .to(star.scale, { x: 0.55, y: 0.55, duration: 0.5, ease: 'power2.in' }, 0.4)
          .to(star, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.5);
      }
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'win-ripple-tiles',
    name: 'Ripple Tiles',
    group: 'win',
    description: 'Cells flash outward from the centre in order of distance, riding a radial ripple.',
    run(ctx: FxContext): void {
      const gr = ctx.gridRect();
      const { x: cx, y: cy } = centreOf(gr);
      const maxDist = Math.hypot(gr.w, gr.h) / 2;
      const SPREAD = 0.55; // s for the ripple to reach the farthest cell

      // The travelling ripple ring the tiles ride on.
      const RING_BASE = 40;
      const ring = new Container();
      ring.position.set(cx, cy);
      const rGlow = new Graphics();
      rGlow.circle(0, 0, RING_BASE).stroke({ color: ctx.accent, width: 12, alpha: 0.35 });
      rGlow.blendMode = 'add';
      rGlow.filters = [new BlurFilter({ strength: 5 })];
      const rCore = new Graphics();
      rCore.circle(0, 0, RING_BASE).stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
      rCore.blendMode = 'add';
      ring.addChild(rGlow, rCore);
      ring.scale.set(0.05);
      ctx.layer.addChild(ring);
      const rtl = ctx.track(ctx.gsap.timeline());
      rtl.to(ring.scale, { x: (maxDist * 1.15) / RING_BASE, y: (maxDist * 1.15) / RING_BASE, duration: SPREAD + 0.25, ease: 'power1.out' }, 0)
        .to(ring, { alpha: 0, duration: 0.3, ease: 'power2.in' }, SPREAD);

      // Each tile flashes when the ripple front reaches it.
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const cr = ctx.cellRect(reel, row);
          const c = centreOf(cr);
          const dist = Math.hypot(c.x - cx, c.y - cy);
          const at = (dist / maxDist) * SPREAD;

          const tile = new Container();
          tile.position.set(c.x, c.y);
          const fill = new Graphics();
          fill.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color: ctx.accent, alpha: 0.26 });
          fill.blendMode = 'add';
          const edge = new Graphics();
          edge.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: 0xffffff, width: 2, alpha: 0.85 });
          edge.blendMode = 'add';
          const glint = glowDot(ctx.gold, Math.min(cr.w, cr.h) * 0.16, 0.9);
          glint.position.set(cr.w * 0.28, -cr.h * 0.28);
          tile.addChild(fill, edge, glint);
          tile.alpha = 0;
          tile.scale.set(0.55);
          ctx.layer.addChild(tile);

          const tl = ctx.track(ctx.gsap.timeline({ delay: at }));
          tl.to(tile, { alpha: 1, duration: 0.09, ease: 'power2.out' }, 0)
            .to(tile.scale, { x: 1.07, y: 1.07, duration: 0.2, ease: 'back.out(3)' }, 0)
            .to(tile.scale, { x: 1, y: 1, duration: 0.25, ease: 'power2.out' }, 0.2)
            .to(tile, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.34);
        }
      }
    },
  },
];
