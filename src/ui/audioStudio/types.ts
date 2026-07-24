// Shared types + constants for the Audio Studio page (src/ui/audioStudio/).
//
// The Audio Studio is a SECOND page next to the studio drawer: the slot
// preview runs in an iframe on the left, a large audio rail sits on the
// right. Everything here reuses the proven binding pattern from
// SoundLibraryPanel — getSharedSoundManager().replaceSource(...) plus
// persistence in the assets store (loadAssets/saveAssets 'sounds') — so
// picks land in Save Build / Export exactly like before.

// ── Theme sound library (src/data/themeSoundLibrary.json, built by the
//    library agent) ─────────────────────────────────────────────────────────

export interface LibrarySound {
  id: string;
  /** Category id (matches ThemeSoundLibrary.categories[].id). */
  cat: string;
  name: string;
  /** Playable URL (OGG under public/, per the repo's OGG-first rule). */
  url: string;
  /** Duration in milliseconds (0 = unknown). */
  durMs: number;
  /** Sound-event ids this sound is suggested for (see CORE_EVENT_IDS). */
  events: string[];
}

export interface LibraryCategory {
  id: string;
  name: string;
  count: number;
}

export interface ThemeSoundLibrary {
  categories: LibraryCategory[];
  sounds: LibrarySound[];
}

// ── Per-game audio presets ──────────────────────────────────────────────────

/** Snapshot payload of one audio preset (everything Save Build cares about). */
export interface AudioPresetData {
  /** Event-id → bound library URL (the SoundLibraryPanel persistence shape). */
  bindings: Record<string, string>;
  /** Per-event volume-slider overrides (localStorage 'slot:audio-event-volumes'). */
  volumes: Record<string, number>;
  /** Clean-params map (localStorage 'slot:audio-clean', shape owned by
   *  src/audio/soundCleaner.ts — stored as opaque JSON passthrough). */
  clean: Record<string, unknown>;
}

export interface AudioPreset {
  id: number;
  name: string;
  ts: number;
  data: AudioPresetData;
}

/** localStorage key of the per-event volume overrides (SoundManager). */
export const VOLUMES_STORAGE_KEY = 'slot:audio-event-volumes';
/** localStorage key of the clean-params map (src/audio/soundCleaner.ts). */
export const CLEAN_STORAGE_KEY = 'slot:audio-clean';
/** localStorage key of the per-game preset list. */
export function audioPresetsKey(game: string): string {
  return `slot:audio-presets:${game}`;
}

// ── Sound events ────────────────────────────────────────────────────────────

/** The 20 core sound-event ids (src/registries/soundEvents.ts, quips excluded). */
export const CORE_EVENT_IDS = [
  'spin-start',
  'reel-stop',
  'win-small',
  'win-normal',
  'win-big',
  'win-mega',
  'win-marquee',
  'wild-land',
  'wild-expand',
  'multi-fly',
  'multi-collect',
  'multi-apply',
  'scatter-land',
  'free-spin-trigger',
  'fs-counter-down',
  'fs-counter-up',
  'near-miss-tease',
  'reel-spin-loop',
  'coin-chime',
  'win-tally-tick',
  'win-tally-end',
  'tier-up',
  'tease-riser',
  'tease-miss',
  'ambient-music',
] as const;

export type CoreEventId = (typeof CORE_EVENT_IDS)[number];

/** German labels, matching SoundLibraryPanel / SoundParamsPanel naming. */
export const EVENT_LABELS: Record<string, string> = {
  'spin-start': 'Spin-Start',
  'reel-stop': 'Reel-Drop',
  'win-small': 'Win-Jingle S',
  'win-normal': 'Win-Jingle M',
  'win-big': 'Win-Jingle L',
  'win-mega': 'Win-Jingle XL',
  'win-marquee': 'Win-Marquee',
  'wild-land': 'Wild-Land',
  'wild-expand': 'Wild-Expand',
  'multi-fly': 'Multi-Flug',
  'multi-collect': 'Multi-Collect',
  'multi-apply': 'Multi-Apply (Win xN)',
  'fs-counter-down': 'FS-Counter runter',
  'fs-counter-up': 'FS-Counter hoch (Retrigger)',
  'scatter-land': 'Scatter-Land',
  'free-spin-trigger': 'FS-Trigger',
  'near-miss-tease': 'Near-Miss-Riser',
  'reel-spin-loop': 'Reel-Spin-Loop',
  'coin-chime': 'Connection-Win',
  'win-tally-tick': 'Tally-Tick',
  'win-tally-end': 'Tally-Terminator',
  'tier-up': 'Tier-Up-Slam',
  'tease-riser': 'Tease-Riser',
  'tease-miss': 'Tease-Miss',
  'ambient-music': 'Background-Musik',
};

// ── Defensive parsing / formatting helpers ──────────────────────────────────

/**
 * Validate the raw JSON import into a ThemeSoundLibrary. Returns null when
 * the file is missing/empty/malformed so the browser can show a hint instead
 * of crashing (the JSON is produced by a parallel pipeline).
 */
export function parseThemeSoundLibrary(data: unknown): ThemeSoundLibrary | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as { categories?: unknown; sounds?: unknown };

  const rawSounds = Array.isArray(obj.sounds) ? obj.sounds : [];
  const sounds: LibrarySound[] = [];
  for (const s of rawSounds) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.url !== 'string') continue;
    sounds.push({
      id: typeof r.id === 'string' ? r.id : r.url,
      cat: typeof r.cat === 'string' ? r.cat : 'misc',
      name: r.name,
      url: r.url,
      durMs: typeof r.durMs === 'number' && Number.isFinite(r.durMs) ? r.durMs : 0,
      events: Array.isArray(r.events)
        ? r.events.filter((e): e is string => typeof e === 'string')
        : [],
    });
  }
  if (sounds.length === 0) return null; // empty counts as missing → UI hint

  const rawCats = Array.isArray(obj.categories) ? obj.categories : [];
  const categories: LibraryCategory[] = [];
  for (const c of rawCats) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    if (typeof r.id !== 'string') continue;
    categories.push({
      id: r.id,
      name: typeof r.name === 'string' ? r.name : r.id,
      count: typeof r.count === 'number' && Number.isFinite(r.count)
        ? r.count
        : sounds.filter(s => s.cat === r.id).length,
    });
  }
  // No/malformed categories: derive them from the sounds so chips still work.
  if (categories.length === 0) {
    const seen = new Map<string, number>();
    for (const s of sounds) seen.set(s.cat, (seen.get(s.cat) ?? 0) + 1);
    for (const [id, count] of seen) categories.push({ id, name: id, count });
  }

  return { categories, sounds };
}

export function formatDurMs(ms: number): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Compact one clean result for the UI ("getrimmt auf N ms · Gain +x dB").
 * The CleanParams shape is owned by src/audio/soundCleaner.ts (parallel
 * agent), so this probes the plausible field names defensively instead of
 * hard-coupling to it; unknown shapes render as raw JSON so nothing hides.
 */
export function describeCleanResult(p: unknown): string {
  if (!p || typeof p !== 'object') return '—';
  const r = p as Record<string, unknown>;
  const num = (k: string): number | null =>
    typeof r[k] === 'number' && Number.isFinite(r[k] as number) ? (r[k] as number) : null;

  const parts: string[] = [];
  const start = num('trimStartMs');
  const end = num('trimEndMs');
  const dur =
    num('trimmedMs') ?? num('trimmedDurMs') ?? num('durMs') ?? num('durationMs') ??
    (start !== null && end !== null && end > start ? end - start : null);
  if (dur !== null) parts.push(`getrimmt auf ${Math.round(dur)} ms`);
  const gain = num('gainDb') ?? num('gain');
  if (gain !== null) parts.push(`Gain ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB`);

  if (parts.length === 0) {
    try { return JSON.stringify(p); } catch { return '—'; }
  }
  return parts.join(' · ');
}
