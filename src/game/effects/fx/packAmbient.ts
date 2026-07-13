// FX pack: AMBIENT — idle-mood effects that live on top of the whole grid.
// Eight clearly distinct looks: fireflies, aurora, grid breathe, corner
// glints, heat shimmer, neon rim boot, drifting light blob, star field.
//
// Contract: everything is grid-relative (ctx.cellRect / reelRect / gridRect),
// theme colors come from ctx.accent / ctx.gold, every tween/timeline is
// registered via ctx.track() so the showcase can cancel mid-flight, and the
// layer itself is cleaned up by the host — we only add children to it.
//
// Craft rules baked in: every light is a layered stack (wide whisper halo →
// mid core → tiny hot white center), ambient washes stay under ~0.15 alpha,
// nothing moves in lockstep (per-element jitter on duration/phase/drift),
// alpha/scale falloff always rides a power curve, and nothing pops off —
// exits fade while continuing their motion.

import { Container, Graphics, Sprite, Texture, BlurFilter } from 'pixi.js';
import type { FxEntry, FxContext } from '../fxTypes';

// ---------------------------------------------------------------------------
// Shared lazy textures (white — tint per use). Built once, reused by effects.
// ---------------------------------------------------------------------------

let _glowTex: Texture | null = null;
/** Soft radial glow blob (white → transparent), gentle shoulder falloff. */
function glowTexture(): Texture {
  if (_glowTex) return _glowTex;
  const S = 128;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = S;
  const c = cvs.getContext('2d')!;
  const grad = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.72)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.28)');
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
  h.addColorStop(0.22, 'rgba(0,0,0,1)');
  h.addColorStop(0.78, 'rgba(0,0,0,1)');
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

/** Additive glow sprite, centered, tinted, sized — one layer of a stack. */
function glowLayer(tint: number, size: number, alpha: number): Sprite {
  const s = new Sprite(glowTexture());
  s.anchor.set(0.5);
  s.tint = tint;
  s.blendMode = 'add';
  s.width = s.height = size;
  s.alpha = alpha;
  return s;
}

// ---------------------------------------------------------------------------
// 1) ambient-fireflies — soft accent motes drifting over the grid
// ---------------------------------------------------------------------------

function runFireflies(ctx: FxContext): void {
  const g = ctx.gridRect();
  const count = 13; // odd, asymmetric — no even grid of bugs
  const tints = [ctx.accent, ctx.accent, ctx.gold, 0xffffff] as const;

  for (let i = 0; i < count; i++) {
    const tint = ctx.pick(tints);
    const size = ctx.rand(g.w * 0.016, g.w * 0.04);

    // Layered lantern: wide whisper halo → mid body → hot white pinprick.
    const fly = new Container();
    const halo = glowLayer(tint, size * 3.1, 0.13);
    const body = glowLayer(tint, size * 1.5, 0.4);
    const hot = glowLayer(0xffffff, size * 0.5, 0.8);
    fly.addChild(halo, body, hot);

    const x0 = g.x + ctx.rand(g.w * 0.06, g.w * 0.94);
    const y0 = g.y + ctx.rand(g.h * 0.08, g.h * 0.92);
    fly.position.set(x0, y0);
    fly.alpha = 0;
    ctx.layer.addChild(fly);

    const drift = g.w * ctx.rand(0.05, 0.09);
    const peak = ctx.rand(0.5, 0.85);
    const tl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0, 0.45) }));
    // Glow up while starting to wander — soft power arrival, no linear ramps.
    tl.to(fly, { alpha: peak, duration: ctx.rand(0.3, 0.45), ease: 'power2.out' }, 0);
    tl.to(fly, {
      x: x0 + ctx.rand(-drift, drift),
      y: y0 + ctx.rand(-drift, drift * 0.35), // fireflies prefer floating up
      duration: ctx.rand(0.75, 1.15),
      ease: 'sine.inOut',
    }, 0);
    // Second wander leg, then gutter out mid-motion — never a dead stop.
    tl.to(fly, {
      x: `+=${ctx.rand(-drift, drift)}`,
      y: `-=${ctx.rand(drift * 0.2, drift * 0.9)}`,
      duration: ctx.rand(0.75, 1.15),
      ease: 'sine.inOut',
    });
    tl.to(fly, { alpha: 0, duration: ctx.rand(0.4, 0.6), ease: 'power2.in' }, '-=0.55');
    tl.to(fly.scale, { x: 0.8, y: 0.8, duration: 0.5, ease: 'power2.in' }, '-=0.5');

    // Non-rhythmic lantern flicker: the hot pinprick stutters on its own clock.
    const ftl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0.1, 0.55) }));
    for (let k = 0; k < 3; k++) {
      ftl.to(hot, { alpha: ctx.rand(0.3, 0.55), duration: ctx.rand(0.13, 0.28), ease: 'sine.inOut' });
      ftl.to(hot, { alpha: ctx.rand(0.65, 0.9), duration: ctx.rand(0.17, 0.34), ease: 'sine.inOut' });
    }
    // Body breathes at yet another rate — halo stays still (calm base layer).
    ctx.track(ctx.gsap.to(body.scale, {
      x: body.scale.x * ctx.rand(1.18, 1.4),
      y: body.scale.y * ctx.rand(1.18, 1.4),
      duration: ctx.rand(0.24, 0.44),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: ctx.rand(0, 1) < 0.5 ? 3 : 5,
    }));
  }
}

// ---------------------------------------------------------------------------
// 2) ambient-aurora — slow additive color band waving over the top rows
// ---------------------------------------------------------------------------

function runAurora(ctx: FxContext): void {
  const g = ctx.gridRect();
  // Three curtains: accent body, gold under-wash, thin white sheen on top —
  // each a whisper (wide additive washes stay well under 0.15 alpha).
  const specs = [
    { tint: ctx.accent, yF: 0.10, hF: 0.26, alpha: 0.13, phase: 0.00 },
    { tint: ctx.gold,   yF: 0.20, hF: 0.22, alpha: 0.09, phase: 0.22 },
    { tint: 0xffffff,   yF: 0.06, hF: 0.13, alpha: 0.06, phase: 0.38 },
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
    band.skew.x = -ctx.rand(0.07, 0.12);
    ctx.layer.addChild(band);

    const peak = s.alpha * ctx.rand(0.85, 1.15);
    const tl = ctx.track(ctx.gsap.timeline({ delay: s.phase + ctx.rand(0, 0.08) }));
    tl.to(band, { alpha: peak, duration: ctx.rand(0.5, 0.7), ease: 'power2.out' }, 0);
    // Mid-life shimmer: one asymmetric dip so the curtain never feels looped.
    tl.to(band, { alpha: peak * ctx.rand(0.55, 0.75), duration: ctx.rand(0.35, 0.5), ease: 'sine.inOut' }, ctx.rand(0.8, 1.0));
    tl.to(band, { alpha: peak, duration: ctx.rand(0.25, 0.4), ease: 'sine.inOut' });
    // Exit: fade on a power curve while still drifting upward — no dead stop.
    tl.to(band, { alpha: 0, duration: ctx.rand(0.6, 0.8), ease: 'power2.in' }, 1.75);
    tl.to(band, { y: band.y - g.h * 0.02, duration: 0.8, ease: 'sine.out' }, 1.75);

    // The wave: skew sways while the curtain bobs and slides sideways —
    // every rate randomized so the three curtains never sync up.
    ctx.track(ctx.gsap.to(band.skew, {
      x: ctx.rand(0.07, 0.12),
      duration: ctx.rand(0.65, 1.0),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 3,
      delay: s.phase,
    }));
    ctx.track(ctx.gsap.to(band, {
      y: `+=${g.h * ctx.rand(0.02, 0.04)}`,
      x: `+=${g.w * ctx.rand(-0.04, 0.04)}`,
      duration: ctx.rand(0.95, 1.35),
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

  const radius = Math.min(g.w, g.h) * 0.04;

  // Whisper-quiet luminance lift over the whole board.
  const lift = new Graphics();
  lift.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, radius)
    .fill({ color: ctx.accent, alpha: 1 });
  lift.blendMode = 'add';
  lift.alpha = 0;

  // Subtle top sheen — a soft white band hugging the upper edge.
  const sheen = new Sprite(bandTexture());
  sheen.anchor.set(0.5);
  sheen.tint = 0xffffff;
  sheen.blendMode = 'add';
  sheen.width = g.w * 0.96;
  sheen.height = g.h * 0.14;
  sheen.position.set(0, -g.h / 2 + sheen.height * 0.4);
  sheen.alpha = 0;

  // A faint frame that inhales slightly out of phase.
  const frame = new Graphics();
  frame.roundRect(-g.w / 2 + 3, -g.h / 2 + 3, g.w - 6, g.h - 6, radius)
    .stroke({ color: 0xffffff, width: 2, alpha: 1 });
  frame.blendMode = 'add';
  frame.alpha = 0;

  holder.addChild(lift, sheen, frame);

  // Two slow breaths with organically uneven lengths — never metronomic.
  const tl = ctx.track(ctx.gsap.timeline());
  tl.to(lift, { alpha: 0.05, duration: ctx.rand(0.5, 0.62), ease: 'sine.inOut' }, 0);
  tl.to(lift, { alpha: 0.014, duration: ctx.rand(0.6, 0.75), ease: 'sine.inOut' });
  tl.to(lift, { alpha: 0.055, duration: ctx.rand(0.48, 0.6), ease: 'sine.inOut' });
  tl.to(lift, { alpha: 0, duration: 0.7, ease: 'power2.in' });

  // Scale breathe rides its own uneven rhythm, a hair over unity.
  const stl = ctx.track(ctx.gsap.timeline());
  stl.to(holder.scale, { x: 1.011, y: 1.011, duration: 0.58, ease: 'sine.inOut' });
  stl.to(holder.scale, { x: 1.004, y: 1.004, duration: 0.72, ease: 'sine.inOut' });
  stl.to(holder.scale, { x: 1.013, y: 1.013, duration: 0.55, ease: 'sine.inOut' });
  stl.to(holder.scale, { x: 1, y: 1, duration: 0.68, ease: 'power2.inOut' });

  const shtl = ctx.track(ctx.gsap.timeline({ delay: 0.1 }));
  shtl.to(sheen, { alpha: 0.045, duration: 0.6, ease: 'sine.inOut' }, 0);
  shtl.to(sheen, { alpha: 0.015, duration: 0.7, ease: 'sine.inOut' });
  shtl.to(sheen, { alpha: 0.04, duration: 0.55, ease: 'sine.inOut' });
  shtl.to(sheen, { alpha: 0, duration: 0.6, ease: 'power2.in' });

  const ftl = ctx.track(ctx.gsap.timeline({ delay: 0.22 }));
  ftl.to(frame, { alpha: 0.11, duration: ctx.rand(0.44, 0.56), ease: 'sine.inOut' }, 0);
  ftl.to(frame, { alpha: 0.03, duration: ctx.rand(0.5, 0.64), ease: 'sine.inOut' });
  ftl.to(frame, { alpha: 0.1, duration: ctx.rand(0.42, 0.54), ease: 'sine.inOut' });
  ftl.to(frame, { alpha: 0, duration: 0.62, ease: 'power2.in' });
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

    // Layered light: wide whisper halo → mid core → hot star (white center
    // baked into drawStar). Halos breathe on BEFORE the star pops.
    const haloWide = glowLayer(color, r * 4.6, 0);
    const haloMid = glowLayer(color, r * 2.3, 0);
    const star = new Graphics();
    drawStar(star, r, color, 0.95);
    star.blendMode = 'add';
    star.scale.set(0);

    glint.addChild(haloWide, haloMid, star);
    ctx.layer.addChild(glint);

    const delay = i * 0.115 + ctx.rand(0, 0.14); // jittered stagger, no beat grid
    const popScale = ctx.rand(0.9, 1.15);
    const tl = ctx.track(ctx.gsap.timeline({ delay }));
    // Anticipation: the halo inhales first — a soft 0.1s pre-bloom.
    tl.to(haloWide, { alpha: 0.12, duration: 0.1, ease: 'power2.out' }, 0);
    tl.to(haloMid, { alpha: 0.34, duration: 0.12, ease: 'power2.out' }, 0.03);
    // Then the star snaps in with weight and a back-settle overshoot.
    tl.to(star.scale, { x: popScale, y: popScale, duration: ctx.rand(0.22, 0.28), ease: 'back.out(2.2)' }, 0.1);
    tl.to(glint, { rotation: glint.rotation + ctx.rand(0.4, 0.9), duration: 0.9, ease: 'power1.out' }, 0.1);
    // Brief hold at full, then the exit: shrink on power3.in while the fade
    // and rotation continue — it leaves, it doesn't pop off.
    tl.to(star.scale, { x: popScale * 0.15, y: popScale * 0.15, duration: 0.36, ease: 'power3.in' }, 0.46);
    tl.to(haloMid, { alpha: 0, duration: 0.3, ease: 'power2.in' }, 0.46);
    tl.to(haloWide, { alpha: 0, duration: 0.38, ease: 'power2.in' }, 0.5);
    tl.to(glint, {
      alpha: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => { if (glint.parent) glint.parent.removeChild(glint); glint.destroy({ children: true }); },
    }, 0.54);
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

  const count = 7; // odd — no mirrored pairs
  for (let i = 0; i < count; i++) {
    const band = new Sprite(bandTexture());
    band.anchor.set(0.5);
    band.tint = i % 3 === 0 ? ctx.accent : 0xffffff;
    band.blendMode = 'add';
    band.width = g.w * ctx.rand(0.55, 0.92);
    band.height = g.h * ctx.rand(0.045, 0.09);
    const x0 = g.x + g.w / 2 + ctx.rand(-g.w * 0.14, g.w * 0.14);
    const y0 = g.y + g.h * ctx.rand(0.8, 1.0);
    band.position.set(x0, y0);
    band.alpha = 0;
    holder.addChild(band);

    // Progressive falloff: later bands run dimmer — the haze thins out.
    const late = 1 - (i / count) * 0.4;
    const delay = ctx.rand(0, 0.55);
    const rise = ctx.rand(1.4, 2.05);
    const tl = ctx.track(ctx.gsap.timeline({ delay }));
    tl.to(band, { alpha: ctx.rand(0.05, 0.11) * late, duration: ctx.rand(0.35, 0.5), ease: 'power2.out' }, 0);
    tl.to(band, { y: g.y + g.h * ctx.rand(0.02, 0.15), duration: rise, ease: 'power1.out' }, 0);
    tl.to(band, { width: band.width * ctx.rand(1.15, 1.35), duration: rise, ease: 'sine.out' }, 0);
    // Fade out on a power curve while still rising — heat never stalls.
    tl.to(band, { alpha: 0, duration: ctx.rand(0.5, 0.65), ease: 'power2.in' }, rise - 0.55);
    // Sideways heat wobble — direction, rate and repeat all per-band random.
    ctx.track(ctx.gsap.to(band, {
      x: x0 + g.w * ctx.rand(0.025, 0.06) * (ctx.rand(0, 1) < 0.5 ? 1 : -1),
      duration: ctx.rand(0.26, 0.52),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: ctx.rand(0, 1) < 0.5 ? 5 : 7,
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

  // Three-layer tube: wide soft spill → mid glow → hot white filament.
  const spill = new Graphics();
  spill.roundRect(g.x + 4, g.y + 4, g.w - 8, g.h - 8, radius)
    .stroke({ color: ctx.accent, width: 22, alpha: 0.16 });
  spill.blendMode = 'add';
  spill.filters = [new BlurFilter({ strength: 12, quality: 3 })];

  const glow = new Graphics();
  glow.roundRect(g.x + 4, g.y + 4, g.w - 8, g.h - 8, radius)
    .stroke({ color: ctx.accent, width: 10, alpha: 0.42 });
  glow.blendMode = 'add';
  glow.filters = [new BlurFilter({ strength: 6, quality: 3 })];

  const core = new Graphics();
  core.roundRect(g.x + 4, g.y + 4, g.w - 8, g.h - 8, radius)
    .stroke({ color: 0xffffff, width: 2.5, alpha: 0.88 });
  core.blendMode = 'add';

  rim.addChild(spill, glow, core);
  rim.alpha = 0;

  // Neon boot: a dim power-surge inhale, stuttering flicker, lock on,
  // uneven hum, then a dip-blip power-down.
  const tl = ctx.track(ctx.gsap.timeline());
  // Anticipation: the tube warms faintly before the first strike.
  tl.to(rim, { alpha: 0.07, duration: 0.12, ease: 'power2.out' }, 0);
  tl.to(rim, { alpha: 0.02, duration: 0.08, ease: 'power2.in' });
  const levels = [0.85, ctx.rand(0.08, 0.2), 1, ctx.rand(0.15, 0.35), 0.9, 0.3, 1];
  let at = 0.22;
  for (const lvl of levels) {
    const d = ctx.rand(0.04, 0.09);
    tl.to(rim, { alpha: lvl, duration: d, ease: 'none' }, at);
    at += d + ctx.rand(0.01, 0.05);
  }
  // Lock on, then hum with uneven breaths — a real ballast never keeps time.
  tl.to(rim, { alpha: 0.93, duration: ctx.rand(0.22, 0.3), ease: 'sine.inOut' }, at + 0.08);
  tl.to(rim, { alpha: 1, duration: ctx.rand(0.3, 0.42), ease: 'sine.inOut' });
  tl.to(rim, { alpha: 0.96, duration: ctx.rand(0.2, 0.28), ease: 'sine.inOut' });
  // Power-down: a hard dip, one dying blip, then the fade to black.
  tl.to(rim, { alpha: 0.3, duration: 0.07, ease: 'power2.in' }, 1.7);
  tl.to(rim, { alpha: 0.52, duration: 0.06, ease: 'power1.out' });
  tl.to(rim, { alpha: 0, duration: 0.5, ease: 'power2.in' });

  // Two glints sliding in at the moment the sign locks on — halo pre-bloom,
  // weighted pop, then shrink-and-spin off.
  const spots = [
    { x: g.x + g.w * ctx.rand(0.1, 0.4), y: g.y + 4 },
    { x: g.x + g.w * ctx.rand(0.6, 0.9), y: g.y + g.h - 4 },
  ];
  for (const p of spots) {
    const gl = new Container();
    gl.position.set(p.x, p.y);
    const halo = glowLayer(0xffffff, Math.min(g.w, g.h) * 0.16, 0);
    const star = new Graphics();
    drawStar(star, Math.min(g.w, g.h) * 0.045, 0xffffff, 0.9);
    star.blendMode = 'add';
    star.scale.set(0);
    gl.addChild(halo, star);
    ctx.layer.addChild(gl);

    const pop = ctx.rand(0.9, 1.1);
    const stl = ctx.track(ctx.gsap.timeline({ delay: at + ctx.rand(0.05, 0.28) }));
    stl.to(halo, { alpha: 0.14, duration: 0.09, ease: 'power2.out' }, 0);
    stl.to(star.scale, { x: pop, y: pop, duration: 0.2, ease: 'back.out(2.6)' }, 0.08);
    stl.to(star, { rotation: ctx.rand(0.5, 0.9), duration: 0.62, ease: 'power1.out' }, 0.08);
    stl.to(star.scale, { x: 0.12, y: 0.12, duration: 0.28, ease: 'power3.in' }, 0.34);
    stl.to(gl, { alpha: 0, duration: 0.26, ease: 'power2.in' }, 0.38);
  }
}

// ---------------------------------------------------------------------------
// 7) ambient-drifting-light — a soft light blob wanders across the board
// ---------------------------------------------------------------------------

function runDriftingLight(ctx: FxContext): void {
  const g = ctx.gridRect();
  const blob = new Container();

  // Three-layer liquid light: gold wash → accent body → dim white heart.
  const halo = glowLayer(ctx.gold, g.h * 1.1, 0.3);
  const core = glowLayer(ctx.accent, g.h * 0.6, 0.45);
  const heart = glowLayer(0xffffff, g.h * 0.2, 0.3);
  blob.addChild(halo, core, heart);

  const startLeft = ctx.rand(0, 1) < 0.5;
  const dir = startLeft ? 1 : -1;
  const x0 = startLeft ? g.x + g.w * 0.12 : g.x + g.w * 0.88;
  const x2 = startLeft ? g.x + g.w * 0.86 : g.x + g.w * 0.14;
  const y0 = g.y + g.h * ctx.rand(0.25, 0.7);
  blob.position.set(x0, y0);
  blob.alpha = 0;
  ctx.layer.addChild(blob);

  const tl = ctx.track(ctx.gsap.timeline());
  tl.to(blob, { alpha: ctx.rand(0.4, 0.5), duration: 0.4, ease: 'power2.out' }, 0);
  // Wander: two smooth legs with a vertical detour in the middle, each leg
  // its own length so the path never feels keyframed.
  tl.to(blob, {
    x: (x0 + x2) / 2 + g.w * ctx.rand(-0.06, 0.06),
    y: g.y + g.h * ctx.rand(0.15, 0.85),
    duration: ctx.rand(0.75, 0.95),
    ease: 'sine.inOut',
  }, 0.05);
  tl.to(blob, {
    x: x2,
    y: g.y + g.h * ctx.rand(0.3, 0.65),
    duration: ctx.rand(0.75, 0.95),
    ease: 'sine.inOut',
  });
  // Exit: fade on power2.in while the drift continues past the last mark.
  tl.to(blob, { alpha: 0, duration: 0.55, ease: 'power2.in' }, '-=0.5');
  tl.to(blob, { x: `+=${dir * g.w * 0.05}`, duration: 0.55, ease: 'sine.out' }, '-=0.55');

  // The core lags behind the halo and the heart flickers on its own clock —
  // three layers, three tempos: liquid light.
  ctx.track(ctx.gsap.to(core.scale, {
    x: core.scale.x * ctx.rand(1.12, 1.24),
    y: core.scale.y * ctx.rand(1.12, 1.24),
    duration: ctx.rand(0.4, 0.55),
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 3,
  }));
  ctx.track(ctx.gsap.to(core.position, {
    x: -dir * g.w * 0.03,
    duration: ctx.rand(0.75, 0.95),
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 1,
  }));
  const htl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0.1, 0.3) }));
  htl.to(heart, { alpha: 0.18, duration: ctx.rand(0.28, 0.4), ease: 'sine.inOut' });
  htl.to(heart, { alpha: 0.32, duration: ctx.rand(0.34, 0.5), ease: 'sine.inOut' });
  htl.to(heart, { alpha: 0.22, duration: ctx.rand(0.26, 0.38), ease: 'sine.inOut' });
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
      const star = new Container();
      if (withCross) {
        // Near stars get the full stack: soft halo behind a sparkle cross.
        star.addChild(glowLayer(color, r * 7, 0.15));
        const cross = new Graphics();
        drawStar(cross, r * 2.2, color, 0.9);
        cross.blendMode = 'add';
        star.addChild(cross);
      } else {
        const dot = new Graphics();
        dot.circle(0, 0, r).fill({ color, alpha: 0.9 });
        dot.blendMode = 'add';
        star.addChild(dot);
      }
      star.position.set(
        g.x + ctx.rand(g.w * 0.03, g.w * 0.97),
        g.y + ctx.rand(g.h * 0.04, g.h * 0.96),
      );
      star.alpha = ctx.rand(0.15, alphaMax);
      layer.addChild(star);
      // Non-rhythmic twinkle: three uneven dips per star, never a metronome.
      const ttl = ctx.track(ctx.gsap.timeline({ delay: ctx.rand(0, 0.5) }));
      for (let k = 0; k < 3; k++) {
        ttl.to(star, { alpha: ctx.rand(0.05, 0.22), duration: ctx.rand(0.18, 0.5), ease: 'sine.inOut' });
        ttl.to(star, { alpha: ctx.rand(0.3, alphaMax), duration: ctx.rand(0.2, 0.55), ease: 'sine.inOut' });
      }
    }

    // Parallax: the whole layer slides — near layer faster than far layer —
    // with a whisper of vertical drift so the motion isn't a pure pan.
    ctx.track(ctx.gsap.to(layer, {
      x: dir * g.w * driftF * ctx.rand(0.85, 1.15),
      y: -g.h * driftF * 0.2,
      duration: 2.4,
      ease: 'sine.inOut',
    }));
    const tl = ctx.track(ctx.gsap.timeline());
    tl.to(layer, { alpha: 1, duration: ctx.rand(0.35, 0.5), ease: 'power2.out' }, 0);
    tl.to(layer, { alpha: 0, duration: ctx.rand(0.5, 0.65), ease: 'power2.in' }, 1.85);
  };

  makeLayer(15, 1.4, 2.4, 0.015, 0.55, false); // far: small, slow, dim
  makeLayer(9, 2.4, 4.0, 0.045, 0.85, false);  // mid: bigger, faster
  makeLayer(5, 3.0, 4.5, 0.07, 1.0, true);     // near: sparkle crosses, fastest
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
