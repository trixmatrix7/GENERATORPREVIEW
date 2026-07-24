// Switchable MATH PROFILES — real manifests from the dev's CURRENT library
// (generated/manifests/, the same files the generator's O(1) lookup serves),
// mapped to GameConfig exactly like the wizard does (buildGameConfigFromMathProfile).
// The original Fantasy math (older library snapshot) stays the default.

import { SymbolId } from './symbols';
import { GRID_5x3, GRID_5x5, GRID_6x5 } from './gridConfig';
import type { GameConfig } from '@/engine/GameConfig';
import type { PayEntry } from './paytable';
import { getThemeByName } from './themes';
import vol3x5 from '@/data/math_vol3_5x5.json';
import vol3x3 from '@/data/math_vol3_5x3.json';
import viceHeat from '@/data/math_vice_heat.json';
import crackFarm from '@/data/math_crack_farm.json';
import crackFarm10k from '@/data/math_crack_farm_10k.json';
import crackFarm15k from '@/data/math_crack_farm_15k.json';
import fruitStacks from '@/data/math_fruit_stacks.json';

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
    gridConfig: m['gridId'] === '6x5' ? GRID_6x5 : m['gridId'] === '5x5' ? GRID_5x5 : GRID_5x3,
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
    // Vice-Heat bonus buys (3sc/4sc at fixed prices) + the 3x-FS-chance ante
    // (certified strips + cost live in the manifest custom block).
    viceBuyStages: (m['custom'] as { viceBuyStages?: Array<{ stage: number; scatters: number; costMult: number }> } | undefined)?.viceBuyStages,
    anteBet: (m['custom'] as { anteBet?: { costMult: number; reelStrips: number[][] } } | undefined)?.anteBet,
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
    // FULL HOUSE: while ALL stickyTowerCap towers stand, every sticky spin
    // pays x this multiplier — the 4-scatter route's max-win engine.
    stickyFullBoardMultiplier: (m['custom'] as { stickyFullBoardMultiplier?: number } | undefined)?.stickyFullBoardMultiplier,
    // Crack-Farm custom rules (paylines game): 3sc = roaming plant wild
    // (one reel per spin), 4sc = sticky plant towers with the shared
    // +1×-per-connection multiplier.
    roamingWildFrom3Scatters: !!(m['custom'] as { roamingWildFrom3Scatters?: boolean } | undefined)?.roamingWildFrom3Scatters,
    stickyPlantFrom4Scatters: !!(m['custom'] as { stickyPlantFrom4Scatters?: boolean } | undefined)?.stickyPlantFrom4Scatters,
    plantMultiIncrement: (m['custom'] as { plantMultiIncrement?: number } | undefined)?.plantMultiIncrement,
    plantMultiCap: (m['custom'] as { plantMultiCap?: number } | undefined)?.plantMultiCap,
    // ── Crack Farm v2 plant rules ──────────────────────────────────────
    // 3/4/5 scatters all award the SAME spin count; only the plants' START
    // multiplier differs (1x / 8x / 32x). Each plant carries its OWN multi,
    // a line win pays x the HIGHEST plant it crosses, and every plant that
    // took part in a spin DOUBLES afterwards (capped at plantMultiCap).
    plantStartMultipliers: (m['custom'] as { plantStartMultipliers?: Record<string, number> } | undefined)?.plantStartMultipliers,
    // Weights for how many plants a round draws (index 0 = 1 plant).
    plantCountWeights: (m['custom'] as { plantCountWeights?: number[] } | undefined)?.plantCountWeights,
    // BASE-GAME plant feature: odds (1 in N) + weighted multiplier table.
    baseFeatureOdds: (m['custom'] as { baseFeatureOdds?: number } | undefined)?.baseFeatureOdds,
    baseFeatureMultipliers: (m['custom'] as { baseFeatureMultipliers?: [number, number][] } | undefined)?.baseFeatureMultipliers,
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
    id: 'crack-farm-lines', name: '🌾 Crack Farm 96% · 5000× (10 Paylines 5×3)',
    description: 'PAYLINES v2 (10 Linien): 3/4/5 SC = 7 Spins, Plant-Start-Multi 1×/8×/32×, jede Pflanze eigener Multi (höchste gekreuzte zahlt), verdoppelt pro Spin bis 1024×; 1-5 Pflanzen [55,28,12,4,1]. Base-Feature 1-in-170. RTP 95.8% (stratifiziert), Max Win 5000×.',
    build: () => fromManifest(crackFarm as Record<string, unknown>),
    grid: '5x3',
  },
  {
    id: 'crack-farm-lines-10k', name: '🌾 Crack Farm 96% · 10.000× (höhere Vola)',
    description: 'Gleiches v2-Modell, Max Win 10.000× — mehr Volatilität (größerer Tail, gleicher 96%-RTP, kleinere Paytable). Certified 96.1% (stratifiziert).',
    build: () => fromManifest(crackFarm10k as Record<string, unknown>),
    grid: '5x3',
  },
  {
    id: 'crack-farm-lines-15k', name: '🌾 Crack Farm 96% · 15.000× (max Vola)',
    description: 'Gleiches v2-Modell, Max Win 15.000× — höchste Volatilität. Certified 96.1% (stratifiziert).',
    build: () => fromManifest(crackFarm15k as Record<string, unknown>),
    grid: '5x3',
  },
  {
    id: 'fruit-stacks-tumble', name: '🍉 Fruit Stacks 96% (6×5 Tumbler)',
    description: 'SCATTER-PAYS: 8+/10-11/12+ gleiche irgendwo zahlen, Tumble-Kaskade, Kisten-Multis ×2-×500, FS 15 Spins mit Multi-Pool (Cap ×500). SCATTER-TIERS: 5sc → Pool-Start ×50 (1-in-4k), 6sc → ×100 (1-in-57k). RTP 96.1% (stratifiziert 2M+), Max Win 5000×. Buys 100/300/460×.',
    build: () => fromManifest(fruitStacks as Record<string, unknown>),
    grid: null, // 6x5 — outside the classic pair; grid comes from the manifest
  },
  {
    id: 'vice-heat-custom', name: '⭐ Vice Heat 96% (Custom 5×5)',
    description: 'UNSER Modell auf 5×5/3125 Ways: alles zahlt ab 3er (Hit 69%), FS = Expanding Wilds (3 SC = 7 Spins, 4 SC = 10 Sticky-Spins), Hot-Spin 1-in-80, Max Win 5000×. RTP ~96% (20M-Sim).',
    build: () => fromManifest(viceHeat as Record<string, unknown>),
    grid: '5x5',
  },
];

const KEY = 'studio-math';
/** Per-game default when nothing is stored — a FRESH visitor (or the
 *  partner dev) must get the CURRENT certified math of the active game,
 *  never the legacy fantasy library (x18 FS multiplier -> 17k+ 'wins',
 *  the '93%' the dev saw). */
function defaultProfileForActiveGame(): string {
  try {
    const g = localStorage.getItem('active-game');
    if (g === 'crackfarm') return 'crack-farm-lines';
    if (g === 'fruitstacks') return 'fruit-stacks-tumble';
    return 'vice-heat-custom';
  } catch { return 'vice-heat-custom'; }
}
export function loadMathProfileId(): string {
  return localStorage.getItem(KEY) ?? defaultProfileForActiveGame();
}
export function saveMathProfileId(id: string): void {
  localStorage.setItem(KEY, id);
}
export function mathProfileById(id: string): MathProfileOption {
  return MATH_PROFILES.find(p => p.id === id) ?? MATH_PROFILES[0];
}
