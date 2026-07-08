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
}

export function loadAssets(): SavedAssets {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SavedAssets;
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
