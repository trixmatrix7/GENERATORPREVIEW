// registries/presets.ts — Animation Presets. A preset is the central tunable
// config the studio switches between: adjustable-param overrides + per-state
// config for the 4 symbol states + effect toggles. Either person can add custom
// presets (persisted) and copy the resulting entries into the real generator.

import type { SymbolState } from './types';
import type { ParamValues } from '../config/adjustableParams';
import { defaultParamValues } from '../config/adjustableParams';

export interface SymbolStateConfig {
  enabled: boolean;
  easing: string; // gsap ease name
  durationScale: number; // × the entry's base duration
  intensity: number; // × the state's strength (pop/glow/squash)
}

export interface EffectToggles {
  policeLights: boolean;
  scatterOrbit: boolean;
  sweatColumns: boolean;
  shockwave: boolean;
  winScreens: boolean;
  ambientSiren: boolean;
}

export interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  author?: string;
  builtIn?: boolean;
  params: Partial<ParamValues>;
  states: Record<SymbolState, SymbolStateConfig>;
  effects: EffectToggles;
}

const state = (
  enabled: boolean,
  easing: string,
  durationScale = 1,
  intensity = 1,
): SymbolStateConfig => ({ enabled, easing, durationScale, intensity });

export const BUILTIN_PRESETS: AnimationPreset[] = [
  {
    id: 'fantasy-default',
    name: 'Fantasy Default',
    description: 'Balanced baseline — the generator defaults. Good reference point for tuning.',
    builtIn: true,
    params: {},
    states: {
      idle: state(true, 'sine.inOut'),
      landing: state(true, 'back.out'),
      win: state(true, 'back.out'),
      reset: state(true, 'power2.out'),
    },
    effects: { policeLights: true, scatterOrbit: true, sweatColumns: true, shockwave: true, winScreens: true, ambientSiren: true },
  },
  {
    id: 'snappy-turbo',
    name: 'Snappy / Turbo',
    description: 'Fast, punchy. Short drops, quick pops — for high-tempo testing.',
    builtIn: true,
    params: { spinSpeed: 1.8, dropDurationMs: 260, dropStaggerMs: 45, winPopIntensity: 1.15 },
    states: {
      idle: state(true, 'sine.inOut', 0.8),
      landing: state(true, 'back.out', 0.7, 1.1),
      win: state(true, 'back.out', 0.75, 1.1),
      reset: state(true, 'power2.out', 0.8),
    },
    effects: { policeLights: true, scatterOrbit: true, sweatColumns: true, shockwave: true, winScreens: true, ambientSiren: true },
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Slow, dramatic, heavy juice. Big anticipation + celebration weight.',
    builtIn: true,
    params: { spinSpeed: 0.8, dropDurationMs: 560, dropStaggerMs: 110, glowIntensity: 1.4, shockwaveScale: 2.3, celebrationIntensity: 1.5, sweatSlowFactor: 2.2 },
    states: {
      idle: state(true, 'sine.inOut', 1.2),
      landing: state(true, 'elastic.out', 1.2, 1.2),
      win: state(true, 'back.out', 1.3, 1.35),
      reset: state(true, 'power2.out', 1.2),
    },
    effects: { policeLights: true, scatterOrbit: true, sweatColumns: true, shockwave: true, winScreens: true, ambientSiren: true },
  },
  {
    id: 'minimal',
    name: 'Minimal / Clean',
    description: 'Effects stripped back — symbols + simple pops only. Isolate the math/flow.',
    builtIn: true,
    params: { glowIntensity: 0.3, winPopIntensity: 0.8 },
    states: {
      idle: state(false, 'sine.inOut'),
      landing: state(true, 'power2.out', 0.9, 0.7),
      win: state(true, 'power2.out', 0.9, 0.7),
      reset: state(true, 'power2.out'),
    },
    effects: { policeLights: false, scatterOrbit: false, sweatColumns: true, shockwave: false, winScreens: true, ambientSiren: false },
  },
];

export const DEFAULT_PRESET_ID = 'fantasy-default';

/** Resolve a preset's full param set (defaults overlaid with its overrides). */
export function resolveParams(preset: AnimationPreset): ParamValues {
  const out = defaultParamValues();
  for (const k of Object.keys(preset.params)) {
    const v = preset.params[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}
