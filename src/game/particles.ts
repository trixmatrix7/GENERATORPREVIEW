// game/particles.ts — lightweight coin-burst emitter (no @pixi/particle-emitter
// dependency; same idea, self-contained). Cosmetic jitter uses Math.random —
// allowed by the invariant (never touches an outcome path).

import { Container, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import { discTexture } from './textures';

export interface BurstOptions {
  count: number;
  color?: number;
  spread?: number; // px radius of launch
  power?: number; // px upward impulse
  intensity?: number;
}

export function spawnCoinBurst(
  layer: Container,
  center: { x: number; y: number },
  opts: BurstOptions,
): void {
  const { count, color = 0xffd24a, spread = 40, power = 320, intensity = 1 } = opts;
  for (let i = 0; i < count; i++) {
    const coin = new Sprite(discTexture(color));
    coin.anchor.set(0.5);
    const size = 10 + Math.random() * 14;
    coin.width = coin.height = size;
    coin.blendMode = 'add';
    coin.position.set(center.x + (Math.random() - 0.5) * spread, center.y + (Math.random() - 0.5) * spread);
    layer.addChild(coin);

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const speed = (power * (0.6 + Math.random() * 0.8)) * intensity;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const dur = 0.9 + Math.random() * 0.7;

    const state = { t: 0 };
    gsap.to(state, {
      t: 1,
      duration: dur,
      ease: 'none',
      onUpdate: () => {
        const t = state.t * dur;
        coin.x = center.x + vx * t;
        coin.y = center.y + vy * t + 0.5 * 900 * t * t; // gravity
        coin.rotation += 0.2;
      },
      onComplete: () => coin.destroy(),
    });
    gsap.to(coin, { alpha: 0, duration: dur * 0.5, delay: dur * 0.5 });
  }
}
