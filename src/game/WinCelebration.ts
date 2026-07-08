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

import { Application, Assets, Container, Rectangle, Sprite, Text, TextStyle, Texture, Ticker } from 'pixi.js';
import { gsap } from 'gsap';

export type WinParticle = 'moneybag' | 'diamond' | 'gem' | 'cash' | 'star' | 'coin';

/** Everything tunable. */
export const WIN_CELEBRATION_CONFIG = {
  particle: 'coin' as WinParticle, // (kept for compat; the spin-atlas coin is used unless a PNG is uploaded)
  bands: { t2: 15, t3: 75 },
  words: ['NICE ONE!', 'INSANE!', 'FABULOUS WIN!'],
  // Per FINAL-tier intensity (the tier the win reaches).
  countDur: [1.1, 1.9, 2.8],
  coinCount: [46, 110, 200],
  coinWaves: [3, 5, 7], // spread across the count = a continuous fountain, not one puff
  coinPower: [560, 700, 840],
  shake: [0, 5, 9],          // px
  shakeRot: [0, 0.006, 0.014], // rad
  amountFontSize: [42, 56, 70],
  wordFontSize: [34, 46, 58],
  gravity: 1050,
  airDrag: 0.995, // low drag — clean ballistic arcs for the bottom fountain
  particleCap: 380,
  designBase: 720,
  /** Overall size of the whole celebration (text + banner + particles). 1 = full. */
  sizeMul: 0.5,
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
  /** Slot/reel-frame bounds in SCREEN coords — the coin fountain is confined
   *  to this area (coins emerge from & exit at its bottom edge, as if from
   *  behind the frame). Falls back to the full viewport when omitted. */
  bounds?: { left: number; right: number; bottom: number };
  reduced: boolean;
}

/** The coin metals — the tier ladder: bronze (NICE ONE) → silver (INSANE) →
 *  at FABULOUS all three pop together. Palettes tuned visually on
 *  public/cointest.html (open it to see every frame at every size). */
export type Metal = 'bronze' | 'silver' | 'gold';
const METAL_PALETTES: Record<Metal, { outline: string; dark: string; mid: string; light: string; xlight: string; ink: string }> = {
  gold:   { outline: '#4a2c05', dark: '#a56d0d', mid: '#e8a820', light: '#ffd95e', xlight: '#fff3b8', ink: '74,44,5' },
  silver: { outline: '#2e3742', dark: '#6b7a8d', mid: '#aab9c9', light: '#e4edf6', xlight: '#ffffff', ink: '36,44,55' },
  bronze: { outline: '#3a1f0c', dark: '#8a4f1d', mid: '#b06a2a', light: '#dd9a4e', xlight: '#f7cf96', ink: '58,31,12' },
};

interface Coin {
  sp: Sprite; glint: Sprite; trail: Sprite | null;
  /** This coin's spin frames (its metal's atlas, or an uploaded strip). */
  frames: Texture[] | null;
  x: number; y: number; vx: number; vy: number;
  frame: number; frameRate: number; frameDir: number;
  age: number; life: number; depth: number;
  /** Small z-rotation wobble amplitude — a falling coin never spins on one axis only. */
  rotW: number; ph: number;
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
  private metalFrames = new Map<Metal, Texture[]>();
  private glintTex: Texture | null = null;
  private trailTex: Texture | null = null;
  private wordCache = new Map<string, Texture>();
  private customTex: Texture | null = null;
  /** Frames sliced from an uploaded horizontal spin-strip (real rotation). */
  private customFrames: Texture[] | null = null;
  /** Chrome plaque texture shown behind the win text (pulses gently). */
  private bannerTex: Texture | null = null;

  // per-run state (read by the ticker)
  private trauma = 0;
  /** One-shot pulse impulse for the banner+text (set on impact/promotion). */
  private pulseKick = 0;
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

    // Horizontal confinement to the slot frame (x only — the vertical zone is
    // anchored to the win text, defined once the font size is known).
    const bLeft = p.bounds?.left ?? 0;
    const bRight = p.bounds?.right ?? sw;

    const overlay = new Container();
    overlay.zIndex = 10000; overlay.eventMode = 'none';
    overlay.position.set(0, 0);
    this.overlay = overlay;
    this.app.stage.addChild(overlay);
    this.baseCx = p.centre.x; this.baseCy = p.centre.y;
    this.traumaMax = C.shake[finalTier] * s;
    this.traumaRot = C.shakeRot[finalTier];

    // Coins sit BEHIND the plaque now: they spawn from behind the chrome frame,
    // arc up out of its top edge, and drop back DOWN behind it (the frame
    // occludes them) — they never appear in a band below the text.
    const coinBack = new Container(); overlay.addChild(coinBack); this.coinBack = coinBack;
    const coinFront = new Container(); overlay.addChild(coinFront); this.coinFront = coinFront;

    // Chrome plaque IN FRONT of the coins (the occluder), behind the text.
    const banner = this.bannerTex ? new Sprite(this.bannerTex) : null;
    let bannerBaseSX = 1, bannerBaseSY = 1, bannerTopY = 0, bannerBottomY = sh, bannerHalfW = sw / 2;
    if (banner) { banner.anchor.set(0.5); banner.alpha = 0; overlay.addChild(banner); }

    // text group (word above, amount below)
    const textGroup = new Container();
    textGroup.position.set(p.centre.x, p.centre.y);
    overlay.addChild(textGroup);
    const amtSize = Math.round(C.amountFontSize[finalTier] * s);

    // Foil wordmark sprite (swappable on promotion).
    let curTier = 0;
    const word = new Sprite(this.getWordTex(0, finalTier, s));
    word.anchor.set(0.5);
    word.alpha = 0; word.scale.set(1.3);
    textGroup.addChild(word);

    const amount = new Text({
      text: '', style: new TextStyle({
        fontFamily: this.font, fontSize: amtSize, fontWeight: '800', fontStyle: 'italic', letterSpacing: 1,
        fill: 0xffffff, stroke: { color: 0x2a0730, width: Math.max(4, 5 * s) },
        dropShadow: { color: C.pink, blur: 10, distance: 0, alpha: 0.5 },
      }),
    });
    amount.anchor.set(0.5); amount.alpha = 0; amount.scale.set(0.6);
    textGroup.addChild(amount);

    // The plaque wraps ONLY the tier WORD; the money amount sits BELOW it.
    let bh = amtSize * 1.5; // height fallback if no banner
    if (banner && this.bannerTex) {
      const wordFS = Math.round(C.wordFontSize[finalTier] * s * 1.15);
      const measure = document.createElement('canvas').getContext('2d')!;
      measure.font = `900 italic ${wordFS}px ${this.font.replace(/'/g, '')}`;
      const wordW = measure.measureText(C.words[finalTier].toUpperCase()).width;
      const bw = wordW + 66 * s;
      bh = Math.max(wordFS * 1.7 + 14 * s, bw / 2.9); // wrap the word; keep the frame proportional
      bannerBaseSX = bw / this.bannerTex.width;
      bannerBaseSY = bh / this.bannerTex.height;
      banner.scale.set(bannerBaseSX, bannerBaseSY);
      bannerHalfW = bw / 2;
    }
    // Layout: word centred in the plaque (upper), money amount just below it.
    word.y = -amtSize * 0.625;
    amount.y = word.y + bh * 0.5 + amtSize * 0.72;
    if (banner) {
      const bannerCY = p.centre.y + word.y;
      banner.position.set(p.centre.x, bannerCY);
      bannerTopY = bannerCY - bh / 2;
      bannerBottomY = bannerCY + bh / 2;
    }

    // impact flash
    const flash = new Sprite(Texture.WHITE);
    flash.width = sw; flash.height = sh; flash.alpha = 0; flash.blendMode = 'add';
    overlay.addChild(flash);

    // Vertical zone anchored to the WIN TEXT: coins rise from just under the
    // amount and arc up ABOVE the wordmark, then dissolve back into the band
    // (all on the layer behind the text).
    const bandTop = p.centre.y + amtSize * 1.0;
    const bandH = 55 * s;

    // ── particle emit ─────────────────────────────────────────────────────
    const strip = this.customFrames;                     // uploaded spin-strip overrides all metals
    const single = strip ? null : this.customTex;        // uploaded single image
    // GOLD ONLY — the bronze/silver/gold ladder was not approved. Escalation
    // stays in the counts/waves/shake, not the metal.
    const pickMetal = (): Metal => 'gold';
    const emit = (count: number, power: number, scaleMul: number) => {
      for (let i = 0; i < count; i++) {
        if (this.coins.length >= C.particleCap) break;
        const depth = Math.random();                    // 0=back .. 1=front
        const layer = depth > 0.5 ? coinFront : coinBack;
        // FOUNTAIN FROM BELOW (Gift-Bonanza reference): coins erupt from under
        // the bottom edge, arc up to around/above the text, fall back out the
        // bottom. Launch speed derived from the peak height, not a raw power.
        void power;
        const metal = pickMetal();
        const fset = strip ?? (single ? null : this.getMetalFrames(metal));
        const tex0 = single ?? fset![0];
        const sp = new Sprite(tex0);
        sp.anchor.set(0.5);
        const px = 20 + Math.random() * 22; // big, varied — like the reference
        const dScale = (0.6 + depth * 0.55) * scaleMul;
        const base = (px * s * dScale) / (tex0.width || 96);
        sp.scale.set(base);
        sp.alpha = 0.7 + depth * 0.3;
        // Spawn from BEHIND the plaque (hidden by it), across ~the plaque width;
        // arcs peak above the wordmark, so coins emerge from the frame's top.
        const slotW = bRight - bLeft;
        const spreadW = banner ? bannerHalfW * 1.4 : slotW * (0.55 + finalTier * 0.15);
        let x0 = p.centre.x + (Math.random() - 0.5) * spreadW;
        x0 = Math.max(bLeft + 16 * s, Math.min(bRight - 16 * s, x0));
        const y0 = banner ? bannerBottomY - (bannerBottomY - bannerTopY) * 0.18 : bandTop + bandH * 0.7;
        // Peak well ABOVE the wordmark; ×1.35 compensates for air-drag losses
        // so coins actually reach the target apex (not just mid-text).
        const peak = p.centre.y - amtSize * (3.0 + Math.random() * 1.6);
        const vy0 = -Math.sqrt(2 * C.gravity * s * Math.max(60 * s, (y0 - peak) * 1.35));
        // Less sideways drift with the plaque so coins stay within its footprint
        // (they'd otherwise drift out and fall visibly beside the frame).
        const vx0 = (Math.random() - 0.5) * (banner ? 85 : 220) * s;
        sp.position.set(x0, y0);
        // Warm-white glint (universal metal highlight — deliberately NOT theme-
        // tinted), smaller and offset toward the top-left key light.
        const glint = new Sprite(this.getGlintTex());
        glint.anchor.set(0.5); glint.blendMode = 'add';
        glint.scale.set((tex0.width || 96) / (this.glintTex!.width || 64) * 0.62);
        glint.position.set(-(tex0.width || 96) * 0.1, -(tex0.height || 96) * 0.12);
        glint.tint = metal === 'silver' ? 0xffffff : 0xfff2c8;
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
          sp, glint, trail, frames: fset,
          x: sp.x, y: sp.y, vx: vx0, vy: vy0,
          frame: fset ? Math.floor(Math.random() * fset.length) : 0,
          frameRate: 12 + Math.random() * 16, frameDir: Math.random() < 0.5 ? 1 : -1,
          age: 0, life: 2.2 + Math.random() * 0.8, depth,
          rotW: (Math.random() - 0.5) * 0.55, ph: Math.random() * Math.PI * 2,
        });
      }
    };

    const grav = C.gravity * s;
    let elapsed = 0;
    const pulseAmp = p.reduced ? 0 : 0.022;
    const tick = (t: Ticker) => {
      if (!this.overlay) return;
      const dt = Math.min(0.05, t.deltaMS / 1000);
      elapsed += dt;
      // Gentle continuous "breathe" of the plaque + text, plus a one-shot kick
      // on impact / tier promotion (decays away) — the pulsing from the ref.
      this.pulseKick = Math.max(0, this.pulseKick - this.pulseKick * dt * 5);
      const factor = 1 + Math.sin(elapsed * 2.7) * pulseAmp + this.pulseKick;
      if (banner) banner.scale.set(bannerBaseSX * factor, bannerBaseSY * factor);
      textGroup.scale.set(factor);
      // trauma screenshake (translation + a touch of rotation = "force")
      if (this.trauma > 0) {
        const tr = this.trauma * this.trauma;
        this.overlay.x = this.traumaMax * tr * (Math.random() * 2 - 1);
        this.overlay.y = this.traumaMax * tr * (Math.random() * 2 - 1);
        this.overlay.rotation = this.traumaRot * tr * (Math.random() * 2 - 1);
        this.trauma = Math.max(0, this.trauma - dt * 1.6);
        if (this.trauma === 0) { this.overlay.x = 0; this.overlay.y = 0; this.overlay.rotation = 0; }
      }
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        c.vy += grav * dt; c.vx *= C.airDrag; c.vy *= C.airDrag;
        c.x += c.vx * dt; c.y += c.vy * dt; c.age += dt;
        c.sp.position.set(c.x, c.y);
        const fset = c.frames;
        if (fset && fset.length) {
          const nf = fset.length;
          c.frame = (c.frame + c.frameDir * c.frameRate * dt + nf) % nf;
          const fi = Math.floor(c.frame) % nf;
          c.sp.texture = fset[fi];
          // Specular PING exactly when the face passes the mirror angle of the
          // spin (wf ≈ 0.38) — a metal flash, not a constant shimmer.
          const wfF = Math.abs(Math.cos((fi / nf) * Math.PI * 2));
          const ping = Math.exp(-((wfF - 0.38) ** 2) / 0.02);
          c.glint.alpha = 0.08 + 0.9 * ping;
          // Slight z-wobble: a falling coin never rotates on a single axis.
          c.sp.rotation = c.rotW * Math.sin(c.age * 2.1 + c.ph);
        } else {
          c.sp.scale.x = (0.55 + 0.45 * Math.abs(Math.cos(c.age * 9))) * c.sp.scale.y;
          c.glint.alpha = 0.35 + 0.5 * Math.abs(Math.sin(c.age * 11 + c.depth * 3));
        }
        // trail follows velocity
        if (c.trail) {
          const sp2 = Math.hypot(c.vx, c.vy);
          c.trail.position.set(c.x, c.y);
          c.trail.rotation = Math.atan2(c.vy, c.vx) - Math.PI / 2;
          c.trail.scale.set(c.sp.scale.y * 0.8, c.sp.scale.y * (0.6 + sp2 / (900 * s)));
          c.trail.alpha = Math.min(0.55, sp2 / (1400 * s));
        }
        // With the plaque, the chrome frame OCCLUDES the coins as they fall, so
        // they just get an end-of-life fade and are culled once they drop past
        // the frame's bottom edge (already hidden). Without it, keep the old
        // positional dissolve band just below the text.
        const lifeLeft = c.life - c.age;
        let alpha = lifeLeft < c.life * 0.15 ? Math.max(0, lifeLeft / (c.life * 0.15)) : 1;
        if (!banner) alpha *= Math.max(0, Math.min(1, (bandTop + bandH - c.y) / bandH));
        c.sp.alpha = alpha * (0.7 + c.depth * 0.3);
        if (c.trail) c.trail.alpha *= alpha;
        const floorY = banner ? bannerBottomY : bandTop + bandH + 20 * s;
        if ((c.vy > 0 && c.y > floorY) || c.age >= c.life) {
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
        if (banner) banner.alpha = 1;
        const tl = gsap.timeline({ onComplete: () => this.finish() });
        this.tl = tl;
        tl.to({}, { duration: 1.0 });
        tl.to([word, amount, ...(banner ? [banner] : [])], { alpha: 0, duration: 0.3, ease: 'power1.in' });
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
        this.pulseKick = 0.13; // plaque + text pop on the upgrade
        if (n >= 1) { this.trauma = 1; }
      };

      // IMPACT: plaque fades in, word SLAMS in, flash, first burst, count starts.
      if (banner) tl.to(banner, { alpha: 1, duration: 0.18, ease: 'power2.out' }, 0);
      tl.call(() => { this.pulseKick = 0.13; }, undefined, 0.02);
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
      if (banner) tl.to(banner, { alpha: 0, duration: 0.35, ease: 'power1.in' }, exitAt);
    });
  }

  cancel(): void { this.finish(); }

  dispose(): void {
    this.finish();
    for (const frames of this.metalFrames.values()) frames.forEach(t => t.destroy(true));
    this.metalFrames.clear();
    this.glintTex?.destroy(true); this.glintTex = null;
    this.trailTex?.destroy(true); this.trailTex = null;
    this.customFrames?.forEach(t => t.destroy(false)); this.customFrames = null;
    this.customTex?.destroy(true); this.customTex = null;
    this.bannerTex?.destroy(true); this.bannerTex = null;
    for (const t of this.wordCache.values()) t.destroy(true);
    this.wordCache.clear();
  }

  setParticle(kind: WinParticle): void {
    WIN_CELEBRATION_CONFIG.particle = kind;
    this.customFrames?.forEach(t => t.destroy(false)); this.customFrames = null;
    this.customTex?.destroy(true); this.customTex = null;
  }

  async setParticleImage(url: string | null): Promise<void> {
    this.customFrames = null;
    this.customTex?.destroy(true); this.customTex = null;
    if (!url) return;
    try {
      const tex = await Assets.load<Texture>(url);
      this.customTex = tex;
      // A wide image is treated as a horizontal SPIN STRIP → slice into square
      // frames for a real rotation; a ~square image is used as a single coin.
      const w = tex.width, h = tex.height;
      if (w >= h * 2.2) {
        const n = Math.max(2, Math.min(24, Math.round(w / h)));
        const fw = w / n;
        const frames: Texture[] = [];
        for (let i = 0; i < n; i++) {
          frames.push(new Texture({ source: tex.source, frame: new Rectangle(i * fw, 0, fw, h) }));
        }
        this.customFrames = frames;
      }
    } catch (err) { console.warn('[WinCelebration] particle image failed to load:', err); }
  }

  /** Load the chrome plaque shown behind the win text (null clears it). */
  async setBannerImage(url: string | null): Promise<void> {
    this.bannerTex?.destroy(true); this.bannerTex = null;
    if (!url) return;
    try { this.bannerTex = await Assets.load<Texture>(url); }
    catch (err) { console.warn('[WinCelebration] banner image failed to load:', err); }
  }

  // ── internals ──
  private finish(): void {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    for (const t of this.extraTweens) t.kill();
    this.extraTweens.length = 0;
    if (this.tickCb) { this.app.ticker.remove(this.tickCb); this.tickCb = null; }
    for (const c of this.coins) { try { c.sp.destroy(); c.trail?.destroy(); } catch { /* torn down */ } }
    this.coins.length = 0;
    this.trauma = 0; this.pulseKick = 0;
    if (this.overlay) { try { this.overlay.destroy({ children: true }); } catch { /* torn down */ } this.overlay = null; }
    this.coinBack = null; this.coinFront = null;
    const r = this.resolveActive; this.resolveActive = null;
    if (r) r();
  }

  /** 16-frame Y-axis spin of an unbranded coin in the given METAL. The recipe
   *  was designed VISUALLY on public/cointest.html (open it to see every frame
   *  at every size): crisp dark silhouette, high-contrast rim torus, a stepped
   *  face with ONE bold embossed centre boss, a BOLD specular wedge that sweeps
   *  across the face with rotation, a strong top-left crescent, a reeded edge
   *  when edge-on, and a short mirror flash. Few, bold elements = crispy. */
  private getMetalFrames(metal: Metal): Texture[] {
    const hit = this.metalFrames.get(metal);
    if (hit) return hit;
    const P = METAL_PALETTES[metal];
    const S = 128, N = 16, R = S * 0.42, TAU = Math.PI * 2;
    const frames: Texture[] = [];
    for (let i = 0; i < N; i++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const ctx = cv.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      const a = (i / N) * TAU;
      const cosA = Math.cos(a);
      const wf = Math.abs(cosA);
      const front = cosA >= 0;
      const cx = S / 2, cy = S / 2;

      // Near edge-on: the reeded EDGE band.
      if (wf < 0.16) {
        const bw = R * 0.22;
        const eg = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
        eg.addColorStop(0, P.dark); eg.addColorStop(0.5, P.xlight); eg.addColorStop(1, P.dark);
        ctx.fillStyle = P.outline;
        ctx.beginPath(); ctx.ellipse(cx, cy, bw + S * 0.02, R + S * 0.02, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = eg;
        ctx.beginPath(); ctx.ellipse(cx, cy, bw, R, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.45; ctx.fillStyle = `rgba(${P.ink},1)`;
        for (let y = -R + S * 0.05; y < R - S * 0.03; y += S * 0.045) ctx.fillRect(cx - bw * 0.85, cy + y, bw * 1.7, S * 0.014);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillRect(cx - S * 0.012, cy - R * 0.94, S * 0.024, R * 1.88);
        const etex = Texture.from(cv);
        etex.source.autoGenerateMipmaps = true;
        frames.push(etex);
        continue;
      }

      const dir = Math.sin(a) >= 0 ? 1 : -1;
      const r0 = R, r1 = R * 0.94, r2 = R * 0.74, r3 = R * 0.44;
      const ex = (r: number) => r * wf;

      // Coin thickness peeking on the receding side.
      const th = R * 0.14 * Math.abs(Math.sin(a));
      if (th > 1) {
        ctx.fillStyle = P.outline;
        ctx.beginPath(); ctx.ellipse(cx + dir * th, cy, ex(r0), r0, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = P.dark;
        ctx.beginPath(); ctx.ellipse(cx + dir * th * 0.6, cy, ex(r0), r0, 0, 0, TAU); ctx.fill();
      }

      // Crisp dark silhouette — pops on any background.
      ctx.fillStyle = P.outline;
      ctx.beginPath(); ctx.ellipse(cx, cy, ex(r0), r0, 0, 0, TAU); ctx.fill();

      // Rim torus — HIGH contrast, tight stops: clearly a ring even at 24px.
      const g1 = ctx.createLinearGradient(0, cy - r0, 0, cy + r0);
      g1.addColorStop(0, '#ffffff'); g1.addColorStop(0.2, P.xlight); g1.addColorStop(0.38, P.light);
      g1.addColorStop(0.55, P.mid); g1.addColorStop(0.8, P.dark); g1.addColorStop(1, P.dark);
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.ellipse(cx, cy, ex(r1), r1, 0, 0, TAU); ctx.fill();

      // Face — separated from the rim by a crisp dark step.
      ctx.fillStyle = `rgba(${P.ink},0.55)`;
      ctx.beginPath(); ctx.ellipse(cx, cy, ex(r2 * 1.06), r2 * 1.06, 0, 0, TAU); ctx.fill();
      const g2 = ctx.createLinearGradient(0, cy - r2, 0, cy + r2);
      g2.addColorStop(0, P.light); g2.addColorStop(0.55, P.mid); g2.addColorStop(1, P.dark);
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.ellipse(cx, cy, ex(r2), r2, 0, 0, TAU); ctx.fill();

      // ONE bold embossed centre boss (clean, unbranded, crisp at any size).
      ctx.save(); ctx.translate(cx, cy); ctx.scale(wf, 1);
      ctx.fillStyle = `rgba(${P.ink},0.5)`;
      ctx.beginPath(); ctx.arc(0, 0, r3 * 1.1, 0, TAU); ctx.fill();
      const g3 = ctx.createLinearGradient(0, -r3, 0, r3);
      g3.addColorStop(0, P.xlight); g3.addColorStop(0.5, P.light); g3.addColorStop(1, P.mid);
      ctx.fillStyle = g3;
      ctx.beginPath(); ctx.arc(0, r3 * 0.06, r3, 0, TAU); ctx.fill();
      ctx.restore();

      // BOLD moving specular wedge — what sells the rotation.
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy, ex(r2), r2, 0, 0, TAU); ctx.clip();
      const bandX = cx - Math.sin(a) * ex(r2) * 0.75;
      ctx.translate(bandX, cy); ctx.rotate(-0.35);
      const w1 = r2 * 0.44 * (wf * 0.7 + 0.3);
      ctx.fillStyle = `rgba(255,255,255,${front ? 0.62 : 0.4})`;
      ctx.fillRect(-w1 / 2, -r2 * 1.5, w1, r2 * 3);
      ctx.fillStyle = `rgba(255,255,255,${front ? 0.3 : 0.18})`;
      ctx.fillRect(w1 * 0.95, -r2 * 1.5, w1 * 0.4, r2 * 3);
      ctx.restore();

      // SHARP rim lighting: a hairline ring + a slim top-left accent (no fat
      // cartoon crescent) — reads as machined metal, not a sticker.
      ctx.save(); ctx.translate(cx, cy); ctx.scale(wf, 1);
      ctx.lineWidth = S * 0.012;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(0, 0, r1 * 0.9, 0, TAU); ctx.stroke();
      ctx.lineCap = 'round';
      ctx.lineWidth = (r1 - r2) * 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(0, 0, (r1 + r2) / 2, Math.PI * 1.1, Math.PI * 1.38); ctx.stroke();
      ctx.restore();

      // Back face slightly duller.
      if (!front) {
        ctx.fillStyle = `rgba(${P.ink},0.14)`;
        ctx.beginPath(); ctx.ellipse(cx, cy, ex(r1), r1, 0, 0, TAU); ctx.fill();
      }

      // Grazing mirror flash — a blink, not a bleach.
      const flash = Math.exp(-((wf - 0.34) ** 2) / 0.012);
      if (flash > 0.05) {
        ctx.fillStyle = `rgba(255,253,240,${0.42 * flash})`;
        ctx.beginPath(); ctx.ellipse(cx, cy, ex(r0), r0, 0, 0, TAU); ctx.fill();
      }

      const tex = Texture.from(cv);
      tex.source.autoGenerateMipmaps = true; // crisp downscale to game size
      frames.push(tex);
    }
    this.metalFrames.set(metal, frames);
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
