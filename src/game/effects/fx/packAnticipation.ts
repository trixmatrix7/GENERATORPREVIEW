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

      // Light shaft: wide soft halo under a crisp body under a hot core strip,
      // with a lamp glint at the top. Scales down from the reel's top edge.
      const shaft = new Container();
      shaft.position.set(r.x + r.w / 2, r.y - 2);

      const halo = new Graphics();
      halo.roundRect(-r.w * 0.72, 0, r.w * 1.44, r.h * 1.04, r.w * 0.3).fill({ color: ctx.accent, alpha: 0.2 });
      halo.blendMode = 'add';
      halo.filters = [new BlurFilter({ strength: 14 })];

      const body = new Graphics();
      body.roundRect(-r.w / 2, 0, r.w, r.h * 1.02, 10).fill({ color: 0xffffff, alpha: 0.1 });
      body.blendMode = 'add';

      const core = new Graphics();
      core.roundRect(-r.w * 0.16, 0, r.w * 0.32, r.h * 1.02, r.w * 0.16).fill({ color: 0xffffff, alpha: 0.16 });
      core.blendMode = 'add';

      const lamp = softGlow(ctx.gold, r.w * 1.15, 0.9);
      lamp.position.set(0, 8);

      shaft.addChild(halo, body, core, lamp);
      shaft.scale.y = 0;
      layer.addChild(shaft);

      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(veil, { alpha: 0.62, duration: 0.28, ease: 'power2.out' }, 0)
        // shaft slams down from the top edge
        .to(shaft.scale, { y: 1, duration: 0.34, ease: 'power4.out' }, 0.08)
        // stage light "warming up" flicker
        .to(shaft, { alpha: 0.55, duration: 0.06, ease: 'power1.in' }, 0.46)
        .to(shaft, { alpha: 1, duration: 0.08, ease: 'power1.out' }, 0.52)
        .to(shaft, { alpha: 0.75, duration: 0.05, ease: 'none' }, 0.68)
        .to(shaft, { alpha: 1, duration: 0.07, ease: 'power1.out' }, 0.73)
        // lamp breathes while the light holds
        .to(lamp, { alpha: 0.5, duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.55)
        // release
        .to(layer, { alpha: 0, duration: 0.6, ease: 'power2.in' }, 1.6);
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

      const frame = new Graphics();
      frame.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, 18).stroke({ color: ctx.accent, width: 5, alpha: 0.85 });
      frame.roundRect(-g.w / 2 - 7, -g.h / 2 - 7, g.w + 14, g.h + 14, 22).stroke({ color: ctx.gold, width: 2, alpha: 0.5 });
      frame.blendMode = 'add';
      frame.position.set(cx, cy);
      frame.alpha = 0;

      layer.addChild(flash, frame);

      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(frame, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0);

      const thump = (at: number, k: number) => {
        tl.to(frame.scale, { x: 1 + 0.05 * k, y: 1 + 0.05 * k, duration: 0.08, ease: 'power3.out' }, at)
          .to(frame.scale, { x: 1, y: 1, duration: 0.16, ease: 'power2.in' }, at + 0.08)
          .to(flash, { alpha: 0.22 * k, duration: 0.06, ease: 'power3.out' }, at)
          .to(flash, { alpha: 0, duration: 0.2, ease: 'power2.out' }, at + 0.06);
        // expanding echo ring per thump
        const echo = new Graphics();
        echo.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, 18).stroke({ color: ctx.gold, width: 3, alpha: 1 });
        echo.blendMode = 'add';
        echo.position.set(cx, cy);
        echo.alpha = 0;
        layer.addChild(echo);
        tl.set(echo, { alpha: 0.7 * k }, at)
          .to(echo.scale, { x: 1 + 0.12 * k, y: 1 + 0.15 * k, duration: 0.5, ease: 'power2.out' }, at)
          .to(echo, { alpha: 0, duration: 0.48, ease: 'power2.out' }, at + 0.02);
      };

      // three escalating lub-dub pairs
      const beats: Array<{ t: number; k: number }> = [
        { t: 0.05, k: 0.45 },
        { t: 0.55, k: 0.72 },
        { t: 1.0, k: 1 },
      ];
      for (const b of beats) {
        thump(b.t, b.k);
        thump(b.t + 0.16, b.k * 0.6);
      }

      tl.to(frame, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 1.5);
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
        const glow = new Graphics();
        glow.roundRect(-edgeW, 0, edgeW * 2, r.h, edgeW).fill({ color: ctx.gold, alpha: 0.9 });
        glow.blendMode = 'add';
        glow.filters = [new BlurFilter({ strength: 10 })];
        glow.alpha = 0;
        const hot = new Graphics();
        hot.roundRect(-edgeW * 0.4, 0, edgeW * 0.8, r.h, edgeW * 0.4).fill({ color: 0xffffff, alpha: 0.9 });
        hot.blendMode = 'add';
        hot.alpha = 0;
        c.addChild(glow, hot);
        c.position.set(x, r.y);
        layer.addChild(c);
        return { glow, hot };
      };
      const left = makeEdge(r.x + edgeW * 0.2);
      const right = makeEdge(r.x + r.w - edgeW * 0.2);

      const tl = ctx.track(ctx.gsap.timeline());
      for (const e of [left, right]) {
        // heat ramps in — glow first, then the white-hot core
        tl.to(e.glow, { alpha: 1, duration: 1.15, ease: 'power2.in' }, 0)
          .to(e.hot, { alpha: 1, duration: 0.85, ease: 'power3.in' }, 0.35)
          // nervous width-flicker on the hot core
          .to(e.hot.scale, { x: 1.18, duration: 0.055, yoyo: true, repeat: 11, ease: 'sine.inOut' }, 0.5);
      }

      // stray embers popping off the burning edges near the climax
      for (let i = 0; i < 10; i++) {
        const s = softGlow(ctx.pick([ctx.gold, ctx.gold, 0xffffff, ctx.accent]), ctx.rand(5, 11), 0);
        const ex = ctx.pick([r.x + edgeW * 0.3, r.x + r.w - edgeW * 0.3]);
        s.position.set(ex + ctx.rand(-4, 4), r.y + r.h * ctx.rand(0.55, 1));
        layer.addChild(s);
        const dur = ctx.rand(0.4, 0.7);
        const at = 0.6 + i * 0.06;
        tl.to(s, { alpha: ctx.rand(0.5, 1), duration: 0.12, ease: 'power1.out' }, at)
          .to(s, { y: s.y - ctx.rand(40, 110), duration: dur, ease: 'power1.in' }, at)
          .to(s, { alpha: 0, duration: 0.22, ease: 'power1.in' }, at + dur - 0.18);
      }

      // white-hot climax flash, then burn out
      tl.to([left.glow, right.glow], { alpha: 0.35, duration: 0.09, ease: 'power4.out' }, 1.28)
        .to([left.glow, right.glow], { alpha: 1, duration: 0.1, ease: 'power2.out' }, 1.37)
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

      // the scan head: afterglow tail above, soft band, crisp core, edge glints
      const line = new Container();
      const tail = new Graphics();
      tail.roundRect(-r.w / 2, -46, r.w, 44, 8).fill({ color: ctx.accent, alpha: 0.12 });
      tail.blendMode = 'add';
      const band = new Graphics();
      band.roundRect(-r.w / 2, -14, r.w, 28, 14).fill({ color: ctx.accent, alpha: 0.35 });
      band.blendMode = 'add';
      band.filters = [new BlurFilter({ strength: 8 })];
      const core = new Graphics();
      core.roundRect(-r.w / 2, -1.6, r.w, 3.2, 1.6).fill({ color: 0xffffff, alpha: 0.95 });
      core.blendMode = 'add';
      const glintL = softGlow(0xffffff, 26, 0.9);
      glintL.position.set(-r.w / 2, 0);
      const glintR = softGlow(0xffffff, 26, 0.9);
      glintR.position.set(r.w / 2, 0);
      line.addChild(tail, band, core, glintL, glintR);
      line.position.set(r.x + r.w / 2, r.y + 4);
      line.alpha = 0;
      layer.addChild(line);

      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(tint, { alpha: 1, duration: 0.15, ease: 'power1.out' }, 0)
        .to(line, { alpha: 1, duration: 0.1, ease: 'power1.out' }, 0)
        // pass 1: sweep down
        .to(line, { y: r.y + r.h - 4, duration: 0.62, ease: 'power2.inOut' }, 0.05)
        // read-out blinking while scanning
        .to(tint, { alpha: 0.45, duration: 0.16, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.2)
        // pass 2: return sweep — faster, fatter, brighter
        .to(line, { y: r.y + 6, duration: 0.4, ease: 'power3.inOut' }, 0.82)
        .to(line.scale, { y: 1.7, duration: 0.4, ease: 'sine.inOut' }, 0.82)
        // lock-on flash at the top, then release
        .to(tint, { alpha: 1, duration: 0.08, ease: 'power4.out' }, 1.24)
        .to(layer, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 1.4);
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

      // faint flickering outline the dashes ride on
      const border = new Graphics();
      border.roundRect(r.x, r.y, r.w, r.h, 10).stroke({ color: ctx.accent, width: 2, alpha: 0.35 });
      border.blendMode = 'add';
      border.alpha = 0;
      layer.addChild(border);
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(border, { alpha: 1, duration: 0.18, ease: 'power2.out' }, 0)
        .to(border, { alpha: 0.45, duration: 0.07, yoyo: true, repeat: 13, ease: 'none' }, 0.25)
        .to(border, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 1.45);

      // racing dashes — alternating directions, jittering off the rail
      const dashCount = 6;
      for (let i = 0; i < dashCount; i++) {
        const dash = new Container();
        const aura = softGlow(ctx.accent, 30, 0.8);
        const bar = new Graphics();
        bar.roundRect(-12, -2, 24, 4, 2).fill({ color: 0xffffff, alpha: 1 });
        bar.blendMode = 'add';
        dash.addChild(aura, bar);
        dash.alpha = 0;
        layer.addChild(dash);

        const state = { t: i / dashCount + ctx.rand(-0.04, 0.04) };
        const dir = i % 2 === 0 ? 1 : -1;
        const laps = ctx.rand(0.9, 1.4) * dir;
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

        const at = 0.05 + i * 0.04;
        const dtl = ctx.track(ctx.gsap.timeline());
        dtl.to(dash, { alpha: 1, duration: 0.12, ease: 'power1.out' }, at)
          .to(state, { t: state.t + laps, duration: 1.15, ease: 'power1.inOut', onUpdate: place }, at)
          .to(dash, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 1.32);
      }

      // arc-flash sparks popping at random points on the rail
      for (let i = 0; i < 9; i++) {
        const p = perimeterPoint(r, ctx.rand(0, 1));
        const s = softGlow(0xffffff, ctx.rand(10, 20), 0);
        s.position.set(p.x, p.y);
        layer.addChild(s);
        const base = s.scale.x;
        const at = ctx.rand(0.15, 1.15);
        const stl = ctx.track(ctx.gsap.timeline());
        stl.to(s, { alpha: 1, duration: 0.05, ease: 'power4.out' }, at)
          .to(s.scale, { x: base * 1.9, y: base * 1.9, duration: 0.2, ease: 'power2.out' }, at)
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

      // two distinct random cells
      const all: Array<{ reel: number; row: number }> = [];
      for (let re = 0; re < ctx.grid.reels; re++) {
        for (let ro = 0; ro < ctx.grid.rows; ro++) all.push({ reel: re, row: ro });
      }
      const a = ctx.pick(all);
      let b = ctx.pick(all);
      for (let i = 0; i < 8 && b.reel === a.reel && b.row === a.row; i++) b = ctx.pick(all);

      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(veil, { alpha: 0.66, duration: 0.35, ease: 'power2.out' }, 0);

      [a, b].forEach((cell, idx) => {
        const c = ctx.cellRect(cell.reel, cell.row);
        const node = new Container();
        node.position.set(c.x + c.w / 2, c.y + c.h / 2);

        const halo = softGlow(ctx.accent, Math.max(c.w, c.h) * 2.1, 0.55);
        const frame = new Graphics();
        frame.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12).stroke({ color: ctx.gold, width: 3, alpha: 0.95 });
        frame.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12).fill({ color: 0xffffff, alpha: 0.07 });
        frame.blendMode = 'add';
        node.addChild(halo, frame);
        node.alpha = 0;
        node.scale.set(0.7);
        layer.addChild(node);

        // the two lights snap in slightly offset, then breathe out of phase
        const at = 0.15 + idx * 0.14;
        tl.to(node, { alpha: 1, duration: 0.3, ease: 'power2.out' }, at)
          .to(node.scale, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2.2)' }, at)
          .to(node.scale, { x: 1.07, y: 1.07, duration: 0.42, ease: 'sine.inOut', yoyo: true, repeat: 2 }, at + 0.55)
          .to(halo, { alpha: 0.9, duration: 0.42, ease: 'sine.inOut', yoyo: true, repeat: 2 }, at + 0.55);
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

      // warm coal-bed glow along the grid floor
      const bed = new Graphics();
      bed.roundRect(g.x, g.y + g.h - 26, g.w, 26, 13).fill({ color: ctx.gold, alpha: 0.55 });
      bed.blendMode = 'add';
      bed.filters = [new BlurFilter({ strength: 12 })];
      bed.alpha = 0;
      layer.addChild(bed);

      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(bed, { alpha: 1, duration: 0.9, ease: 'power2.in' }, 0)
        .to(bed, { alpha: 0, duration: 0.6, ease: 'power2.in' }, 1.7);

      // embers — spawn times cluster toward the end (accelerating swarm)
      const count = 26;
      for (let i = 0; i < count; i++) {
        const frac = i / count;
        const delay = 1.35 * Math.pow(frac, 1.7);
        const s = softGlow(ctx.pick([ctx.gold, ctx.gold, ctx.accent, 0xffffff]), ctx.rand(6, 15), 0);
        const x0 = g.x + ctx.rand(0.05, 0.95) * g.w;
        s.position.set(x0, g.y + g.h + ctx.rand(0, 14));
        layer.addChild(s);

        const rise = ctx.rand(0.75, 1.05);
        const etl = ctx.track(ctx.gsap.timeline({ delay }));
        etl.to(s, { alpha: ctx.rand(0.6, 1), duration: 0.18, ease: 'power1.out' }, 0)
          // power2.in = the ember accelerates as it climbs
          .to(s, { y: g.y + ctx.rand(-10, g.h * 0.25), duration: rise, ease: 'power2.in' }, 0)
          // lazy sideways sway on the way up
          .to(s, { x: x0 + ctx.rand(-26, 26), duration: rise * 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
          .to(s, { alpha: 0, duration: 0.22, ease: 'power1.in' }, Math.max(0.2, rise - 0.18));
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

      // converging rings — reel-shaped outlines shrinking with power3.in
      const rings = 4;
      for (let i = 0; i < rings; i++) {
        const ring = new Container();
        ring.position.set(cx, cy);
        const outer = new Graphics();
        outer.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 14).stroke({ color: ctx.accent, width: 7, alpha: 0.4 });
        outer.blendMode = 'add';
        const inner = new Graphics();
        inner.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 14).stroke({ color: 0xffffff, width: 2.2, alpha: 0.9 });
        inner.blendMode = 'add';
        ring.addChild(outer, inner);
        ring.scale.set(2.7);
        ring.alpha = 0;
        layer.addChild(ring);

        const at = 0.05 + i * 0.17;
        tl.to(ring, { alpha: 0.9, duration: 0.18, ease: 'power1.out' }, at)
          .to(ring.scale, { x: 0.55, y: 0.55, duration: 0.55, ease: 'power3.in' }, at)
          .to(ring, { alpha: 0, duration: 0.12, ease: 'power2.in' }, at + 0.45);
      }

      // implosion when the last ring lands (~1.1s)
      const boom = softGlow(0xffffff, r.w * 1.4, 0);
      boom.position.set(cx, cy);
      layer.addChild(boom);
      const bs = boom.scale.x;

      const fill = new Graphics();
      fill.roundRect(r.x, r.y, r.w, r.h, 12).fill({ color: ctx.accent, alpha: 0.35 });
      fill.blendMode = 'add';
      fill.alpha = 0;
      layer.addChild(fill);

      tl.set(boom.scale, { x: bs * 0.2, y: bs * 0.2 }, 1.05)
        .to(boom, { alpha: 1, duration: 0.08, ease: 'power4.out' }, 1.08)
        .to(boom.scale, { x: bs * 1.25, y: bs * 1.25, duration: 0.3, ease: 'back.out(1.8)' }, 1.08)
        .to(boom, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 1.2)
        .to(fill, { alpha: 1, duration: 0.07, ease: 'power4.out' }, 1.08)
        .to(fill, { alpha: 0, duration: 0.5, ease: 'power2.out' }, 1.18);
    },
  },
];
