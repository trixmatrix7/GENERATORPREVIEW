// WinCelebration — layered MARQUEE win presentation with live tier escalation:
// BIG WIN → MEGA WIN → EPIC WIN → MAX WIN (max only when the game's max-win
// cap is hit). Built from the client's layered art set: four tier-word layers
// + a shared gold "WIN" layer + a number plate, all authored on one aligned
// 1920×1080 canvas — so the layers stack 1:1 and animate independently.
//
// The HERO is still one running number: a single counter tween drives the
// amount text, PROMOTES the tier-word layer live as the value crosses x-bet
// thresholds, and kicks the pulse. No coins/particles — the feeling comes
// from the layered slam-in, the continuous pulse (each layer on its own
// phase), punchy promotion transitions and a tiered trauma shake.
//
// Self-contained: ONE app.stage overlay (screen coords). play() resolves
// EXACTLY once on every path. cancel()/dispose() tear everything down.

import { Application, Assets, Container, Rectangle, Sprite, Text, TextStyle, Texture, Ticker } from 'pixi.js';
import { gsap } from 'gsap';

/** URLs for the six aligned marquee layers. */
export interface WinTierImageUrls {
  big: string; mega: string; epic: string; max: string;
  win: string; plate: string;
}

/** Everything tunable. */
export const WIN_CELEBRATION_CONFIG = {
  /** Below this x-bet ratio no marquee plays at all (small wins stay on-board). */
  minBigWin: 15,
  /** x-bet thresholds where the tier-word PROMOTES live during the count-up.
   *  MAX is not a band — it fires only when the win hit the max-win cap. */
  bands: { mega: 25, epic: 100 },
  words: ['BIG WIN', 'MEGA WIN', 'EPIC WIN', 'MAX WIN'], // fallback-only (no art loaded)
  countDur: [1.4, 2.0, 2.6, 3.2],
  holdDur: [0.7, 0.9, 1.1, 1.5],
  wordFontSize: [46, 52, 58, 64],   // fallback-only
  amountFontSize: [46, 50, 54, 58], // fallback-only
  shake: [0, 5, 8, 12],
  shakeRot: [0, 0.006, 0.01, 0.016],
  /** Overall marquee size multiplier (1 = full). */
  sizeMul: 0.48,
  /** Per-tier marquee scale step — each promotion GROWS the whole marquee
   *  (this is the visible difference between the stages). */
  tierScale: [1.0, 1.16, 1.34, 1.6],
  /** Continuous pulse strength (scale amplitude). */
  pulseAmp: 0.03,
};

export interface WinCelebrationParams {
  winAmount: bigint;
  wager: bigint;
  symbol: string;
  decimals: number;
  /** 0 BIG · 1 MEGA · 2 EPIC · 3 MAX (max-win cap hit). */
  tier: number;
  centre: { x: number; y: number };
  origins: Array<{ x: number; y: number }>;
  /** Slot/reel-frame bounds in SCREEN coords (kept for sizing context). */
  bounds?: { left: number; right: number; bottom: number };
  reduced: boolean;
}

// ── canvas geometry of the layered art (fractions of the 1080p canvas) ──────
// Measured from the alpha bboxes; every layer is authored on the same canvas.
const ART_H = 1080;
const TIER_KEYS = ['big', 'mega', 'epic', 'max'] as const;
type TierKey = typeof TIER_KEYS[number];
/** Content-centre Y per tier word (anchor pivot → pulses around the word).
 *  Re-measured 2026-07-10 for the v2 art set (chrome tier words + gold WIN +
 *  chrome-rimmed price plate; layers pre-aligned on the same 1080p canvas). */
const TIER_CY: Record<TierKey, number> = { big: 0.2273, mega: 0.2463, epic: 0.2495, max: 0.2269 };
const WIN_CY = 0.4875;
const PLATE_CY = 0.7681;
const PLATE_H = 0.374; // plate bbox h404/1080
/** Union content bbox height (fraction of canvas) — drives on-screen sizing. */
const CONTENT_FRAC = 0.911; // y[48..1031] across tiers
/** Union content centre (fraction of canvas height) — the marquee pivots here
 *  so the whole stack is EXACTLY centred on the given centre point. */
const CONTENT_CY = (0.0444 + 0.9546) / 2;

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
  private resolveActive: (() => void) | null = null;
  /** Standalone tweens (promotion punches) that live outside this.tl. */
  private extraTweens: gsap.core.Tween[] = [];

  /** The six marquee layer textures (null until setTierImages loads them). */
  private tierTex: Record<TierKey, Texture> | null = null;
  private winTex: Texture | null = null;
  private plateTex: Texture | null = null;
  /** Fallback foil wordmarks (used only when no art is loaded). */
  private wordCache = new Map<string, Texture>();

  /** Coin-rain overlay — a spritesheet layer rendered BEHIND the marquee.
   *  Frames sliced from one or more sheets (row-major, sheets in order). */
  private coinFrames: Texture[] | null = null;
  private coinSheets: Texture[] | null = null;
  private coinFps = 30;
  private coinSprite: Sprite | null = null;
  private coinIdx = 0;
  private coinAccum = 0;

  // per-run state (read by the ticker)
  private trauma = 0;
  private traumaMax = 0;
  private traumaRot = 0;
  /** One-shot pulse impulse (impact / promotion / end flare), decays fast. */
  private pulseKick = 0;

  constructor(app: Application, opts: { accent: number; coinColors: number[]; fontFamily?: string }) {
    this.app = app;
    this.font = opts.fontFamily ?? "'Poppins', ui-sans-serif, sans-serif";
  }

  /** Load the six layered marquee images (pass null to clear → text fallback). */
  async setTierImages(urls: WinTierImageUrls | null): Promise<void> {
    this.disposeTierTextures();
    if (!urls) return;
    try {
      const [big, mega, epic, max, win, plate] = await Promise.all([
        Assets.load<Texture>(urls.big), Assets.load<Texture>(urls.mega),
        Assets.load<Texture>(urls.epic), Assets.load<Texture>(urls.max),
        Assets.load<Texture>(urls.win), Assets.load<Texture>(urls.plate),
      ]);
      this.tierTex = { big, mega, epic, max };
      this.winTex = win;
      this.plateTex = plate;
    } catch (err) {
      console.warn('[WinCelebration] tier images failed to load:', err);
      this.disposeTierTextures();
    }
  }

  /** Load the coin-rain spritesheets (chroma-keyed, alpha). The rain plays
   *  behind the marquee on every celebration. Pass null to clear. */
  async setCoinRain(urls: string[] | null, cols: number, rows: number, count: number, fps = 30): Promise<void> {
    this.disposeCoinTextures();
    if (!urls || urls.length === 0) return;
    try {
      const sheets: Texture[] = [];
      for (const u of urls) sheets.push(await Assets.load<Texture>(u));
      const fw = sheets[0].width / cols, fh = sheets[0].height / rows;
      const perSheet = cols * rows;
      const frames: Texture[] = [];
      for (let i = 0; i < count; i++) {
        const sheet = sheets[Math.floor(i / perSheet)];
        if (!sheet) break;
        const local = i % perSheet;
        frames.push(new Texture({
          source: sheet.source,
          frame: new Rectangle((local % cols) * fw, Math.floor(local / cols) * fh, fw, fh),
        }));
      }
      this.coinSheets = sheets;
      this.coinFrames = frames;
      this.coinFps = Math.max(1, fps);
    } catch (err) {
      console.warn('[WinCelebration] coin rain failed to load:', err);
      this.disposeCoinTextures();
    }
  }

  private disposeCoinTextures(): void {
    this.coinSprite = null; // owned by the (already destroyed) overlay
    if (this.coinFrames) { for (const f of this.coinFrames) { try { f.destroy(false); } catch { /* torn down */ } } this.coinFrames = null; }
    if (this.coinSheets) { for (const s of this.coinSheets) { try { s.destroy(true); } catch { /* torn down */ } } this.coinSheets = null; }
  }

  play(p: WinCelebrationParams): Promise<void> {
    this.cancel();

    const sw = this.app.screen.width, sh = this.app.screen.height;
    const C = WIN_CELEBRATION_CONFIG;
    const finalTier = Math.max(0, Math.min(3, p.tier));
    const finalVal = Number(p.winAmount) / Math.pow(10, p.decimals);
    const wagerVal = p.wager > 0n ? Number(p.wager) / Math.pow(10, p.decimals) : finalVal || 1;
    // Live-promotion thresholds in VALUE space (mega/epic only — MAX never
    // promotes mid-count: EPIC holds until the number has fully counted to the
    // cap, THEN the MAX switch fires).
    const th = [0, wagerVal * C.bands.mega, wagerVal * C.bands.epic];

    const overlay = new Container();
    overlay.zIndex = 10000; overlay.eventMode = 'none';
    this.overlay = overlay;
    this.app.stage.addChild(overlay);
    // Impact shake starts modest (small floor so even a BIG stamp thuds) —
    // the PROMOTIONS escalate it to each new tier's strength.
    this.traumaMax = Math.max(3, C.shake[Math.min(finalTier, 1)]);
    this.traumaRot = Math.max(0.004, C.shakeRot[Math.min(finalTier, 1)]);

    // Coin rain — added BEFORE the marquee so it renders BEHIND the win screen
    // (the win screen itself is untouched). Cover-fit to the canvas; the tick
    // below cycles the frames at coinFps, looping for the whole celebration.
    if (this.coinFrames && this.coinFrames.length > 0 && !p.reduced) {
      const t0 = this.coinFrames[0];
      const rain = new Sprite(t0);
      rain.anchor.set(0.5);
      rain.position.set(sw / 2, sh / 2);
      rain.scale.set(Math.max(sw / t0.width, sh / t0.height));
      rain.eventMode = 'none';
      rain.alpha = 0;
      overlay.addChild(rain);
      this.coinSprite = rain;
      this.coinIdx = 0;
      this.coinAccum = 0;
      gsap.to(rain, { alpha: 1, duration: 0.35, ease: 'power1.out' });
    }

    const marquee = new Container();
    marquee.position.set(p.centre.x, p.centre.y);
    overlay.addChild(marquee);

    const hasArt = !!(this.tierTex && this.winTex && this.plateTex);
    let curTier = 0;
    /** Base marquee scale (tier 0); promotions grow it by C.tierScale[n]. */
    let baseMsc = 1;

    // ── build the layers ──────────────────────────────────────────────────
    let tierSpr: Sprite | null = null;
    let winSpr: Sprite | null = null;
    let plateSpr: Sprite | null = null;
    let fallbackWord: Sprite | null = null;
    let amount: Text;

    const setTierLayer = (n: number) => {
      const key = TIER_KEYS[n];
      if (tierSpr && this.tierTex) {
        tierSpr.texture = this.tierTex[key];
        // pivot on the word's own centre so pulses/punches stay centred
        tierSpr.anchor.set(0.5, TIER_CY[key]);
        tierSpr.y = (TIER_CY[key] - 0.5) * ART_H;
      } else if (fallbackWord) {
        fallbackWord.texture = this.getWordTex(n, 1);
      }
    };

    if (hasArt) {
      // Scale so the art's content height ≈ 55% of the short screen edge,
      // and pivot on the content's centre so the stack sits dead-centre.
      baseMsc = (Math.min(sw, sh) * 0.55 * C.sizeMul) / (CONTENT_FRAC * ART_H);
      marquee.scale.set(baseMsc * C.tierScale[0]);
      marquee.pivot.set(0, (CONTENT_CY - 0.5) * ART_H);

      plateSpr = new Sprite(this.plateTex!);
      plateSpr.anchor.set(0.5, PLATE_CY);
      plateSpr.y = (PLATE_CY - 0.5) * ART_H;
      winSpr = new Sprite(this.winTex!);
      winSpr.anchor.set(0.5, WIN_CY);
      winSpr.y = (WIN_CY - 0.5) * ART_H;
      tierSpr = new Sprite(this.tierTex!.big);
      marquee.addChild(plateSpr, winSpr, tierSpr);
      setTierLayer(0);

      // Count-up text INSIDE the plate (marquee-local canvas units).
      amount = new Text({
        text: '', style: new TextStyle({
          fontFamily: this.font, fontSize: Math.round(PLATE_H * ART_H * 0.40), fontWeight: '800',
          fontStyle: 'italic', letterSpacing: 2, fill: 0xffe9a0,
          stroke: { color: 0x1a0e02, width: 10 },
          dropShadow: { color: 0x000000, blur: 8, distance: 0, alpha: 0.55 },
        }),
      });
      amount.anchor.set(0.5);
      amount.position.set(0, (PLATE_CY - 0.5) * ART_H);
      marquee.addChild(amount);
    } else {
      // Fallback (no art loaded): baked foil word + amount text below.
      const s = Math.max(0.6, Math.min(2, Math.min(sw, sh) / 720)) * C.sizeMul;
      fallbackWord = new Sprite(this.getWordTex(0, s));
      fallbackWord.anchor.set(0.5); fallbackWord.y = -C.amountFontSize[finalTier] * s * 0.8;
      marquee.addChild(fallbackWord);
      amount = new Text({
        text: '', style: new TextStyle({
          fontFamily: this.font, fontSize: Math.round(C.amountFontSize[finalTier] * s), fontWeight: '800',
          fontStyle: 'italic', letterSpacing: 1, fill: 0xffffff,
          stroke: { color: 0x1a0e02, width: Math.max(4, 5 * s) },
        }),
      });
      amount.anchor.set(0.5); amount.y = C.amountFontSize[finalTier] * s * 0.6;
      marquee.addChild(amount);
    }

    // start hidden — the timeline slams them in
    if (plateSpr) plateSpr.alpha = 0;
    if (winSpr) winSpr.alpha = 0;
    if (tierSpr) tierSpr.alpha = 0;
    if (fallbackWord) fallbackWord.alpha = 0;
    amount.alpha = 0;

    // ── ticker: continuous PULSE (per-layer phases) + trauma shake ────────
    let elapsed = 0;
    const amp = p.reduced ? 0 : C.pulseAmp;
    const tick = (t: Ticker) => {
      if (!this.overlay) return;
      const dt = Math.min(0.05, t.deltaMS / 1000);
      elapsed += dt;
      // coin rain frame advance (looping, behind the marquee)
      if (this.coinSprite && this.coinFrames) {
        this.coinAccum += dt;
        const spf = 1 / this.coinFps;
        while (this.coinAccum >= spf) { this.coinIdx = (this.coinIdx + 1) % this.coinFrames.length; this.coinAccum -= spf; }
        this.coinSprite.texture = this.coinFrames[this.coinIdx];
      }
      this.pulseKick = Math.max(0, this.pulseKick - this.pulseKick * dt * 6);
      const k = this.pulseKick;
      if (tierSpr) {
        const f = 1 + Math.sin(elapsed * 2.6) * amp + k;
        tierSpr.scale.set(f);
        tierSpr.rotation = Math.sin(elapsed * 1.3) * 0.014;
      }
      if (winSpr) winSpr.scale.set(1 + Math.sin(elapsed * 2.6 + 1.1) * amp * 0.8 + k * 0.7);
      if (plateSpr) plateSpr.scale.set(1 + Math.sin(elapsed * 2.2 + 0.5) * amp * 0.4 + k * 0.4);
      if (fallbackWord) fallbackWord.scale.set(1 + Math.sin(elapsed * 2.6) * amp + k);
      // At MAX the final amount itself pulses hard ("der Betrag pulsiert").
      if (curTier === 3) amount.scale.set(1 + Math.sin(elapsed * 3.4) * 0.055 + k * 0.7);
      else amount.scale.set(1 + k * 0.25);
      // trauma screenshake (translation + a touch of rotation = "force")
      if (this.trauma > 0) {
        const tr = this.trauma * this.trauma;
        this.overlay.x = this.traumaMax * tr * (Math.random() * 2 - 1);
        this.overlay.y = this.traumaMax * tr * (Math.random() * 2 - 1);
        this.overlay.rotation = this.traumaRot * tr * (Math.random() * 2 - 1);
        this.trauma = Math.max(0, this.trauma - dt * 1.6);
        if (this.trauma === 0) { this.overlay.x = 0; this.overlay.y = 0; this.overlay.rotation = 0; }
      }
    };
    this.tickCb = tick;
    this.app.ticker.add(tick);

    // ── reduced motion: static reveal, hold, fade ─────────────────────────
    if (p.reduced) {
      return new Promise<void>((resolve) => {
        this.resolveActive = resolve;
        setTierLayer(finalTier); curTier = finalTier;
        for (const sp of [plateSpr, winSpr, tierSpr, fallbackWord]) if (sp) sp.alpha = 1;
        amount.text = formatAmount(p.winAmount, p.decimals);
        amount.alpha = 1;
        const tl = gsap.timeline({ onComplete: () => this.finish() });
        this.tl = tl;
        tl.to({}, { duration: 1.2 });
        tl.to(marquee, { alpha: 0, duration: 0.3, ease: 'power1.in' });
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
        // HARD, impulsive switch:
        // 1) an additive flash-clone of the OLD word bursts outward…
        if (tierSpr) {
          const flash = new Sprite(tierSpr.texture);
          flash.anchor.set(tierSpr.anchor.x, tierSpr.anchor.y);
          flash.position.copyFrom(tierSpr.position);
          flash.blendMode = 'add';
          marquee.addChild(flash);
          this.extraTweens.push(
            gsap.to(flash, { alpha: 0, duration: 0.28, ease: 'power2.out', onComplete: () => flash.destroy() }),
            gsap.fromTo(flash.scale, { x: 1, y: 1 }, { x: 1.5, y: 1.5, duration: 0.28, ease: 'power2.out' }),
          );
        }
        // 2) …the NEW word snaps in with a huge kick (ticker pulse decays it)…
        setTierLayer(n);
        this.pulseKick = 0.5;
        // 3) …and the WHOLE marquee steps UP to the new tier's size with an
        //    overshoot — each stage is visibly BIGGER than the last.
        const target = baseMsc * C.tierScale[n];
        this.extraTweens.push(
          gsap.to(marquee.scale, { x: target, y: target, duration: 0.42, ease: 'back.out(2.8)', overwrite: 'auto' }),
        );
        // 4) shake escalates to the NEW tier's strength.
        this.traumaMax = C.shake[n]; this.traumaRot = C.shakeRot[n];
        this.trauma = 1;
      };

      // ENTRANCE — a heavy STAMP, not a fade: the tier word appears huge and
      // DROPS into the board (accelerating = weight), bursts an additive flash
      // on landing with a kick + shake, then WIN snaps in and the plate+number
      // rise up underneath.
      const baseScale = marquee.scale.x;
      const stampLand = 0.26;
      if (tierSpr) {
        tl.to(tierSpr, { alpha: 1, duration: 0.05 }, 0);
        tl.fromTo(marquee.scale, { x: baseScale * 2.3, y: baseScale * 2.3 },
          { x: baseScale, y: baseScale, duration: stampLand, ease: 'power3.in' }, 0);
        tl.fromTo(marquee, { rotation: -0.045 }, { rotation: 0, duration: 0.34, ease: 'back.out(3)' }, 0.06);
        tl.call(() => {
          if (!this.overlay || !tierSpr) return;
          const flash = new Sprite(tierSpr.texture);
          flash.anchor.set(tierSpr.anchor.x, tierSpr.anchor.y);
          flash.position.copyFrom(tierSpr.position);
          flash.blendMode = 'add';
          marquee.addChild(flash);
          this.extraTweens.push(
            gsap.to(flash, { alpha: 0, duration: 0.3, ease: 'power2.out', onComplete: () => flash.destroy() }),
            gsap.fromTo(flash.scale, { x: 1, y: 1 }, { x: 1.4, y: 1.4, duration: 0.3, ease: 'power2.out' }),
          );
          this.pulseKick = 0.4;
          this.trauma = 1;
        }, undefined, stampLand);
      }
      if (winSpr) tl.to(winSpr, { alpha: 1, duration: 0.08, ease: 'power2.out' }, stampLand + 0.04);
      if (plateSpr) {
        tl.to(plateSpr, { alpha: 1, duration: 0.16, ease: 'power2.out' }, stampLand + 0.12);
        tl.fromTo(plateSpr, { y: (PLATE_CY - 0.5) * ART_H + 70 },
          { y: (PLATE_CY - 0.5) * ART_H, duration: 0.32, ease: 'power3.out' }, stampLand + 0.12);
      }
      if (fallbackWord) {
        tl.to(fallbackWord, { alpha: 1, duration: 0.08 }, 0);
        tl.fromTo(marquee.scale, { x: 2.0, y: 2.0 }, { x: 1, y: 1, duration: stampLand, ease: 'power3.in' }, 0);
        tl.call(() => { this.pulseKick = 0.4; this.trauma = 1; }, undefined, stampLand);
      }

      // AMOUNT reveal + count-up: one counter drives the number AND the
      // live tier promotions (the escalation). Number only — no token symbol.
      amount.text = '0.00';
      tl.to(amount, { alpha: 1, duration: 0.14, ease: 'power2.out' }, stampLand + 0.18);
      if (plateSpr) {
        tl.fromTo(amount, { y: (PLATE_CY - 0.5) * ART_H + 70 },
          { y: (PLATE_CY - 0.5) * ART_H, duration: 0.32, ease: 'power3.out' }, stampLand + 0.14);
      }
      const dp = p.decimals > 4 ? 2 : p.decimals;
      const counter = { val: 0 };
      const countAt = stampLand + 0.30;
      tl.to(counter, {
        val: finalVal, duration: C.countDur[finalTier], ease: 'power1.inOut',
        onUpdate: () => {
          if (!this.overlay) return;
          amount.text = counter.val.toFixed(dp);
          // Live promotion caps at EPIC — MAX only fires after the count.
          const liveMax = Math.min(finalTier, 2);
          if (curTier < liveMax) {
            for (let n = liveMax; n > curTier; n--) {
              if (counter.val >= th[n]) { promoteTier(n); break; }
            }
          }
        },
        onComplete: () => { if (this.overlay) amount.text = formatAmount(p.winAmount, p.decimals); },
      }, countAt);

      // END FLARE — and for a MAX win the SWITCH happens only NOW: EPIC held
      // until the number fully counted to the cap; then MAX slams in over the
      // final amount (which keeps pulsing — see the ticker).
      const at = countAt + C.countDur[finalTier];
      tl.call(() => { this.pulseKick = 0.18; if (finalTier >= 2) this.trauma = 0.8; }, undefined, at);
      const maxBeat = finalTier === 3 ? 0.18 : 0;
      if (finalTier === 3) tl.call(() => promoteTier(3), undefined, at + maxBeat);

      // HOLD, then EXIT: slight scale-drift out while fading.
      const exitAt = at + maxBeat + C.holdDur[finalTier];
      tl.to(marquee, { alpha: 0, duration: 0.38, ease: 'power1.in' }, exitAt);
      // Function-based values: evaluated when the tween STARTS, so the drift
      // grows from wherever the promotions left the marquee (not build-time).
      tl.to(marquee.scale, {
        x: () => marquee.scale.x * 1.05, y: () => marquee.scale.y * 1.05,
        duration: 0.38, ease: 'power1.in',
      }, exitAt);
    });
  }

  cancel(): void { this.finish(); }

  dispose(): void {
    this.finish();
    this.disposeTierTextures();
    this.disposeCoinTextures();
    for (const t of this.wordCache.values()) t.destroy(true);
    this.wordCache.clear();
  }

  // ── internals ──
  private disposeTierTextures(): void {
    if (this.tierTex) for (const t of Object.values(this.tierTex)) { try { t.destroy(true); } catch { /* torn down */ } }
    this.tierTex = null;
    this.winTex?.destroy(true); this.winTex = null;
    this.plateTex?.destroy(true); this.plateTex = null;
  }

  private finish(): void {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    for (const t of this.extraTweens) t.kill();
    this.extraTweens.length = 0;
    if (this.tickCb) { this.app.ticker.remove(this.tickCb); this.tickCb = null; }
    this.trauma = 0; this.pulseKick = 0;
    this.coinSprite = null; // owned by the overlay — destroyed with it below
    if (this.overlay) { try { this.overlay.destroy({ children: true }); } catch { /* torn down */ } this.overlay = null; }
    const r = this.resolveActive; this.resolveActive = null;
    if (r) r();
  }

  /** Fallback foil wordmark (only used when the art set isn't loaded). */
  private getWordTex(tier: number, s: number): Texture {
    const C = WIN_CELEBRATION_CONFIG;
    const fs = Math.round(C.wordFontSize[tier] * s * 1.15);
    const key = `${tier}:${fs}`;
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
    const glow = ['#4da3ff', '#ff4da3', '#4dff88', '#ff4d4d'][tier] ?? '#ffd24a';
    ctx.save();
    ctx.shadowColor = glow; ctx.shadowBlur = fs * 0.35;
    ctx.fillStyle = '#ffffff'; ctx.fillText(text, cx, cy);
    ctx.restore();
    ctx.lineWidth = fs * 0.14; ctx.strokeStyle = '#140d04'; ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, cy + fs * 0.02);
    const grad = ctx.createLinearGradient(0, cy - fs * 0.6, 0, cy + fs * 0.6);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, '#ffe9a0'); grad.addColorStop(1, '#c8891a');
    ctx.fillStyle = grad; ctx.fillText(text, cx, cy);
    const tex = Texture.from(cv);
    this.wordCache.set(key, tex);
    return tex;
  }
}
