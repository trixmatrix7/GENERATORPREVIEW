// Loads sprite-sheet atlases for each symbol from /assets/symbols/.
// Missing atlases resolve to null silently — the symbol falls back to
// programmatic tweens on the static placeholder tile.
//
// This decoupling is intentional: art can be dropped in per-symbol at any
// point after delivery, without touching rendering code.

import { Assets, Spritesheet } from 'pixi.js';
import { SYMBOL_ANIMATIONS } from '@/config/symbolAnimations';
import type { SymbolIdType } from '@/config/symbols';

export type SymbolAtlasMap = Partial<Record<SymbolIdType, Spritesheet>>;

const ATLAS_BASE = '/assets/symbols';

/** Probe one atlas URL without triggering a console-red 404. */
async function atlasExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Attempt to load all declared symbol atlases in parallel. */
export async function loadSymbolAtlases(): Promise<SymbolAtlasMap> {
  const result: SymbolAtlasMap = {};

  await Promise.all(
    Object.entries(SYMBOL_ANIMATIONS).map(async ([idStr, cfg]) => {
      if (!cfg.atlas) return;
      const url = `${ATLAS_BASE}/${cfg.atlas}.json`;
      if (!(await atlasExists(url))) return;
      try {
        const sheet = await Assets.load<Spritesheet>(url);
        if (sheet) {
          const id = Number(idStr) as SymbolIdType;
          result[id] = sheet;
        }
      } catch {
        // intentional: atlas present but malformed — fall back silently.
      }
    }),
  );

  return result;
}
