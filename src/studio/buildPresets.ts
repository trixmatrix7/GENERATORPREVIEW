// BUILD PRESETS — whole-game builds (assets + math + grid + bare flag),
// saved into the bottom-centre slot dock and applied via full reload (the
// same re-derive path as a fresh boot). "Bare" builds boot the naked
// scaffold: NO theme assets, NO spritesheets — the create-new starting point.
// Export produces the standalone GAME PRESET JSON (the generator handoff
// shape: every asset URL + sheet geometry + math manifest in one file).

import { loadAssets, replaceAssets, type SavedAssets } from './assetPersistence';
import { loadMathProfileId, saveMathProfileId } from '@/config/mathProfiles';
import { loadGridId, type GridId } from '@/dev/PresetDock';
import viceMath from '@/data/math_vice_heat.json';
import introLayers from '@/data/introLayers.json';

const BUILDS_KEY = 'vice:builds';
const BARE_KEY = 'vice:bare';
const ACTIVE_KEY = 'vice:active-build';
const GRID_KEY = 'studio-grid';
const GAME_KEY = 'active-game';

/** Which baked game theme the App wires (default Vice Heat). */
export function loadActiveGame(): 'vice' | 'crackfarm' | 'fruitstacks' {
  try {
    const g = localStorage.getItem(GAME_KEY);
    return g === 'crackfarm' ? 'crackfarm' : g === 'fruitstacks' ? 'fruitstacks' : 'vice';
  }
  catch { return 'vice'; }
}

export interface SavedBuild {
  id: number;
  name: string;
  createdAt: number;
  gridId: GridId;
  mathProfileId: string;
  bare: boolean;
  assets: SavedAssets;
}

export function isBareBuild(): boolean {
  try { return localStorage.getItem(BARE_KEY) === '1'; } catch { return false; }
}

export function listBuilds(): SavedBuild[] {
  try { return JSON.parse(localStorage.getItem(BUILDS_KEY) ?? '[]') as SavedBuild[]; }
  catch { return []; }
}

export function activeBuildId(): number | null {
  const raw = localStorage.getItem(ACTIVE_KEY);
  return raw ? Number(raw) : null;
}

function persist(builds: SavedBuild[]): void {
  try { localStorage.setItem(BUILDS_KEY, JSON.stringify(builds)); } catch { /* quota */ }
}

/** Snapshot the CURRENT state under a name and add it to the dock. */
export function saveBuild(name: string): SavedBuild[] {
  const b: SavedBuild = {
    id: Date.now(),
    name,
    createdAt: Date.now(),
    gridId: loadGridId(),
    mathProfileId: loadMathProfileId(),
    bare: isBareBuild(),
    assets: loadAssets(),
  };
  const next = [...listBuilds(), b];
  persist(next);
  try { localStorage.setItem(ACTIVE_KEY, String(b.id)); } catch { /* quota */ }
  return next;
}

export function deleteBuild(id: number): SavedBuild[] {
  const next = listBuilds().filter(b => b.id !== id);
  persist(next);
  return next;
}

/** Apply a saved build and reload (full re-derive, like a fresh boot). */
export function applyBuild(b: SavedBuild): void {
  replaceAssets(b.assets);
  saveMathProfileId(b.mathProfileId);
  try {
    localStorage.setItem(GRID_KEY, b.gridId);
    localStorage.setItem(BARE_KEY, b.bare ? '1' : '0');
    localStorage.setItem(ACTIVE_KEY, String(b.id));
  } catch { /* quota */ }
  window.location.reload();
}

/** CREATE NEW BUILD: throw every asset + spritesheet out — boot the naked
 *  scaffold (procedural frame, glyph symbols, no sheets, no intros). */
export function createNewBuild(): void {
  replaceAssets({});
  try {
    localStorage.setItem(BARE_KEY, '1');
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* quota */ }
  window.location.reload();
}

/** Back to the built-in VICE HEAT base game (no overrides, full theme). */
export function applyViceBase(): void {
  replaceAssets({});
  saveMathProfileId('vice-heat-custom');
  try {
    localStorage.setItem(GRID_KEY, '5x5');
    localStorage.setItem(BARE_KEY, '0');
    localStorage.setItem(GAME_KEY, 'vice');
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* quota */ }
  window.location.reload();
}

/** Built-in CRACK FARM 5×3 game (barn theme, baked in public/theme/crackfarm/). */
export function applyCrackFarm(): void {
  replaceAssets({});
  saveMathProfileId('crack-farm-lines');
  try {
    localStorage.setItem(GRID_KEY, '5x3');
    localStorage.setItem(BARE_KEY, '0');
    localStorage.setItem(GAME_KEY, 'crackfarm');
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* quota */ }
  window.location.reload();
}

/** Built-in FRUIT STACKS 6×5 scatter-pays tumbler (fruit-forest theme,
 *  baked in public/theme/fruitstacks/). */
export function applyFruitStacks(): void {
  replaceAssets({});
  saveMathProfileId('fruit-stacks-tumble');
  try {
    localStorage.setItem(GRID_KEY, '6x5');
    localStorage.setItem(BARE_KEY, '0');
    localStorage.setItem(GAME_KEY, 'fruitstacks');
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* quota */ }
  window.location.reload();
}

/** EXPORT BUILD — the standalone GAME PRESET ("reines Game"): the complete
 *  declarative wiring (assets, sheet geometry, features, math manifest) as
 *  one JSON the generator/dev consumes. Mirrors src/App.tsx's wiring. */
export function buildExportPreset(name: string): Record<string, unknown> {
  const o = loadAssets();
  const B = 'theme/vice/';
  const bare = isBareBuild();
  return {
    formatVersion: 1,
    kind: 'chainwtf-game-preset',
    name: name || 'Vice Heat',
    exportedAt: new Date().toISOString(),
    gridId: loadGridId(),
    bare,
    math: {
      profileId: loadMathProfileId(),
      manifest: viceMath, // full certified manifest incl. the custom rules
    },
    assets: bare ? {} : {
      title: `${B}logo.webp`,
      background: o.bg ?? `${B}bg_motel.webp`,
      backgroundLoop: o.bg ? null : { sheets: [`${B}bg_motel_anim_1.webp`, `${B}bg_motel_anim_2.webp`, `${B}bg_motel_anim_3.webp`], cols: 4, rows: 4, count: 45, fps: 6 },
      fsBackgroundLoop: o.fsBg ? null : { sheets: [`${B}fsbg_beachclub_anim_1.webp`, `${B}fsbg_beachclub_anim_2.webp`, `${B}fsbg_beachclub_anim_3.webp`], cols: 4, rows: 4, count: 48, fps: 6 },
      fsBackground: o.fsBg ?? `${B}fsbg_beachclub.webp`,
      frame: o.frame ?? { file: `${B}frame_neon.webp`, window: { x: 197, y: 314, w: 832, h: 832 } },
      frameWinFlash: { file: `${B}frame_win_flash_1.webp`, cols: 8, rows: 6, count: 48, fps: 12, region: { x: 1025, y: 225, w: 475, h: 1062.5 } },
      symbols: Object.keys(o.symbols ?? {}).length ? o.symbols : 'baked: public/theme/vice/symbol_*_landing.png (see src/config/viceAssets.ts)',
      expandingWild: o.expandingWild ?? `${B}wild_column.webp`,
      winSheets: {
        '1-scatter': { file: `${B}scatterwin.webp`, cols: 8, rows: 9, count: 67, fps: 15 },
        '2-highA': { file: `${B}prem_a_win.webp`, cols: 7, rows: 7, count: 48, fps: 12 },
        '3-highB': { file: `${B}prem_b_win.webp`, cols: 7, rows: 7, count: 48, fps: 12 },
        '4-midC': { file: `${B}car_win.webp`, cols: 7, rows: 7, count: 48, fps: 12 },
        '5-midD': { file: `${B}koffer_win.webp`, cols: 7, rows: 7, count: 48, fps: 12 },
      },
      idleSheets: { '1-scatter': { file: `${B}scatteridle.webp`, cols: 10, rows: 9, count: 90, fps: 10 } },
      staticLookSymbols: [1],
      noIdleSymbols: [0],
      winTiers: { dir: 'theme/win-tiers/', layers: ['big', 'mega', 'epic', 'max', 'win', 'plate'] },
      coinRain: { sheets: ['theme/win-tiers/coinrain3_0.webp', 'theme/win-tiers/coinrain3_1.webp', 'theme/win-tiers/coinrain3_2.webp'], cols: 10, rows: 10, count: 300, fps: 45 },
      introLayers,
    },
    audio: bare ? {} : {
      dir: 'audio/',
      events: ['ambient-music', 'win-marquee', 'spin-start', 'reel-stop', 'coin-chime', 'wild-land', 'wild-expand', 'scatter-land', 'near-miss-tease', 'free-spin-trigger'],
      oggFirst: true,
      marqueeDucksAmbient: true,
    },
    features: {
      teasePreset: 'universal-anticipation',
      teaseCameraPovDolly: { base: 1.06, perStep: 0.05 },
      scatterCollectOnTrigger: true,
      frameFlashOn3rdScatter: true,
      fsIntroHoldSec: 7,
      outroHoldSecMax: 15,
      hardPayoutCap: 'round stops at maxWinMultiplier x bet, MAX WIN marquee',
    },
  };
}

export function downloadExport(name: string): void {
  const json = JSON.stringify(buildExportPreset(name), null, 1);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(name || 'game-preset').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'game-preset'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
