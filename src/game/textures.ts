// game/textures.ts — procedural radial-gradient textures (glow / ring / backdrop /
// soft disc). Built on a 2D canvas → Texture.from, so they're portable across
// Pixi versions and need zero art assets. Cached by key.

import { Texture } from 'pixi.js';

const cache = new Map<string, Texture>();
const hex = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;

function canvas(size: number): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  return { cv, ctx };
}

/** Soft radial glow — bright center fading to transparent. */
export function glowTexture(color = 0xffe168, size = 256): Texture {
  const key = `glow:${color}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { cv, ctx } = canvas(size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `${hex(color)}ff`);
  g.addColorStop(0.35, `${hex(color)}aa`);
  g.addColorStop(1, `${hex(color)}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = Texture.from(cv);
  cache.set(key, tex);
  return tex;
}

/** Expanding ring (transparent center, bright band, soft edge). */
export function ringTexture(color = 0xffffff, size = 256): Texture {
  const key = `ring:${color}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { cv, ctx } = canvas(size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `${hex(color)}00`);
  g.addColorStop(0.62, `${hex(color)}00`);
  g.addColorStop(0.78, `${hex(color)}ff`);
  g.addColorStop(0.9, `${hex(color)}66`);
  g.addColorStop(1, `${hex(color)}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = Texture.from(cv);
  cache.set(key, tex);
  return tex;
}

/** Dark spotlight backdrop disc. */
export function backdropTexture(color = 0x06050a, size = 256): Texture {
  const key = `backdrop:${color}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { cv, ctx } = canvas(size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `${hex(color)}ff`);
  g.addColorStop(0.7, `${hex(color)}99`);
  g.addColorStop(1, `${hex(color)}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = Texture.from(cv);
  cache.set(key, tex);
  return tex;
}

/** Small soft disc used for coins / particles. */
export function discTexture(color = 0xffffff, size = 128): Texture {
  const key = `disc:${color}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { cv, ctx } = canvas(size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, `${hex(color)}ff`);
  g.addColorStop(0.7, `${hex(color)}ff`);
  g.addColorStop(1, `${hex(color)}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  const tex = Texture.from(cv);
  cache.set(key, tex);
  return tex;
}

export function clearTextureCache() {
  cache.clear();
}
