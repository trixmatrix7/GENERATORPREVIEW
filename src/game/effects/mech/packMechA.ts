// MECH_PACK_A — five slot-mechanic showcases. Every mechanic is outcome-neutral
// (pure display; the math never moves), theme-agnostic (ctx.accent / ctx.gold),
// grid-relative (all geometry via cellRect/reelRect/gridRect) and rides the
// sticky overlay lifecycle — whatever survives the choreography is cleared by
// the next spin. Each run is 2.5-5s of layered AAA beats: anticipation
// counter-moves before every impact, power3/4.in arrivals with squash-stretch
// and elastic settles, 3+ layer additive glows (wide wash / mid body / hot
// white core), seeded timing jitter so nothing moves in lockstep, and every
// tween registered through ctx.track() so the whole mechanic is cancellable
// mid-flight (ctx.alive() checked after every await).

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { MechEntry, MechContext } from '../mechTypes';

type Rect = { x: number; y: number; w: number; h: number };

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

function mid(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Integer in [0, n-1] using the mechanic's seeded cosmetic rand. */
function randInt(ctx: MechContext, n: number): number {
  return Math.min(n - 1, Math.floor(ctx.rand(0, n)));
}

/** Soft additive radial glow — four layers: wide wash, mid body, inner
 *  colour, hot white core. Never a single flat circle. */
function glowDot(color: number, r: number, k = 1): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.12 * k });
  g.circle(0, 0, r * 0.62).fill({ color, alpha: 0.34 * k });
  g.circle(0, 0, r * 0.36).fill({ color, alpha: 0.5 * k });
  g.circle(0, 0, r * 0.18).fill({ color: 0xffffff, alpha: 0.82 * k });
  g.blendMode = 'add';
  return g;
}

/** Flat point list for a 5-point star centred on (0,0). */
function starPts(outer: number, inner: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

/** Expanding shockwave ring: wide soft wash band + coloured glow band + crisp
 *  white core, chased by a dimmer, smaller echo ring. Size/time jittered. */
function ringBurst(ctx: MechContext, x: number, y: number, radius: number, color: number, delay = 0): void {
  const BASE = 40;
  const ring = new Container();
  ring.position.set(x, y);
  const wash = new Graphics();
  wash.circle(0, 0, BASE).stroke({ color, width: 15, alpha: 0.14 });
  wash.blendMode = 'add';
  const glow = new Graphics();
  glow.circle(0, 0, BASE).stroke({ color, width: 8, alpha: 0.38 });
  glow.blendMode = 'add';
  const core = new Graphics();
  core.circle(0, 0, BASE).stroke({ color: 0xffffff, width: 2, alpha: 0.85 });
  core.blendMode = 'add';
  ring.addChild(wash, glow, core);
  ring.scale.set(0.1);
  ring.alpha = 0;
  ctx.overlay.addChild(ring);
  const s = (radius / BASE) * ctx.rand(0.93, 1.09);
  const d = 0.5 * ctx.rand(0.86, 1.14);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(ring, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
    .to(ring.scale, { x: s, y: s, duration: d, ease: 'power3.out' }, 0)
    .to(ring, { alpha: 0, duration: d * 0.66, ease: 'power2.in' }, d * 0.44);

  // Echo — trails the main front dimmer AND smaller, so the burst decays.
  const echo = new Graphics();
  echo.circle(0, 0, BASE).stroke({ color, width: 5, alpha: 0.2 });
  echo.blendMode = 'add';
  echo.position.set(x, y);
  echo.scale.set(0.1);
  echo.alpha = 0;
  ctx.overlay.addChild(echo);
  const etl = ctx.track(ctx.gsap.timeline({ delay: delay + ctx.rand(0.06, 0.1) }));
  etl.to(echo, { alpha: 0.7, duration: 0.05, ease: 'power1.out' }, 0)
    .to(echo.scale, { x: s * 0.72, y: s * 0.72, duration: d * 1.15, ease: 'power2.out' }, 0)
    .to(echo, { alpha: 0, duration: d * 0.7, ease: 'power2.in' }, d * 0.45);
}

/** Radial spray of glow sparks: jittered angles/sizes/timing, each spark
 *  shrinks as it fades and gets a small gravity droop at the end. */
function sparkBurst(ctx: MechContext, x: number, y: number, color: number, n: number, dist: number, delay = 0): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ctx.rand(-0.5, 0.5);
    const s = glowDot(color, ctx.rand(3.5, 7.5));
    s.position.set(x, y);
    s.alpha = 0;
    s.scale.set(ctx.rand(0.8, 1.2));
    ctx.overlay.addChild(s);
    const d = ctx.rand(dist * 0.5, dist);
    const fly = ctx.rand(0.45, 0.68);
    const droop = ctx.rand(4, 13);
    const tl = ctx.track(ctx.gsap.timeline({ delay: delay + ctx.rand(0, 0.07) }));
    tl.to(s, { alpha: 1, duration: 0.04, ease: 'power1.out' }, 0)
      .to(s.position, { x: x + Math.cos(a) * d, duration: fly, ease: 'power4.out' }, 0)
      .to(s.position, { y: y + Math.sin(a) * d, duration: fly, ease: 'power3.out' }, 0)
      .to(s.position, { y: `+=${droop}`, duration: fly * 0.6, ease: 'power2.in' }, fly)
      .to(s.scale, { x: 0.3, y: 0.3, duration: fly * 0.8, ease: 'power2.in' }, fly * 0.35)
      .to(s, { alpha: 0, duration: fly * 0.6, ease: 'power2.in' }, fly * 0.55);
  }
}

/** Additive cell-sized flash tile — layered colour wash + white body + hot
 *  centre; pops with a back.out punch, settles, then fades with power2.in. */
function cellFlash(ctx: MechContext, cr: Rect, color: number, delay = 0): void {
  const c = mid(cr);
  const g = new Graphics();
  g.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color, alpha: 0.14 });
  g.roundRect(-cr.w / 2 + 5, -cr.h / 2 + 5, cr.w - 10, cr.h - 10, 9).fill({ color: 0xffffff, alpha: 0.2 });
  g.roundRect(-cr.w * 0.2, -cr.h * 0.2, cr.w * 0.4, cr.h * 0.4, 8).fill({ color: 0xffffff, alpha: 0.45 });
  g.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color, width: 3, alpha: 0.85 });
  g.blendMode = 'add';
  g.position.set(c.x, c.y);
  g.alpha = 0;
  g.scale.set(0.72);
  ctx.overlay.addChild(g);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(g, { alpha: 1, duration: 0.06, ease: 'power2.out' }, 0)
    .to(g.scale, { x: 1.07, y: 1.07, duration: 0.2, ease: 'back.out(2.6)' }, 0)
    .to(g.scale, { x: 1, y: 1, duration: 0.14, ease: 'power2.out' }, 0.2)
    .to(g, { alpha: 0, duration: 0.34, ease: 'power2.in' }, 0.3);
}

/** Star glint: counter-rotated wind-up, back.out pop, then exits still
 *  rotating and shrinking so it never just pops off. */
function starPop(ctx: MechContext, x: number, y: number, size: number, color: number, delay = 0): void {
  const glint = new Container();
  const halo = glowDot(0xffffff, size * 1.5, 0.6);
  const star = new Graphics();
  star.poly(starPts(size, size * 0.36)).fill({ color, alpha: 0.9 });
  star.poly(starPts(size, size * 0.36)).stroke({ color: 0xffffff, width: 1.4, alpha: 0.75 });
  star.blendMode = 'add';
  glint.addChild(halo, star);
  glint.position.set(x, y);
  glint.scale.set(0);
  glint.rotation = -ctx.rand(0.25, 0.45);
  ctx.overlay.addChild(glint);
  const spin = ctx.rand(0.6, 1.25);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(glint.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(3)' }, 0)
    .to(glint, { rotation: spin, duration: 0.55, ease: 'power2.out' }, 0)
    .to(glint.scale, { x: 0.55, y: 0.55, duration: 0.3, ease: 'power2.in' }, 0.26)
    .to(glint, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.28);
}

/** Gold '?' mystery plate sized to a cell, centred on (0,0). */
function mysteryPlate(ctx: MechContext, cr: Rect): Container {
  const c = new Container();
  const w = cr.w;
  const h = cr.h;
  const plate = new Graphics();
  plate.roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: 0x140b02, alpha: 1 });
  plate.roundRect(-w / 2, -h / 2, w, h, 12).stroke({ color: ctx.gold, width: 3, alpha: 1 });
  plate.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 9).stroke({ color: 0xffffff, width: 1.4, alpha: 0.28 });
  const sheen = new Graphics();
  sheen.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.38, 8).fill({ color: ctx.gold, alpha: 0.16 });
  sheen.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.16, 8).fill({ color: 0xffffff, alpha: 0.05 });
  sheen.blendMode = 'add';
  const q = new Text({
    text: '?',
    style: new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: Math.round(h * 0.56),
      fontWeight: '900',
      fill: ctx.gold,
      stroke: { color: 0xffffff, width: 2 },
    }),
  });
  q.anchor.set(0.5);
  c.addChild(plate, sheen, q);
  return c;
}

/* ------------------------------------------------------------------ */
/* the pack                                                            */
/* ------------------------------------------------------------------ */

export const MECH_PACK_A: readonly MechEntry[] = [
  /* ---------------------------------------------------------------- */
  {
    id: 'mystery-reveal',
    name: 'Mystery Reveal',
    description:
      "Gold '?' plates pop on random cells, tremble with anticipation, then all flip into the same random symbol.",
    async run(ctx: MechContext): Promise<void> {
      // Pick 4-7 distinct cells via a seeded shuffle.
      const count = 4 + randInt(ctx, 4);
      const all: { reel: number; row: number }[] = [];
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) all.push({ reel, row });
      }
      for (let i = all.length - 1; i > 0; i--) {
        const j = randInt(ctx, i + 1);
        [all[i], all[j]] = [all[j], all[i]];
      }
      const cells = all.slice(0, Math.min(count, all.length));
      const target = ctx.pick([0, 2, 3, 4, 5] as const);

      // Phase 1 — plates pop in: overshoot punch, follow-through settle, a
      // tiny random spawn tilt that rights itself, halo blooming underneath.
      // Stagger is jittered so no two arrivals are metronomic.
      const tiles: Container[] = [];
      cells.forEach((cell, i) => {
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = mid(cr);
        const halo = glowDot(ctx.gold, Math.max(cr.w, cr.h) * 0.62, 0.8);
        halo.position.set(c.x, c.y);
        halo.alpha = 0;
        ctx.overlay.addChild(halo);
        const t = mysteryPlate(ctx, cr);
        t.position.set(c.x, c.y);
        t.scale.set(0);
        t.rotation = ctx.rand(-0.09, 0.09);
        ctx.overlay.addChild(t);
        tiles.push(t);
        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.09 + ctx.rand(0, 0.05) }));
        tl.to(t.scale, { x: 1.07, y: 1.07, duration: 0.28, ease: 'back.out(2.2)' }, 0)
          .to(t.scale, { x: 1, y: 1, duration: 0.15, ease: 'power2.out' }, 0.28)
          .to(t, { rotation: 0, duration: 0.38, ease: 'back.out(1.6)' }, 0.06)
          .to(halo, { alpha: 0.85, duration: 0.14, ease: 'power2.out' }, 0.04)
          .to(halo.scale, { x: 1.18, y: 1.18, duration: 0.5, ease: 'power2.out' }, 0.08)
          .to(halo, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.28);
      });
      await new Promise((r) => setTimeout(r, 900));
      if (!ctx.alive()) return;

      // Phase 2 — anticipation tremble: per-tile random amplitude, rate and
      // repeat count (nobody trembles in lockstep), plus a nervous inhale
      // (squeeze down) that releases into a back.out puff.
      tiles.forEach((t, i) => {
        const amp = ctx.rand(0.045, 0.075);
        const rate = ctx.rand(0.07, 0.1);
        const reps = 4 + randInt(ctx, 3);
        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.03 + ctx.rand(0, 0.04) }));
        tl.to(t, { rotation: -amp, duration: rate * 0.6, ease: 'sine.inOut' }, 0)
          .to(t, { rotation: amp, duration: rate, repeat: reps, yoyo: true, ease: 'sine.inOut' }, rate * 0.6)
          .to(t, { rotation: 0, duration: 0.07, ease: 'sine.out' }, rate * 0.6 + rate * (reps + 1))
          .to(t.scale, { x: 0.94, y: 0.95, duration: 0.28, ease: 'sine.inOut' }, 0.08)
          .to(t.scale, { x: 1.045, y: 1.045, duration: 0.22, ease: 'back.out(2.4)' }, 0.42);
      });
      await new Promise((r) => setTimeout(r, 800));
      if (!ctx.alive()) return;

      // Phase 3 — the flip: each plate inhales WIDER first (anticipation),
      // slams shut with power3.in, the board cell re-skins under it, then it
      // reopens with back.out and hands off by fading while still settling.
      cells.forEach((cell, i) => {
        const t = tiles[i];
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = mid(cr);
        const dl = i * 0.07 + ctx.rand(0, 0.03);
        const side = i % 2 === 0 ? 1 : -1;
        const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
        tl.to(t.scale, { x: 1.09, duration: 0.09, ease: 'power2.out' }, 0)
          .to(t.scale, { x: 0, duration: 0.13, ease: 'power3.in' }, 0.09)
          .call(
            () => {
              if (!ctx.alive()) return;
              ctx.setCellSymbol(cell.reel, cell.row, target);
              ctx.playCellState(cell.reel, cell.row, 'featured');
            },
            undefined,
            0.22,
          )
          .to(t.scale, { x: 1.06, duration: 0.2, ease: 'back.out(2.4)' }, 0.24)
          .to(t.scale, { x: 1, duration: 0.12, ease: 'power2.out' }, 0.44)
          .to(t, { alpha: 0, duration: 0.22, ease: 'power2.in' }, 0.34);
        ringBurst(ctx, c.x, c.y, Math.max(cr.w, cr.h) * 0.75, ctx.gold, dl + 0.24);
        starPop(
          ctx,
          c.x + side * cr.w * ctx.rand(0.2, 0.3),
          c.y - cr.h * ctx.rand(0.2, 0.3),
          cr.w * 0.14,
          ctx.gold,
          dl + 0.3,
        );
      });
      await new Promise((r) => setTimeout(r, 700 + cells.length * 70));
      if (!ctx.alive()) return;

      // Tail — a settling beat so the revealed set reads as one thing.
      await new Promise((r) => setTimeout(r, 500));
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'symbol-upgrade',
    name: 'Symbol Upgrade',
    description:
      'A golden sweep crosses the grid; every low-pay cell it touches flashes and upgrades to the same premium.',
    async run(ctx: MechContext): Promise<void> {
      const gr = ctx.gridRect();
      const to = ctx.pick([2, 3] as const);

      // Collect the LOW cells (6-8). Fallback: if the board rolled no lows,
      // bless three random cells so the showcase always lands.
      const marks: { reel: number; row: number }[] = [];
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const s = ctx.getCellSymbol(reel, row);
          if (s >= 6 && s <= 8) marks.push({ reel, row });
        }
      }
      if (marks.length === 0) {
        for (let i = 0; i < 3; i++) marks.push({ reel: randInt(ctx, ctx.grid.reels), row: randInt(ctx, ctx.grid.rows) });
      }

      ctx.dimBoard(0.3);

      // Anticipation — a charge glow inhales at the launch edge: bloom out,
      // contract hard, then the sweep fires out of the contraction.
      const bandW = gr.w * 0.16;
      const startX = gr.x - bandW * 1.5;
      const endX = gr.x + gr.w + bandW * 1.5;
      const charge = glowDot(ctx.gold, gr.h * 0.3, 0.9);
      charge.position.set(gr.x - bandW * 0.4, gr.y + gr.h / 2);
      charge.alpha = 0;
      charge.scale.set(1.35);
      ctx.overlay.addChild(charge);
      const ctl = ctx.track(ctx.gsap.timeline());
      ctl.to(charge, { alpha: 0.85, duration: 0.16, ease: 'power2.out' }, 0)
        .to(charge.scale, { x: 0.45, y: 0.45, duration: 0.24, ease: 'power3.in' }, 0.06)
        .to(charge, { alpha: 0, duration: 0.1, ease: 'power1.in' }, 0.28);
      await new Promise((r) => setTimeout(r, 380));
      if (!ctx.alive()) return;

      // The sweep band: wide soft wash, gold body, razor white core. A short
      // recoil pull-back, THEN linear travel so per-cell hit times line up
      // exactly with the front (the sweep sync IS the design).
      const recoil = 0.09;
      const dur = 1.15;
      const band = new Container();
      band.position.set(startX, gr.y + gr.h / 2);
      const wash = new Graphics();
      wash.rect(-bandW, -gr.h * 0.62, bandW * 2, gr.h * 1.24).fill({ color: ctx.gold, alpha: 0.1 });
      wash.blendMode = 'add';
      const body = new Graphics();
      body.rect(-bandW * 0.45, -gr.h * 0.6, bandW * 0.9, gr.h * 1.2).fill({ color: ctx.gold, alpha: 0.22 });
      body.blendMode = 'add';
      const core = new Graphics();
      core.rect(-bandW * 0.06, -gr.h * 0.6, bandW * 0.12, gr.h * 1.2).fill({ color: 0xffffff, alpha: 0.6 });
      core.blendMode = 'add';
      band.addChild(wash, body, core);
      ctx.overlay.addChild(band);
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(band.position, { x: startX - bandW * 0.3, duration: recoil, ease: 'power2.out' }, 0)
        .to(band.position, { x: endX, duration: dur, ease: 'none' }, recoil)
        .to(band, { alpha: 0, duration: 0.22, ease: 'power1.in' }, recoil + dur - 0.2);

      // Each marked cell upgrades exactly when the band front crosses it:
      // layered flash pop + re-skin to the premium + jittered star/sparks.
      marks.forEach((m) => {
        const cr = ctx.cellRect(m.reel, m.row);
        const c = mid(cr);
        const when = recoil + ((c.x - startX) / (endX - startX)) * dur;
        const tl = ctx.track(ctx.gsap.timeline({ delay: Math.max(0, when - 0.05) }));
        tl.call(
          () => {
            if (!ctx.alive()) return;
            ctx.setCellSymbol(m.reel, m.row, to);
            ctx.playCellState(m.reel, m.row, 'win');
          },
          undefined,
          0.08,
        );
        cellFlash(ctx, cr, ctx.gold, Math.max(0, when - 0.05));
        starPop(ctx, c.x + cr.w * ctx.rand(-0.12, 0.12), c.y - cr.h * 0.2, cr.w * 0.16, ctx.gold, Math.max(0, when + 0.06 + ctx.rand(0, 0.05)));
        sparkBurst(ctx, c.x, c.y, ctx.gold, 5, cr.w * 0.7, Math.max(0, when + 0.04 + ctx.rand(0, 0.03)));
      });

      await new Promise((r) => setTimeout(r, (recoil + dur) * 1000 + 150));
      if (!ctx.alive()) return;
      ctx.undimBoard();

      // Tail — upgraded cells breathe as a set behind a fading grid pulse.
      ringBurst(ctx, gr.x + gr.w / 2, gr.y + gr.h / 2, Math.hypot(gr.w, gr.h) * 0.4, ctx.gold, 0.05);
      await new Promise((r) => setTimeout(r, 1100));
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'reel-nudge',
    name: 'Reel Nudge',
    description:
      'One reel darkens under a pulsing arrow, nudges a full cell downward, and a shining WILD thunks into the top row.',
    async run(ctx: MechContext): Promise<void> {
      const reel = randInt(ctx, ctx.grid.reels);
      const rr = ctx.reelRect(reel);
      const c0 = ctx.cellRect(reel, 0);
      const pitch = ctx.grid.rows > 1 ? ctx.cellRect(reel, 1).y - c0.y : c0.h;

      // Telegraph — dark veil over the reel + a down-arrow whose bob DECAYS
      // (each dip shallower than the last) instead of ticking like a metronome.
      const veil = new Graphics();
      veil.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0x000000, alpha: 1 });
      veil.alpha = 0;
      ctx.overlay.addChild(veil);
      ctx.track(ctx.gsap.to(veil, { alpha: 0.5, duration: 0.28, ease: 'power2.out' }));

      const aw = rr.w * 0.4;
      const arrowY = rr.y - aw * 0.75;
      const arrow = new Container();
      arrow.position.set(rr.x + rr.w / 2, arrowY);
      const aGlow = new Graphics();
      aGlow.poly([-aw * 0.62, -aw * 0.1, aw * 0.62, -aw * 0.1, 0, aw * 0.72]).fill({ color: ctx.gold, alpha: 0.14 });
      aGlow.poly([-aw * 0.54, -aw * 0.06, aw * 0.54, -aw * 0.06, 0, aw * 0.64]).fill({ color: ctx.gold, alpha: 0.24 });
      aGlow.blendMode = 'add';
      const aCore = new Graphics();
      aCore.poly([-aw / 2, 0, aw / 2, 0, 0, aw * 0.6]).fill({ color: ctx.gold, alpha: 0.95 });
      aCore.poly([-aw / 2, 0, aw / 2, 0, 0, aw * 0.6]).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
      arrow.addChild(aGlow, aCore);
      arrow.scale.set(0);
      ctx.overlay.addChild(arrow);
      const atl = ctx.track(ctx.gsap.timeline());
      atl.to(arrow.scale, { x: 1, y: 1, duration: 0.24, ease: 'back.out(3)' }, 0)
        .to(arrow, { y: arrowY + 15, duration: 0.14, ease: 'power2.inOut' }, 0.22)
        .to(arrow, { y: arrowY, duration: 0.13, ease: 'power2.inOut' }, 0.36)
        .to(arrow, { y: arrowY + 9, duration: 0.12, ease: 'power2.inOut' }, 0.49)
        .to(arrow, { y: arrowY, duration: 0.12, ease: 'power2.inOut' }, 0.61)
        .to(arrow, { y: arrowY + 5, duration: 0.1, ease: 'power2.inOut' }, 0.73)
        .to(arrow, { y: arrowY, duration: 0.1, ease: 'power2.inOut' }, 0.83);
      await new Promise((r) => setTimeout(r, 700));
      if (!ctx.alive()) return;

      // The nudge — the ghost strip PULLS UP first (anticipation counter-move)
      // then accelerates one full cell down with power3.in, selling the shove.
      const maskG = new Graphics();
      maskG.rect(rr.x, rr.y, rr.w, rr.h).fill({ color: 0xffffff });
      ctx.overlay.addChild(maskG);
      const strip = new Container();
      strip.mask = maskG;
      for (let row = -1; row < ctx.grid.rows; row++) {
        const gy = c0.y + pitch * row;
        const ghost = new Graphics();
        ghost.roundRect(c0.x + 4, gy + 4, c0.w - 8, c0.h - 8, 10).fill({ color: ctx.accent, alpha: 0.16 });
        ghost.roundRect(c0.x + 4, gy + 4, c0.w - 8, c0.h - 8, 10).stroke({ color: 0xffffff, width: 1.6, alpha: 0.4 });
        ghost.roundRect(c0.x + 4, gy + 4, c0.w - 8, c0.h * 0.16, 10).fill({ color: 0xffffff, alpha: 0.05 });
        ghost.blendMode = 'add';
        strip.addChild(ghost);
      }
      ctx.overlay.addChild(strip);
      const ntl = ctx.track(ctx.gsap.timeline());
      ntl.to(strip, { y: -pitch * 0.09, duration: 0.11, ease: 'power2.out' }, 0)
        .to(strip, { y: pitch, duration: 0.34, ease: 'power3.in' }, 0.11)
        .to(arrow, { y: arrowY + 10, duration: 0.12, ease: 'power3.in' }, 0.33);
      await new Promise((r) => setTimeout(r, 470));
      if (!ctx.alive()) return;

      // Commit the illusion: shift the underlying symbols one row down while
      // a white snap-flash covers the swap, then drop the strip.
      for (let row = ctx.grid.rows - 1; row >= 1; row--) {
        ctx.setCellSymbol(reel, row, ctx.getCellSymbol(reel, row - 1));
      }
      const snap = new Graphics();
      snap.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0xffffff, alpha: 0.38 });
      snap.roundRect(rr.x + 6, rr.y + 6, rr.w - 12, rr.h - 12, 10).fill({ color: ctx.gold, alpha: 0.12 });
      snap.blendMode = 'add';
      ctx.overlay.addChild(snap);
      ctx.track(ctx.gsap.to(snap, { alpha: 0, duration: 0.3, ease: 'power2.out' }));
      ctx.track(ctx.gsap.to(strip, { alpha: 0, duration: 0.2, ease: 'power1.in' }));
      ctx.track(ctx.gsap.to(arrow, { alpha: 0, y: arrowY + 18, duration: 0.2, ease: 'power1.in' }));
      await new Promise((r) => setTimeout(r, 180));
      if (!ctx.alive()) return;

      // The WILD lands in the vacated top row — a landing glow blooms on the
      // cell as it falls, power4.in slam, hard squash, a beat of hold, then an
      // elastic settle. Thunk flash + shockwave + jittered dust sparks.
      const cc = mid(c0);
      const pad = glowDot(ctx.accent, Math.max(c0.w, c0.h) * 0.55, 0.7);
      pad.position.set(cc.x, cc.y + c0.h * 0.18);
      pad.alpha = 0;
      pad.scale.set(0.4);
      ctx.overlay.addChild(pad);
      const padTl = ctx.track(ctx.gsap.timeline());
      padTl.to(pad, { alpha: 0.8, duration: 0.2, ease: 'power2.in' }, 0)
        .to(pad.scale, { x: 1, y: 1, duration: 0.24, ease: 'power2.in' }, 0)
        .to(pad, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.3);

      const tile = ctx.spawnTile(0, reel, 0, true);
      const ty = tile.y;
      const bsx = tile.scale.x;
      const bsy = tile.scale.y;
      tile.y = ty - c0.h * 1.35;
      const dtl = ctx.track(ctx.gsap.timeline());
      dtl.to(tile, { y: ty, duration: 0.26, ease: 'power4.in' }, 0)
        .to(tile.scale, { x: bsx * 1.14, y: bsy * 0.8, duration: 0.08, ease: 'power3.out' }, 0.26)
        .to(tile.scale, { x: bsx, y: bsy, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 0.4);
      const thunk = new Graphics();
      thunk.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0xffffff, alpha: 0.55 });
      thunk.roundRect(rr.x + 5, rr.y + 5, rr.w - 10, c0.h - 10, 10).fill({ color: 0xffffff, alpha: 0.3 });
      thunk.blendMode = 'add';
      thunk.alpha = 0;
      ctx.overlay.addChild(thunk);
      const ttl = ctx.track(ctx.gsap.timeline({ delay: 0.26 }));
      ttl.to(thunk, { alpha: 1, duration: 0.04, ease: 'power1.out' }, 0).to(thunk, { alpha: 0, duration: 0.38, ease: 'power2.in' }, 0.05);
      ringBurst(ctx, cc.x, cc.y, Math.max(c0.w, c0.h) * 1.1, ctx.accent, 0.27);
      sparkBurst(ctx, cc.x, cc.y + c0.h * 0.3, ctx.gold, 7, c0.w * 0.9, 0.28);
      ctx.track(ctx.gsap.to(veil, { alpha: 0, duration: 0.4, delay: 0.3, ease: 'power2.out' }));

      await new Promise((r) => setTimeout(r, 1300));
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'colossal-symbol',
    name: 'Colossal Symbol',
    description:
      'A 2x2 colossal premium block slams onto the board from above the screen plane with a shockwave and a unified gold frame.',
    async run(ctx: MechContext): Promise<void> {
      const reel = randInt(ctx, ctx.grid.reels - 1);
      const row = randInt(ctx, ctx.grid.rows - 1);
      const a = ctx.cellRect(reel, row);
      const d = ctx.cellRect(reel + 1, row + 1);
      const bx = a.x;
      const by = a.y;
      const bw = d.x + d.w - a.x;
      const bh = d.y + d.h - a.y;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const sym = ctx.pick([2, 3] as const);

      // Telegraph — the board dims and an accent target frame pulses on the
      // 2x2 landing zone.
      ctx.dimBoard(0.55);
      const target = new Graphics();
      target.roundRect(-bw / 2, -bh / 2, bw, bh, 16).stroke({ color: ctx.accent, width: 3, alpha: 0.9 });
      target.blendMode = 'add';
      target.position.set(cx, cy);
      target.alpha = 0;
      target.scale.set(0.88);
      ctx.overlay.addChild(target);
      const ttl = ctx.track(ctx.gsap.timeline());
      ttl.to(target, { alpha: 0.95, duration: 0.14, ease: 'power2.out' }, 0)
        .to(target.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2.5)' }, 0)
        .to(target, { alpha: 0.35, duration: 0.14, repeat: 2, yoyo: true, ease: 'sine.inOut' }, 0.3)
        .to(target.scale, { x: 1.04, y: 1.04, duration: 0.14, ease: 'power2.out' }, 0.46)
        .to(target, { alpha: 0, duration: 0.12, ease: 'power1.in' }, 0.6);
      await new Promise((r) => setTimeout(r, 650));
      if (!ctx.alive()) return;

      // The block — dark plate (with a subtle top sheen) + unified gold frame.
      // It INHALES upward first (scale 1.55 -> 1.64, anticipation), then slams
      // to 1 with power4.in so it accelerates INTO the board.
      const block = new Container();
      block.position.set(cx, cy);
      const plate = new Graphics();
      plate.roundRect(-bw / 2, -bh / 2, bw, bh, 16).fill({ color: 0x000000, alpha: 0.9 });
      plate.roundRect(-bw / 2, -bh / 2, bw, bh, 16).fill({ color: ctx.gold, alpha: 0.18 });
      plate.roundRect(-bw / 2 + 6, -bh / 2 + 6, bw - 12, bh * 0.18, 12).fill({ color: 0xffffff, alpha: 0.05 });
      const frame = new Graphics();
      frame.roundRect(-bw / 2, -bh / 2, bw, bh, 16).stroke({ color: ctx.gold, width: 6, alpha: 1 });
      frame.roundRect(-bw / 2 + 7, -bh / 2 + 7, bw - 14, bh - 14, 12).stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
      block.addChild(plate, frame);
      block.alpha = 0;
      block.scale.set(1.55);
      ctx.overlay.addChild(block);
      const dtl = ctx.track(ctx.gsap.timeline());
      dtl.to(block, { alpha: 1, duration: 0.1, ease: 'power1.out' }, 0)
        .to(block.scale, { x: 1.64, y: 1.64, duration: 0.12, ease: 'power2.out' }, 0)
        .to(block.scale, { x: 1, y: 1, duration: 0.28, ease: 'power4.in' }, 0.12);
      await new Promise((r) => setTimeout(r, 440));
      if (!ctx.alive()) return;

      // Impact — the four cells become the same premium under the frame, the
      // plate burns off to reveal them; squash-stretch on the block, a held
      // beat, elastic recover, dual shockwave + sparks + impact shake.
      for (let dr = 0; dr < 2; dr++) {
        for (let dw = 0; dw < 2; dw++) {
          ctx.setCellSymbol(reel + dr, row + dw, sym);
          ctx.playCellState(reel + dr, row + dw, 'featured');
        }
      }
      ctx.undimBoard();
      const flash = new Graphics();
      flash.roundRect(bx, by, bw, bh, 16).fill({ color: 0xffffff, alpha: 0.5 });
      flash.roundRect(bx + bw * 0.28, by + bh * 0.28, bw * 0.44, bh * 0.44, 12).fill({ color: 0xffffff, alpha: 0.4 });
      flash.blendMode = 'add';
      ctx.overlay.addChild(flash);
      ctx.track(ctx.gsap.to(flash, { alpha: 0, duration: 0.4, ease: 'power2.in' }));
      ctx.track(ctx.gsap.to(plate, { alpha: 0, duration: 0.3, delay: 0.08, ease: 'power2.in' }));
      const shake = ctx.track(ctx.gsap.timeline());
      shake
        .to(block, { y: cy + 7, duration: 0.05, ease: 'power2.out' }, 0)
        .to(block.scale, { x: 1.05, y: 0.94, duration: 0.06, ease: 'power3.out' }, 0)
        .to(block, { y: cy - 4, duration: 0.06, ease: 'power2.inOut' }, 0.05)
        .to(block, { y: cy, duration: 0.3, ease: 'elastic.out(1, 0.4)' }, 0.11)
        .to(block.scale, { x: 1, y: 1, duration: 0.36, ease: 'elastic.out(1, 0.45)' }, 0.14);
      ringBurst(ctx, cx, cy, Math.hypot(bw, bh) * 0.85, ctx.accent, 0.02);
      ringBurst(ctx, cx, cy, Math.hypot(bw, bh) * 0.55, ctx.gold, 0.1);
      sparkBurst(ctx, cx, cy, ctx.gold, 13, Math.max(bw, bh) * 0.85, 0.03);
      await new Promise((r) => setTimeout(r, 500));
      if (!ctx.alive()) return;

      // Settle — the unified frame pumps twice and stays as a sticky border
      // marking the colossal footprint until the next spin clears it.
      const ptl = ctx.track(ctx.gsap.timeline());
      ptl.to(frame.scale, { x: 1.03, y: 1.03, duration: 0.16, ease: 'back.out(2.5)' }, 0)
        .to(frame.scale, { x: 1, y: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' }, 0.16)
        .to(frame, { alpha: 0.85, duration: 0.25, ease: 'sine.inOut' }, 0.5);
      starPop(ctx, bx + bw * 0.85, by + bh * 0.14, bw * 0.07, ctx.gold, 0.2);
      starPop(ctx, bx + bw * 0.14, by + bh * 0.82, bw * 0.055, 0xffffff, 0.37);
      await new Promise((r) => setTimeout(r, 900));
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'walking-wild',
    name: 'Walking Wild',
    description:
      'A shining WILD lands on the rightmost reel and hops one reel left every beat, leaving fading gold footprints.',
    async run(ctx: MechContext): Promise<void> {
      const midRow = Math.floor(ctx.grid.rows / 2);
      const startReel = ctx.grid.reels - 1;

      // Arrival — the tile pops in with its premium landing beat + a ring.
      const tile = ctx.spawnTile(0, startReel, midRow, true);
      const sc = mid(ctx.cellRect(startReel, midRow));
      ringBurst(ctx, sc.x, sc.y, ctx.cellRect(startReel, midRow).w * 0.95, ctx.gold, 0.12);
      await new Promise((r) => setTimeout(r, 700));
      if (!ctx.alive()) return;
      const bsx = tile.scale.x;
      const bsy = tile.scale.y;

      // The walk — one hop per beat, each beat humanized a few percent:
      // crouch (anticipation squash), stretch into an arced jump with a
      // randomized apex, hard landing squash, a held beat, elastic recover.
      // Departure cells keep footprints that fade AND shrink as they age.
      for (let reel = startReel; reel > 0; reel--) {
        const T = ctx.rand(0.92, 1.08);
        const from = ctx.cellRect(reel, midRow);
        const to = ctx.cellRect(reel - 1, midRow);
        const fc = mid(from);
        const tx = tile.x + (to.x + to.w / 2 - fc.x);
        const ty = tile.y;
        const apex = from.h * ctx.rand(0.48, 0.64);

        // Footprint under the tile at the departure cell — older prints end
        // dimmer and smaller, so the trail decays behind the walker.
        const fp = new Graphics();
        fp.roundRect(-from.w / 2 + 6, -from.h / 2 + 6, from.w - 12, from.h - 12, 10).fill({ color: ctx.gold, alpha: 0.1 });
        fp.roundRect(-from.w / 2 + 10, -from.h / 2 + 10, from.w - 20, from.h - 20, 8).fill({ color: ctx.gold, alpha: 0.18 });
        fp.roundRect(-from.w / 2 + 6, -from.h / 2 + 6, from.w - 12, from.h - 12, 10).stroke({ color: ctx.gold, width: 2, alpha: 0.7 });
        fp.blendMode = 'add';
        fp.position.set(fc.x, fc.y);
        ctx.overlay.addChildAt(fp, 0);
        const fptl = ctx.track(ctx.gsap.timeline());
        fptl.to(fp.scale, { x: 0.86, y: 0.86, duration: 0.85, ease: 'power1.in' }, 0)
          .to(fp, { alpha: 0, duration: 0.72, ease: 'power2.in' }, 0.13);

        // The hop — crouch, launch, arc, slam, hold, recover.
        const hop = ctx.track(ctx.gsap.timeline());
        hop
          .to(tile.scale, { x: bsx * 1.16, y: bsy * 0.8, duration: 0.1 * T, ease: 'power2.out' }, 0)
          .to(tile.scale, { x: bsx * 0.9, y: bsy * 1.14, duration: 0.12 * T, ease: 'power2.in' }, 0.1 * T)
          .to(tile, { x: tx, duration: 0.32 * T, ease: 'power1.inOut' }, 0.1 * T)
          .to(tile, { y: ty - apex, duration: 0.16 * T, ease: 'power2.out' }, 0.1 * T)
          .to(tile, { y: ty, duration: 0.16 * T, ease: 'power3.in' }, 0.26 * T)
          .to(tile.scale, { x: bsx * 1.14, y: bsy * 0.82, duration: 0.07 * T, ease: 'power3.out' }, 0.42 * T)
          .to(tile.scale, { x: bsx, y: bsy, duration: 0.32 * T, ease: 'elastic.out(1, 0.45)' }, 0.55 * T);
        sparkBurst(ctx, to.x + to.w / 2, to.y + to.h * 0.82, ctx.gold, 5, to.w * 0.45, 0.42 * T);
        await new Promise((r) => setTimeout(r, Math.round(620 * T)));
        if (!ctx.alive()) return;
      }

      // Finale on reel 0 — a quick dip (anticipation), victory pump, elastic
      // settle, gold ring + offset star accents.
      const er = ctx.cellRect(0, midRow);
      const ec = mid(er);
      const ftl = ctx.track(ctx.gsap.timeline());
      ftl.to(tile.scale, { x: bsx * 0.92, y: bsy * 0.92, duration: 0.09, ease: 'power2.in' }, 0)
        .to(tile.scale, { x: bsx * 1.22, y: bsy * 1.22, duration: 0.16, ease: 'back.out(3)' }, 0.09)
        .to(tile.scale, { x: bsx, y: bsy, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 0.25);
      ringBurst(ctx, ec.x, ec.y, er.w * 1.15, ctx.gold, 0.13);
      starPop(ctx, ec.x - er.w * 0.3, ec.y - er.h * 0.3, 12, ctx.gold, 0.19);
      starPop(ctx, ec.x + er.w * 0.32, ec.y + er.h * 0.24, 9, 0xffffff, 0.31);
      await new Promise((r) => setTimeout(r, 750));
    },
  },
];
