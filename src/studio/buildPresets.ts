// BUILD PRESETS — whole-game builds (assets + math + grid + bare flag),
// saved into the bottom-centre slot dock and applied via full reload (the
// same re-derive path as a fresh boot). "Bare" builds boot the naked
// scaffold: NO theme assets, NO spritesheets — the create-new starting point.
// Export produces the standalone GAME PRESET JSON (the generator handoff
// shape: every asset URL + sheet geometry + math manifest in one file).

import { loadAssets, replaceAssets, type SavedAssets } from './assetPersistence';
import { loadMathProfileId, saveMathProfileId } from '@/config/mathProfiles';
import { loadGridId, type GridId } from '@/dev/PresetDock';
import { manifestForProfile } from '@/config/activeMath';
import { defaultSoundConfig } from '@/audio/defaultSoundConfig';
import { FRUIT_LOCKED_SOUNDS, FRUIT_LOCKED_VOLUMES, FRUIT_LOCKED_VISUAL_PARAMS } from '@/config/fruitStacksLockedSettings';
import { buildPresetV2, type GameKey, type ResolvedAudioEvent } from './exportPresetV2Core';
import viceTuning from '@/data/vicePresentationTuning.json';

const BUILDS_KEY = 'vice:builds';
const BARE_KEY = 'vice:bare';
const ACTIVE_KEY = 'vice:active-build';
const GRID_KEY = 'studio-grid';
const GAME_KEY = 'active-game';
/** Per-BUILT-IN saved settings (Noski: Save on Vice/CrackFarm/FruitStacks
 *  must update THAT game's settings — never open a dock slot). */
const builtinKey = (g: string) => `vice:builtin:${g}`;

const VOLUMES_KEY = 'slot:audio-event-volumes';
function readVolumes(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(VOLUMES_KEY) ?? '{}') as Record<string, number>; }
  catch { return {}; }
}
function writeVolumes(v: Record<string, number> | undefined): void {
  try {
    if (v && Object.keys(v).length) localStorage.setItem(VOLUMES_KEY, JSON.stringify(v));
    else localStorage.removeItem(VOLUMES_KEY);
  } catch { /* quota */ }
}

interface BuiltinSnapshot {
  gridId: GridId;
  mathProfileId: string;
  assets: SavedAssets;
  /** Per-event volume-slider overrides (Noski: "speichern mit Sound-
   *  Lautstärke alles") — snapshotted + restored with the game. */
  soundVolumes?: Record<string, number>;
}

function loadBuiltinSnapshot(game: string): BuiltinSnapshot | null {
  try {
    const raw = localStorage.getItem(builtinKey(game));
    return raw ? JSON.parse(raw) as BuiltinSnapshot : null;
  } catch { return null; }
}

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

/** SAVE BUILD (Noski): overwrites the ACTIVE slot in place — "Create New
 *  Build" is the only way to open a fresh slot. With no active slot (e.g.
 *  standing on a built-in game like Crack Farm) the first save creates the
 *  slot and makes it active, so every save after lands in that same slot. */
export function saveBuild(name: string): SavedBuild[] {
  const snapshot = {
    gridId: loadGridId(),
    mathProfileId: loadMathProfileId(),
    bare: isBareBuild(),
    assets: loadAssets(),
    soundVolumes: readVolumes(),
  };
  const builds = listBuilds();
  const activeId = activeBuildId();
  const idx = activeId !== null ? builds.findIndex(b => b.id === activeId) : -1;
  if (idx >= 0) {
    // ACTIVE SLOT → overwrite in place (keep id + createdAt)
    const cur = builds[idx];
    builds[idx] = { ...cur, ...snapshot, name: name || cur.name };
    persist(builds);
    return builds;
  }
  // BUILT-IN game active (no slot): Save updates THE GAME's own settings —
  // never a new dock slot. The chip re-applies this snapshot on every
  // click/reload, so nothing has to be redone (Noski).
  try {
    localStorage.setItem(builtinKey(loadActiveGame()), JSON.stringify({
      gridId: snapshot.gridId,
      mathProfileId: snapshot.mathProfileId,
      assets: snapshot.assets,
      soundVolumes: snapshot.soundVolumes,
    }));
  } catch { /* quota */ }
  return builds;
}

export function deleteBuild(id: number): SavedBuild[] {
  const next = listBuilds().filter(b => b.id !== id);
  persist(next);
  return next;
}

/** Apply a saved build and reload (full re-derive, like a fresh boot). */
export function applyBuild(b: SavedBuild): void {
  replaceAssets(b.assets);
  writeVolumes((b as { soundVolumes?: Record<string, number> }).soundVolumes);
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
  const saved = loadBuiltinSnapshot('vice');
  replaceAssets(saved?.assets ?? {});
  writeVolumes(saved?.soundVolumes);
  saveMathProfileId(saved?.mathProfileId ?? 'vice-heat-custom');
  try {
    localStorage.setItem(GRID_KEY, saved?.gridId ?? '5x5');
    localStorage.setItem(BARE_KEY, '0');
    localStorage.setItem(GAME_KEY, 'vice');
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* quota */ }
  window.location.reload();
}

/** Built-in CRACK FARM 5×3 game (barn theme, baked in public/theme/crackfarm/). */
export function applyCrackFarm(): void {
  const saved = loadBuiltinSnapshot('crackfarm');
  replaceAssets(saved?.assets ?? {});
  writeVolumes(saved?.soundVolumes);
  saveMathProfileId(saved?.mathProfileId ?? 'crack-farm-lines');
  try {
    localStorage.setItem(GRID_KEY, saved?.gridId ?? '5x3');
    localStorage.setItem(BARE_KEY, '0');
    localStorage.setItem(GAME_KEY, 'crackfarm');
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* quota */ }
  window.location.reload();
}

/** Built-in FRUIT STACKS 6×5 scatter-pays tumbler (fruit-forest theme,
 *  baked in public/theme/fruitstacks/). */
export function applyFruitStacks(): void {
  const saved = loadBuiltinSnapshot('fruitstacks');
  replaceAssets(saved?.assets ?? {});
  writeVolumes(saved?.soundVolumes);
  saveMathProfileId(saved?.mathProfileId ?? 'fruit-stacks-tumble');
  try {
    localStorage.setItem(GRID_KEY, saved?.gridId ?? '6x5');
    localStorage.setItem(BARE_KEY, '0');
    localStorage.setItem(GAME_KEY, 'fruitstacks');
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* quota */ }
  window.location.reload();
}

/** EXPORT BUILD — chainwtf-game-preset v2 (the STANDARDIZED format agreed
 *  with the partner dev; see exportPresetV2Core.ts + the schema JSON). Game-
 *  aware: ships the ACTIVE game's assets + the CURRENT certified manifest of
 *  the active math profile (never a hard-coded one again). */
export function buildExportPreset(name: string): Record<string, unknown> {
  const o = loadAssets();
  const game = loadActiveGame() as GameKey;
  const profileId = loadMathProfileId();
  // Fall back to the game's canonical profile when the selected one has no
  // manifest (e.g. the legacy 'fantasy-extreme' library).
  const FALLBACK: Record<GameKey, string> = {
    vice: 'vice-heat-custom', crackfarm: 'crack-farm-lines', fruitstacks: 'fruit-stacks-tumble',
  };
  const manifest = manifestForProfile(profileId) ?? manifestForProfile(FALLBACK[game]);
  const usedProfile = manifestForProfile(profileId) ? profileId : FALLBACK[game];

  // Resolve the audio events: design defaults -> library picks -> the user's
  // per-event volume overrides (SoundParamsPanel), exactly what the build plays.
  let volOverrides: Record<string, number> = {};
  try { volOverrides = JSON.parse(localStorage.getItem('slot:audio-event-volumes') ?? '{}'); } catch { /* keep {} */ }
  // Clean-Sounds trim windows (Audio Studio): per event {offsetMs,durMs,
  // fadeOutMs,gainDb} — the dev applies them at play time (seek+fade+gain),
  // so a too-long pick still hits the event's timing budget without re-baking.
  let cleanMap: Record<string, { offsetMs: number; durMs: number; fadeOutMs: number; gainDb: number }> = {};
  try { cleanMap = JSON.parse(localStorage.getItem('slot:audio-clean') ?? '{}'); } catch { /* keep {} */ }
  const picks = o.sounds ?? {};
  // Fruit Stacks: Noskis gelockte Picks/Pegel sind der EXPORT-Default, damit
  // die JSON auch bei leerem localStorage exakt seinen Zustand traegt (User-
  // Picks/Overrides gewinnen weiterhin).
  const lockedSounds = game === 'fruitstacks' ? FRUIT_LOCKED_SOUNDS : {};
  const lockedVols = game === 'fruitstacks' ? FRUIT_LOCKED_VOLUMES : {};
  const audioEvents: Record<string, ResolvedAudioEvent> = {};
  for (const ev of defaultSoundConfig().events) {
    const pick = picks[ev.id] ?? lockedSounds[ev.id];
    const volume = volOverrides[ev.id] ?? lockedVols[ev.id] ?? ev.volume;
    const file = (pick ?? ev.src[0] ?? '').replace(/^\//, '');
    if (!file) continue;
    audioEvents[ev.id] = {
      file,
      volume,
      loop: ev.loop || undefined,
      exclusive: ev.exclusive || undefined,
      role: ev.id === 'ambient-music' || ev.id === 'win-marquee' ? 'music' : 'sfx',
      enabled: volume > 0,
      trim: cleanMap[ev.id] ?? undefined,
    };
  }

  return buildPresetV2({
    name,
    game,
    gridId: loadGridId(),
    profileId: usedProfile,
    manifest,
    overrides: { bg: o.bg, fsBg: o.fsBg, frame: o.frame, expandingWild: o.expandingWild },
    audioEvents,
    visualParams: { ...(game === 'fruitstacks' ? FRUIT_LOCKED_VISUAL_PARAMS : {}), ...(o.visualParams ?? {}) },
    bare: isBareBuild(),
    exportedAt: new Date().toISOString(),
    generatorVersion: '2.1.0',
    presentationTuning: game === 'vice' ? (viceTuning as Record<string, unknown>) : undefined,
  });
}

export function downloadExport(name: string): void {
  const preset = buildExportPreset(name);
  const gameId = (preset.game as { id: string }).id;
  const json = JSON.stringify(preset, null, 1);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = (name || gameId).replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || gameId;
  a.download = `${slug}.chainwtf-preset.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
