// FX pack: AMBIENT — idle-mood effects that live on top of the whole grid.
// Eight clearly distinct looks: fireflies, aurora, grid breathe, corner
// glints, heat shimmer, neon rim boot, drifting light blob, star field.
//
// Contract: everything is grid-relative (ctx.cellRect / reelRect / gridRect),
// theme colors come from ctx.accent / ctx.gold, every tween/timeline is
// registered via ctx.track() so the showcase can cancel mid-flight, and the
// layer itself is cleaned up by the host — we only add children to it.

import { Container, Graphics, Sprite, Texture, BlurFilter } from 'pixi.js';
import type { FxEntry, FxContext } from '../fxTypes';

// ---------------------------------------------------------------------------
// Shared lazy textures (white — tint per use). Built once, reused by effects.
// ---------------------------------------------------------------------------

let _glowTex: Texture | null = null;
/** Soft radial glow blob (white → transparent). */
function glowTexture(): Texture {
  if (_glowTex) return _glowTex;
  const S = 128;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = S;
  const c = cvs.getContext('2d')!;
  const grad = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, S, S);
  _glowTex = Texture.from(cvs);
  return _glowTex;
}

let _bandTex: Texture | null = null;
/** Soft horizontal band — fades out vertically AND at both horizontal ends. */
function bandTexture(): Texture {
  if (_bandTex) return _bandTex;
  const W = 256;
  const H = 64;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const c = cvs.getContext('2d')!;
  const v = c.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0.0, 'rgba(255,255,255,0)');
  v.addColorStop(0.5, 'rgba(255,255,255,1)');
  v.addColorStop(1.0, 'rgba(255,255,255,0)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  const h = c.createLinearGradient(0, 0, W, 0);
  h.addColorStop(0.0, 'rgba(0,0,0,0)');
  h.addColorStop(0.2, 'rgba(0,0,0,1)');
  h.addColorStop(0.8, 'rgba(0,0,0,1)');
  h.addColorStop(1.0, 'rgba(0,0,0,0)');
  c.globalCompositeOperation = 'destination-in';
  c.fillStyle = h;
  c.fillRect(0, 0, W, H);
  _bandTex = Texture.from(cvs);
  return _bandTex;
}

/** 4-point sparkle star drawn into a Graphics (two thin bars + hot core). */
function drawStar(g: Graphics, r: number, color: number, alpha: number): void {
  const t = Math.max(1.2, r * 0.16);
  g.roundRect(-r, -t / 2, r * 2, t, t / 2).fill({ color, alpha });
  g.roundRect(-t / 2, -r, t, r * 2, t / 2).fill({ color, alpha });
  g.circle(0, 0, Math.max(1, r * 0.22)).fill({ color: 0xffffff, alpha: Math.min(1, alpha + 0.25) });
}

// ---------------------------------------------------------------------------
// 1) ambient-fireflies — soft accent motes drifting over the grid
// ---------------------------------------------------------------------------

function runFireflies(ctx: FxContext): void {
  const g = ctx.gridRect();
  const count = 16;
  const tints = [ctx.accent, ctx.accent, ctx.gold, 0xffffff] as const;

  for (let i = 0; i < count; i++) {
    const fly = new Sprite(glowTexture());
    fly.anchor.set(0.5);
    fly.tint = ctx.pick(tints);
    fly.blendMode = 'add';
    const size = ctx.rand(g.w * 0.018, g.w * 0.042);
    fly.width = fly.height = size;
    const x0 = g.x + ctx.rand(g.w * 0.06, g.w * 0.94);
    const y0 = g.y + ctx.rand(g.h * 0.08, g.h * 0.92);
    fly.position.set(x0, y0);
    fly.alpha = 0;
    ctx.layer.addChild(fly);

    const drift = g.w * 0.07;
    const peak = ctx.rand(0.45, 0.85);
    const tl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0, 0.3) }));
    // Glow up while starting to wander.
    tl.to(fly, { alpha: peak, duration: 0.35, ease: 'power2.out' }, 0);
    tl.to(fly, {
      x: x0 + ctx.rand(-drift, drift),
      y: y0 + ctx.rand(-drift, drift * 0.4), // fireflies prefer floating up
      duration: ctx.rand(0.8, 1.1),
      ease: 'sine.inOut',
    }, 0);
    // Second wander leg + gutter out.
    tl.to(fly, {
      x: `+=${ctx.rand(-drift, drift)}`,
      y: `-=${ctx.rand(drift * 0.2, drift * 0.9)}`,
      duration: ctx.rand(0.8, 1.1),
      ease: 'sine.inOut',
    });
    tl.to(fly, { alpha: 0, duration: 0.5, ease: 'sine.in' }, '-=0.5');
    // Lantern flicker on top of the drift.
    ctx.track(ctx.gsap.to(fly.scale, {
      x: fly.scale.x * 1.35,
      y: fly.scale.y * 1.35,
      duration: ctx.rand(0.22, 0.4),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 4,
    }));
  }
}

// ---------------------------------------------------------------------------
// 2) ambient-aurora — slow additive color band waving over the top rows
// ---------------------------------------------------------------------------

function runAurora(ctx: FxContext): void {
  const g = ctx.gridRect();
  const specs = [
    { tint: ctx.accent, yF: 0.10, hF: 0.26, alpha: 0.34, phase: 0.00 },
    { tint: ctx.gold,   yF: 0.20, hF: 0.22, alpha: 0.24, phase: 0.18 },
    { tint: 0xffffff,   yF: 0.06, hF: 0.14, alpha: 0.16, phase: 0.32 },
  ] as const;

  for (const s of specs) {
    const band = new Sprite(bandTexture());
    band.anchor.set(0.5);
    band.tint = s.tint;
    band.blendMode = 'add';
    band.width = g.w * 1.08;
    band.height = g.h * s.hF;
    band.position.set(g.x + g.w / 2, g.y + g.h * s.yF + band.height / 2);
    band.alpha = 0;
    band.skew.x = -0.10;
    ctx.layer.addChild(band);

    const tl = ctx.track(ctx.gsap.timeline({ delay: s.phase }));
    tl.to(band, { alpha: s.alpha, duration: 0.55, ease: 'sine.out' }, 0);
    tl.to(band, { alpha: 0, duration: 0.7, ease: 'sine.in' }, 1.6);
    // The wave: skew sways while the curtain bobs and slides sideways.
    ctx.track(ctx.gsap.to(band.skew, {
      x: 0.10,
      duration: ctx.rand(0.7, 0.95),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 3,
      delay: s.phase,
    }));
    ctx.track(ctx.gsap.to(band, {
      y: band.y + g.h * 0.03,
      x: band.x + g.w * ctx.rand(-0.035, 0.035),
      duration: ctx.rand(1.0, 1.3),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 1,
      delay: s.phase,
    }));
  }
}

// ---------------------------------------------------------------------------
// 3) ambient-grid-breathe — barely-visible whole-grid luminance breathe
// ---------------------------------------------------------------------------

function runGridBreathe(ctx: FxContext): void {
  const g = ctx.gridRect();
  const holder = new Container();
  holder.position.set(g.x + g.w / 2, g.y + g.h / 2);
  ctx.layer.addChild(holder);

  // Whisper-quiet luminance lift over the whole board.
  const lift = new Graphics();
  lift.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, Math.min(g.w, g.h) * 0.04)
    .fill({ color: ctx.accent, alpha: 1 });
  lift.blendMode = 'add';
  lift.alpha = 0;

  // A faint frame that inhales slightly out of phase.
  const frame = new Graphics();
  frame.roundRect(-g.w / 2 + 3, -g.h / 2 + 3, g.w - 6, g.h - 6, Math.min(g.w, g.h) * 0.04)
    .stroke({ color: 0xffffff, width: 2, alpha: 1 });
  frame.blendMode = 'add';
  frame.alpha = 0;

  holder.addChild(lift, frame);

  // Two slow breaths: in, out, in, release.
  const tl = ctx.track(ctx.gsap.timeline());
  tl.to(lift, { alpha: 0.055, duration: 0.55, ease: 'sine.inOut' }, 0);
  tl.to(lift, { alpha: 0.015, duration: 0.55, ease: 'sine.inOut' });
  tl.to(lift, { alpha: 0.06, duration: 0.55, ease: 'sine.inOut' });
  tl.to(lift, { alpha: 0, duration: 0.65, ease: 'sine.in' });

  ctx.track(ctx.gsap.to(holder.scale, {
    x: 1.012,
    y: 1.012,
    duration: 0.55,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 3,
  }));
  const ftl = ctx.track(ctx.gsap.timeline({ delay: 0.18 }));
  ftl.to(frame, { alpha: 0.12, duration: 0.5, ease: 'sine.inOut' }, 0);
  ftl.to(frame, { alpha: 0.03, duration: 0.5, ease: 'sine.inOut' });
  ftl.to(frame, { alpha: 0.12, duration: 0.5, ease: 'sine.inOut' });
  ftl.to(frame, { alpha: 0, duration: 0.6, ease: 'sine.in' });
}

// ---------------------------------------------------------------------------
// 4) ambient-corner-glints — star glints popping at random cell corners
// ---------------------------------------------------------------------------

function runCornerGlints(ctx: FxContext): void {
  const corners = [
    [0, 0], [1, 0], [0, 1], [1, 1],
  ] as const;
  const count = 9;

  for (let i = 0; i < count; i++) {
    const reel = Math.floor(ctx.rand(0, ctx.grid.reels - 0.001));
    const row = Math.floor(ctx.rand(0, ctx.grid.rows - 0.001));
    const cell = ctx.cellRect(reel, row);
    const [cx, cy] = ctx.pick(corners);
    const x = cell.x + cx * cell.w;
    const y = cell.y + cy * cell.h;
    const r = ctx.rand(cell.w * 0.10, cell.w * 0.18);
    const color = ctx.pick([ctx.gold, ctx.accent, 0xffffff] as const);

    const glint = new Container();
    glint.position.set(x, y);
    glint.rotation = ctx.rand(-0.5, 0.5);
    glint.scale.set(0);

    const halo = new Sprite(glowTexture());
    halo.anchor.set(0.5);
    halo.tint = color;
    halo.blendMode = 'add';
    halo.width = halo.height = r * 3.2;
    halo.alpha = 0.5;

    const star = new Graphics();
    drawStar(star, r, color, 0.95);
    star.blendMode = 'add';

    glint.addChild(halo, star);
    ctx.layer.addChild(glint);

    const delay = (i / count) * 1.1 + ctx.rand(0, 0.12);
    const tl = ctx.track(ctx.gsap.timeline({ delay }));
    tl.to(glint.scale, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2.6)' }, 0);
    tl.to(glint, { rotation: glint.rotation + ctx.rand(0.4, 0.9), duration: 0.8, ease: 'power1.out' }, 0);
    tl.to(glint.scale, { x: 0, y: 0, duration: 0.4, ease: 'power3.in' }, 0.42);
    tl.to(glint, {
      alpha: 0,
      duration: 0.32,
      ease: 'sine.in',
      onComplete: () => { if (glint.parent) glint.parent.removeChild(glint); glint.destroy({ children: true }); },
    }, 0.5);
  }
}

// ---------------------------------------------------------------------------
// 5) ambient-heat-shimmer — subtle wavy alpha bands rising over the board
// ---------------------------------------------------------------------------

function runHeatShimmer(ctx: FxContext): void {
  const g = ctx.gridRect();
  const holder = new Container();
  holder.filters = [new BlurFilter({ strength: 5, quality: 3 })];
  ctx.layer.addChild(holder);

  const count = 6;
  for (let i = 0; i < count; i++) {
    const band = new Sprite(bandTexture());
    band.anchor.set(0.5);
    band.tint = i % 3 === 0 ? ctx.accent : 0xffffff;
    band.blendMode = 'add';
    band.width = g.w * ctx.rand(0.6, 0.92);
    band.height = g.h * ctx.rand(0.05, 0.09);
    const x0 = g.x + g.w / 2 + ctx.rand(-g.w * 0.12, g.w * 0.12);
    const y0 = g.y + g.h * ctx.rand(0.8, 1.0);
    band.position.set(x0, y0);
    band.alpha = 0;
    holder.addChild(band);

    const delay = ctx.rand(0, 0.5);
    const rise = ctx.rand(1.5, 2.0);
    const tl = ctx.track(ctx.gsap.timeline({ delay }));
    tl.to(band, { alpha: ctx.rand(0.06, 0.12), duration: 0.4, ease: 'sine.out' }, 0);
    tl.to(band, { y: g.y + g.h * ctx.rand(0.02, 0.15), duration: rise, ease: 'power1.out' }, 0);
    tl.to(band, { width: band.width * 1.25, duration: rise, ease: 'sine.out' }, 0);
    tl.to(band, { alpha: 0, duration: 0.55, ease: 'sine.in' }, rise - 0.55);
    // Sideways heat wobble.
    ctx.track(ctx.gsap.to(band, {
      x: x0 + g.w * ctx.rand(0.03, 0.06) * (i % 2 === 0 ? 1 : -1),
      duration: ctx.rand(0.3, 0.5),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 5,
      delay,
    }));
  }
}

// ---------------------------------------------------------------------------
// 6) ambient-neon-rim — grid frame neon flicker-on like a sign booting
// ---------------------------------------------------------------------------

function runNeonRim(ctx: FxContext): void {
  const g = ctx.gridRect();
  const radius = Math.min(g.w, g.h) * 0.045;
  const rim = new Container();
  ctx.layer.addChild(rim);

  const glow = new Graphics();
  glow.roundRect(g.x + 4, g.y + 4, g.w - 8, g.h - 8, radius)
    .stroke({ color: ctx.accent, width: 12, alpha: 0.55 });
  glow.blendMode = 'add';
  glow.filters = [new BlurFilter({ strength: 7, quality: 3 })];

  const core = new Graphics();
  core.roundRect(g.x + 4, g.y + 4, g.w - 8, g.h - 8, radius)
    .stroke({ color: 0xffffff, width: 2.5, alpha: 0.95 });
  core.blendMode = 'add';

  rim.addChild(glow, core);
  rim.alpha = 0;

  // Neon boot: stuttering flicker levels, then lock on, gentle hum, power down.
  const tl = ctx.track(ctx.gsap.timeline());
  const levels = [0.85, ctx.rand(0.08, 0.2), 1, ctx.rand(0.15, 0.35), 0.9, 0.3, 1];
  let at = 0;
  for (const lvl of levels) {
    const d = ctx.rand(0.04, 0.09);
    tl.to(rim, { alpha: lvl, duration: d, ease: 'none' }, at);
    at += d + ctx.rand(0.01, 0.05);
  }
  tl.to(rim, { alpha: 0.82, duration: 0.35, ease: 'sine.inOut' }, at + 0.1);
  tl.to(rim, { alpha: 1, duration: 0.35, ease: 'sine.inOut' });
  tl.to(rim, { alpha: 0, duration: 0.6, ease: 'power2.in' }, 1.8);

  // Two glints sliding-in at the moment the sign locks on.
  const spots = [
    { x: g.x + g.w * ctx.rand(0.1, 0.4), y: g.y + 4 },
    { x: g.x + g.w * ctx.rand(0.6, 0.9), y: g.y + g.h - 4 },
  ];
  for (const p of spots) {
    const star = new Graphics();
    drawStar(star, Math.min(g.w, g.h) * 0.045, 0xffffff, 0.9);
    star.blendMode = 'add';
    star.position.set(p.x, p.y);
    star.scale.set(0);
    ctx.layer.addChild(star);
    const stl = ctx.track(ctx.gsap.timeline({ delay: at + ctx.rand(0.05, 0.25) }));
    stl.to(star.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(3)' }, 0);
    stl.to(star, { rotation: 0.7, duration: 0.6, ease: 'power1.out' }, 0);
    stl.to(star.scale, { x: 0, y: 0, duration: 0.3, ease: 'power3.in' }, 0.3);
  }
}

// ---------------------------------------------------------------------------
// 7) ambient-drifting-light — a soft light blob wanders across the board
// ---------------------------------------------------------------------------

function runDriftingLight(ctx: FxContext): void {
  const g = ctx.gridRect();
  const blob = new Container();

  const halo = new Sprite(glowTexture());
  halo.anchor.set(0.5);
  halo.tint = ctx.gold;
  halo.blendMode = 'add';
  halo.width = halo.height = g.h * 1.05;
  halo.alpha = 0.35;

  const core = new Sprite(glowTexture());
  core.anchor.set(0.5);
  core.tint = ctx.accent;
  core.blendMode = 'add';
  core.width = core.height = g.h * 0.62;

  blob.addChild(halo, core);
  const startLeft = ctx.rand(0, 1) < 0.5;
  const x0 = startLeft ? g.x + g.w * 0.12 : g.x + g.w * 0.88;
  const x2 = startLeft ? g.x + g.w * 0.86 : g.x + g.w * 0.14;
  const y0 = g.y + g.h * ctx.rand(0.25, 0.7);
  blob.position.set(x0, y0);
  blob.alpha = 0;
  ctx.layer.addChild(blob);

  const tl = ctx.track(ctx.gsap.timeline());
  tl.to(blob, { alpha: 0.55, duration: 0.4, ease: 'sine.out' }, 0);
  // Wander: two smooth legs with a vertical detour in the middle.
  tl.to(blob, {
    x: (x0 + x2) / 2 + g.w * ctx.rand(-0.06, 0.06),
    y: g.y + g.h * ctx.rand(0.15, 0.85),
    duration: 0.85,
    ease: 'sine.inOut',
  }, 0.05);
  tl.to(blob, {
    x: x2,
    y: g.y + g.h * ctx.rand(0.3, 0.65),
    duration: 0.85,
    ease: 'sine.inOut',
  });
  tl.to(blob, { alpha: 0, duration: 0.55, ease: 'sine.in' }, '-=0.5');

  // The core lags behind the halo slightly — feels like liquid light.
  ctx.track(ctx.gsap.to(core.scale, {
    x: core.scale.x * 1.18,
    y: core.scale.y * 1.18,
    duration: 0.45,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 3,
  }));
  ctx.track(ctx.gsap.to(core.position, {
    x: startLeft ? -g.w * 0.03 : g.w * 0.03,
    duration: 0.85,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 1,
  }));
}

// ---------------------------------------------------------------------------
// 8) ambient-star-field — tiny twinkling stars parallax over the grid
// ---------------------------------------------------------------------------

function runStarField(ctx: FxContext): void {
  const g = ctx.gridRect();
  const dir = ctx.rand(0, 1) < 0.5 ? 1 : -1;

  const makeLayer = (
    count: number,
    rMin: number,
    rMax: number,
    driftF: number,
    alphaMax: number,
    withCross: boolean,
  ): void => {
    const layer = new Container();
    layer.alpha = 0;
    ctx.layer.addChild(layer);

    for (let i = 0; i < count; i++) {
      const r = ctx.rand(rMin, rMax) * (g.w / 600);
      const color = ctx.pick([0xffffff, 0xffffff, ctx.gold, ctx.accent] as const);
      const star = new Graphics();
      if (withCross) drawStar(star, r * 2.2, color, 0.9);
      else star.circle(0, 0, r).fill({ color, alpha: 0.9 });
      star.blendMode = 'add';
      star.position.set(
        g.x + ctx.rand(g.w * 0.03, g.w * 0.97),
        g.y + ctx.rand(g.h * 0.04, g.h * 0.96),
      );
      star.alpha = ctx.rand(0.15, alphaMax);
      layer.addChild(star);
      // Independent twinkle rate per star.
      ctx.track(ctx.gsap.to(star, {
        alpha: ctx.rand(0.05, 0.25),
        duration: ctx.rand(0.22, 0.55),
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 5,
        delay: ctx.rand(0, 0.4),
      }));
    }

    // Parallax: the whole layer slides — near layer faster than far layer.
    ctx.track(ctx.gsap.to(layer, {
      x: dir * g.w * driftF,
      duration: 2.4,
      ease: 'sine.inOut',
    }));
    const tl = ctx.track(ctx.gsap.timeline());
    tl.to(layer, { alpha: 1, duration: 0.4, ease: 'sine.out' }, 0);
    tl.to(layer, { alpha: 0, duration: 0.55, ease: 'sine.in' }, 1.85);
  };

  makeLayer(16, 1.4, 2.4, 0.015, 0.6, false); // far: small, slow, dim
  makeLayer(9, 2.4, 4.0, 0.045, 0.9, false);  // mid: bigger, faster
  makeLayer(4, 3.0, 4.5, 0.07, 1.0, true);    // near: sparkle crosses, fastest
}

// ---------------------------------------------------------------------------
// Pack export
// ---------------------------------------------------------------------------

export const FX_PACK_AMBIENT: readonly FxEntry[] = [
  {
    id: 'ambient-fireflies',
    name: 'Fireflies',
    group: 'ambient',
    description: 'Soft accent motes drift and flicker over the grid like fireflies.',
    run: runFireflies,
  },
  {
    id: 'ambient-aurora',
    name: 'Aurora',
    group: 'ambient',
    description: 'Slow additive color curtains wave over the top rows.',
    run: runAurora,
  },
  {
    id: 'ambient-grid-breathe',
    name: 'Grid breathe',
    group: 'ambient',
    description: 'Barely-visible whole-grid luminance breathe with a faint frame.',
    run: runGridBreathe,
  },
  {
    id: 'ambient-corner-glints',
    name: 'Corner glints',
    group: 'ambient',
    description: 'Star glints pop and spin at random cell corners.',
    run: runCornerGlints,
  },
  {
    id: 'ambient-heat-shimmer',
    name: 'Heat shimmer',
    group: 'ambient',
    description: 'Subtle blurred alpha bands rise and wobble like heat haze.',
    run: runHeatShimmer,
  },
  {
    id: 'ambient-neon-rim',
    name: 'Neon rim',
    group: 'ambient',
    description: 'The grid frame flickers on like a neon sign booting up.',
    run: runNeonRim,
  },
  {
    id: 'ambient-drifting-light',
    name: 'Drifting light',
    group: 'ambient',
    description: 'A soft two-tone light blob wanders across the board.',
    run: runDriftingLight,
  },
  {
    id: 'ambient-star-field',
    name: 'Star field',
    group: 'ambient',
    description: 'Tiny twinkling stars drift in three parallax layers.',
    run: runStarField,
  },
];
