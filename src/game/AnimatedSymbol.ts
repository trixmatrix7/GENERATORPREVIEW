// game/AnimatedSymbol.ts — Layer 4 render path. One cell symbol with the 4
// states: idle-glow-pulse, landing-squash, win-juice, win-reset. Positioned by
// ReelSet at the cell center (anchor-resolved); all motion is on an inner
// container so the world position stays put.

import { Container, Graphics, Sprite, Text, type TextStyleOptions } from 'pixi.js';
import { gsap } from 'gsap';
import { glowTexture, ringTexture, backdropTexture } from './textures';
import { baseScaleOf, popFactorOf } from '../config/symbols';
import type { CanvasTheme } from '../config/canvasTheme';
import type { ThemeSymbol } from '../registries/types';
import type { SymbolStateConfig } from '../registries/presets';
import type { ParamValues } from '../config/adjustableParams';

export interface SymbolRenderCtx {
  cellW: number;
  cellH: number;
  theme: CanvasTheme;
  symbolMeta: Map<number, ThemeSymbol>;
}

export class AnimatedSymbol {
  readonly view: Container; // world-positioned by ReelSet
  private inner: Container; // animated (scale / rotation / y)
  private backdrop: Sprite;
  private glow: Sprite;
  private flash: Sprite;
  private tile: Graphics;
  private label: Text;
  private ctx: SymbolRenderCtx;
  private idle?: gsap.core.Tween;
  private tweens: gsap.core.Animation[] = [];

  symbolId = -1;
  reel: number;
  row: number;
  private baseScale = 1;

  constructor(ctx: SymbolRenderCtx, reel: number, row: number) {
    this.ctx = ctx;
    this.reel = reel;
    this.row = row;
    this.view = new Container();
    this.inner = new Container();
    this.view.addChild(this.inner);

    const g = Math.max(ctx.cellW, ctx.cellH) * 1.7;
    this.backdrop = new Sprite(backdropTexture(ctx.theme.spotlightBackdrop));
    this.backdrop.anchor.set(0.5);
    this.backdrop.width = this.backdrop.height = g;
    this.backdrop.alpha = 0;

    this.glow = new Sprite(glowTexture(ctx.theme.glow));
    this.glow.anchor.set(0.5);
    this.glow.width = this.glow.height = g;
    this.glow.blendMode = 'add';
    this.glow.alpha = 0;

    this.tile = new Graphics();
    this.label = new Text({ text: '', style: this.labelStyle() });
    this.label.anchor.set(0.5);

    this.flash = new Sprite(glowTexture(ctx.theme.warmFlash));
    this.flash.anchor.set(0.5);
    this.flash.width = this.flash.height = ctx.cellW * 1.15;
    this.flash.blendMode = 'add';
    this.flash.alpha = 0;

    this.inner.addChild(this.backdrop, this.glow, this.tile, this.label, this.flash);
  }

  private labelStyle(): TextStyleOptions {
    return {
      fontFamily: 'Poppins, sans-serif',
      fontWeight: '800',
      fontStyle: 'italic',
      fontSize: Math.round(this.ctx.cellH * 0.3),
      fill: this.ctx.theme.text,
      align: 'center',
    };
  }

  setSymbol(id: number): void {
    this.symbolId = id;
    this.baseScale = baseScaleOf(id);
    const meta = this.ctx.symbolMeta.get(id);
    const color = meta?.placeholderColor ?? 0x444444;
    const w = this.ctx.cellW * 0.82;
    const h = this.ctx.cellH * 0.82;
    const r = Math.min(w, h) * 0.22;

    this.tile.clear();
    this.tile.roundRect(-w / 2, -h / 2, w, h, r);
    this.tile.fill({ color: this.ctx.theme.symbolTile, alpha: 1 });
    this.tile.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, r * 0.8);
    this.tile.fill({ color, alpha: 0.22 });
    this.tile.roundRect(-w / 2, -h / 2, w, h, r);
    this.tile.stroke({ width: 3, color, alpha: 0.95 });

    this.label.text = meta?.label ?? String(id);
    this.label.style.fill = color;

    this.inner.scale.set(this.baseScale);
    this.inner.rotation = 0;
    this.inner.y = 0;
    this.inner.alpha = 1;
    this.glow.alpha = 0;
    this.backdrop.alpha = 0;
    this.flash.alpha = 0;
  }

  private track<T extends gsap.core.Animation>(t: T): T {
    this.tweens.push(t);
    return t;
  }

  // ── State 2: landing squash & stretch ──
  playLanding(cfg: SymbolStateConfig, params: ParamValues): Promise<void> {
    if (!cfg.enabled) return Promise.resolve();
    const b = this.baseScale;
    const amt = 0.18 * params.landingSquash * cfg.intensity;
    const ds = cfg.durationScale;
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      this.inner.scale.set(b * (1 + amt), b * (1 - amt));
      this.inner.y = this.ctx.cellH * 0.06 * params.landingSquash;
      tl.to(this.inner.scale, { x: b * (1 - amt * 0.6), y: b * (1 + amt * 0.6), duration: 0.07 * ds, ease: 'power1.out' })
        .to(this.inner, { y: 0, duration: 0.095 * ds, ease: 'power1.out' }, '<')
        .to(this.inner.scale, { x: b, y: b, duration: 0.16 * ds, ease: cfg.easing });
      this.track(tl);
    });
  }

  // ── State 3: win juice (dip → pop → glow/flash/ring/wobble → settle → hold → reset) ──
  playWin(cfg: SymbolStateConfig, params: ParamValues): Promise<void> {
    if (!cfg.enabled) return Promise.resolve();
    const b = this.baseScale;
    const pop = b * popFactorOf(this.symbolId) * params.winPopIntensity * cfg.intensity;
    const glowMax = Math.min(1, 0.85 * params.glowIntensity);
    const ds = cfg.durationScale;
    this.spawnRing(params);
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      // dip
      tl.to(this.inner.scale, { x: b * 0.88, y: b * 0.88, duration: 0.085 * ds, ease: 'power2.out' });
      // pop + juice
      tl.to(this.inner.scale, { x: pop, y: pop, duration: 0.21 * ds, ease: cfg.easing });
      tl.to(this.glow, { alpha: glowMax, duration: 0.15 * ds }, '<');
      tl.to(this.backdrop, { alpha: 0.5, duration: 0.13 * ds }, '<');
      tl.fromTo(this.flash, { alpha: 0.49 }, { alpha: 0, duration: 0.18 * ds }, '<');
      tl.to(this.inner, { rotation: 0.05, duration: 0.09 * ds, ease: 'sine.inOut' }, '<');
      tl.to(this.inner, { rotation: -0.03, duration: 0.1 * ds, ease: 'sine.inOut' });
      tl.to(this.inner, { rotation: 0, duration: 0.095 * ds, ease: 'sine.inOut' });
      // settle
      tl.to(this.inner.scale, { x: b * 1.08, y: b * 1.08, duration: 0.12 * ds, ease: 'power2.out' }, '<');
      // hold
      tl.to({}, { duration: 0.24 });
      // reset
      tl.to(this.inner.scale, { x: b, y: b, duration: 0.17 * ds, ease: 'power2.out' });
      tl.to([this.glow, this.backdrop], { alpha: 0, duration: 0.17 * ds }, '<');
      this.track(tl);
    });
  }

  // ── State 4: explicit reset (for externally-orchestrated holds) ──
  resetWin(cfg: SymbolStateConfig): void {
    const b = this.baseScale;
    this.track(gsap.to(this.inner.scale, { x: b, y: b, duration: 0.17 * cfg.durationScale, ease: cfg.easing }));
    this.track(gsap.to([this.glow, this.backdrop, this.flash], { alpha: 0, duration: 0.17 }));
    this.track(gsap.to(this.inner, { rotation: 0, duration: 0.12 }));
  }

  private spawnRing(params: ParamValues): void {
    const ring = new Sprite(ringTexture(this.ctx.theme.glow));
    ring.anchor.set(0.5);
    ring.blendMode = 'add';
    const start = this.ctx.cellW * 0.85;
    ring.width = ring.height = start;
    ring.alpha = 0.66;
    this.inner.addChildAt(ring, 1);
    const end = this.ctx.cellW * params.shockwaveScale;
    this.track(
      gsap.to(ring, {
        width: end,
        height: end,
        alpha: 0,
        duration: 0.33,
        ease: 'power2.out',
        onComplete: () => ring.destroy(),
      }),
    );
  }

  // ── State 1: idle glow pulse (looping anticipation breathing) ──
  startIdlePulse(cfg: SymbolStateConfig, params: ParamValues): void {
    if (!cfg.enabled || this.idle) return;
    const b = this.baseScale;
    const speed = params.idlePulseSpeed;
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(this.inner.scale, { x: b * 1.12, y: b * 1.12, duration: (0.34 / speed) * cfg.durationScale, ease: cfg.easing }, 0);
    tl.to(this.glow, { alpha: 0.85 * params.glowIntensity, duration: (0.34 / speed) * cfg.durationScale, ease: cfg.easing }, 0);
    tl.to(this.backdrop, { alpha: 0.5, duration: (0.34 / speed) * cfg.durationScale, ease: cfg.easing }, 0);
    this.idle = tl as unknown as gsap.core.Tween;
  }

  stopIdlePulse(): void {
    if (this.idle) {
      this.idle.kill();
      this.idle = undefined;
    }
    const b = this.baseScale;
    this.track(gsap.to(this.inner.scale, { x: b, y: b, duration: 0.2, ease: 'power2.out' }));
    this.track(gsap.to([this.glow, this.backdrop], { alpha: 0, duration: 0.2 }));
  }

  killTweens(): void {
    this.idle?.kill();
    this.idle = undefined;
    for (const t of this.tweens) t.kill();
    this.tweens = [];
  }

  destroy(): void {
    this.killTweens();
    this.view.destroy({ children: true });
  }
}
