// MECH_PACK_C — five mechanic showcases: multiplier orb collect, giant symbol
// spin, coin vacuum, reel swap and golden frame hunt. Every mechanic is
// OUTCOME-NEUTRAL (pure display), theme-agnostic (ctx.accent / ctx.gold /
// white / black only) and grid-relative (all geometry via cellRect / reelRect
// / gridRect). Overlays ride the sticky lifecycle — whatever a mechanic leaves
// on screen is cleared by the next spin. Every tween goes through ctx.track();
// every awaited beat re-checks ctx.alive() so the choreography is cancellable
// mid-flight.
//
// Staging grammar (AAA pass — kill the AI look):
//   one arc per mech — setup (dim/focus) -> ONE dominant payoff -> resolution
//   real tiles      — ctx.spawnTile carries the symbols; Graphics only for light
//   weight          — power3/4.in arrivals, squash + ~0.08s hold, elastic settle
//   layered light   — wide halo (alpha<=0.15) / colour core / hot white centre
//   human timing    — ctx.rand jitter on every stagger, odd counts, no lockstep
//   restraint       — ambient dressing stays under a third of the visual energy

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

function mid(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** ±spread multiplicative jitter on a base value (timing humaniser). */
function jit(ctx: MechContext, base: number, spread = 0.2): number {
  return base * (1 + ctx.rand(-spread, spread));
}

/** Inclusive integer in [min, max] from the cosmetic rand. */
function randInt(ctx: MechContext, min: number, max: number): number {
  return Math.min(max, Math.floor(ctx.rand(min, max + 1)));
}

/** All board cells in a seeded-shuffled order (Fisher-Yates on ctx.rand). */
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

/** Soft additive radial glow — 4 layers: wide halo, mid, inner, hot core. */
function glowDot(color: number, r: number, k = 1): Graphics {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color, alpha: 0.12 * k });
  g.circle(0, 0, r * 0.64).fill({ color, alpha: 0.32 * k });
  g.circle(0, 0, r * 0.38).fill({ color, alpha: 0.48 * k });
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

/** Expanding shockwave — soft wash band, colour band, crisp white core, and a
 *  dimmer, smaller trailing echo so the burst decays instead of popping off. */
function ringBurst(ctx: MechContext, x: number, y: number, radius: number, color: number, delay = 0): void {
  const BASE = 40;
  const ring = new Container();
  ring.position.set(x, y);
  const wash = new Graphics();
  wash.circle(0, 0, BASE).stroke({ color, width: 14, alpha: 0.14 });
  wash.blendMode = 'add';
  const glow = new Graphics();
  glow.circle(0, 0, BASE).stroke({ color, width: 7, alpha: 0.38 });
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

/** Radial spray of glow sparks — jittered angles/sizes/timing, each spark
 *  shrinks as it flies and droops under gravity at the end. */
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
    const droop = ctx.rand(4, 12);
    const tl = ctx.track(ctx.gsap.timeline({ delay: delay + ctx.rand(0, 0.07) }));
    tl.to(s, { alpha: 1, duration: 0.04, ease: 'power1.out' }, 0)
      .to(s.position, { x: x + Math.cos(a) * d, duration: fly, ease: 'power4.out' }, 0)
      .to(s.position, { y: y + Math.sin(a) * d, duration: fly, ease: 'power3.out' }, 0)
      .to(s.position, { y: `+=${droop}`, duration: fly * 0.6, ease: 'power2.in' }, fly)
      .to(s.scale, { x: 0.3, y: 0.3, duration: fly * 0.8, ease: 'power2.in' }, fly * 0.35)
      .to(s, { alpha: 0, duration: fly * 0.6, ease: 'power2.in' }, fly * 0.55);
  }
}

/** Additive snap flash covering a rect — white body + colour tint, fast in,
 *  power2.in burn-off. Covers board re-skins so swaps never read as pops. */
function coverFlash(ctx: MechContext, r: Rect, color: number, peak = 0.45, delay = 0): void {
  const g = new Graphics();
  g.roundRect(r.x, r.y, r.w, r.h, 12).fill({ color: 0xffffff, alpha: peak });
  g.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 10).fill({ color, alpha: peak * 0.35 });
  g.blendMode = 'add';
  g.alpha = 0;
  ctx.overlay.addChild(g);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(g, { alpha: 1, duration: 0.04, ease: 'power1.out' }, 0)
    .to(g, { alpha: 0, duration: 0.36, ease: 'power2.in' }, 0.05);
}

/** Star glint — counter-rotated wind-up, back.out pop, exits still spinning
 *  and shrinking so it never just vanishes. */
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
  const spin = ctx.rand(0.6, 1.2);
  const tl = ctx.track(ctx.gsap.timeline({ delay }));
  tl.to(glint.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(3)' }, 0)
    .to(glint, { rotation: spin, duration: 0.55, ease: 'power2.out' }, 0)
    .to(glint.scale, { x: 0.55, y: 0.55, duration: 0.3, ease: 'power2.in' }, 0.26)
    .to(glint, { alpha: 0, duration: 0.28, ease: 'power2.in' }, 0.28);
}

/* ------------------------------------------------------------------ */
/* the pack                                                            */
/* ------------------------------------------------------------------ */

export const MECH_PACK_C: readonly MechEntry[] = [
  /* ---------------------------------------------------------------- */
  {
    id: 'multiplier-orb-collect',
    name: 'Multiplier Orb Collect',
    description:
      'Charged orbs lift off random cells and arc into a corner collector plate that punches x2 -> x3 -> x5.',
    async run(ctx: MechContext): Promise<void> {
      const gr = ctx.gridRect();
      const c0 = ctx.cellRect(0, 0);
      const n = ctx.pick([3, 5] as const); // odd counts only
      const sources = shuffledCells(ctx).slice(0, Math.min(n, ctx.grid.reels * ctx.grid.rows));
      // Every orb lands with weight; only the milestone arrivals move the
      // number — the ladder always ends on the x5 hero tick.
      const milestones = sources.length === 3 ? [0, 1, 2] : [-1, 0, -1, 1, 2];
      const labels = ['x2', 'x3', 'x5'];

      // Setup — the board recedes, the collector is the only bright thing.
      ctx.dimBoard(0.35);

      const pw = c0.w * 1.16;
      const ph = c0.h * 0.78;
      const px = gr.x + gr.w - pw / 2 - 10;
      const py = gr.y + ph / 2 + 8;
      const plate = new Container();
      plate.position.set(px, py);
      const halo = glowDot(ctx.gold, pw * 0.72, 0.7);
      halo.alpha = 0.35;
      const body = new Graphics();
      body.roundRect(-pw / 2, -ph / 2, pw, ph, 14).fill({ color: 0x000000, alpha: 0.88 });
      body.roundRect(-pw / 2, -ph / 2, pw, ph, 14).stroke({ color: ctx.gold, width: 3.5, alpha: 1 });
      body.roundRect(-pw / 2 + 5, -ph / 2 + 5, pw - 10, ph - 10, 10).stroke({ color: 0xffffff, width: 1.4, alpha: 0.3 });
      const sheen = new Graphics();
      sheen.roundRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph * 0.3, 9).fill({ color: ctx.gold, alpha: 0.14 });
      sheen.blendMode = 'add';
      const label = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: 'Arial, sans-serif',
          fontSize: Math.round(ph * 0.52),
          fontWeight: '900',
          fill: ctx.gold,
          stroke: { color: 0xffffff, width: 2 },
        }),
      });
      label.anchor.set(0.5);
      plate.addChild(halo, body, sheen, label);
      plate.scale.set(0);
      plate.rotation = -0.06;
      ctx.overlay.addChild(plate);
      // SFX: collector plate rings in
      const ptl = ctx.track(ctx.gsap.timeline());
      ptl.to(plate.scale, { x: 1.06, y: 1.06, duration: 0.3, ease: 'back.out(2.2)' }, 0)
        .to(plate.scale, { x: 1, y: 1, duration: 0.16, ease: 'power2.out' }, 0.3)
        .to(plate, { rotation: 0, duration: 0.4, ease: 'back.out(1.6)' }, 0.05);

      // Source cells wake up under soft halo blooms (jittered, never in step).
      sources.forEach((cell, i) => {
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = mid(cr);
        const pad = glowDot(ctx.gold, Math.max(cr.w, cr.h) * 0.5, 0.7);
        pad.position.set(c.x, c.y);
        pad.alpha = 0;
        pad.scale.set(0.5);
        ctx.overlay.addChild(pad);
        const dl = i * 0.07 + ctx.rand(0, 0.05);
        const tl = ctx.track(ctx.gsap.timeline({ delay: dl }));
        tl.to(pad, { alpha: 0.8, duration: 0.16, ease: 'power2.out' }, 0)
          .to(pad.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.8)' }, 0)
          .to(pad, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 0.34)
          .call(
            () => {
              if (!ctx.alive()) return;
              ctx.playCellState(cell.reel, cell.row, 'featured');
            },
            undefined,
            0.05,
          );
      });
      await wait(520);
      if (!ctx.alive()) return;

      // The orbs — rise off the cell, hang for a breath, then dive into the
      // plate with power4.in so every arrival lands with weight.
      let tick = 0;
      let launch = 0.1;
      let lastArrival = 0;
      // SFX: orb lift shimmer
      sources.forEach((cell, i) => {
        const cr = ctx.cellRect(cell.reel, cell.row);
        const c = mid(cr);
        const orb = new Container();
        orb.addChild(glowDot(ctx.gold, cr.w * 0.24, 1));
        orb.position.set(c.x, c.y);
        orb.alpha = 0;
        orb.scale.set(0.5);
        ctx.overlay.addChild(orb);
        const rise = jit(ctx, 0.34, 0.15);
        const fly = jit(ctx, 0.5, 0.12);
        const apexY = Math.min(c.y, py) - c0.h * ctx.rand(0.35, 0.6);
        const tl = ctx.track(ctx.gsap.timeline({ delay: launch }));
        tl.to(orb, { alpha: 1, duration: 0.12, ease: 'power1.out' }, 0)
          .to(orb.scale, { x: 1, y: 1, duration: 0.26, ease: 'back.out(2)' }, 0)
          .to(orb, { y: c.y - cr.h * 0.42, duration: rise, ease: 'power2.out' }, 0)
          .to(orb, { x: c.x + ctx.rand(-9, 9), duration: rise, ease: 'sine.inOut' }, 0)
          .to(orb, { y: apexY, duration: fly * 0.55, ease: 'power1.out' }, rise)
          .to(orb, { x: px, duration: fly, ease: 'power1.in' }, rise)
          .to(orb, { y: py, duration: fly * 0.45, ease: 'power4.in' }, rise + fly * 0.55)
          .to(orb.scale, { x: 0.4, y: 0.4, duration: fly * 0.4, ease: 'power2.in' }, rise + fly * 0.6)
          .to(orb, { alpha: 0, duration: 0.08, ease: 'power1.in' }, rise + fly - 0.04)
          .call(
            () => {
              if (!ctx.alive()) return;
              const m = milestones[i];
              const punch = ctx.track(ctx.gsap.timeline());
              if (m !== undefined && m >= 0) {
                tick = m;
                const big = tick === 2;
                // SFX: multiplier tick (final tick: slam)
                label.text = labels[tick];
                label.scale.set(big ? 2 : 1.55);
                punch
                  .to(label.scale, { x: 1, y: 1, duration: big ? 0.3 : 0.22, ease: 'back.out(2.4)' }, 0)
                  .to(plate.scale, { x: 1.14, y: 0.9, duration: 0.06, ease: 'power3.out' }, 0)
                  .to(
                    plate.scale,
                    { x: 1, y: 1, duration: big ? 0.5 : 0.3, ease: big ? 'elastic.out(1, 0.4)' : 'back.out(2)' },
                    0.14, // ~0.08s squash hold before the release
                  );
                coverFlash(ctx, { x: px - pw / 2, y: py - ph / 2, w: pw, h: ph }, ctx.gold, big ? 0.5 : 0.28);
                if (big) {
                  ringBurst(ctx, px, py, pw * 1.05, ctx.gold, 0.04);
                  sparkBurst(ctx, px, py, ctx.gold, 7, pw * 0.8, 0.06);
                  starPop(ctx, px - pw * 0.34, py - ph * 0.42, pw * 0.12, ctx.gold, 0.16);
                }
              } else {
                // SFX: soft absorb thump
                punch
                  .to(plate.scale, { x: 1.07, y: 0.95, duration: 0.06, ease: 'power3.out' }, 0)
                  .to(plate.scale, { x: 1, y: 1, duration: 0.26, ease: 'back.out(2)' }, 0.12)
                  .to(halo, { alpha: 0.85, duration: 0.08, ease: 'power1.out' }, 0)
                  .to(halo, { alpha: 0.35, duration: 0.4, ease: 'power2.in' }, 0.1);
              }
            },
            undefined,
            rise + fly,
          );
        lastArrival = launch + rise + fly;
        launch += jit(ctx, 0.36, 0.2);
      });
      await wait(Math.round((lastArrival + 0.9) * 1000));
      if (!ctx.alive()) return;

      // Resolution — the board returns, the plate takes one breath and bows out.
      ctx.undimBoard();
      const out = ctx.track(ctx.gsap.timeline({ delay: 0.3 }));
      out.to(plate.scale, { x: 1.05, y: 1.05, duration: 0.18, ease: 'power2.out' }, 0)
        .to(plate, { alpha: 0, y: py - 14, duration: 0.42, ease: 'power2.in' }, 0.14);
      await wait(950);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'giant-symbol-spin',
    name: 'Giant Symbol Spin',
    description:
      'A framed 3x3 window forges centre-grid, blur-spins like one huge reel, then slams column by column onto a premium.',
    async run(ctx: MechContext): Promise<void> {
      const size = Math.min(3, ctx.grid.reels, ctx.grid.rows);
      const r0 = Math.max(0, Math.floor((ctx.grid.reels - size) / 2));
      const w0 = Math.max(0, Math.floor((ctx.grid.rows - size) / 2));
      const tl0 = ctx.cellRect(r0, w0);
      const brc = ctx.cellRect(r0 + size - 1, w0 + size - 1);
      const bx = tl0.x;
      const by = tl0.y;
      const bw = brc.x + brc.w - tl0.x;
      const bh = brc.y + brc.h - tl0.y;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const sym = ctx.pick([2, 3] as const);

      // Setup — the room goes dark, one window forges in the centre.
      ctx.dimBoard(0.55);
      // SFX: low riser — the machine inhales

      const maskG = new Graphics();
      maskG.roundRect(bx + 3, by + 3, bw - 6, bh - 6, 13).fill({ color: 0xffffff });
      ctx.overlay.addChild(maskG);
      const windowC = new Container();
      windowC.mask = maskG;
      ctx.overlay.addChild(windowC);

      // Per-column shutters — black plates that burn off one by one at the
      // slam so the reveal reads like a real reel stopping.
      const colW = bw / size;
      const shutters: Graphics[] = [];
      for (let c = 0; c < size; c++) {
        const sh = new Graphics();
        sh.rect(bx + colW * c, by, colW, bh).fill({ color: 0x000000, alpha: 0.94 });
        sh.alpha = 0;
        windowC.addChild(sh);
        shutters.push(sh);
        ctx.track(ctx.gsap.to(sh, { alpha: 1, duration: 0.26, delay: 0.08, ease: 'power2.out' }));
      }

      // The hero border — wide halo / gold body / white inner line. It stays
      // sticky on the footprint after the mechanic resolves.
      const frame = new Container();
      frame.position.set(cx, cy);
      const fGlow = new Graphics();
      fGlow.roundRect(-bw / 2, -bh / 2, bw, bh, 16).stroke({ color: ctx.gold, width: 16, alpha: 0.13 });
      fGlow.blendMode = 'add';
      const fBody = new Graphics();
      fBody.roundRect(-bw / 2, -bh / 2, bw, bh, 16).stroke({ color: ctx.gold, width: 5, alpha: 1 });
      const fLine = new Graphics();
      fLine.roundRect(-bw / 2 + 7, -bh / 2 + 7, bw - 14, bh - 14, 12).stroke({ color: 0xffffff, width: 1.8, alpha: 0.5 });
      frame.addChild(fGlow, fBody, fLine);
      frame.alpha = 0;
      frame.scale.set(1.28);
      ctx.overlay.addChild(frame);
      // SFX: frame forge clang
      const ftl = ctx.track(ctx.gsap.timeline());
      ftl.to(frame, { alpha: 1, duration: 0.14, ease: 'power1.out' }, 0)
        .to(frame.scale, { x: 1, y: 1, duration: 0.42, ease: 'back.out(1.7)' }, 0);
      await wait(500);
      if (!ctx.alive()) return;

      // The spin — vertical streak strips (motion-blur illusion) looping
      // behind the shutter columns. Cluster is duplicated 3x above itself so
      // the wrap is seamless while the strip travels downward.
      const H = bh + tl0.h;
      const strips: Container[] = [];
      const loops: { kill(): void }[] = [];
      // SFX: reel blur roars up
      for (let c = 0; c < size; c++) {
        const strip = new Container();
        strip.position.set(bx + colW * c + colW / 2, by);
        const spec: { yy: number; sw: number; sh: number; col: number; a: number }[] = [];
        let yy = 0;
        while (yy < H) {
          spec.push({
            yy,
            sw: colW * ctx.rand(0.42, 0.58),
            sh: tl0.h * ctx.rand(0.6, 0.95),
            col: ctx.pick([0xffffff, ctx.accent, ctx.gold] as const),
            a: ctx.rand(0.5, 0.9),
          });
          yy += tl0.h * ctx.rand(0.72, 0.98);
        }
        for (const off of [0, -H, -2 * H]) {
          for (const s of spec) {
            const slug = new Graphics();
            slug.roundRect(-s.sw / 2, 0, s.sw, s.sh, s.sw * 0.4).fill({ color: s.col, alpha: 0.12 * s.a });
            slug.roundRect(-s.sw * 0.28, s.sh * 0.08, s.sw * 0.56, s.sh * 0.84, s.sw * 0.24).fill({ color: s.col, alpha: 0.2 * s.a });
            slug.roundRect(-s.sw * 0.1, s.sh * 0.2, s.sw * 0.2, s.sh * 0.6, s.sw * 0.1).fill({ color: 0xffffff, alpha: 0.3 * s.a });
            slug.blendMode = 'add';
            slug.position.set(0, off + s.yy);
            strip.addChild(slug);
          }
        }
        windowC.addChild(strip);
        strips.push(strip);
        const cycle = jit(ctx, 0.34, 0.12);
        const dl = c * 0.09 + ctx.rand(0, 0.03);
        ctx.track(ctx.gsap.to(strip, { y: by + H * 0.6, duration: 0.42, delay: dl, ease: 'power2.in' }));
        loops.push(ctx.track(ctx.gsap.to(strip, { y: `+=${H}`, duration: cycle, delay: dl + 0.42, ease: 'none', repeat: -1 })));
      }
      await wait(1500);
      if (!ctx.alive()) return;

      // The payoff — columns slam to a stop left to right; each stop kills the
      // blur, burns off its shutter and reveals the premium underneath.
      for (let c = 0; c < size; c++) {
        loops[c].kill();
        const strip = strips[c];
        const stl = ctx.track(ctx.gsap.timeline());
        stl.to(strip, { y: `+=${H * 0.2}`, duration: 0.13, ease: 'power3.out' }, 0)
          .to(strip, { alpha: 0, duration: 0.15, ease: 'power2.in' }, 0.06);
        for (let row = w0; row < w0 + size; row++) {
          ctx.setCellSymbol(r0 + c, row, sym);
          ctx.playCellState(r0 + c, row, 'featured');
        }
        ctx.track(ctx.gsap.to(shutters[c], { alpha: 0, duration: 0.14, delay: 0.05, ease: 'power2.in' }));
        coverFlash(ctx, { x: bx + colW * c, y: by, w: colW, h: bh }, ctx.accent, 0.32, 0.04);
        // SFX: column thunk (pitch rises per column)
        await wait(Math.round(jit(ctx, 140, 0.18)));
        if (!ctx.alive()) return;
      }

      // Final slam — the hero border takes the hit: squash, ~0.08s hold,
      // elastic recovery, shockwave + sparks. One moment, one hero.
      // SFX: giant symbol slam
      const slamTl = ctx.track(ctx.gsap.timeline());
      slamTl.to(frame.scale, { x: 1.05, y: 0.93, duration: 0.07, ease: 'power3.out' }, 0)
        .to(frame, { y: cy + 6, duration: 0.07, ease: 'power3.out' }, 0)
        .to(frame, { y: cy, duration: 0.4, ease: 'elastic.out(1, 0.45)' }, 0.15)
        .to(frame.scale, { x: 1, y: 1, duration: 0.45, ease: 'elastic.out(1, 0.45)' }, 0.15);
      ringBurst(ctx, cx, cy, Math.hypot(bw, bh) * 0.6, ctx.gold, 0.02);
      sparkBurst(ctx, cx, cy, ctx.gold, 11, Math.max(bw, bh) * 0.7, 0.05);
      starPop(ctx, bx + bw * 0.84, by + bh * 0.16, bw * 0.06, ctx.gold, 0.2);
      await wait(650);
      if (!ctx.alive()) return;

      // Resolution — light returns; the framed premium stays sticky.
      ctx.undimBoard();
      await wait(800);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'coin-vacuum',
    name: 'Coin Vacuum',
    description:
      'A shining WILD inhales its neighbours one gulp at a time — each symbol stretches into its mouth — then pops a shock ring.',
    async run(ctx: MechContext): Promise<void> {
      const wr = Math.floor(ctx.grid.reels / 2);
      const wo = Math.floor(ctx.grid.rows / 2);
      const wc = ctx.cellRect(wr, wo);
      const wm = mid(wc);

      // Neighbours within one cell of the wild, seeded-shuffled, three prey.
      const neigh: Cell[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dw = -1; dw <= 1; dw++) {
          if (dr === 0 && dw === 0) continue;
          const reel = wr + dr;
          const row = wo + dw;
          if (reel < 0 || row < 0 || reel >= ctx.grid.reels || row >= ctx.grid.rows) continue;
          neigh.push({ reel, row });
        }
      }
      for (let i = neigh.length - 1; i > 0; i--) {
        const j = randInt(ctx, 0, i);
        const t = neigh[i];
        neigh[i] = neigh[j];
        neigh[j] = t;
      }
      const prey = neigh.slice(0, Math.min(3, neigh.length));

      // Setup — the WILD arrives with its real landing beat. It IS the hero.
      const tile = ctx.spawnTile(0, wr, wo, true);
      // SFX: wild lands
      ringBurst(ctx, wm.x, wm.y, wc.w * 0.9, ctx.gold, 0.12);
      await wait(650);
      if (!ctx.alive()) return;
      const bsx = tile.scale.x;
      const bsy = tile.scale.y;

      ctx.dimBoard(0.3);

      // One clear inhale wind-up before the first gulp.
      // SFX: inhale windup
      const inh = ctx.track(ctx.gsap.timeline());
      inh.to(tile.scale, { x: bsx * 0.93, y: bsy * 0.93, duration: 0.22, ease: 'power2.inOut' }, 0)
        .to(tile.scale, { x: bsx * 1.07, y: bsy * 1.07, duration: 0.18, ease: 'back.out(2.2)' }, 0.22);
      await wait(440);
      if (!ctx.alive()) return;

      // The gulps — sequential, one victim at a time (restraint: one read per
      // beat). The real symbol tile lifts off, stretches toward the mouth
      // along a curve and is swallowed; the wild grows with every swallow.
      let grow = 0;
      for (let i = 0; i < prey.length; i++) {
        const p = prey[i];
        const cr = ctx.cellRect(p.reel, p.row);
        const symId = ctx.getCellSymbol(p.reel, p.row);
        const copy = ctx.spawnTile(symId, p.reel, p.row, false);
        // The husk left behind — drained to the lowest pay under the copy.
        ctx.setCellSymbol(p.reel, p.row, 8);
        ctx.playCellState(p.reel, p.row, 'static');
        await wait(240);
        if (!ctx.alive()) return;

        const csx = copy.scale.x;
        const csy = copy.scale.y;
        const dur = jit(ctx, 0.44, 0.12);
        // SFX: stretch-and-slurp
        const pull = ctx.track(ctx.gsap.timeline());
        pull.to(copy, { x: wm.x, duration: dur, ease: 'power2.in' }, 0)
          .to(copy, { y: wm.y - wc.h * 0.12, duration: dur * 0.62, ease: 'power1.out' }, 0)
          .to(copy, { y: wm.y, duration: dur * 0.38, ease: 'power3.in' }, dur * 0.62)
          .to(copy, { rotation: ctx.rand(-0.35, 0.35), duration: dur, ease: 'power2.in' }, 0)
          .to(copy.scale, { x: csx * 1.24, y: csy * 0.8, duration: dur * 0.55, ease: 'power2.in' }, 0)
          .to(copy.scale, { x: 0.02, y: 0.02, duration: dur * 0.45, ease: 'power4.in' }, dur * 0.55)
          .to(copy, { alpha: 0, duration: 0.06, ease: 'power1.in' }, Math.max(0, dur - 0.05));

        // The swallow lands with weight: squash, ~0.08s hold, back.out growth.
        grow = 0.09 * (i + 1);
        // SFX: gulp
        const g = ctx.track(ctx.gsap.timeline({ delay: dur }));
        g.to(tile.scale, { x: bsx * (1 + grow) * 1.15, y: bsy * (1 + grow) * 0.82, duration: 0.07, ease: 'power3.out' }, 0)
          .to(tile.scale, { x: bsx * (1 + grow), y: bsy * (1 + grow), duration: 0.36, ease: 'back.out(1.8)' }, 0.15);
        sparkBurst(ctx, wm.x, wm.y, ctx.gold, 3, wc.w * 0.35, dur + 0.05);
        await wait(Math.round((dur + jit(ctx, 0.48, 0.18)) * 1000));
        if (!ctx.alive()) return;
      }

      // Pressure build — the swollen wild tightens and trembles. Anticipation
      // before the single payoff pop.
      // SFX: pressure builds
      const s1 = 1 + grow;
      const chg = ctx.track(ctx.gsap.timeline());
      chg.to(tile.scale, { x: bsx * s1 * 0.9, y: bsy * s1 * 0.9, duration: 0.42, ease: 'power2.in' }, 0)
        .to(tile, { rotation: 0.02, duration: 0.07, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.12)
        .to(tile, { rotation: 0, duration: 0.05, ease: 'sine.out' }, 0.55);
      await wait(620);
      if (!ctx.alive()) return;

      // The pop — one shock ring moment; the wild snaps back to cell size and
      // the board underneath now genuinely holds the WILD.
      ctx.setCellSymbol(wr, wo, 0);
      ctx.playCellState(wr, wo, 'featured');
      coverFlash(ctx, wc, ctx.gold, 0.5);
      ringBurst(ctx, wm.x, wm.y, Math.max(wc.w, wc.h) * 1.5, ctx.accent, 0);
      ringBurst(ctx, wm.x, wm.y, Math.max(wc.w, wc.h) * 0.95, ctx.gold, 0.09);
      sparkBurst(ctx, wm.x, wm.y, ctx.gold, 9, wc.w * 1.1, 0.02);
      // SFX: shock burst
      const pop = ctx.track(ctx.gsap.timeline());
      pop.to(tile.scale, { x: bsx * 1.18, y: bsy * 1.18, duration: 0.09, ease: 'power3.out' }, 0)
        .to(tile.scale, { x: bsx, y: bsy, duration: 0.55, ease: 'elastic.out(1, 0.42)' }, 0.17);
      ctx.undimBoard();
      await wait(1000);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'reel-swap',
    name: 'Reel Swap',
    description:
      'Two whole reels lift off as glowing panels, arc past each other — one over, one under — and slam into swapped slots.',
    async run(ctx: MechContext): Promise<void> {
      if (ctx.grid.reels < 2) return;
      const lo = randInt(ctx, 0, ctx.grid.reels - 2);
      const hi = randInt(ctx, lo + 1, ctx.grid.reels - 1);
      const rA = ctx.reelRect(lo);
      const rB = ctx.reelRect(hi);
      const rows = ctx.grid.rows;
      const symsA: number[] = [];
      const symsB: number[] = [];
      for (let row = 0; row < rows; row++) {
        symsA.push(ctx.getCellSymbol(lo, row));
        symsB.push(ctx.getCellSymbol(hi, row));
      }

      // Setup — the two panels charge up while the rest of the board recedes.
      ctx.dimBoard(0.4);
      // SFX: panels energize

      const makePlate = (rr: Rect): Container => {
        const p = new Container();
        p.position.set(rr.x + rr.w / 2, rr.y + rr.h / 2);
        const glow = new Graphics();
        glow.roundRect(-rr.w / 2 - 9, -rr.h / 2 - 9, rr.w + 18, rr.h + 18, 18).fill({ color: ctx.accent, alpha: 0.1 });
        glow.blendMode = 'add';
        const bodyG = new Graphics();
        bodyG.roundRect(-rr.w / 2, -rr.h / 2, rr.w, rr.h, 14).fill({ color: 0x000000, alpha: 0.55 });
        bodyG.roundRect(-rr.w / 2, -rr.h / 2, rr.w, rr.h, 14).stroke({ color: ctx.accent, width: 3, alpha: 0.9 });
        bodyG.roundRect(-rr.w / 2 + 5, -rr.h / 2 + 5, rr.w - 10, rr.h - 10, 11).stroke({ color: 0xffffff, width: 1.4, alpha: 0.35 });
        p.addChild(glow, bodyG);
        p.alpha = 0;
        ctx.overlay.addChild(p);
        ctx.track(ctx.gsap.to(p, { alpha: 1, duration: 0.28, ease: 'power2.out' }));
        return p;
      };
      // B's panel first so A's whole panel renders ABOVE when they cross.
      const plateB = makePlate(rB);
      const tilesB: Container[] = [];
      for (let row = 0; row < rows; row++) tilesB.push(ctx.spawnTile(symsB[row], hi, row, false));
      const plateA = makePlate(rA);
      const tilesA: Container[] = [];
      for (let row = 0; row < rows; row++) tilesA.push(ctx.spawnTile(symsA[row], lo, row, false));
      await wait(620);
      if (!ctx.alive()) return;

      // Rigid-panel movement: one proxy per panel drives plate + tiles through
      // a single updater, so each reel moves as ONE object, not five.
      type Member = { n: Container; bx: number; by: number };
      const gather = (plate: Container, tiles: Container[]): Member[] =>
        [plate, ...tiles].map((n) => ({ n, bx: n.x, by: n.y }));
      const mA = gather(plateA, tilesA);
      const mB = gather(plateB, tilesB);
      const dx = rB.x - rA.x;
      const apexA = rA.h * 0.24; // travels OVER
      const apexB = rA.h * 0.16; // ducks UNDER
      const stA = { lift: 0, p: 0 };
      const stB = { lift: 0, p: 0 };
      const makeApply = (ms: Member[], st: { lift: number; p: number }, ddx: number, arc: number) => (): void => {
        const dy = st.lift - Math.sin(Math.PI * st.p) * arc;
        for (const m of ms) {
          m.n.x = m.bx + ddx * st.p;
          m.n.y = m.by + dy;
        }
      };
      const updA = makeApply(mA, stA, dx, apexA);
      const updB = makeApply(mB, stB, -dx, -apexB);
      const ride = (st: { lift: number; p: number }, upd: () => void, liftH: number, delay: number): void => {
        const tl = ctx.track(ctx.gsap.timeline({ delay }));
        tl.to(st, { lift: 7, duration: 0.12, ease: 'power2.out', onUpdate: upd }, 0) // press down first
          .to(st, { lift: -liftH, duration: 0.3, ease: 'back.out(1.8)', onUpdate: upd }, 0.12) // lift free
          .to(st, { p: 1, duration: 0.9, ease: 'power1.inOut', onUpdate: upd }, 0.56) // the crossing
          .to(st, { lift: 0, duration: 0.15, ease: 'power4.in', onUpdate: upd }, 1.5); // slam home
      };
      // SFX: lift-off hum
      ride(stA, updA, 18, 0);
      const dB = jit(ctx, 0.09, 0.3);
      ride(stB, updB, 13, dB);
      await wait(1650);
      if (!ctx.alive()) return;

      // The payoff — panel A slams home; the underlying reels swap beneath the
      // copies at the same instant, hidden by the impact flash.
      for (let row = 0; row < rows; row++) {
        ctx.setCellSymbol(lo, row, symsB[row]);
        ctx.setCellSymbol(hi, row, symsA[row]);
      }
      const slam = (plate: Container, tiles: Container[], rr: Rect): void => {
        coverFlash(ctx, rr, ctx.accent, 0.4);
        ringBurst(ctx, rr.x + rr.w / 2, rr.y + rr.h - 14, rr.w * 0.8, ctx.accent, 0.03);
        for (const t of [plate, ...tiles]) {
          const sx = t.scale.x;
          const sy = t.scale.y;
          const q = ctx.track(ctx.gsap.timeline());
          q.to(t.scale, { x: sx * 1.08, y: sy * 0.85, duration: 0.07, ease: 'power3.out' }, 0)
            .to(t.scale, { x: sx, y: sy, duration: 0.45, ease: 'elastic.out(1, 0.42)' }, 0.15); // hold, then release
        }
        sparkBurst(ctx, rr.x + rr.w / 2, rr.y + rr.h - 10, ctx.gold, 5, rr.w * 0.6, 0.04);
      };
      // SFX: heavy panel slam (A)
      slam(plateA, tilesA, rB); // A landed where B was
      await wait(Math.round(dB * 1000) + 70);
      if (!ctx.alive()) return;
      // SFX: heavy panel slam (B)
      slam(plateB, tilesB, rA);
      await wait(700);
      if (!ctx.alive()) return;

      // Resolution — the copies dissolve onto the already-swapped board.
      for (const n of [plateA, plateB, ...tilesA, ...tilesB]) {
        ctx.track(ctx.gsap.to(n, { alpha: 0, duration: 0.32, ease: 'power2.in' }));
      }
      ctx.undimBoard();
      await wait(700);
    },
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'golden-frame-hunt',
    name: 'Golden Frame Hunt',
    description:
      'A golden frame hops the board like a roulette ball, teases a premium, darts away and stamps its true cell into a WILD.',
    async run(ctx: MechContext): Promise<void> {
      const c0 = ctx.cellRect(0, 0);

      // Guarantee a premium to tease past; bless one quietly if none rolled.
      let prem: Cell | null = null;
      const pool = shuffledCells(ctx);
      for (const cell of pool) {
        const s = ctx.getCellSymbol(cell.reel, cell.row);
        if (s === 2 || s === 3) {
          prem = cell;
          break;
        }
      }
      const others = pool.filter((cell) => !prem || cell.reel !== prem.reel || cell.row !== prem.row);
      if (!prem) {
        prem = others.pop() as Cell;
        ctx.setCellSymbol(prem.reel, prem.row, 2);
      }
      const hops = Math.min(randInt(ctx, 5, 7), others.length - 1);
      // Landings: wander -> the premium tease (penultimate) -> the true mark.
      const path: Cell[] = others.slice(0, hops - 1);
      path.push(prem);
      path.push(others[hops - 1]);

      // Setup — one golden frame pops in over a dimmed board. It is the only
      // moving thing for the whole hunt.
      const fw = c0.w;
      const fh = c0.h;
      const frame = new Container();
      const halo = new Graphics();
      halo.roundRect(-fw / 2 - 7, -fh / 2 - 7, fw + 14, fh + 14, 16).stroke({ color: ctx.gold, width: 12, alpha: 0.13 });
      halo.blendMode = 'add';
      const bodyS = new Graphics();
      bodyS.roundRect(-fw / 2, -fh / 2, fw, fh, 12).stroke({ color: ctx.gold, width: 4.5, alpha: 1 });
      const inner = new Graphics();
      inner.roundRect(-fw / 2 + 6, -fh / 2 + 6, fw - 12, fh - 12, 9).stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
      frame.addChild(halo, bodyS, inner);
      const start = mid(ctx.cellRect(path[0].reel, path[0].row));
      frame.position.set(start.x, start.y);
      frame.scale.set(0);
      ctx.overlay.addChild(frame);

      ctx.dimBoard(0.35);
      // SFX: frame chimes in
      const inTl = ctx.track(ctx.gsap.timeline());
      inTl.to(frame.scale, { x: 1.1, y: 1.1, duration: 0.26, ease: 'back.out(2.4)' }, 0)
        .to(frame.scale, { x: 1, y: 1, duration: 0.16, ease: 'power2.out' }, 0.26);
      ctx.track(ctx.gsap.to(halo, { alpha: 0.55, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
      await wait(500);
      if (!ctx.alive()) return;

      // The hunt — roulette deceleration: early hops snap, later hops hang.
      // The very last hop is FAST again — the snatch away from the premium.
      for (let k = 1; k <= hops; k++) {
        const dest = path[k];
        const to = mid(ctx.cellRect(dest.reel, dest.row));
        const isTease = k === hops - 1;
        const isFinal = k === hops;
        const t = isFinal ? 0.16 : jit(ctx, 0.16 + Math.pow(k / hops, 1.7) * 0.3, 0.12);
        // SFX: roulette tick
        const hop = ctx.track(ctx.gsap.timeline());
        hop.to(frame, { x: to.x, duration: t, ease: isFinal ? 'power3.in' : 'power1.inOut' }, 0)
          .to(frame, { y: to.y - fh * (isFinal ? 0.08 : 0.18), duration: t * 0.5, ease: 'power2.out' }, 0)
          .to(frame, { y: to.y, duration: t * 0.5, ease: 'power2.in' }, t * 0.5)
          .to(frame.scale, { x: 1.06, y: 0.94, duration: 0.05, ease: 'power2.out' }, t)
          .to(frame.scale, { x: 1, y: 1, duration: 0.14, ease: 'back.out(2)' }, t + 0.05);
        const settle = isFinal ? 60 : Math.round(jit(ctx, 50 + Math.pow(k / hops, 2) * 210, 0.25));
        await wait(Math.round(t * 1000) + 130 + settle);
        if (!ctx.alive()) return;

        if (isTease) {
          // The fake-out — it *wants* this premium: two hungry pulses… then no.
          ctx.playCellState(dest.reel, dest.row, 'featured');
          // SFX: tease swell
          const tease = ctx.track(ctx.gsap.timeline());
          tease.to(frame.scale, { x: 1.09, y: 1.09, duration: 0.16, ease: 'power2.out' }, 0)
            .to(frame.scale, { x: 1, y: 1, duration: 0.18, ease: 'power2.inOut' }, 0.16)
            .to(frame.scale, { x: 1.06, y: 1.06, duration: 0.14, ease: 'power2.out' }, 0.38)
            .to(frame.scale, { x: 1, y: 1, duration: 0.16, ease: 'power2.inOut' }, 0.52);
          await wait(760);
          if (!ctx.alive()) return;
          ctx.playCellState(dest.reel, dest.row, 'static');
          // SFX: denial blip
        }
      }

      // The stamp — rear up, slam with power4.in, the cell turns WILD under a
      // snap flash, squash + ~0.08s hold, elastic release. One payoff moment.
      const fin = path[hops];
      const fr = ctx.cellRect(fin.reel, fin.row);
      const fm = mid(fr);
      // SFX: stamp windup
      const stamp = ctx.track(ctx.gsap.timeline());
      stamp.to(frame.scale, { x: 1.32, y: 1.32, duration: 0.18, ease: 'power2.out' }, 0)
        .to(frame, { y: fm.y - fh * 0.16, duration: 0.18, ease: 'power2.out' }, 0)
        .to(frame.scale, { x: 0.98, y: 0.98, duration: 0.12, ease: 'power4.in' }, 0.26)
        .to(frame, { y: fm.y, duration: 0.12, ease: 'power4.in' }, 0.26)
        .call(
          () => {
            if (!ctx.alive()) return;
            ctx.setCellSymbol(fin.reel, fin.row, 0);
            ctx.playCellState(fin.reel, fin.row, 'featured');
          },
          undefined,
          0.38,
        )
        .to(frame.scale, { x: 1.06, y: 0.92, duration: 0.06, ease: 'power3.out' }, 0.38)
        .to(frame.scale, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 0.52); // hold 0.38->0.52 baked in
      // SFX: stamp thunk
      coverFlash(ctx, fr, ctx.gold, 0.5, 0.36);
      ringBurst(ctx, fm.x, fm.y, Math.max(fr.w, fr.h) * 1.05, ctx.gold, 0.4);
      sparkBurst(ctx, fm.x, fm.y, ctx.gold, 7, fr.w * 0.8, 0.42);
      starPop(ctx, fm.x + fr.w * 0.3, fm.y - fr.h * 0.32, fr.w * 0.14, ctx.gold, 0.5);
      await wait(1100);
      if (!ctx.alive()) return;

      // Resolution — light back up; the golden frame stays sticky on its WILD.
      ctx.undimBoard();
      await wait(500);
    },
  },
];
