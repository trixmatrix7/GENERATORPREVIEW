// registries/index.ts — the registry store. Default entries ship here; the
// studio overlays user-authored/tuned entries (from the code panel) by id.

import type { AnyEntry, RegistryName } from './types';
import { canvasLayers } from './entries/canvasLayers';
import { symbolAnimations } from './entries/symbolAnimations';
import { winPresentation } from './entries/winPresentation';
import { gridEffects } from './entries/gridEffects';
import { winScreenTiers } from './entries/winScreenTiers';
import { transitionAnimations } from './entries/transitionAnimations';
import { textAnimations } from './entries/textAnimations';
import { soundEvents } from './entries/soundEvents';
import { themes } from './entries/themes';
import { spinSystems } from './entries/spinSystems';

export * from './types';

export type Registries = Record<RegistryName, AnyEntry[]>;

export const DEFAULT_REGISTRIES: Registries = {
  canvasLayers,
  symbolAnimations,
  winPresentation,
  gridEffects,
  winScreenTiers,
  transitionAnimations,
  textAnimations,
  soundEvents,
  themes,
  spinSystems,
};

export const REGISTRY_NAMES: RegistryName[] = [
  'canvasLayers',
  'symbolAnimations',
  'winPresentation',
  'gridEffects',
  'winScreenTiers',
  'transitionAnimations',
  'textAnimations',
  'soundEvents',
  'themes',
  'spinSystems',
];

/** A user-authored entry override, keyed by registry + id. */
export interface CustomEntry {
  registry: RegistryName;
  entry: AnyEntry;
  /** raw code the user pasted (kept so it can be copied back out verbatim). */
  source?: string;
  createdAt: number;
  author?: string;
}

/** Overlay custom entries onto the defaults (by id; same id replaces). */
export function mergeRegistries(defaults: Registries, custom: CustomEntry[]): Registries {
  const out: Registries = {
    canvasLayers: [...defaults.canvasLayers],
    symbolAnimations: [...defaults.symbolAnimations],
    winPresentation: [...defaults.winPresentation],
    gridEffects: [...defaults.gridEffects],
    winScreenTiers: [...defaults.winScreenTiers],
    transitionAnimations: [...defaults.transitionAnimations],
    textAnimations: [...defaults.textAnimations],
    soundEvents: [...defaults.soundEvents],
    themes: [...defaults.themes],
    spinSystems: [...defaults.spinSystems],
  };
  for (const c of custom) {
    const arr = out[c.registry];
    if (!arr) continue;
    const idx = arr.findIndex((e) => e.id === c.entry.id);
    if (idx >= 0) arr[idx] = c.entry;
    else arr.push(c.entry);
  }
  return out;
}

export function getEntry<T extends AnyEntry = AnyEntry>(
  registries: Registries,
  name: RegistryName,
  id: string,
): T | undefined {
  return registries[name].find((e) => e.id === id) as T | undefined;
}

export function implementedEntries(registries: Registries, name: RegistryName): AnyEntry[] {
  return registries[name].filter((e) => e.implemented);
}
