// packAnticipation — eight near-miss / big-win tease effects for the FX
// showcase. Every effect is outcome-neutral eye-candy that builds tension on
// the grid or on one "pending" reel: spotlights, heartbeats, burning edges,
// scanners, electricity, focus dims, embers and imploding pressure waves.
//
// All geometry is derived from ctx.cellRect / ctx.reelRect / ctx.gridRect
// (grid-local px) so the pack is theme- and layout-agnostic. Colors come from
// ctx.accent / ctx.gold. Every tween is registered via ctx.track() so the
// whole pack is cancellable mid-flight; everything parented to ctx.layer is
// auto-destroyed by the showcase harness.
//
// Craft rules baked into every effect: impacts are preceded by a short
// counter-move (anticipation), arrivals accelerate in and settle with
// overshoot (weight), every glow is 3+ additive layers (wide halo / mid core /
// hot white centre), staggers and particle params carry ±15-30% jitter with
// odd counts, falloff is always eased (never linear), and nothing pops off —
// exits fade while continuing their motion.

import { Container, Graphics, Sprite, Texture, BlurFilter } from 'pixi.js';
import type { FxContext, FxEntry, FxRect } from '../fxTypes';

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

let _softTex: Texture | null = null;
/** Lazily-built radial-gradient texture — the base for every soft glow. */
function softTexture(): Texture {
  if (_softTex) return _softTex;
  const S = 128;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = S;
  const c = cvs.getContext('2d')!;
  const grad = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, S, S);
  _softTex = Texture.from(cvs);
  return _softTex;
}

/** Additive soft-glow sprite, anchored at its centre. */
function softGlow(tint: number, size: number, alpha = 1): Sprite {
  const s = new Sprite(softTexture());
  s.anchor.set(0.5);
  s.tint = tint;
  s.blendMode = 'add';
  s.width = s.height = size;
  s.alpha = alpha;
  return s;
}

/**
 * AAA point-light: wide soft halo + mid core + small hot white centre.
 * Never a single flat full-alpha disc.
 */
function layeredGlow(tint: number, size: number): Container {
  const c = new Container();
  c.addChild(
    softGlow(tint, size * 2.2, 0.14),
    softGlow(tint, size, 0.4),
    softGlow(0xffffff, size * 0.42, 0.82),
  );
  return c;
}

/** Per-effect root container so an effect can fade itself as one unit. */
function makeRoot(ctx: FxContext): Container {
  const r = new Container();
  ctx.layer.addChild(r);
  return r;
}

/** Pick a random reel index via ctx.pick (cosmetic randomness only). */
function randomReel(ctx: FxContext): number {
  return ctx.pick(Array.from({ length: ctx.grid.reels }, (_, i) => i));
}

/** Point + tangent angle at parameter t (0..1) along a rect's perimeter. */
function perimeterPoint(r: FxRect, t: number): { x: number; y: number; rot: number } {
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

// ---------------------------------------------------------------------------
// the pack
// ---------------------------------------------------------------------------

export const FX_PACK_ANTICIPATION: readonly FxEntry[] = [
  // -------------------------------------------------------------------------
  // 1. Spotlight — the room goes dark, one reel gets the stage light.
  // -------------------------------------------------------------------------
  {
    id: 'tease-spotlight-reel',
    name: 'Spotlight Reel',
    group: 'anticipation',
    description: 'Dark veil drops over the grid while one reel stands in a bright warming-up light shaft',
    run(ctx) {
      const layer = makeRoot(ctx);
      const g = ctx.gridRect();
      const r = ctx.reelRect(randomReel(ctx));

      const veil = new Graphics();
      veil.roundRect(g.x, g.y, g.w, g.h, 16).fill({ color: 0x000000, alpha: 1 });
      veil.alpha = 0;
      layer.addChild(veil);

      // subtle top-sheen so the dark veil doesn't read as a flat black slab
      const sheen = new Graphics();
      sheen.roundRect(g.x + 12, g.y + 2, g.w - 24, 10, 5).fill({ color: 0xffffff, alpha: 0.05 });
      sheen.blendMode = 'add';
      sheen.alpha = 0;
      layer.addChild(sheen);

      // Light shaft: wide soft halo under a crisp body under a hot core strip.
      // Scales down from the reel's top edge.
      const shaft = new Container();
      shaft.position.set(r.x + r.w / 2, r.y - 2);

      const halo = new Graphics();
      halo.roundRect(-r.w * 0.72, 0, r.w * 1.44, r.h * 1.04, r.w * 0.3).fill({ color: ctx.accent, alpha: 0.16 });
      halo.blendMode = 'add';
      halo.filters = [new BlurFilter({ strength: 14 })];

      const body = new Graphics();
      body.roundRect(-r.w / 2, 0, r.w, r.h * 1.02, 10).fill({ color: 0xffffff, alpha: 0.1 });
      body.blendMode = 'add';

      const core = new Graphics();
      core.roundRect(-r.w * 0.16, 0, r.w * 0.32, r.h * 1.02, r.w * 0.16).fill({ color: 0xffffff, alpha: 0.16 });
      core.blendMode = 'add';

      shaft.addChild(halo, body, core);
      shaft.scale.y = 0;
      layer.addChild(shaft);

      // lamp glint at the fixture — layered, lives outside the shaft so the
      // shaft's y-scale never stretches it
      const lamp = layeredGlow(ctx.gold, r.w * 0.72);
      lamp.position.set(r.x + r.w / 2, r.y + 6);
      lamp.alpha = 0;
      layer.addChild(lamp);

      // light pool splashing across the reel floor on shaft impact
      const pool = new Container();
      const poolWide = new Graphics();
      poolWide.ellipse(0, 0, r.w * 0.62, 15).fill({ color: ctx.gold, alpha: 0.4 });
      poolWide.blendMode = 'add';
      poolWide.filters = [new BlurFilter({ strength: 10 })];
      const poolHot = new Graphics();
      poolHot.ellipse(0, 0, r.w * 0.3, 6).fill({ color: 0xffffff, alpha: 0.14 });
      poolHot.blendMode = 'add';
      pool.addChild(poolWide, poolHot);
      pool.position.set(r.x + r.w / 2, r.y + r.h - 6);
      pool.alpha = 0;
      pool.scale.set(0.6, 0.6);
      layer.addChild(pool);

      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(veil, { alpha: 0.62, duration: 0.28, ease: 'power2.out' }, 0)
        .to(sheen, { alpha: 1, duration: 0.28, ease: 'power2.out' }, 0)
        // anticipation: the lamp blinks awake and dips before the shaft drops
        .to(lamp, { alpha: 0.9, duration: 0.09, ease: 'power2.out' }, 0.08)
        .to(lamp, { alpha: 0.35, duration: 0.07, ease: 'power2.in' }, 0.17)
        // the shaft accelerates down (weight), overshoots, recoils to rest
        .to(shaft.scale, { y: 1.06, duration: 0.24, ease: 'power3.in' }, 0.24)
        .to(shaft.scale, { y: 1, duration: 0.22, ease: 'back.out(2)' }, 0.48)
        .to(lamp, { alpha: 1, duration: 0.08, ease: 'power2.out' }, 0.48)
        // floor pool blooms on impact
        .to(pool, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0.46)
        .to(pool.scale, { x: 1, y: 1, duration: 0.32, ease: 'back.out(1.8)' }, 0.46);

      // stage light "warming up" — non-rhythmic flicker, jittered timings
      let ft = 0.62;
      for (let i = 0; i < 3; i++) {
        const d = ctx.rand(0.04, 0.08);
        tl.to(shaft, { alpha: ctx.rand(0.55, 0.75), duration: d, ease: 'power1.in' }, ft)
          .to(shaft, { alpha: 1, duration: d * 1.5, ease: 'power1.out' }, ft + d);
        ft += d * 2.5 + ctx.rand(0.06, 0.18);
      }

      // lamp breathes while the light holds
      tl.to(lamp, { alpha: 0.6, duration: ctx.rand(0.38, 0.5), ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.62);

      // whisper-quiet dust motes drifting up inside the beam
      for (let i = 0; i < 5; i++) {
        const m = softGlow(0xffffff, ctx.rand(3, 6), 0);
        m.position.set(r.x + r.w * ctx.rand(0.22, 0.78), r.y + r.h * ctx.rand(0.45, 0.92));
        layer.addChild(m);
        const rise = ctx.rand(1.0, 1.6);
        const mtl = ctx.track(ctx.gsap.timeline({ delay: 0.6 + ctx.rand(0, 0.4) }));
        mtl.to(m, { alpha: ctx.rand(0.06, 0.12), duration: 0.35, ease: 'power1.out' }, 0)
          .to(m, { y: m.y - ctx.rand(28, 58), duration: rise, ease: 'sine.out' }, 0)
          .to(m, { alpha: 0, duration: 0.4, ease: 'power2.in' }, rise - 0.4);
      }

      // release — the shaft keeps a hint of upward stretch as it goes
      tl.to(shaft.scale, { y: 1.04, duration: 0.55, ease: 'power1.in' }, 1.55)
        .to(layer, { alpha: 0, duration: 0.55, ease: 'power2.in' }, 1.55);
    },
  },

  // -------------------------------------------------------------------------
  // 2. Heartbeat — the whole board thumps lub-dub, harder every beat.
  // -------------------------------------------------------------------------
  {
    id: 'tease-heartbeat',
    name: 'Heartbeat',
    group: 'anticipation',
    description: 'The whole grid double-pulses like a heartbeat, each lub-dub hitting harder than the last',
    run(ctx) {
      const layer = makeRoot(ctx);
      const g = ctx.gridRect();
      const cx = g.x + g.w / 2;
      const cy = g.y + g.h / 2;

      const flash = new Graphics();
      flash.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, 18).fill({ color: ctx.accent, alpha: 1 });
      flash.blendMode = 'add';
      flash.position.set(cx, cy);
      flash.alpha = 0;

      // frame: wide blurred halo stroke under the crisp accent + gold strokes
      const frame = new Container();
      const frameHalo = new Graphics();
      frameHalo.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, 18).stroke({ color: ctx.accent, width: 12, alpha: 0.14 });
      frameHalo.blendMode = 'add';
      frameHalo.filters = [new BlurFilter({ strength: 8 })];
      const frameBody = new Graphics();
      frameBody.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, 18).stroke({ color: ctx.accent, width: 5, alpha: 0.85 });
      frameBody.roundRect(-g.w / 2 - 7, -g.h / 2 - 7, g.w + 14, g.h + 14, 22).stroke({ color: ctx.gold, width: 2, alpha: 0.5 });
      frameBody.blendMode = 'add';
      frame.addChild(frameHalo, frameBody);
      frame.position.set(cx, cy);
      frame.alpha = 0;

      layer.addChild(flash, frame);

      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(frame, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0);

      const thump = (at: number, k: number) => {
        // anticipation: quick inhale-contract before the expand
        tl.to(frame.scale, { x: 1 - 0.014 * k, y: 1 - 0.014 * k, duration: 0.07, ease: 'power2.out' }, at)
          // the hit: hard out, then an eased return that undershoots and settles
          .to(frame.scale, { x: 1 + 0.05 * k, y: 1 + 0.05 * k, duration: 0.09, ease: 'power4.out' }, at + 0.07)
          .to(frame.scale, { x: 0.997, y: 0.997, duration: 0.14, ease: 'power2.in' }, at + 0.16)
          .to(frame.scale, { x: 1, y: 1, duration: 0.1, ease: 'sine.out' }, at + 0.3)
          .to(flash, { alpha: 0.2 * k, duration: 0.06, ease: 'power3.out' }, at + 0.07)
          .to(flash, { alpha: 0, duration: 0.22, ease: 'power2.out' }, at + 0.13);
        // expanding echo ring per thump — gold body + thin white inner edge
        const echo = new Container();
        const eGold = new Graphics();
        eGold.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, 18).stroke({ color: ctx.gold, width: 4, alpha: 0.55 });
        eGold.blendMode = 'add';
        const eHot = new Graphics();
        eHot.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, 18).stroke({ color: 0xffffff, width: 1.4, alpha: 0.8 });
        eHot.blendMode = 'add';
        echo.addChild(eGold, eHot);
        echo.position.set(cx, cy);
        echo.alpha = 0;
        layer.addChild(echo);
        const spread = ctx.rand(0.85, 1.15);
        tl.set(echo, { alpha: 0.7 * k }, at + 0.07)
          .to(echo.scale, { x: 1 + 0.12 * k * spread, y: 1 + 0.15 * k * spread, duration: 0.5, ease: 'power2.out' }, at + 0.07)
          .to(echo, { alpha: 0, duration: 0.46, ease: 'power2.out' }, at + 0.1);
      };

      // three escalating lub-dub pairs, beat times slightly humanised
      const beats: Array<{ t: number; k: number }> = [
        { t: 0.05, k: 0.45 },
        { t: 0.55 + ctx.rand(-0.04, 0.04), k: 0.72 },
        { t: 1.0 + ctx.rand(-0.03, 0.05), k: 1 },
      ];
      for (const b of beats) {
        thump(b.t, b.k);
        thump(b.t + 0.21 + ctx.rand(-0.02, 0.02), b.k * 0.6);
      }

      // exit: fade while drifting a hair larger — motion continues out
      tl.to(frame.scale, { x: 1.02, y: 1.02, duration: 0.45, ease: 'power1.in' }, 1.5)
        .to(frame, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 1.5);
    },
  },

  // -------------------------------------------------------------------------
  // 3. Edge burn — one reel's edges heat up from ember-gold to white-hot.
  // -------------------------------------------------------------------------
  {
    id: 'tease-edge-burn',
    name: 'Edge Burn',
    group: 'anticipation',
    description: 'The left and right edges of one reel smoulder and glow hotter and hotter until they flash white',
    run(ctx) {
      const layer = makeRoot(ctx);
      const r = ctx.reelRect(randomReel(ctx));
      const edgeW = Math.max(6, r.w * 0.1);

      const makeEdge = (x: number) => {
        const c = new Container();
        // three heat layers: wide dim halo, gold glow body, white-hot core
        const wide = new Graphics();
        wide.roundRect(-edgeW * 1.9, 0, edgeW * 3.8, r.h, edgeW * 1.4).fill({ color: ctx.accent, alpha: 0.14 });
        wide.blendMode = 'add';
        wide.filters = [new BlurFilter({ strength: 16 })];
        wide.alpha = 0;
        const glow = new Graphics();
        glow.roundRect(-edgeW, 0, edgeW * 2, r.h, edgeW).fill({ color: ctx.gold, alpha: 0.42 });
        glow.blendMode = 'add';
        glow.filters = [new BlurFilter({ strength: 10 })];
        glow.alpha = 0;
        const hot = new Graphics();
        hot.roundRect(-edgeW * 0.4, 0, edgeW * 0.8, r.h, edgeW * 0.4).fill({ color: 0xffffff, alpha: 0.85 });
        hot.blendMode = 'add';
        hot.alpha = 0;
        c.addChild(wide, glow, hot);
        c.position.set(x, r.y);
        layer.addChild(c);
        return { wide, glow, hot };
      };
      const left = makeEdge(r.x + edgeW * 0.2);
      const right = makeEdge(r.x + r.w - edgeW * 0.2);

      const tl = ctx.track(ctx.gsap.timeline());
      [left, right].forEach((e, idx) => {
        // the two edges ignite slightly out of phase, never in lockstep
        const phase = idx * ctx.rand(0.06, 0.13);
        tl.to(e.wide, { alpha: 1, duration: 1.2, ease: 'power2.in' }, phase)
          .to(e.glow, { alpha: 1, duration: 1.1, ease: 'power2.in' }, phase + 0.05)
          .to(e.hot, { alpha: 1, duration: 0.85, ease: 'power3.in' }, phase + 0.35)
          // nervous width-flicker on the hot core — per-edge cadence
          .to(e.hot.scale, {
            x: ctx.rand(1.12, 1.22),
            duration: ctx.rand(0.045, 0.065),
            yoyo: true,
            repeat: idx === 0 ? 9 : 13,
            ease: 'sine.inOut',
          }, phase + 0.5);
      });

      // stray embers popping off the burning edges — spawn density ramps up
      // toward the climax, each ember shrinks as it dies (progressive falloff)
      for (let i = 0; i < 11; i++) {
        const s = softGlow(ctx.pick([ctx.gold, ctx.gold, 0xffffff, ctx.accent]), ctx.rand(5, 11), 0);
        const ex = ctx.pick([r.x + edgeW * 0.3, r.x + r.w - edgeW * 0.3]);
        s.position.set(ex + ctx.rand(-4, 4), r.y + r.h * ctx.rand(0.55, 1));
        layer.addChild(s);
        const base = s.scale.x;
        const dur = ctx.rand(0.4, 0.7);
        const at = 0.5 + Math.pow(i / 11, 1.5) * 0.75 + ctx.rand(0, 0.06);
        tl.to(s, { alpha: ctx.rand(0.5, 1), duration: 0.12, ease: 'power1.out' }, at)
          .to(s, { y: s.y - ctx.rand(40, 110), duration: dur, ease: 'power1.in' }, at)
          .to(s, { x: s.x + ctx.rand(-14, 14), duration: dur, ease: 'sine.inOut' }, at)
          .to(s.scale, { x: base * ctx.rand(0.35, 0.55), y: base * ctx.rand(0.35, 0.55), duration: dur, ease: 'power1.in' }, at)
          .to(s, { alpha: 0, duration: 0.22, ease: 'power2.in' }, at + dur - 0.18);
      }

      // anticipation dip, then the white-hot climax flash
      const sheet = new Graphics();
      sheet.roundRect(r.x, r.y, r.w, r.h, 10).fill({ color: 0xffffff, alpha: 0.2 });
      sheet.blendMode = 'add';
      sheet.alpha = 0;
      layer.addChild(sheet);

      tl.to([left.glow, right.glow], { alpha: 0.3, duration: 0.09, ease: 'power2.in' }, 1.26)
        .to([left.glow, right.glow], { alpha: 1, duration: 0.09, ease: 'power3.out' }, 1.36)
        .to([left.hot, right.hot], { alpha: 1, duration: 0.06, ease: 'power4.out' }, 1.36)
        .to(sheet, { alpha: 1, duration: 0.06, ease: 'power4.out' }, 1.36)
        .to(sheet, { alpha: 0, duration: 0.3, ease: 'power2.out' }, 1.44)
        // burn out — heat sinks downward slightly as it dies
        .to(layer, { alpha: 0, duration: 0.55, ease: 'power2.in' }, 1.7);
    },
  },

  // -------------------------------------------------------------------------
  // 4. Scanline — a scanner beam sweeps the pending reel down, then back up.
  // -------------------------------------------------------------------------
  {
    id: 'tease-scanline',
    name: 'Scanline',
    group: 'anticipation',
    description: 'A bright horizontal scanner line sweeps down the pending reel, then races back up fatter and brighter',
    run(ctx) {
      const layer = makeRoot(ctx);
      const r = ctx.reelRect(randomReel(ctx));

      // faint read-out tint on the reel being scanned
      const tint = new Graphics();
      tint.roundRect(r.x, r.y, r.w, r.h, 10).fill({ color: ctx.accent, alpha: 0.09 });
      tint.blendMode = 'add';
      tint.alpha = 0;
      layer.addChild(tint);

      // the scan head: two-step afterglow tail (older = dimmer), soft band,
      // crisp core, layered edge glints
      const line = new Container();
      const tailFar = new Graphics();
      tailFar.roundRect(-r.w / 2, -78, r.w, 34, 8).fill({ color: ctx.accent, alpha: 0.06 });
      tailFar.blendMode = 'add';
      const tail = new Graphics();
      tail.roundRect(-r.w / 2, -46, r.w, 44, 8).fill({ color: ctx.accent, alpha: 0.13 });
      tail.blendMode = 'add';
      const band = new Graphics();
      band.roundRect(-r.w / 2, -14, r.w, 28, 14).fill({ color: ctx.accent, alpha: 0.35 });
      band.blendMode = 'add';
      band.filters = [new BlurFilter({ strength: 8 })];
      const core = new Graphics();
      core.roundRect(-r.w / 2, -1.6, r.w, 3.2, 1.6).fill({ color: 0xffffff, alpha: 0.9 });
      core.blendMode = 'add';
      const glintL = layeredGlow(ctx.accent, 18);
      glintL.position.set(-r.w / 2, 0);
      const glintR = layeredGlow(ctx.accent, 18);
      glintR.position.set(r.w / 2, 0);
      line.addChild(tailFar, tail, band, core, glintL, glintR);
      line.position.set(r.x + r.w / 2, r.y + 10);
      line.alpha = 0;
      line.scale.y = 0.35;
      layer.addChild(line);

      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(tint, { alpha: 1, duration: 0.15, ease: 'power1.out' }, 0)
        // charge-up bloom at the top: overshoot thickness, settle
        .to(line, { alpha: 1, duration: 0.1, ease: 'power1.out' }, 0)
        .to(line.scale, { y: 1.25, duration: 0.13, ease: 'power2.out' }, 0.02)
        .to(line.scale, { y: 1, duration: 0.13, ease: 'power2.inOut' }, 0.15)
        // anticipation: a tiny upward pull before the downward sweep
        .to(line, { y: r.y + 4, duration: 0.09, ease: 'power2.out' }, 0.08)
        // pass 1: sweep down, ACCELERATING into the bottom edge (weight)
        .to(line, { y: r.y + r.h - 4, duration: 0.5, ease: 'power2.in' }, 0.17)
        // impact: squash, glint flare, back.out rebound, brief hold
        .to(line.scale, { y: 0.55, duration: 0.05, ease: 'power2.out' }, 0.67)
        .to(line.scale, { y: 1.6, duration: 0.2, ease: 'back.out(2)' }, 0.72)
        .to([glintL.scale, glintR.scale], { x: 1.8, y: 1.8, duration: 0.14, ease: 'power2.out' }, 0.67)
        .to([glintL.scale, glintR.scale], { x: 1, y: 1, duration: 0.2, ease: 'power2.inOut' }, 0.81)
        // pass 2: return sweep — faster, fatter, brighter
        .to(line, { y: r.y + 6, duration: 0.4, ease: 'power3.inOut' }, 0.96)
        .to(line.scale, { y: 1.75, duration: 0.4, ease: 'sine.inOut' }, 0.96)
        // lock-on flash at the top, then release with upward continuation
        .to(tint, { alpha: 1.0, duration: 0.08, ease: 'power4.out' }, 1.37)
        .to(line, { y: r.y - 2, duration: 0.45, ease: 'power1.out' }, 1.45)
        .to(layer, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 1.45);

      // read-out blinking while scanning — irregular, never metronomic
      let bt = 0.24;
      while (bt < 0.9) {
        const d = ctx.rand(0.06, 0.11);
        tl.to(tint, { alpha: ctx.rand(0.35, 0.55), duration: d, ease: 'sine.in' }, bt)
          .to(tint, { alpha: 1, duration: d * 1.3, ease: 'sine.out' }, bt + d);
        bt += d * 2.3 + ctx.rand(0.03, 0.12);
      }
    },
  },

  // -------------------------------------------------------------------------
  // 5. Electric border — crackling dashes race around one reel's outline.
  // -------------------------------------------------------------------------
  {
    id: 'tease-electric-border',
    name: 'Electric Border',
    group: 'anticipation',
    description: 'Crackling electric dashes race and jitter around one reel border while sparks pop off it',
    run(ctx) {
      const layer = makeRoot(ctx);
      const r = ctx.reelRect(randomReel(ctx));

      // faint flickering outline the dashes ride on — irregular brown-out
      // dips, not a metronome
      const border = new Graphics();
      border.roundRect(r.x, r.y, r.w, r.h, 10).stroke({ color: ctx.accent, width: 2, alpha: 0.35 });
      border.blendMode = 'add';
      border.alpha = 0;
      layer.addChild(border);
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(border, { alpha: 1, duration: 0.18, ease: 'power2.out' }, 0);
      let ft = 0.25;
      while (ft < 1.3) {
        const d = ctx.rand(0.035, 0.08);
        btl.to(border, { alpha: ctx.rand(0.3, 0.6), duration: d, ease: 'none' }, ft)
          .to(border, { alpha: 1, duration: d * 1.4, ease: 'power1.out' }, ft + d);
        ft += d * 2.4 + ctx.rand(0.02, 0.13);
      }
      btl.to(border, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 1.45);

      // racing dashes — alternating directions, jittering off the rail.
      // Each dash: wide dim aura + tight aura + hot white bar (3 layers).
      const dashCount = 7;
      for (let i = 0; i < dashCount; i++) {
        const dash = new Container();
        const auraWide = softGlow(ctx.accent, 54, 0.14);
        const aura = softGlow(ctx.accent, 28, 0.45);
        const bar = new Graphics();
        bar.roundRect(-12, -2, 24, 4, 2).fill({ color: 0xffffff, alpha: 0.95 });
        bar.blendMode = 'add';
        dash.addChild(auraWide, aura, bar);
        dash.alpha = 0;
        layer.addChild(dash);

        const state = { t: i / dashCount + ctx.rand(-0.05, 0.05) };
        const dir = i % 2 === 0 ? 1 : -1;
        const laps = ctx.rand(0.8, 1.45) * dir;
        const place = () => {
          const p = perimeterPoint(r, state.t);
          const j = ctx.rand(-2.4, 2.4); // perpendicular crackle jitter
          dash.position.set(
            p.x + Math.cos(p.rot + Math.PI / 2) * j,
            p.y + Math.sin(p.rot + Math.PI / 2) * j,
          );
          dash.rotation = p.rot + ctx.rand(-0.12, 0.12);
        };
        place();

        const at = 0.05 + i * 0.045 + ctx.rand(0, 0.03);
        const dtl = ctx.track(ctx.gsap.timeline());
        dtl.to(dash, { alpha: 1, duration: ctx.rand(0.09, 0.15), ease: 'power1.out' }, at)
          .to(state, { t: state.t + laps, duration: ctx.rand(1.05, 1.25), ease: 'power1.inOut', onUpdate: place }, at)
          // exit: keep racing while the light dies
          .to(dash, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 1.28 + ctx.rand(0, 0.1));
      }

      // arc-flash sparks popping at random rail points — layered pinpoints
      // that bloom from a pinprick and fade while still expanding
      for (let i = 0; i < 9; i++) {
        const p = perimeterPoint(r, ctx.rand(0, 1));
        const s = new Container();
        s.addChild(
          softGlow(ctx.accent, ctx.rand(18, 28), 0.4),
          softGlow(0xffffff, ctx.rand(8, 13), 0.85),
        );
        s.position.set(p.x, p.y);
        s.alpha = 0;
        s.scale.set(0.4);
        layer.addChild(s);
        const at = ctx.rand(0.15, 1.15);
        const stl = ctx.track(ctx.gsap.timeline());
        stl.to(s, { alpha: 1, duration: 0.05, ease: 'power4.out' }, at)
          .to(s.scale, { x: ctx.rand(1.6, 2.1), y: ctx.rand(1.6, 2.1), duration: 0.2, ease: 'power2.out' }, at)
          .to(s, { alpha: 0, duration: 0.18, ease: 'power2.in' }, at + 0.06);
      }
    },
  },

  // -------------------------------------------------------------------------
  // 6. Dim focus — everything dims, two random cells stay lit and breathe.
  // -------------------------------------------------------------------------
  {
    id: 'tease-dim-focus',
    name: 'Dim Focus',
    group: 'anticipation',
    description: 'The board falls dark while two random cells stay lit in gold frames, breathing softly',
    run(ctx) {
      const layer = makeRoot(ctx);
      const g = ctx.gridRect();

      const veil = new Graphics();
      veil.roundRect(g.x, g.y, g.w, g.h, 14).fill({ color: 0x000000, alpha: 1 });
      veil.alpha = 0;
      layer.addChild(veil);

      // subtle top-sheen keeps the dark wash from reading dead flat
      const sheen = new Graphics();
      sheen.roundRect(g.x + 12, g.y + 2, g.w - 24, 9, 4).fill({ color: 0xffffff, alpha: 0.04 });
      sheen.blendMode = 'add';
      sheen.alpha = 0;
      layer.addChild(sheen);

      // two distinct random cells
      const all: Array<{ reel: number; row: number }> = [];
      for (let re = 0; re < ctx.grid.reels; re++) {
        for (let ro = 0; ro < ctx.grid.rows; ro++) all.push({ reel: re, row: ro });
      }
      const a = ctx.pick(all);
      let b = ctx.pick(all);
      for (let i = 0; i < 8 && b.reel === a.reel && b.row === a.row; i++) b = ctx.pick(all);

      const tl = ctx.track(ctx.gsap.timeline());
      // the dark overshoots slightly, then relaxes — the room "settles"
      tl.to(veil, { alpha: 0.72, duration: 0.3, ease: 'power2.out' }, 0)
        .to(veil, { alpha: 0.64, duration: 0.28, ease: 'sine.out' }, 0.32)
        .to(sheen, { alpha: 1, duration: 0.3, ease: 'power2.out' }, 0);

      [a, b].forEach((cell, idx) => {
        const c = ctx.cellRect(cell.reel, cell.row);
        const ccx = c.x + c.w / 2;
        const ccy = c.y + c.h / 2;

        // anticipation: a pinprick glint blinks at the cell centre first
        const pin = softGlow(0xffffff, 9, 0);
        pin.position.set(ccx, ccy);
        layer.addChild(pin);

        const node = new Container();
        node.position.set(ccx, ccy);
        const halo = softGlow(ctx.accent, Math.max(c.w, c.h) * 2.1, 0.16);
        const mid = softGlow(ctx.accent, Math.max(c.w, c.h) * 1.1, 0.38);
        const frame = new Graphics();
        frame.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12).stroke({ color: ctx.gold, width: 3, alpha: 0.95 });
        frame.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12).fill({ color: 0xffffff, alpha: 0.07 });
        frame.blendMode = 'add';
        const hot = softGlow(0xffffff, Math.max(c.w, c.h) * 0.3, 0.7);
        node.addChild(halo, mid, frame, hot);
        node.alpha = 0;
        node.scale.set(0.7);
        layer.addChild(node);

        // the two lights wake slightly offset, then breathe out of phase
        const at = 0.18 + idx * 0.16 + ctx.rand(-0.02, 0.02);
        const breath = ctx.rand(0.36, 0.5);
        tl.to(pin, { alpha: 0.9, duration: 0.08, ease: 'power3.out' }, at - 0.1)
          .to(pin, { alpha: 0, duration: 0.14, ease: 'power2.in' }, at)
          .to(node, { alpha: 1, duration: 0.28, ease: 'power2.out' }, at)
          .to(node.scale, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2.2)' }, at)
          .to(node.scale, { x: 1.06, y: 1.06, duration: breath, ease: 'sine.inOut', yoyo: true, repeat: 2 }, at + 0.55)
          .to([halo, mid], { alpha: 0.55, duration: breath, ease: 'sine.inOut', yoyo: true, repeat: 2 }, at + 0.55)
          // exit: each node contracts a touch as the scene fades
          .to(node.scale, { x: 0.93, y: 0.93, duration: 0.5, ease: 'power2.in' }, 1.9);
      });

      tl.to(layer, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 1.9);
    },
  },

  // -------------------------------------------------------------------------
  // 7. Rising embers — sparks lift off the grid floor, faster and faster.
  // -------------------------------------------------------------------------
  {
    id: 'tease-rising-embers',
    name: 'Rising Embers',
    group: 'anticipation',
    description: 'Golden ember particles rise from the bottom of the grid, spawning and climbing ever faster',
    run(ctx) {
      const layer = makeRoot(ctx);
      const g = ctx.gridRect();

      // coal-bed along the grid floor: wide warm blur + faint white heart
      const bed = new Container();
      const bedWide = new Graphics();
      bedWide.roundRect(g.x, g.y + g.h - 26, g.w, 26, 13).fill({ color: ctx.gold, alpha: 0.45 });
      bedWide.blendMode = 'add';
      bedWide.filters = [new BlurFilter({ strength: 12 })];
      const bedHot = new Graphics();
      bedHot.roundRect(g.x + g.w * 0.12, g.y + g.h - 12, g.w * 0.76, 7, 3.5).fill({ color: 0xffffff, alpha: 0.12 });
      bedHot.blendMode = 'add';
      bedHot.filters = [new BlurFilter({ strength: 4 })];
      bed.addChild(bedWide, bedHot);
      bed.alpha = 0;
      layer.addChild(bed);

      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(bed, { alpha: 1, duration: 0.9, ease: 'power2.in' }, 0);
      // coals pulse irregularly, never on a beat
      let pt = 0.9;
      for (let i = 0; i < 3; i++) {
        const d = ctx.rand(0.1, 0.18);
        btl.to(bed, { alpha: ctx.rand(0.7, 0.85), duration: d, ease: 'sine.in' }, pt)
          .to(bed, { alpha: 1, duration: d * 1.4, ease: 'sine.out' }, pt + d);
        pt += d * 2.4 + ctx.rand(0.04, 0.14);
      }
      btl.to(bed, { alpha: 0, duration: 0.6, ease: 'power2.in' }, 1.7);

      // embers — spawn times cluster toward the end (accelerating swarm);
      // each ember shrinks as it climbs and dies with an eased fade
      const count = 27;
      for (let i = 0; i < count; i++) {
        const frac = i / count;
        const delay = 1.35 * Math.pow(frac, 1.7) + ctx.rand(0, 0.05);
        const s = softGlow(ctx.pick([ctx.gold, ctx.gold, ctx.accent, 0xffffff]), ctx.rand(6, 15), 0);
        const x0 = g.x + ctx.rand(0.05, 0.95) * g.w;
        s.position.set(x0, g.y + g.h + ctx.rand(0, 14));
        layer.addChild(s);
        const base = s.scale.x;

        const rise = ctx.rand(0.7, 1.1);
        const shrink = ctx.rand(0.3, 0.5);
        const etl = ctx.track(ctx.gsap.timeline({ delay }));
        etl.to(s, { alpha: ctx.rand(0.55, 1), duration: 0.18, ease: 'power1.out' }, 0)
          // power2.in = the ember accelerates as it climbs
          .to(s, { y: g.y + ctx.rand(-10, g.h * 0.25), duration: rise, ease: 'power2.in' }, 0)
          // lazy sideways sway on the way up — amplitude and phase all differ
          .to(s, { x: x0 + ctx.rand(-30, 30), duration: rise * ctx.rand(0.4, 0.6), ease: 'sine.inOut', yoyo: true, repeat: 1 }, ctx.rand(0, 0.1))
          .to(s.scale, { x: base * shrink, y: base * shrink, duration: rise, ease: 'power1.in' }, 0)
          .to(s, { alpha: 0, duration: 0.22, ease: 'power2.in' }, Math.max(0.2, rise - 0.18));
      }
    },
  },

  // -------------------------------------------------------------------------
  // 8. Pressure waves — rings collapse INTO one reel and implode.
  // -------------------------------------------------------------------------
  {
    id: 'tease-pressure-waves',
    name: 'Pressure Waves',
    group: 'anticipation',
    description: 'Concentric rings collapse inward onto a random reel and implode in a white flash',
    run(ctx) {
      const layer = makeRoot(ctx);
      const r = ctx.reelRect(randomReel(ctx));
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      const tl = ctx.track(ctx.gsap.timeline());

      // converging rings — each blooms OUT a touch first (anticipation), then
      // accelerates inward with power3.in (the collapse carries weight)
      const rings = 5;
      for (let i = 0; i < rings; i++) {
        const ring = new Container();
        ring.position.set(cx, cy);
        const outer = new Graphics();
        outer.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 14).stroke({ color: ctx.accent, width: 7, alpha: 0.4 });
        outer.blendMode = 'add';
        outer.filters = [new BlurFilter({ strength: 4 })];
        const inner = new Graphics();
        inner.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 14).stroke({ color: 0xffffff, width: 2.2, alpha: 0.85 });
        inner.blendMode = 'add';
        ring.addChild(outer, inner);
        const start = 2.7 * ctx.rand(0.92, 1.08);
        ring.scale.set(start);
        ring.alpha = 0;
        layer.addChild(ring);

        const at = 0.04 + i * 0.14 + ctx.rand(-0.02, 0.02);
        tl.to(ring, { alpha: 0.9, duration: 0.14, ease: 'power1.out' }, at)
          .to(ring.scale, { x: start * 1.05, y: start * 1.05, duration: 0.1, ease: 'power1.out' }, at)
          .to(ring.scale, { x: 0.55, y: 0.55, duration: 0.48, ease: 'power3.in' }, at + 0.1)
          .to(ring, { alpha: 0, duration: 0.12, ease: 'power2.in' }, at + 0.48);
      }

      // pre-implosion "suck": a small glow collapses to a point — the inhale
      const suck = softGlow(0xffffff, r.w * 0.5, 0);
      suck.position.set(cx, cy);
      layer.addChild(suck);
      const ss = suck.scale.x;
      tl.set(suck.scale, { x: ss, y: ss }, 1.0)
        .to(suck, { alpha: 0.7, duration: 0.1, ease: 'power2.out' }, 1.0)
        .to(suck.scale, { x: ss * 0.12, y: ss * 0.12, duration: 0.14, ease: 'power3.in' }, 1.0)
        .to(suck, { alpha: 0, duration: 0.06, ease: 'power1.in' }, 1.1);

      // implosion flash — layered burst blooming from the collapsed point
      const boom = new Container();
      boom.addChild(
        softGlow(ctx.accent, r.w * 2.2, 0.16),
        softGlow(ctx.gold, r.w * 1.15, 0.4),
        softGlow(0xffffff, r.w * 0.5, 0.9),
      );
      boom.position.set(cx, cy);
      boom.alpha = 0;
      boom.scale.set(0.22);
      layer.addChild(boom);

      const fill = new Graphics();
      fill.roundRect(r.x, r.y, r.w, r.h, 12).fill({ color: ctx.accent, alpha: 0.35 });
      fill.blendMode = 'add';
      fill.alpha = 0;
      layer.addChild(fill);

      // rebound shockwave ring pushed back OUT by the implosion
      const shock = new Graphics();
      shock.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 14).stroke({ color: ctx.gold, width: 3, alpha: 0.7 });
      shock.blendMode = 'add';
      shock.position.set(cx, cy);
      shock.alpha = 0;
      shock.scale.set(0.55);
      layer.addChild(shock);

      tl.to(boom, { alpha: 1, duration: 0.07, ease: 'power4.out' }, 1.14)
        .to(boom.scale, { x: 1.18, y: 1.18, duration: 0.3, ease: 'back.out(1.8)' }, 1.14)
        .to(boom, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 1.26)
        .to(fill, { alpha: 1, duration: 0.06, ease: 'power4.out' }, 1.14)
        .to(fill, { alpha: 0, duration: 0.5, ease: 'power2.out' }, 1.23)
        .set(shock, { alpha: 0.8 }, 1.18)
        .to(shock.scale, { x: 1.5, y: 1.5, duration: 0.45, ease: 'power2.out' }, 1.18)
        .to(shock, { alpha: 0, duration: 0.4, ease: 'power2.out' }, 1.24);

      // debris sparks flung outward, decelerating and shrinking as they die
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + ctx.rand(-0.35, 0.35);
        const dist = ctx.rand(38, 88);
        const s = softGlow(ctx.pick([ctx.gold, ctx.accent, 0xffffff]), ctx.rand(6, 12), 0);
        s.position.set(cx, cy);
        layer.addChild(s);
        const base = s.scale.x;
        const fly = ctx.rand(0.35, 0.55);
        tl.set(s, { alpha: ctx.rand(0.55, 0.9) }, 1.16)
          .to(s, { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, duration: fly, ease: 'power2.out' }, 1.16)
          .to(s.scale, { x: base * 0.35, y: base * 0.35, duration: fly, ease: 'power2.in' }, 1.16)
          .to(s, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 1.16 + fly - 0.22);
      }
    },
  },
];
