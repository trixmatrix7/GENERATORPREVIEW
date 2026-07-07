// WinCelebration — an AAA+, stake.com-level win celebration. Self-contained:
// owns ONE full-viewport overlay on app.stage (screen/CSS-pixel coords, like the
// iris), and renders its own dim + vignette + tier wordmark + rolling amount +
// a single-ticker baked-Sprite coin fountain + burst rings. Three CLEAN tiers
// (NICE ONE! / INSANE! / FABULOUS WIN!) escalate by INTENSITY (dim, coins,
// count duration, punch), not by new gimmicks — premium restraint over noise.
//
// Purely visual. play(params) returns a Promise that resolves EXACTLY ONCE on
// every path (normal / reduced-motion / cancel), so an awaiting spin never
// hangs. cancel()/dispose() tear everything down (ticker cb removed, overlay
// destroyed, cached coin texture freed).

import { Application, Container, Graphics, Sprite, Text, TextStyle, Texture, Ticker } from 'pixi.js';
import { gsap } from 'gsap';

/** Everything tunable about the celebration — edit intensities/words/timing here. */
export const WIN_CELEBRATION_CONFIG = {
  /** Visual-tier bands by win/wager multiplier: <t2 = tier0, <t3 = tier1, else tier2. */
  bands: { t2: 15, t3: 75 },
  words: ['NICE ONE!', 'INSANE!', 'FABULOUS WIN!'],
  dimAlpha: [0.55, 0.66, 0.74],
  vignetteAlpha: [0.5, 0.62, 0.74],
  countDur: [1.0, 1.6, 2.2],
  holdDur: [0.4, 0.7, 1.0],
  amountFontSize: [38, 52, 64],
  wordFontSize: [34, 44, 56],
  endPunch: [1.06, 1.1, 1.14],
  coinCount: [40, 90, 160],
  coinWaves: [2, 3, 4],
  coinPower: [520, 640, 760],
  burstRings: [1, 1, 2],
  rayGlow: [false, true, true],
  gravity: 900,
  airDrag: 0.995,
  coinSpread: 1.4,
  particleCap: 300,
  /** Design reference height; sizes/physics scale by min(sw,sh)/this. */
  designBase: 720,
};

export interface WinCelebrationParams {
  winAmount: bigint;
  wager: bigint;
  symbol: string;
  decimals: number;
  /** 0 | 1 | 2 — precomputed visual tier. */
  tier: number;
  /** Screen-space centre for the number/wordmark. */
  centre: { x: number; y: number };
  /** Screen-space coin origins (real winning cells); empty → burst from centre. */
  origins: Array<{ x: number; y: number }>;
  reduced: boolean;
}

interface Coin {
  sp: Sprite; x: number; y: number; vx: number; vy: number;
  age: number; life: number; spin: number; ph: number; base: number;
}

function blendHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Exact, bigint-safe amount → "12.34" (2dp for hi-decimal tokens). */
function formatAmount(amount: bigint, decimals: number): string {
  const dp = decimals > 4 ? 2 : decimals;
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  if (dp === 0) return whole.toString();
  const scale = 10n ** BigInt(decimals - dp);
  const frac = (amount % divisor + scale / 2n) / scale;
  return `${whole}.${frac.toString().padStart(dp, '0')}`;
}

export class WinCelebration {
  private readonly app: Application;
  private readonly accent: number;
  private readonly coinColors: number[];
  private readonly font: string;

  private overlay: Container | null = null;
  private tl: gsap.core.Timeline | null = null;
  private tickCb: ((t: Ticker) => void) | null = null;
  private coins: Coin[] = [];
  private coinTex: Texture | null = null;
  private vignetteTex: Texture | null = null;
  private resolveActive: (() => void) | null = null;

  constructor(app: Application, opts: { accent: number; coinColors: number[]; fontFamily?: string }) {
    this.app = app;
    this.accent = opts.accent;
    this.coinColors = opts.coinColors.length ? opts.coinColors : [0xffd23f, 0xffc107, 0xffe082];
    this.font = opts.fontFamily ?? "'Poppins', ui-sans-serif, sans-serif";
  }

  /** Play the celebration. Resolves exactly once when it finishes (or is cancelled). */
  play(p: WinCelebrationParams): Promise<void> {
    this.cancel(); // settle any prior run first

    const sw = this.app.screen.width, sh = this.app.screen.height;
    const s = Math.max(0.6, Math.min(2, Math.min(sw, sh) / WIN_CELEBRATION_CONFIG.designBase));
    const tier = Math.max(0, Math.min(2, p.tier));
    const C = WIN_CELEBRATION_CONFIG;

    const overlay = new Container();
    overlay.zIndex = 10000;
    overlay.eventMode = 'none';
    this.overlay = overlay;
    this.app.stage.addChild(overlay); // last => on top (repo doesn't sort stage)

    // ── Dim + vignette ────────────────────────────────────────────────────
    const dim = new Graphics();
    dim.rect(0, 0, sw, sh).fill({ color: 0x05060a, alpha: 1 });
    dim.alpha = 0;
    overlay.addChild(dim);

    const vignette = new Sprite(this.getVignetteTex());
    vignette.anchor.set(0.5);
    vignette.position.set(sw / 2, sh / 2);
    vignette.width = sw * 1.5; vignette.height = sh * 1.5;
    vignette.alpha = 0;
    overlay.addChild(vignette);

    // ── Accent ray-glow behind the text (tier1+) ──────────────────────────
    let rayGlow: Graphics | null = null;
    if (C.rayGlow[tier]) {
      rayGlow = new Graphics();
      const R = Math.max(sw, sh) * 0.7, n = 18;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / n) * 0.5;
        rayGlow.moveTo(0, 0);
        rayGlow.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
        rayGlow.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
        rayGlow.closePath();
      }
      rayGlow.fill({ color: this.accent, alpha: 1 });
      rayGlow.position.set(p.centre.x, p.centre.y);
      rayGlow.alpha = 0;
      rayGlow.blendMode = 'add';
      overlay.addChild(rayGlow);
    }

    // Layers above the glow: rings, coins, then text (text on top = readable).
    const ringLayer = new Container(); overlay.addChild(ringLayer);
    const coinLayer = new Container(); overlay.addChild(coinLayer);

    // ── Tier wordmark + rolling amount ────────────────────────────────────
    const wordSize = Math.round(C.wordFontSize[tier] * s);
    const amtSize = Math.round(C.amountFontSize[tier] * s);
    const word = new Text({
      text: C.words[tier],
      style: new TextStyle({
        fontFamily: this.font, fontSize: wordSize, fontWeight: '800', letterSpacing: 3,
        fill: 0xfff4d8, stroke: { color: 0x1a1205, width: Math.max(2, 3 * s) },
        dropShadow: { color: 0x000000, blur: 6, distance: 3, alpha: 0.55 },
      }),
    });
    word.anchor.set(0.5);
    word.position.set(p.centre.x, p.centre.y - amtSize * 0.95);
    word.alpha = 0; word.scale.set(1.35);
    overlay.addChild(word);

    const amount = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: this.font, fontSize: amtSize, fontWeight: '800', fontStyle: 'italic', letterSpacing: 1,
        fill: 0xffd24a, stroke: { color: 0x3a1500, width: Math.max(3, 4 * s) },
        dropShadow: { color: 0x000000, blur: 5, distance: 2, alpha: 0.5 },
      }),
    });
    amount.anchor.set(0.5);
    amount.position.set(p.centre.x, p.centre.y);
    amount.alpha = 0; amount.scale.set(0.7);
    overlay.addChild(amount);

    // White flash (impact / end-punch), sized to the screen.
    const flash = new Graphics();
    flash.rect(0, 0, sw, sh).fill({ color: 0xffffff, alpha: 1 });
    flash.alpha = 0; flash.blendMode = 'add';
    overlay.addChild(flash);

    // ── Coin fountain: ONE baked texture + ONE ticker integrator ──────────
    const coinTex = this.getCoinTex();
    const origins = p.origins.length ? p.origins : [{ x: p.centre.x, y: p.centre.y + amtSize }];
    const emit = (count: number, power: number, scaleMul: number) => {
      for (let i = 0; i < count; i++) {
        if (this.coins.length >= C.particleCap) break;
        const o = origins[i % origins.length];
        const angle = -Math.PI / 2 + ((i / count) - 0.5) * C.coinSpread + (Math.random() - 0.5) * 0.2;
        const sp0 = power * s * (0.7 + Math.random() * 0.6);
        const seedA = Math.random() * Math.PI * 2, seedR = 16 * s;
        const sprite = new Sprite(coinTex);
        sprite.anchor.set(0.5);
        sprite.tint = this.coinColors[i % this.coinColors.length];
        const base = s * (0.85 + Math.random() * 0.5) * scaleMul;
        sprite.scale.set(base);
        const x = o.x + Math.cos(seedA) * seedR, y = o.y + Math.sin(seedA) * seedR;
        sprite.position.set(x, y);
        coinLayer.addChild(sprite);
        this.coins.push({
          sp: sprite, x, y, vx: Math.cos(angle) * sp0, vy: Math.sin(angle) * sp0,
          age: 0, life: 0.9 + Math.random() * 0.6, spin: 9 + Math.random() * 6,
          ph: Math.random() * Math.PI * 2, base,
        });
      }
    };
    const grav = C.gravity * s;
    const tick = (t: Ticker) => {
      if (!this.overlay) return;
      const dt = Math.min(0.05, t.deltaMS / 1000);
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        c.vy += grav * dt; c.vx *= C.airDrag;
        c.x += c.vx * dt; c.y += c.vy * dt; c.age += dt;
        c.sp.position.set(c.x, c.y);
        c.sp.scale.x = Math.abs(Math.cos(c.age * c.spin + c.ph)) * c.base; // edge-flip spin
        c.sp.rotation += dt * 1.2;
        const left = c.life - c.age;
        if (left < c.life * 0.35) c.sp.alpha = Math.max(0, left / (c.life * 0.35));
        if (c.age >= c.life) { c.sp.destroy(); this.coins.splice(i, 1); }
      }
    };
    this.tickCb = tick;
    this.app.ticker.add(tick);

    const ring = (delay: number) => {
      const g = new Graphics();
      g.circle(0, 0, 1).stroke({ color: blendHex(0xffffff, this.accent, 0.5), width: 3 * s, alpha: 1 });
      g.position.set(p.centre.x, p.centre.y);
      g.alpha = 0;
      ringLayer.addChild(g);
      const maxR = Math.max(sw, sh) * 0.42;
      this.tl?.to(g, { alpha: 1, duration: 0.06 }, delay);
      this.tl?.to(g.scale, { x: maxR, y: maxR, duration: 0.5, ease: 'power2.out' }, delay);
      this.tl?.to(g, { alpha: 0, duration: 0.44, ease: 'power2.in' }, delay + 0.06);
    };

    // ── Reduced motion: static, no particles/rays/shake, resolve once ─────
    if (p.reduced) {
      return new Promise<void>((resolve) => {
        this.resolveActive = resolve;
        dim.alpha = 0.4; vignette.alpha = C.vignetteAlpha[tier];
        word.alpha = 1; word.scale.set(1);
        amount.text = `${formatAmount(p.winAmount, p.decimals)} ${p.symbol}`;
        amount.alpha = 1; amount.scale.set(1);
        const tl = gsap.timeline({ onComplete: () => this.finish() });
        this.tl = tl;
        tl.to({}, { duration: 1.0 }); // hold
        tl.to([dim, vignette, word, amount], { alpha: 0, duration: 0.3, ease: 'power1.in' });
      });
    }

    // ── The full celebration timeline ─────────────────────────────────────
    return new Promise<void>((resolve) => {
      this.resolveActive = resolve;
      const tl = gsap.timeline({ onComplete: () => this.finish() });
      this.tl = tl;

      // DIM + VIGNETTE
      tl.to(dim, { alpha: C.dimAlpha[tier], duration: 0.3, ease: 'sine.out' }, 0);
      tl.to(vignette, { alpha: C.vignetteAlpha[tier], duration: 0.32, ease: 'sine.out' }, 0);
      if (rayGlow) {
        tl.to(rayGlow, { alpha: tier === 2 ? 0.12 : 0.09, duration: 0.5, ease: 'sine.out' }, 0.05);
        tl.to(rayGlow, { rotation: '+=6.283', duration: 16, ease: 'none', repeat: -1 }, 0.05);
      }

      // IMPACT: first ring(s) + biggest coin wave (+ tier2 white flash)
      ring(0.02);
      if (C.burstRings[tier] > 1) ring(0.14);
      const waves = C.coinWaves[tier], total = C.coinCount[tier], power = C.coinPower[tier];
      tl.call(() => emit(Math.round(total * 0.5), power, 1.1), undefined, 0.02); // biggest wave
      for (let w = 1; w < waves; w++) {
        const t = 0.12 + w * (C.countDur[tier] / waves);
        tl.call(() => emit(Math.round((total * 0.5) / (waves - 1)), power * 0.9, 1 - w * 0.08), undefined, t);
      }
      if (tier === 2) tl.to(flash, { alpha: 0.5, duration: 0.05 }, 0.02).to(flash, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.07);

      // WORDMARK snaps in and holds
      tl.to(word, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0.05);
      tl.to(word.scale, { x: 1, y: 1, duration: 0.42, ease: 'back.out(2.4)' }, 0.05);

      // AMOUNT reveal (anticipation dip → settle) + count-up
      amount.text = `0.00 ${p.symbol}`;
      tl.to(amount, { alpha: 1, duration: 0.15, ease: 'power2.out' }, 0.1);
      tl.to(amount.scale, { x: 0.94, y: 0.94, duration: 0.05 }, 0.1)
        .to(amount.scale, { x: 1, y: 1, duration: 0.34, ease: 'back.out(2.6)' }, 0.15);
      const finalVal = Number(p.winAmount) / Math.pow(10, p.decimals);
      const dp = p.decimals > 4 ? 2 : p.decimals;
      const counter = { val: 0 };
      tl.to(counter, {
        val: finalVal, duration: C.countDur[tier], ease: 'power2.out',
        onUpdate: () => { if (this.overlay) amount.text = `${counter.val.toFixed(dp)} ${p.symbol}`; },
        onComplete: () => { if (this.overlay) amount.text = `${formatAmount(p.winAmount, p.decimals)} ${p.symbol}`; },
      }, 0.15);

      // END PUNCH at count-complete: pre-squash → punch → elastic settle, flash,
      // accent tint pulse, per-tier shake.
      const at = 0.15 + C.countDur[tier];
      tl.to(amount.scale, { x: 0.94, y: 0.94, duration: 0.05 }, at)
        .to(amount.scale, { x: C.endPunch[tier], y: C.endPunch[tier], duration: 0.1, ease: 'power2.out' }, at + 0.05)
        .to(amount.scale, { x: 1, y: 1, duration: 0.35, ease: 'elastic.out(1,0.5)' }, at + 0.15);
      tl.to(flash, { alpha: 0.6, duration: 0.05 }, at + 0.05).to(flash, { alpha: 0, duration: 0.4, ease: 'power2.in' }, at + 0.1);
      const pulse = { p: 0 };
      tl.to(pulse, {
        p: 1, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1,
        onUpdate: () => { if (this.overlay) amount.tint = blendHex(0xffffff, this.accent, 0.4 * pulse.p); },
      }, at + 0.05);
      if (tier === 2) tl.to(overlay, { x: '+=8', duration: 0.05, repeat: 9, yoyo: true, ease: 'none' }, at + 0.05);
      else if (tier === 1) tl.to(amount, { x: `+=${6 * s}`, duration: 0.05, repeat: 7, yoyo: true, ease: 'none' }, at + 0.05);

      // HOLD (settle-breathe) then EXIT
      const holdAt = at + 0.2;
      tl.to(amount.scale, { x: 1.015, y: 1.015, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, holdAt);
      const exitAt = at + 0.2 + C.holdDur[tier];
      tl.to(word, { alpha: 0, duration: 0.3, ease: 'power1.in' }, exitAt);
      tl.to(amount, { alpha: 0, duration: 0.3, ease: 'power1.in' }, exitAt + 0.04);
      tl.to([dim, vignette], { alpha: 0, duration: 0.4, ease: 'power1.in' }, exitAt + 0.05);
      if (rayGlow) tl.to(rayGlow, { alpha: 0, duration: 0.4, ease: 'power1.in' }, exitAt + 0.05);
    });
  }

  /** Settle + tear down the current run (safe to call any time). */
  cancel(): void {
    this.finish();
  }

  /** Free the cached textures — call on PixiApp teardown. */
  dispose(): void {
    this.finish();
    this.coinTex?.destroy(true); this.coinTex = null;
    this.vignetteTex?.destroy(true); this.vignetteTex = null;
  }

  // ── internals ──
  private finish(): void {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    if (this.tickCb) { this.app.ticker.remove(this.tickCb); this.tickCb = null; }
    for (const c of this.coins) { try { c.sp.destroy(); } catch { /* torn down */ } }
    this.coins.length = 0;
    if (this.overlay) {
      try { this.overlay.destroy({ children: true }); } catch { /* torn down */ }
      this.overlay = null;
    }
    const r = this.resolveActive;
    this.resolveActive = null;
    if (r) r();
  }

  private getCoinTex(): Texture {
    if (this.coinTex) return this.coinTex;
    const g = new Graphics();
    g.ellipse(0, 0, 9, 9).fill({ color: 0xffffff });        // white base → tinted per coin
    g.ellipse(-2, -3, 4, 5).fill({ color: 0xffffff, alpha: 0.55 });
    g.ellipse(0, 0, 9, 9).stroke({ color: 0x000000, width: 1, alpha: 0.25 });
    this.coinTex = this.app.renderer.generateTexture(g);
    g.destroy();
    return this.coinTex;
  }

  private getVignetteTex(): Texture {
    if (this.vignetteTex) return this.vignetteTex;
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    const grd = ctx.createRadialGradient(S / 2, S / 2, S * 0.26, S / 2, S / 2, S * 0.5);
    grd.addColorStop(0, 'rgba(5,6,10,0)');
    grd.addColorStop(1, 'rgba(5,6,10,1)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, S, S);
    this.vignetteTex = Texture.from(cv);
    return this.vignetteTex;
  }
}
