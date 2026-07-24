// Persist Assets-tab swaps (symbols / background / frame) to localStorage so a
// user's uploads survive reloads and deploys — until they swap them again. The
// baked "Vice" pack (src/config/viceAssets.ts) is the fallback when nothing is
// saved. Data URLs can be large; saveAssets swallows quota errors.

const KEY = 'slot:assets';

export interface SavedAssets {
  symbols?: Record<number, string>;
  bg?: string | null;
  frame?: string | null;
  winParticle?: string | null;
  winBanner?: string | null;
  fsBg?: string | null;
  /** Expanding-wild column art — 512×2560 px on 5×5, 512×1484 px on 5×3. */
  expandingWild?: string | null;
  /** Sound-library picks: eventId → library OGG url. Applied after the
   *  game's default sound wiring; snapshotted into builds + exports. */
  sounds?: Record<string, string>;
  /** Params-drawer overrides (applyVisualParam id → value). Applied on
   *  every boot; snapshotted into builds/builtins (Noski: Save Build muss
   *  Parameter mitnehmen). */
  visualParams?: Record<string, string>;
}

/** Full-replace variant for preset apply: overwrites every known key. */
export function replaceAssets(next: SavedAssets): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      symbols: next.symbols ?? {},
      bg: next.bg ?? null,
      frame: next.frame ?? null,
      fsBg: next.fsBg ?? null,
      expandingWild: next.expandingWild ?? null,
      sounds: next.sounds ?? {},
      visualParams: next.visualParams ?? {},
    }));
  } catch { /* quota — skip */ }
}

/** Param-Ids des ENTFERNTEN Effekt-Systems (Features-Tab / FX). Alte Builds
 *  (auch vice:builds / vice:builtin:*) haben sie in visualParams gespeichert —
 *  beim Lesen rausfiltern, damit verseuchte Snapshots entschaerft sind
 *  (Noski: "das vermischt nur den Code im Preset"). */
const REMOVED_EFFECT_PARAMS = new Set([
  'waysLight', 'waysLightColor', 'waysLightSpeed', 'waysLightWidth',
  'stickyWild', 'stickyWildColor', 'stickyWildSpeed',
]);

export function loadAssets(): SavedAssets {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedAssets;
      if (parsed.visualParams) {
        parsed.visualParams = Object.fromEntries(
          Object.entries(parsed.visualParams).filter(([k]) => !REMOVED_EFFECT_PARAMS.has(k)),
        );
      }
      return parsed;
    }
  } catch {
    /* ignore malformed/absent */
  }
  return {};
}

export function saveAssets(patch: SavedAssets): void {
  try {
    const cur = loadAssets();
    localStorage.setItem(KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {
    /* quota exceeded (large data URLs) — skip persistence, keep session state */
  }
}
