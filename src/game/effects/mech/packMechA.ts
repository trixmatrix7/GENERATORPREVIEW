// MECH_PACK_A — five slot-mechanic showcases. Every mechanic is outcome-neutral
// (pure display; the math never moves), theme-agnostic (ctx.accent / ctx.gold),
// grid-relative (all geometry via cellRect/reelRect/gridRect) and rides the
// sticky overlay lifecycle — whatever survives the choreography is cleared by
// the next spin. Each run is 2.5-5s of layered AAA beats: soft additive glow
// underneath, bright cores on top, impulsive easings (back / power3-4 /
// elastic), and every tween registered through ctx.track() so the whole
// mechanic is cancellable mid-flight (ctx.alive() checked after every await).

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

/** Soft additive radial glow built from concentric circles (no textures). */
function glowDot(color: number, r: number, k = 1): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.16 * k });
  g.circle(0, 0, r * 0.6).fill({ color, alpha: 0.3 * k });
  g.circle(0, 0, r * 0.3).fill({ color: 0xffffff, alpha: 0.75 * k });
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

/** Expanding shockwave ring: soft coloured glow band + crisp white core. */
function ringBurst(ctx: MechContext, x: number, y: number, radius: number, color: number, delay = 0): void {
  const BASE = 40;
  const ring = new Container();
  ring.position.set(x, y);
  const glow = new Graphics();
  glow.circle(0, 0, BASE).stroke({ color, width: 10, alpha: 0.4 });
  glow.blendMode = 'add';
  const core = new Graphics();
  core.circle(0, 0, BASE).stroke({ color: 0xffffff, width: 2.5, alpha: 0.9 });
  core.blendMode = 'add';
  ring.addChild(glow, core);
  ring.scale.set(0.12);
  ring.alpha = 0;
  ctx.overlay.addChild(ring);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(ring, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
    .to(ring.scale, { x: radius / BASE, y: radius / BASE, duration: 0.5, ease: 'power3.out' }, 0)
    .to(ring, { alpha: 0, duration: 0.32, ease: 'power2.in' }, 0.22);
}

/** Radial spray of small glow sparks flying out from a point. */
function sparkBurst(ctx: MechContext, x: number, y: number, color: number, n: number, dist: number, delay = 0): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ctx.rand(-0.3, 0.3);
    const s = glowDot(color, ctx.rand(4, 8));
    s.position.set(x, y);
    s.alpha = 0;
    ctx.overlay.addChild(s);
    const d = ctx.rand(dist * 0.55, dist);
    const tl = ctx.track(ctx.gsap.timeline({ delay: delay + ctx.rand(0, 0.06) }));
    tl.to(s, { alpha: 1, duration: 0.05 }, 0)
      .to(s.position, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, duration: 0.6, ease: 'power4.out' }, 0)
      .to(s, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 0.3);
  }
}

/** Additive cell-sized flash tile that pops with a back.out punch and fades. */
function cellFlash(ctx: MechContext, cr: Rect, color: number, delay = 0): void {
  const c = mid(cr);
  const g = new Graphics();
  g.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color: 0xffffff, alpha: 0.3 });
  g.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color, width: 3, alpha: 0.9 });
  g.blendMode = 'add';
  g.position.set(c.x, c.y);
  g.alpha = 0;
  g.scale.set(0.7);
  ctx.overlay.addChild(g);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(g, { alpha: 1, duration: 0.07, ease: 'power2.out' }, 0)
    .to(g.scale, { x: 1.06, y: 1.06, duration: 0.24, ease: 'back.out(2.8)' }, 0)
    .to(g, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 0.3);
}

/** Star glint that pops with rotation, used as an upgrade/landing accent. */
function starPop(ctx: MechContext, x: number, y: number, size: number, color: number, delay = 0): void {
  const glint = new Container();
  const halo = glowDot(0xffffff, size * 1.5, 0.7);
  const star = new Graphics();
  star.poly(starPts(size, size * 0.36)).fill({ color, alpha: 0.95 });
  star.poly(starPts(size, size * 0.36)).stroke({ color: 0xffffff, width: 1.4, alpha: 0.8 });
  star.blendMode = 'add';
  glint.addChild(halo, star);
  glint.position.set(x, y);
  glint.scale.set(0);
  ctx.overlay.addChild(glint);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(glint.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(3)' }, 0)
    .to(glint, { rotation: ctx.rand(0.6, 1.3), duration: 0.5, ease: 'power2.out' }, 0)
    .to(glint, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.26);
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
  sheen.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.38, 8).fill({ color: ctx.gold, alpha: 0.18 });
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

      // Phase 1 — plates pop in with a back.out punch + soft glow underneath.
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
        ctx.overlay.addChild(t);
        tiles.push(t);
        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.09 }));
        tl.to(t.scale, { x: 1, y: 1, duration: 0.38, ease: 'back.out(2.6)' }, 0)
          .to(halo, { alpha: 0.9, duration: 0.16, ease: 'power2.out' }, 0.04)
          .to(halo, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.3);
      });
      await new Promise((r) => setTimeout(r, 900));
      if (!ctx.alive()) return;

      // Phase 2 — anticipation tremble: rotation jitter + a nervous squeeze.
      tiles.forEach((t, i) => {
        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.03 }));
        tl.to(t, { rotation: -0.06, duration: 0.05, ease: 'sine.inOut' }, 0)
          .to(t, { rotation: 0.06, duration: 0.09, repeat: 5, yoyo: true, ease: 'sine.inOut' }, 0.05)
          .to(t, { rotation: 0, duration: 0.06, ease: 'sine.out' }, 0.59)
          .to(t.scale, { x: 0.94, y: 0.94, duration: 0.3, ease: 'sine.inOut' }, 0.1)
          .to(t.scale, { x: 1.05, y: 1.05, duration: 0.25, ease: 'back.out(2)' }, 0.4);
      });
      await new Promise((r) => setTimeout(r, 800));
      if (!ctx.alive()) return;

      // Phase 3 — the synced flip: scaleX 1->0, re-skin the board cell under
      // the plate, then 0->1 while the plate fades to hand off to the cell.
      cells.forEach((cell, i) => {
        const t = tiles[i];
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = mid(cr);
        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.07 }));
        tl.to(t.scale, { x: 0, duration: 0.16, ease: 'power2.in' }, 0)
          .call(
            () => {
              if (!ctx.alive()) return;
              ctx.setCellSymbol(cell.reel, cell.row, target);
              ctx.playCellState(cell.reel, cell.row, 'featured');
            },
            undefined,
            0.16,
          )
          .to(t.scale, { x: 1, duration: 0.22, ease: 'back.out(2.2)' }, 0.18)
          .to(t, { alpha: 0, duration: 0.2, ease: 'power1.in' }, 0.26);
        ringBurst(ctx, c.x, c.y, Math.max(cr.w, cr.h) * 0.75, ctx.gold, i * 0.07 + 0.18);
        starPop(ctx, c.x + cr.w * 0.26, c.y - cr.h * 0.26, cr.w * 0.14, ctx.gold, i * 0.07 + 0.24);
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
      await new Promise((r) => setTimeout(r, 250));
      if (!ctx.alive()) return;

      // The sweep band: wide soft wash, gold body, razor white core. Linear
      // travel so the per-cell hit times line up exactly with the front.
      const bandW = gr.w * 0.16;
      const startX = gr.x - bandW * 1.5;
      const endX = gr.x + gr.w + bandW * 1.5;
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
      ctx.track(ctx.gsap.to(band.position, { x: endX, duration: dur, ease: 'none' }));
      ctx.track(ctx.gsap.to(band, { alpha: 0, duration: 0.22, delay: dur - 0.18, ease: 'power1.in' }));

      // Each marked cell upgrades exactly when the band front crosses it:
      // white flash pop + re-skin to the premium + spark star + win state.
      marks.forEach((m) => {
        const cr = ctx.cellRect(m.reel, m.row);
        const c = mid(cr);
        const when = ((c.x - startX) / (endX - startX)) * dur;
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
        starPop(ctx, c.x, c.y - cr.h * 0.2, cr.w * 0.16, ctx.gold, Math.max(0, when + 0.06));
        sparkBurst(ctx, c.x, c.y, ctx.gold, 5, cr.w * 0.7, Math.max(0, when + 0.04));
      });

      await new Promise((r) => setTimeout(r, dur * 1000 + 150));
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

      // Telegraph — dark veil over the reel + a bobbing down-arrow above it.
      const veil = new Graphics();
      veil.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0x000000, alpha: 1 });
      veil.alpha = 0;
      ctx.overlay.addChild(veil);
      ctx.track(ctx.gsap.to(veil, { alpha: 0.5, duration: 0.28, ease: 'power2.out' }));

      const aw = rr.w * 0.4;
      const arrow = new Container();
      arrow.position.set(rr.x + rr.w / 2, rr.y - aw * 0.75);
      const aGlow = new Graphics();
      aGlow.poly([-aw * 0.62, -aw * 0.1, aw * 0.62, -aw * 0.1, 0, aw * 0.72]).fill({ color: ctx.gold, alpha: 0.35 });
      aGlow.blendMode = 'add';
      const aCore = new Graphics();
      aCore.poly([-aw / 2, 0, aw / 2, 0, 0, aw * 0.6]).fill({ color: ctx.gold, alpha: 0.95 });
      aCore.poly([-aw / 2, 0, aw / 2, 0, 0, aw * 0.6]).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
      arrow.addChild(aGlow, aCore);
      arrow.scale.set(0);
      ctx.overlay.addChild(arrow);
      const atl = ctx.track(ctx.gsap.timeline());
      atl.to(arrow.scale, { x: 1, y: 1, duration: 0.24, ease: 'back.out(3)' }, 0)
        .to(arrow, { y: arrow.y + 14, duration: 0.16, repeat: 3, yoyo: true, ease: 'power2.inOut' }, 0.2);
      await new Promise((r) => setTimeout(r, 700));
      if (!ctx.alive()) return;

      // The nudge — a masked ghost-tile strip slides one full cell down over
      // the darkened reel, selling the shift.
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
        ghost.blendMode = 'add';
        strip.addChild(ghost);
      }
      ctx.overlay.addChild(strip);
      ctx.track(ctx.gsap.to(strip, { y: pitch, duration: 0.42, ease: 'power3.in' }));
      await new Promise((r) => setTimeout(r, 450));
      if (!ctx.alive()) return;

      // Commit the illusion: shift the underlying symbols one row down while
      // a white snap-flash covers the swap, then drop the strip.
      for (let row = ctx.grid.rows - 1; row >= 1; row--) {
        ctx.setCellSymbol(reel, row, ctx.getCellSymbol(reel, row - 1));
      }
      const snap = new Graphics();
      snap.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0xffffff, alpha: 0.5 });
      snap.blendMode = 'add';
      ctx.overlay.addChild(snap);
      ctx.track(ctx.gsap.to(snap, { alpha: 0, duration: 0.3, ease: 'power2.out' }));
      ctx.track(ctx.gsap.to(strip, { alpha: 0, duration: 0.2, ease: 'power1.in' }));
      ctx.track(ctx.gsap.to(arrow, { alpha: 0, duration: 0.2, ease: 'power1.in' }));
      await new Promise((r) => setTimeout(r, 180));
      if (!ctx.alive()) return;

      // The WILD lands in the vacated top row — dropped from above with a
      // power4.in slam, thunk flash, shockwave and a squash-stretch settle.
      const tile = ctx.spawnTile(0, reel, 0, true);
      const ty = tile.y;
      const bsx = tile.scale.x;
      const bsy = tile.scale.y;
      tile.y = ty - c0.h * 1.35;
      const dtl = ctx.track(ctx.gsap.timeline());
      dtl.to(tile, { y: ty, duration: 0.26, ease: 'power4.in' }, 0)
        .to(tile.scale, { x: bsx * 1.14, y: bsy * 0.8, duration: 0.08, ease: 'power3.out' }, 0.26)
        .to(tile.scale, { x: bsx, y: bsy, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 0.34);
      const cc = mid(c0);
      const thunk = new Graphics();
      thunk.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0xffffff, alpha: 0.6 });
      thunk.blendMode = 'add';
      thunk.alpha = 0;
      ctx.overlay.addChild(thunk);
      const ttl = ctx.track(ctx.gsap.timeline({ delay: 0.26 }));
      ttl.to(thunk, { alpha: 1, duration: 0.04, ease: 'power1.out' }, 0).to(thunk, { alpha: 0, duration: 0.38, ease: 'power2.out' }, 0.05);
      ringBurst(ctx, cc.x, cc.y, Math.max(c0.w, c0.h) * 1.1, ctx.accent, 0.27);
      sparkBurst(ctx, cc.x, cc.y + c0.h * 0.3, ctx.gold, 8, c0.w * 0.9, 0.28);
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
        .to(target, { alpha: 0, duration: 0.12, ease: 'power1.in' }, 0.6);
      await new Promise((r) => setTimeout(r, 650));
      if (!ctx.alive()) return;

      // The block — dark plate + unified gold frame, dropping in from
      // scale 1.6 with power4.in so it accelerates INTO the board.
      const block = new Container();
      block.position.set(cx, cy);
      const plate = new Graphics();
      plate.roundRect(-bw / 2, -bh / 2, bw, bh, 16).fill({ color: 0x000000, alpha: 0.9 });
      plate.roundRect(-bw / 2, -bh / 2, bw, bh, 16).fill({ color: ctx.gold, alpha: 0.2 });
      const frame = new Graphics();
      frame.roundRect(-bw / 2, -bh / 2, bw, bh, 16).stroke({ color: ctx.gold, width: 6, alpha: 1 });
      frame.roundRect(-bw / 2 + 7, -bh / 2 + 7, bw - 14, bh - 14, 12).stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
      block.addChild(plate, frame);
      block.alpha = 0;
      block.scale.set(1.6);
      ctx.overlay.addChild(block);
      const dtl = ctx.track(ctx.gsap.timeline());
      dtl.to(block, { alpha: 1, duration: 0.1, ease: 'power1.out' }, 0)
        .to(block.scale, { x: 1, y: 1, duration: 0.3, ease: 'power4.in' }, 0);
      await new Promise((r) => setTimeout(r, 420));
      if (!ctx.alive()) return;

      // Impact — the four cells become the same premium under the frame, the
      // plate burns off to reveal them, shockwave + sparks + impact shake.
      for (let dr = 0; dr < 2; dr++) {
        for (let dw = 0; dw < 2; dw++) {
          ctx.setCellSymbol(reel + dr, row + dw, sym);
          ctx.playCellState(reel + dr, row + dw, 'featured');
        }
      }
      ctx.undimBoard();
      const flash = new Graphics();
      flash.roundRect(bx, by, bw, bh, 16).fill({ color: 0xffffff, alpha: 0.75 });
      flash.blendMode = 'add';
      ctx.overlay.addChild(flash);
      ctx.track(ctx.gsap.to(flash, { alpha: 0, duration: 0.4, ease: 'power2.out' }));
      ctx.track(ctx.gsap.to(plate, { alpha: 0, duration: 0.3, delay: 0.08, ease: 'power2.in' }));
      const shake = ctx.track(ctx.gsap.timeline());
      shake
        .to(block, { y: cy + 7, duration: 0.05, ease: 'power2.out' }, 0)
        .to(block, { y: cy - 4, duration: 0.06, ease: 'power2.inOut' }, 0.05)
        .to(block, { y: cy, duration: 0.3, ease: 'elastic.out(1, 0.4)' }, 0.11);
      ringBurst(ctx, cx, cy, Math.hypot(bw, bh) * 0.85, ctx.accent, 0.02);
      ringBurst(ctx, cx, cy, Math.hypot(bw, bh) * 0.55, ctx.gold, 0.1);
      sparkBurst(ctx, cx, cy, ctx.gold, 12, Math.max(bw, bh) * 0.85, 0.03);
      await new Promise((r) => setTimeout(r, 500));
      if (!ctx.alive()) return;

      // Settle — the unified frame pumps twice and stays as a sticky border
      // marking the colossal footprint until the next spin clears it.
      const ptl = ctx.track(ctx.gsap.timeline());
      ptl.to(frame.scale, { x: 1.03, y: 1.03, duration: 0.16, ease: 'back.out(2.5)' }, 0)
        .to(frame.scale, { x: 1, y: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' }, 0.16)
        .to(frame, { alpha: 0.85, duration: 0.25, ease: 'sine.inOut' }, 0.5);
      starPop(ctx, bx + bw * 0.85, by + bh * 0.14, bw * 0.07, ctx.gold, 0.2);
      starPop(ctx, bx + bw * 0.14, by + bh * 0.82, bw * 0.055, 0xffffff, 0.34);
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

      // The walk — one hop per 0.6s beat: anticipation squash, stretch into
      // an arced jump, landing squash, elastic recover; each departure cell
      // keeps a fading gold footprint.
      for (let reel = startReel; reel > 0; reel--) {
        const from = ctx.cellRect(reel, midRow);
        const to = ctx.cellRect(reel - 1, midRow);
        const fc = mid(from);
        const tx = tile.x + (to.x + to.w / 2 - fc.x);
        const ty = tile.y;

        // Footprint under the tile at the departure cell.
        const fp = new Graphics();
        fp.roundRect(-from.w / 2 + 6, -from.h / 2 + 6, from.w - 12, from.h - 12, 10).fill({ color: ctx.gold, alpha: 0.26 });
        fp.roundRect(-from.w / 2 + 6, -from.h / 2 + 6, from.w - 12, from.h - 12, 10).stroke({ color: ctx.gold, width: 2, alpha: 0.8 });
        fp.blendMode = 'add';
        fp.position.set(fc.x, fc.y);
        ctx.overlay.addChildAt(fp, 0);
        const fptl = ctx.track(ctx.gsap.timeline());
        fptl.to(fp.scale, { x: 1.08, y: 1.08, duration: 0.7, ease: 'power1.out' }, 0)
          .to(fp, { alpha: 0, duration: 0.7, ease: 'power2.in' }, 0.15);

        // The hop.
        const hop = ctx.track(ctx.gsap.timeline());
        hop
          .to(tile.scale, { x: bsx * 1.16, y: bsy * 0.8, duration: 0.1, ease: 'power2.out' }, 0)
          .to(tile.scale, { x: bsx * 0.9, y: bsy * 1.14, duration: 0.12, ease: 'power2.in' }, 0.1)
          .to(tile, { x: tx, duration: 0.32, ease: 'power1.inOut' }, 0.1)
          .to(tile, { y: ty - from.h * 0.55, duration: 0.16, ease: 'power2.out' }, 0.1)
          .to(tile, { y: ty, duration: 0.16, ease: 'power2.in' }, 0.26)
          .to(tile.scale, { x: bsx * 1.14, y: bsy * 0.82, duration: 0.07, ease: 'power3.out' }, 0.42)
          .to(tile.scale, { x: bsx, y: bsy, duration: 0.32, ease: 'elastic.out(1, 0.45)' }, 0.49);
        sparkBurst(ctx, to.x + to.w / 2, to.y + to.h * 0.82, ctx.gold, 4, to.w * 0.45, 0.42);
        await new Promise((r) => setTimeout(r, 600));
        if (!ctx.alive()) return;
      }

      // Finale on reel 0 — victory pump + gold ring + star accents.
      const ec = mid(ctx.cellRect(0, midRow));
      const ftl = ctx.track(ctx.gsap.timeline());
      ftl.to(tile.scale, { x: bsx * 1.22, y: bsy * 1.22, duration: 0.16, ease: 'back.out(3)' }, 0)
        .to(tile.scale, { x: bsx, y: bsy, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 0.16);
      ringBurst(ctx, ec.x, ec.y, ctx.cellRect(0, midRow).w * 1.15, ctx.gold, 0.06);
      starPop(ctx, ec.x - ctx.cellRect(0, midRow).w * 0.3, ec.y - ctx.cellRect(0, midRow).h * 0.3, 12, ctx.gold, 0.12);
      starPop(ctx, ec.x + ctx.cellRect(0, midRow).w * 0.32, ec.y + ctx.cellRect(0, midRow).h * 0.24, 9, 0xffffff, 0.22);
      await new Promise((r) => setTimeout(r, 700));
    },
  },
];
