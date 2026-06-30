// game/filters/customFilters.ts — fail-soft filter construction (the dev's
// `tryCreate` pattern). pixi-filters can throw on some GPU/pipeline states; never
// let a cosmetic filter crash the scene.

export function tryCreate<T>(make: () => T): T | null {
  try {
    return make();
  } catch (err) {
    console.warn('[filters] construction failed, skipping', err);
    return null;
  }
}

/** Lazily build a shared GlowFilter (hoisted — each instance costs GPU). */
let sharedGlow: unknown | null | undefined;
export async function sharedGlowFilter(): Promise<unknown | null> {
  if (sharedGlow !== undefined) return sharedGlow as unknown;
  try {
    const mod = await import('pixi-filters');
    const GlowFilter = (mod as { GlowFilter: new (o: object) => unknown }).GlowFilter;
    sharedGlow = tryCreate(() => new GlowFilter({ distance: 12, outerStrength: 2, innerStrength: 0, color: 0xffe168, quality: 0.3 }));
  } catch {
    sharedGlow = null;
  }
  return sharedGlow as unknown;
}
