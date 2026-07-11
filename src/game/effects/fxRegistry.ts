// FX registry — aggregates all showcase packs. Each entry is a future
// generator registry entry (gridEffects / winPresentation); the preview's
// FX panel renders one test button per entry.

import type { FxEntry } from './fxTypes';
import { FX_PACK_WIN } from './fx/packWin';
import { FX_PACK_ANTICIPATION } from './fx/packAnticipation';
import { FX_PACK_AMBIENT } from './fx/packAmbient';
import { FX_PACK_SYMBOL } from './fx/packSymbol';

export const FX_REGISTRY: readonly FxEntry[] = [
  ...FX_PACK_WIN,
  ...FX_PACK_ANTICIPATION,
  ...FX_PACK_AMBIENT,
  ...FX_PACK_SYMBOL,
];

export function fxById(id: string): FxEntry | undefined {
  return FX_REGISTRY.find(e => e.id === id);
}
