// FX_PACK_WIN — eight win-celebration effects for the FX showcase. Every
// effect is theme-agnostic (colors from ctx.accent / ctx.gold), grid-relative
// (all geometry from cellRect/reelRect/gridRect) and outcome-neutral. Each one
// is layered AAA-style: soft glow underneath, bright core, sparkle on top,
// driven by impulsive easings (back / power3-4 / elastic) — never linear-only.
// Every impact is preceded by a short anticipation counter-move (inhale /
// pull-back), lands with squash-stretch weight, and exits with fade + scale
// continuation. Staggers carry ±15-30% cosmetic jitter so nothing is lockstep.
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

/** Soft additive radial glow built from concentric circles (no textures).
 *  Three layers: wide soft halo, mid core, small hot white centre. */
function glowDot(color: number, r: number, intensity = 1): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.14 * intensity });
  g.circle(0, 0, r * 0.58).fill({ color, alpha: 0.34 * intensity });
  g.circle(0, 0, r * 0.24).fill({ color: 0xffffff, alpha: 0.78 * intensity });
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

      // Screen-punch with anticipation: the layer INHALES (contracts 0.09s)
      // before punching out, then settles back to exactly 1 with elastic
      // follow-through. Pivot compensation keeps the layer aligned.
      const layer = ctx.layer;
      layer.pivot.set(cx, cy);
      layer.position.set(layer.position.x + cx, layer.position.y + cy);
      const punch = ctx.track(ctx.gsap.timeline());
      punch
        .to(layer.scale, { x: 0.988, y: 0.988, duration: 0.09, ease: 'power2.in' })
        .to(layer.scale, { x: 1.048, y: 1.048, duration: 0.1, ease: 'power3.out' })
        .to(layer.scale, { x: 1, y: 1, duration: 0.65, ease: 'elastic.out(1, 0.38)' });

      // Central flash: gathers inward during the inhale, then bursts.
      const flash = glowDot(ctx.accent, gr.w * 0.22, 1.2);
      flash.position.set(cx, cy);
      flash.scale.set(0.5);
      flash.alpha = 0.35;
      ctx.layer.addChild(flash);
      const fl = ctx.track(ctx.gsap.timeline());
      fl.to(flash.scale, { x: 0.32, y: 0.32, duration: 0.09, ease: 'power2.in' }, 0)
        .to(flash, { alpha: 1, duration: 0.09, ease: 'power1.in' }, 0)
        .to(flash.scale, { x: 1.45, y: 1.45, duration: 0.34, ease: 'power4.out' }, 0.09)
        .to(flash, { alpha: 0, duration: 0.42, ease: 'power2.in' }, 0.17);

      // Three staggered rings (jittered stagger, never lockstep). Each ring
      // is 3-layer light: wide blurred halo, mid accent glow, hot white core.
      const BASE = 60;
      for (let i = 0; i < 3; i++) {
        const ring = new Container();
        ring.position.set(cx, cy);
        const halo = new Graphics();
        halo.circle(0, 0, BASE).stroke({ color: ctx.accent, width: 34, alpha: 0.12 });
        halo.blendMode = 'add';
        halo.filters = [new BlurFilter({ strength: 12 })];
        const glow = new Graphics();
        glow.circle(0, 0, BASE).stroke({ color: ctx.accent, width: 18, alpha: 0.34 });
        glow.blendMode = 'add';
        glow.filters = [new BlurFilter({ strength: 6 })];
        const core = new Graphics();
        core.circle(0, 0, BASE).stroke({ color: 0xffffff, width: i === 0 ? 5 : 3, alpha: 0.9 });
        core.blendMode = 'add';
        ring.addChild(halo, glow, core);
        ring.scale.set(0.1);
        ring.alpha = 0;
        ctx.layer.addChild(ring);

        const grow = ctx.rand(0.76, 0.94);
        const tl = ctx.track(ctx.gsap.timeline({ delay: 0.09 + i * 0.13 * ctx.rand(0.82, 1.22) }));
        tl.to(ring, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
          .to(ring.scale, { x: maxR / BASE, y: maxR / BASE, duration: grow, ease: 'power3.out' }, 0)
          .to(ring, { alpha: 0, duration: 0.5, ease: 'power2.in' }, grow * 0.48);
      }

      // Nine sparkle shards riding the first wavefront — each with its own
      // size, distance, and timing; exit shrinks along the travel direction.
      for (let i = 0; i < 9; i++) {
        const a = ctx.rand(0, Math.PI * 2);
        const spark = glowDot(ctx.gold, ctx.rand(4.5, 9.5));
        spark.position.set(cx, cy);
        spark.alpha = 0;
        ctx.layer.addChild(spark);
        const d = maxR * ctx.rand(0.62, 1.02);
        const fly = ctx.rand(0.68, 0.92);
        const tl = ctx.track(ctx.gsap.timeline({ delay: 0.09 + ctx.rand(0, 0.09) }));
        tl.to(spark, { alpha: ctx.rand(0.8, 1), duration: 0.05 }, 0)
          .to(spark.position, { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, duration: fly, ease: 'power4.out' }, 0)
          .to(spark.scale, { x: 0.4, y: 0.4, duration: fly * 0.6, ease: 'power2.in' }, fly * 0.4)
          .to(spark, { alpha: 0, duration: 0.4, ease: 'power2.in' }, fly * 0.45);
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
      const INHALE = 0.1; // s — mouth sucks in before erupting

      // Launch glow: anticipation suck-in (shrinks + brightens), then the
      // mouth bursts wide with back.out overshoot and bleeds away.
      const mouth = glowDot(ctx.gold, gr.w * 0.16, 1.1);
      mouth.position.set(cx, originY);
      mouth.scale.set(0.55, 0.3);
      mouth.alpha = 0.4;
      ctx.layer.addChild(mouth);
      const ml = ctx.track(ctx.gsap.timeline());
      ml.to(mouth.scale, { x: 0.3, y: 0.14, duration: INHALE, ease: 'power2.in' }, 0)
        .to(mouth, { alpha: 1, duration: INHALE, ease: 'power1.in' }, 0)
        .to(mouth.scale, { x: 1.35, y: 0.55, duration: 0.26, ease: 'back.out(2.2)' }, INHALE)
        .to(mouth, { alpha: 0, duration: 0.5, ease: 'power2.out' }, INHALE + 0.14);

      const grav = gr.h * 3.4; // px/s^2 — scales with grid size
      const count = 27;
      for (let i = 0; i < count; i++) {
        const x0 = cx + gr.w * ctx.rand(-0.1, 0.1);
        const r = ctx.rand(4.5, 10);

        const p = new Container();
        const halo = glowDot(ctx.gold, r * 2.1, 0.7);
        const coin = new Graphics();
        coin.circle(0, 0, r).fill({ color: ctx.gold, alpha: 0.92 });
        coin.circle(-r * 0.32, -r * 0.32, r * 0.42).fill({ color: 0xffffff, alpha: 0.5 });
        coin.circle(0, 0, r).stroke({ color: 0xffffff, width: 1.2, alpha: 0.65 });
        p.addChild(halo, coin);
        p.position.set(x0, originY + 6);
        p.scale.set(0.25);
        ctx.layer.addChild(p);

        const vx = gr.w * ctx.rand(-0.42, 0.42); // px/s sideways
        const vy = gr.h * ctx.rand(1.3, 1.9); // px/s upward
        const dur = ctx.rand(0.9, 1.28);
        const delay = INHALE + ctx.rand(0, 0.22);
        const spin = ctx.rand(6, 13);
        const phase = ctx.rand(0, Math.PI * 2);

        // Pop out of the mouth with overshoot — arrivals never linear.
        ctx.track(ctx.gsap.to(p.scale, { x: 1, y: 1, duration: 0.16, delay, ease: 'back.out(1.9)' }));

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
        // Halo dims progressively over the flight — light falls off with age.
        ctx.track(ctx.gsap.to(halo, { alpha: 0.3, duration: dur, delay, ease: 'power2.in' }));
        // Exit: fade + shrink continuation on the way down, nothing pops off.
        ctx.track(ctx.gsap.to(p, { alpha: 0, duration: 0.32, delay: delay + dur - 0.32, ease: 'power2.in' }));
        ctx.track(ctx.gsap.to(p.scale, { x: 0.72, y: 0.72, duration: 0.32, delay: delay + dur - 0.32, ease: 'power2.in' }));
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
      const STEP = 0.11; // s per reel hop (jittered per hop below)

      // Jittered arrival time per node so the chain never marches in lockstep.
      const times: number[] = [0];
      for (let k = 1; k < nodes.length; k++) {
        times.push(times[k - 1] + STEP * ctx.rand(0.82, 1.22));
      }

      for (let k = 0; k < nodes.length - 1; k++) {
        const a = nodes[k];
        const b = nodes[k + 1];
        const seg = new Container();
        seg.alpha = 0;
        ctx.layer.addChild(seg);

        // Two independent jitters overlaid = branching feel; wide blurred
        // halo under mid glow under hot white core — 3-layer light.
        for (let dup = 0; dup < 2; dup++) {
          const pts = boltPoints(ctx, a.x, a.y, b.x, b.y, dup === 0 ? jag : jag * 0.55);
          const halo = strokePath(pts, ctx.accent, 16, 0.14);
          halo.filters = [new BlurFilter({ strength: 8 })];
          const glow = strokePath(pts, ctx.accent, 8, 0.32);
          glow.filters = [new BlurFilter({ strength: 4 })];
          const core = strokePath(pts, 0xffffff, dup === 0 ? 2.6 : 1.6, 0.92);
          seg.addChild(halo, glow, core);
        }

        // Irregular strobe: on, dip, re-strike, decay (offsets jittered).
        const tl = ctx.track(ctx.gsap.timeline({ delay: times[k] }));
        tl.to(seg, { alpha: 1, duration: 0.03, ease: 'power1.out' }, 0)
          .to(seg, { alpha: ctx.rand(0.28, 0.45), duration: 0.05, ease: 'power1.in' }, 0.05 + ctx.rand(0, 0.03))
          .to(seg, { alpha: 1, duration: 0.04, ease: 'power1.out' }, 0.11 + ctx.rand(0, 0.03))
          .to(seg, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 0.45);
      }

      // Each node: charge-gather (anticipation), squash-stretch impact flash,
      // crisp expanding ring, and a handful of ejecta sparks.
      nodes.forEach((n, i) => {
        const at = times[i];

        // Charge: dim glow converges inward just before the bolt lands.
        const charge = glowDot(ctx.accent, cell.w * 0.26, 0.55);
        charge.position.set(n.x, n.y);
        charge.scale.set(1.6);
        charge.alpha = 0;
        ctx.layer.addChild(charge);
        const ctl = ctx.track(ctx.gsap.timeline({ delay: Math.max(0, at - 0.09) }));
        ctl.to(charge, { alpha: 0.5, duration: 0.05, ease: 'power1.out' }, 0)
          .to(charge.scale, { x: 0.5, y: 0.5, duration: 0.09, ease: 'power2.in' }, 0)
          .to(charge, { alpha: 0, duration: 0.06, ease: 'power1.in' }, 0.09);

        // Impact: squash wide, hold a breath, settle round, decay.
        const hit = glowDot(ctx.accent, cell.w * 0.3, 1.2);
        hit.position.set(n.x, n.y);
        hit.scale.set(0.1);
        hit.alpha = 0;
        ctx.layer.addChild(hit);
        const tl = ctx.track(ctx.gsap.timeline({ delay: at }));
        tl.to(hit, { alpha: 1, duration: 0.04 }, 0)
          .to(hit.scale, { x: 1.18, y: 0.82, duration: 0.07, ease: 'power3.out' }, 0)
          .to(hit.scale, { x: 1, y: 1, duration: 0.24, ease: 'back.out(2)' }, 0.12)
          .to(hit, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.26);

        const ring = new Graphics();
        ring.circle(0, 0, cell.w * 0.42).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
        ring.blendMode = 'add';
        ring.position.set(n.x, n.y);
        ring.scale.set(0.2);
        ring.alpha = 0;
        ctx.layer.addChild(ring);
        const rl = ctx.track(ctx.gsap.timeline({ delay: at + 0.03 }));
        rl.to(ring, { alpha: 0.9, duration: 0.04 }, 0)
          .to(ring.scale, { x: 1, y: 1, duration: 0.35, ease: 'power3.out' }, 0)
          .to(ring, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.18);

        // Five ejecta sparks per strike — shrink + dim progressively.
        for (let s = 0; s < 5; s++) {
          const ang = ctx.rand(0, Math.PI * 2);
          const dist = cell.w * ctx.rand(0.4, 0.95);
          const spark = glowDot(ctx.gold, ctx.rand(3, 6), 0.85);
          spark.position.set(n.x, n.y);
          spark.alpha = 0;
          ctx.layer.addChild(spark);
          const fly = ctx.rand(0.28, 0.46);
          const stl = ctx.track(ctx.gsap.timeline({ delay: at + ctx.rand(0, 0.04) }));
          stl.to(spark, { alpha: ctx.rand(0.7, 1), duration: 0.04 }, 0)
            .to(spark.position, { x: n.x + Math.cos(ang) * dist, y: n.y + Math.sin(ang) * dist, duration: fly, ease: 'power3.out' }, 0)
            .to(spark.scale, { x: 0.3, y: 0.3, duration: fly * 0.7, ease: 'power2.in' }, fly * 0.3)
            .to(spark, { alpha: 0, duration: fly * 0.6, ease: 'power2.in' }, fly * 0.4);
        }
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
        const at = reel * 0.13 * ctx.rand(0.88, 1.14);

        // Cone: wide blurred wash, mid accent beam, narrow hot core streak.
        // It swings in from overshoot rotation and stretches to length as it
        // lands (anticipation via the pulled-back start pose).
        const cone = new Container();
        cone.position.set(apexX, apexY);
        cone.alpha = 0;
        cone.rotation = -0.14;
        cone.scale.y = 0.88;
        const wash = new Graphics();
        wash.poly([0, 0, -halfW, reach, halfW, reach]).fill({ color: 0xffffff, alpha: 0.13 });
        wash.blendMode = 'add';
        wash.filters = [new BlurFilter({ strength: 8 })];
        const beam = new Graphics();
        beam.poly([0, 0, -halfW * 0.45, reach, halfW * 0.45, reach]).fill({ color: ctx.accent, alpha: 0.2 });
        beam.blendMode = 'add';
        beam.filters = [new BlurFilter({ strength: 4 })];
        const hot = new Graphics();
        hot.poly([0, 0, -halfW * 0.12, reach, halfW * 0.12, reach]).fill({ color: 0xffffff, alpha: 0.1 });
        hot.blendMode = 'add';
        hot.filters = [new BlurFilter({ strength: 2 })];
        cone.addChild(wash, beam, hot);
        ctx.layer.addChild(cone);

        const tl = ctx.track(ctx.gsap.timeline({ delay: at }));
        tl.to(cone, { alpha: 1, duration: 0.14, ease: 'power2.out' }, 0)
          .to(cone.scale, { y: 1, duration: 0.22, ease: 'back.out(1.6)' }, 0)
          .to(cone, { rotation: 0.08, duration: 0.55, ease: 'sine.inOut' }, 0)
          .to(cone, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.55);

        // Cells catch the light top-to-bottom: quick dip (anticipation),
        // overshoot pop, settle, fade. Row stagger carries jitter.
        for (let row = 0; row < ctx.grid.rows; row++) {
          const cr = ctx.cellRect(reel, row);
          const tile = new Graphics();
          tile.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color: 0xffffff, alpha: 0.2 });
          // subtle top-sheen band so the lit tile reads as glass, not flat
          tile.roundRect(-cr.w / 2 + 4, -cr.h / 2 + 3, cr.w - 8, cr.h * 0.26, 8).fill({ color: 0xffffff, alpha: 0.06 });
          tile.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: ctx.gold, width: 2, alpha: 0.75 });
          tile.blendMode = 'add';
          tile.position.set(cr.x + cr.w / 2, cr.y + cr.h / 2);
          tile.alpha = 0;
          tile.scale.set(0.92);
          ctx.layer.addChild(tile);

          const ttl = ctx.track(ctx.gsap.timeline({ delay: at + 0.06 + row * 0.05 + ctx.rand(-0.015, 0.02) }));
          ttl.to(tile.scale, { x: 0.85, y: 0.85, duration: 0.07, ease: 'power2.in' }, 0)
            .to(tile, { alpha: 1, duration: 0.09, ease: 'power2.out' }, 0.03)
            .to(tile.scale, { x: 1.03, y: 1.03, duration: 0.22, ease: 'back.out(2.2)' }, 0.07)
            .to(tile.scale, { x: 1, y: 1, duration: 0.16, ease: 'power2.out' }, 0.29)
            .to(tile, { alpha: 0, duration: 0.42, ease: 'power2.in' }, 0.36);
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
      const dur = 0.92;
      const PULL = 0.09; // s — the band recoils left before sweeping
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
      band.alpha = 0;
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

      // Anticipation recoil, then the sweep proper; exits by fading while
      // still moving (direction continuation, never a hard stop).
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(band, { alpha: 1, duration: 0.1, ease: 'power1.out' }, 0)
        .to(band.position, { x: startX - gr.w * 0.04, duration: PULL, ease: 'power2.in' }, 0)
        .to(band.position, { x: endX, duration: dur, ease: 'power2.inOut' }, PULL)
        .to(band, { alpha: 0, duration: 0.22, ease: 'power1.in' }, PULL + dur - 0.22);

      // Nine star glints that pop as the band front passes; each keeps
      // rotating while it shrinks away — no synchronized pair anywhere.
      for (let i = 0; i < 9; i++) {
        const gx = gr.x + gr.w * ctx.rand(0.06, 0.94);
        const gy = gr.y + gr.h * ctx.rand(0.08, 0.92);
        const when = PULL + ((gx - startX) / (endX - startX)) * dur;
        const size = ctx.rand(7, 16);

        const glint = new Container();
        const halo = glowDot(0xffffff, size * 1.6, 0.8);
        const star = new Graphics();
        star.poly(starPoints(size, size * 0.34)).fill({ color: 0xffffff, alpha: 0.95 });
        star.blendMode = 'add';
        glint.addChild(halo, star);
        glint.position.set(gx, gy);
        glint.scale.set(0);
        ctx.layer.addChild(glint);

        const pop = ctx.rand(0.14, 0.22);
        const tl = ctx.track(ctx.gsap.timeline({ delay: Math.max(0, when - 0.05 + ctx.rand(-0.03, 0.03)) }));
        tl.to(glint.scale, { x: 1, y: 1, duration: pop, ease: `back.out(${ctx.rand(2.4, 3.4).toFixed(2)})` }, 0)
          .to(glint, { rotation: ctx.rand(0.6, 1.5), duration: 0.55, ease: 'power2.out' }, 0)
          .to(glint.scale, { x: 0.5, y: 0.5, duration: 0.3, ease: 'power2.in' }, pop + 0.06)
          .to(glint, { alpha: 0, duration: 0.28, ease: 'power2.in' }, pop + 0.08);
      }

      // Faint dust motes hang in the band's wake, drifting and dimming.
      for (let i = 0; i < 5; i++) {
        const dx = gr.x + gr.w * ctx.rand(0.1, 0.9);
        const dy = gr.y + gr.h * ctx.rand(0.15, 0.85);
        const when = PULL + ((dx - startX) / (endX - startX)) * dur;
        const mote = glowDot(ctx.gold, ctx.rand(2.5, 4.5), 0.5);
        mote.position.set(dx, dy);
        mote.alpha = 0;
        ctx.layer.addChild(mote);
        const mtl = ctx.track(ctx.gsap.timeline({ delay: Math.max(0, when + ctx.rand(0.02, 0.08)) }));
        mtl.to(mote, { alpha: ctx.rand(0.18, 0.3), duration: 0.12, ease: 'power1.out' }, 0)
          .to(mote.position, { x: dx + ctx.rand(6, 18), y: dy - ctx.rand(2, 9), duration: 0.7, ease: 'power1.out' }, 0)
          .to(mote, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.28);
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

      // Static frame flash: inhale (contract + half-lit) → snap bright with
      // overshoot → elastic settle → hold → decay. 3-layer border light.
      const frame = new Container();
      frame.position.set(cx, cy);
      const fHalo = new Graphics();
      fHalo.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 18).stroke({ color: ctx.accent, width: 26, alpha: 0.14 });
      fHalo.blendMode = 'add';
      fHalo.filters = [new BlurFilter({ strength: 12 })];
      const fGlow = new Graphics();
      fGlow.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 18).stroke({ color: ctx.accent, width: 13, alpha: 0.42 });
      fGlow.blendMode = 'add';
      fGlow.filters = [new BlurFilter({ strength: 6 })];
      const fCore = new Graphics();
      fCore.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 18).stroke({ color: 0xffffff, width: 3, alpha: 0.92 });
      fCore.blendMode = 'add';
      frame.addChild(fHalo, fGlow, fCore);
      frame.alpha = 0;
      ctx.layer.addChild(frame);
      const ftl = ctx.track(ctx.gsap.timeline());
      ftl.to(frame, { alpha: 0.45, duration: 0.08, ease: 'power1.out' }, 0)
        .to(frame.scale, { x: 0.992, y: 0.992, duration: 0.08, ease: 'power2.in' }, 0)
        .to(frame, { alpha: 1, duration: 0.06, ease: 'power2.out' }, 0.08)
        .to(frame.scale, { x: 1.016, y: 1.016, duration: 0.11, ease: 'back.out(3)' }, 0.08)
        .to(frame.scale, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' }, 0.19)
        .to(frame, { alpha: 0, duration: 0.55, ease: 'power2.in' }, 0.68);

      // Three outward-travelling border waves — jittered launch + reach.
      for (let i = 0; i < 3; i++) {
        const wave = new Container();
        wave.position.set(cx, cy);
        const wGlow = new Graphics();
        wGlow.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 20).stroke({ color: ctx.accent, width: 10, alpha: 0.38 });
        wGlow.blendMode = 'add';
        wGlow.filters = [new BlurFilter({ strength: 4 })];
        const wCore = new Graphics();
        wCore.roundRect(-gr.w / 2, -gr.h / 2, gr.w, gr.h, 20).stroke({ color: ctx.gold, width: 2.5, alpha: 0.85 });
        wCore.blendMode = 'add';
        wave.addChild(wGlow, wCore);
        wave.alpha = 0;
        wave.scale.set(0.99);
        ctx.layer.addChild(wave);

        const tl = ctx.track(ctx.gsap.timeline({ delay: 0.14 + i * 0.16 * ctx.rand(0.85, 1.2) }));
        tl.to(wave, { alpha: ctx.rand(0.75, 0.95), duration: 0.06, ease: 'power1.out' }, 0)
          .to(wave.scale, {
            x: 1.14 + i * 0.05 + ctx.rand(0, 0.03),
            y: 1.18 + i * 0.06 + ctx.rand(0, 0.03),
            duration: ctx.rand(0.68, 0.84),
            ease: 'power3.out',
          }, 0)
          .to(wave, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.32);
      }

      // Corner sparks punctuate the pulse — unordered, each with its own
      // beat: overshoot pop, breath, then shrink-and-fade.
      const corners = [
        { x: gr.x, y: gr.y },
        { x: gr.x + gr.w, y: gr.y },
        { x: gr.x, y: gr.y + gr.h },
        { x: gr.x + gr.w, y: gr.y + gr.h },
      ];
      corners.forEach((c) => {
        const s = glowDot(ctx.gold, ctx.rand(11, 17), 1.1);
        s.position.set(c.x, c.y);
        s.scale.set(0);
        ctx.layer.addChild(s);
        const tl = ctx.track(ctx.gsap.timeline({ delay: 0.08 + ctx.rand(0, 0.14) }));
        tl.to(s.scale, { x: 1, y: 1, duration: ctx.rand(0.18, 0.26), ease: 'back.out(3.6)' }, 0)
          .to(s.scale, { x: 0.55, y: 0.55, duration: 0.4, ease: 'power2.in' }, 0.3)
          .to(s, { alpha: 0, duration: 0.42, ease: 'power2.in' }, 0.32);
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
      const GATHER = 0.1; // s — the centre inhales before the burst

      // Centre pop with anticipation: gathers inward, then detonates.
      const pop = glowDot(0xffffff, gr.w * 0.15, 1.3);
      pop.position.set(cx, cy);
      pop.scale.set(0.55);
      pop.alpha = 0.35;
      ctx.layer.addChild(pop);
      const ptl = ctx.track(ctx.gsap.timeline());
      ptl.to(pop.scale, { x: 0.2, y: 0.2, duration: GATHER, ease: 'power2.in' }, 0)
        .to(pop, { alpha: 1, duration: GATHER, ease: 'power1.in' }, 0)
        .to(pop.scale, { x: 1.05, y: 1.05, duration: 0.2, ease: 'back.out(2.5)' }, GATHER)
        .to(pop, { alpha: 0, duration: 0.35, ease: 'power2.out' }, GATHER + 0.1);

      // Thirteen stars, angle-jittered off an even fan, each with its own
      // flight time; they shrink and dim progressively as they die.
      const palette: readonly number[] = [ctx.gold, ctx.accent, 0xffffff];
      const count = 13;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ctx.rand(-0.28, 0.28);
        const dist = maxR * ctx.rand(0.35, 0.98);
        const size = ctx.rand(9, 22);
        const color = ctx.pick(palette);

        const star = new Container();
        const halo = glowDot(color, size * 1.5, 0.6);
        const body = new Graphics();
        body.poly(starPoints(size, size * 0.4)).fill({ color, alpha: 0.92 });
        body.poly(starPoints(size, size * 0.4)).stroke({ color: 0xffffff, width: 1.4, alpha: 0.75 });
        body.blendMode = 'add';
        star.addChild(halo, body);
        star.position.set(cx, cy);
        star.scale.set(0);
        star.rotation = ctx.rand(0, Math.PI);
        ctx.layer.addChild(star);

        const fly = ctx.rand(0.78, 1.02);
        const tl = ctx.track(ctx.gsap.timeline({ delay: GATHER + ctx.rand(0, 0.1) }));
        tl.to(star.scale, { x: 1, y: 1, duration: 0.24, ease: `back.out(${ctx.rand(2.3, 3.1).toFixed(2)})` }, 0)
          .to(star.position, { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, duration: fly, ease: 'power3.out' }, 0)
          .to(star, { rotation: star.rotation + ctx.rand(-3.2, 3.2), duration: fly, ease: 'power2.out' }, 0)
          .to(star.scale, { x: 0.45, y: 0.45, duration: fly * 0.55, ease: 'power2.in' }, fly * 0.42)
          .to(star, { alpha: 0, duration: fly * 0.5, ease: 'power2.in' }, fly * 0.52)
          .to(halo, { alpha: 0.25, duration: fly * 0.6, ease: 'power2.in' }, fly * 0.3);
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
      const DROP = 0.1; // s — droplet gather before the ripple launches

      // Droplet anticipation: a small glow converges on the centre, then the
      // ripple ring launches from the splash.
      const drop = glowDot(ctx.accent, gr.w * 0.09, 0.9);
      drop.position.set(cx, cy);
      drop.scale.set(1.5);
      drop.alpha = 0;
      ctx.layer.addChild(drop);
      const dtl = ctx.track(ctx.gsap.timeline());
      dtl.to(drop, { alpha: 0.7, duration: 0.05, ease: 'power1.out' }, 0)
        .to(drop.scale, { x: 0.4, y: 0.4, duration: DROP, ease: 'power2.in' }, 0)
        .to(drop.scale, { x: 1.2, y: 1.2, duration: 0.16, ease: 'back.out(2)' }, DROP)
        .to(drop, { alpha: 0, duration: 0.2, ease: 'power2.in' }, DROP + 0.08);

      // The travelling ripple ring the tiles ride on — 3-layer light.
      const RING_BASE = 40;
      const ring = new Container();
      ring.position.set(cx, cy);
      const rHalo = new Graphics();
      rHalo.circle(0, 0, RING_BASE).stroke({ color: ctx.accent, width: 24, alpha: 0.13 });
      rHalo.blendMode = 'add';
      rHalo.filters = [new BlurFilter({ strength: 10 })];
      const rGlow = new Graphics();
      rGlow.circle(0, 0, RING_BASE).stroke({ color: ctx.accent, width: 11, alpha: 0.35 });
      rGlow.blendMode = 'add';
      rGlow.filters = [new BlurFilter({ strength: 5 })];
      const rCore = new Graphics();
      rCore.circle(0, 0, RING_BASE).stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
      rCore.blendMode = 'add';
      ring.addChild(rHalo, rGlow, rCore);
      ring.scale.set(0.05);
      ring.alpha = 0;
      ctx.layer.addChild(ring);
      const rtl = ctx.track(ctx.gsap.timeline({ delay: DROP }));
      rtl.to(ring, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
        .to(ring.scale, { x: (maxDist * 1.15) / RING_BASE, y: (maxDist * 1.15) / RING_BASE, duration: SPREAD + 0.25, ease: 'power1.out' }, 0)
        .to(ring, { alpha: 0, duration: 0.3, ease: 'power2.in' }, SPREAD);

      // Each tile flashes when the ripple front reaches it: quick dip,
      // overshoot pop, micro-settle, fade. Per-tile jitter breaks the grid
      // rhythm just enough to feel alive.
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const cr = ctx.cellRect(reel, row);
          const c = centreOf(cr);
          const dist = Math.hypot(c.x - cx, c.y - cy);
          const at = DROP + (dist / maxDist) * SPREAD + ctx.rand(-0.02, 0.03);

          const tile = new Container();
          tile.position.set(c.x, c.y);
          const fill = new Graphics();
          fill.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color: ctx.accent, alpha: 0.24 });
          // top sheen so the flash reads as lit glass, not a flat rect
          fill.roundRect(-cr.w / 2 + 4, -cr.h / 2 + 3, cr.w - 8, cr.h * 0.26, 8).fill({ color: 0xffffff, alpha: 0.05 });
          fill.blendMode = 'add';
          const edge = new Graphics();
          edge.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: 0xffffff, width: 2, alpha: 0.85 });
          edge.blendMode = 'add';
          const glint = glowDot(ctx.gold, Math.min(cr.w, cr.h) * 0.16, 0.9);
          glint.position.set(cr.w * 0.28, -cr.h * 0.28);
          tile.addChild(fill, edge, glint);
          tile.alpha = 0;
          tile.scale.set(0.62);
          ctx.layer.addChild(tile);

          const tl = ctx.track(ctx.gsap.timeline({ delay: Math.max(0, at) }));
          tl.to(tile.scale, { x: 0.55, y: 0.55, duration: 0.06, ease: 'power2.in' }, 0)
            .to(tile, { alpha: 1, duration: 0.08, ease: 'power2.out' }, 0.02)
            .to(tile.scale, { x: 1.07, y: 1.07, duration: 0.19, ease: 'back.out(2.8)' }, 0.06)
            .to(tile.scale, { x: 1, y: 1, duration: 0.22, ease: 'power2.out' }, 0.25)
            .to(tile, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.38);
        }
      }
    },
  },
];
