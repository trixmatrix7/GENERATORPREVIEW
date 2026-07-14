// Switchable MATH PROFILES — real manifests from the dev's CURRENT library
// (generated/manifests/, the same files the generator's O(1) lookup serves),
// mapped to GameConfig exactly like the wizard does (buildGameConfigFromMathProfile).
// The original Fantasy math (older library snapshot) stays the default.

import { SymbolId } from './symbols';
import { GRID_5x3, GRID_5x5 } from './gridConfig';
import type { GameConfig } from '@/engine/GameConfig';
import type { PayEntry } from './paytable';
import { getThemeByName } from './themes';
import vol3x5 from '@/data/math_vol3_5x5.json';
import vol3x3 from '@/data/math_vol3_5x3.json';
import viceHeat from '@/data/math_vice_heat.json';

const KEY_TO_ID: Record<string, number> = {
  wild: SymbolId.WILD, scatter: SymbolId.SCATTER,
  highA: SymbolId.HIGH_A, highB: SymbolId.HIGH_B,
  midC: SymbolId.MID_C, midD: SymbolId.MID_D,
  lowE: SymbolId.LOW_E, lowF: SymbolId.LOW_F, lowG: SymbolId.LOW_G,
  coin: SymbolId.COIN,
};

export interface MathProfileOption {
  id: string;
  name: string;
  description: string;
  /** null → the baked Fantasy config (DEFAULT_GAME_CONFIG). */
  build: (() => GameConfig) | null;
  /** Grid the profile is certified for; null = grid-flexible (default math). */
  grid: '5x3' | '5x5' | null;
}

function fromManifest(m: Record<string, unknown>): GameConfig {
  const rawPT = m['payTable'] as Record<string, PayEntry>;
  const payTable: Partial<Record<number, PayEntry>> = {};
  for (const [k, v] of Object.entries(rawPT)) {
    const id = KEY_TO_ID[k] ?? Number(k);
    if (Number.isFinite(id)) payTable[id] = v;
  }
  const reelStrips = m['reelStrips'] as number[][];
  return {
    gridConfig: m['gridId'] === '5x5' ? GRID_5x5 : GRID_5x3,
    reelStrips,
    reelLengths: reelStrips.map(s => s.length),
    payTable,
    scatterPay: (m['scatterPay'] as PayEntry) ?? [40, 219, 1495],
    freeSpinsCount: (m['freeSpinsCount'] as number) ?? 12,
    freeSpinsCap: (m['freeSpinsCap'] as number) ?? 50,
    freeSpinsMultiplier: (m['freeSpinMultiplier'] as number) ?? 5,
    maxWinMultiplier: (m['maxWinMultiplier'] as number) ?? 5000,
    theme: getThemeByName('Fantasy'),
    // Vice-Heat custom rules: FS wild reels expand before evaluation; a
    // 4+-scatter trigger plays STICKY towers capped at stickyTowerCap (the
    // mock settles with both so display and payout match).
    expandingWildsInFS: !!(m['custom'] as { expandingWildsInFreeSpins?: boolean } | undefined)?.expandingWildsInFreeSpins,
    stickyTowerCap: (m['custom'] as { stickyTowerCap?: number } | undefined)?.stickyTowerCap ?? 2,
    // Small fixed retrigger award (custom rule) — undefined keeps the
    // template's re-award-freeSpinsCount behaviour.
    retriggerSpins: (m['custom'] as { retriggerSpins?: number } | undefined)?.retriggerSpins,
    // Simultaneous-expansion multiplier table (3sc bonus + hot spins):
    // n reels expanding in ONE spin multiply the spin win per this map
    // (late ladder, e.g. {"3": 2, "4": 8}).
    simulExpandMultipliers: (m['custom'] as { simulExpandMultipliers?: Record<string, number> } | undefined)?.simulExpandMultipliers,
    // Sticky rounds run longer than 3sc rounds (own spin count + cap).
    stickyRoundSpins: (m['custom'] as { stickyRoundSpins?: number } | undefined)?.stickyRoundSpins,
    stickyRoundCap: (m['custom'] as { stickyRoundCap?: number } | undefined)?.stickyRoundCap,
  } as unknown as GameConfig;
}

export const MATH_PROFILES: readonly MathProfileOption[] = [
  {
    id: 'fantasy-extreme', name: 'Extreme (Original)',
    description: 'Deine generierte Fantasy-Math (ältere Library): J/Q zahlen NIE, alles steckt in Scatter/FS/Premiums.',
    build: null,
    grid: null,
  },
  {
    id: 'vol3-5x5', name: 'Sanft 5×5 (vol3)',
    description: 'Aktuelle Dev-Library rtp96.0_vol3_5x5: E+F zahlen bei 5ern, FS 20×9 — gleiche 5×5-Optik, weicheres Base Game.',
    build: () => fromManifest(vol3x5 as Record<string, unknown>),
    grid: '5x5',
  },
  {
    id: 'vol3-5x3', name: 'Lively 5×3 (vol3)',
    description: 'Aktuelle Dev-Library rtp96.0_vol3: ALLE Symbole zahlen ab 3er — ständig sichtbare Connections, 243 Ways.',
    build: () => fromManifest(vol3x3 as Record<string, unknown>),
    grid: '5x3',
  },
  {
    id: 'vice-heat-custom', name: '⭐ Vice Heat 96% (Custom 5×5)',
    description: 'UNSER Modell auf 5×5/3125 Ways: alles zahlt ab 3er (Hit 85%!), FS = Expanding Wilds (~8.7× EV pro FS-Spin, Trigger 1-in-22), Hot-Spin 1-in-40. RTP exakt-analytisch 96.008%.',
    build: () => fromManifest(viceHeat as Record<string, unknown>),
    grid: '5x5',
  },
];

const KEY = 'studio-math';
export function loadMathProfileId(): string {
  return localStorage.getItem(KEY) ?? 'fantasy-extreme';
}
export function saveMathProfileId(id: string): void {
  localStorage.setItem(KEY, id);
}
export function mathProfileById(id: string): MathProfileOption {
  return MATH_PROFILES.find(p => p.id === id) ?? MATH_PROFILES[0];
}
