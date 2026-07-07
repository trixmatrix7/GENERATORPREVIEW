// WinCelebration — a clean, BOUNCY win celebration: just the tier text + a
// count-up amount + a premium coin explosion. NO dim / vignette / ray-glow /
// burst rings / flash — text and coins carry it. Three tiers (NICE ONE! /
// INSANE! / FABULOUS WIN!) escalate by coin count + duration + punch.
//
// Self-contained: owns ONE full-viewport overlay on app.stage (screen coords).
// play(params) resolves EXACTLY ONCE on every path (normal / reduced / cancel)
// so an awaiting spin never hangs. cancel()/dispose() tear everything down.

import { Application, Container, Sprite, Text, TextStyle, Texture, Ticker } from 'pixi.js';
import { gsap } from 'gsap';

/** Everything tunable — edit intensities / words / timing / coin counts here. */
export const WIN_CELEBRATION_CONFIG = {
  /** Visual-tier bands by win/wager multiplier: <t2 = tier0, <t3 = tier1, else tier2. */
  bands: { t2: 15, t3: 75 },
  words: ['NICE ONE!', 'INSANE!', 'FABULOUS WIN!'],
  countDur: [1.0, 1.6, 2.2],
  holdDur: [0.5, 0.8, 1.1],
  amountFontSize: [42, 56, 68],
  wordFontSize: [30, 40, 50],
  endPunch: [1.12, 1.18, 1.24],
  coinCount: [55, 120, 200],
  coinWaves: [2, 3, 4],
  coinPower: [580, 700, 820],
  gravity: 980,
  airDrag: 0.995,
  coinSpread: 1.5,
  particleCap: 340,
  /** How lively the text bob is (px, at design scale). */
  bobPx: 5,
  /** Design reference height; sizes/physics scale by min(sw,sh)/this. */
  designBase: 720,
};

export interface WinCelebrationParams {
  winAmount: bigint;
  wager: bigint;
  symbol: string;
  decimals: number;
  tier: number; // 0 | 1 | 2
  centre: { x: number; y: number };
  origins: Array<{ x: number; y: number }>;
  reduced: boolean;
}

interface Coin {
  sp: Sprite; x: number; y: number; vx: number; vy: number;
  age: number; life: number; spin: number; ph: number; base: number;
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
  private readonly font: string;

  private overlay: Container | null = null;
  private tl: gsap.core.Timeline | null = null;
  private tickCb: ((t: Ticker) => void) | null = null;
  private coins: Coin[] = [];
  private coinTex: Texture | null = null;
  private resolveActive: (() => void) | null = null;

  constructor(app: Application, opts: { accent: number; coinColors: number[]; fontFamily?: string }) {
    this.app = app;
    this.font = opts.fontFamily ?? "'Poppins', ui-sans-serif, sans-serif";
  }

  play(p: WinCelebrationParams): Promise<void> {
    this.cancel();

    const sw = this.app.screen.width, sh = this.app.screen.height;
    const s = Math.max(0.6, Math.min(2, Math.min(sw, sh) / WIN_CELEBRATION_CONFIG.designBase));
    const tier = Math.max(0, Math.min(2, p.tier));
    const C = WIN_CELEBRATION_CONFIG;

    const overlay = new Container();
    overlay.zIndex = 10000;
    overlay.eventMode = 'none';
    this.overlay = overlay;
    this.app.stage.addChild(overlay); // last => on top

    // Coins behind the text (text stays readable).
    const coinLayer = new Container();
    overlay.addChild(coinLayer);

    // Text group (bobs for liveliness).
    const baseCy = p.centre.y;
    const textGroup = new Container();
    textGroup.position.set(p.centre.x, baseCy);
    overlay.addChild(textGroup);

    const wordSize = Math.round(C.wordFontSize[tier] * s);
    const amtSize = Math.round(C.amountFontSize[tier] * s);
    const word = new Text({
      text: C.words[tier],
      style: new TextStyle({
        fontFamily: this.font, fontSize: wordSize, fontWeight: '800', letterSpacing: 3,
        fill: 0xfff4d8, stroke: { color: 0x201400, width: Math.max(3, 4 * s) },
        dropShadow: { color: 0x000000, blur: 7, distance: 3, alpha: 0.7 },
      }),
    });
    word.anchor.set(0.5);
    word.y = -amtSize * 0.68;
    word.alpha = 0; word.scale.set(1.5);
    textGroup.addChild(word);

    const amount = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: this.font, fontSize: amtSize, fontWeight: '800', fontStyle: 'italic', letterSpacing: 1,
        fill: 0xffd24a, stroke: { color: 0x3a1500, width: Math.max(4, 5 * s) },
        dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.6 },
      }),
    });
    amount.anchor.set(0.5);
    amount.y = amtSize * 0.32;
    amount.alpha = 0; amount.scale.set(0.55);
    textGroup.addChild(amount);

    // ── Coin fountain: ONE premium baked texture + ONE ticker integrator ──
    const coinTex = this.getCoinTex();
    const origins = p.origins.length ? p.origins : [{ x: p.centre.x, y: p.centre.y + amtSize }];
    const emit = (count: number, power: number, scaleMul: number) => {
      for (let i = 0; i < count; i++) {
        if (this.coins.length >= C.particleCap) break;
        const o = origins[i % origins.length];
        const angle = -Math.PI / 2 + ((i / count) - 0.5) * C.coinSpread + (Math.random() - 0.5) * 0.25;
        const sp0 = power * s * (0.7 + Math.random() * 0.6);
        const seedA = Math.random() * Math.PI * 2, seedR = 14 * s;
        const sprite = new Sprite(coinTex);
        sprite.anchor.set(0.5);
        const base = s * (0.34 + Math.random() * 0.22) * scaleMul;
        sprite.scale.set(base);
        const x = o.x + Math.cos(seedA) * seedR, y = o.y + Math.sin(seedA) * seedR;
        sprite.position.set(x, y);
        coinLayer.addChild(sprite);
        this.coins.push({
          sp: sprite, x, y, vx: Math.cos(angle) * sp0, vy: Math.sin(angle) * sp0,
          age: 0, life: 0.95 + Math.random() * 0.7, spin: 8 + Math.random() * 7,
          ph: Math.random() * Math.PI * 2, base,
        });
      }
    };

    const grav = C.gravity * s;
    const bob = C.bobPx * s;
    let elapsed = 0;
    const tick = (t: Ticker) => {
      if (!this.overlay) return;
      const dt = Math.min(0.05, t.deltaMS / 1000);
      elapsed += dt;
      textGroup.y = baseCy + Math.sin(elapsed * 3.4) * bob; // lively idle bob
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        c.vy += grav * dt; c.vx *= C.airDrag;
        c.x += c.vx * dt; c.y += c.vy * dt; c.age += dt;
        c.sp.position.set(c.x, c.y);
        c.sp.scale.x = Math.abs(Math.cos(c.age * c.spin + c.ph)) * c.base; // edge-flip
        c.sp.rotation += dt * 1.1;
        const left = c.life - c.age;
        if (left < c.life * 0.32) c.sp.alpha = Math.max(0, left / (c.life * 0.32));
        if (c.age >= c.life) { c.sp.destroy(); this.coins.splice(i, 1); }
      }
    };
    this.tickCb = tick;
    this.app.ticker.add(tick);

    // ── Reduced motion: static text + final number, brief hold, resolve once ─
    if (p.reduced) {
      return new Promise<void>((resolve) => {
        this.resolveActive = resolve;
        word.alpha = 1; word.scale.set(1);
        amount.text = `${formatAmount(p.winAmount, p.decimals)} ${p.symbol}`;
        amount.alpha = 1; amount.scale.set(1);
        const tl = gsap.timeline({ onComplete: () => this.finish() });
        this.tl = tl;
        tl.to({}, { duration: 1.0 });
        tl.to([word, amount], { alpha: 0, duration: 0.3, ease: 'power1.in' });
      });
    }

    // ── The bouncy celebration ────────────────────────────────────────────
    return new Promise<void>((resolve) => {
      this.resolveActive = resolve;
      const tl = gsap.timeline({ onComplete: () => this.finish() });
      this.tl = tl;

      // Coins: biggest wave first, trailing waves smaller.
      const waves = C.coinWaves[tier], total = C.coinCount[tier], power = C.coinPower[tier];
      tl.call(() => emit(Math.round(total * 0.55), power, 1.15), undefined, 0);
      for (let w = 1; w < waves; w++) {
        tl.call(() => emit(Math.round((total * 0.45) / (waves - 1)), power * 0.92, 1 - w * 0.07),
          undefined, 0.14 + w * (C.countDur[tier] / waves));
      }

      // Wordmark: bouncy snap-in.
      tl.to(word, { alpha: 1, duration: 0.14, ease: 'power2.out' }, 0);
      tl.fromTo(word.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(3)' }, 0);

      // Amount: bouncy pop, then count up.
      amount.text = `0.00 ${p.symbol}`;
      tl.to(amount, { alpha: 1, duration: 0.14, ease: 'power2.out' }, 0.08);
      tl.fromTo(amount.scale, { x: 0.55, y: 0.55 }, { x: 1, y: 1, duration: 0.44, ease: 'back.out(2.8)' }, 0.08);
      const finalVal = Number(p.winAmount) / Math.pow(10, p.decimals);
      const dp = p.decimals > 4 ? 2 : p.decimals;
      const counter = { val: 0 };
      tl.to(counter, {
        val: finalVal, duration: C.countDur[tier], ease: 'power2.out',
        onUpdate: () => { if (this.overlay) amount.text = `${counter.val.toFixed(dp)} ${p.symbol}`; },
        onComplete: () => { if (this.overlay) amount.text = `${formatAmount(p.winAmount, p.decimals)} ${p.symbol}`; },
      }, 0.12);

      // End punch: pre-squash → punch → springy elastic settle (bouncy!).
      const at = 0.12 + C.countDur[tier];
      tl.to(amount.scale, { x: 0.9, y: 0.9, duration: 0.06 }, at)
        .to(amount.scale, { x: C.endPunch[tier], y: C.endPunch[tier], duration: 0.1, ease: 'power2.out' }, at + 0.06)
        .to(amount.scale, { x: 1, y: 1, duration: 0.55, ease: 'elastic.out(1.1,0.4)' }, at + 0.16);
      // Sympathetic word bounce on the punch.
      tl.to(word.scale, { x: 1.08, y: 1.08, duration: 0.1, yoyo: true, repeat: 1, ease: 'sine.inOut' }, at + 0.06);

      // Hold, then exit.
      const exitAt = at + 0.25 + C.holdDur[tier];
      tl.to(word, { alpha: 0, duration: 0.3, ease: 'power1.in' }, exitAt);
      tl.to(amount, { alpha: 0, duration: 0.3, ease: 'power1.in' }, exitAt + 0.05);
    });
  }

  cancel(): void { this.finish(); }

  dispose(): void {
    this.finish();
    this.coinTex?.destroy(true); this.coinTex = null;
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

  /** A premium gold coin: dark rim + radial gold face + inner ring + specular. */
  private getCoinTex(): Texture {
    if (this.coinTex) return this.coinTex;
    const S = 80;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    const cx = S / 2, cy = S / 2, R = S * 0.44;
    // dark gold rim
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#7a5200'; ctx.fill();
    // gold face (lit from top-left)
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.34, R * 0.1, cx, cy, R * 0.95);
    g.addColorStop(0, '#FFF4B8'); g.addColorStop(0.5, '#FFD23F'); g.addColorStop(1, '#E09A18');
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    // inner ring
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2);
    ctx.lineWidth = S * 0.035; ctx.strokeStyle = 'rgba(150,100,10,0.65)'; ctx.stroke();
    // specular highlight
    ctx.save(); ctx.translate(cx - R * 0.3, cy - R * 0.34); ctx.rotate(-0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.36, R * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill(); ctx.restore();
    // tiny sparkle
    ctx.beginPath(); ctx.arc(cx + R * 0.24, cy - R * 0.22, R * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    this.coinTex = Texture.from(cv);
    return this.coinTex;
  }
}
