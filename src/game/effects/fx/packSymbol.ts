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

/** Layered additive glow orb — soft halo, hot core, white pin centre. */
function glowDot(color: number, r: number): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.14 });
  g.circle(0, 0, r * 0.62).fill({ color, alpha: 0.3 });
  g.circle(0, 0, r * 0.34).fill({ color, alpha: 0.9 });
  g.circle(0, 0, r * 0.16).fill({ color: 0xffffff, alpha: 1 });
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

          const glow = new Graphics();
          glow
            .roundRect(-pw / 2 - 6, -ph / 2 - 6, pw + 12, ph + 12, rad + 6)
            .fill({ color: ctx.accent, alpha: 0.35 });
          glow.blendMode = 'add';

          const card = new Graphics();
          card
            .roundRect(-pw / 2, -ph / 2, pw, ph, rad)
            .fill({ color: ctx.accent, alpha: 0.28 })
            .stroke({ color: 0xffffff, width: 2, alpha: 0.95 });

          // bright vertical spine — sells the hinge of the flip
          const spine = new Graphics();
          spine.roundRect(-1.5, -ph / 2, 3, ph, 1.5).fill({ color: 0xffffff, alpha: 0.9 });
          spine.blendMode = 'add';

          c.addChild(glow, card, spine);
          c.scale.x = 0;
          c.alpha = 0;
          ctx.layer.addChild(c);

          const delay = (reel + row) * 0.055;
          const tl = ctx.track(ctx.gsap.timeline({ delay }));
          tl.to(c, { alpha: 1, duration: 0.05, ease: 'none' }, 0)
            .to(c.scale, { x: 1, duration: 0.22, ease: 'back.out(2.4)' }, 0)
            .to(c.scale, { x: 0, duration: 0.16, ease: 'power3.in' }, 0.3)
            .to(c, { alpha: 0, duration: 0.14, ease: 'power2.in' }, 0.32);
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

        const ring = new Graphics();
        ring.circle(0, 0, size * 0.42).stroke({ color: ctx.gold, width: 3, alpha: 1 });
        ring.blendMode = 'add';
        ring.alpha = 0;
        ring.scale.set(0.35);

        const panel = new Graphics();
        panel
          .roundRect(-size * 0.36, -size * 0.36, size * 0.72, size * 0.72, size * 0.14)
          .fill({ color: ctx.accent, alpha: 0.2 })
          .stroke({ color: 0xffffff, width: 2.5, alpha: 0.95 });
        panel.alpha = 0;
        panel.scale.set(0.5);

        holder.addChild(glow, panel, ring);

        const tl = ctx.track(ctx.gsap.timeline({ delay: i * step }));
        tl.set([glow, ring, panel], { alpha: 1 }, 0)
          .to(glow.scale, { x: 1.35, y: 1.35, duration: 0.3, ease: 'power2.out' }, 0)
          .to(glow, { alpha: 0, duration: 0.28, ease: 'power2.out' }, 0.06)
          .to(panel.scale, { x: 1, y: 1, duration: 0.24, ease: 'back.out(3.5)' }, 0)
          .to(panel, { alpha: 0, duration: 0.18, ease: 'power2.in' }, 0.2)
          .to(ring.scale, { x: 1.25, y: 1.25, duration: 0.3, ease: 'back.out(3)' }, 0.02)
          .to(ring, { alpha: 0, duration: 0.2, ease: 'power2.in' }, 0.16);
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
      const hops = 8;
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
        const inset = Math.min(rc.w, rc.h) * 0.1;
        const fp = new Graphics();
        fp.roundRect(rc.x + inset, rc.y + inset, rc.w - inset * 2, rc.h - inset * 2, inset * 1.4)
          .fill({ color: ctx.accent, alpha: 0.4 })
          .stroke({ color: ctx.accent, width: 2, alpha: 0.8 });
        fp.blendMode = 'add';
        footLayer.addChild(fp);
        ctx.track(ctx.gsap.to(fp, { alpha: 0, duration: 0.8, ease: 'power2.out' }));
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

      const hopDur = 0.13;
      path.slice(1).forEach((cell, i) => {
        const p = mid(ctx.cellRect(cell.reel, cell.row));
        const t0 = 0.14 + i * hopDur;
        tl.to(orb, { x: p.x, y: p.y, duration: hopDur, ease: 'power2.inOut' }, t0)
          .to(orb.scale, { x: 1.25, y: 0.8, duration: hopDur / 2, ease: 'power1.out' }, t0)
          .to(orb.scale, { x: 1, y: 1, duration: hopDur / 2, ease: 'power1.in' }, t0 + hopDur / 2);
        tl.call(() => spawnFootprint(cell), undefined, t0 + hopDur * 0.75);
      });

      const end = 0.14 + hops * hopDur + 0.05;
      tl.to(orb.scale, { x: 1.9, y: 1.9, duration: 0.16, ease: 'back.in(2)' }, end)
        .to(orb, { alpha: 0, duration: 0.18, ease: 'power2.in' }, end + 0.05);
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
          const panel = new Graphics();
          panel
            .roundRect(-pw / 2, -ph / 2, pw, ph, Math.min(pw, ph) * 0.12)
            .fill({ color, alpha: 0.75 })
            .stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 });
          panel.blendMode = 'add';
          c.addChild(panel);
          c.alpha = 0;
          ctx.layer.addChild(c);

          // two rounds: parity 0 at 0 / 0.44, parity 1 at 0.22 / 0.66
          const times = parity === 0 ? [0, 0.44] : [0.22, 0.66];
          for (const t of times) {
            tl.to(c, { alpha: 0.9, duration: 0.08, ease: 'power3.out' }, t)
              .to(c.scale, { x: 1.05, y: 1.05, duration: 0.08, ease: 'power3.out' }, t)
              .to(c, { alpha: 0, duration: 0.24, ease: 'power2.in' }, t + 0.09)
              .to(c.scale, { x: 1, y: 1, duration: 0.24, ease: 'power2.in' }, t + 0.09);
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
        c.position.set(rc.x, rc.y - rc.h * 0.55);
        c.alpha = 0;

        const pad = rc.w * 0.06;
        const rad = rc.w * 0.1;

        const glow = new Graphics();
        glow
          .roundRect(pad - 5, -5, rc.w - pad * 2 + 10, rc.h + 10, rad + 5)
          .fill({ color: ctx.accent, alpha: 0.22 });
        glow.blendMode = 'add';

        const panel = new Graphics();
        panel
          .roundRect(pad, 0, rc.w - pad * 2, rc.h, rad)
          .fill({ color: ctx.accent, alpha: 0.3 })
          .stroke({ color: 0xffffff, width: 2, alpha: 0.7 });

        const cap = new Graphics();
        cap
          .roundRect(pad, 0, rc.w - pad * 2, rc.h * 0.06, rad * 0.5)
          .fill({ color: 0xffffff, alpha: 0.85 });
        cap.blendMode = 'add';

        c.addChild(glow, panel, cap);
        ctx.layer.addChild(c);

        const delay = reel * 0.09;
        ctx.track(ctx.gsap.to(c, { alpha: 1, duration: 0.08, delay, ease: 'none' }));
        ctx.track(ctx.gsap.to(c, { y: rc.y, duration: 0.6, delay, ease: 'bounce.out' }));
        ctx.track(
          ctx.gsap.to(c, { alpha: 0, duration: 0.35, delay: delay + 0.78, ease: 'power2.in' }),
        );
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

        const fill = new Graphics();
        fill
          .roundRect(0, 0, gr.w, rc.h, rc.h * 0.12)
          .fill({ color: ctx.accent, alpha: 0.42 });
        fill.blendMode = 'add';
        fill.alpha = 0;

        const core = new Graphics();
        core.roundRect(0, rc.h / 2 - 2, gr.w, 4, 2).fill({ color: 0xffffff, alpha: 0.95 });
        core.blendMode = 'add';
        core.scale.x = 0;

        bar.addChild(fill, core);

        const tl = ctx.track(ctx.gsap.timeline({ delay: row * 0.15 }));
        tl.to(fill, { alpha: 1, duration: 0.1, ease: 'power2.out' }, 0)
          .to(fill, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.18)
          .to(core.scale, { x: 1, duration: 0.26, ease: 'power4.out' }, 0)
          .to(core, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.2);
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

        const ring = new Graphics();
        ring.circle(0, 0, R).stroke({ color: ctx.accent, width: 1.5, alpha: 0.5 });
        ring.blendMode = 'add';
        ring.alpha = 0;
        spinner.addChild(ring);

        const orbs: Graphics[] = [];
        for (let k = 0; k < 3; k++) {
          const o = glowDot(ctx.gold, size * 0.09);
          const ang = (k * Math.PI * 2) / 3;
          o.position.set(Math.cos(ang) * R, Math.sin(ang) * R);
          spinner.addChild(o);
          orbs.push(o);
        }

        const dir = ctx.pick([1, -1] as const);
        const tl = ctx.track(ctx.gsap.timeline({ delay: ci * 0.1 }));
        tl.to(spinner, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0)
          .to(spinner.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2.2)' }, 0)
          .to(ring, { alpha: 1, duration: 0.2, ease: 'power1.out' }, 0.05)
          .to(spinner, { rotation: dir * Math.PI * 4, duration: 1.0, ease: 'power1.inOut' }, 0)
          .to(ring, { alpha: 0, duration: 0.18, ease: 'power2.in' }, 0.85);

        // zip away — each orb flies out along its own random ray
        for (const o of orbs) {
          const ang = ctx.rand(0, Math.PI * 2);
          const dist = Math.max(rc.w, rc.h) * ctx.rand(1.7, 2.7);
          tl.to(
            o,
            { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, duration: 0.3, ease: 'power3.in' },
            1.0,
          ).to(o, { alpha: 0, duration: 0.12, ease: 'power2.in' }, 1.18);
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
      const cells = pickCells(ctx, Math.min(6, ctx.grid.reels * ctx.grid.rows));
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
          .stroke({ color: ctx.accent, width: 2.5, alpha: 0.9 });
        const inner = new Graphics();
        inner
          .roundRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph - 8, size * 0.1)
          .stroke({ color: 0xffffff, width: 1, alpha: 0.35 });
        holder.addChild(frame, inner);

        const delay = ctx.rand(0, 0.25);
        const amp = size * 0.06;
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(holder, { alpha: 1, duration: 0.06, ease: 'none' }, 0);

        const steps = 9;
        for (let i = 0; i < steps; i++) {
          const a = amp * (1 - i / steps); // decaying rattle
          tl.to(
            holder,
            { x: p.x + ctx.rand(-a, a), y: p.y + ctx.rand(-a, a), duration: 0.045, ease: 'none' },
            0.06 + i * 0.045,
          );
        }
        tl.to(holder, { x: p.x, y: p.y, duration: 0.08, ease: 'power2.out' }, 0.06 + steps * 0.045)
          .to(holder, { alpha: 0, duration: 0.25, ease: 'power2.in' }, 0.62);

        // dust puffs kicked up from the cell base
        const puffs = 4;
        for (let d = 0; d < puffs; d++) {
          const px = p.x + ctx.rand(-rc.w * 0.35, rc.w * 0.35);
          const py = rc.y + rc.h - rc.h * 0.08;
          const dust = new Graphics();
          dust.circle(0, 0, ctx.rand(size * 0.03, size * 0.055)).fill({ color: 0xffffff, alpha: 0.45 });
          dust.position.set(px, py);
          dust.scale.set(0.4);
          dust.alpha = 0.9;
          ctx.layer.addChild(dust);

          const dd = delay + ctx.rand(0.08, 0.4);
          ctx.track(
            ctx.gsap.to(dust, {
              x: px + ctx.rand(-size * 0.15, size * 0.15),
              y: py - ctx.rand(size * 0.08, size * 0.22),
              alpha: 0,
              duration: 0.5,
              delay: dd,
              ease: 'power2.out',
            }),
          );
          ctx.track(
            ctx.gsap.to(dust.scale, {
              x: ctx.rand(1.6, 2.4),
              y: ctx.rand(1.6, 2.4),
              duration: 0.5,
              delay: dd,
              ease: 'power2.out',
            }),
          );
        }
      }
    },
  },
];
