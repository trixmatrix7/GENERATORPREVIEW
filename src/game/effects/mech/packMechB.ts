// MECH_PACK_B — five mechanic showcases: cascade tumble, wild infection,
// lock & respin, wild storm and twin reels. Every mechanic is OUTCOME-NEUTRAL
// (pure display), theme-agnostic (ctx.accent / ctx.gold / white / black only)
// and grid-relative (all geometry via cellRect/reelRect/gridRect). Overlays
// ride the sticky lifecycle — whatever a mechanic leaves on screen is cleared
// by the next spin. Every tween goes through ctx.track(); every awaited beat
// re-checks ctx.alive() so the whole choreography is cancellable mid-flight.
//
// Animation grammar used throughout (AAA pass):
//   anticipation  — every impact gets a 0.08-0.14s counter-move first
//   weight        — power3/4.in arrivals, squash-stretch, hold, back.out settle
//   layered light — wide soft halo + mid core + small hot white centre
//   jitter        — staggers/particles get ±15-30% randomness, odd counts
//   falloff       — alpha/scale on power curves, trails decay progressively
//   exits         — fast fade + scale/direction continuation, nothing pops off

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

/** ±spread multiplicative jitter on a base value (timing/param humaniser). */
function jit(ctx: MechContext, base: number, spread = 0.22): number {
  return base * (1 + ctx.rand(-spread, spread));
}

/** Soft additive radial glow — 4 layers: wide halo, mid, inner, hot core. */
function glowDot(color: number, r: number, intensity = 1): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.12 * intensity });
  g.circle(0, 0, r * 0.66).fill({ color, alpha: 0.3 * intensity });
  g.circle(0, 0, r * 0.42).fill({ color, alpha: 0.42 * intensity });
  g.circle(0, 0, r * 0.2).fill({ color: 0xffffff, alpha: 0.82 * intensity });
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

/** Layered flash tile snapped to a cell — tiny inhale, pop, fade-and-grow exit. */
function cellFlash(ctx: MechContext, reel: number, row: number, color: number, delay = 0): void {
  const cr = ctx.cellRect(reel, row);
  const c = centreOf(cr);
  const tile = new Container();
  const halo = new Graphics();
  halo.roundRect(-cr.w / 2 - 7, -cr.h / 2 - 7, cr.w + 14, cr.h + 14, 16).fill({ color, alpha: 0.13 });
  halo.blendMode = 'add';
  const body = new Graphics();
  body.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color, alpha: 0.3 });
  body.blendMode = 'add';
  const rim = new Graphics();
  rim.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: 0xffffff, width: 2, alpha: 0.75 });
  rim.blendMode = 'add';
  const core = new Graphics();
  core.roundRect(-cr.w * 0.28, -cr.h * 0.28, cr.w * 0.56, cr.h * 0.56, 10).fill({ color: 0xffffff, alpha: 0.34 });
  core.blendMode = 'add';
  tile.addChild(halo, body, core, rim);
  tile.position.set(c.x, c.y);
  tile.scale.set(0.85);
  tile.alpha = 0;
  ctx.overlay.addChild(tile);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(tile, { alpha: 0.55, duration: 0.05, ease: 'power1.out' }, 0)
    .to(tile.scale, { x: 0.8, y: 0.8, duration: 0.05, ease: 'power2.in' }, 0) // inhale
    .to(tile, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0.05)
    .to(tile.scale, { x: 1.05, y: 1.05, duration: 0.26, ease: 'back.out(2.1)' }, 0.05)
    .to(tile, { alpha: 0, duration: 0.32, ease: 'power2.in' }, 0.26)
    .to(tile.scale, { x: 1.12, y: 1.12, duration: 0.32, ease: 'power1.out' }, 0.26); // exit continuation
}

/** Expanding stroked ring + fainter trailing echo (impact / pulse accent). */
function impactRing(
  ctx: MechContext,
  x: number,
  y: number,
  radius: number,
  color: number,
  delay = 0,
  additive = true,
): void {
  const make = (width: number, alpha: number) => {
    const ring = new Graphics();
    ring.circle(0, 0, radius).stroke({ color, width, alpha });
    if (additive) ring.blendMode = 'add';
    ring.position.set(x, y);
    ring.scale.set(0.2);
    ring.alpha = 0;
    ctx.overlay.addChild(ring);
    return ring;
  };
  const lead = make(3, 0.8);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(lead, { alpha: 0.9, duration: 0.05, ease: 'power1.out' }, 0)
    .to(lead.scale, { x: 1.35, y: 1.35, duration: 0.42, ease: 'power3.out' }, 0)
    .to(lead, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.18);
  // echo — dimmer, thinner, a beat behind (follow-through)
  const echo = make(1.5, 0.4);
  const etl = ctx.track(ctx.gsap.timeline({ delay: delay + 0.09 }));
  etl.to(echo, { alpha: 0.45, duration: 0.05, ease: 'power1.out' }, 0)
    .to(echo.scale, { x: 1.18, y: 1.18, duration: 0.4, ease: 'power2.out' }, 0)
    .to(echo, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.14);
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

      // Phase 1 — each cell CHARGES (glow contracts inward, anticipation),
      // then bursts: layered flash + shard spray, cell empties under a dark tile.
      cells.forEach((cell, i) => {
        const cr = ctx.cellRect(cell.reel, cell.row);
        const cc = centreOf(cr);
        const delay = Math.max(0, i * 0.09 + ctx.rand(-0.025, 0.025));
        const CHARGE = 0.12;
        const boom = delay + CHARGE;

        // anticipation — a soft accent glow inhales toward the centre
        const charge = glowDot(ctx.accent, Math.min(cr.w, cr.h) * 0.62, 0.7);
        charge.position.set(cc.x, cc.y);
        charge.scale.set(1.2);
        charge.alpha = 0;
        ctx.overlay.addChild(charge);
        const ctl = ctx.track(ctx.gsap.timeline({ delay }));
        ctl.to(charge, { alpha: 0.9, duration: CHARGE * 0.6, ease: 'power1.out' }, 0)
          .to(charge.scale, { x: 0.3, y: 0.3, duration: CHARGE, ease: 'power2.in' }, 0)
          .to(charge, { alpha: 0, duration: 0.05, ease: 'power1.in' }, CHARGE);

        // burst — layered white flash
        const flash = glowDot(0xffffff, Math.min(cr.w, cr.h) * 0.55, 1.3);
        flash.position.set(cc.x, cc.y);
        flash.scale.set(0.2);
        flash.alpha = 0;
        ctx.overlay.addChild(flash);
        const ftl = ctx.track(ctx.gsap.timeline({ delay: boom }));
        ftl.to(flash, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
          .to(flash.scale, { x: 1.3, y: 1.3, duration: 0.3, ease: 'power4.out' }, 0)
          .to(flash, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.1);

        impactRing(ctx, cc.x, cc.y, Math.min(cr.w, cr.h) * 0.5, ctx.accent, boom + 0.02);

        // shards — odd jittered count, arc out under gravity, shrink as they fade
        const shardCount = ctx.pick([7, 9, 11] as const);
        for (let s = 0; s < shardCount; s++) {
          const shard = new Graphics();
          const sw = ctx.rand(4, 9);
          const sh = ctx.rand(3, 7);
          shard.rect(-sw / 2, -sh / 2, sw, sh).fill({
            color: ctx.pick([0xffffff, ctx.accent, ctx.gold]),
            alpha: 0.9,
          });
          shard.blendMode = 'add';
          shard.position.set(cc.x, cc.y);
          shard.rotation = ctx.rand(0, Math.PI);
          shard.alpha = 0;
          ctx.overlay.addChild(shard);
          const ang = ctx.rand(0, Math.PI * 2);
          const dist = ctx.rand(cr.w * 0.55, cr.w * 1.45);
          const life = jit(ctx, 0.55, 0.25);
          const stl = ctx.track(ctx.gsap.timeline({ delay: boom + ctx.rand(0, 0.03) }));
          stl.to(shard, { alpha: 1, duration: 0.03 }, 0)
            .to(shard.position, { x: cc.x + Math.cos(ang) * dist, duration: life, ease: 'power3.out' }, 0)
            .to(shard.position, { y: cc.y + Math.sin(ang) * dist * 0.7, duration: life * 0.5, ease: 'power2.out' }, 0)
            .to(shard.position, { y: `+=${cr.h * ctx.rand(0.35, 0.6)}`, duration: life * 0.55, ease: 'power2.in' }, life * 0.5)
            .to(shard, { rotation: shard.rotation + ctx.rand(-4, 4), duration: life, ease: 'power2.out' }, 0)
            .to(shard.scale, { x: 0.4, y: 0.4, duration: life * 0.6, ease: 'power2.in' }, life * 0.45)
            .to(shard, { alpha: 0, duration: life * 0.55, ease: 'power2.in' }, life * 0.5);
        }

        // emptied cell — near-black tile with a faint top sheen so it reads as depth
        const dark = new Graphics();
        dark.roundRect(cr.x + 2, cr.y + 2, cr.w - 4, cr.h - 4, 10).fill({ color: 0x000000, alpha: 0.88 });
        dark.roundRect(cr.x + 4, cr.y + 4, cr.w - 8, cr.h * 0.14, 8).fill({ color: 0xffffff, alpha: 0.05 });
        dark.roundRect(cr.x + 2, cr.y + 2, cr.w - 4, cr.h - 4, 10).stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
        dark.alpha = 0;
        ctx.overlay.addChild(dark);
        darks.push(dark);
        ctx.track(ctx.gsap.to(dark, { alpha: 1, duration: 0.16, delay: boom + 0.1, ease: 'power2.out' }));
      });

      await wait(1000);
      if (!ctx.alive()) return;

      // Phase 2 — new tiles drop from above with real weight: power3.in fall,
      // squash on impact, brief hold, back.out settle with micro-overshoot.
      const dropH = ctx.gridRect().h * 0.45 + 60;
      cells.forEach((cell, i) => {
        const delay = Math.max(0, i * 0.12 + ctx.rand(-0.03, 0.03));
        const cr = ctx.cellRect(cell.reel, cell.row);
        const tile = ctx.spawnTile(ctx.pick(REFILL_IDS), cell.reel, cell.row);
        const ty = tile.y;
        const s0x = tile.scale.x;
        const s0y = tile.scale.y;
        tile.y = ty - dropH;
        tile.alpha = 0;
        const FALL = jit(ctx, 0.4, 0.15);
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(tile, { alpha: 1, duration: 0.07, ease: 'power1.out' }, 0)
          .to(tile, { y: ty + cr.h * 0.05, duration: FALL, ease: 'power3.in' }, 0)
          // squash on impact
          .to(tile.scale, { x: s0x * 1.09, y: s0y * 0.84, duration: 0.07, ease: 'power2.out' }, FALL)
          // hold a hair, then settle with overshoot
          .to(tile, { y: ty, duration: 0.3, ease: 'back.out(1.8)' }, FALL + 0.09)
          .to(tile.scale, { x: s0x, y: s0y, duration: 0.34, ease: 'back.out(2.1)' }, FALL + 0.09);

        ctx.track(ctx.gsap.to(darks[i], { alpha: 0, duration: 0.24, delay: delay + FALL - 0.08, ease: 'power2.out' }));
        cellFlash(ctx, cell.reel, cell.row, ctx.gold, delay + FALL);
        impactRing(ctx, centreOf(cr).x, centreOf(cr).y + cr.h * 0.3, cr.w * 0.42, ctx.gold, delay + FALL, false);
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
      const scr = ctx.cellRect(sr, sw);
      const start = centreOf(scr);

      // Patient zero — halo breathes in first (anticipation), then the WILD
      // lands and the halo blooms; ambient pulse stays whisper-quiet.
      const halo = glowDot(ctx.gold, scr.w * 0.62, 0.85);
      halo.position.set(start.x, start.y);
      halo.alpha = 0;
      halo.scale.set(1.25);
      ctx.overlay.addChild(halo);
      const htl = ctx.track(ctx.gsap.timeline());
      htl.to(halo, { alpha: 0.7, duration: 0.1, ease: 'power1.out' }, 0)
        .to(halo.scale, { x: 0.78, y: 0.78, duration: 0.12, ease: 'power2.in' }, 0) // inhale
        .to(halo, { alpha: 1, duration: 0.12, ease: 'power1.out' }, 0.12)
        .to(halo.scale, { x: 1.06, y: 1.06, duration: 0.3, ease: 'back.out(1.9)' }, 0.12);
      ctx.track(
        ctx.gsap.to(halo.scale, {
          x: 1.14,
          y: 1.14,
          duration: jit(ctx, 0.55, 0.15),
          delay: 0.5,
          yoyo: true,
          repeat: 7,
          ease: 'sine.inOut',
        }),
      );

      const zero = ctx.spawnTile(0, sr, sw, true);
      const z0x = zero.scale.x;
      const z0y = zero.scale.y;
      zero.scale.set(z0x * 0.86, z0y * 0.86);
      const ztl = ctx.track(ctx.gsap.timeline({ delay: 0.1 }));
      ztl.to(zero.scale, { x: z0x * 1.07, y: z0y * 1.07, duration: 0.18, ease: 'power2.out' }, 0)
        .to(zero.scale, { x: z0x, y: z0y, duration: 0.32, ease: 'back.out(2)' }, 0.18);
      impactRing(ctx, start.x, start.y, scr.w * 0.5, ctx.gold, 0.16);

      await wait(560);
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
        const bulge = len * ctx.rand(0.22, 0.36) * (ctx.rand(0, 1) > 0.5 ? 1 : -1);
        const mx = (start.x + b.x) / 2 + (-dy / len) * bulge;
        const my = (start.y + b.y) / 2 + (dx / len) * bulge;
        const q = (f: number) => ({
          x: (1 - f) * (1 - f) * start.x + 2 * (1 - f) * f * mx + f * f * b.x,
          y: (1 - f) * (1 - f) * start.y + 2 * (1 - f) * f * my + f * f * b.y,
        });

        // Tendril — three stacked strokes: wide soft gold, mid gold, hot core.
        const tendril = new Container();
        const wide = new Graphics();
        const mid = new Graphics();
        const corePath = new Graphics();
        const p0 = q(0);
        wide.moveTo(p0.x, p0.y);
        mid.moveTo(p0.x, p0.y);
        corePath.moveTo(p0.x, p0.y);
        for (let s = 1; s <= 10; s++) {
          const p = q(s / 10);
          wide.lineTo(p.x, p.y);
          mid.lineTo(p.x, p.y);
          corePath.lineTo(p.x, p.y);
        }
        wide.stroke({ color: ctx.gold, width: 13, alpha: 0.13 });
        wide.blendMode = 'add';
        mid.stroke({ color: ctx.gold, width: 6, alpha: 0.32 });
        mid.blendMode = 'add';
        corePath.stroke({ color: 0xffffff, width: 2.2, alpha: 0.85 });
        corePath.blendMode = 'add';
        tendril.addChild(wide, mid, corePath);
        tendril.alpha = 0;
        ctx.overlay.addChild(tendril);
        const ttl = ctx.track(ctx.gsap.timeline());
        ttl.to(tendril, { alpha: 1, duration: 0.07, ease: 'power1.out' }, 0.06)
          .to(tendril, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 0.34);

        // Spark — pulls back toward the host first, then accelerates into the
        // target (power2.in = arrival is the impact). Footprints decay behind it.
        const SPARK = 0.26;
        const sp = glowDot(ctx.gold, 11, 1.15);
        sp.position.set(start.x, start.y);
        ctx.overlay.addChild(sp);
        const st = { f: 0 };
        const spl = ctx.track(ctx.gsap.timeline());
        spl.to(st, { f: -0.06, duration: 0.08, ease: 'power2.out' }, 0) // pull-back
          .to(st, {
            f: 1,
            duration: SPARK,
            ease: 'power2.in',
            onUpdate: () => {
              const p = q(st.f);
              sp.position.set(p.x, p.y);
            },
          }, 0.08)
          .to(sp, { alpha: 0, duration: 0.14, ease: 'power2.in' }, 0.08 + SPARK - 0.02);
        // trail footprints — each older one dimmer AND smaller
        for (let d = 0; d < 5; d++) {
          const f = 0.18 + d * 0.17;
          const p = q(f);
          const foot = glowDot(ctx.gold, 6.5 - d * 0.7, 0.65 - d * 0.08);
          foot.position.set(p.x, p.y);
          foot.alpha = 0;
          ctx.overlay.addChild(foot);
          const at = 0.08 + SPARK * Math.sqrt(f);
          const ftl2 = ctx.track(ctx.gsap.timeline({ delay: at }));
          ftl2.to(foot, { alpha: 0.8 - d * 0.1, duration: 0.03 }, 0)
            .to(foot, { alpha: 0, duration: jit(ctx, 0.22, 0.2), ease: 'power2.in' }, 0.03)
            .to(foot.scale, { x: 0.4, y: 0.4, duration: 0.24, ease: 'power2.in' }, 0.03);
        }

        await wait(340);
        if (!ctx.alive()) return;

        // Neighbour flips into a WILD with a pop.
        ctx.setCellSymbol(t.reel, t.row, 0);
        ctx.playCellState(t.reel, t.row, 'featured');
        cellFlash(ctx, t.reel, t.row, ctx.gold);
        impactRing(ctx, b.x, b.y, ctx.cellRect(t.reel, t.row).w * 0.48, ctx.gold, 0.03);

        await wait(Math.round(jit(ctx, 230, 0.18)));
      }

      if (!ctx.alive()) return;

      // Outbreak complete — host inhales, then one big pulse over the cluster.
      const otl = ctx.track(ctx.gsap.timeline());
      otl.to(halo.scale, { x: 0.85, y: 0.85, duration: 0.1, ease: 'power2.in' }, 0)
        .to(halo.scale, { x: 1.3, y: 1.3, duration: 0.34, ease: 'back.out(1.7)' }, 0.1)
        .to(halo, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.3);
      impactRing(ctx, start.x, start.y, scr.w * 1.15, ctx.gold, 0.1);
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

      // Phase 1 — lock frames slam on: oversized, drop in with weight, squash,
      // settle; the padlock glyph pops a beat later. Tiles persist under rolls.
      const lockUi: Container[] = [];
      locked.forEach((cell, i) => {
        ctx.spawnTile(sym, cell.reel, cell.row, false);
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = centreOf(cr);
        const delay = Math.max(0, i * 0.07 + ctx.rand(-0.02, 0.02));

        const frame = new Container();
        frame.position.set(c.x, c.y);
        const wideGlow = new Graphics();
        wideGlow.roundRect(-cr.w / 2 - 4, -cr.h / 2 - 4, cr.w + 8, cr.h + 8, 14).stroke({ color: ctx.gold, width: 14, alpha: 0.12 });
        wideGlow.blendMode = 'add';
        const glow = new Graphics();
        glow.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: ctx.gold, width: 8, alpha: 0.3 });
        glow.blendMode = 'add';
        const core = new Graphics();
        core
          .roundRect(-cr.w / 2 + 2, -cr.h / 2 + 2, cr.w - 4, cr.h - 4, 10)
          .stroke({ color: ctx.gold, width: 3, alpha: 0.9 });
        core.blendMode = 'add';
        const plate = new Graphics();
        plate.circle(cr.w / 2 - 14, -cr.h / 2 + 14, 12).fill({ color: 0x000000, alpha: 0.72 });
        plate.circle(cr.w / 2 - 14, -cr.h / 2 + 16, 10).fill({ color: 0xffffff, alpha: 0.05 });
        plate.circle(cr.w / 2 - 14, -cr.h / 2 + 14, 12).stroke({ color: ctx.gold, width: 2, alpha: 0.9 });
        const glyph = new Text({
          text: '\u{1F512}',
          style: new TextStyle({ fontSize: 13, fill: 0xffffff }),
        });
        glyph.anchor.set(0.5);
        glyph.position.set(cr.w / 2 - 14, -cr.h / 2 + 14);
        glyph.scale.set(0);
        frame.addChild(wideGlow, glow, core, plate, glyph);
        frame.alpha = 0;
        frame.scale.set(1.45);
        ctx.overlay.addChild(frame);
        lockUi.push(frame);

        const SLAM = 0.16;
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(frame, { alpha: 1, duration: 0.08, ease: 'power1.out' }, 0)
          // heavy arrival: fast power3.in shrink INTO the cell...
          .to(frame.scale, { x: 0.94, y: 0.94, duration: SLAM, ease: 'power3.in' }, 0)
          // ...brief pinch hold, then settle out with overshoot
          .to(frame.scale, { x: 1, y: 1, duration: 0.34, ease: 'back.out(2.2)' }, SLAM + 0.05)
          // glyph pops once the frame has landed
          .to(glyph.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2.6)' }, SLAM + 0.08);
        cellFlash(ctx, cell.reel, cell.row, ctx.gold, delay + SLAM);
      });

      await wait(680);
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

      // Phase 3 — locks release: tiny inward dip (anticipation), bright punch
      // out, then fade while drifting up and shearing off-axis (continuation).
      lockUi.forEach((frame, i) => {
        const delay = Math.max(0, i * 0.06 + ctx.rand(-0.015, 0.015));
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(frame.scale, { x: 0.93, y: 0.93, duration: 0.08, ease: 'power2.in' }, 0)
          .to(frame.scale, { x: 1.24, y: 1.24, duration: 0.18, ease: 'power3.out' }, 0.08)
          .to(frame, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.16)
          .to(frame, { y: frame.y - 14, rotation: ctx.rand(-0.1, 0.1), duration: 0.34, ease: 'power1.out' }, 0.14);
      });
      locked.forEach((cell, i) => {
        cellFlash(ctx, cell.reel, cell.row, 0xffffff, i * 0.06 + 0.08);
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

      // Phase 1 — angled wind streaks tear across the grid: each is a long soft
      // tail plus a short hot core, off-tempo, never in lockstep.
      const streakCount = ctx.pick([9, 11, 13] as const);
      for (let i = 0; i < streakCount; i++) {
        const len = gr.w * ctx.rand(0.32, 0.62);
        const rot = 0.42 + ctx.rand(-0.07, 0.07);
        const streak = new Container();
        const tail = new Graphics();
        tail.roundRect(0, -2.5, len, 5, 2.5).fill({ color: 0xffffff, alpha: ctx.rand(0.1, 0.2) });
        tail.blendMode = 'add';
        const coreLen = len * ctx.rand(0.28, 0.42);
        const coreG = new Graphics();
        coreG.roundRect(len - coreLen, -1.2, coreLen, 2.4, 1.2).fill({ color: 0xffffff, alpha: ctx.rand(0.4, 0.55) });
        coreG.blendMode = 'add';
        streak.addChild(tail, coreG);
        streak.rotation = rot;
        const sx = gr.x - gr.w * ctx.rand(0.3, 0.6);
        const sy = gr.y + gr.h * ctx.rand(-0.2, 0.7);
        streak.position.set(sx, sy);
        streak.alpha = 0;
        ctx.overlay.addChild(streak);
        const travel = gr.w * ctx.rand(1.5, 1.85);
        const tl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0, 0.55) }));
        tl.to(streak, { alpha: 1, duration: 0.08, ease: 'power1.out' }, 0)
          .to(
            streak.position,
            {
              x: sx + Math.cos(rot) * travel,
              y: sy + Math.sin(rot) * travel,
              duration: ctx.rand(0.48, 0.78),
              ease: 'power2.in',
            },
            0,
          )
          .to(streak, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0.45);
      }

      await wait(900);
      if (!ctx.alive()) return;

      // Phase 2 — WILD tiles arc in from the top-left and crash-land: a ground
      // shadow grows FIRST (anticipation), the tile slams in on power3.in,
      // squashes, holds, then elastic-settles. Dust puffs bloom and thin out.
      const spots = shuffledCells(ctx).slice(0, randInt(ctx, 3, 5));
      spots.forEach((cell, i) => {
        const delay = Math.max(0, i * 0.28 + ctx.rand(-0.05, 0.05));
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

        const FLIGHT = jit(ctx, 0.42, 0.12);
        const hitAt = delay + FLIGHT;

        // anticipation — landing shadow condenses on the target cell
        const shadow = new Graphics();
        shadow.ellipse(0, 0, cr.w * 0.42, cr.h * 0.16).fill({ color: 0x000000, alpha: 0.4 });
        shadow.position.set(cc.x, cc.y + cr.h * 0.3);
        shadow.scale.set(0.25);
        shadow.alpha = 0;
        ctx.overlay.addChild(shadow);
        const shtl = ctx.track(ctx.gsap.timeline({ delay }));
        shtl.to(shadow, { alpha: 1, duration: FLIGHT * 0.5, ease: 'power1.out' }, 0)
          .to(shadow.scale, { x: 1, y: 1, duration: FLIGHT, ease: 'power2.in' }, 0)
          .to(shadow, { alpha: 0, duration: 0.22, ease: 'power2.out' }, FLIGHT + 0.02);

        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(tile, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
          .to(tile, { x: tx, duration: FLIGHT, ease: 'power1.in' }, 0)
          .to(tile, { y: ty + cr.h * 0.04, duration: FLIGHT, ease: 'power3.in' }, 0)
          .to(tile.scale, { x: s0x, y: s0y, duration: FLIGHT, ease: 'power2.in' }, 0)
          .to(tile, { rotation: 0.09, duration: FLIGHT, ease: 'power1.in' }, 0)
          // impact squash → hold → elastic settle
          .to(tile.scale, { x: s0x * 1.1, y: s0y * 0.82, duration: 0.06, ease: 'power2.out' }, FLIGHT)
          .to(tile, { y: ty, duration: 0.26, ease: 'back.out(1.7)' }, FLIGHT + 0.08)
          .to(tile.scale, { x: s0x, y: s0y, duration: 0.4, ease: 'elastic.out(1, 0.5)' }, FLIGHT + 0.08)
          .to(tile, { rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.45)' }, FLIGHT);

        // Impact: layered white flash, dust ring (non-additive haze), puffs.
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

        const puffCount = ctx.pick([5, 7] as const);
        for (let d = 0; d < puffCount; d++) {
          const puff = new Graphics();
          puff.circle(0, 0, ctx.rand(4, 8)).fill({ color: 0xffffff, alpha: 0.24 });
          puff.position.set(cc.x, cc.y + cr.h * 0.3);
          puff.alpha = 0;
          ctx.overlay.addChild(puff);
          const pa = ctx.rand(Math.PI * 1.05, Math.PI * 1.95);
          const plife = jit(ctx, 0.5, 0.25);
          const ptl = ctx.track(ctx.gsap.timeline({ delay: hitAt + ctx.rand(0, 0.04) }));
          ptl.to(puff, { alpha: 1, duration: 0.05 }, 0)
            .to(
              puff.position,
              {
                x: cc.x + Math.cos(pa) * cr.w * ctx.rand(0.4, 0.85),
                y: cc.y + cr.h * 0.3 + Math.sin(pa) * cr.h * ctx.rand(0.18, 0.45),
                duration: plife,
                ease: 'power2.out',
              },
              0,
            )
            // dust expands as it thins out
            .to(puff.scale, { x: ctx.rand(1.6, 2.3), y: ctx.rand(1.6, 2.3), duration: plife, ease: 'power1.out' }, 0)
            .to(puff, { alpha: 0, duration: plife * 0.6, ease: 'power2.in' }, plife * 0.45);
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

      // Linked border around BOTH reels: wide soft halo + hot core stroke,
      // breathing in from slightly oversized; link nodes pop off-beat.
      const border = new Container();
      const bHalo = new Graphics();
      bHalo.roundRect(ux - 5, uy - 5, uw + 10, uh + 10, 18).stroke({ color: ctx.accent, width: 16, alpha: 0.12 });
      bHalo.blendMode = 'add';
      const bGlow = new Graphics();
      bGlow.roundRect(ux, uy, uw, uh, 14).stroke({ color: ctx.accent, width: 8, alpha: 0.3 });
      bGlow.blendMode = 'add';
      const bCore = new Graphics();
      bCore.roundRect(ux + 2, uy + 2, uw - 4, uh - 4, 12).stroke({ color: ctx.gold, width: 3, alpha: 0.9 });
      bCore.blendMode = 'add';
      border.addChild(bHalo, bGlow, bCore);
      const nodeTop = glowDot(ctx.gold, 14, 1.1);
      nodeTop.position.set(gapX, uy);
      const nodeBot = glowDot(ctx.gold, 14, 1.1);
      nodeBot.position.set(gapX, uy + uh);
      nodeTop.scale.set(0);
      nodeBot.scale.set(0);
      border.addChild(nodeTop, nodeBot);
      border.pivot.set(ux + uw / 2, uy + uh / 2);
      border.position.set(ux + uw / 2, uy + uh / 2);
      border.scale.set(1.05);
      border.alpha = 0;
      ctx.overlay.addChild(border);
      const bin = ctx.track(ctx.gsap.timeline());
      bin.to(border, { alpha: 1, duration: 0.26, ease: 'power2.out' }, 0)
        .to(border.scale, { x: 0.99, y: 0.99, duration: 0.24, ease: 'power2.in' }, 0)
        .to(border.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.6)' }, 0.24);
      ctx.track(ctx.gsap.to(nodeTop.scale, { x: 1, y: 1, duration: 0.35, delay: jit(ctx, 0.12, 0.3), ease: 'back.out(3)' }));
      ctx.track(ctx.gsap.to(nodeBot.scale, { x: 1, y: 1, duration: 0.35, delay: jit(ctx, 0.19, 0.3), ease: 'back.out(3)' }));
      // ambient breath — quiet, slow, slightly off any beat
      ctx.track(ctx.gsap.to(bGlow, { alpha: 0.15, duration: jit(ctx, 0.47, 0.15), yoyo: true, repeat: 9, ease: 'sine.inOut' }));

      await wait(500);
      if (!ctx.alive()) return;

      // Roll under the linked border.
      await ctx.rollAndSettle();
      if (!ctx.alive()) return;
      await wait(150);
      if (!ctx.alive()) return;

      // Connecting light band bridges the twin reels while cells sync.
      const band = new Graphics();
      band.rect(gapX - ra.w * 0.28, uy + 4, ra.w * 0.56, uh - 8).fill({ color: 0xffffff, alpha: 0.16 });
      band.rect(gapX - ra.w * 0.07, uy + 4, ra.w * 0.14, uh - 8).fill({ color: ctx.accent, alpha: 0.36 });
      band.blendMode = 'add';
      band.alpha = 0;
      band.pivot.set(gapX, uy + uh / 2);
      band.position.set(gapX, uy + uh / 2);
      band.scale.set(0.1, 1);
      ctx.overlay.addChild(band);
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(band, { alpha: 1, duration: 0.1, ease: 'power1.out' }, 0)
        .to(band.scale, { x: 1, duration: 0.3, ease: 'back.out(2.2)' }, 0)
        .to(band, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.3 + rows * 0.21);

      // Rows sync top-to-bottom: comet dash of light L→R (a glow head leads a
      // tapering tail), then the right cell pinches, swaps and pops back out.
      for (let row = 0; row < rows; row++) {
        if (!ctx.alive()) return;
        const sym = ctx.getCellSymbol(L, row);
        const ca = centreOf(ctx.cellRect(L, row));
        const cb = centreOf(ctx.cellRect(R, row));
        const crb = ctx.cellRect(R, row);
        const DASH = 0.12;

        const dash = new Container();
        const dTail = new Graphics();
        dTail.roundRect(0, -5, cb.x - ca.x, 10, 5).fill({ color: ctx.gold, alpha: 0.22 });
        dTail.blendMode = 'add';
        const dCore = new Graphics();
        dCore.roundRect(0, -2.5, cb.x - ca.x, 5, 2.5).fill({ color: ctx.gold, alpha: 0.6 });
        dCore.blendMode = 'add';
        dash.addChild(dTail, dCore);
        dash.position.set(ca.x, ca.y);
        dash.scale.set(0, 1);
        ctx.overlay.addChild(dash);
        const dtl = ctx.track(ctx.gsap.timeline());
        dtl.to(dash.scale, { x: 1, duration: DASH, ease: 'power3.out' }, 0)
          .to(dash, { alpha: 0, duration: 0.2, ease: 'power2.in' }, DASH + 0.02);

        // comet head riding the dash tip into the right cell
        const head = glowDot(0xffffff, 9, 1);
        head.position.set(ca.x, ca.y);
        ctx.overlay.addChild(head);
        const htl = ctx.track(ctx.gsap.timeline());
        htl.to(head, { x: cb.x, duration: DASH, ease: 'power3.out' }, 0)
          .to(head.scale, { x: 0.4, y: 0.4, duration: 0.16, ease: 'power2.in' }, DASH)
          .to(head, { alpha: 0, duration: 0.16, ease: 'power2.in' }, DASH);

        // Flip: bright tile inhales (slight vertical stretch as it pinches),
        // symbol swaps at the pinch, then pops back with overshoot.
        const flip = new Container();
        const flHalo = new Graphics();
        flHalo.roundRect(-crb.w / 2 - 5, -crb.h / 2 - 5, crb.w + 10, crb.h + 10, 15).fill({ color: ctx.accent, alpha: 0.13 });
        flHalo.blendMode = 'add';
        const flBody = new Graphics();
        flBody.roundRect(-crb.w / 2, -crb.h / 2, crb.w, crb.h, 12).fill({ color: 0xffffff, alpha: 0.42 });
        flBody.blendMode = 'add';
        flip.addChild(flHalo, flBody);
        flip.position.set(cb.x, cb.y);
        ctx.overlay.addChild(flip);
        const ftl = ctx.track(ctx.gsap.timeline());
        ftl.to(flip.scale, { x: 0.06, y: 1.06, duration: 0.11, ease: 'power2.in' }, 0)
          .to(flip.scale, { x: 1, y: 1, duration: 0.18, ease: 'back.out(2.2)' }, 0.13)
          .to(flip, { alpha: 0, duration: 0.22, ease: 'power2.in' }, 0.3);

        await wait(Math.round(jit(ctx, 118, 0.15)));
        if (!ctx.alive()) return;
        ctx.setCellSymbol(R, row, sym);
        ctx.playCellState(R, row, 'featured');
        await wait(Math.round(jit(ctx, 92, 0.15)));
      }

      if (!ctx.alive()) return;

      // Twin lockstep confirmed — both columns pulse (loose stagger, twins a
      // hair apart so it reads organic), border releases with a last breath.
      for (let row = 0; row < rows; row++) {
        const d = Math.max(0, row * 0.045 + ctx.rand(-0.012, 0.012));
        cellFlash(ctx, L, row, ctx.accent, d);
        cellFlash(ctx, R, row, ctx.accent, d + 0.03);
        ctx.playCellState(L, row, 'win');
        ctx.playCellState(R, row, 'win');
      }
      const bout = ctx.track(ctx.gsap.timeline({ delay: 0.35 }));
      bout.to(border.scale, { x: 0.985, y: 0.985, duration: 0.12, ease: 'power2.in' }, 0)
        .to(border.scale, { x: 1.03, y: 1.03, duration: 0.4, ease: 'power1.out' }, 0.12)
        .to(border, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.12);
      await wait(850);
    },
  },
];
