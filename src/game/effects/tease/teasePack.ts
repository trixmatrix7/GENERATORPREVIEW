// teasePack — five near-miss anticipation styles for the REAL tease runtime
// (2 scatters landed, right reels riding the deceleration ladder).
//
// Two hooks per preset:
//   onScatterLanded — the scatter just hit; celebrate it WITH the landing thud
//                     (impact first, then settle into a patient loop — the
//                     tease can run for seconds, so the resting state matters
//                     more than the entry).
//   onPendingReel   — reel `position` in the ladder is still spinning and will
//                     run ~0.35s*(k+1) longer; ramps and cadences scale off
//                     that so the visual peaks as the reel is about to stop.
//
// Craft rules: one hero read per hook, everything else supports it. Glows are
// stacked (wide dim halo / colored core / hot white centre) — never one flat
// shape. Arrivals accelerate in (power3/4.in), impacts squash + hold ~0.08s,
// settles are back.out. Loop cadences carry ctx.rand jitter so nothing runs
// in lockstep — EXCEPT tease-heartbeat-dark, whose whole point is one shared
// pulse. Every tween goes through ctx.track; the runtime clears the layer
// when the tease resolves.
//
// Contract: only Container/Graphics from pixi.js, geometry only via ctx
// rects, colors only ctx.accent / ctx.gold / white / black.

import { Container, Graphics } from 'pixi.js';
import type { TeasePreset, TeaseContext } from '../teaseTypes';

type Rect = ReturnType<TeaseContext['cellRect']>;

// ---------------------------------------------------------------------------
// shared helpers (Graphics-only glow stacks — no textures/filters allowed)
// ---------------------------------------------------------------------------

/** Soft radial glow faked with concentric additive fills. Peak alpha lands
 *  in the centre, falls off toward the rim. */
function glowDisc(color: number, rad: number, peak: number, steps = 5): Graphics {
  const g = new Graphics();
  for (let i = steps; i >= 1; i--) {
    g.circle(0, 0, rad * (i / steps)).fill({ color, alpha: peak / steps });
  }
  g.blendMode = 'add';
  return g;
}

/** AAA point light: wide dim halo / colored core / hot white centre. */
function layeredGlow(tint: number, size: number): Container {
  const c = new Container();
  c.addChild(
    glowDisc(tint, size * 1.15, 0.14),   // wide halo, whisper-quiet
    glowDisc(tint, size * 0.55, 0.4),    // colored body
    glowDisc(0xffffff, size * 0.22, 0.6) // hot centre
  );
  return c;
}

/** Soft vertical light shaft, anchored top-centre (draws 0..h downward). */
function softShaft(color: number, w: number, h: number, peak: number, steps = 4): Graphics {
  const g = new Graphics();
  for (let i = steps; i >= 1; i--) {
    const ww = w * (i / steps);
    g.roundRect(-ww / 2, 0, ww, h, Math.min(ww / 2, 12)).fill({ color, alpha: peak / steps });
  }
  g.blendMode = 'add';
  return g;
}

/** Soft horizontal band, centred both axes. */
function softBand(color: number, w: number, h: number, peak: number, steps = 3): Graphics {
  const g = new Graphics();
  for (let i = steps; i >= 1; i--) {
    const hh = h * (i / steps);
    g.roundRect(-w / 2, -hh / 2, w, hh, hh / 2).fill({ color, alpha: peak / steps });
  }
  g.blendMode = 'add';
  return g;
}

/** Additive rounded-rect ring: dim wide stroke under a hot thin one. Drawn
 *  centred on (0,0) so the container can scale-pulse around its middle. */
function rimRing(r: Rect, radius: number, tint: number, wideA: number, hotA: number): Container {
  const c = new Container();
  const wide = new Graphics();
  wide.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, radius).stroke({ color: tint, width: 7, alpha: wideA });
  wide.blendMode = 'add';
  const hot = new Graphics();
  hot.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, radius).stroke({ color: 0xffffff, width: 1.6, alpha: hotA });
  hot.blendMode = 'add';
  c.addChild(wide, hot);
  return c;
}

/** Per-hook root so a preset can treat everything it spawned as one unit. */
function root(ctx: TeaseContext): Container {
  const c = new Container();
  ctx.layer.addChild(c);
  return c;
}

/** Point + tangent angle at parameter t (0..1) along a rect's perimeter. */
function perimeterPoint(r: Rect, t: number): { x: number; y: number; rot: number } {
  const per = 2 * (r.w + r.h);
  let d = (((t % 1) + 1) % 1) * per;
  if (d < r.w) return { x: r.x + d, y: r.y, rot: 0 };
  d -= r.w;
  if (d < r.h) return { x: r.x + r.w, y: r.y + d, rot: Math.PI / 2 };
  d -= r.h;
  if (d < r.w) return { x: r.x + r.w - d, y: r.y + r.h, rot: Math.PI };
  d -= r.w;
  return { x: r.x, y: r.y + r.h - d, rot: -Math.PI / 2 };
}

/** Redraw `g` as a jagged 4-segment bolt from (x,y) along `ang`. Two passes:
 *  dim accent aura under a hot white core. */
function drawBolt(g: Graphics, ctx: TeaseContext, x: number, y: number, ang: number, len: number): void {
  g.clear();
  const segs = 4;
  const pts: number[] = [x, y];
  for (let i = 1; i <= segs; i++) {
    const d = (len / segs) * i;
    const j = i === segs ? 0 : ctx.rand(-4.5, 4.5); // tips anchor, middles jitter
    pts.push(
      x + Math.cos(ang) * d + Math.cos(ang + Math.PI / 2) * j,
      y + Math.sin(ang) * d + Math.sin(ang + Math.PI / 2) * j,
    );
  }
  for (const pass of [
    { color: ctx.accent, width: 4, alpha: 0.35 },
    { color: 0xffffff, width: 1.4, alpha: 0.9 },
  ]) {
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke(pass);
  }
}

/** The one shared clock in the pack — tease-heartbeat-dark deliberately runs
 *  every element on this cycle so scatters and pending reels thump together. */
const HEART = 0.98;

/** One lub-dub cycle on a repeat:-1 timeline: hard lub (power4.out, 0.08s
 *  hold at peak), eased return, softer dub echo. `glow` gets a matching
 *  brightness thump. NO jitter here — sync IS the effect. */
function addHeartbeat(ctx: TeaseContext, node: Container, amp: number, glow?: Container): void {
  const tl = ctx.track(ctx.gsap.timeline({ repeat: -1, repeatDelay: HEART - 0.66 }));
  tl.to(node.scale, { x: 1 + amp, y: 1 + amp, duration: 0.1, ease: 'power4.out' }, 0)
    .to(node.scale, { x: 1, y: 1, duration: 0.16, ease: 'power2.in' }, 0.18) // 0.08s hold first
    .to(node.scale, { x: 1 + amp * 0.55, y: 1 + amp * 0.55, duration: 0.09, ease: 'power4.out' }, 0.34)
    .to(node.scale, { x: 1, y: 1, duration: 0.2, ease: 'power2.in' }, 0.46);
  if (glow) {
    tl.to(glow, { alpha: 1, duration: 0.08, ease: 'power3.out' }, 0)
      .to(glow, { alpha: 0.45, duration: 0.28, ease: 'power2.out' }, 0.12)
      .to(glow, { alpha: 0.8, duration: 0.07, ease: 'power3.out' }, 0.34)
      .to(glow, { alpha: 0.4, duration: 0.32, ease: 'power2.out' }, 0.44);
  }
}

// ---------------------------------------------------------------------------
// the pack
// ---------------------------------------------------------------------------

export const TEASE_PACK: readonly TeasePreset[] = [
  // -------------------------------------------------------------------------
  // 1. Inferno — landed scatters ignite; the pending reel cooks.
  // -------------------------------------------------------------------------
  {
    id: 'tease-inferno',
    name: 'Inferno',
    description: 'Landed scatters ignite in an ember ring with a breathing heat core; the pending reel fills with rising heat-haze while its edges burn hotter the longer it spins',
    onScatterLanded(ctx, reel, row) {
      const node = root(ctx);
      const r = ctx.cellRect(reel, row);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rad = Math.max(r.w, r.h) * 0.52;

      // hero: the heat core — dark until the ring closes around it
      const core = layeredGlow(ctx.gold, rad * 1.2);
      core.position.set(cx, cy);
      core.alpha = 0;
      core.scale.set(0.6);
      node.addChild(core);

      // ignition ring, drawn progressively clockwise from 12 o'clock
      const ring = new Graphics();
      ring.blendMode = 'add';
      node.addChild(ring);
      const a0 = -Math.PI / 2;
      const sweep = { t: 0 };
      const drawRing = () => {
        ring.clear();
        const a1 = a0 + sweep.t * Math.PI * 2;
        ring.moveTo(cx + Math.cos(a0) * rad, cy + Math.sin(a0) * rad);
        ring.arc(cx, cy, rad, a0, a1);
        ring.stroke({ color: ctx.gold, width: 7, alpha: 0.32 });
        ring.moveTo(cx + Math.cos(a0) * rad, cy + Math.sin(a0) * rad);
        ring.arc(cx, cy, rad, a0, a1);
        ring.stroke({ color: 0xffffff, width: 2, alpha: 0.75 });
        // burning head leading the sweep
        ring.circle(cx + Math.cos(a1) * rad, cy + Math.sin(a1) * rad, 4.5)
          .fill({ color: 0xffffff, alpha: 0.9 });
      };

      // setup: one match-strike spark at 12 o'clock, then the fire catches
      const spark = layeredGlow(0xffffff, 13);
      spark.position.set(cx, cy - rad);
      spark.alpha = 0;
      node.addChild(spark);

      const tl = ctx.track(ctx.gsap.timeline());
      // SFX: match strike
      tl.to(spark, { alpha: 1, duration: 0.08, ease: 'power3.out' }, 0)
        .to(spark, { alpha: 0, duration: 0.16, ease: 'power2.in' }, 0.14)
        // fire accelerates around the rim — it CATCHES, it doesn't cruise
        // SFX: ember ring ignition whoosh
        .to(sweep, { t: 1, duration: 0.5, ease: 'power2.in', onUpdate: drawRing }, 0.1)
        // payoff: ring closes, heat core blooms with weight + 0.08s hold
        // SFX: heat bloom thump
        .to(core, { alpha: 1, duration: 0.07, ease: 'power4.out' }, 0.6)
        .to(core.scale, { x: 1.12, y: 1.12, duration: 0.11, ease: 'power4.out' }, 0.6)
        .to(core.scale, { x: 1, y: 1, duration: 0.26, ease: 'back.out(1.8)' }, 0.79)
        // resolution: the ring settles to a smoulder
        .to(ring, { alpha: 0.72, duration: 0.35, ease: 'power1.out' }, 0.85);

      // resting state: the core breathes like a coal — each scatter at its
      // own tempo (no two scatters ever pulse in lockstep)
      const period = ctx.rand(0.6, 0.85);
      const breathe = ctx.track(ctx.gsap.timeline({ repeat: -1, delay: 1.05 }));
      breathe.to(core.scale, { x: 1.07, y: 1.07, duration: period, ease: 'sine.inOut' }, 0)
        .to(core, { alpha: 0.82, duration: period, ease: 'sine.inOut' }, 0)
        .to(core.scale, { x: 1, y: 1, duration: period, ease: 'sine.inOut' }, period)
        .to(core, { alpha: 1, duration: period, ease: 'sine.inOut' }, period);

      // three stray embers lifting off the ring — sparse on purpose
      for (let i = 0; i < 3; i++) {
        const e = glowDisc(ctx.pick([ctx.gold, ctx.gold, 0xffffff]), ctx.rand(3.5, 6), 0.9);
        node.addChild(e);
        const ang = ctx.rand(-0.7, 0.7) + Math.PI / 2; // lower half of the ring
        const ex = cx + Math.cos(ang) * rad * ctx.rand(0.75, 1);
        const ey = cy + Math.sin(ang) * rad * ctx.rand(0.75, 1);
        const rise = ctx.rand(0.8, 1.25);
        const etl = ctx.track(ctx.gsap.timeline({
          repeat: -1,
          delay: 1.0 + i * ctx.rand(0.25, 0.45),
          repeatDelay: ctx.rand(0.3, 0.9),
        }));
        etl.set(e, { x: ex, y: ey, alpha: 0 }, 0)
          .set(e.scale, { x: 1, y: 1 }, 0)
          .to(e, { alpha: ctx.rand(0.5, 0.85), duration: 0.15, ease: 'power1.out' }, 0)
          .to(e, { y: ey - ctx.rand(30, 55), duration: rise, ease: 'power1.in' }, 0)
          .to(e, { x: ex + ctx.rand(-10, 10), duration: rise * 0.55, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
          .to(e.scale, { x: 0.4, y: 0.4, duration: rise, ease: 'power1.in' }, 0)
          .to(e, { alpha: 0, duration: 0.2, ease: 'power2.in' }, rise - 0.18);
      }
    },
    onPendingReel(ctx, reel, position) {
      const node = root(ctx);
      const r = ctx.reelRect(reel);
      const climb = 0.35 * (position + 1);           // matches the decel ladder
      const heat = Math.min(1, 0.55 + position * 0.3); // later reels burn hotter

      // SFX: low heat rumble, swells with position

      // heat-haze: three soft bands drifting up the spinning reel, looping —
      // supporting texture only, kept under the edge-burn hero
      for (let i = 0; i < 3; i++) {
        const band = softBand(ctx.gold, r.w * 0.92, ctx.rand(26, 40), 0.15 * heat);
        band.position.set(r.x + r.w / 2, r.y + r.h - 20);
        band.alpha = 0;
        node.addChild(band);
        const dur = ctx.rand(1.0, 1.5);
        const btl = ctx.track(ctx.gsap.timeline({
          repeat: -1,
          delay: i * ctx.rand(0.26, 0.42),
          repeatDelay: ctx.rand(0.05, 0.2),
        }));
        btl.set(band, { y: r.y + r.h - 20, alpha: 0 }, 0)
          .to(band, { alpha: 1, duration: dur * 0.25, ease: 'sine.out' }, 0)
          // haze accelerates as it rises — hot air, not a screensaver
          .to(band, { y: r.y + 28, duration: dur, ease: 'power1.in' }, 0)
          .to(band.scale, { x: ctx.rand(1.05, 1.12), duration: dur, ease: 'sine.inOut' }, 0)
          .to(band, { alpha: 0, duration: dur * 0.3, ease: 'power1.in' }, dur * 0.7);
      }

      // hero: the reel edges heat from nothing to white-hot across the reel's
      // remaining spin time — the burn PEAKS right as the reel is about to stop
      const edgeW = Math.max(6, r.w * 0.09);
      const edges: Container[] = [];
      const hotCores: Graphics[] = [];
      for (const [ex, idx] of [[r.x + edgeW * 0.25, 0], [r.x + r.w - edgeW * 0.25, 1]] as const) {
        const edge = new Container();
        const wide = softShaft(ctx.gold, edgeW * 3.4, r.h, 0.12 * heat);
        const body = softShaft(ctx.gold, edgeW * 1.5, r.h, 0.34 * heat);
        const hot = softShaft(0xffffff, edgeW * 0.5, r.h, 0.5 * heat, 2);
        edge.addChild(wide, body, hot);
        edge.position.set(ex, r.y);
        edge.alpha = 0;
        node.addChild(edge);
        edges.push(edge);
        hotCores.push(hot);

        // the two edges ignite out of phase — never lockstep
        const phase = idx * ctx.rand(0.09, 0.16);
        const etl = ctx.track(ctx.gsap.timeline({ delay: phase }));
        // power2.in ramp: barely-there at first, ferocious by the stop
        etl.to(edge, { alpha: 1, duration: climb + 0.45, ease: 'power2.in' }, 0);
        // nervous width-flicker on the hot core once it's cooking
        const ftl = ctx.track(ctx.gsap.timeline({ delay: phase + (climb + 0.45) * 0.55 }));
        ftl.to(hot.scale, {
          x: ctx.rand(1.15, 1.3),
          duration: ctx.rand(0.05, 0.075),
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        }, 0);
      }
    },
  },

  // -------------------------------------------------------------------------
  // 2. Neon Siren — Miami dusk: two-tone neon strobe + a slow cruiser sweep.
  //    (contract palette: ctx.accent plays the cyan tube, ctx.gold the pink)
  // -------------------------------------------------------------------------
  {
    id: 'tease-neon-siren',
    name: 'Neon Siren',
    description: 'Landed scatters strobe softly between two neon tubes; a slow two-tone police-light sweep patrols the pending reel',
    onScatterLanded(ctx, reel, row) {
      const node = root(ctx);
      const r = ctx.cellRect(reel, row);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      // two complete light rigs (tube frame + under-glow), cross-faded —
      // never both at full: it's a breathing alternation, not a disco
      const mkRig = (tint: number) => {
        const rig = new Container();
        const under = glowDisc(tint, Math.max(r.w, r.h) * 0.72, 0.34);
        const frameWide = new Graphics();
        frameWide.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 12).stroke({ color: tint, width: 8, alpha: 0.13 });
        frameWide.blendMode = 'add';
        const frameBody = new Graphics();
        frameBody.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 12).stroke({ color: tint, width: 3, alpha: 0.7 });
        frameBody.blendMode = 'add';
        const frameHot = new Graphics();
        frameHot.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 12).stroke({ color: 0xffffff, width: 1, alpha: 0.35 });
        frameHot.blendMode = 'add';
        rig.addChild(under, frameWide, frameBody, frameHot);
        rig.position.set(cx, cy);
        return rig;
      };
      const cool = mkRig(ctx.accent); // the "cyan" tube
      const warm = mkRig(ctx.gold);   // the "pink" tube
      node.addChild(cool, warm);
      warm.alpha = 0;

      // entry: the whole sign drops onto the cell with weight — snap in,
      // 0.08s hold, back.out settle
      // SFX: neon tube clink + buzz-on
      node.alpha = 0;
      node.pivot.set(0, 0);
      cool.scale.set(1.22);
      warm.scale.set(1.22);
      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(node, { alpha: 1, duration: 0.1, ease: 'power2.out' }, 0)
        .to([cool.scale, warm.scale], { x: 0.97, y: 0.97, duration: 0.18, ease: 'power4.in' }, 0)
        .to([cool.scale, warm.scale], { x: 1, y: 1, duration: 0.24, ease: 'back.out(1.9)' }, 0.26);

      // resting state: soft two-tone strobe. Half-period jittered per scatter
      // so multiple scatters shimmer against each other instead of blinking
      // as one block.
      const half = 0.42 + ctx.rand(-0.06, 0.06);
      const flip = ctx.track(ctx.gsap.timeline({ repeat: -1, delay: 0.55 + ctx.rand(0, 0.2) }));
      // SFX: soft siren shimmer (loop)
      flip.to(cool, { alpha: 0.16, duration: half, ease: 'sine.inOut' }, 0)
        .to(warm, { alpha: 0.95, duration: half, ease: 'sine.inOut' }, 0)
        .to(cool, { alpha: 0.95, duration: half, ease: 'sine.inOut' }, half)
        .to(warm, { alpha: 0.16, duration: half, ease: 'sine.inOut' }, half);
    },
    onPendingReel(ctx, reel, position) {
      const node = root(ctx);
      const r = ctx.reelRect(reel);
      const peak = Math.min(0.32, 0.18 + position * 0.05); // brighter deeper in the ladder

      // faint wash so the patrol reads against the spinning symbols
      const wash = new Graphics();
      wash.roundRect(r.x, r.y, r.w, r.h, 10).fill({ color: ctx.accent, alpha: 0.05 });
      wash.blendMode = 'add';
      wash.alpha = 0;
      node.addChild(wash);

      // hero: two soft light shafts sweeping the reel in opposition — the
      // slow police-light pan. Slightly different periods so the pair drifts
      // in and out of phase like real rotating beacons.
      const period = Math.max(1.1, 1.7 - position * 0.15);
      const x0 = r.x + r.w * 0.2;
      const x1 = r.x + r.w * 0.8;
      const mkSweep = (tint: number, fromX: number, toX: number, per: number, delay: number) => {
        const shaft = softShaft(tint, r.w * 0.5, r.h, peak);
        shaft.position.set(fromX, r.y);
        shaft.alpha = 0;
        node.addChild(shaft);
        const stl = ctx.track(ctx.gsap.timeline({ delay }));
        stl.to(shaft, { alpha: 1, duration: 0.35, ease: 'power1.out' }, 0);
        const sweep = ctx.track(ctx.gsap.timeline({ repeat: -1, delay }));
        sweep.to(shaft, { x: toX, duration: per, ease: 'sine.inOut' }, 0)
          .to(shaft, { x: fromX, duration: per, ease: 'sine.inOut' }, per);
      };
      // SFX: slow siren wail, doppler pan
      mkSweep(ctx.accent, x0, x1, period, 0.05);
      mkSweep(ctx.gold, x1, x0, period * ctx.rand(0.94, 0.98), 0.05 + ctx.rand(0.06, 0.14));

      const wtl = ctx.track(ctx.gsap.timeline());
      wtl.to(wash, { alpha: 1, duration: 0.4, ease: 'power1.out' }, 0);
    },
  },

  // -------------------------------------------------------------------------
  // 3. Golden Stage — house lights down, spotlight up.
  // -------------------------------------------------------------------------
  {
    id: 'tease-golden-stage',
    name: 'Golden Stage',
    description: 'A breathing golden spotlight cone drops onto each landed scatter; side curtains dim the neighbours while a centre light shaft holds the pending reel',
    onScatterLanded(ctx, reel, row) {
      const node = root(ctx);
      const r = ctx.cellRect(reel, row);
      const cx = r.x + r.w / 2;
      const apexY = r.y - r.h * 0.5;   // lamp hangs above the cell
      const floorY = r.y + r.h;
      const h = floorY - apexY;

      // hero: the spotlight cone — three nested wedges, apex-anchored so the
      // y-scale drop reads as light physically falling
      const cone = new Container();
      const mkWedge = (topW: number, botW: number, tint: number, alpha: number) => {
        const g = new Graphics();
        g.poly([-topW / 2, 0, topW / 2, 0, botW / 2, h, -botW / 2, h]).fill({ color: tint, alpha });
        g.blendMode = 'add';
        return g;
      };
      cone.addChild(
        mkWedge(14, r.w * 1.5, ctx.gold, 0.1),
        mkWedge(9, r.w * 1.05, ctx.gold, 0.16),
        mkWedge(5, r.w * 0.42, 0xffffff, 0.12),
      );
      cone.position.set(cx, apexY);
      cone.scale.y = 0;
      node.addChild(cone);

      // lamp glint at the fixture — outside the cone so scale never smears it
      const lamp = layeredGlow(ctx.gold, r.w * 0.4);
      lamp.position.set(cx, apexY);
      lamp.alpha = 0;
      node.addChild(lamp);

      // light pool where the beam meets the floor
      const pool = new Container();
      const poolWide = new Graphics();
      poolWide.ellipse(0, 0, r.w * 0.62, 13).fill({ color: ctx.gold, alpha: 0.3 });
      poolWide.blendMode = 'add';
      const poolHot = new Graphics();
      poolHot.ellipse(0, 0, r.w * 0.3, 6).fill({ color: 0xffffff, alpha: 0.16 });
      poolHot.blendMode = 'add';
      pool.addChild(poolWide, poolHot);
      pool.position.set(cx, floorY - 4);
      pool.alpha = 0;
      pool.scale.set(0.55);
      node.addChild(pool);

      const tl = ctx.track(ctx.gsap.timeline());
      // setup: the lamp blinks awake and dips — a breath before the drop
      // SFX: stage lamp switch
      tl.to(lamp, { alpha: 0.9, duration: 0.08, ease: 'power3.out' }, 0)
        .to(lamp, { alpha: 0.35, duration: 0.07, ease: 'power2.in' }, 0.1)
        // payoff: the beam falls with weight and slams the floor
        // SFX: spotlight thunk
        .to(cone.scale, { y: 1.05, duration: 0.26, ease: 'power4.in' }, 0.17)
        .to(lamp, { alpha: 1, duration: 0.08, ease: 'power2.out' }, 0.43)
        .to(pool, { alpha: 1, duration: 0.1, ease: 'power2.out' }, 0.42)
        .to(pool.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.9)' }, 0.42)
        // 0.08s hold at full stretch, then the beam settles
        .to(cone.scale, { y: 1, duration: 0.22, ease: 'back.out(1.7)' }, 0.51);

      // resting state: the light breathes — alpha and a whisper of width
      const period = ctx.rand(0.9, 1.15);
      const breathe = ctx.track(ctx.gsap.timeline({ repeat: -1, delay: 0.85 }));
      breathe.to(cone, { alpha: 0.8, duration: period, ease: 'sine.inOut' }, 0)
        .to(cone.scale, { x: 1.05, duration: period, ease: 'sine.inOut' }, 0)
        .to(pool, { alpha: 0.75, duration: period, ease: 'sine.inOut' }, 0)
        .to(cone, { alpha: 1, duration: period, ease: 'sine.inOut' }, period)
        .to(cone.scale, { x: 1, duration: period, ease: 'sine.inOut' }, period)
        .to(pool, { alpha: 1, duration: period, ease: 'sine.inOut' }, period);

      // three dust motes drifting up inside the beam — quiet support
      for (let i = 0; i < 3; i++) {
        const m = glowDisc(0xffffff, ctx.rand(2.5, 4.5), 0.5);
        node.addChild(m);
        const mx = cx + ctx.rand(-r.w * 0.22, r.w * 0.22);
        const my = floorY - ctx.rand(8, r.h * 0.5);
        const rise = ctx.rand(1.1, 1.7);
        const mtl = ctx.track(ctx.gsap.timeline({
          repeat: -1,
          delay: 0.7 + i * ctx.rand(0.3, 0.55),
          repeatDelay: ctx.rand(0.2, 0.7),
        }));
        mtl.set(m, { x: mx, y: my, alpha: 0 }, 0)
          .to(m, { alpha: ctx.rand(0.12, 0.22), duration: 0.35, ease: 'power1.out' }, 0)
          .to(m, { y: my - ctx.rand(30, 60), duration: rise, ease: 'sine.out' }, 0)
          .to(m, { x: mx + ctx.rand(-8, 8), duration: rise * 0.6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
          .to(m, { alpha: 0, duration: 0.4, ease: 'power2.in' }, rise - 0.38);
      }
    },
    onPendingReel(ctx, reel, position) {
      const node = root(ctx);
      const r = ctx.reelRect(reel);
      const g = ctx.gridRect();
      const dim = Math.min(0.6, 0.42 + position * 0.06); // deeper in the ladder = darker room

      // SFX: heavy curtain sweep
      // two velvet curtains: everything that is NOT the pending reel dims.
      // They fade AND drift inward a touch — cloth settling, not a slab.
      const mkCurtain = (x: number, w: number, inward: number) => {
        if (w < 2) return;
        const c = new Container();
        const cloth = new Graphics();
        cloth.rect(0, g.y, w, g.h).fill({ color: 0x000000, alpha: 1 });
        // gold trim on the inner edge so the curtain doesn't read dead flat
        const trim = new Graphics();
        const tx = inward > 0 ? w - 1.5 : 0;
        trim.roundRect(tx, g.y + 4, 1.5, g.h - 8, 0.75).fill({ color: ctx.gold, alpha: 0.25 });
        trim.blendMode = 'add';
        c.addChild(cloth, trim);
        c.position.set(x - inward * 12, 0); // starts 12px shy of home
        c.alpha = 0;
        node.addChild(c);
        const tl = ctx.track(ctx.gsap.timeline());
        tl.to(c, { alpha: dim, duration: 0.42, ease: 'power2.out' }, 0)
          .to(c, { x, duration: 0.55, ease: 'power2.out' }, 0);
      };
      mkCurtain(g.x, r.x - g.x, 1);                          // left of the reel
      mkCurtain(r.x + r.w, g.x + g.w - (r.x + r.w), -1);     // right of the reel

      // hero: the centre shaft holds the spinning reel in warm light,
      // breathing a little faster the deeper the ladder goes
      const shaft = softShaft(ctx.gold, r.w * 1.12, r.h, 0.14 + position * 0.04);
      shaft.position.set(r.x + r.w / 2, r.y);
      shaft.alpha = 0;
      node.addChild(shaft);
      const period = Math.max(0.75, 1.15 - position * 0.09);
      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(shaft, { alpha: 1, duration: 0.5, ease: 'power2.out' }, 0.15);
      const breathe = ctx.track(ctx.gsap.timeline({ repeat: -1, delay: 0.65 }));
      breathe.to(shaft, { alpha: 0.72, duration: period, ease: 'sine.inOut' }, 0)
        .to(shaft.scale, { x: 1.06, duration: period, ease: 'sine.inOut' }, 0)
        .to(shaft, { alpha: 1, duration: period, ease: 'sine.inOut' }, period)
        .to(shaft.scale, { x: 1, duration: period, ease: 'sine.inOut' }, period);
    },
  },

  // -------------------------------------------------------------------------
  // 4. Electric Storm — scatters crackle; pressure closes on the pending reel.
  // -------------------------------------------------------------------------
  {
    id: 'tease-electric-storm',
    name: 'Electric Storm',
    description: 'Landed scatters crackle with micro-arcs around the cell; converging pressure rings and charge sparks squeeze the pending reel',
    onScatterLanded(ctx, reel, row) {
      const node = root(ctx);
      const r = ctx.cellRect(reel, row);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      // hero: the charged core — pinches IN on arrival (stored energy),
      // holds, then settles with overshoot
      const core = layeredGlow(ctx.accent, r.w * 0.5);
      core.position.set(cx, cy);
      core.alpha = 0;
      core.scale.set(1.3);
      node.addChild(core);
      const tl = ctx.track(ctx.gsap.timeline());
      // SFX: charge-up hum
      tl.to(core, { alpha: 1, duration: 0.09, ease: 'power2.out' }, 0)
        .to(core.scale, { x: 0.92, y: 0.92, duration: 0.16, ease: 'power4.in' }, 0)
        .to(core.scale, { x: 1, y: 1, duration: 0.24, ease: 'back.out(2)' }, 0.24)
        // unstable idle — the light never sits perfectly still
        .to(core, {
          alpha: 0.78,
          duration: ctx.rand(0.3, 0.45),
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        }, 0.55);

      // faint cell frame that browns-out irregularly under load
      const frame = new Graphics();
      frame.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10).stroke({ color: ctx.accent, width: 1.6, alpha: 0.3 });
      frame.blendMode = 'add';
      frame.alpha = 0;
      node.addChild(frame);
      const ftl = ctx.track(ctx.gsap.timeline({ repeat: -1, repeatDelay: ctx.rand(0.15, 0.4) }));
      ftl.to(frame, { alpha: 1, duration: 0.12, ease: 'power1.out' }, 0)
        .to(frame, { alpha: ctx.rand(0.35, 0.6), duration: ctx.rand(0.05, 0.09), ease: 'none' }, 0.2)
        .to(frame, { alpha: 1, duration: ctx.rand(0.08, 0.14), ease: 'power1.out' }, 0.3);

      // five micro-arcs biting at the cell rim — each on its own irregular
      // clock, redrawn jagged every strike so no two flashes repeat
      const rim: Rect = { x: r.x - 5, y: r.y - 5, w: r.w + 10, h: r.h + 10 };
      for (let i = 0; i < 5; i++) {
        const arc = new Graphics();
        arc.alpha = 0;
        node.addChild(arc);
        const strike = () => {
          const p = perimeterPoint(rim, ctx.rand(0, 1));
          drawBolt(arc, ctx, p.x, p.y, p.rot + ctx.rand(-0.5, 0.5), ctx.rand(14, 26));
        };
        strike();
        // SFX: crackle tick (irregular, per arc)
        const atl = ctx.track(ctx.gsap.timeline({
          repeat: -1,
          delay: 0.3 + i * ctx.rand(0.05, 0.12),
          repeatDelay: ctx.rand(0.14, 0.55),
          onRepeat: strike,
        }));
        atl.to(arc, { alpha: 0.95, duration: 0.03, ease: 'power4.out' }, 0)
          .to(arc, { alpha: 0.95, duration: 0.05, ease: 'none' }, 0.03) // flash hold
          .to(arc, { alpha: 0, duration: 0.09, ease: 'power1.in' }, 0.08);
      }
    },
    onPendingReel(ctx, reel, position) {
      const node = root(ctx);
      const r = ctx.reelRect(reel);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const climb = 0.35 * (position + 1);

      // baseline charge on the reel border — ramps up over the reel's
      // remaining spin so the pressure visibly ACCUMULATES
      const charge = rimRing(r, 12, ctx.accent, 0.12, 0.2);
      charge.position.set(cx, cy);
      charge.alpha = 0;
      node.addChild(charge);
      const ctl = ctx.track(ctx.gsap.timeline());
      // SFX: static charge rising
      ctl.to(charge, { alpha: 1, duration: climb + 0.4, ease: 'power2.in' }, 0);

      // hero: pressure rings collapsing ONTO the reel — bloom out a touch
      // (inhale), then accelerate inward, squash on impact, 0.08s hold.
      // Deeper ladder positions get a faster cycle: the squeeze tightens.
      const period = Math.max(0.8, 1.3 - position * 0.15);
      for (let i = 0; i < 2; i++) {
        const ring = rimRing(r, 14, ctx.accent, 0.3, 0.7);
        ring.position.set(cx, cy);
        ring.alpha = 0;
        node.addChild(ring);
        const rtl = ctx.track(ctx.gsap.timeline({
          repeat: -1,
          delay: 0.2 + i * period * ctx.rand(0.48, 0.55),
          repeatDelay: Math.max(0.05, period - 0.85),
        }));
        // SFX: pressure whoomp (per collapse)
        rtl.set(ring.scale, { x: 1.42, y: 1.42 }, 0)
          .to(ring, { alpha: 0.85, duration: 0.1, ease: 'power1.out' }, 0)
          .to(ring.scale, { x: 1.48, y: 1.48, duration: 0.08, ease: 'power1.out' }, 0)   // inhale
          .to(ring.scale, { x: 1, y: 1, duration: 0.42, ease: 'power3.in' }, 0.08)        // collapse
          .to(ring.scale, { x: 0.985, y: 0.985, duration: 0.05, ease: 'power2.out' }, 0.5) // squash
          .to(ring, { alpha: 0.85, duration: 0.08, ease: 'none' }, 0.5)                   // hold
          .to(ring, { alpha: 0, duration: 0.14, ease: 'power2.in' }, 0.58);
      }

      // five charge sparks drifting inward off the rim — the storm feeding
      // the reel, odd count, every path unique
      for (let i = 0; i < 5; i++) {
        const s = glowDisc(ctx.pick([ctx.accent, ctx.accent, 0xffffff]), ctx.rand(3, 5.5), 0.8);
        node.addChild(s);
        const stl = ctx.track(ctx.gsap.timeline({
          repeat: -1,
          delay: 0.35 + i * ctx.rand(0.14, 0.3),
          repeatDelay: ctx.rand(0.2, 0.6),
        }));
        const p = perimeterPoint(r, ctx.rand(0, 1));
        const inX = p.x + (cx - p.x) * ctx.rand(0.18, 0.32);
        const inY = p.y + (cy - p.y) * ctx.rand(0.18, 0.32);
        const dur = ctx.rand(0.3, 0.5);
        stl.set(s, { x: p.x, y: p.y, alpha: 0 }, 0)
          .to(s, { alpha: ctx.rand(0.5, 0.9), duration: 0.06, ease: 'power3.out' }, 0)
          .to(s, { x: inX, y: inY, duration: dur, ease: 'power2.in' }, 0) // falls inward
          .to(s, { alpha: 0, duration: 0.12, ease: 'power2.in' }, dur - 0.1);
      }
    },
  },

  // -------------------------------------------------------------------------
  // 5. Heartbeat Dark — the room holds its breath; everything beats as one.
  // -------------------------------------------------------------------------
  {
    id: 'tease-heartbeat-dark',
    name: 'Heartbeat Dark',
    description: 'The board vignette deepens with every landed scatter; scatters double-thump like a heartbeat and the pending reel border breathes on the same pulse',
    onScatterLanded(ctx, reel, row) {
      const node = root(ctx);
      const g = ctx.gridRect();
      const r = ctx.cellRect(reel, row);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      // vignette wash — each landed scatter stacks one more layer, so the
      // room genuinely gets darker with the second scatter than the first
      const vig = new Graphics();
      vig.roundRect(g.x, g.y, g.w, g.h, 14).fill({ color: 0x000000, alpha: 0.1 });
      for (let i = 0; i < 4; i++) {
        const inset = 4 + i * 9;
        vig.roundRect(g.x + inset, g.y + inset, g.w - inset * 2, g.h - inset * 2, 12)
          .stroke({ color: 0x000000, width: 18 - i * 3.5, alpha: 0.15 - i * 0.03 });
      }
      vig.alpha = 0;
      node.addChild(vig);
      const vtl = ctx.track(ctx.gsap.timeline());
      // SFX: room tone drops, sub swell
      vtl.to(vig, { alpha: 1, duration: 0.55, ease: 'power2.out' }, 0);

      // hero: the scatter's heart — warm layered glow + thin gold frame,
      // waking up as the dark closes in around it
      const heart = new Container();
      const halo = layeredGlow(ctx.gold, Math.max(r.w, r.h) * 0.66);
      const frame = new Graphics();
      frame.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 12).stroke({ color: ctx.gold, width: 2.5, alpha: 0.8 });
      frame.blendMode = 'add';
      heart.addChild(halo, frame);
      heart.position.set(cx, cy);
      heart.alpha = 0;
      node.addChild(heart);

      // flash layer that thumps in brightness with each beat
      const flash = glowDisc(0xffffff, Math.max(r.w, r.h) * 0.4, 0.5);
      flash.position.set(cx, cy);
      flash.alpha = 0;
      node.addChild(flash);

      const wake = ctx.track(ctx.gsap.timeline());
      wake.to(heart, { alpha: 0.95, duration: 0.35, ease: 'power2.out' }, 0.15);

      // SFX: heartbeat lub-dub (loop, shared clock)
      // deliberately UNjittered — every scatter and every pending reel in
      // this preset beats on the same clock; the sync is the dread
      addHeartbeat(ctx, heart, 0.05, flash);
    },
    onPendingReel(ctx, reel, position) {
      const node = root(ctx);
      const r = ctx.reelRect(reel);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      // interior gloom — the pending reel sinks a little deeper per position
      const gloom = new Graphics();
      gloom.roundRect(r.x, r.y, r.w, r.h, 10).fill({ color: 0x000000, alpha: 1 });
      gloom.alpha = 0;
      node.addChild(gloom);
      const gtl = ctx.track(ctx.gsap.timeline());
      gtl.to(gloom, { alpha: 0.12 + position * 0.04, duration: 0.45, ease: 'power2.out' }, 0);

      // hero: the reel border breathing on the SAME pulse as the scatters —
      // amplitude (not tempo) grows with ladder position
      const border = new Container();
      const haloRing = rimRing(r, 12, ctx.gold, 0.11, 0.18);
      const bodyRing = new Graphics();
      bodyRing.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 12).stroke({ color: ctx.gold, width: 2.5, alpha: 0.5 });
      bodyRing.blendMode = 'add';
      border.addChild(haloRing, bodyRing);
      border.position.set(cx, cy);
      border.alpha = 0;
      node.addChild(border);

      const flash = rimRing(r, 12, 0xffffff, 0.08, 0.25);
      flash.position.set(cx, cy);
      flash.alpha = 0;
      node.addChild(flash);

      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(border, { alpha: 1, duration: 0.35, ease: 'power2.out' }, 0.1);

      // SFX: pulse thump (soft, synced with the scatter heartbeat)
      addHeartbeat(ctx, border, 0.01 + position * 0.005, flash);
    },
  },
];
