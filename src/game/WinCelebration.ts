// WinCelebration — an AAA win celebration, rebuilt from research on how top
// studios (Hacksaw / Push / Nolimit / Pragmatic / stake) present wins.
//
// Core idea: the HERO is one running number. A single counter tween drives the
// amount text, promotes the tier wordmark LIVE mid-roll as the value crosses
// x-bet thresholds (NICE ONE! → INSANE! → FABULOUS WIN!), and fires the coin
// waves. The particles are real: a baked 12-frame SPIN atlas + an additive
// glint + a velocity trail + depth + gravity arcs that fall off-screen (the
// anti-"flat-AI-disc" rule). The wordmark is a baked FOIL texture with a moving
// specular sheen. Impact SLAMS in (never fades); higher tiers add a short shake.
//
// Self-contained: ONE app.stage overlay (screen coords). play() resolves EXACTLY
// once on every path. cancel()/dispose() tear everything down.

import { Application, Assets, Container, Sprite, Text, TextStyle, Texture, Ticker } from 'pixi.js';
import { gsap } from 'gsap';

export type WinParticle = 'moneybag' | 'diamond' | 'gem' | 'cash' | 'star' | 'coin';

/** Everything tunable. */
export const WIN_CELEBRATION_CONFIG = {
  particle: 'coin' as WinParticle, // (kept for compat; the spin-atlas coin is used unless a PNG is uploaded)
  bands: { t2: 15, t3: 75 },
  words: ['NICE ONE!', 'INSANE!', 'FABULOUS WIN!'],
  // Per FINAL-tier intensity (the tier the win reaches).
  countDur: [1.1, 1.9, 2.8],
  coinCount: [46, 110, 190],
  coinWaves: [2, 3, 4],
  coinPower: [560, 700, 840],
  shake: [0, 5, 9],          // px
  shakeRot: [0, 0.006, 0.014], // rad
  amountFontSize: [42, 56, 70],
  wordFontSize: [34, 46, 58],
  gravity: 1050,
  airDrag: 0.992,
  particleCap: 380,
  designBase: 720,
  /** Overall size of the whole celebration (text + particles). 1 = full. */
  sizeMul: 0.7,
  // Vice neon palette.
  pink: 0xff2e88,
  cyan: 0x16e0e8,
  gold: 0xffd24a,
  cream: 0xfff3b0,
};

export interface WinCelebrationParams {
  winAmount: bigint;
  wager: bigint;
  symbol: string;
  decimals: number;
  tier: number;
  centre: { x: number; y: number };
  origins: Array<{ x: number; y: number }>;
  reduced: boolean;
}

interface Coin {
  sp: Sprite; glint: Sprite; trail: Sprite | null;
  x: number; y: number; vx: number; vy: number;
  frame: number; frameRate: number; frameDir: number;
  age: number; life: number; depth: number;
}

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
  private coinBack: Container | null = null;
  private coinFront: Container | null = null;
  private tl: gsap.core.Timeline | null = null;
  private tickCb: ((t: Ticker) => void) | null = null;
  private coins: Coin[] = [];
  private resolveActive: (() => void) | null = null;
  /** Standalone tweens (the promotion punch) that live outside this.tl. */
  private extraTweens: gsap.core.Tween[] = [];

  // baked, cached
  private coinFrames: Texture[] | null = null;
  private glintTex: Texture | null = null;
  private trailTex: Texture | null = null;
  private wordCache = new Map<string, Texture>();
  private customTex: Texture | null = null;

  // per-run state (read by the ticker)
  private trauma = 0;
  private traumaMax = 0;
  private traumaRot = 0;
  private baseCx = 0;
  private baseCy = 0;

  constructor(app: Application, opts: { accent: number; coinColors: number[]; fontFamily?: string }) {
    this.app = app;
    this.font = opts.fontFamily ?? "'Poppins', ui-sans-serif, sans-serif";
  }

  play(p: WinCelebrationParams): Promise<void> {
    this.cancel();

    const sw = this.app.screen.width, sh = this.app.screen.height;
    const s = Math.max(0.6, Math.min(2, Math.min(sw, sh) / WIN_CELEBRATION_CONFIG.designBase)) * WIN_CELEBRATION_CONFIG.sizeMul;
    const C = WIN_CELEBRATION_CONFIG;
    const finalVal = Number(p.winAmount) / Math.pow(10, p.decimals);
    const wagerVal = p.wager > 0n ? Number(p.wager) / Math.pow(10, p.decimals) : finalVal || 1;
    const finalTier = Math.max(0, Math.min(2, p.tier));
    // Value thresholds for LIVE wordmark promotion. With no wager, promote at
    // fractions of the final value so the word still upgrades on the roll.
    const th = p.wager > 0n
      ? [0, wagerVal * C.bands.t2, wagerVal * C.bands.t3]
      : [0, finalVal * 0.34, finalVal * 0.7];

    const overlay = new Container();
    overlay.zIndex = 10000; overlay.eventMode = 'none';
    overlay.position.set(0, 0);
    this.overlay = overlay;
    this.app.stage.addChild(overlay);
    this.baseCx = p.centre.x; this.baseCy = p.centre.y;
    this.traumaMax = C.shake[finalTier] * s;
    this.traumaRot = C.shakeRot[finalTier];

    const coinBack = new Container(); overlay.addChild(coinBack); this.coinBack = coinBack;

    // text group (word above, amount below)
    const textGroup = new Container();
    textGroup.position.set(p.centre.x, p.centre.y);
    overlay.addChild(textGroup);
    const amtSize = Math.round(C.amountFontSize[finalTier] * s);

    // Foil wordmark sprite (swappable on promotion) + masked sheen.
    let curTier = 0;
    const word = new Sprite(this.getWordTex(0, finalTier, s));
    word.anchor.set(0.5); word.y = -amtSize * 0.72;
    word.alpha = 0; word.scale.set(1.3);
    textGroup.addChild(word);

    const amount = new Text({
      text: '', style: new TextStyle({
        fontFamily: this.font, fontSize: amtSize, fontWeight: '800', fontStyle: 'italic', letterSpacing: 1,
        fill: 0xffffff, stroke: { color: 0x2a0730, width: Math.max(4, 5 * s) },
        dropShadow: { color: C.pink, blur: 10, distance: 0, alpha: 0.5 },
      }),
    });
    amount.anchor.set(0.5); amount.y = amtSize * 0.34; amount.alpha = 0; amount.scale.set(0.6);
    textGroup.addChild(amount);

    const coinFront = new Container(); overlay.addChild(coinFront); this.coinFront = coinFront;

    // impact flash
    const flash = new Sprite(Texture.WHITE);
    flash.width = sw; flash.height = sh; flash.alpha = 0; flash.blendMode = 'add';
    overlay.addChild(flash);

    // ── particle emit ─────────────────────────────────────────────────────
    const frames = this.customTex ? null : this.getCoinFrames();
    const single = this.customTex;
    const emit = (count: number, power: number, scaleMul: number) => {
      for (let i = 0; i < count; i++) {
        if (this.coins.length >= C.particleCap) break;
        const depth = Math.random();                    // 0=back .. 1=front
        const layer = depth > 0.5 ? coinFront : coinBack;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.3; // up-and-out cone (radial-ish)
        const sp0 = power * s * (0.55 + Math.random() * 0.8);
        const tex0 = single ?? frames![0];
        const sp = new Sprite(tex0);
        sp.anchor.set(0.5);
        const px = 24 + Math.random() * 12;
        const dScale = (0.6 + depth * 0.55) * scaleMul;
        const base = (px * s * dScale) / (tex0.width || 96);
        sp.scale.set(base);
        sp.alpha = 0.7 + depth * 0.3;
        sp.position.set(p.centre.x + (Math.random() - 0.5) * 30 * s, p.centre.y + (Math.random() - 0.5) * 16 * s);
        const glint = new Sprite(this.getGlintTex());
        glint.anchor.set(0.5); glint.blendMode = 'add';
        glint.scale.set((tex0.width || 96) / (this.glintTex!.width || 64) * 0.9);
        glint.tint = Math.random() < 0.5 ? C.cyan : C.pink;
        sp.addChild(glint);
        layer.addChild(sp);
        // velocity trail behind fast coins
        let trail: Sprite | null = null;
        if (depth > 0.35) {
          trail = new Sprite(this.getTrailTex());
          trail.anchor.set(0.5, 1); trail.blendMode = 'add'; trail.alpha = 0.5;
          trail.tint = C.cream;
          layer.addChildAt(trail, Math.max(0, layer.getChildIndex(sp)));
        }
        this.coins.push({
          sp, glint, trail,
          x: sp.x, y: sp.y, vx: Math.cos(angle) * sp0, vy: Math.sin(angle) * sp0 - 120 * s,
          frame: frames ? Math.floor(Math.random() * frames.length) : 0,
          frameRate: 14 + Math.random() * 14, frameDir: Math.random() < 0.5 ? 1 : -1,
          age: 0, life: 1.4 + Math.random() * 1.0, depth,
        });
      }
    };

    const grav = C.gravity * s;
    const tick = (t: Ticker) => {
      if (!this.overlay) return;
      const dt = Math.min(0.05, t.deltaMS / 1000);
      // trauma screenshake (translation + a touch of rotation = "force")
      if (this.trauma > 0) {
        const tr = this.trauma * this.trauma;
        this.overlay.x = this.traumaMax * tr * (Math.random() * 2 - 1);
        this.overlay.y = this.traumaMax * tr * (Math.random() * 2 - 1);
        this.overlay.rotation = this.traumaRot * tr * (Math.random() * 2 - 1);
        this.trauma = Math.max(0, this.trauma - dt * 1.6);
        if (this.trauma === 0) { this.overlay.x = 0; this.overlay.y = 0; this.overlay.rotation = 0; }
      }
      const nf = frames ? frames.length : 0;
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        c.vy += grav * dt; c.vx *= C.airDrag; c.vy *= C.airDrag;
        c.x += c.vx * dt; c.y += c.vy * dt; c.age += dt;
        c.sp.position.set(c.x, c.y);
        if (frames && nf) { c.frame = (c.frame + c.frameDir * c.frameRate * dt + nf) % nf; c.sp.texture = frames[Math.floor(c.frame)]; }
        else { c.sp.scale.x = (0.55 + 0.45 * Math.abs(Math.cos(c.age * 9))) * c.sp.scale.y; }
        // glint pulses with the spin phase (metal read)
        c.glint.alpha = 0.35 + 0.5 * Math.abs(Math.sin(c.age * 11 + c.depth * 3));
        // trail follows velocity
        if (c.trail) {
          const sp2 = Math.hypot(c.vx, c.vy);
          c.trail.position.set(c.x, c.y);
          c.trail.rotation = Math.atan2(c.vy, c.vx) - Math.PI / 2;
          c.trail.scale.set(c.sp.scale.y * 0.8, c.sp.scale.y * (0.6 + sp2 / (900 * s)));
          c.trail.alpha = Math.min(0.55, sp2 / (1400 * s));
        }
        // fall off the bottom (permanence) — recycle only when well off-screen
        if (c.y > sh + 80 || c.age >= c.life) {
          c.sp.destroy(); c.trail?.destroy(); this.coins.splice(i, 1);
        }
      }
    };
    this.tickCb = tick;
    this.app.ticker.add(tick);

    // ── reduced motion ────────────────────────────────────────────────────
    if (p.reduced) {
      return new Promise<void>((resolve) => {
        this.resolveActive = resolve;
        word.texture = this.getWordTex(finalTier, finalTier, s);
        word.alpha = 1; word.scale.set(1);
        amount.text = `${formatAmount(p.winAmount, p.decimals)} ${p.symbol}`;
        amount.alpha = 1; amount.scale.set(1);
        const tl = gsap.timeline({ onComplete: () => this.finish() });
        this.tl = tl;
        tl.to({}, { duration: 1.0 });
        tl.to([word, amount], { alpha: 0, duration: 0.3, ease: 'power1.in' });
      });
    }

    // ── the celebration ───────────────────────────────────────────────────
    return new Promise<void>((resolve) => {
      this.resolveActive = resolve;
      const tl = gsap.timeline({ onComplete: () => this.finish() });
      this.tl = tl;

      const promoteTier = (n: number) => {
        if (n <= curTier || !this.overlay) return;
        curTier = n;
        word.texture = this.getWordTex(n, finalTier, s);
        // Kill only the PREVIOUS promotion punch (not the timeline's slam-in),
        // and track this one so finish() tears it down.
        for (const t of this.extraTweens) t.kill();
        this.extraTweens = [
          gsap.fromTo(word.scale, { x: 1, y: 1 }, { x: 1.24, y: 1.24, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 }),
        ];
        emit(Math.round(C.coinCount[finalTier] * 0.28), C.coinPower[finalTier], 1);
        if (n >= 1) { this.trauma = 1; }
      };

      // IMPACT: word SLAMS in, flash, first (biggest) burst, count starts.
      tl.to(word, { alpha: 1, duration: 0.1, ease: 'power2.out' }, 0);
      tl.fromTo(word.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0);
      tl.fromTo(word, { rotation: -0.07 }, { rotation: 0, duration: 0.5, ease: 'back.out(2)' }, 0);
      tl.to(flash, { alpha: 0.55, duration: 0.04 }, 0).to(flash, { alpha: 0, duration: 0.35, ease: 'power2.in' }, 0.04);
      tl.call(() => emit(Math.round(C.coinCount[finalTier] * 0.55), C.coinPower[finalTier], 1.15), undefined, 0.02);
      if (finalTier >= 1) tl.call(() => { this.trauma = 1; }, undefined, 0.02);

      // AMOUNT reveal + segmented count-up (steady body, decelerating tail).
      amount.text = `0.00 ${p.symbol}`;
      tl.to(amount, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0.06);
      tl.fromTo(amount.scale, { x: 0.6, y: 0.6 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2.6)' }, 0.06);
      const dp = p.decimals > 4 ? 2 : p.decimals;
      const counter = { val: 0 };
      const waves = C.coinWaves[finalTier];
      let nextWave = 1;
      tl.to(counter, {
        val: finalVal, duration: C.countDur[finalTier], ease: 'power1.inOut',
        onUpdate: () => {
          if (!this.overlay) return;
          amount.text = `${counter.val.toFixed(dp)} ${p.symbol}`;
          // live tier promotion as the number climbs past x-bet thresholds
          if (curTier < finalTier) {
            if (curTier < 2 && counter.val >= th[2] && finalTier >= 2) promoteTier(2);
            else if (curTier < 1 && counter.val >= th[1] && finalTier >= 1) promoteTier(1);
          }
          // coin waves on progress milestones (burst-then-trickle)
          const prog = counter.val / (finalVal || 1);
          if (nextWave < waves && prog >= nextWave / waves) {
            emit(Math.round((C.coinCount[finalTier] * 0.45) / (waves - 1)), C.coinPower[finalTier] * 0.9, 1 - nextWave * 0.06);
            nextWave++;
          }
        },
        onComplete: () => { if (this.overlay) amount.text = `${formatAmount(p.winAmount, p.decimals)} ${p.symbol}`; },
      }, 0.12);

      // END FLARE: overshoot punch + a small flash + brief shake bump.
      const at = 0.12 + C.countDur[finalTier];
      tl.to(amount.scale, { x: 0.92, y: 0.92, duration: 0.06 }, at)
        .to(amount.scale, { x: 1.16, y: 1.16, duration: 0.1, ease: 'power2.out' }, at + 0.06)
        .to(amount.scale, { x: 1, y: 1, duration: 0.55, ease: 'elastic.out(1.1,0.4)' }, at + 0.16);
      tl.to(flash, { alpha: 0.4, duration: 0.05 }, at + 0.05).to(flash, { alpha: 0, duration: 0.35, ease: 'power2.in' }, at + 0.1);
      if (finalTier >= 1) tl.call(() => { this.trauma = 0.8; }, undefined, at + 0.05);

      // HOLD then EXIT (coins keep falling under the fade).
      const exitAt = at + 0.35 + [0.4, 0.7, 1.0][finalTier];
      tl.to(word, { alpha: 0, duration: 0.3, ease: 'power1.in' }, exitAt);
      tl.to(amount, { alpha: 0, duration: 0.3, ease: 'power1.in' }, exitAt + 0.05);
    });
  }

  cancel(): void { this.finish(); }

  dispose(): void {
    this.finish();
    this.coinFrames?.forEach(t => t.destroy(true)); this.coinFrames = null;
    this.glintTex?.destroy(true); this.glintTex = null;
    this.trailTex?.destroy(true); this.trailTex = null;
    this.customTex?.destroy(true); this.customTex = null;
    for (const t of this.wordCache.values()) t.destroy(true);
    this.wordCache.clear();
  }

  setParticle(kind: WinParticle): void {
    WIN_CELEBRATION_CONFIG.particle = kind;
    this.customTex?.destroy(true); this.customTex = null;
  }

  async setParticleImage(url: string | null): Promise<void> {
    this.customTex?.destroy(true); this.customTex = null;
    if (!url) return;
    try { this.customTex = await Assets.load<Texture>(url); }
    catch (err) { console.warn('[WinCelebration] particle image failed to load:', err); }
  }

  // ── internals ──
  private finish(): void {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    for (const t of this.extraTweens) t.kill();
    this.extraTweens.length = 0;
    if (this.tickCb) { this.app.ticker.remove(this.tickCb); this.tickCb = null; }
    for (const c of this.coins) { try { c.sp.destroy(); c.trail?.destroy(); } catch { /* torn down */ } }
    this.coins.length = 0;
    this.trauma = 0;
    if (this.overlay) { try { this.overlay.destroy({ children: true }); } catch { /* torn down */ } this.overlay = null; }
    this.coinBack = null; this.coinFront = null;
    const r = this.resolveActive; this.resolveActive = null;
    if (r) r();
  }

  /** 12-frame Y-axis spin strip of a neon-gold coin — a real 3D spin. */
  private getCoinFrames(): Texture[] {
    if (this.coinFrames) return this.coinFrames;
    const C = WIN_CELEBRATION_CONFIG;
    const S = 96, N = 12, R = S * 0.42;
    const frames: Texture[] = [];
    const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
    for (let i = 0; i < N; i++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const ctx = cv.getContext('2d')!;
      const a = (i / N) * Math.PI * 2;
      const wf = Math.max(0.08, Math.abs(Math.cos(a)));
      const front = Math.cos(a) >= 0;
      const cx = S / 2, cy = S / 2;
      // neon rim
      ctx.beginPath(); ctx.ellipse(cx, cy, R * wf, R, 0, 0, Math.PI * 2);
      ctx.fillStyle = front ? hex(C.pink) : hex(C.cyan); ctx.fill();
      // gold face
      const g = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
      g.addColorStop(0, '#FFF7C8'); g.addColorStop(0.5, '#FFD24A'); g.addColorStop(1, '#E39B1E');
      ctx.beginPath(); ctx.ellipse(cx, cy, R * wf * 0.82, R * 0.82, 0, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      if (front && wf > 0.35) {
        ctx.font = `900 ${Math.round(R * 1.1)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.save(); ctx.scale(wf, 1); ctx.fillStyle = 'rgba(120,78,0,0.4)'; ctx.fillText('$', cx / wf, cy); ctx.restore();
      }
      // edge glint when near edge-on
      if (wf < 0.3) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(cx - R * wf, cy - R, R * wf * 2, R * 2); }
      frames.push(Texture.from(cv));
    }
    this.coinFrames = frames;
    return frames;
  }

  private getGlintTex(): Texture {
    if (this.glintTex) return this.glintTex;
    const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    this.glintTex = Texture.from(cv); return this.glintTex;
  }

  private getTrailTex(): Texture {
    if (this.trailTex) return this.trailTex;
    const W = 24, H = 96, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.85)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    this.trailTex = Texture.from(cv); return this.trailTex;
  }

  /** Bake a tier wordmark as a foil texture (Vice gradient + stroke + glow). */
  private getWordTex(tier: number, _finalTier: number, s: number): Texture {
    const C = WIN_CELEBRATION_CONFIG;
    const fs = Math.round(C.wordFontSize[tier] * s * 1.15);
    const key = `${tier}:${fs}`; // include size so a resized run bakes a fresh texture
    const cached = this.wordCache.get(key);
    if (cached) return cached;
    const text = C.words[tier].toUpperCase();
    const font = `900 italic ${fs}px ${this.font.replace(/'/g, '')}`;
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = font;
    const w = Math.ceil(measure.measureText(text).width) + fs * 1.2;
    const h = Math.ceil(fs * 1.9);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d')!;
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = w / 2, cy = h / 2;
    // outer glow
    ctx.save();
    ctx.shadowColor = tier === 2 ? '#FF2E88' : tier === 1 ? '#16E0E8' : '#FFD24A';
    ctx.shadowBlur = fs * 0.4;
    ctx.fillStyle = '#ffffff'; ctx.fillText(text, cx, cy);
    ctx.restore();
    // dark stroke (bevel base, offset down)
    ctx.lineWidth = fs * 0.14; ctx.strokeStyle = '#1a0416'; ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, cy + fs * 0.02);
    // foil vertical gradient fill
    const grad = ctx.createLinearGradient(0, cy - fs * 0.6, 0, cy + fs * 0.6);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.45, tier === 0 ? '#FFE68A' : '#FFF3B0');
    grad.addColorStop(0.5, tier === 2 ? '#FF6FB0' : tier === 1 ? '#7FF0F4' : '#FFD24A');
    grad.addColorStop(1, tier === 2 ? '#B01E63' : tier === 1 ? '#0E9BA6' : '#C77E10');
    ctx.fillStyle = grad; ctx.fillText(text, cx, cy);
    // top specular line
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, cy - fs * 0.18); ctx.clip(); ctx.fillText(text, cx, cy); ctx.restore();
    const tex = Texture.from(cv);
    this.wordCache.set(key, tex);
    return tex;
  }
}
