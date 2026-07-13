// MECH_PACK_B — five mechanic showcases: cascade tumble, wild infection,
// lock & respin, wild storm and twin reels. Every mechanic is OUTCOME-NEUTRAL
// (pure display), theme-agnostic (ctx.accent / ctx.gold / white / black only)
// and grid-relative (all geometry via cellRect/reelRect/gridRect). Overlays
// ride the sticky lifecycle — whatever a mechanic leaves on screen is cleared
// by the next spin. Every tween goes through ctx.track(); every awaited beat
// re-checks ctx.alive() so the whole choreography is cancellable mid-flight.
//
// Direction pass (Pragmatic/Hacksaw bar) — every mechanic is staged as ONE
// dramatic arc:
//   setup      — 0.3-0.5s of dim/focus that tells you where to look
//   payoff     — a single dominant moment, built from REAL symbol tiles
//   resolution — win states, one exhale, out
// Weight grammar: power4.in arrivals, squash-stretch with a 0.08s hold on
// every impact, back.out(1.6-2) settles, follow-through on exits. Light is
// always a 3-layer additive stack (wide halo ≤0.15 / core / hot white
// centre). Timing is humanised via ctx.rand (±20%), counts are odd, nothing
// moves in lockstep. Ambient dressing stays under ~30% of the visual energy.

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
function jit(ctx: MechContext, base: number, spread = 0.2): number {
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
    .to(tile.scale, { x: 1.05, y: 1.05, duration: 0.26, ease: 'back.out(2)' }, 0.05)
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

/** Soft gold pool of light condensing under a cell — the "something is about
 *  to happen HERE" telegraph. Three stacked ellipses, additive, breathes in. */
function groundPool(ctx: MechContext, cr: Rect, color: number, delay = 0): Graphics {
  const c = centreOf(cr);
  const pool = new Graphics();
  pool.ellipse(0, 0, cr.w * 0.58, cr.h * 0.2).fill({ color, alpha: 0.12 });
  pool.ellipse(0, 0, cr.w * 0.4, cr.h * 0.13).fill({ color, alpha: 0.24 });
  pool.ellipse(0, 0, cr.w * 0.2, cr.h * 0.065).fill({ color: 0xffffff, alpha: 0.4 });
  pool.blendMode = 'add';
  pool.position.set(c.x, c.y + cr.h * 0.34);
  pool.scale.set(0.3);
  pool.alpha = 0;
  ctx.overlay.addChild(pool);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(pool, { alpha: 1, duration: 0.3, ease: 'power1.out' }, 0)
    .to(pool.scale, { x: 1, y: 1, duration: 0.38, ease: 'power2.out' }, 0);
  return pool;
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
      // ---- casting: the "winning" symbol — the one with the most cells on
      // the board (≥2). Its whole footprint tumbles, like a real cluster win.
      const bySym = new Map<number, Cell[]>();
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const s = ctx.getCellSymbol(reel, row);
          const list = bySym.get(s) ?? [];
          list.push({ reel, row });
          bySym.set(s, list);
        }
      }
      let best: [number, Cell[]] | null = null;
      for (const e of bySym.entries()) {
        if (e[0] < 2) continue; // wild/scatter don't tumble
        if (!best || e[1].length > best[1].length) best = e;
      }
      if (!best) best = ctx.pick(Array.from(bySym.entries()));
      const doomed = best[1].slice(0, 7).sort((a, b) => a.reel - b.reel || a.row - b.row);

      // ---- SETUP (0.45s) — board dims, the doomed cells light up and hold.
      // The player must know exactly what is about to pay-and-pop.
      // SFX: soft win chime
      ctx.dimBoard(0.35);
      doomed.forEach((cell, i) => {
        ctx.playCellState(cell.reel, cell.row, 'win');
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = centreOf(cr);
        const halo = glowDot(ctx.gold, Math.min(cr.w, cr.h) * 0.6, 0.55);
        halo.position.set(c.x, c.y);
        halo.alpha = 0;
        halo.scale.set(1.2);
        const htl = ctx.track(ctx.gsap.timeline({ delay: i * 0.03 + ctx.rand(0, 0.02) }));
        htl.to(halo, { alpha: 0.8, duration: 0.22, ease: 'power1.out' }, 0)
          .to(halo.scale, { x: 0.9, y: 0.9, duration: 0.4, ease: 'power2.out' }, 0) // condense inward
          .to(halo, { alpha: 0, duration: 0.14, ease: 'power1.in' }, 0.44);
        ctx.overlay.addChild(halo);
      });

      await wait(520);
      if (!ctx.alive()) return;

      // ---- PAYOFF A — the pop. One wave sweeps left→right; each cell's REAL
      // tile inhales, then bursts: white flash, a handful of shards, and the
      // cell goes dark. Fewer, bigger reads — shards stay a garnish.
      const darkByKey = new Map<string, Graphics>();
      doomed.forEach((cell) => {
        const cr = ctx.cellRect(cell.reel, cell.row);
        const cc = centreOf(cr);
        const delay = Math.max(0, cell.reel * 0.075 + cell.row * 0.028 + ctx.rand(-0.02, 0.02));
        const INHALE = 0.11;
        const boom = delay + INHALE;

        // the hero of the pop is the SYMBOL ITSELF — real art, not a proxy
        const tile = ctx.spawnTile(best![0], cell.reel, cell.row);
        const s0x = tile.scale.x;
        const s0y = tile.scale.y;
        const ttl = ctx.track(ctx.gsap.timeline({ delay }));
        ttl
          // anticipation — the tile shrinks in on itself…
          .to(tile.scale, { x: s0x * 0.9, y: s0y * 0.9, duration: INHALE, ease: 'power2.in' }, 0)
          // …then blows outward and is gone (exit continues the motion)
          // SFX: tumble pop
          .to(tile.scale, { x: s0x * 1.32, y: s0y * 1.32, duration: 0.2, ease: 'power3.out' }, INHALE)
          .to(tile, { alpha: 0, duration: 0.18, ease: 'power2.in' }, INHALE + 0.04);

        const flash = glowDot(0xffffff, Math.min(cr.w, cr.h) * 0.55, 1.25);
        flash.position.set(cc.x, cc.y);
        flash.scale.set(0.2);
        flash.alpha = 0;
        ctx.overlay.addChild(flash);
        const ftl = ctx.track(ctx.gsap.timeline({ delay: boom }));
        ftl.to(flash, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
          .to(flash.scale, { x: 1.25, y: 1.25, duration: 0.28, ease: 'power4.out' }, 0)
          .to(flash, { alpha: 0, duration: 0.24, ease: 'power2.in' }, 0.09);

        // shards — odd, few, arcing under gravity, shrinking as they die
        const shardCount = ctx.pick([5, 7] as const);
        for (let s = 0; s < shardCount; s++) {
          const shard = new Graphics();
          const sw = ctx.rand(4, 9);
          const sh = ctx.rand(3, 7);
          shard.rect(-sw / 2, -sh / 2, sw, sh).fill({
            color: ctx.pick([0xffffff, ctx.gold, ctx.gold]),
            alpha: 0.9,
          });
          shard.blendMode = 'add';
          shard.position.set(cc.x, cc.y);
          shard.rotation = ctx.rand(0, Math.PI);
          shard.alpha = 0;
          ctx.overlay.addChild(shard);
          const ang = ctx.rand(0, Math.PI * 2);
          const dist = ctx.rand(cr.w * 0.5, cr.w * 1.2);
          const life = jit(ctx, 0.5, 0.25);
          const stl = ctx.track(ctx.gsap.timeline({ delay: boom + ctx.rand(0, 0.03) }));
          stl.to(shard, { alpha: 1, duration: 0.03 }, 0)
            .to(shard.position, { x: cc.x + Math.cos(ang) * dist, duration: life, ease: 'power3.out' }, 0)
            .to(shard.position, { y: cc.y + Math.sin(ang) * dist * 0.7, duration: life * 0.5, ease: 'power2.out' }, 0)
            .to(shard.position, { y: `+=${cr.h * ctx.rand(0.35, 0.6)}`, duration: life * 0.55, ease: 'power2.in' }, life * 0.5)
            .to(shard, { rotation: shard.rotation + ctx.rand(-4, 4), duration: life, ease: 'power2.out' }, 0)
            .to(shard.scale, { x: 0.4, y: 0.4, duration: life * 0.6, ease: 'power2.in' }, life * 0.45)
            .to(shard, { alpha: 0, duration: life * 0.55, ease: 'power2.in' }, life * 0.5);
        }

        // emptied cell — near-black tile with a faint top sheen (reads as depth)
        const dark = new Graphics();
        dark.roundRect(cr.x + 2, cr.y + 2, cr.w - 4, cr.h - 4, 10).fill({ color: 0x000000, alpha: 0.88 });
        dark.roundRect(cr.x + 4, cr.y + 4, cr.w - 8, cr.h * 0.14, 8).fill({ color: 0xffffff, alpha: 0.05 });
        dark.roundRect(cr.x + 2, cr.y + 2, cr.w - 4, cr.h - 4, 10).stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
        dark.alpha = 0;
        ctx.overlay.addChild(dark);
        darkByKey.set(`${cell.reel}:${cell.row}`, dark);
        ctx.track(ctx.gsap.to(dark, { alpha: 1, duration: 0.16, delay: boom + 0.08, ease: 'power2.out' }));
      });

      // quiet beat — holes sit dark, dust settles, the board holds its breath
      await wait(1050);
      if (!ctx.alive()) return;

      // ---- PAYOFF B (the hero moment) — the refill. Columns drop as units:
      // real tiles fall in on power4.in, squash on impact, hold 0.08s, settle
      // with back.out. Only the LAST cell of each column gets an impact ring —
      // one landing thud per column, not a drum roll.
      const byReel = new Map<number, Cell[]>();
      doomed.forEach((cell) => {
        const list = byReel.get(cell.reel) ?? [];
        list.push(cell);
        byReel.set(cell.reel, list);
      });
      const reelsHit = Array.from(byReel.keys()).sort((a, b) => a - b);
      const dropH = ctx.gridRect().h * 0.5 + 60;
      ctx.undimBoard(); // lights come back up WITH the refill

      reelsHit.forEach((reel, ci) => {
        const column = byReel.get(reel)!.sort((a, b) => a.row - b.row);
        const colDelay = ci * 0.11 + ctx.rand(-0.02, 0.02);
        column.forEach((cell, ri) => {
          const delay = Math.max(0, colDelay + ri * 0.05 + ctx.rand(-0.012, 0.012));
          const cr = ctx.cellRect(cell.reel, cell.row);
          const sym = ctx.pick(REFILL_IDS);
          const tile = ctx.spawnTile(sym, cell.reel, cell.row);
          ctx.setCellSymbol(cell.reel, cell.row, sym); // board matches the art underneath
          const ty = tile.y;
          const s0x = tile.scale.x;
          const s0y = tile.scale.y;
          tile.y = ty - dropH;
          tile.alpha = 0;
          const FALL = jit(ctx, 0.38, 0.12);
          // SFX: tumble land (per column)
          const tl = ctx.track(ctx.gsap.timeline({ delay }));
          tl.to(tile, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
            .to(tile, { y: ty + cr.h * 0.05, duration: FALL, ease: 'power4.in' }, 0)
            // squash on impact…
            .to(tile.scale, { x: s0x * 1.09, y: s0y * 0.84, duration: 0.06, ease: 'power2.out' }, FALL)
            // …hold 0.08s, then settle with overshoot
            .to(tile, { y: ty, duration: 0.28, ease: 'back.out(1.8)' }, FALL + 0.08)
            .to(tile.scale, { x: s0x, y: s0y, duration: 0.32, ease: 'back.out(2)' }, FALL + 0.08);

          const dark = darkByKey.get(`${cell.reel}:${cell.row}`);
          if (dark) ctx.track(ctx.gsap.to(dark, { alpha: 0, duration: 0.22, delay: delay + FALL - 0.08, ease: 'power2.out' }));

          const isBottom = ri === column.length - 1;
          if (isBottom) {
            const c = centreOf(cr);
            impactRing(ctx, c.x, c.y + cr.h * 0.3, cr.w * 0.42, ctx.gold, delay + FALL, false);
          }
          if (isBottom && ci === reelsHit.length - 1) {
            cellFlash(ctx, cell.reel, cell.row, ctx.gold, delay + FALL); // final button
          }
        });
      });

      await wait(1350);
      if (!ctx.alive()) return;

      // ---- RESOLUTION — the fresh symbols acknowledge the player and rest.
      doomed.forEach((cell, i) => ctx.playCellState(cell.reel, cell.row, i === 0 ? 'win' : 'featured'));
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

      // ---- SETUP (0.4s) — the board dims and a pool of gold light condenses
      // under one cell. Nothing else moves. The player's eye is parked.
      // SFX: low swell
      ctx.dimBoard(0.5);
      const pool = groundPool(ctx, scr, ctx.gold);

      await wait(420);
      if (!ctx.alive()) return;

      // ---- ARRIVAL — patient zero. The REAL wild tile drops out of the dark:
      // power4.in scale-arrival, squash, 0.08s hold, back.out settle. One ring,
      // no confetti — the tile itself is the show.
      // SFX: heavy wild land
      const zero = ctx.spawnTile(0, sr, sw, true);
      const z0x = zero.scale.x;
      const z0y = zero.scale.y;
      zero.scale.set(z0x * 1.55, z0y * 1.55);
      zero.alpha = 0;
      const LAND = 0.2;
      const ztl = ctx.track(ctx.gsap.timeline());
      ztl.to(zero, { alpha: 1, duration: 0.08, ease: 'power1.out' }, 0)
        .to(zero.scale, { x: z0x * 0.9, y: z0y * 0.86, duration: LAND, ease: 'power4.in' }, 0) // arrive INTO the cell
        .to(zero.scale, { x: z0x, y: z0y, duration: 0.34, ease: 'back.out(1.9)' }, LAND + 0.08); // hold, then settle
      impactRing(ctx, start.x, start.y, scr.w * 0.52, ctx.gold, LAND + 0.02);
      ctx.track(ctx.gsap.to(pool, { alpha: 0, duration: 0.35, delay: LAND, ease: 'power2.in' }));

      // host halo — breathes quietly between infections (ambient, whisper-level)
      const halo = glowDot(ctx.gold, scr.w * 0.62, 0.8);
      halo.position.set(start.x, start.y);
      halo.alpha = 0;
      ctx.overlay.addChild(halo);
      ctx.track(ctx.gsap.to(halo, { alpha: 0.85, duration: 0.3, delay: LAND, ease: 'power1.out' }));
      ctx.track(
        ctx.gsap.to(halo.scale, {
          x: 1.12,
          y: 1.12,
          duration: jit(ctx, 0.55, 0.15),
          delay: LAND + 0.3,
          yoyo: true,
          repeat: 9,
          ease: 'sine.inOut',
        }),
      );

      await wait(700);
      if (!ctx.alive()) return;

      // ---- PAYOFF — the outbreak. Orthogonal neighbours, one at a time; each
      // infection is a heartbeat: host INHALES → pulses → a tendril whips out →
      // the neighbour flips into a real WILD tile. The rhythm accelerates —
      // beat, beat, beatbeat — like a disease taking hold.
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
      const targets = neigh.slice(0, Math.min(neigh.length, 3));
      const gaps = [430, 360, 290]; // accelerating outbreak rhythm

      for (let ti = 0; ti < targets.length; ti++) {
        if (!ctx.alive()) return;
        const t = targets[ti];
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

        // heartbeat — host inhales, then pulses as the tendril leaves
        // SFX: heartbeat thump
        const hb = ctx.track(ctx.gsap.timeline());
        hb.to(zero.scale, { x: z0x * 0.93, y: z0y * 0.93, duration: 0.09, ease: 'power2.in' }, 0)
          .to(zero.scale, { x: z0x, y: z0y, duration: 0.26, ease: 'back.out(1.8)' }, 0.09);

        // tendril — three stacked strokes: wide soft gold, mid gold, hot core
        const tendril = new Container();
        const wide = new Graphics();
        const midG = new Graphics();
        const corePath = new Graphics();
        const p0 = q(0);
        wide.moveTo(p0.x, p0.y);
        midG.moveTo(p0.x, p0.y);
        corePath.moveTo(p0.x, p0.y);
        for (let s = 1; s <= 10; s++) {
          const p = q(s / 10);
          wide.lineTo(p.x, p.y);
          midG.lineTo(p.x, p.y);
          corePath.lineTo(p.x, p.y);
        }
        wide.stroke({ color: ctx.gold, width: 13, alpha: 0.13 });
        wide.blendMode = 'add';
        midG.stroke({ color: ctx.gold, width: 6, alpha: 0.32 });
        midG.blendMode = 'add';
        corePath.stroke({ color: 0xffffff, width: 2.2, alpha: 0.85 });
        corePath.blendMode = 'add';
        tendril.addChild(wide, midG, corePath);
        tendril.alpha = 0;
        ctx.overlay.addChild(tendril);
        const ttl = ctx.track(ctx.gsap.timeline());
        ttl.to(tendril, { alpha: 1, duration: 0.07, ease: 'power1.out' }, 0.08)
          .to(tendril, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.36);

        // spark — pulls back toward the host first (anticipation), then
        // accelerates into the target: the ARRIVAL is the impact.
        // SFX: whip whoosh
        const SPARK = 0.24;
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
        // three decaying footprints — each older one dimmer AND smaller
        for (let d = 0; d < 3; d++) {
          const f = 0.28 + d * 0.24;
          const p = q(f);
          const foot = glowDot(ctx.gold, 6 - d, 0.6 - d * 0.12);
          foot.position.set(p.x, p.y);
          foot.alpha = 0;
          ctx.overlay.addChild(foot);
          const at = 0.08 + SPARK * Math.sqrt(f);
          const ftl2 = ctx.track(ctx.gsap.timeline({ delay: at }));
          ftl2.to(foot, { alpha: 0.75 - d * 0.15, duration: 0.03 }, 0)
            .to(foot, { alpha: 0, duration: jit(ctx, 0.2, 0.2), ease: 'power2.in' }, 0.03)
            .to(foot.scale, { x: 0.4, y: 0.4, duration: 0.22, ease: 'power2.in' }, 0.03);
        }

        await wait(330);
        if (!ctx.alive()) return;

        // the neighbour FLIPS — a real wild tile pinches open out of the old
        // symbol: scaleX 0 → back.out. The board cell swaps underneath.
        // SFX: flip snap
        ctx.setCellSymbol(t.reel, t.row, 0);
        const wt = ctx.spawnTile(0, t.reel, t.row, true);
        const w0x = wt.scale.x;
        const w0y = wt.scale.y;
        wt.scale.set(w0x * 0.05, w0y * 1.08);
        const wtl = ctx.track(ctx.gsap.timeline());
        wtl.to(wt.scale, { x: w0x, y: w0y, duration: 0.26, ease: 'back.out(1.8)' }, 0);
        impactRing(ctx, b.x, b.y, ctx.cellRect(t.reel, t.row).w * 0.46, ctx.gold, 0.02);
        ctx.playCellState(t.reel, t.row, 'featured');

        await wait(Math.round(jit(ctx, gaps[Math.min(ti, gaps.length - 1)], 0.15)));
      }

      if (!ctx.alive()) return;

      // ---- RESOLUTION — the lights come back up and the whole cluster takes
      // one unified breath: host pulses big, the infected answer a hair later.
      // SFX: resolve chord
      ctx.undimBoard();
      const otl = ctx.track(ctx.gsap.timeline());
      otl.to(zero.scale, { x: z0x * 0.92, y: z0y * 0.92, duration: 0.1, ease: 'power2.in' }, 0)
        .to(zero.scale, { x: z0x, y: z0y, duration: 0.36, ease: 'back.out(1.7)' }, 0.1);
      ctx.track(ctx.gsap.to(halo, { alpha: 0, duration: 0.45, delay: 0.25, ease: 'power2.in' }));
      impactRing(ctx, start.x, start.y, scr.w * 1.15, ctx.gold, 0.12);
      ctx.playCellState(sr, sw, 'win');
      targets.forEach((t, i) => cellFlash(ctx, t.reel, t.row, ctx.gold, 0.16 + i * 0.05 + ctx.rand(0, 0.02)));
      await wait(650);
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

      // ---- SETUP (0.4s) — the board dims FIRST, and the cells about to lock
      // glow awake. The player reads "these are staying" before anything slams.
      // SFX: lock tease shimmer
      ctx.dimBoard(0.45);
      locked.forEach((cell, i) => {
        ctx.playCellState(cell.reel, cell.row, 'featured');
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = centreOf(cr);
        const pre = glowDot(ctx.gold, Math.min(cr.w, cr.h) * 0.55, 0.5);
        pre.position.set(c.x, c.y);
        pre.alpha = 0;
        pre.scale.set(1.25);
        ctx.overlay.addChild(pre);
        const ptl = ctx.track(ctx.gsap.timeline({ delay: i * 0.04 + ctx.rand(0, 0.02) }));
        ptl.to(pre, { alpha: 0.7, duration: 0.2, ease: 'power1.out' }, 0)
          .to(pre.scale, { x: 0.85, y: 0.85, duration: 0.34, ease: 'power2.out' }, 0)
          .to(pre, { alpha: 0, duration: 0.12, ease: 'power1.in' }, 0.36);
      });

      await wait(440);
      if (!ctx.alive()) return;

      // ---- PAYOFF A — the locks SLAM on. Oversized frames arrive on
      // power4.in, pinch the cell, hold 0.08s, settle with back.out; the
      // padlock glyph pops a beat after its frame has landed.
      const lockUi: Container[] = [];
      locked.forEach((cell, i) => {
        ctx.spawnTile(sym, cell.reel, cell.row, false);
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = centreOf(cr);
        const delay = Math.max(0, i * 0.09 + ctx.rand(-0.02, 0.02));

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
        frame.scale.set(1.5);
        ctx.overlay.addChild(frame);
        lockUi.push(frame);

        const SLAM = 0.15;
        // SFX: lock slam (metallic)
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(frame, { alpha: 1, duration: 0.07, ease: 'power1.out' }, 0)
          // heavy arrival: power4.in shrink INTO the cell…
          .to(frame.scale, { x: 0.94, y: 0.94, duration: SLAM, ease: 'power4.in' }, 0)
          // …pinch hold 0.08s, then settle out with overshoot
          .to(frame.scale, { x: 1, y: 1, duration: 0.32, ease: 'back.out(2)' }, SLAM + 0.08)
          // glyph pops once the frame has landed
          .to(glyph.scale, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2.4)' }, SLAM + 0.1);
        cellFlash(ctx, cell.reel, cell.row, ctx.gold, delay + SLAM);
      });

      await wait(760);
      if (!ctx.alive()) return;

      // ---- RESPIN — the world moves UNDER the locked tiles. Board stays dim;
      // the gold frames are the only bright thing on screen. A breath first.
      // SFX: reels respin
      await wait(220);
      if (!ctx.alive()) return;
      await ctx.rollAndSettle();
      if (!ctx.alive()) return;
      locked.forEach((cell) => ctx.setCellSymbol(cell.reel, cell.row, sym));

      await wait(300);
      if (!ctx.alive()) return;

      // ---- PAYOFF B (the hero moment) — release. All frames pinch inward in
      // near-unison (one chord, not an arpeggio), the LIGHTS COME BACK UP on
      // the same beat, then the frames punch out bright and drift off-axis.
      // SFX: locks release (chord)
      ctx.undimBoard();
      lockUi.forEach((frame, i) => {
        const delay = Math.max(0, i * 0.035 + ctx.rand(-0.012, 0.012));
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(frame.scale, { x: 0.92, y: 0.92, duration: 0.09, ease: 'power2.in' }, 0) // anticipation dip
          .to(frame.scale, { x: 1.26, y: 1.26, duration: 0.18, ease: 'power3.out' }, 0.09)
          .to(frame, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.17)
          .to(frame, { y: frame.y - 14, rotation: ctx.rand(-0.1, 0.1), duration: 0.34, ease: 'power1.out' }, 0.15); // follow-through
      });
      locked.forEach((cell, i) => {
        cellFlash(ctx, cell.reel, cell.row, 0xffffff, i * 0.035 + 0.09);
        ctx.playCellState(cell.reel, cell.row, 'win');
      });

      await wait(780);
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

      // one reusable gust — long soft tail + short hot core, angled, off-tempo
      const gust = (strength: number, delay: number) => {
        const len = gr.w * ctx.rand(0.32, 0.62);
        const rot = 0.42 + ctx.rand(-0.07, 0.07);
        const streak = new Container();
        const tail = new Graphics();
        tail.roundRect(0, -2.5, len, 5, 2.5).fill({ color: 0xffffff, alpha: ctx.rand(0.08, 0.16) * strength });
        tail.blendMode = 'add';
        const coreLen = len * ctx.rand(0.28, 0.42);
        const coreG = new Graphics();
        coreG.roundRect(len - coreLen, -1.2, coreLen, 2.4, 1.2).fill({ color: 0xffffff, alpha: ctx.rand(0.35, 0.5) * strength });
        coreG.blendMode = 'add';
        streak.addChild(tail, coreG);
        streak.rotation = rot;
        const sx = gr.x - gr.w * ctx.rand(0.3, 0.6);
        const sy = gr.y + gr.h * ctx.rand(-0.2, 0.7);
        streak.position.set(sx, sy);
        streak.alpha = 0;
        ctx.overlay.addChild(streak);
        const travel = gr.w * ctx.rand(1.5, 1.85);
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
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
      };

      // ---- SETUP — the wind builds in two waves: a faint far-off gust, then
      // a stronger one. Then it STOPS. The lull is the anticipation.
      // SFX: wind build
      for (let i = 0; i < 5; i++) gust(0.6, ctx.rand(0, 0.3));
      for (let i = 0; i < 7; i++) gust(1, 0.4 + ctx.rand(0, 0.3));

      await wait(1050);
      if (!ctx.alive()) return;
      // the lull — dead air before the strike
      await wait(260);
      if (!ctx.alive()) return;

      // ---- one crash-landing, parameterised by "weight class" -------------
      const crash = (cell: Cell, delay: number, heavy: boolean) => {
        const cr = ctx.cellRect(cell.reel, cell.row);
        const cc = centreOf(cr);
        const tile = ctx.spawnTile(0, cell.reel, cell.row, true);
        const tx = tile.x;
        const ty = tile.y;
        const s0x = tile.scale.x;
        const s0y = tile.scale.y;
        const over = heavy ? 1.6 : 1.4;
        tile.position.set(tx - gr.w * 0.45, ty - gr.h * 0.65);
        tile.scale.set(s0x * over, s0y * over);
        tile.rotation = -0.35;
        tile.alpha = 0;

        const FLIGHT = jit(ctx, heavy ? 0.46 : 0.36, 0.1);
        const hitAt = delay + FLIGHT;

        // anticipation — landing shadow condenses on the target cell first
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

        // SFX: wild crash (heavy = full boom, light = short thud)
        const squash = heavy ? 0.8 : 0.86;
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(tile, { alpha: 1, duration: 0.06, ease: 'power1.out' }, 0)
          .to(tile, { x: tx, duration: FLIGHT, ease: 'power1.in' }, 0)
          .to(tile, { y: ty + cr.h * 0.04, duration: FLIGHT, ease: 'power4.in' }, 0)
          .to(tile.scale, { x: s0x, y: s0y, duration: FLIGHT, ease: 'power2.in' }, 0)
          .to(tile, { rotation: 0.09, duration: FLIGHT, ease: 'power1.in' }, 0)
          // impact squash → 0.08s hold → elastic settle
          .to(tile.scale, { x: s0x * (2 - squash), y: s0y * squash, duration: 0.06, ease: 'power2.out' }, FLIGHT)
          .to(tile, { y: ty, duration: 0.26, ease: 'back.out(1.7)' }, FLIGHT + 0.08)
          .to(tile.scale, { x: s0x, y: s0y, duration: 0.4, ease: 'elastic.out(1, 0.5)' }, FLIGHT + 0.08)
          .to(tile, { rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.45)' }, FLIGHT);

        // impact dressing — scaled to weight class; the hero hits hardest
        const flash = glowDot(0xffffff, cr.w * (heavy ? 0.55 : 0.42), heavy ? 1.35 : 1);
        flash.position.set(cc.x, cc.y);
        flash.scale.set(0.15);
        flash.alpha = 0;
        ctx.overlay.addChild(flash);
        const htl = ctx.track(ctx.gsap.timeline({ delay: hitAt }));
        htl.to(flash, { alpha: 1, duration: 0.04 }, 0)
          .to(flash.scale, { x: 1.2, y: 1.2, duration: 0.28, ease: 'back.out(2)' }, 0)
          .to(flash, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.12);
        impactRing(ctx, cc.x, cc.y + cr.h * 0.28, cr.w * (heavy ? 0.6 : 0.45), 0xffffff, hitAt, false);

        const puffCount = heavy ? 5 : 3;
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
            .to(puff.scale, { x: ctx.rand(1.6, 2.3), y: ctx.rand(1.6, 2.3), duration: plife, ease: 'power1.out' }, 0)
            .to(puff, { alpha: 0, duration: plife * 0.6, ease: 'power2.in' }, plife * 0.45);
        }
      };

      // ---- PAYOFF — ONE hero wild crashes out of the lull, biggest thing in
      // the whole mechanic. Then two/three lighter after-strikes rattle in on
      // a decaying rhythm, like the tail of a hailstorm.
      const spots = shuffledCells(ctx).slice(0, randInt(ctx, 3, 4));
      crash(spots[0], 0, true);
      let t = 0.85;
      for (let i = 1; i < spots.length; i++) {
        crash(spots[i], jit(ctx, t, 0.12), false);
        t += 0.42 - i * 0.08; // gaps shrink — the storm is passing
      }

      await wait(2050);
      if (!ctx.alive()) return;

      // ---- RESOLUTION — the wind dies with two last faint streaks, the
      // lights come back up, and the wilds acknowledge: hero pulses 'win'.
      gust(0.45, 0);
      gust(0.35, 0.18);
      ctx.undimBoard();
      ctx.playCellState(spots[0].reel, spots[0].row, 'win');
      for (let i = 1; i < spots.length; i++) ctx.playCellState(spots[i].reel, spots[i].row, 'featured');
      cellFlash(ctx, spots[0].reel, spots[0].row, ctx.gold, 0.1);
      await wait(500);
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

      // ---- SETUP (0.45s) — the rest of the board dims; the linked border
      // SNAPS on around both reels: power4.in pinch, 0.08s hold, back.out
      // settle. Link nodes pop off-beat. Then it just breathes, quietly.
      // SFX: link engage (electric clunk)
      ctx.dimBoard(0.45);
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
      border.scale.set(1.08);
      border.alpha = 0;
      ctx.overlay.addChild(border);
      const SNAP = 0.14;
      const bin = ctx.track(ctx.gsap.timeline());
      bin.to(border, { alpha: 1, duration: 0.08, ease: 'power1.out' }, 0)
        .to(border.scale, { x: 0.985, y: 0.985, duration: SNAP, ease: 'power4.in' }, 0) // arrives INTO place
        .to(border.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.8)' }, SNAP + 0.08); // hold, settle
      ctx.track(ctx.gsap.to(nodeTop.scale, { x: 1, y: 1, duration: 0.32, delay: SNAP + jit(ctx, 0.1, 0.3), ease: 'back.out(2)' }));
      ctx.track(ctx.gsap.to(nodeBot.scale, { x: 1, y: 1, duration: 0.32, delay: SNAP + jit(ctx, 0.17, 0.3), ease: 'back.out(2)' }));
      // ambient breath — quiet, slow, off any beat (≤30% of the energy)
      ctx.track(ctx.gsap.to(bGlow, { alpha: 0.15, duration: jit(ctx, 0.47, 0.15), yoyo: true, repeat: 9, ease: 'sine.inOut' }));

      await wait(520);
      if (!ctx.alive()) return;

      // ---- the roll, under the linked border
      // SFX: reels respin
      await ctx.rollAndSettle();
      if (!ctx.alive()) return;
      await wait(200);
      if (!ctx.alive()) return;

      // ---- PAYOFF (the hero moment) — ONE mirror wipe. A vertical bar of
      // light charges on the left reel, sweeps across the gap, and as it
      // passes, the right reel's cells pinch shut and reopen as the left
      // reel's symbols. One read: "the right reel BECOMES the left."
      // SFX: mirror sweep (rising whoosh)
      const caTop = centreOf(ctx.cellRect(L, 0));
      const cbTop = centreOf(ctx.cellRect(R, 0));
      const bar = new Container();
      const barHalo = new Graphics();
      barHalo.roundRect(-ra.w * 0.3, uy + 4 - (uy + uh / 2), ra.w * 0.6, uh - 8, 10).fill({ color: ctx.accent, alpha: 0.13 });
      barHalo.blendMode = 'add';
      const barMid = new Graphics();
      barMid.roundRect(-ra.w * 0.13, uy + 4 - (uy + uh / 2), ra.w * 0.26, uh - 8, 8).fill({ color: ctx.accent, alpha: 0.3 });
      barMid.blendMode = 'add';
      const barCore = new Graphics();
      barCore.roundRect(-ra.w * 0.04, uy + 6 - (uy + uh / 2), ra.w * 0.08, uh - 12, 5).fill({ color: 0xffffff, alpha: 0.7 });
      barCore.blendMode = 'add';
      bar.addChild(barHalo, barMid, barCore);
      bar.position.set(caTop.x, uy + uh / 2);
      bar.alpha = 0;
      bar.scale.set(0.6, 1);
      ctx.overlay.addChild(bar);

      const CHARGE = 0.18; // bar wakes up on the left reel
      const SWEEP = 0.34; // then crosses in one motion
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(bar, { alpha: 1, duration: CHARGE, ease: 'power1.out' }, 0)
        .to(bar.scale, { x: 1, duration: CHARGE, ease: 'power2.out' }, 0)
        // slight pull-back before the dash (anticipation)…
        .to(bar, { x: caTop.x - ra.w * 0.08, duration: 0.09, ease: 'power2.out' }, CHARGE)
        // …then the sweep itself: arrival is the impact
        .to(bar, { x: cbTop.x, duration: SWEEP, ease: 'power4.in' }, CHARGE + 0.09)
        // squash against the right edge, hold, relax
        .to(bar.scale, { x: 0.55, duration: 0.06, ease: 'power2.out' }, CHARGE + 0.09 + SWEEP)
        .to(bar.scale, { x: 0.8, duration: 0.24, ease: 'back.out(1.7)' }, CHARGE + 0.09 + SWEEP + 0.08)
        .to(bar, { alpha: 0, duration: 0.3, ease: 'power2.in' }, CHARGE + 0.09 + SWEEP + 0.12);

      // the flips ripple down the right reel just behind the bar's arrival
      const hitAt = CHARGE + 0.09 + SWEEP;
      for (let row = 0; row < rows; row++) {
        const sym = ctx.getCellSymbol(L, row);
        const crb = ctx.cellRect(R, row);
        const cb = centreOf(crb);
        const flipDelay = hitAt - 0.02 + row * 0.055 + ctx.rand(0, 0.02);

        const flip = new Container();
        const flHalo = new Graphics();
        flHalo.roundRect(-crb.w / 2 - 5, -crb.h / 2 - 5, crb.w + 10, crb.h + 10, 15).fill({ color: ctx.accent, alpha: 0.13 });
        flHalo.blendMode = 'add';
        const flBody = new Graphics();
        flBody.roundRect(-crb.w / 2, -crb.h / 2, crb.w, crb.h, 12).fill({ color: 0xffffff, alpha: 0.42 });
        flBody.blendMode = 'add';
        flip.addChild(flHalo, flBody);
        flip.position.set(cb.x, cb.y);
        flip.alpha = 0;
        ctx.overlay.addChild(flip);
        // SFX: flip tick (one per row, descending)
        const ftl = ctx.track(ctx.gsap.timeline({ delay: flipDelay }));
        ftl.to(flip, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
          .to(flip.scale, { x: 0.06, y: 1.06, duration: 0.1, ease: 'power2.in' }, 0) // pinch shut
          .call(() => {
            if (!ctx.alive()) return;
            ctx.setCellSymbol(R, row, sym); // the swap happens at the pinch
            ctx.playCellState(R, row, 'featured');
          }, undefined, 0.1)
          .to(flip.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(2)' }, 0.12) // reopen
          .to(flip, { alpha: 0, duration: 0.22, ease: 'power2.in' }, 0.3);
      }

      await wait(Math.round((hitAt + rows * 0.055 + 0.55) * 1000));
      if (!ctx.alive()) return;

      // ---- RESOLUTION — twins confirmed. Lights up; both columns pulse as
      // near-mirror pairs (the twin answers a hair behind, reads organic),
      // and the border exhales out.
      // SFX: twin confirm chord
      ctx.undimBoard();
      for (let row = 0; row < rows; row++) {
        const d = Math.max(0, row * 0.045 + ctx.rand(-0.012, 0.012));
        cellFlash(ctx, L, row, ctx.accent, d);
        cellFlash(ctx, R, row, ctx.accent, d + 0.03);
        ctx.playCellState(L, row, 'win');
        ctx.playCellState(R, row, 'win');
      }
      const bout = ctx.track(ctx.gsap.timeline({ delay: 0.35 }));
      bout.to(border.scale, { x: 0.985, y: 0.985, duration: 0.12, ease: 'power2.in' }, 0) // last inhale
        .to(border.scale, { x: 1.03, y: 1.03, duration: 0.4, ease: 'power1.out' }, 0.12)
        .to(border, { alpha: 0, duration: 0.45, ease: 'power2.in' }, 0.12);
      await wait(850);
    },
  },
];
