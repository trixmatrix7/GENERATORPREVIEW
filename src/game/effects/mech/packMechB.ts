// MECH_PACK_B — five mechanic showcases: cascade tumble, wild infection,
// lock & respin, wild storm and twin reels. Every mechanic is OUTCOME-NEUTRAL
// (pure display), theme-agnostic (ctx.accent / ctx.gold / white / black only)
// and grid-relative (all geometry via cellRect/reelRect/gridRect). Overlays
// ride the sticky lifecycle — whatever a mechanic leaves on screen is cleared
// by the next spin. Every tween goes through ctx.track(); every awaited beat
// re-checks ctx.alive() so the whole choreography is cancellable mid-flight.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { MechEntry, MechContext } from '../mechTypes';

type Rect = { x: number; y: number; w: number; h: number };
type Cell = { reel: number; row: number };

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function centreOf(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Soft additive radial glow built from concentric circles (no textures). */
function glowDot(color: number, r: number, intensity = 1): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.14 * intensity });
  g.circle(0, 0, r * 0.62).fill({ color, alpha: 0.28 * intensity });
  g.circle(0, 0, r * 0.3).fill({ color: 0xffffff, alpha: 0.75 * intensity });
  g.blendMode = 'add';
  return g;
}

/** Inclusive integer in [min, max] from the cosmetic rand. */
function randInt(ctx: MechContext, min: number, max: number): number {
  return Math.min(max, Math.floor(ctx.rand(min, max + 1)));
}

/** All board cells in a shuffled order (Fisher-Yates on ctx.rand). */
function shuffledCells(ctx: MechContext): Cell[] {
  const all: Cell[] = [];
  for (let reel = 0; reel < ctx.grid.reels; reel++) {
    for (let row = 0; row < ctx.grid.rows; row++) all.push({ reel, row });
  }
  for (let i = all.length - 1; i > 0; i--) {
    const j = randInt(ctx, 0, i);
    const t = all[i];
    all[i] = all[j];
    all[j] = t;
  }
  return all;
}

/** Additive flash tile snapped to a cell — quick pop then fade. */
function cellFlash(ctx: MechContext, reel: number, row: number, color: number, delay = 0): void {
  const cr = ctx.cellRect(reel, row);
  const c = centreOf(cr);
  const tile = new Graphics();
  tile.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color, alpha: 0.4 });
  tile.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
  tile.blendMode = 'add';
  tile.position.set(c.x, c.y);
  tile.scale.set(0.7);
  tile.alpha = 0;
  ctx.overlay.addChild(tile);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(tile, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
    .to(tile.scale, { x: 1.06, y: 1.06, duration: 0.24, ease: 'back.out(2.6)' }, 0)
    .to(tile, { alpha: 0, duration: 0.32, ease: 'power2.in' }, 0.2);
}

/** Expanding stroked ring (impact / pulse accent). */
function impactRing(
  ctx: MechContext,
  x: number,
  y: number,
  radius: number,
  color: number,
  delay = 0,
  additive = true,
): void {
  const ring = new Graphics();
  ring.circle(0, 0, radius).stroke({ color, width: 3, alpha: 0.85 });
  if (additive) ring.blendMode = 'add';
  ring.position.set(x, y);
  ring.scale.set(0.2);
  ring.alpha = 0;
  ctx.overlay.addChild(ring);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(ring, { alpha: 0.9, duration: 0.05, ease: 'power1.out' }, 0)
    .to(ring.scale, { x: 1.35, y: 1.35, duration: 0.4, ease: 'power3.out' }, 0)
    .to(ring, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.2);
}

const REFILL_IDS: readonly number[] = [2, 3, 4, 5, 6, 7, 8];

/* ------------------------------------------------------------------ */
/* the pack                                                            */
/* ------------------------------------------------------------------ */

export const MECH_PACK_B: readonly MechEntry[] = [
  /* ---------------------------------------------------------------- */
  {
    id: 'cascade-tumble',
    name: 'Cascade Tumble',
    description: 'Random cells explode into shards, go dark, then new symbols drop in from above with a bounce.',
    async run(ctx: MechContext): Promise<void> {
      const cells = shuffledCells(ctx).slice(0, randInt(ctx, 4, 6));
      const darks: Graphics[] = [];

      // Phase 1 — staggered explosions: white flash + shard spray, then the
      // cell visually empties under a dark tile.
      cells.forEach((cell, i) => {
        const cr = ctx.cellRect(cell.reel, cell.row);
        const cc = centreOf(cr);
        const delay = i * 0.09;

        const flash = glowDot(0xffffff, Math.min(cr.w, cr.h) * 0.55, 1.3);
        flash.position.set(cc.x, cc.y);
        flash.scale.set(0.2);
        flash.alpha = 0;
        ctx.overlay.addChild(flash);
        const ftl = ctx.track(ctx.gsap.timeline({ delay }));
        ftl.to(flash, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
          .to(flash.scale, { x: 1.3, y: 1.3, duration: 0.3, ease: 'power4.out' }, 0)
          .to(flash, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.1);

        impactRing(ctx, cc.x, cc.y, Math.min(cr.w, cr.h) * 0.5, ctx.accent, delay + 0.02);

        for (let s = 0; s < 9; s++) {
          const shard = new Graphics();
          const sw = ctx.rand(4, 9);
          const sh = ctx.rand(3, 7);
          shard.rect(-sw / 2, -sh / 2, sw, sh).fill({
            color: ctx.pick([0xffffff, ctx.accent, ctx.gold]),
            alpha: 0.95,
          });
          shard.blendMode = 'add';
          shard.position.set(cc.x, cc.y);
          shard.rotation = ctx.rand(0, Math.PI);
          shard.alpha = 0;
          ctx.overlay.addChild(shard);
          const ang = ctx.rand(0, Math.PI * 2);
          const dist = ctx.rand(cr.w * 0.6, cr.w * 1.4);
          const stl = ctx.track(ctx.gsap.timeline({ delay }));
          stl.to(shard, { alpha: 1, duration: 0.03 }, 0)
            .to(
              shard.position,
              {
                x: cc.x + Math.cos(ang) * dist,
                y: cc.y + Math.sin(ang) * dist + cr.h * 0.35,
                duration: 0.55,
                ease: 'power3.out',
              },
              0,
            )
            .to(shard, { rotation: shard.rotation + ctx.rand(-4, 4), duration: 0.55, ease: 'power2.out' }, 0)
            .to(shard, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.28);
        }

        const dark = new Graphics();
        dark.roundRect(cr.x + 2, cr.y + 2, cr.w - 4, cr.h - 4, 10).fill({ color: 0x000000, alpha: 0.88 });
        dark.roundRect(cr.x + 2, cr.y + 2, cr.w - 4, cr.h - 4, 10).stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
        dark.alpha = 0;
        ctx.overlay.addChild(dark);
        darks.push(dark);
        ctx.track(ctx.gsap.to(dark, { alpha: 1, duration: 0.16, delay: delay + 0.12, ease: 'power2.out' }));
      });

      await wait(950);
      if (!ctx.alive()) return;

      // Phase 2 — new tiles drop from above into the emptied cells and bounce.
      const dropH = ctx.gridRect().h * 0.45 + 60;
      cells.forEach((cell, i) => {
        const delay = i * 0.12;
        const tile = ctx.spawnTile(ctx.pick(REFILL_IDS), cell.reel, cell.row);
        const ty = tile.y;
        tile.y = ty - dropH;
        tile.alpha = 0;
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(tile, { alpha: 1, duration: 0.07, ease: 'power1.out' }, 0)
          .to(tile, { y: ty, duration: 0.58, ease: 'bounce.out' }, 0);

        ctx.track(ctx.gsap.to(darks[i], { alpha: 0, duration: 0.24, delay: delay + 0.3, ease: 'power2.out' }));
        cellFlash(ctx, cell.reel, cell.row, ctx.gold, delay + 0.36);
      });

      await wait(1400);
      if (!ctx.alive()) return;
      cells.forEach((cell, i) => ctx.playCellState(cell.reel, cell.row, i === 0 ? 'win' : 'featured'));
      await wait(500);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'wild-infection',
    name: 'Wild Infection',
    description: 'A glowing WILD spreads gold tendrils to adjacent cells, flipping them into WILDs one by one.',
    async run(ctx: MechContext): Promise<void> {
      const { reels, rows } = ctx.grid;
      const sr = reels >= 3 ? randInt(ctx, 1, reels - 2) : randInt(ctx, 0, reels - 1);
      const sw = rows >= 3 ? randInt(ctx, 1, rows - 2) : randInt(ctx, 0, rows - 1);
      const start = centreOf(ctx.cellRect(sr, sw));

      // Patient zero: a shining WILD with a breathing halo.
      const halo = glowDot(ctx.gold, ctx.cellRect(sr, sw).w * 0.62, 0.9);
      halo.position.set(start.x, start.y);
      halo.alpha = 0;
      ctx.overlay.addChild(halo);
      ctx.track(ctx.gsap.to(halo, { alpha: 1, duration: 0.25, ease: 'power2.out' }));
      ctx.track(
        ctx.gsap.to(halo.scale, { x: 1.18, y: 1.18, duration: 0.5, yoyo: true, repeat: 7, ease: 'sine.inOut' }),
      );
      ctx.spawnTile(0, sr, sw, true);
      impactRing(ctx, start.x, start.y, ctx.cellRect(sr, sw).w * 0.5, ctx.gold, 0.05);

      await wait(550);
      if (!ctx.alive()) return;

      // Collect orthogonal neighbours and infect 3-4 of them, one by one.
      const offs = [
        { dr: 1, dw: 0 },
        { dr: -1, dw: 0 },
        { dr: 0, dw: 1 },
        { dr: 0, dw: -1 },
      ];
      const neigh: Cell[] = [];
      for (const o of offs) {
        const r2 = sr + o.dr;
        const w2 = sw + o.dw;
        if (r2 >= 0 && r2 < reels && w2 >= 0 && w2 < rows) neigh.push({ reel: r2, row: w2 });
      }
      for (let i = neigh.length - 1; i > 0; i--) {
        const j = randInt(ctx, 0, i);
        const t = neigh[i];
        neigh[i] = neigh[j];
        neigh[j] = t;
      }
      const targets = neigh.slice(0, Math.min(neigh.length, randInt(ctx, 3, 4)));

      for (const t of targets) {
        if (!ctx.alive()) return;
        const b = centreOf(ctx.cellRect(t.reel, t.row));
        const dx = b.x - start.x;
        const dy = b.y - start.y;
        const len = Math.hypot(dx, dy) || 1;
        const bulge = len * 0.3 * (ctx.rand(0, 1) > 0.5 ? 1 : -1);
        const mx = (start.x + b.x) / 2 + (-dy / len) * bulge;
        const my = (start.y + b.y) / 2 + (dx / len) * bulge;
        const q = (f: number) => ({
          x: (1 - f) * (1 - f) * start.x + 2 * (1 - f) * f * mx + f * f * b.x,
          y: (1 - f) * (1 - f) * start.y + 2 * (1 - f) * f * my + f * f * b.y,
        });

        // Tendril: curved gold glow stroke + bright white core, quick in/out.
        const tendril = new Container();
        const glowPath = new Graphics();
        const corePath = new Graphics();
        const p0 = q(0);
        glowPath.moveTo(p0.x, p0.y);
        corePath.moveTo(p0.x, p0.y);
        for (let s = 1; s <= 10; s++) {
          const p = q(s / 10);
          glowPath.lineTo(p.x, p.y);
          corePath.lineTo(p.x, p.y);
        }
        glowPath.stroke({ color: ctx.gold, width: 9, alpha: 0.32 });
        glowPath.blendMode = 'add';
        corePath.stroke({ color: 0xffffff, width: 2.4, alpha: 0.95 });
        corePath.blendMode = 'add';
        tendril.addChild(glowPath, corePath);
        tendril.alpha = 0;
        ctx.overlay.addChild(tendril);
        const ttl = ctx.track(ctx.gsap.timeline());
        ttl.to(tendril, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
          .to(tendril, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 0.26);

        // Travelling spark riding the tendril.
        const sp = glowDot(ctx.gold, 11, 1.15);
        sp.position.set(start.x, start.y);
        ctx.overlay.addChild(sp);
        const st = { f: 0 };
        ctx.track(
          ctx.gsap.to(st, {
            f: 1,
            duration: 0.26,
            ease: 'power2.in',
            onUpdate: () => {
              const p = q(st.f);
              sp.position.set(p.x, p.y);
            },
          }),
        );
        ctx.track(ctx.gsap.to(sp, { alpha: 0, duration: 0.16, delay: 0.25, ease: 'power2.in' }));

        await wait(270);
        if (!ctx.alive()) return;

        // Neighbour flips into a WILD with a pop.
        ctx.setCellSymbol(t.reel, t.row, 0);
        ctx.playCellState(t.reel, t.row, 'featured');
        cellFlash(ctx, t.reel, t.row, ctx.gold);
        impactRing(ctx, b.x, b.y, ctx.cellRect(t.reel, t.row).w * 0.48, ctx.gold, 0.03);

        await wait(240);
      }

      if (!ctx.alive()) return;

      // Outbreak complete — one big pulse over the infected cluster.
      impactRing(ctx, start.x, start.y, ctx.cellRect(sr, sw).w * 1.15, ctx.gold);
      ctx.playCellState(sr, sw, 'win');
      await wait(600);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'lock-respin',
    name: 'Lock & Respin',
    description: 'Every cell of one symbol locks under gold frames, the reels respin beneath, then the locks flash off.',
    async run(ctx: MechContext): Promise<void> {
      // Find a symbol worth locking (prefer paying symbols that appear twice+).
      const bySym = new Map<number, Cell[]>();
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const s = ctx.getCellSymbol(reel, row);
          const list = bySym.get(s) ?? [];
          list.push({ reel, row });
          bySym.set(s, list);
        }
      }
      const entries = Array.from(bySym.entries());
      let candidates = entries.filter(([s, c]) => s >= 2 && c.length >= 2);
      if (candidates.length === 0) candidates = entries;
      const chosen = ctx.pick(candidates);
      const sym = chosen[0];
      const locked = chosen[1];

      // Phase 1 — lock frames snap onto every cell of the chosen symbol; the
      // spawned tiles persist visually while the reels roll underneath.
      const lockUi: Container[] = [];
      locked.forEach((cell, i) => {
        ctx.spawnTile(sym, cell.reel, cell.row, false);
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = centreOf(cr);

        const frame = new Container();
        frame.position.set(c.x, c.y);
        const glow = new Graphics();
        glow.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: ctx.gold, width: 9, alpha: 0.3 });
        glow.blendMode = 'add';
        const core = new Graphics();
        core
          .roundRect(-cr.w / 2 + 2, -cr.h / 2 + 2, cr.w - 4, cr.h - 4, 10)
          .stroke({ color: ctx.gold, width: 3, alpha: 0.95 });
        core.blendMode = 'add';
        const plate = new Graphics();
        plate.circle(cr.w / 2 - 14, -cr.h / 2 + 14, 12).fill({ color: 0x000000, alpha: 0.72 });
        plate.circle(cr.w / 2 - 14, -cr.h / 2 + 14, 12).stroke({ color: ctx.gold, width: 2, alpha: 0.95 });
        const glyph = new Text({
          text: '\u{1F512}',
          style: new TextStyle({ fontSize: 13, fill: 0xffffff }),
        });
        glyph.anchor.set(0.5);
        glyph.position.set(cr.w / 2 - 14, -cr.h / 2 + 14);
        frame.addChild(glow, core, plate, glyph);
        frame.alpha = 0;
        frame.scale.set(1.35);
        ctx.overlay.addChild(frame);
        lockUi.push(frame);

        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.07 }));
        tl.to(frame, { alpha: 1, duration: 0.08, ease: 'power1.out' }, 0)
          .to(frame.scale, { x: 1, y: 1, duration: 0.38, ease: 'back.out(2.8)' }, 0);
        cellFlash(ctx, cell.reel, cell.row, ctx.gold, i * 0.07);
      });

      await wait(650);
      if (!ctx.alive()) return;

      // Phase 2 — board dims and the reels respin UNDER the locked tiles.
      ctx.dimBoard(0.55);
      await wait(250);
      if (!ctx.alive()) return;
      await ctx.rollAndSettle();
      if (!ctx.alive()) return;
      ctx.undimBoard();
      locked.forEach((cell) => ctx.setCellSymbol(cell.reel, cell.row, sym));

      await wait(250);
      if (!ctx.alive()) return;

      // Phase 3 — locks flash off: frames punch out bright, glyphs spin away.
      lockUi.forEach((frame, i) => {
        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.06 }));
        tl.to(frame.scale, { x: 1.22, y: 1.22, duration: 0.16, ease: 'back.in(2)' }, 0)
          .to(frame, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.1);
      });
      locked.forEach((cell, i) => {
        cellFlash(ctx, cell.reel, cell.row, 0xffffff, i * 0.06);
        ctx.playCellState(cell.reel, cell.row, 'win');
      });

      await wait(750);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'wild-storm',
    name: 'Wild Storm',
    description: 'Wind streaks sweep the dimmed board, then WILDs crash-land diagonally with impact flashes and dust rings.',
    async run(ctx: MechContext): Promise<void> {
      const gr = ctx.gridRect();
      ctx.dimBoard(0.55);

      // Phase 1 — angled wind streaks tear across the grid.
      for (let i = 0; i < 11; i++) {
        const len = gr.w * ctx.rand(0.35, 0.62);
        const rot = 0.42 + ctx.rand(-0.06, 0.06);
        const streak = new Graphics();
        streak.roundRect(0, -2, len, 4, 2).fill({ color: 0xffffff, alpha: ctx.rand(0.28, 0.6) });
        streak.blendMode = 'add';
        streak.rotation = rot;
        const sx = gr.x - gr.w * ctx.rand(0.3, 0.6);
        const sy = gr.y + gr.h * ctx.rand(-0.2, 0.7);
        streak.position.set(sx, sy);
        streak.alpha = 0;
        ctx.overlay.addChild(streak);
        const travel = gr.w * 1.7;
        const tl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0, 0.5) }));
        tl.to(streak, { alpha: 1, duration: 0.08, ease: 'power1.out' }, 0)
          .to(
            streak.position,
            {
              x: sx + Math.cos(rot) * travel,
              y: sy + Math.sin(rot) * travel,
              duration: ctx.rand(0.5, 0.75),
              ease: 'power2.in',
            },
            0,
          )
          .to(streak, { alpha: 0, duration: 0.2, ease: 'power1.in' }, 0.45);
      }

      await wait(900);
      if (!ctx.alive()) return;

      // Phase 2 — WILD tiles arc in from the top-left and crash-land.
      const spots = shuffledCells(ctx).slice(0, randInt(ctx, 3, 5));
      spots.forEach((cell, i) => {
        const delay = i * 0.28;
        const cr = ctx.cellRect(cell.reel, cell.row);
        const cc = centreOf(cr);

        const tile = ctx.spawnTile(0, cell.reel, cell.row, true);
        const tx = tile.x;
        const ty = tile.y;
        const s0x = tile.scale.x;
        const s0y = tile.scale.y;
        tile.position.set(tx - gr.w * 0.45, ty - gr.h * 0.65);
        tile.scale.set(s0x * 1.55, s0y * 1.55);
        tile.rotation = -0.35;
        tile.alpha = 0;

        const FLIGHT = 0.42;
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(tile, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
          .to(tile, { x: tx, duration: FLIGHT, ease: 'power1.in' }, 0)
          .to(tile, { y: ty, duration: FLIGHT, ease: 'power3.in' }, 0)
          .to(tile.scale, { x: s0x, y: s0y, duration: FLIGHT, ease: 'power2.in' }, 0)
          .to(tile, { rotation: 0.09, duration: FLIGHT, ease: 'power1.in' }, 0)
          .to(tile, { rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.45)' }, FLIGHT);

        // Impact: white flash, dust ring (non-additive haze) and drifting puffs.
        const hitAt = delay + FLIGHT;
        const flash = glowDot(0xffffff, cr.w * 0.5, 1.3);
        flash.position.set(cc.x, cc.y);
        flash.scale.set(0.15);
        flash.alpha = 0;
        ctx.overlay.addChild(flash);
        const htl = ctx.track(ctx.gsap.timeline({ delay: hitAt }));
        htl.to(flash, { alpha: 1, duration: 0.04 }, 0)
          .to(flash.scale, { x: 1.2, y: 1.2, duration: 0.28, ease: 'back.out(2.5)' }, 0)
          .to(flash, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.12);
        impactRing(ctx, cc.x, cc.y + cr.h * 0.28, cr.w * 0.55, 0xffffff, hitAt, false);

        for (let d = 0; d < 6; d++) {
          const puff = new Graphics();
          puff.circle(0, 0, ctx.rand(4, 8)).fill({ color: 0xffffff, alpha: 0.28 });
          puff.position.set(cc.x, cc.y + cr.h * 0.3);
          puff.alpha = 0;
          ctx.overlay.addChild(puff);
          const pa = ctx.rand(Math.PI * 1.05, Math.PI * 1.95);
          const ptl = ctx.track(ctx.gsap.timeline({ delay: hitAt }));
          ptl.to(puff, { alpha: 1, duration: 0.05 }, 0)
            .to(
              puff.position,
              {
                x: cc.x + Math.cos(pa) * cr.w * ctx.rand(0.4, 0.8),
                y: cc.y + cr.h * 0.3 + Math.sin(pa) * cr.h * ctx.rand(0.2, 0.45),
                duration: 0.5,
                ease: 'power2.out',
              },
              0,
            )
            .to(puff, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.25);
        }
      });

      await wait(1900);
      if (!ctx.alive()) return;
      ctx.undimBoard();
      await wait(350);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'twin-reels',
    name: 'Twin Reels',
    description: 'Two adjacent reels link under a glowing border, roll, then the right reel flips to mirror the left.',
    async run(ctx: MechContext): Promise<void> {
      const { reels, rows } = ctx.grid;
      if (reels < 2) return;
      const L = randInt(ctx, 0, reels - 2);
      const R = L + 1;
      const ra = ctx.reelRect(L);
      const rb = ctx.reelRect(R);
      const ux = ra.x - 6;
      const uy = Math.min(ra.y, rb.y) - 6;
      const uw = rb.x + rb.w - ra.x + 12;
      const uh = Math.max(ra.h, rb.h) + 12;
      const gapX = (ra.x + ra.w + rb.x) / 2;

      // Linked glow border around BOTH reels + link nodes top and bottom.
      const border = new Container();
      const bGlow = new Graphics();
      bGlow.roundRect(ux, uy, uw, uh, 14).stroke({ color: ctx.accent, width: 10, alpha: 0.32 });
      bGlow.blendMode = 'add';
      const bCore = new Graphics();
      bCore.roundRect(ux + 2, uy + 2, uw - 4, uh - 4, 12).stroke({ color: ctx.gold, width: 3, alpha: 0.95 });
      bCore.blendMode = 'add';
      border.addChild(bGlow, bCore);
      const nodeTop = glowDot(ctx.gold, 14, 1.1);
      nodeTop.position.set(gapX, uy);
      const nodeBot = glowDot(ctx.gold, 14, 1.1);
      nodeBot.position.set(gapX, uy + uh);
      nodeTop.scale.set(0);
      nodeBot.scale.set(0);
      border.addChild(nodeTop, nodeBot);
      border.alpha = 0;
      ctx.overlay.addChild(border);
      ctx.track(ctx.gsap.to(border, { alpha: 1, duration: 0.28, ease: 'power2.out' }));
      ctx.track(ctx.gsap.to(nodeTop.scale, { x: 1, y: 1, duration: 0.35, delay: 0.1, ease: 'back.out(3)' }));
      ctx.track(ctx.gsap.to(nodeBot.scale, { x: 1, y: 1, duration: 0.35, delay: 0.16, ease: 'back.out(3)' }));
      ctx.track(ctx.gsap.to(bGlow, { alpha: 0.14, duration: 0.45, yoyo: true, repeat: 9, ease: 'sine.inOut' }));

      await wait(500);
      if (!ctx.alive()) return;

      // Roll under the linked border.
      await ctx.rollAndSettle();
      if (!ctx.alive()) return;
      await wait(150);
      if (!ctx.alive()) return;

      // Connecting light band bridges the twin reels while cells sync.
      const band = new Graphics();
      band.rect(gapX - ra.w * 0.28, uy + 4, ra.w * 0.56, uh - 8).fill({ color: 0xffffff, alpha: 0.22 });
      band.rect(gapX - ra.w * 0.07, uy + 4, ra.w * 0.14, uh - 8).fill({ color: ctx.accent, alpha: 0.4 });
      band.blendMode = 'add';
      band.alpha = 0;
      band.pivot.set(gapX, uy + uh / 2);
      band.position.set(gapX, uy + uh / 2);
      band.scale.set(0.1, 1);
      ctx.overlay.addChild(band);
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(band, { alpha: 1, duration: 0.1, ease: 'power1.out' }, 0)
        .to(band.scale, { x: 1, duration: 0.3, ease: 'back.out(2.2)' }, 0)
        .to(band, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.3 + rows * 0.2);

      // Rows sync top-to-bottom: dash of light L→R, right cell flips to mirror.
      for (let row = 0; row < rows; row++) {
        if (!ctx.alive()) return;
        const sym = ctx.getCellSymbol(L, row);
        const ca = centreOf(ctx.cellRect(L, row));
        const cb = centreOf(ctx.cellRect(R, row));
        const crb = ctx.cellRect(R, row);

        const dash = new Graphics();
        dash.roundRect(0, -4, cb.x - ca.x, 8, 4).fill({ color: ctx.gold, alpha: 0.85 });
        dash.blendMode = 'add';
        dash.position.set(ca.x, ca.y);
        dash.scale.set(0, 1);
        ctx.overlay.addChild(dash);
        const dtl = ctx.track(ctx.gsap.timeline());
        dtl.to(dash.scale, { x: 1, duration: 0.12, ease: 'power3.out' }, 0)
          .to(dash, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0.14);

        // Flip: bright tile squashes horizontally, symbol swaps at the pinch.
        const flip = new Graphics();
        flip.roundRect(-crb.w / 2, -crb.h / 2, crb.w, crb.h, 12).fill({ color: 0xffffff, alpha: 0.55 });
        flip.blendMode = 'add';
        flip.position.set(cb.x, cb.y);
        ctx.overlay.addChild(flip);
        const ftl = ctx.track(ctx.gsap.timeline());
        ftl.to(flip.scale, { x: 0.06, duration: 0.11, ease: 'power2.in' }, 0)
          .to(flip.scale, { x: 1, duration: 0.16, ease: 'back.out(2.2)' }, 0.11)
          .to(flip, { alpha: 0, duration: 0.22, ease: 'power2.in' }, 0.3);

        await wait(115);
        if (!ctx.alive()) return;
        ctx.setCellSymbol(R, row, sym);
        ctx.playCellState(R, row, 'featured');
        await wait(90);
      }

      if (!ctx.alive()) return;

      // Twin lockstep confirmed — both columns pulse, border releases.
      for (let row = 0; row < rows; row++) {
        cellFlash(ctx, L, row, ctx.accent, row * 0.04);
        cellFlash(ctx, R, row, ctx.accent, row * 0.04);
        ctx.playCellState(L, row, 'win');
        ctx.playCellState(R, row, 'win');
      }
      ctx.track(ctx.gsap.to(border, { alpha: 0, duration: 0.5, delay: 0.35, ease: 'power2.in' }));
      await wait(850);
    },
  },
];
