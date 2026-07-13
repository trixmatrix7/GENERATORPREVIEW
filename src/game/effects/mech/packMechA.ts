// MECH_PACK_A — five slot-mechanic showcases, staged like shipped features:
// every mechanic runs ONE dramatic arc — setup (dim/focus, 0.3-0.5s) -> a
// single dominant payoff -> resolution — with exactly one hero element per
// beat and everything else in support. Heroes are REAL symbol tiles
// (ctx.spawnTile) wherever a symbol is involved. Weight comes from power4.in
// arrivals, hard squash-stretch with a 0.08s held beat on every impact and
// back.out(1.6-2) settles with follow-through. Light is always a layered
// additive stack (wide wash / colour body / hot white core), never a flat
// shape. Timing is humanized through ctx.rand (+-20%, odd counts, no
// lockstep). All display-only: the math never moves; overlays ride the sticky
// lifecycle and every tween goes through ctx.track (ctx.alive() checked after
// every await) so the whole mechanic is cancellable mid-flight.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { MechEntry, MechContext } from '../mechTypes';

type Rect = { x: number; y: number; w: number; h: number };

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function mid(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Integer in [0, n-1] using the mechanic's seeded cosmetic rand. */
function randInt(ctx: MechContext, n: number): number {
  return Math.min(n - 1, Math.floor(ctx.rand(0, n)));
}

/** n distinct cells via a seeded shuffle of the whole board. */
function pickCells(ctx: MechContext, n: number): { reel: number; row: number }[] {
  const all: { reel: number; row: number }[] = [];
  for (let reel = 0; reel < ctx.grid.reels; reel++) {
    for (let row = 0; row < ctx.grid.rows; row++) all.push({ reel, row });
  }
  for (let i = all.length - 1; i > 0; i--) {
    const j = randInt(ctx, i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, Math.min(n, all.length));
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
 *  shrinks as it fades and gets a small gravity droop at the end. Keep the
 *  counts ODD and small — dust is support, never the show. */
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
    .to(g.scale, { x: 1.07, y: 1.07, duration: 0.2, ease: 'back.out(2)' }, 0)
    .to(g.scale, { x: 1, y: 1, duration: 0.14, ease: 'power2.out' }, 0.2)
    .to(g, { alpha: 0, duration: 0.34, ease: 'power2.in' }, 0.3);
}

/** Star glint: counter-rotated wind-up, back.out pop, then exits still
 *  rotating and shrinking so it never just pops off. One per beat, max. */
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
  tl.to(glint.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(2)' }, 0)
    .to(glint, { rotation: spin, duration: 0.55, ease: 'power2.out' }, 0)
    .to(glint.scale, { x: 0.55, y: 0.55, duration: 0.3, ease: 'power2.in' }, 0.26)
    .to(glint, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.28);
}

/** Landing pad — a soft glow that blooms on the target cell a beat BEFORE the
 *  arrival, so the eye is already parked where the impact will land. */
function landingPad(ctx: MechContext, cr: Rect, color: number, delay = 0): void {
  const c = mid(cr);
  const pad = glowDot(color, Math.max(cr.w, cr.h) * 0.55, 0.7);
  pad.position.set(c.x, c.y + cr.h * 0.16);
  pad.alpha = 0;
  pad.scale.set(0.5);
  ctx.overlay.addChild(pad);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(pad, { alpha: 0.75, duration: 0.18, ease: 'power2.in' }, 0)
    .to(pad.scale, { x: 1, y: 1, duration: 0.22, ease: 'power2.in' }, 0)
    .to(pad, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.26);
}

/** Heavyweight arrival. Drops the object from `drop` px above its CURRENT
 *  position: power4.in fall (slight stretch along the motion), hard squash on
 *  impact, a 0.08s HELD beat at full squash, then a back.out(1.8) settle.
 *  Returns the absolute time (s) of the impact so callers can cue the thunk
 *  flash / ring / dust exactly on the hit. The first scale tween overwrites
 *  any spawn pop still running on the target. */
function slamDown(ctx: MechContext, t: Container, drop: number, delay = 0): number {
  const finalY = t.y;
  const fall = 0.32 * ctx.rand(0.95, 1.1);
  t.y = finalY - drop;
  t.scale.set(0.9, 1.02);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  // SFX: whoosh — the fall
  tl.to(t, { y: finalY, duration: fall, ease: 'power4.in' }, 0)
    .to(t.scale, { x: 0.95, y: 1.06, duration: fall * 0.75, ease: 'power2.in', overwrite: true }, 0)
    // SFX: thud — impact
    .to(t.scale, { x: 1.12, y: 0.84, duration: 0.06, ease: 'power3.out' }, fall)
    // (0.08s held beat at full squash — the weight lives in this gap)
    .to(t.scale, { x: 1, y: 1, duration: 0.34, ease: 'back.out(1.8)' }, fall + 0.14);
  return delay + fall;
}

/** Gold '?' mystery plate sized to a cell, centred on (0,0). */
function mysteryPlate(ctx: MechContext, cr: Rect): Container {
  const c = new Container();
  const w = cr.w;
  const h = cr.h;
  const plate = new Graphics();
  plate.roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: 0x000000, alpha: 0.94 });
  plate.roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: ctx.gold, alpha: 0.1 });
  plate.roundRect(-w / 2, -h / 2, w, h, 12).stroke({ color: ctx.gold, width: 3, alpha: 1 });
  plate.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 9).stroke({ color: 0xffffff, width: 1.2, alpha: 0.25 });
  const sheen = new Graphics();
  sheen.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.34, 8).fill({ color: ctx.gold, alpha: 0.14 });
  sheen.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.14, 8).fill({ color: 0xffffff, alpha: 0.05 });
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
      "Gold '?' plates thud onto the board one by one, share a single charged breath, then snap open in a cascade — every plate hiding the same symbol.",
    async run(ctx: MechContext): Promise<void> {
      const count = ctx.pick([3, 5] as const);
      const cells = pickCells(ctx, count);
      const target = ctx.pick([0, 2, 3] as const);

      // SETUP — the board falls back; the stage is set before anything moves.
      // SFX: low riser (board dim)
      ctx.dimBoard(0.42);
      await wait(320);
      if (!ctx.alive()) return;

      // BEAT 1 — the plates ARRIVE with weight: each drops from just above its
      // cell (power4.in), squashes hard, holds a beat, settles with back.out.
      // Staggered and jittered — three thuds, not one stamp.
      const tiles: Container[] = [];
      cells.forEach((cell, i) => {
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = mid(cr);
        const t = mysteryPlate(ctx, cr);
        t.position.set(c.x, c.y);
        t.alpha = 0;
        ctx.overlay.addChild(t);
        tiles.push(t);
        const delay = i * 0.16 + ctx.rand(0, 0.05);
        ctx.track(ctx.gsap.to(t, { alpha: 1, duration: 0.07, delay, ease: 'power1.out' }));
        // SFX: plate thud (one per landing)
        const impactAt = slamDown(ctx, t, cr.h * 0.8, delay);
        sparkBurst(ctx, c.x, c.y + cr.h * 0.32, ctx.gold, 3, cr.w * 0.35, impactAt);
      });
      await wait(700 + count * 170);
      if (!ctx.alive()) return;

      // BEAT 2 — one shared inhale: a gold charge swells under the set, passing
      // through the plates left to right while each squeezes down slightly.
      // This is the anticipation for the flip — nothing else moves.
      // SFX: charge riser (single swell)
      tiles.forEach((t, i) => {
        const cr = ctx.cellRect(cells[i].reel, cells[i].row);
        const c = mid(cr);
        const d = i * 0.09 + ctx.rand(0, 0.03);
        const halo = glowDot(ctx.gold, Math.max(cr.w, cr.h) * 0.6, 0.75);
        halo.position.set(c.x, c.y);
        halo.alpha = 0;
        halo.scale.set(0.7);
        ctx.overlay.addChildAt(halo, 0);
        const tl = ctx.track(ctx.gsap.timeline({ delay: d }));
        tl.to(halo, { alpha: 0.7, duration: 0.2, ease: 'power2.out' }, 0)
          .to(halo.scale, { x: 1.12, y: 1.12, duration: 0.5, ease: 'power2.out' }, 0)
          .to(halo, { alpha: 0, duration: 0.34, ease: 'power2.in' }, 0.32)
          .to(t.scale, { x: 0.965, y: 0.97, duration: 0.3, ease: 'sine.in' }, 0.05);
      });
      await wait(450 + count * 95);
      if (!ctx.alive()) return;

      // BEAT 3 — the PAYOFF: a fast cascade of flips. Each plate widens for a
      // breath, slams shut with power4.in, the real symbol lands underneath,
      // and a slit of light escapes as the plate vanishes. The LAST plate is
      // the hero — bigger ring, one star.
      ctx.undimBoard();
      cells.forEach((cell, i) => {
        const t = tiles[i];
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = mid(cr);
        const hero = i === cells.length - 1;
        const dl = i * 0.12 + ctx.rand(0, 0.04);
        const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
        // SFX: flip snap
        tl.to(t.scale, { x: 1.08, y: 1.01, duration: 0.08, ease: 'power2.out' }, 0)
          .to(t.scale, { x: 0.02, duration: 0.11, ease: 'power4.in' }, 0.08)
          .call(
            () => {
              if (!ctx.alive()) return;
              ctx.setCellSymbol(cell.reel, cell.row, target);
              ctx.playCellState(cell.reel, cell.row, 'featured');
            },
            undefined,
            0.19,
          )
          .to(t, { alpha: 0, duration: 0.06, ease: 'power1.in' }, 0.19);

        // The slit of light that escapes the closing plate — 2-layer, additive.
        const slit = new Graphics();
        slit.roundRect(-cr.w * 0.1, -cr.h / 2, cr.w * 0.2, cr.h, 10).fill({ color: ctx.gold, alpha: 0.2 });
        slit.roundRect(-cr.w * 0.04, -cr.h / 2, cr.w * 0.08, cr.h, 6).fill({ color: 0xffffff, alpha: 0.7 });
        slit.blendMode = 'add';
        slit.position.set(c.x, c.y);
        slit.alpha = 0;
        slit.scale.set(1, 0.92);
        ctx.overlay.addChild(slit);
        const stl = ctx.track(ctx.gsap.timeline({ delay: dl + 0.16 }));
        stl.to(slit, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
          .to(slit.scale, { x: 8, y: 1, duration: 0.16, ease: 'power2.out' }, 0.02)
          .to(slit, { alpha: 0, duration: 0.16, ease: 'power2.in' }, 0.08);

        // SFX: reveal chime (rising through the cascade)
        ringBurst(ctx, c.x, c.y, cr.w * (hero ? 0.95 : 0.6), ctx.gold, dl + 0.2);
        if (hero) starPop(ctx, c.x + cr.w * 0.26, c.y - cr.h * 0.28, cr.w * 0.15, ctx.gold, dl + 0.3);
      });
      await wait(650 + count * 120);
      if (!ctx.alive()) return;

      // RESOLUTION — a settling beat so the revealed set reads as one thing.
      await wait(450);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'symbol-upgrade',
    name: 'Symbol Upgrade',
    description:
      'A premium tile slams into the most central low cell; its shockwave rolls outward and converts every low symbol exactly as the front crosses it.',
    async run(ctx: MechContext): Promise<void> {
      const to = ctx.pick([2, 3] as const);
      const gr = ctx.gridRect();

      // Collect the LOW cells (6-8). Fallback: if the board rolled no lows,
      // bless three shuffled cells so the showcase always lands.
      const marks: { reel: number; row: number }[] = [];
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const s = ctx.getCellSymbol(reel, row);
          if (s >= 6 && s <= 8) marks.push({ reel, row });
        }
      }
      if (marks.length === 0) marks.push(...pickCells(ctx, 3));

      // Epicentre = the marked cell nearest the grid centre (reads intentional).
      const gc = { x: gr.x + gr.w / 2, y: gr.y + gr.h / 2 };
      let epi = marks[0];
      let best = Infinity;
      for (const m of marks) {
        const c = mid(ctx.cellRect(m.reel, m.row));
        const d2 = (c.x - gc.x) * (c.x - gc.x) + (c.y - gc.y) * (c.y - gc.y);
        if (d2 < best) {
          best = d2;
          epi = m;
        }
      }
      const er = ctx.cellRect(epi.reel, epi.row);
      const ec = mid(er);
      const others = marks.filter((m) => m !== epi);
      let maxD = er.w;
      for (const m of others) {
        const c = mid(ctx.cellRect(m.reel, m.row));
        maxD = Math.max(maxD, Math.hypot(c.x - ec.x, c.y - ec.y));
      }

      // SETUP — dim; every low cell breathes ONE faint gold underglow,
      // staggered outward from the epicentre (it foreshadows the wave).
      ctx.dimBoard(0.5);
      // SFX: shimmer
      marks.forEach((m) => {
        const cr = ctx.cellRect(m.reel, m.row);
        const c = mid(cr);
        const dl = (Math.hypot(c.x - ec.x, c.y - ec.y) / maxD) * 0.24 + ctx.rand(0, 0.05);
        const g = glowDot(ctx.gold, cr.w * 0.42, 0.55);
        g.position.set(c.x, c.y);
        g.alpha = 0;
        g.scale.set(0.75);
        ctx.overlay.addChildAt(g, 0);
        const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
        tl.to(g, { alpha: 0.55, duration: 0.2, ease: 'power2.out' }, 0)
          .to(g.scale, { x: 1.06, y: 1.06, duration: 0.42, ease: 'power2.out' }, 0)
          .to(g, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.26);
      });
      await wait(640);
      if (!ctx.alive()) return;

      // HERO ARRIVAL — the real premium tile drops onto the epicentre with
      // full weight: pad glow first, power4.in fall, squash, held beat, settle.
      landingPad(ctx, er, ctx.gold, 0);
      await wait(160);
      if (!ctx.alive()) return;
      const tile = ctx.spawnTile(to, epi.reel, epi.row, true);
      const impactAt = slamDown(ctx, tile, er.h * 1.4);
      ctx.track(
        ctx.gsap.delayedCall(impactAt, () => {
          if (!ctx.alive()) return;
          ctx.setCellSymbol(epi.reel, epi.row, to);
        }),
      );
      // SFX: premium slam
      ringBurst(ctx, ec.x, ec.y, er.w * 1.1, ctx.gold, impactAt + 0.02);
      sparkBurst(ctx, ec.x, ec.y + er.h * 0.35, ctx.gold, 7, er.w * 0.75, impactAt + 0.03);
      await wait(Math.round((impactAt + 0.5) * 1000));
      if (!ctx.alive()) return;

      // THE WAVE — one expanding shockwave (wash / body / white core). Every
      // low cell converts EXACTLY when the visible front crosses it: hit times
      // are the ring's own ease inverted, so the sync IS the design.
      const D = 0.72;
      const R = maxD * 1.18;
      const BASE = 40;
      const wave = new Container();
      wave.position.set(ec.x, ec.y);
      const w1 = new Graphics();
      w1.circle(0, 0, BASE).stroke({ color: ctx.gold, width: 18, alpha: 0.12 });
      w1.blendMode = 'add';
      const w2 = new Graphics();
      w2.circle(0, 0, BASE).stroke({ color: ctx.gold, width: 8, alpha: 0.3 });
      w2.blendMode = 'add';
      const w3 = new Graphics();
      w3.circle(0, 0, BASE).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
      w3.blendMode = 'add';
      wave.addChild(w1, w2, w3);
      wave.scale.set(0.12);
      wave.alpha = 0;
      ctx.overlay.addChild(wave);
      const wtl = ctx.track(ctx.gsap.timeline());
      // SFX: wave rush
      wtl.to(wave, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
        .to(wave.scale, { x: R / BASE, y: R / BASE, duration: D, ease: 'power2.out' }, 0)
        .to(wave, { alpha: 0, duration: D * 0.45, ease: 'power2.in' }, D * 0.6);
      others.forEach((m) => {
        const cr = ctx.cellRect(m.reel, m.row);
        const c = mid(cr);
        // invert power2.out: p = 1-(1-t)^2  =>  t = 1 - sqrt(1-p)
        const p = Math.min(1, Math.hypot(c.x - ec.x, c.y - ec.y) / R);
        const when = D * (1 - Math.sqrt(1 - p)) + ctx.rand(0, 0.04);
        cellFlash(ctx, cr, ctx.gold, Math.max(0, when - 0.04));
        // SFX: chime — pitch climbs with distance from the epicentre
        ctx.track(
          ctx.gsap.delayedCall(when, () => {
            if (!ctx.alive()) return;
            ctx.setCellSymbol(m.reel, m.row, to);
            ctx.playCellState(m.reel, m.row, 'win');
          }),
        );
      });
      ctx.track(
        ctx.gsap.delayedCall(D * 0.55, () => {
          if (ctx.alive()) ctx.undimBoard();
        }),
      );

      // RESOLUTION — the upgraded set breathes; nothing new enters the frame.
      await wait(Math.round(D * 1000) + 750);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'reel-nudge',
    name: 'Reel Nudge',
    description:
      'A gold spotlight frame singles out one reel; a chevron presses it a full cell downward and a real WILD thunks into the vacated top row.',
    async run(ctx: MechContext): Promise<void> {
      const reel = randInt(ctx, ctx.grid.reels);
      const rr = ctx.reelRect(reel);
      const c0 = ctx.cellRect(reel, 0);

      // SETUP — the board dims; a 3-layer gold frame picks the actor.
      // SFX: spotlight on
      ctx.dimBoard(0.5);
      const frame = new Container();
      frame.position.set(rr.x + rr.w / 2, rr.y + rr.h / 2);
      const fg = new Graphics();
      fg.roundRect(-rr.w / 2 - 4, -rr.h / 2 - 4, rr.w + 8, rr.h + 8, 14).stroke({ color: ctx.gold, width: 11, alpha: 0.1 });
      fg.roundRect(-rr.w / 2 - 4, -rr.h / 2 - 4, rr.w + 8, rr.h + 8, 14).stroke({ color: ctx.gold, width: 5, alpha: 0.32 });
      fg.roundRect(-rr.w / 2 - 4, -rr.h / 2 - 4, rr.w + 8, rr.h + 8, 14).stroke({ color: 0xffffff, width: 1.5, alpha: 0.7 });
      fg.blendMode = 'add';
      frame.addChild(fg);
      frame.alpha = 0;
      ctx.overlay.addChild(frame);
      ctx.track(ctx.gsap.to(frame, { alpha: 1, duration: 0.3, ease: 'power2.out' }));
      await wait(420);
      if (!ctx.alive()) return;

      // TELEGRAPH — a layered gold chevron presses down twice, each press
      // shallower than the last (decay, not a metronome).
      const aw = rr.w * 0.38;
      const ay = rr.y - aw * 0.7;
      const arrow = new Container();
      const aGlow = new Graphics();
      aGlow.poly([-aw * 0.6, -aw * 0.08, aw * 0.6, -aw * 0.08, 0, aw * 0.7]).fill({ color: ctx.gold, alpha: 0.14 });
      aGlow.poly([-aw * 0.52, -aw * 0.04, aw * 0.52, -aw * 0.04, 0, aw * 0.62]).fill({ color: ctx.gold, alpha: 0.26 });
      aGlow.blendMode = 'add';
      const aCore = new Graphics();
      aCore.poly([-aw / 2, 0, aw / 2, 0, 0, aw * 0.58]).fill({ color: ctx.gold, alpha: 0.95 });
      aCore.poly([-aw / 2, 0, aw / 2, 0, 0, aw * 0.58]).stroke({ color: 0xffffff, width: 2, alpha: 0.75 });
      arrow.addChild(aGlow, aCore);
      arrow.position.set(rr.x + rr.w / 2, ay);
      arrow.scale.set(0);
      ctx.overlay.addChild(arrow);
      const atl = ctx.track(ctx.gsap.timeline());
      atl.to(arrow.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(2)' }, 0)
        // SFX: tick
        .to(arrow, { y: ay + 14, duration: 0.13, ease: 'power2.inOut' }, 0.26)
        .to(arrow, { y: ay, duration: 0.12, ease: 'power2.inOut' }, 0.39)
        // SFX: tick (softer)
        .to(arrow, { y: ay + 8, duration: 0.11, ease: 'power2.inOut' }, 0.53)
        .to(arrow, { y: ay, duration: 0.11, ease: 'power2.inOut' }, 0.64);
      await wait(800);
      if (!ctx.alive()) return;

      // THE SHOVE — counter-move up, then the reel is rammed one cell down.
      // Three masked motion streaks + a snap flash cover the symbol shift, so
      // it reads as the strip physically moving, not a re-skin.
      const stl = ctx.track(ctx.gsap.timeline());
      stl.to(arrow, { y: ay - 8, duration: 0.1, ease: 'power2.out' }, 0)
        // SFX: ratchet clunk
        .to(arrow, { y: ay + 22, alpha: 0, duration: 0.13, ease: 'power3.in' }, 0.1);
      const maskG = new Graphics();
      maskG.rect(rr.x, rr.y, rr.w, rr.h).fill({ color: 0xffffff });
      ctx.overlay.addChild(maskG);
      const streaks = new Container();
      streaks.mask = maskG;
      ctx.overlay.addChild(streaks);
      for (let i = 0; i < 3; i++) {
        const h = rr.h * ctx.rand(0.38, 0.6);
        const s = new Graphics();
        s.roundRect(-7, -h / 2, 14, h, 7).fill({ color: ctx.gold, alpha: 0.1 });
        s.roundRect(-3, -h / 2, 6, h, 3).fill({ color: 0xffffff, alpha: 0.3 });
        s.blendMode = 'add';
        s.position.set(rr.x + rr.w * (0.25 + 0.25 * i) + ctx.rand(-5, 5), rr.y - h / 2);
        streaks.addChild(s);
        ctx.track(
          ctx.gsap.to(s, {
            y: rr.y + rr.h + h / 2,
            duration: 0.17,
            delay: 0.1 + i * 0.02 + ctx.rand(0, 0.02),
            ease: 'power2.in',
          }),
        );
      }
      const snap = new Graphics();
      snap.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0xffffff, alpha: 0.32 });
      snap.blendMode = 'add';
      snap.alpha = 0;
      ctx.overlay.addChild(snap);
      const ktl = ctx.track(ctx.gsap.timeline({ delay: 0.16 }));
      ktl.to(snap, { alpha: 1, duration: 0.04, ease: 'power1.out' }, 0)
        .to(snap, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.05);
      ctx.track(
        ctx.gsap.delayedCall(0.18, () => {
          if (!ctx.alive()) return;
          for (let row = ctx.grid.rows - 1; row >= 1; row--) {
            ctx.setCellSymbol(reel, row, ctx.getCellSymbol(reel, row - 1));
          }
        }),
      );
      await wait(340);
      if (!ctx.alive()) return;

      // THE WILD — hero beat. Pad glow blooms in the vacated top cell, then the
      // real WILD tile drops with power4.in, squashes hard, holds, settles.
      landingPad(ctx, c0, ctx.accent, 0);
      await wait(160);
      if (!ctx.alive()) return;
      const tile = ctx.spawnTile(0, reel, 0, true);
      const impactAt = slamDown(ctx, tile, c0.h * 1.4);
      ctx.track(
        ctx.gsap.delayedCall(impactAt, () => {
          if (!ctx.alive()) return;
          ctx.setCellSymbol(reel, 0, 0); // board state matches the overlay wild
        }),
      );
      // SFX: heavy wild thunk
      ringBurst(ctx, c0.x + c0.w / 2, c0.y + c0.h / 2, Math.max(c0.w, c0.h) * 1.05, ctx.accent, impactAt + 0.02);
      sparkBurst(ctx, c0.x + c0.w / 2, c0.y + c0.h * 0.8, ctx.gold, 7, c0.w * 0.7, impactAt + 0.03);
      const ptl = ctx.track(ctx.gsap.timeline({ delay: impactAt }));
      ptl.to(frame.scale, { x: 1.02, y: 1.01, duration: 0.09, ease: 'power2.out' }, 0)
        .to(frame.scale, { x: 1, y: 1, duration: 0.26, ease: 'back.out(1.8)' }, 0.09);
      await wait(Math.round((impactAt + 0.6) * 1000));
      if (!ctx.alive()) return;

      // RESOLUTION — lights back up; the spotlight lets go with a slow fade.
      ctx.undimBoard();
      ctx.track(ctx.gsap.to(frame, { alpha: 0, duration: 0.45, ease: 'power2.in', overwrite: true }));
      await wait(650);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'colossal-symbol',
    name: 'Colossal Symbol',
    description:
      'Corner brackets lock a 2x2 zone, then a REAL colossal premium slams in from the screen plane and stays under a unified gold frame.',
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

      // SETUP — the board falls away; four gold corner brackets contract onto
      // the 2x2 landing zone and pulse once. Nothing else moves.
      // SFX: target lock
      ctx.dimBoard(0.55);
      const brackets = new Container();
      brackets.position.set(cx, cy);
      const bg = new Graphics();
      const L = Math.min(bw, bh) * 0.2;
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const px = dx * (bw / 2 + 7);
        const py = dy * (bh / 2 + 7);
        bg.moveTo(px - dx * L, py).lineTo(px, py).lineTo(px, py - dy * L)
          .stroke({ color: ctx.gold, width: 9, alpha: 0.14 });
        bg.moveTo(px - dx * L, py).lineTo(px, py).lineTo(px, py - dy * L)
          .stroke({ color: ctx.gold, width: 3.5, alpha: 0.9 });
      }
      bg.blendMode = 'add';
      brackets.addChild(bg);
      brackets.alpha = 0;
      brackets.scale.set(1.18);
      ctx.overlay.addChild(brackets);
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(brackets, { alpha: 1, duration: 0.16, ease: 'power2.out' }, 0)
        .to(brackets.scale, { x: 1, y: 1, duration: 0.34, ease: 'power3.out' }, 0)
        .to(brackets, { alpha: 0.55, duration: 0.16, ease: 'sine.inOut' }, 0.36)
        .to(brackets, { alpha: 0.95, duration: 0.14, ease: 'sine.inOut' }, 0.52);
      await wait(560);
      if (!ctx.alive()) return;

      // ARRIVAL — the hero is the REAL premium tile at 2x2, wrapped so its
      // spawn pop becomes the materialize inside the descent. It inhales
      // toward the camera first, then slams INTO the board plane (power4.in).
      const wrapper = new Container();
      wrapper.position.set(cx, cy);
      const tile = ctx.spawnTile(sym, reel, row, false);
      wrapper.addChild(tile); // reparent out of the overlay root
      tile.position.set(0, 0);
      const frame = new Graphics();
      frame.roundRect(-a.w / 2 - 1, -a.h / 2 - 1, a.w + 2, a.h + 2, 9).stroke({ color: ctx.gold, width: 3, alpha: 1 });
      frame.roundRect(-a.w / 2 + 3, -a.h / 2 + 3, a.w - 6, a.h - 6, 7).stroke({ color: 0xffffff, width: 1, alpha: 0.55 });
      frame.alpha = 0;
      wrapper.addChild(frame);
      wrapper.alpha = 0;
      const sx = bw / a.w;
      const sy = bh / a.h;
      wrapper.scale.set(sx * 1.55, sy * 1.55);
      ctx.overlay.addChild(wrapper);
      const dtl = ctx.track(ctx.gsap.timeline());
      // SFX: descent whoosh
      dtl.to(wrapper, { alpha: 1, duration: 0.12, ease: 'power1.out' }, 0)
        .to(wrapper.scale, { x: sx * 1.66, y: sy * 1.66, duration: 0.13, ease: 'power2.out' }, 0)
        .to(wrapper.scale, { x: sx, y: sy, duration: 0.3, ease: 'power4.in' }, 0.13);
      await wait(440);
      if (!ctx.alive()) return;

      // IMPACT — squash with a held beat, the unified frame snaps on, ONE
      // shockwave, a short spray of dust, brackets blown outward as
      // follow-through. Board cells re-skin beneath for coherence.
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 2; dc++) ctx.setCellSymbol(reel + dr, row + dc, sym);
      }
      ctx.undimBoard();
      const flash = new Graphics();
      flash.roundRect(bx, by, bw, bh, 16).fill({ color: 0xffffff, alpha: 0.5 });
      flash.blendMode = 'add';
      ctx.overlay.addChild(flash);
      ctx.track(ctx.gsap.to(flash, { alpha: 0, duration: 0.38, ease: 'power2.in' }));
      const itl = ctx.track(ctx.gsap.timeline());
      // SFX: colossal slam
      itl.to(frame, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
        .to(wrapper.scale, { x: sx * 1.06, y: sy * 0.92, duration: 0.06, ease: 'power3.out' }, 0)
        .to(wrapper, { y: cy + 6, duration: 0.06, ease: 'power3.out' }, 0)
        // (0.08s held beat at full squash)
        .to(wrapper.scale, { x: sx, y: sy, duration: 0.4, ease: 'back.out(1.7)' }, 0.14)
        .to(wrapper, { y: cy, duration: 0.34, ease: 'back.out(1.6)' }, 0.14);
      const xtl = ctx.track(ctx.gsap.timeline());
      xtl.to(brackets.scale, { x: 1.16, y: 1.16, duration: 0.22, ease: 'power2.out' }, 0)
        .to(brackets, { alpha: 0, duration: 0.2, ease: 'power2.out' }, 0.02);
      ringBurst(ctx, cx, cy, Math.hypot(bw, bh) * 0.62, ctx.accent, 0.02);
      sparkBurst(ctx, cx, cy + bh * 0.42, ctx.gold, 9, bw * 0.55, 0.04);
      await wait(560);
      if (!ctx.alive()) return;

      // RESOLUTION — the frame pumps once and stays as the colossal's border
      // (sticky until the next spin). One star. Done.
      const rtl = ctx.track(ctx.gsap.timeline());
      rtl.to(frame.scale, { x: 1.035, y: 1.035, duration: 0.14, ease: 'power2.out' }, 0)
        .to(frame.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.8)' }, 0.14)
        .to(frame, { alpha: 0.88, duration: 0.3, ease: 'sine.inOut' }, 0.44);
      starPop(ctx, bx + bw * 0.86, by + bh * 0.12, bw * 0.06, ctx.gold, 0.18);
      await wait(880);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'walking-wild',
    name: 'Walking Wild',
    description:
      'A WILD lands hard on the last reel and walks left one heavy hop per beat — crouch, leap, slam, hold — leaving a single fading footprint each time.',
    async run(ctx: MechContext): Promise<void> {
      const midRow = Math.floor(ctx.grid.rows / 2);
      const startReel = ctx.grid.reels - 1;

      // SETUP — soft dim so the walker owns the frame.
      ctx.dimBoard(0.35);
      await wait(300);
      if (!ctx.alive()) return;

      // ARRIVAL — pad glow, then the real WILD drops in with full weight.
      const sr = ctx.cellRect(startReel, midRow);
      const sc = mid(sr);
      landingPad(ctx, sr, ctx.gold, 0);
      await wait(160);
      if (!ctx.alive()) return;
      const tile = ctx.spawnTile(0, startReel, midRow, false);
      const impactAt = slamDown(ctx, tile, sr.h * 1.3);
      // SFX: wild lands
      ringBurst(ctx, sc.x, sc.y, sr.w * 0.95, ctx.gold, impactAt + 0.02);
      sparkBurst(ctx, sc.x, sc.y + sr.h * 0.35, ctx.gold, 5, sr.w * 0.55, impactAt + 0.03);
      await wait(Math.round((impactAt + 0.55) * 1000));
      if (!ctx.alive()) return;

      // THE WALK — one hop per beat, each beat humanized: crouch (anticipation
      // squash), stretch into an arced leap, power4.in slam, hard squash with a
      // 0.08s held beat, back.out settle. The departure cell keeps ONE simple
      // footprint that fades and shrinks — the trail decays behind the walker.
      for (let reel = startReel; reel > 0; reel--) {
        const T = ctx.rand(0.85, 1.1);
        const from = ctx.cellRect(reel, midRow);
        const to = ctx.cellRect(reel - 1, midRow);
        const fc = mid(from);
        const tx = tile.x + (to.x + to.w / 2 - fc.x);
        const ty = tile.y;
        const apex = from.h * ctx.rand(0.5, 0.68);

        const fp = new Graphics();
        fp.roundRect(-from.w / 2 + 8, -from.h / 2 + 8, from.w - 16, from.h - 16, 10).fill({ color: ctx.gold, alpha: 0.16 });
        fp.roundRect(-from.w / 2 + 8, -from.h / 2 + 8, from.w - 16, from.h - 16, 10).stroke({ color: ctx.gold, width: 2, alpha: 0.55 });
        fp.blendMode = 'add';
        fp.position.set(fc.x, fc.y);
        ctx.overlay.addChildAt(fp, 0);
        const fptl = ctx.track(ctx.gsap.timeline());
        fptl.to(fp.scale, { x: 0.85, y: 0.85, duration: 0.8, ease: 'power1.in' }, 0)
          .to(fp, { alpha: 0, duration: 0.6, ease: 'power2.in' }, 0.2);

        const hop = ctx.track(ctx.gsap.timeline());
        // SFX: crouch
        hop.to(tile.scale, { x: 1.1, y: 0.86, duration: 0.12 * T, ease: 'power2.out', overwrite: true }, 0)
          // SFX: hop launch
          .to(tile.scale, { x: 0.92, y: 1.12, duration: 0.1 * T, ease: 'power2.in' }, 0.12 * T)
          .to(tile, { x: tx, duration: 0.3 * T, ease: 'power1.inOut' }, 0.14 * T)
          .to(tile, { y: ty - apex, duration: 0.15 * T, ease: 'power2.out' }, 0.14 * T)
          .to(tile, { y: ty, duration: 0.15 * T, ease: 'power4.in' }, 0.29 * T)
          // SFX: thump
          .to(tile.scale, { x: 1.14, y: 0.8, duration: 0.06 * T, ease: 'power3.out' }, 0.44 * T)
          // (0.08s held beat at full squash)
          .to(tile.scale, { x: 1, y: 1, duration: 0.3 * T, ease: 'back.out(1.9)' }, 0.5 * T + 0.08);
        sparkBurst(ctx, to.x + to.w / 2, to.y + to.h * 0.82, ctx.gold, 3, to.w * 0.4, 0.44 * T);
        await wait(Math.round(740 * T));
        if (!ctx.alive()) return;
      }

      // FINALE — reel 0: lights up, a quick dip (anticipation), one victory
      // pump with back.out, gold ring, a single star. Then stillness.
      const er = ctx.cellRect(0, midRow);
      const ec = mid(er);
      ctx.undimBoard();
      const ftl = ctx.track(ctx.gsap.timeline());
      // SFX: fanfare hit
      ftl.to(tile.scale, { x: 0.93, y: 0.93, duration: 0.09, ease: 'power2.in', overwrite: true }, 0)
        .to(tile.scale, { x: 1.16, y: 1.16, duration: 0.16, ease: 'back.out(2)' }, 0.09)
        .to(tile.scale, { x: 1, y: 1, duration: 0.42, ease: 'back.out(1.6)' }, 0.25);
      ringBurst(ctx, ec.x, ec.y, er.w * 1.1, ctx.gold, 0.16);
      starPop(ctx, ec.x + er.w * 0.28, ec.y - er.h * 0.3, er.w * 0.13, 0xffffff, 0.26);
      await wait(780);
    },
  },
];
