// packSymbol — 8 symbol-level showcase effects: per-cell overlays that flip,
// pop, hop, flash, drop, sweep, orbit and quake across the grid. Every effect
// is theme-agnostic (ctx.accent / ctx.gold), grid-relative (cellRect/reelRect/
// gridRect) and outcome-neutral — pure cosmetic juice layered above the reels.
//
// Contract: src/game/effects/fxTypes.ts. All tweens/timelines are registered
// via ctx.track() so the runner can cancel them; everything added to ctx.layer
// is auto-destroyed by the runner (we never destroy the layer ourselves).

import { Container, Graphics } from 'pixi.js';
import type { FxContext, FxEntry, FxRect } from '../fxTypes';

type Cell = { reel: number; row: number };
type Pt = { x: number; y: number };

// ---------------------------------------------------------------- helpers --

function mid(rc: FxRect): Pt {
  return { x: rc.x + rc.w / 2, y: rc.y + rc.h / 2 };
}

/** Layered additive glow orb — wide soft halo, mid body, hot core, white pin. */
function glowDot(color: number, r: number): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.13 });
  g.circle(0, 0, r * 0.62).fill({ color, alpha: 0.34 });
  g.circle(0, 0, r * 0.34).fill({ color, alpha: 0.6 });
  g.circle(0, 0, r * 0.15).fill({ color: 0xffffff, alpha: 0.85 });
  g.blendMode = 'add';
  return g;
}

/** All cells in S-order: row 0 left→right, row 1 right→left, … */
function serpentine(ctx: FxContext): Cell[] {
  const out: Cell[] = [];
  for (let row = 0; row < ctx.grid.rows; row++) {
    if (row % 2 === 0) {
      for (let reel = 0; reel < ctx.grid.reels; reel++) out.push({ reel, row });
    } else {
      for (let reel = ctx.grid.reels - 1; reel >= 0; reel--) out.push({ reel, row });
    }
  }
  return out;
}

/** N distinct random cells (cosmetic randomness via ctx.rand only). */
function pickCells(ctx: FxContext, count: number): Cell[] {
  const all: Cell[] = [];
  for (let reel = 0; reel < ctx.grid.reels; reel++) {
    for (let row = 0; row < ctx.grid.rows; row++) all.push({ reel, row });
  }
  const out: Cell[] = [];
  const n = Math.min(count, all.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.min(all.length - 1, Math.floor(ctx.rand(0, all.length)));
    out.push(all.splice(idx, 1)[0]);
  }
  return out;
}

/** 4-neighbours of a cell inside the grid, avoiding an optional previous cell. */
function neighbours(ctx: FxContext, cell: Cell, avoid: Cell | null): Cell[] {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const cand: Cell[] = [];
  for (const [dr, dw] of dirs) {
    const reel = cell.reel + dr;
    const row = cell.row + dw;
    if (reel < 0 || reel >= ctx.grid.reels || row < 0 || row >= ctx.grid.rows) continue;
    if (avoid && reel === avoid.reel && row === avoid.row) continue;
    cand.push({ reel, row });
  }
  if (cand.length === 0) cand.push(avoid ?? cell); // dead end → bounce back
  return cand;
}

// ------------------------------------------------------------------- pack --

export const FX_PACK_SYMBOL: readonly FxEntry[] = [
  // 1 ───────────────────────────────────────────────────── cell flip wave ──
  {
    id: 'symbol-cell-flip-wave',
    name: 'Cell Flip Wave',
    group: 'symbol',
    description: 'Every cell does a quick horizontal card-flip, rippling diagonally across the grid.',
    run(ctx) {
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const rc = ctx.cellRect(reel, row);
          const c = new Container();
          const p = mid(rc);
          c.position.set(p.x, p.y);

          const pw = rc.w * 0.84;
          const ph = rc.h * 0.84;
          const rad = Math.min(pw, ph) * 0.14;

          // layered halo — wide soft wash, then a tighter mid band
          const haloWide = new Graphics();
          haloWide
            .roundRect(-pw / 2 - 14, -ph / 2 - 14, pw + 28, ph + 28, rad + 14)
            .fill({ color: ctx.accent, alpha: 0.11 });
          haloWide.blendMode = 'add';
          const haloMid = new Graphics();
          haloMid
            .roundRect(-pw / 2 - 5, -ph / 2 - 5, pw + 10, ph + 10, rad + 5)
            .fill({ color: ctx.accent, alpha: 0.2 });
          haloMid.blendMode = 'add';

          const card = new Graphics();
          card
            .roundRect(-pw / 2, -ph / 2, pw, ph, rad)
            .fill({ color: ctx.accent, alpha: 0.24 })
            .stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
          // subtle top sheen so the face reads as a lit surface, not a flat fill
          const sheen = new Graphics();
          sheen
            .roundRect(-pw / 2 + 3, -ph / 2 + 3, pw - 6, ph * 0.2, rad * 0.6)
            .fill({ color: 0xffffff, alpha: 0.07 });

          // bright vertical spine — sells the hinge of the flip
          const spine = new Graphics();
          spine.roundRect(-1.5, -ph / 2, 3, ph, 1.5).fill({ color: 0xffffff, alpha: 0.85 });
          spine.blendMode = 'add';
          spine.scale.y = 0;

          c.addChild(haloWide, haloMid, card, sheen, spine);
          c.scale.set(0, 0.86); // closed + slightly compressed = coiled energy
          c.alpha = 0;
          ctx.layer.addChild(c);

          // diagonal ripple with organic per-cell jitter (never a metronome)
          const delay = (reel + row) * 0.055 * ctx.rand(0.85, 1.15);
          const tl = ctx.track(ctx.gsap.timeline({ delay }));
          // anticipation: hinge glints first, a beat before the card opens
          tl.to(c, { alpha: 1, duration: 0.05, ease: 'none' }, 0)
            .to(spine.scale, { y: 1, duration: 0.09, ease: 'power2.out' }, 0)
            // open with weight: back overshoot on x, vertical inhale settles
            .to(c.scale, { x: 1, duration: 0.24, ease: 'back.out(1.9)' }, 0.06)
            .to(c.scale, { y: 1, duration: 0.2, ease: 'back.out(1.5)' }, 0.08)
            .to(spine, { alpha: 0.25, duration: 0.16, ease: 'power2.out' }, 0.14)
            // hold ~0.1s, then anticipate the close: brief widen before the snap
            .to(c.scale, { x: 1.06, duration: 0.08, ease: 'power1.out' }, 0.36)
            .to(spine, { alpha: 0.85, duration: 0.07, ease: 'power2.in' }, 0.38)
            .to(c.scale, { x: 0, duration: 0.13, ease: 'power3.in' }, 0.44)
            .to(c.scale, { y: 0.9, duration: 0.13, ease: 'power2.in' }, 0.44)
            .to(c, { alpha: 0, duration: 0.11, ease: 'power2.in' }, 0.47);
        }
      }
    },
  },

  // 2 ──────────────────────────────────────────────────── pop serpentine ──
  {
    id: 'symbol-pop-serpentine',
    name: 'Pop Serpentine',
    group: 'symbol',
    description: 'Cells punch-scale one after another along an S-path, each with a gold shock-ring.',
    run(ctx) {
      const order = serpentine(ctx);
      const step = Math.min(0.05, 1.0 / Math.max(1, order.length));
      order.forEach((cell, i) => {
        const rc = ctx.cellRect(cell.reel, cell.row);
        const p = mid(rc);
        const size = Math.min(rc.w, rc.h);

        const holder = new Container();
        holder.position.set(p.x, p.y);
        ctx.layer.addChild(holder);

        const glow = glowDot(ctx.accent, size * 0.55);
        glow.alpha = 0;
        glow.scale.set(0.3);

        // shock-ring is two layers: wide soft pressure wave + tight hot rim
        const ringSoft = new Graphics();
        ringSoft.circle(0, 0, size * 0.44).stroke({ color: ctx.gold, width: 6, alpha: 0.28 });
        ringSoft.blendMode = 'add';
        ringSoft.alpha = 0;
        ringSoft.scale.set(0.3);

        const ringHot = new Graphics();
        ringHot.circle(0, 0, size * 0.4).stroke({ color: ctx.gold, width: 2.5, alpha: 0.85 });
        ringHot.blendMode = 'add';
        ringHot.alpha = 0;
        ringHot.scale.set(0.35);

        const panel = new Graphics();
        panel
          .roundRect(-size * 0.36, -size * 0.36, size * 0.72, size * 0.72, size * 0.14)
          .fill({ color: ctx.accent, alpha: 0.18 })
          .stroke({ color: 0xffffff, width: 2.5, alpha: 0.85 });
        // top sheen band keeps the panel from reading as a flat sticker
        panel
          .roundRect(-size * 0.32, -size * 0.33, size * 0.64, size * 0.13, size * 0.06)
          .fill({ color: 0xffffff, alpha: 0.06 });
        panel.alpha = 0;
        panel.scale.set(0.5);

        holder.addChild(glow, panel, ringSoft, ringHot);

        // stagger with ±25% jitter so the S-path breathes instead of ticking
        const delay = Math.max(0, i * step + ctx.rand(-step * 0.25, step * 0.25));
        const ringEnd = ctx.rand(1.15, 1.4);
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.set([glow, panel], { alpha: 1 }, 0)
          // anticipation: quick pull-down before the punch
          .to(panel.scale, { x: 0.4, y: 0.4, duration: 0.07, ease: 'power2.out' }, 0)
          .to(panel.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(2.6)' }, 0.07)
          .to(glow.scale, { x: 1.35, y: 1.35, duration: 0.3, ease: 'power2.out' }, 0.07)
          .to(glow, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.13)
          .to(panel, { alpha: 0, duration: 0.16, ease: 'power2.in' }, 0.28)
          // rings fire on the punch, wave leading the rim slightly
          .set([ringSoft, ringHot], { alpha: 1 }, 0.08)
          .to(ringSoft.scale, { x: ringEnd * 1.15, y: ringEnd * 1.15, duration: 0.32, ease: 'power2.out' }, 0.08)
          .to(ringSoft, { alpha: 0, duration: 0.24, ease: 'power2.in' }, 0.14)
          .to(ringHot.scale, { x: ringEnd, y: ringEnd, duration: 0.28, ease: 'back.out(1.8)' }, 0.1)
          .to(ringHot, { alpha: 0, duration: 0.18, ease: 'power2.in' }, 0.2);
      });
    },
  },

  // 3 ──────────────────────────────────────────────────────── glow trail ──
  {
    id: 'symbol-glow-trail',
    name: 'Glow Trail',
    group: 'symbol',
    description: 'A gold orb hops cell to cell in a random walk, leaving fading accent footprints.',
    run(ctx) {
      const hops = 7; // odd, asymmetric walk
      const start: Cell = {
        reel: Math.min(ctx.grid.reels - 1, Math.floor(ctx.rand(0, ctx.grid.reels))),
        row: Math.min(ctx.grid.rows - 1, Math.floor(ctx.rand(0, ctx.grid.rows))),
      };
      const path: Cell[] = [start];
      for (let i = 0; i < hops; i++) {
        const cur = path[path.length - 1];
        const prev = path.length > 1 ? path[path.length - 2] : null;
        path.push(ctx.pick(neighbours(ctx, cur, prev)));
      }

      const footLayer = new Container(); // footprints under the orb
      ctx.layer.addChild(footLayer);

      const spawnFootprint = (cell: Cell) => {
        const rc = ctx.cellRect(cell.reel, cell.row);
        const c = mid(rc);
        const inset = Math.min(rc.w, rc.h) * 0.1;
        const fp = new Container();
        fp.position.set(c.x, c.y);
        const g = new Graphics();
        // layered footprint: soft wash + brighter rim, never one flat slab
        g.roundRect(-rc.w / 2 + inset, -rc.h / 2 + inset, rc.w - inset * 2, rc.h - inset * 2, inset * 1.4)
          .fill({ color: ctx.accent, alpha: 0.16 })
          .stroke({ color: ctx.accent, width: 2, alpha: 0.6 });
        g.roundRect(
          -rc.w / 2 + inset * 2,
          -rc.h / 2 + inset * 2,
          rc.w - inset * 4,
          rc.h - inset * 4,
          inset,
        ).fill({ color: ctx.accent, alpha: 0.14 });
        g.blendMode = 'add';
        fp.addChild(g);
        fp.alpha = ctx.rand(0.85, 1);
        footLayer.addChild(fp);
        // progressive decay: each print dims AND shrinks as it ages
        const life = ctx.rand(0.65, 0.85);
        ctx.track(ctx.gsap.to(fp, { alpha: 0, duration: life, ease: 'power2.in' }));
        ctx.track(ctx.gsap.to(fp.scale, { x: 0.86, y: 0.86, duration: life, ease: 'power2.in' }));
      };

      const rc0 = ctx.cellRect(start.reel, start.row);
      const orb = glowDot(ctx.gold, Math.min(rc0.w, rc0.h) * 0.34);
      const p0 = mid(rc0);
      orb.position.set(p0.x, p0.y);
      orb.scale.set(0);
      ctx.layer.addChild(orb);

      const tl = ctx.track(ctx.gsap.timeline());
      tl.to(orb.scale, { x: 1, y: 1, duration: 0.16, ease: 'back.out(2.5)' }, 0);
      tl.call(() => spawnFootprint(start), undefined, 0.08);

      let t = 0.18;
      path.slice(1).forEach((cell) => {
        const p = mid(ctx.cellRect(cell.reel, cell.row));
        const hopD = 0.12 * ctx.rand(0.85, 1.2); // jittered hop tempo
        // anticipation: squash down before the leap
        tl.to(orb.scale, { x: 1.22, y: 0.78, duration: 0.05, ease: 'power2.out' }, t);
        // travel: power in→out, stretched in flight
        tl.to(orb, { x: p.x, y: p.y, duration: hopD, ease: 'power2.inOut' }, t + 0.05)
          .to(orb.scale, { x: 0.92, y: 1.14, duration: hopD * 0.5, ease: 'power1.out' }, t + 0.05)
          // landing squash, then back.out settle — weight on every arrival
          .to(orb.scale, { x: 1.18, y: 0.84, duration: hopD * 0.4, ease: 'power2.in' }, t + 0.05 + hopD * 0.55)
          .to(orb.scale, { x: 1, y: 1, duration: 0.09, ease: 'back.out(2)' }, t + 0.05 + hopD);
        tl.call(() => spawnFootprint(cell), undefined, t + 0.05 + hopD * 0.9);
        t += 0.05 + hopD;
      });

      // exit: quick inhale, then burst outward and fade — nothing pops off
      tl.to(orb.scale, { x: 0.78, y: 0.78, duration: 0.09, ease: 'power2.out' }, t + 0.04)
        .to(orb.scale, { x: 2.0, y: 2.0, duration: 0.2, ease: 'power3.in' }, t + 0.13)
        .to(orb, { alpha: 0, duration: 0.16, ease: 'power2.in' }, t + 0.17);
    },
  },

  // 4 ───────────────────────────────────────────────────── checker flash ──
  {
    id: 'symbol-checker-flash',
    name: 'Checker Flash',
    group: 'symbol',
    description: 'Checkerboard halves of the grid strobe alternately — accent squares, then gold.',
    run(ctx) {
      const tl = ctx.track(ctx.gsap.timeline());
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        for (let row = 0; row < ctx.grid.rows; row++) {
          const parity = (reel + row) % 2;
          const color = parity === 0 ? ctx.accent : ctx.gold;
          const rc = ctx.cellRect(reel, row);
          const p = mid(rc);

          const c = new Container();
          c.position.set(p.x, p.y);
          const pw = rc.w * 0.88;
          const ph = rc.h * 0.88;
          const rad = Math.min(pw, ph) * 0.12;
          // layered panel: soft body + brighter inner core + top sheen
          const panel = new Graphics();
          panel
            .roundRect(-pw / 2, -ph / 2, pw, ph, rad)
            .fill({ color, alpha: 0.32 })
            .stroke({ color: 0xffffff, width: 1.5, alpha: 0.45 });
          panel
            .roundRect(-pw * 0.32, -ph * 0.32, pw * 0.64, ph * 0.64, rad * 0.7)
            .fill({ color, alpha: 0.3 });
          panel
            .roundRect(-pw / 2 + 3, -ph / 2 + 3, pw - 6, ph * 0.18, rad * 0.5)
            .fill({ color: 0xffffff, alpha: 0.07 });
          panel.blendMode = 'add';
          c.addChild(panel);
          c.alpha = 0;
          ctx.layer.addChild(c);

          // sync IS the design here — keep the beat, but a ±15ms human wobble
          // and ±10% peak variance stop it reading as machine-stamped
          const jit = ctx.rand(-0.015, 0.015);
          const peak = 0.8 * ctx.rand(0.9, 1.05);
          const times = parity === 0 ? [0.06, 0.5] : [0.28, 0.72];
          for (const t0 of times) {
            const t = t0 + jit;
            // anticipation: faint pre-glow inhale before the strobe hits
            tl.to(c, { alpha: 0.22, duration: 0.05, ease: 'power1.out' }, t - 0.05)
              .to(c, { alpha: peak, duration: 0.07, ease: 'power4.out' }, t)
              .to(c.scale, { x: 1.045, y: 1.045, duration: 0.07, ease: 'power4.out' }, t)
              // decay: never linear — fade with a slight scale continuation
              .to(c, { alpha: 0, duration: 0.26, ease: 'power2.in' }, t + 0.09)
              .to(c.scale, { x: 0.985, y: 0.985, duration: 0.26, ease: 'power2.in' }, t + 0.09);
          }
        }
      }
    },
  },

  // 5 ─────────────────────────────────────────────── column drop bounce ──
  {
    id: 'symbol-column-drop-bounce',
    name: 'Column Drop',
    group: 'symbol',
    description: 'Translucent reel panels drop in from above one by one and bounce into place.',
    run(ctx) {
      for (let reel = 0; reel < ctx.grid.reels; reel++) {
        const rc = ctx.reelRect(reel);
        const c = new Container();
        // pivot at bottom-centre so the landing squash plants on the floor
        c.pivot.set(rc.w / 2, rc.h);
        const yFloor = rc.y + rc.h;
        const yStart = yFloor - rc.h * 0.55;
        c.position.set(rc.x + rc.w / 2, yStart);
        c.alpha = 0;

        const pad = rc.w * 0.06;
        const rad = rc.w * 0.1;

        // layered halo: wide soft wash + tighter mid glow
        const haloWide = new Graphics();
        haloWide
          .roundRect(pad - 14, -14, rc.w - pad * 2 + 28, rc.h + 28, rad + 14)
          .fill({ color: ctx.accent, alpha: 0.1 });
        haloWide.blendMode = 'add';
        const haloMid = new Graphics();
        haloMid
          .roundRect(pad - 5, -5, rc.w - pad * 2 + 10, rc.h + 10, rad + 5)
          .fill({ color: ctx.accent, alpha: 0.18 });
        haloMid.blendMode = 'add';

        const panel = new Graphics();
        panel
          .roundRect(pad, 0, rc.w - pad * 2, rc.h, rad)
          .fill({ color: ctx.accent, alpha: 0.26 })
          .stroke({ color: 0xffffff, width: 2, alpha: 0.6 });

        const cap = new Graphics();
        cap
          .roundRect(pad, 0, rc.w - pad * 2, rc.h * 0.06, rad * 0.5)
          .fill({ color: 0xffffff, alpha: 0.75 });
        cap.blendMode = 'add';

        c.addChild(haloWide, haloMid, panel, cap);
        ctx.layer.addChild(c);

        const delay = reel * 0.09 * ctx.rand(0.85, 1.2);
        const dropD = 0.32 * ctx.rand(0.92, 1.08);
        const tImpact = 0.1 + dropD;
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(c, { alpha: 1, duration: 0.08, ease: 'none' }, 0)
          // anticipation: a small upward inhale before gravity takes it
          .to(c, { y: yStart - rc.h * 0.05, duration: 0.1, ease: 'power1.out' }, 0)
          // the drop: pure acceleration into the floor — real weight
          .to(c, { y: yFloor, duration: dropD, ease: 'power3.in' }, 0.1)
          // impact: squash on the floor, cap flashes, then back.out settle
          .to(c.scale, { x: 1.04, y: 0.92, duration: 0.07, ease: 'power2.out' }, tImpact)
          .to(cap, { alpha: 1, duration: 0.05, ease: 'power3.out' }, tImpact)
          .to(c.scale, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2)' }, tImpact + 0.08)
          .to(cap, { alpha: 0.35, duration: 0.3, ease: 'power2.in' }, tImpact + 0.1)
          // exit: fade with a slight downward continuation — never a pop-off
          .to(c, { alpha: 0, y: yFloor + 8, duration: 0.32, ease: 'power2.in' }, tImpact + 0.5);

        // impact debris — 3 glow specks kicked up from the base
        for (let s = 0; s < 3; s++) {
          const spark = glowDot(ctx.accent, rc.w * ctx.rand(0.045, 0.075));
          const sx = rc.x + rc.w * ctx.rand(0.2, 0.8);
          spark.position.set(sx, yFloor - 4);
          spark.alpha = 0;
          spark.scale.set(0.5);
          ctx.layer.addChild(spark);
          const stl = ctx.track(ctx.gsap.timeline({ delay: delay + tImpact }));
          stl.to(spark, { alpha: ctx.rand(0.6, 0.9), duration: 0.04, ease: 'none' }, 0)
            .to(
              spark,
              {
                x: sx + rc.w * ctx.rand(-0.28, 0.28),
                y: yFloor - rc.h * ctx.rand(0.05, 0.12),
                duration: ctx.rand(0.3, 0.45),
                ease: 'power2.out',
              },
              0,
            )
            .to(spark.scale, { x: 1, y: 1, duration: 0.12, ease: 'back.out(1.6)' }, 0)
            .to(spark, { alpha: 0, duration: 0.24, ease: 'power2.in' }, 0.18)
            .to(spark.scale, { x: 0.4, y: 0.4, duration: 0.24, ease: 'power2.in' }, 0.18);
        }
      }
    },
  },

  // 6 ─────────────────────────────────────────────────── rowlight sweep ──
  {
    id: 'symbol-rowlight-sweep',
    name: 'Rowlight Sweep',
    group: 'symbol',
    description: 'Each row lights up with a white core-line sweep, cascading top to bottom.',
    run(ctx) {
      const gr = ctx.gridRect();
      for (let row = 0; row < ctx.grid.rows; row++) {
        const rc = ctx.cellRect(0, row);

        const bar = new Container();
        bar.position.set(gr.x, rc.y);
        ctx.layer.addChild(bar);

        // layered wash: full-height soft band + tighter mid band
        const fill = new Graphics();
        fill.roundRect(0, 0, gr.w, rc.h, rc.h * 0.12).fill({ color: ctx.accent, alpha: 0.16 });
        fill
          .roundRect(0, rc.h * 0.22, gr.w, rc.h * 0.56, rc.h * 0.1)
          .fill({ color: ctx.accent, alpha: 0.22 });
        fill.blendMode = 'add';
        fill.alpha = 0;

        // core line: soft under-glow strip + thin hot white line
        const core = new Graphics();
        core.roundRect(0, rc.h / 2 - 6, gr.w, 12, 6).fill({ color: ctx.accent, alpha: 0.3 });
        core.roundRect(0, rc.h / 2 - 1.5, gr.w, 3, 1.5).fill({ color: 0xffffff, alpha: 0.85 });
        core.blendMode = 'add';
        core.scale.x = 0;

        bar.addChild(fill, core);

        // comet head riding the sweep front
        const head = glowDot(ctx.accent, rc.h * 0.3);
        head.position.set(gr.x, rc.y + rc.h / 2);
        head.alpha = 0;
        head.scale.set(0.4);
        ctx.layer.addChild(head);

        const sweepD = 0.3 * ctx.rand(0.9, 1.1);
        const tl = ctx.track(ctx.gsap.timeline({ delay: row * 0.15 * ctx.rand(0.85, 1.15) }));
        // anticipation: the left edge inhales before the sweep fires
        tl.to(head, { alpha: 0.7, duration: 0.08, ease: 'power2.out' }, 0)
          .to(head.scale, { x: 0.7, y: 0.7, duration: 0.08, ease: 'power2.out' }, 0)
          // sweep: hot core races across, head stretched by its own speed
          .to(head.scale, { x: 1.5, y: 0.85, duration: 0.1, ease: 'power2.in' }, 0.08)
          .to(head, { x: gr.x + gr.w, alpha: 1, duration: sweepD, ease: 'power3.out' }, 0.1)
          .to(core.scale, { x: 1, duration: sweepD, ease: 'power3.out' }, 0.1)
          .to(fill, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0.1)
          // falloff: everything decays on curves, head exits off-grid
          .to(head.scale, { x: 1, y: 1, duration: 0.12, ease: 'back.out(1.6)' }, 0.1 + sweepD)
          .to(head, { x: gr.x + gr.w + 22, alpha: 0, duration: 0.22, ease: 'power2.in' }, 0.16 + sweepD)
          .to(fill, { alpha: 0, duration: 0.38, ease: 'power2.in' }, 0.12 + sweepD)
          .to(core, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.14 + sweepD)
          .to(core.scale, { y: 0.6, duration: 0.26, ease: 'power2.in' }, 0.14 + sweepD);
      }
    },
  },

  // 7 ───────────────────────────────────────────────────────── orbiters ──
  {
    id: 'symbol-orbiters',
    name: 'Orbiters',
    group: 'symbol',
    description: 'Three random cells grow gold orbs that whirl in orbit, then zip off in all directions.',
    run(ctx) {
      const cells = pickCells(ctx, 3);
      cells.forEach((cell, ci) => {
        const rc = ctx.cellRect(cell.reel, cell.row);
        const p = mid(rc);
        const size = Math.min(rc.w, rc.h);
        const R = size * 0.42;

        const spinner = new Container();
        spinner.position.set(p.x, p.y);
        spinner.alpha = 0;
        spinner.scale.set(0.3);
        ctx.layer.addChild(spinner);

        // orbit track: wide soft outer ring + thin brighter inner rim
        const ringSoft = new Graphics();
        ringSoft.circle(0, 0, R * 1.1).stroke({ color: ctx.accent, width: 5, alpha: 0.13 });
        ringSoft.blendMode = 'add';
        ringSoft.alpha = 0;
        const ringHot = new Graphics();
        ringHot.circle(0, 0, R).stroke({ color: ctx.accent, width: 1.5, alpha: 0.45 });
        ringHot.blendMode = 'add';
        ringHot.alpha = 0;
        spinner.addChild(ringSoft, ringHot);

        const orbs: Graphics[] = [];
        for (let k = 0; k < 3; k++) {
          const o = glowDot(ctx.gold, size * ctx.rand(0.075, 0.105));
          const ang = (k * Math.PI * 2) / 3 + ctx.rand(-0.25, 0.25);
          const r = R * ctx.rand(0.88, 1.1);
          o.position.set(Math.cos(ang) * r, Math.sin(ang) * r);
          spinner.addChild(o);
          orbs.push(o);
          // each orb breathes on its own phase — no lockstep twins
          ctx.track(
            ctx.gsap.to(o.scale, {
              x: 1.22,
              y: 1.22,
              duration: ctx.rand(0.22, 0.34),
              delay: ci * 0.1 + ctx.rand(0, 0.25),
              yoyo: true,
              repeat: 3,
              ease: 'sine.inOut',
            }),
          );
        }

        const dir = ctx.pick([1, -1] as const);
        const spinD = 0.95 * ctx.rand(0.9, 1.1);
        const turns = Math.PI * ctx.rand(3.4, 4.4);
        const tZip = 0.12 + spinD;
        const tl = ctx.track(ctx.gsap.timeline({ delay: ci * 0.1 * ctx.rand(0.8, 1.3) }));
        tl.to(spinner, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0)
          .to(spinner.scale, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2.2)' }, 0)
          .to(ringSoft, { alpha: 1, duration: 0.22, ease: 'power1.out' }, 0.05)
          .to(ringHot, { alpha: 1, duration: 0.18, ease: 'power1.out' }, 0.07)
          // anticipation: counter-rotation wind-up before the whirl
          .to(spinner, { rotation: -dir * 0.5, duration: 0.12, ease: 'power2.out' }, 0)
          .to(spinner, { rotation: dir * turns, duration: spinD, ease: 'power2.inOut' }, 0.12)
          .to([ringSoft, ringHot], { alpha: 0, duration: 0.2, ease: 'power2.in' }, tZip - 0.12);

        // zip away — inhale toward centre, then fling out on random rays
        for (const o of orbs) {
          const ang = ctx.rand(0, Math.PI * 2);
          const dist = Math.max(rc.w, rc.h) * ctx.rand(1.7, 2.7);
          tl.to(o, { x: o.x * 0.7, y: o.y * 0.7, duration: 0.1, ease: 'power2.in' }, tZip - 0.1)
            .to(
              o,
              {
                x: Math.cos(ang) * dist,
                y: Math.sin(ang) * dist,
                duration: ctx.rand(0.26, 0.34),
                ease: 'power3.in',
              },
              tZip,
            )
            .to(o, { alpha: 0, duration: 0.14, ease: 'power2.in' }, tZip + 0.16)
            .to(o.scale, { x: 0.5, y: 0.5, duration: 0.14, ease: 'power2.in' }, tZip + 0.16);
        }
      });
    },
  },

  // 8 ─────────────────────────────────────────────────────── cell quake ──
  {
    id: 'symbol-cell-quake',
    name: 'Cell Quake',
    group: 'symbol',
    description: 'Random cells rattle in place while little dust puffs kick up from their base.',
    run(ctx) {
      const cells = pickCells(ctx, Math.min(5, ctx.grid.reels * ctx.grid.rows));
      for (const cell of cells) {
        const rc = ctx.cellRect(cell.reel, cell.row);
        const p = mid(rc);
        const size = Math.min(rc.w, rc.h);

        const holder = new Container();
        holder.position.set(p.x, p.y);
        holder.alpha = 0;
        ctx.layer.addChild(holder);

        const pw = rc.w * 0.9;
        const ph = rc.h * 0.9;
        const frame = new Graphics();
        frame
          .roundRect(-pw / 2, -ph / 2, pw, ph, size * 0.12)
          .fill({ color: 0x000000, alpha: 0.18 })
          .stroke({ color: ctx.accent, width: 2.5, alpha: 0.85 });
        // top sheen keeps the dark slab from reading as dead flat
        frame
          .roundRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph * 0.16, size * 0.08)
          .fill({ color: 0xffffff, alpha: 0.05 });
        const inner = new Graphics();
        inner
          .roundRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph - 8, size * 0.1)
          .stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
        holder.addChild(frame, inner);

        const delay = ctx.rand(0, 0.25);
        const amp = size * 0.06;
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(holder, { alpha: 1, duration: 0.06, ease: 'none' }, 0)
          // anticipation: the cell inhales — swells slightly before the shake
          .to(holder.scale, { x: 1.03, y: 1.03, duration: 0.09, ease: 'power2.out' }, 0)
          .to(holder.scale, { x: 1, y: 1, duration: 0.1, ease: 'power2.in' }, 0.09);

        // rattle: decaying amplitude on a power curve, jittered step tempo,
        // with rotation micro-noise so it reads as impact, not vibration
        const steps = 9;
        let tq = 0.12;
        for (let i = 0; i < steps; i++) {
          const k = Math.pow(1 - i / steps, 1.4);
          const a = amp * k;
          const stepD = 0.045 * ctx.rand(0.8, 1.25);
          tl.to(
            holder,
            {
              x: p.x + ctx.rand(-a, a),
              y: p.y + ctx.rand(-a, a),
              rotation: ctx.rand(-0.012, 0.012) * k,
              duration: stepD,
              ease: 'none',
            },
            tq,
          );
          tq += stepD;
        }
        // settle with a micro-overshoot, then leave with a soft downward sag
        tl.to(holder, { x: p.x, y: p.y, rotation: 0, duration: 0.12, ease: 'back.out(1.8)' }, tq)
          .to(holder, { alpha: 0, y: p.y + 2, duration: 0.24, ease: 'power2.in' }, tq + 0.18);

        // dust puffs kicked up from the cell base — odd count, all unique
        const puffs = 5;
        for (let d = 0; d < puffs; d++) {
          const px = p.x + ctx.rand(-rc.w * 0.35, rc.w * 0.35);
          const py = rc.y + rc.h - rc.h * 0.08;
          const r = ctx.rand(size * 0.03, size * 0.06);
          const dust = new Graphics();
          // two-layer puff: soft body + smaller brighter heart
          dust.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.22 });
          dust.circle(0, 0, r * 0.55).fill({ color: 0xffffff, alpha: 0.4 });
          dust.blendMode = 'add';
          dust.position.set(px, py);
          dust.scale.set(0.4);
          dust.alpha = ctx.rand(0.55, 0.85);
          ctx.layer.addChild(dust);

          const dd = delay + ctx.rand(0.1, 0.42);
          const life = ctx.rand(0.4, 0.6);
          const drift = ctx.rand(-size * 0.18, size * 0.18);
          const dtl = ctx.track(ctx.gsap.timeline({ delay: dd }));
          dtl.to(
            dust,
            {
              x: px + drift,
              y: py - ctx.rand(size * 0.1, size * 0.24),
              duration: life,
              ease: 'power2.out',
            },
            0,
          )
            .to(dust.scale, { x: ctx.rand(1.5, 2.5), y: ctx.rand(1.4, 2.2), duration: life, ease: 'power2.out' }, 0)
            // fade rides the back half of the rise — dust thins as it slows
            .to(dust, { alpha: 0, x: px + drift * 1.4, duration: life * 0.6, ease: 'power2.in' }, life * 0.4);
        }
      }
    },
  },
];
