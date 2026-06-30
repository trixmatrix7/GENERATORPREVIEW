// game/banners.ts — Layer 7/9/10 render path: win screens (tiered), FS
// intro/outro transitions, flash banners, and the win counter text.

import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { gsap } from 'gsap';
import { spawnCoinBurst } from './particles';
import type { CanvasTheme } from '../config/canvasTheme';
import type { WinTier } from '../engine/types';

const display = (size: number, fill: number, weight: '800' | '900' = '900'): TextStyleOptions => ({
  fontFamily: 'Poppins, sans-serif',
  fontStyle: 'italic',
  fontWeight: weight,
  fontSize: size,
  fill,
  align: 'center',
  stroke: { color: 0x000000, width: Math.max(2, size * 0.06) },
});

export class Banners {
  private layer: Container;
  private burstLayer: Container;
  private w: number;
  private h: number;
  private theme: CanvasTheme;

  constructor(layer: Container, burstLayer: Container, w: number, h: number, theme: CanvasTheme) {
    this.layer = layer;
    this.burstLayer = burstLayer;
    this.w = w;
    this.h = h;
    this.theme = theme;
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  /** Short centred call-out (Near-Miss etc.). */
  flashBanner(text: string, color = this.theme.glow): Promise<void> {
    const t = new Text({ text, style: display(46, color, '800') });
    t.anchor.set(0.5);
    t.position.set(this.w / 2, this.h * 0.32);
    t.alpha = 0;
    t.scale.set(0.7);
    this.layer.addChild(t);
    return new Promise((resolve) => {
      gsap
        .timeline({ onComplete: () => { t.destroy(); resolve(); } })
        .to(t, { alpha: 1, duration: 0.18 })
        .to(t.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2)' }, '<')
        .to(t, { alpha: 1, duration: 0.5 })
        .to(t, { alpha: 0, duration: 0.25 });
    });
  }

  fsIntro(spins: number, multiplier: number): Promise<void> {
    const box = new Container();
    const bg = new Graphics();
    bg.roundRect(-260, -90, 520, 180, 24).fill({ color: 0x140f24, alpha: 0.92 });
    bg.roundRect(-260, -90, 520, 180, 24).stroke({ width: 3, color: this.theme.goldFrame, alpha: 0.9 });
    const title = new Text({ text: 'FREE SPINS', style: display(54, this.theme.goldFrame) });
    title.anchor.set(0.5);
    title.y = -28;
    const sub = new Text({ text: `${spins} spins  ·  ×${multiplier}`, style: display(30, 0xffffff, '800') });
    sub.anchor.set(0.5);
    sub.y = 34;
    box.addChild(bg, title, sub);
    box.position.set(this.w / 2, this.h / 2);
    box.alpha = 0;
    box.scale.set(0.6);
    this.layer.addChild(box);
    spawnCoinBurst(this.burstLayer, { x: this.w / 2, y: this.h / 2 }, { count: 50, color: this.theme.goldFrame });
    return new Promise((resolve) => {
      gsap
        .timeline({ onComplete: () => { box.destroy({ children: true }); resolve(); } })
        .to(box, { alpha: 1, duration: 0.2 })
        .to(box.scale, { x: 1, y: 1, duration: 0.4, ease: 'back.out(1.8)' }, '<')
        .to(box, { alpha: 1, duration: 0.7 })
        .to(box, { alpha: 0, duration: 0.3 });
    });
  }

  fsOutro(totalWinX: number): Promise<void> {
    return this.bannerBox('FEATURE WIN', `${totalWinX.toFixed(2)}× bet`, this.theme.goldFrame, 1.4);
  }

  winScreen(tier: WinTier, amountX: number, intensity = 1): Promise<void> {
    if (tier !== 'big' && tier !== 'mega') return Promise.resolve();
    const label = tier === 'mega' ? 'MEGA WIN' : 'BIG WIN';
    const color = tier === 'mega' ? 0xffd633 : this.theme.glow;
    const coins = tier === 'mega' ? 120 : 50;
    spawnCoinBurst(this.burstLayer, { x: this.w / 2, y: this.h / 2 }, { count: Math.round(coins * intensity), color, power: 380 });
    return this.bannerBox(label, `${amountX.toFixed(2)}× bet`, color, tier === 'mega' ? 3.4 : 2.2, intensity);
  }

  private bannerBox(title: string, sub: string, color: number, hold: number, intensity = 1): Promise<void> {
    const box = new Container();
    const t = new Text({ text: title, style: display(64 * (0.9 + 0.2 * intensity), color) });
    t.anchor.set(0.5);
    t.y = -36;
    const s = new Text({ text: sub, style: display(34, 0xffffff, '800') });
    s.anchor.set(0.5);
    s.y = 36;
    box.addChild(t, s);
    box.position.set(this.w / 2, this.h * 0.42);
    box.alpha = 0;
    box.scale.set(0.5);
    this.layer.addChild(box);
    return new Promise((resolve) => {
      gsap
        .timeline({ onComplete: () => { box.destroy({ children: true }); resolve(); } })
        .to(box, { alpha: 1, duration: 0.22 })
        .to(box.scale, { x: 1, y: 1, duration: 0.45, ease: 'back.out(1.8)' }, '<')
        .to(box, { alpha: 1, duration: hold })
        .to(box, { alpha: 0, duration: 0.35 });
    });
  }

  destroy(): void {
    this.layer.removeChildren();
  }
}
