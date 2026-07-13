// MECH_PACK_D — five mechanic showcases: stacked wild drop, symbol magnet,
// bomb scatter, neon roulette and vault crack. Every mechanic is
// OUTCOME-NEUTRAL (pure display; the math never moves), theme-agnostic
// (ctx.accent / ctx.gold / white / black only) and grid-relative (all
// geometry via cellRect/reelRect/gridRect). Overlays ride the sticky
// lifecycle — whatever a mechanic leaves on screen is cleared by the next
// spin. Every tween goes through ctx.track(); ctx.alive() is re-checked
// after every awaited beat so the whole choreography cancels mid-flight.
//
// Direction grammar (anti-AI pass):
//   staging     — one hero element per mechanic; dim/focus setup, single
//                 dominant payoff, quiet resolution
//   weight      — power4.in arrivals, squash-stretch + ~0.08s hold on every
//                 impact, elastic/back.out settles, follow-through
//   light       — 3-layer stacks (wide halo <=0.15 / body / hot white core),
//                 additive, never a flat shape
//   humanity    — ctx.rand jitter (±20%) on staggers/amps, odd counts,
//                 nothing moves in lockstep
//   restraint   — fewer, bigger, slower reads; ambient dressing stays under
//                 a third of the visual energy

import { Container, Graphics } from 'pixi.js';
import type { MechEntry, MechContext } from '../mechTypes';

type Rect = { x: number; y: number; w: number; h: number };
type Cell = { reel: number; row: number };
type Pt = { x: number; y: number };

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mid(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Inclusive integer in [min, max] from the cosmetic rand. */
function randInt(ctx: MechContext, min: number, max: number): number {
  return Math.min(max, Math.floor(ctx.rand(min, max + 1)));
}

/** ±spread multiplicative jitter on a base value (timing humaniser). */
function jit(ctx: MechContext, base: number, spread = 0.2): number {
  return base * (1 + ctx.rand(-spread, spread));
}

/** Quadratic bezier point. */
function qBez(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/** Soft additive radial glow — 4 layers: wide halo, mid, inner, hot core. */
function glowDot(color: number, r: number, k = 1): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.12 * k });
  g.circle(0, 0, r * 0.64).fill({ color, alpha: 0.3 * k });
  g.circle(0, 0, r * 0.38).fill({ color, alpha: 0.46 * k });
  g.circle(0, 0, r * 0.18).fill({ color: 0xffffff, alpha: 0.8 * k });
  g.blendMode = 'add';
  return g;
}

/** Expanding shockwave ring (wash band / colour band / white core) with a
 *  dimmer, smaller trailing echo. Size and time jittered. */
function ringBurst(ctx: MechContext, x: number, y: number, radius: number, color: number, delay = 0): void {
  const BASE = 40;
  const ring = new Container();
  ring.position.set(x, y);
  const wash = new Graphics();
  wash.circle(0, 0, BASE).stroke({ color, width: 14, alpha: 0.13 });
  wash.blendMode = 'add';
  const body = new Graphics();
  body.circle(0, 0, BASE).stroke({ color, width: 7, alpha: 0.36 });
  body.blendMode = 'add';
  const core = new Graphics();
  core.circle(0, 0, BASE).stroke({ color: 0xffffff, width: 2, alpha: 0.85 });
  core.blendMode = 'add';
  ring.addChild(wash, body, core);
  ring.scale.set(0.1);
  ring.alpha = 0;
  ctx.overlay.addChild(ring);
  const s = (radius / BASE) * ctx.rand(0.92, 1.08);
  const d = 0.5 * ctx.rand(0.85, 1.15);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(ring, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
    .to(ring.scale, { x: s, y: s, duration: d, ease: 'power3.out' }, 0)
    .to(ring, { alpha: 0, duration: d * 0.66, ease: 'power2.in' }, d * 0.44);
  const echo = new Graphics();
  echo.circle(0, 0, BASE).stroke({ color, width: 4, alpha: 0.2 });
  echo.blendMode = 'add';
  echo.position.set(x, y);
  echo.scale.set(0.1);
  echo.alpha = 0;
  ctx.overlay.addChild(echo);
  const etl = ctx.track(ctx.gsap.timeline({ delay: delay + ctx.rand(0.06, 0.1) }));
  etl.to(echo, { alpha: 0.7, duration: 0.05, ease: 'power1.out' }, 0)
    .to(echo.scale, { x: s * 0.7, y: s * 0.7, duration: d * 1.15, ease: 'power2.out' }, 0)
    .to(echo, { alpha: 0, duration: d * 0.7, ease: 'power2.in' }, d * 0.45);
}

/** Radial glow-spark spray: jittered angles/sizes/timing, sparks shrink as
 *  they fade with a small gravity droop at the end. Odd counts read best. */
function sparkBurst(ctx: MechContext, x: number, y: number, color: number, n: number, dist: number, delay = 0): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ctx.rand(-0.5, 0.5);
    const s = glowDot(color, ctx.rand(3.5, 7));
    s.position.set(x, y);
    s.alpha = 0;
    s.scale.set(ctx.rand(0.8, 1.2));
    ctx.overlay.addChild(s);
    const d = ctx.rand(dist * 0.5, dist);
    const fly = ctx.rand(0.42, 0.66);
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

/** Layered cell-sized flash: tiny inhale, back.out pop, exit continuation. */
function cellFlash(ctx: MechContext, cr: Rect, color: number, delay = 0): void {
  const c = mid(cr);
  const g = new Graphics();
  g.roundRect(-cr.w / 2 - 6, -cr.h / 2 - 6, cr.w + 12, cr.h + 12, 15).fill({ color, alpha: 0.12 });
  g.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).fill({ color, alpha: 0.24 });
  g.roundRect(-cr.w * 0.24, -cr.h * 0.24, cr.w * 0.48, cr.h * 0.48, 9).fill({ color: 0xffffff, alpha: 0.4 });
  g.roundRect(-cr.w / 2, -cr.h / 2, cr.w, cr.h, 12).stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
  g.blendMode = 'add';
  g.position.set(c.x, c.y);
  g.alpha = 0;
  g.scale.set(0.82);
  ctx.overlay.addChild(g);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(g, { alpha: 1, duration: 0.06, ease: 'power2.out' }, 0)
    .to(g.scale, { x: 1.06, y: 1.06, duration: 0.22, ease: 'back.out(2.2)' }, 0)
    .to(g, { alpha: 0, duration: 0.32, ease: 'power2.in' }, 0.26)
    .to(g.scale, { x: 1.13, y: 1.13, duration: 0.32, ease: 'power1.out' }, 0.26);
}

/** All board cells in a seeded-shuffled order. */
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

/* ------------------------------------------------------------------ */
/* the pack                                                            */
/* ------------------------------------------------------------------ */

export const MECH_PACK_D: readonly MechEntry[] = [
  /* ---------------------------------------------------------------- */
  {
    id: 'stacked-wild-drop',
    name: 'Stacked Wild Drop',
    description:
      'A shadow swallows one reel, then a rigid 3-high WILD stack slams down and the impact chains up through the tiles.',
    async run(ctx: MechContext): Promise<void> {
      const reel = randInt(ctx, 0, ctx.grid.reels - 1);
      const stackN = Math.min(3, ctx.grid.rows);
      const row0 = randInt(ctx, 0, ctx.grid.rows - stackN);
      const rr = ctx.reelRect(reel);
      const gr = ctx.gridRect();

      // SETUP — the board dims and a shadow grows down the reel: something
      // heavy is coming. One telegraph, nothing else moving.
      // SFX: low rumble swell
      ctx.dimBoard(0.4);
      const veil = new Graphics();
      veil.roundRect(0, 0, rr.w, rr.h, 12).fill({ color: 0x000000, alpha: 1 });
      veil.position.set(rr.x, rr.y);
      veil.scale.y = 0;
      veil.alpha = 0;
      ctx.overlay.addChild(veil);
      const vtl = ctx.track(ctx.gsap.timeline());
      vtl.to(veil, { alpha: 0.55, duration: 0.34, ease: 'power2.out' }, 0)
        .to(veil.scale, { y: 1, duration: 0.44, ease: 'power3.out' }, 0);

      // Ground shadow at the landing footprint — grows as the stack nears.
      const footBottom = ctx.cellRect(reel, row0 + stackN - 1);
      const shadow = new Graphics();
      shadow.ellipse(0, 0, footBottom.w * 0.52, footBottom.h * 0.2).fill({ color: 0x000000, alpha: 0.55 });
      shadow.position.set(footBottom.x + footBottom.w / 2, footBottom.y + footBottom.h * 0.86);
      shadow.scale.set(0.25);
      shadow.alpha = 0;
      ctx.overlay.addChild(shadow);
      await wait(480);
      if (!ctx.alive()) return;

      // THE DROP (hero) — three real WILD tiles fall as one rigid stack.
      // Same offset, same tween: a monolith, not three sprites.
      const tiles: Container[] = [];
      const finals: { y: number; sx: number; sy: number }[] = [];
      for (let i = 0; i < stackN; i++) {
        const t = ctx.spawnTile(0, reel, row0 + i, true);
        finals.push({ y: t.y, sx: t.scale.x, sy: t.scale.y });
        tiles.push(t);
      }
      const dy = gr.h * 0.85 + footBottom.h * 1.4;
      tiles.forEach((t) => (t.y -= dy));

      // SFX: accelerating whoosh
      const fall = 0.42;
      tiles.forEach((t, i) => {
        ctx.track(ctx.gsap.to(t, { y: finals[i].y, duration: fall, ease: 'power4.in' }));
      });
      const stl = ctx.track(ctx.gsap.timeline());
      stl.to(shadow, { alpha: 0.75, duration: fall * 0.55, ease: 'power2.in' }, 0)
        .to(shadow.scale, { x: 1, y: 1, duration: fall, ease: 'power3.in' }, 0)
        .to(shadow, { alpha: 0, duration: 0.28, ease: 'power2.out' }, fall + 0.05);
      await wait(fall * 1000);
      if (!ctx.alive()) return;

      // IMPACT — one dominant hit at the bottom, then the compression wave
      // chains UP through the stack: squash, ~0.08s hold, elastic recover.
      // Bottom tile takes the biggest hit; each link up is a touch softer.
      // SFX: triple thunk, heaviest first
      const bc = mid(footBottom);
      ringBurst(ctx, bc.x, bc.y + footBottom.h * 0.3, footBottom.w * 1.25, ctx.accent, 0);
      sparkBurst(ctx, bc.x, bc.y + footBottom.h * 0.34, ctx.gold, 7, footBottom.w * 0.85, 0.02);
      for (let i = stackN - 1; i >= 0; i--) {
        const order = stackN - 1 - i; // 0 = bottom link
        const t = tiles[i];
        const f = finals[i];
        const k = 1 - order * 0.18; // impact softens as it travels up
        const dl = order * jit(ctx, 0.09, 0.25);
        const cr = ctx.cellRect(reel, row0 + i);
        const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
        tl.to(t.scale, { x: f.sx * (1 + 0.16 * k), y: f.sy * (1 - 0.2 * k), duration: 0.07, ease: 'power3.out' }, 0)
          .to(t, { y: f.y + cr.h * 0.045 * k, duration: 0.07, ease: 'power3.out' }, 0)
          // hold the squash a beat — weight lives here
          .to(t.scale, { x: f.sx, y: f.sy, duration: 0.5, ease: 'elastic.out(1, 0.42)' }, 0.16)
          .to(t, { y: f.y, duration: 0.4, ease: 'elastic.out(1, 0.45)' }, 0.16)
          .call(
            () => {
              if (!ctx.alive()) return;
              ctx.setCellSymbol(reel, row0 + i, 0);
            },
            undefined,
            0.02,
          );
        cellFlash(ctx, cr, ctx.gold, dl + 0.03);
      }
      const thunk = new Graphics();
      thunk.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0xffffff, alpha: 0.4 });
      thunk.blendMode = 'add';
      ctx.overlay.addChild(thunk);
      ctx.track(ctx.gsap.to(thunk, { alpha: 0, duration: 0.34, ease: 'power2.in' }));
      await wait(620);
      if (!ctx.alive()) return;

      // RESOLUTION — shadow lifts, the stack breathes once as a unit and
      // stays on the board (sticky) until the next spin clears it.
      ctx.undimBoard();
      ctx.track(ctx.gsap.to(veil, { alpha: 0, duration: 0.4, ease: 'power2.out' }));
      tiles.forEach((t, i) => {
        const f = finals[i];
        const tl = ctx.track(ctx.gsap.timeline({ delay: 0.12 + i * 0.05 }));
        tl.to(t.scale, { x: f.sx * 1.035, y: f.sy * 1.035, duration: 0.16, ease: 'back.out(1.8)' }, 0)
          .to(t.scale, { x: f.sx, y: f.sy, duration: 0.3, ease: 'power2.out' }, 0.16);
      });
      await wait(850);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'symbol-magnet',
    name: 'Symbol Magnet',
    description:
      'Every instance of one symbol lights up, then glides along curved paths to cluster together — and the cluster flashes as one.',
    async run(ctx: MechContext): Promise<void> {
      // Pick a symbol that actually exists 3-6 times; degrade gracefully.
      const byId = new Map<number, Cell[]>();
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const s = ctx.getCellSymbol(reel, row);
          if (s >= 2 && s <= 8) {
            if (!byId.has(s)) byId.set(s, []);
            byId.get(s)!.push({ reel, row });
          }
        }
      }
      let sym = -1;
      let sources: Cell[] = [];
      const good: number[] = [];
      byId.forEach((cells, id) => {
        if (cells.length >= 3 && cells.length <= 6) good.push(id);
      });
      if (good.length > 0) {
        sym = ctx.pick(good);
        sources = byId.get(sym)!;
      } else {
        byId.forEach((cells, id) => {
          if (cells.length >= 2 && (sym < 0 || cells.length > byId.get(sym)!.length) && cells.length <= 7) {
            sym = id;
          }
        });
        if (sym >= 0) sources = byId.get(sym)!.slice(0, 6);
      }
      if (sym < 0) {
        // Board rolled nothing usable — bless 4 cells so the showcase lands.
        sym = ctx.pick([4, 5] as const);
        sources = shuffledCells(ctx).slice(0, 4);
        sources.forEach((c, i) => {
          ctx.setCellSymbol(c.reel, c.row, sym);
          cellFlash(ctx, ctx.cellRect(c.reel, c.row), ctx.accent, i * 0.05);
        });
        await wait(350);
        if (!ctx.alive()) return;
      }

      // Cluster target: BFS out from the sources' centroid so the pack pulls
      // to its own centre of mass.
      const cx = Math.max(0, Math.min(ctx.grid.reels - 1, Math.round(sources.reduce((a, c) => a + c.reel, 0) / sources.length)));
      const cy = Math.max(0, Math.min(ctx.grid.rows - 1, Math.round(sources.reduce((a, c) => a + c.row, 0) / sources.length)));
      const key = (c: Cell) => c.reel * 100 + c.row;
      const cluster: Cell[] = [];
      const seen = new Set<number>();
      const queue: Cell[] = [{ reel: cx, row: cy }];
      seen.add(key(queue[0]));
      while (cluster.length < sources.length && queue.length > 0) {
        const c = queue.shift()!;
        cluster.push(c);
        const nbrs: Cell[] = [
          { reel: c.reel + 1, row: c.row },
          { reel: c.reel - 1, row: c.row },
          { reel: c.reel, row: c.row + 1 },
          { reel: c.reel, row: c.row - 1 },
        ];
        for (const n of nbrs) {
          if (n.reel < 0 || n.reel >= ctx.grid.reels || n.row < 0 || n.row >= ctx.grid.rows) continue;
          if (seen.has(key(n))) continue;
          seen.add(key(n));
          queue.push(n);
        }
      }
      const clusterKeys = new Set(cluster.map(key));
      const sourceKeys = new Set(sources.map(key));
      const movers = sources.filter((s) => !clusterKeys.has(key(s)));
      const freeTargets = cluster.filter((t) => !sourceKeys.has(key(t)));

      // SETUP — dim, and every instance wakes: featured state + a slow halo
      // bloom, staggered with jitter so the wake ripples, not ticks.
      // SFX: rising magnetic hum
      ctx.dimBoard(0.42);
      sources.forEach((s, i) => {
        const cr = ctx.cellRect(s.reel, s.row);
        const c = mid(cr);
        const dl = i * 0.07 + ctx.rand(0, 0.05);
        const halo = glowDot(ctx.accent, Math.max(cr.w, cr.h) * 0.6, 0.85);
        halo.position.set(c.x, c.y);
        halo.alpha = 0;
        halo.scale.set(0.6);
        ctx.overlay.addChild(halo);
        const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
        tl.call(() => {
          if (!ctx.alive()) return;
          ctx.playCellState(s.reel, s.row, 'featured');
        })
          .to(halo, { alpha: 0.9, duration: 0.16, ease: 'power2.out' }, 0)
          .to(halo.scale, { x: 1.15, y: 1.15, duration: 0.55, ease: 'power2.out' }, 0)
          .to(halo, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.4);
      });

      // Destination telegraph — a single inhaling glow at the cluster core.
      const anchorRect = ctx.cellRect(cluster[0].reel, cluster[0].row);
      const ac = mid(anchorRect);
      const core = glowDot(ctx.gold, anchorRect.w * 0.75, 0.9);
      core.position.set(ac.x, ac.y);
      core.alpha = 0;
      core.scale.set(1.4);
      ctx.overlay.addChild(core);
      const ctl = ctx.track(ctx.gsap.timeline({ delay: 0.35 }));
      ctl.to(core, { alpha: 0.8, duration: 0.2, ease: 'power2.out' }, 0)
        .to(core.scale, { x: 0.55, y: 0.55, duration: 0.42, ease: 'power3.in' }, 0.08)
        .to(core, { alpha: 0, duration: 0.12, ease: 'power1.in' }, 0.5);
      await wait(950);
      if (!ctx.alive()) return;

      // THE PULL (hero) — real tiles lift off and glide along curved paths
      // into the cluster. Curves bow perpendicular to the travel line, each
      // its own way; flights overlap but never in lockstep.
      // SFX: whoosh glides, one per tile
      let lastArrive = 0;
      movers.forEach((s, i) => {
        const tgt = freeTargets[i];
        if (!tgt) return;
        const from = mid(ctx.cellRect(s.reel, s.row));
        const toR = ctx.cellRect(tgt.reel, tgt.row);
        const to = mid(toR);
        const dx = to.x - from.x;
        const dyv = to.y - from.y;
        const dist = Math.hypot(dx, dyv) || 1;
        const side = i % 2 === 0 ? 1 : -1;
        const bow = dist * ctx.rand(0.22, 0.42) * side;
        const p1: Pt = {
          x: (from.x + to.x) / 2 + (-dyv / dist) * bow,
          y: (from.y + to.y) / 2 + (dx / dist) * bow - toR.h * 0.25,
        };

        const tile = ctx.spawnTile(sym, s.reel, s.row, false);
        const bsx = tile.scale.x;
        const bsy = tile.scale.y;
        // The board cell "empties" under the moving tile.
        ctx.setCellSymbol(s.reel, s.row, 6 + randInt(ctx, 0, 2));

        const dl = i * 0.09 + ctx.rand(0, 0.06);
        const durFly = jit(ctx, 0.66, 0.15);
        const proxy = { t: 0 };
        const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
        tl
          // lift — slight grow so the tile reads as picked up off the glass
          .to(tile.scale, { x: bsx * 1.08, y: bsy * 1.08, duration: 0.14, ease: 'power2.out' }, 0)
          .to(proxy, {
            t: 1,
            duration: durFly,
            ease: 'power2.inOut',
            onUpdate: () => {
              const p = qBez(from, p1, to, proxy.t);
              tile.position.set(p.x, p.y);
            },
          }, 0.1)
          // arrival — squash into the slot, short hold, elastic recover
          .to(tile.scale, { x: bsx * 1.12, y: bsy * 0.84, duration: 0.07, ease: 'power3.out' }, 0.1 + durFly)
          .call(
            () => {
              if (!ctx.alive()) return;
              ctx.setCellSymbol(tgt.reel, tgt.row, sym);
            },
            undefined,
            0.1 + durFly + 0.02,
          )
          .to(tile.scale, { x: bsx, y: bsy, duration: 0.42, ease: 'elastic.out(1, 0.45)' }, 0.1 + durFly + 0.15)
          // hand off to the (re-skinned) board cell underneath
          .to(tile, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.1 + durFly + 0.4);
        cellFlash(ctx, toR, ctx.accent, dl + 0.1 + durFly);
        lastArrive = Math.max(lastArrive, dl + 0.1 + durFly + 0.55);
      });
      await wait(lastArrive * 1000 + 150);
      if (!ctx.alive()) return;

      // CONNECTION FLASH — the cluster reads as ONE thing: a single gold rim
      // around its footprint pops, every member plays its win state together.
      // SFX: connection chime
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      cluster.forEach((c) => {
        const r = ctx.cellRect(c.reel, c.row);
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = Math.max(maxY, r.y + r.h);
      });
      const rim = new Graphics();
      rim.roundRect(-(maxX - minX) / 2 - 4, -(maxY - minY) / 2 - 4, maxX - minX + 8, maxY - minY + 8, 16)
        .stroke({ color: ctx.gold, width: 4, alpha: 0.95 });
      rim.roundRect(-(maxX - minX) / 2 + 3, -(maxY - minY) / 2 + 3, maxX - minX - 6, maxY - minY - 6, 13)
        .stroke({ color: 0xffffff, width: 1.6, alpha: 0.5 });
      rim.blendMode = 'add';
      rim.position.set((minX + maxX) / 2, (minY + maxY) / 2);
      rim.alpha = 0;
      rim.scale.set(0.94);
      ctx.overlay.addChild(rim);
      const rtl = ctx.track(ctx.gsap.timeline());
      rtl.to(rim, { alpha: 1, duration: 0.08, ease: 'power2.out' }, 0)
        .to(rim.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.8)' }, 0)
        .to(rim, { alpha: 0, duration: 0.55, ease: 'power2.in' }, 0.55);
      cluster.forEach((c) => ctx.playCellState(c.reel, c.row, 'win'));
      ringBurst(ctx, (minX + maxX) / 2, (minY + maxY) / 2, (maxX - minX) * 0.6, ctx.gold, 0.06);
      ctx.undimBoard();
      await wait(1100);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'bomb-scatter',
    name: 'Bomb Scatter',
    description:
      'A bomb thuds down centre-board, a spark eats its fuse, three rising ticks — then a 3x3 blast flips the area to one symbol under a dust ring.',
    async run(ctx: MechContext): Promise<void> {
      // Centre-ish cell, clamped so the 3x3 footprint always fits.
      const creel = Math.max(1, Math.min(ctx.grid.reels - 2, Math.floor(ctx.grid.reels / 2) + randInt(ctx, -1, 1)));
      const crow = Math.max(1, Math.min(ctx.grid.rows - 2, Math.floor(ctx.grid.rows / 2)));
      const cr = ctx.cellRect(creel, crow);
      const c = mid(cr);
      const br = Math.min(cr.w, cr.h) * 0.36;

      // SETUP — dim; a ground shadow blooms where the bomb will land.
      ctx.dimBoard(0.48);
      const shadow = new Graphics();
      shadow.ellipse(0, 0, br * 1.5, br * 0.55).fill({ color: 0x000000, alpha: 0.5 });
      shadow.position.set(c.x, c.y + cr.h * 0.3);
      shadow.scale.set(0.25);
      shadow.alpha = 0;
      ctx.overlay.addChild(shadow);

      // The bomb — layered sphere: black body, accent rim light, specular.
      const bomb = new Container();
      const body = new Graphics();
      body.circle(0, 0, br).fill({ color: 0x000000, alpha: 0.97 });
      body.circle(0, 0, br).stroke({ color: ctx.accent, width: 3, alpha: 0.55 });
      body.circle(-br * 0.32, -br * 0.32, br * 0.3).fill({ color: 0xffffff, alpha: 0.14 });
      const cap = new Graphics();
      cap.roundRect(-br * 0.2, -br * 1.18, br * 0.4, br * 0.34, 3).fill({ color: ctx.gold, alpha: 0.95 });
      bomb.addChild(cap, body);
      bomb.position.set(c.x, c.y - ctx.gridRect().h * 0.75);
      ctx.overlay.addChild(bomb);

      // Drop — power4.in, hard squash, ~0.08s hold, elastic recover.
      // SFX: heavy metal thunk
      const drop = 0.4;
      const dtl = ctx.track(ctx.gsap.timeline());
      dtl.to(bomb, { y: c.y, duration: drop, ease: 'power4.in' }, 0)
        .to(bomb.scale, { x: 1.18, y: 0.78, duration: 0.07, ease: 'power3.out' }, drop)
        .to(bomb.scale, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, drop + 0.15);
      const shtl = ctx.track(ctx.gsap.timeline());
      shtl.to(shadow, { alpha: 0.7, duration: drop * 0.6, ease: 'power2.in' }, 0)
        .to(shadow.scale, { x: 1, y: 1, duration: drop, ease: 'power3.in' }, 0)
        .to(shadow, { alpha: 0.3, duration: 0.3, ease: 'power2.out' }, drop + 0.1);
      ringBurst(ctx, c.x, c.y + cr.h * 0.24, cr.w * 0.7, ctx.accent, drop + 0.01);
      await wait((drop + 0.45) * 1000);
      if (!ctx.alive()) return;

      // THE FUSE (hero build-up) — a rope curls off the bomb cap; a hot spark
      // crawls DOWN it, eating the rope as it goes, shedding tiny drips.
      // SFX: fuse hiss
      const f0: Pt = { x: c.x + br * 0.1, y: c.y - br * 1.05 };
      const f1: Pt = { x: c.x + br * 2.3, y: c.y - br * 2.6 };
      const f2: Pt = { x: c.x + br * 0.7, y: c.y - br * 3.9 };
      const SAMPLES = 26;
      const pts: Pt[] = [];
      for (let i = 0; i <= SAMPLES; i++) pts.push(qBez(f0, f1, f2, i / SAMPLES));
      const rope = new Graphics();
      const drawRope = (upTo: number) => {
        rope.clear();
        const n = Math.max(1, Math.round(upTo * SAMPLES));
        rope.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= n; i++) rope.lineTo(pts[i].x, pts[i].y);
        rope.stroke({ color: 0xffffff, width: 2.5, alpha: 0.4 });
      };
      drawRope(1);
      rope.alpha = 0;
      ctx.overlay.addChild(rope);
      ctx.track(ctx.gsap.to(rope, { alpha: 1, duration: 0.16, ease: 'power1.out' }));

      const spark = glowDot(ctx.gold, 8, 1);
      spark.position.set(f2.x, f2.y);
      ctx.overlay.addChild(spark);
      const flick = ctx.track(
        ctx.gsap.to(spark.scale, { x: 1.3, y: 1.3, duration: 0.09, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
      );
      const crawl = { t: 1 };
      let dripGate = 0;
      const crawlDur = 1.15;
      ctx.track(
        ctx.gsap.to(crawl, {
          t: 0,
          duration: crawlDur,
          ease: 'power1.in',
          onUpdate: () => {
            const p = qBez(f0, f1, f2, crawl.t);
            spark.position.set(p.x, p.y);
            drawRope(crawl.t);
            if (++dripGate % 9 === 0 && ctx.rand(0, 1) < 0.7) {
              const drip = glowDot(ctx.gold, ctx.rand(2, 3.5), 0.8);
              drip.position.set(p.x + ctx.rand(-3, 3), p.y);
              ctx.overlay.addChild(drip);
              const dl = ctx.track(ctx.gsap.timeline());
              dl.to(drip, { y: p.y + ctx.rand(10, 22), duration: 0.32, ease: 'power2.in' }, 0)
                .to(drip, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.08);
            }
          },
        }),
      );
      await wait(crawlDur * 1000);
      if (!ctx.alive()) return;
      flick.kill();
      ctx.track(ctx.gsap.to(spark, { alpha: 0, duration: 0.1, ease: 'power1.in' }));

      // THREE ESCALATING TICKS — each pulse bigger, brighter, sooner.
      // SFX: tick 1 (low) / tick 2 (mid) / tick 3 (high, urgent)
      const ticks = [
        { at: 0, amp: 1.07, glow: 0.35 },
        { at: 0.34, amp: 1.14, glow: 0.55 },
        { at: 0.6, amp: 1.24, glow: 0.85 },
      ];
      const ttl = ctx.track(ctx.gsap.timeline());
      ticks.forEach((k, i) => {
        ttl.to(bomb.scale, { x: k.amp, y: k.amp, duration: 0.06, ease: 'power2.out' }, k.at)
          .to(bomb.scale, { x: 1, y: 1, duration: 0.14, ease: 'power2.in' }, k.at + 0.07);
        const flash = glowDot(0xffffff, br * 1.7, k.glow);
        flash.position.set(c.x, c.y);
        flash.alpha = 0;
        ctx.overlay.addChild(flash);
        ttl.to(flash, { alpha: 1, duration: 0.05, ease: 'power1.out' }, k.at)
          .to(flash, { alpha: 0, duration: 0.16, ease: 'power2.in' }, k.at + 0.06);
        if (i === 2) ringBurst(ctx, c.x, c.y, br * 2.4, ctx.gold, k.at + 0.02);
      });
      await wait(880);
      if (!ctx.alive()) return;

      // DETONATION (payoff) — white bloom, the bomb ceases to exist, and the
      // 3x3 flips to ONE symbol radiating out from the centre. A slow flat
      // dust ring rolls out underneath so the blast has ground contact.
      // SFX: deep detonation + debris patter
      const sym = ctx.pick([2, 3, 4] as const);
      const a0 = ctx.cellRect(creel - 1, crow - 1);
      const a1 = ctx.cellRect(creel + 1, crow + 1);
      const areaW = a1.x + a1.w - a0.x;
      const areaH = a1.y + a1.h - a0.y;
      const wash = new Graphics();
      wash.roundRect(a0.x, a0.y, areaW, areaH, 16).fill({ color: 0xffffff, alpha: 0.55 });
      wash.roundRect(a0.x + areaW * 0.3, a0.y + areaH * 0.3, areaW * 0.4, areaH * 0.4, 12).fill({ color: 0xffffff, alpha: 0.4 });
      wash.blendMode = 'add';
      ctx.overlay.addChild(wash);
      ctx.track(ctx.gsap.to(wash, { alpha: 0, duration: 0.5, ease: 'power2.in' }));
      const btl = ctx.track(ctx.gsap.timeline());
      btl.to(bomb.scale, { x: 1.4, y: 1.4, duration: 0.07, ease: 'power2.out' }, 0)
        .to(bomb, { alpha: 0, duration: 0.07, ease: 'power1.in' }, 0.04);
      ctx.track(ctx.gsap.to(shadow, { alpha: 0, duration: 0.3, ease: 'power2.in' }));
      ringBurst(ctx, c.x, c.y, Math.hypot(areaW, areaH) * 0.62, ctx.accent, 0.02);
      ringBurst(ctx, c.x, c.y, Math.hypot(areaW, areaH) * 0.4, ctx.gold, 0.1);
      sparkBurst(ctx, c.x, c.y, ctx.gold, 11, areaW * 0.7, 0.04);

      // Dust ring — flattened, non-additive, slow: smoke, not laser.
      const dust = new Graphics();
      dust.circle(0, 0, 40).stroke({ color: 0xffffff, width: 20, alpha: 0.12 });
      dust.circle(0, 0, 34).stroke({ color: 0x000000, width: 10, alpha: 0.18 });
      dust.position.set(c.x, c.y + cr.h * 0.2);
      dust.scale.set(0.2, 0.12);
      ctx.overlay.addChild(dust);
      const dutl = ctx.track(ctx.gsap.timeline({ delay: 0.05 }));
      dutl.to(dust.scale, { x: (areaW * 0.72) / 40, y: (areaW * 0.72) / 40 * 0.45, duration: 0.95, ease: 'power2.out' }, 0)
        .to(dust, { y: dust.y - 8, duration: 0.95, ease: 'power1.out' }, 0)
        .to(dust, { alpha: 0, duration: 0.6, ease: 'power2.in' }, 0.35);

      // The flip radiates: centre first, edges, then corners.
      for (let dr = -1; dr <= 1; dr++) {
        for (let dw = -1; dw <= 1; dw++) {
          const ring = Math.abs(dr) + Math.abs(dw); // 0 centre, 1 edge, 2 corner
          const dl = ring * 0.06 + ctx.rand(0, 0.03);
          const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
          tl.call(() => {
            if (!ctx.alive()) return;
            ctx.setCellSymbol(creel + dr, crow + dw, sym);
            ctx.playCellState(creel + dr, crow + dw, 'featured');
          });
          if (ring > 0) cellFlash(ctx, ctx.cellRect(creel + dr, crow + dw), ctx.gold, dl);
        }
      }
      await wait(400);
      if (!ctx.alive()) return;
      ctx.undimBoard();
      await wait(900);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'neon-roulette',
    name: 'Neon Roulette',
    description:
      'A neon frame races the grid perimeter, loses speed lap by lap, overshoots one cell, ticks back — and the winner upgrades to a premium.',
    async run(ctx: MechContext): Promise<void> {
      // Perimeter cells, clockwise from top-left.
      const per: Cell[] = [];
      for (let r = 0; r < ctx.grid.reels; r++) per.push({ reel: r, row: 0 });
      for (let w = 1; w < ctx.grid.rows; w++) per.push({ reel: ctx.grid.reels - 1, row: w });
      for (let r = ctx.grid.reels - 2; r >= 0; r--) per.push({ reel: r, row: ctx.grid.rows - 1 });
      for (let w = ctx.grid.rows - 2; w >= 1; w--) per.push({ reel: 0, row: w });
      const P = per.length;
      const rects = per.map((cl) => ctx.cellRect(cl.reel, cl.row));

      // SETUP — dim, then one quick priming lap of faint rim flashes so the
      // track itself reads before the race starts.
      // SFX: neon strip power-up
      ctx.dimBoard(0.45);
      per.forEach((_, i) => {
        const r = rects[i];
        const g = new Graphics();
        g.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 12).stroke({ color: ctx.accent, width: 2, alpha: 0.5 });
        g.blendMode = 'add';
        g.position.set(r.x + r.w / 2, r.y + r.h / 2);
        g.alpha = 0;
        ctx.overlay.addChild(g);
        const tl = ctx.track(ctx.gsap.timeline({ delay: i * 0.022 }));
        tl.to(g, { alpha: 0.8, duration: 0.05, ease: 'power1.out' }, 0)
          .to(g, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.06);
      });
      await wait(P * 22 + 420);
      if (!ctx.alive()) return;

      // The runner — a layered neon frame (halo / body / white rim / hot
      // core) that JUMPS cell to cell like a physical roulette light.
      const frame = new Container();
      const fh = new Graphics();
      fh.roundRect(-57, -57, 114, 114, 18).fill({ color: ctx.accent, alpha: 0.12 });
      const fb = new Graphics();
      fb.roundRect(-50, -50, 100, 100, 14).fill({ color: ctx.accent, alpha: 0.17 });
      const fr = new Graphics();
      fr.roundRect(-50, -50, 100, 100, 14).stroke({ color: 0xffffff, width: 2.5, alpha: 0.9 });
      const fc = new Graphics();
      fc.roundRect(-19, -19, 38, 38, 8).fill({ color: 0xffffff, alpha: 0.2 });
      fh.blendMode = 'add';
      fb.blendMode = 'add';
      fr.blendMode = 'add';
      fc.blendMode = 'add';
      frame.addChild(fh, fb, fr, fc);
      const place = (idx: number) => {
        const r = rects[idx];
        frame.position.set(r.x + r.w / 2, r.y + r.h / 2);
        frame.scale.set(r.w / 100, r.h / 100);
      };
      place(0);
      frame.alpha = 0;
      ctx.overlay.addChild(frame);
      ctx.track(ctx.gsap.to(frame, { alpha: 1, duration: 0.12, ease: 'power2.out' }));

      // THE RACE (hero) — steps decelerate on a quartic curve: a blur of
      // clicks at first, agonising single clacks at the end. The runner
      // overshoots the winner by ONE cell (ball physics), then ticks back.
      // SFX: click ... click ... clack — decelerating
      const laps = P > 14 ? 1 : 2;
      const targetIdx = randInt(ctx, 0, P - 1);
      const steps = laps * P + targetIdx + 1; // +1 = the overshoot cell
      const tl = ctx.track(ctx.gsap.timeline());
      let acc = 0;
      for (let i = 1; i <= steps; i++) {
        const x = i / steps;
        acc += 0.042 + 0.32 * Math.pow(x, 4) * ctx.rand(0.94, 1.06);
        const idx = i % P;
        const prev = (i - 1) % P;
        tl.call(
          () => {
            if (!ctx.alive()) return;
            place(idx);
            // echo left behind at the previous cell — the light's tail
            const pr = rects[prev];
            const e = new Graphics();
            e.roundRect(-pr.w / 2, -pr.h / 2, pr.w, pr.h, 12).stroke({ color: ctx.accent, width: 2.5, alpha: 0.6 });
            e.blendMode = 'add';
            e.position.set(pr.x + pr.w / 2, pr.y + pr.h / 2);
            ctx.overlay.addChild(e);
            const et = ctx.track(ctx.gsap.timeline());
            et.to(e.scale, { x: 1.07, y: 1.07, duration: 0.24, ease: 'power1.out' }, 0)
              .to(e, { alpha: 0, duration: 0.24, ease: 'power2.in' }, 0.02);
          },
          undefined,
          acc,
        );
      }
      await wait(acc * 1000 + 60);
      if (!ctx.alive()) return;

      // Overshot. Held breath — the frame dims a touch and sits there.
      ctx.track(ctx.gsap.to(frame, { alpha: 0.65, duration: 0.18, ease: 'power2.out' }));
      await wait(340);
      if (!ctx.alive()) return;

      // Tick BACK onto the winner.
      // SFX: soft settle clunk
      place(targetIdx);
      ctx.track(ctx.gsap.to(frame, { alpha: 1, duration: 0.1, ease: 'power2.out' }));
      const bsx = frame.scale.x;
      const bsy = frame.scale.y;
      const stl = ctx.track(ctx.gsap.timeline({ delay: 0.02 }));
      stl.to(frame.scale, { x: bsx * 0.93, y: bsy * 0.93, duration: 0.07, ease: 'power2.in' }, 0)
        .to(frame.scale, { x: bsx * 1.08, y: bsy * 1.08, duration: 0.18, ease: 'back.out(2.4)' }, 0.07)
        .to(frame.scale, { x: bsx, y: bsy, duration: 0.3, ease: 'power2.out' }, 0.25);
      await wait(550);
      if (!ctx.alive()) return;

      // JACKPOT MOMENT (payoff) — the winning cell upgrades to a premium:
      // gold flash, win state, one ring, one glint. Everything else stays put.
      // SFX: jackpot ding
      const win = per[targetIdx];
      const wr = rects[targetIdx];
      const wc = mid(wr);
      ctx.setCellSymbol(win.reel, win.row, 2);
      ctx.playCellState(win.reel, win.row, 'win');
      cellFlash(ctx, wr, ctx.gold, 0);
      ringBurst(ctx, wc.x, wc.y, wr.w * 1.1, ctx.gold, 0.08);
      sparkBurst(ctx, wc.x, wc.y, ctx.gold, 7, wr.w * 0.75, 0.1);
      const gtl = ctx.track(ctx.gsap.timeline({ delay: 0.05 }));
      gtl.to(frame.scale, { x: bsx * 1.12, y: bsy * 1.12, duration: 0.2, ease: 'back.out(2)' }, 0)
        .to(frame, { alpha: 0, duration: 0.6, ease: 'power2.in' }, 0.4)
        .to(frame.scale, { x: bsx * 1.2, y: bsy * 1.2, duration: 0.6, ease: 'power1.out' }, 0.4);
      ctx.undimBoard();
      await wait(1150);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'vault-crack',
    name: 'Vault Crack',
    description:
      'A vault door slams over the middle reel; the wheel spins, three cracks of light split the steel — then it blasts apart to reveal a reel of WILDs.',
    async run(ctx: MechContext): Promise<void> {
      const reel = Math.floor(ctx.grid.reels / 2);
      const rr = ctx.reelRect(reel);
      const cx = rr.x + rr.w / 2;
      const cy = rr.y + rr.h / 2;
      const R = rr.w * 0.44;

      // Build the door in local coords centred on (0,0) so the root can be
      // slammed by scale. Two full drawings, each masked to a half by a
      // CHILD mask — the mask travels with the half when it blasts off.
      const drawDoor = (g: Graphics) => {
        g.roundRect(-rr.w / 2, -rr.h / 2, rr.w, rr.h, 12).fill({ color: 0x000000, alpha: 0.97 });
        g.roundRect(-rr.w / 2, -rr.h / 2, rr.w, rr.h, 12).fill({ color: ctx.accent, alpha: 0.08 });
        g.roundRect(-rr.w / 2 + 3, -rr.h / 2 + 3, rr.w - 6, rr.h - 6, 10).stroke({ color: 0xffffff, width: 1.5, alpha: 0.15 });
        // face plate rings
        g.circle(0, 0, R).fill({ color: 0x000000, alpha: 0.9 });
        g.circle(0, 0, R).stroke({ color: ctx.gold, width: 5, alpha: 0.95 });
        g.circle(0, 0, R * 0.8).stroke({ color: 0xffffff, width: 2, alpha: 0.25 });
        g.circle(0, 0, R * 0.56).stroke({ color: ctx.accent, width: 3, alpha: 0.35 });
        // bolts around the face
        const bR = Math.min(R * 1.28, rr.w / 2 - 8);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
          g.circle(Math.cos(a) * bR, Math.sin(a) * bR, 4).fill({ color: ctx.gold, alpha: 0.55 });
        }
        // top and bottom rivet strips so the tall plate reads as steel
        for (let k = 0; k < 3; k++) {
          const yy = -rr.h / 2 + 18 + k * 14;
          g.circle(-rr.w / 2 + 12, yy, 2.5).fill({ color: 0xffffff, alpha: 0.22 });
          g.circle(rr.w / 2 - 12, yy, 2.5).fill({ color: 0xffffff, alpha: 0.22 });
          g.circle(-rr.w / 2 + 12, rr.h / 2 - 18 - k * 14, 2.5).fill({ color: 0xffffff, alpha: 0.22 });
          g.circle(rr.w / 2 - 12, rr.h / 2 - 18 - k * 14, 2.5).fill({ color: 0xffffff, alpha: 0.22 });
        }
      };
      const root = new Container();
      root.position.set(cx, cy);
      const mkHalf = (left: boolean) => {
        const half = new Container();
        const art = new Graphics();
        drawDoor(art);
        const m = new Graphics();
        m.rect(left ? -rr.w / 2 : 0, -rr.h / 2, rr.w / 2, rr.h).fill({ color: 0xffffff });
        half.addChild(art, m);
        half.mask = m;
        return half;
      };
      const doorL = mkHalf(true);
      const doorR = mkHalf(false);

      // The handle — hub, ring, three full-diameter spokes.
      const handle = new Container();
      const hRing = new Graphics();
      hRing.circle(0, 0, R * 0.62).stroke({ color: ctx.gold, width: 6, alpha: 1 });
      hRing.circle(0, 0, R * 0.62).stroke({ color: 0xffffff, width: 1.5, alpha: 0.4 });
      handle.addChild(hRing);
      for (let k = 0; k < 3; k++) {
        const spoke = new Graphics();
        spoke.roundRect(-R * 0.62, -4, R * 1.24, 8, 4).fill({ color: ctx.gold, alpha: 0.95 });
        spoke.rotation = (k * Math.PI) / 3;
        handle.addChild(spoke);
      }
      const hub = new Graphics();
      hub.circle(0, 0, R * 0.16).fill({ color: ctx.gold, alpha: 1 });
      hub.circle(0, 0, R * 0.07).fill({ color: 0xffffff, alpha: 0.85 });
      handle.addChild(hub);
      root.addChild(doorL, doorR, handle);

      // SETUP — dim, and the door slams ON from the viewer: big -> 1 with
      // power4.in, dust ring on contact. The reel is now sealed.
      // SFX: vault door slam
      ctx.dimBoard(0.5);
      root.alpha = 0;
      root.scale.set(1.35);
      ctx.overlay.addChild(root);
      const in1 = ctx.track(ctx.gsap.timeline());
      in1.to(root, { alpha: 1, duration: 0.09, ease: 'power1.out' }, 0)
        .to(root.scale, { x: 1, y: 1, duration: 0.26, ease: 'power4.in' }, 0.06)
        .to(root.scale, { x: 1.03, y: 0.97, duration: 0.06, ease: 'power3.out' }, 0.32)
        .to(root.scale, { x: 1, y: 1, duration: 0.4, ease: 'elastic.out(1, 0.45)' }, 0.46);
      ringBurst(ctx, cx, cy, rr.w * 1.05, ctx.accent, 0.33);
      sparkBurst(ctx, cx, cy + rr.h * 0.3, 0xffffff, 5, rr.w * 0.5, 0.34);
      await wait(800);
      if (!ctx.alive()) return;

      // THE CRACK (build-up) — three wheel spins, each harder: wind-up
      // counter-rotation, a fast spin into a clunk stop, and a jagged slit
      // of light splitting the steel. Tremble grows with every crack.
      const cracks: Graphics[] = [];
      const mkCrack = (i: number): Graphics => {
        const g = new Graphics();
        const x0 = -rr.w * 0.5;
        const segs = 5 + i * 2;
        let px = x0;
        let py = (i - 1) * rr.h * 0.22 + ctx.rand(-10, 10);
        g.moveTo(px, py);
        for (let k = 1; k <= segs; k++) {
          px = x0 + (rr.w * k) / segs;
          py += ctx.rand(-rr.h * 0.05, rr.h * 0.05);
          g.lineTo(px, py);
        }
        g.stroke({ color: 0xffffff, width: 2 + i, alpha: 0.9 });
        g.blendMode = 'add';
        g.alpha = 0;
        return g;
      };
      for (let i = 0; i < 3; i++) {
        const T = jit(ctx, 1, 0.12);
        const wind = 0.12 * T;
        const spin = (0.28 - i * 0.05) * T;
        // SFX: mechanism spin + clunk (harder each round)
        const htl = ctx.track(ctx.gsap.timeline());
        htl.to(handle, { rotation: handle.rotation - 0.22, duration: wind, ease: 'power2.out' }, 0)
          .to(handle, { rotation: handle.rotation + Math.PI * (1.1 + i * 0.35), duration: spin, ease: 'power3.in' }, wind)
          .to(handle, { rotation: `-=${0.08}`, duration: 0.09, ease: 'power2.out' }, wind + spin)
          .to(handle, { rotation: `+=${0.08}`, duration: 0.16, ease: 'elastic.out(1, 0.4)' }, wind + spin + 0.09);
        // crack flash at the clunk
        // SFX: metal crack (louder each time)
        const crack = mkCrack(i);
        cracks.push(crack);
        root.addChild(crack);
        const ctl = ctx.track(ctx.gsap.timeline({ delay: wind + spin }));
        ctl.to(crack, { alpha: 1, duration: 0.05, ease: 'power1.out' }, 0)
          .to(crack, { alpha: 0.25 + i * 0.18, duration: 0.3, ease: 'power2.in' }, 0.08);
        // tremble grows with each crack
        const amp = 1.5 + i * 1.6;
        const rtl = ctx.track(ctx.gsap.timeline({ delay: wind + spin }));
        rtl.to(root, { x: cx - amp, duration: 0.04, ease: 'power2.out' }, 0)
          .to(root, { x: cx + amp, duration: 0.05, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0.04)
          .to(root, { x: cx, duration: 0.06, ease: 'sine.out' }, 0.28);
        const glow = glowDot(ctx.gold, R * (0.9 + i * 0.3), 0.5 + i * 0.2);
        glow.position.set(cx, cy);
        glow.alpha = 0;
        ctx.overlay.addChild(glow);
        const gtl = ctx.track(ctx.gsap.timeline({ delay: wind + spin }));
        gtl.to(glow, { alpha: 0.8, duration: 0.06, ease: 'power1.out' }, 0)
          .to(glow, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.08);
        await wait((wind + spin + 0.42) * 1000);
        if (!ctx.alive()) return;
      }

      // Hidden swap while sealed — the reel becomes WILDs behind the door.
      for (let row = 0; row < ctx.grid.rows; row++) ctx.setCellSymbol(reel, row, 0);

      // Pre-blast inhale: the door bulges, light screams through the cracks.
      // SFX: pressurised groan
      const inh = ctx.track(ctx.gsap.timeline());
      inh.to(root.scale, { x: 1.035, y: 1.035, duration: 0.22, ease: 'power2.out' }, 0);
      cracks.forEach((cr2) => ctx.track(ctx.gsap.to(cr2, { alpha: 1, duration: 0.22, ease: 'power2.in' })));
      await wait(300);
      if (!ctx.alive()) return;

      // THE BLAST (payoff) — the door splits: halves kick apart and
      // accelerate off opposite sides, the handle blows straight at the
      // viewer. One white sheet, one shockwave, WILD reel revealed.
      // SFX: explosive breach
      cracks.forEach((cr2) => ctx.track(ctx.gsap.to(cr2, { alpha: 0, duration: 0.08, ease: 'power1.in' })));
      const bl = ctx.track(ctx.gsap.timeline());
      bl.to(doorL, { x: -rr.w * 0.18, duration: 0.07, ease: 'power2.out' }, 0)
        .to(doorL, { x: -rr.w * 2.4, rotation: -0.55, duration: 0.5, ease: 'power2.in' }, 0.07)
        .to(doorL, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.27);
      const br2 = ctx.track(ctx.gsap.timeline());
      br2.to(doorR, { x: rr.w * 0.18, duration: 0.07, ease: 'power2.out' }, 0)
        .to(doorR, { x: rr.w * 2.4, rotation: 0.55, duration: 0.5, ease: 'power2.in' }, 0.07)
        .to(doorR, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.27);
      const hb = ctx.track(ctx.gsap.timeline());
      hb.to(handle.scale, { x: 1.7, y: 1.7, duration: 0.3, ease: 'power2.in' }, 0)
        .to(handle, { rotation: handle.rotation + 1.4, duration: 0.3, ease: 'power1.in' }, 0)
        .to(handle, { alpha: 0, duration: 0.22, ease: 'power2.in' }, 0.1);
      const sheet = new Graphics();
      sheet.roundRect(rr.x, rr.y, rr.w, rr.h, 12).fill({ color: 0xffffff, alpha: 0.6 });
      sheet.blendMode = 'add';
      ctx.overlay.addChild(sheet);
      ctx.track(ctx.gsap.to(sheet, { alpha: 0, duration: 0.45, ease: 'power2.in' }));
      ringBurst(ctx, cx, cy, rr.h * 0.55, ctx.accent, 0.03);
      ringBurst(ctx, cx, cy, rr.h * 0.35, ctx.gold, 0.12);
      sparkBurst(ctx, cx, cy, ctx.gold, 11, rr.w * 1.3, 0.05);
      await wait(220);
      if (!ctx.alive()) return;

      // REVEAL — the WILDs light up top to bottom; a gold rim frames the
      // breached reel and stays (sticky) until the next spin clears it.
      // SFX: riser + per-row shine
      for (let row = 0; row < ctx.grid.rows; row++) {
        const dl = row * 0.07 + ctx.rand(0, 0.03);
        const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
        tl.call(() => {
          if (!ctx.alive()) return;
          ctx.playCellState(reel, row, 'featured');
        });
        cellFlash(ctx, ctx.cellRect(reel, row), ctx.gold, dl);
      }
      ctx.undimBoard();
      const rim = new Graphics();
      rim.roundRect(-rr.w / 2, -rr.h / 2, rr.w, rr.h, 12).stroke({ color: ctx.gold, width: 4, alpha: 0.95 });
      rim.roundRect(-rr.w / 2 + 6, -rr.h / 2 + 6, rr.w - 12, rr.h - 12, 9).stroke({ color: 0xffffff, width: 1.5, alpha: 0.4 });
      rim.blendMode = 'add';
      rim.position.set(cx, cy);
      rim.alpha = 0;
      rim.scale.set(1.08);
      ctx.overlay.addChild(rim);
      const rtl2 = ctx.track(ctx.gsap.timeline({ delay: 0.15 }));
      rtl2.to(rim, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0)
        .to(rim.scale, { x: 1, y: 1, duration: 0.32, ease: 'back.out(1.8)' }, 0)
        .to(rim, { alpha: 0.8, duration: 0.3, ease: 'sine.inOut' }, 0.6);
      await wait(1050);
    },
  },
];
