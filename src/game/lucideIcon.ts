// Render Lucide / Phosphor React icon components into Pixi Textures.
//
// Why not emoji? OS-rendered emoji vary across platforms, look mismatched in
// weight, and read as cartoonish at large sizes. Lucide / Phosphor give us
// monochrome vector glyphs we can colour-tint per theme — much closer to the
// visual language of real slot games without yet having custom atlas art.
//
// How: each icon component is React-rendered to an SVG string via
// react-dom/server, wrapped in a Blob URL, and loaded as a Pixi Texture.
// Results are cached by (icon name + colour + size) inside the caller's
// supplied cache so multiple symbol cells using the same icon share one
// texture. The cache is **PixiApp-owned** (not module-level) so destroyed
// textures from one PixiApp instance never leak into another.

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { ThemeIcon } from '@/engine/GameConfig';
import { Texture } from 'pixi.js';

export type LucideTextureCache = Map<string, Promise<Texture>>;

/** Create a fresh, empty cache. Each PixiApp instance owns its own and
 *  destroys the textures on teardown. */
export function createLucideTextureCache(): LucideTextureCache {
  return new Map();
}

/** Convert hex int (0xRRGGBB) → CSS hex string '#RRGGBB'. */
export function hexToCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

/** Rasterise an SVG string to an ImageBitmap at the given pixel size.
 *  Pixi.Assets.load() doesn't treat raw blob URLs as SVG (no file extension
 *  hint), so we go through a HTMLImageElement first — every browser knows
 *  how to render an SVG <img> source — then capture the result as a bitmap
 *  Pixi can wrap into a Texture directly. */
async function rasteriseSvg(svg: string, size: number): Promise<ImageBitmap> {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG <img> failed to load'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    // 2× resolution so the rasterised glyph stays crisp on retina displays.
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Build (or return cached) Pixi Texture for the given icon component at
 * the given colour and pixel size. Renders with Phosphor's `weight="fill"`
 * for solid filled glyphs (proper game-art weight); Lucide icons ignore
 * that prop and fall back to bolder strokes.
 */
export function loadLucideTexture(
  Icon: ThemeIcon,
  color: number,
  size: number,
  cache: LucideTextureCache,
): Promise<Texture> {
  const name = Icon.displayName ?? (Icon as { name?: string }).name ?? 'icon';
  const key = `${name}|${color.toString(16)}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const colorCss = hexToCss(color);
  const element = createElement(Icon, {
    color: colorCss,
    size,
    weight: 'fill',
    strokeWidth: 2.5,
    absoluteStrokeWidth: true,
  });
  const svgString = renderToStaticMarkup(element);
  const promise = rasteriseSvg(svgString, size).then(bitmap => Texture.from(bitmap));
  cache.set(key, promise);
  return promise;
}

/** Pre-load all icon textures for a set of (component, color) pairs into
 *  the supplied cache. Call this once before mounting PixiApp so the first
 *  reel paint already has its textures decoded — avoids a flash of
 *  un-iconned tiles. */
export async function preloadLucideTextures(
  entries: Array<{ id: number; icon: ThemeIcon; color: number }>,
  cache: LucideTextureCache,
  size = 96,
): Promise<Map<number, Texture>> {
  const out = new Map<number, Texture>();
  await Promise.all(
    entries.map(async ({ id, icon, color }) => {
      const tex = await loadLucideTexture(icon, color, size, cache);
      out.set(id, tex);
    }),
  );
  return out;
}

/** Destroy every cached texture and clear the cache. Call on PixiApp
 *  teardown so GPU memory is reclaimed. Subsequent calls are no-ops. */
export async function disposeLucideTextureCache(cache: LucideTextureCache): Promise<void> {
  const promises = Array.from(cache.values());
  cache.clear();
  for (const p of promises) {
    try {
      const tex = await p;
      tex.destroy(true);
    } catch {
      // If the rasterise failed, there's nothing to destroy.
    }
  }
}
