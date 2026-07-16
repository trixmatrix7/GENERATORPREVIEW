// Default sound configuration — maps each entry in the soundEvents registry
// to its default audio file under /public/audio/.
//
// Generated games that ship their own sound packs override this map at
// build time by replacing this file (or by reading a manifest from
// public/audio/manifest.json).
//
// File format: each event has both .ogg and .mp3 candidates so Howler
// picks whichever the browser supports best.

import { soundEventRegistry } from '@/registries';
import { SoundManager, type SoundEventBinding, type SoundManagerConfig } from './SoundManager';

// Per-event default volumes. SFX usually sit lower than ambient music to
// avoid masking; win presentations are tuned to feel impactful. Values are
// 0–1 and are multiplied by the user's master volume.
const DEFAULT_VOLUMES: Record<string, number> = {
  'spin-start': 0.78,
  // Fires 5x per spin — sits slightly under the one-shot clicks (Noski:
  // "etwas leiser") so the stop stagger doesn't hammer the mix.
  'reel-stop': 0.58,
  // Connection-win stingers are OFF: the synthesized runs read as "AI sound"
  // (Noski) — the coin-chime tally + marquee music carry the win audio until
  // proper generated stingers get dropped in (just raise these again).
  'win-small': 0,
  'win-normal': 0,
  'win-big': 0,
  'win-mega': 0,
  'win-marquee': 0.95,
  'scatter-land': 0.8,
  // Money foley: cash-bundle drop on wild land, bill-riffle riser + slam on
  // the tower expansion.
  'wild-land': 0.8,
  'wild-expand': 0.85,
  'free-spin-trigger': 1.0,
  'near-miss-tease': 0.4,
  // Spin loop is OFF (silent file + zero volume): no bed under the spin —
  // the music + stop thumps carry it. Noski killed both the hiss and the
  // rumble variants ("brummen raus damit").
  'reel-spin-loop': 0,
  // Connection SWISH (noise foley) — fires once per connection on the rising
  // rate ladder; sits soft and smooth under the mix (Noski: "kleiner Wisch",
  // then −40%: 0.5 → 0.3).
  'coin-chime': 0.3,
  'ambient-music': 0.35,
  // WIN TALLY + TIER + RISER: the synthesized versions read wrong (Noski:
  // "audio fatal" — same lesson as the muted win jingles). MUTED until real
  // sound-design drops replace them; the hook architecture stays wired, so
  // re-enabling = drop the .ogg + raise the volume here. Target design per
  // research/slot-feel/05 stays the spec for the real drops.
  'win-tally-tick': 0,
  'win-tally-end': 0,
  'tier-up': 0,
  'tease-riser': 0,
  'tease-miss': 0,
};

// Per-event flags. Ambient music is loop + exclusive (only one can play).
// The marquee track is exclusive too: a re-triggered celebration must not
// stack a second copy of the song.
const LOOP_EVENTS = new Set<string>(['ambient-music', 'reel-spin-loop']);
const EXCLUSIVE_EVENTS = new Set<string>(['ambient-music', 'win-marquee']);

const AUDIO_DIR = '/audio';

// Events shipped as OGG (music tracks — MP3 drops get converted to .ogg).
// These must try .ogg FIRST: a missing .wav makes the SPA dev server answer
// with index.html (HTTP 200), which Howler then fails to DECODE — and it
// never falls through to the real file ("Decoding audio data failed").
const OGG_FIRST = new Set<string>(['ambient-music', 'win-marquee', 'spin-start', 'reel-stop', 'coin-chime', 'wild-land', 'wild-expand', 'win-tally-tick', 'win-tally-end', 'tier-up', 'tease-riser', 'tease-miss']);

function bindingForEvent(id: string): SoundEventBinding {
  return {
    id,
    // Howler tries each format in order. WAV is the primary format (Mixkit
    // CC-free assets); .ogg and .mp3 kept as fallbacks for legacy packs.
    src: OGG_FIRST.has(id)
      ? [`${AUDIO_DIR}/${id}.ogg`, `${AUDIO_DIR}/${id}.mp3`]
      : [`${AUDIO_DIR}/${id}.wav`, `${AUDIO_DIR}/${id}.ogg`, `${AUDIO_DIR}/${id}.mp3`],
    volume: DEFAULT_VOLUMES[id] ?? 0.7,
    loop: LOOP_EVENTS.has(id),
    exclusive: EXCLUSIVE_EVENTS.has(id),
  };
}

/**
 * Build the default sound-manager config from the registry. All registered
 * events are wired (even those marked implemented:false in the registry):
 * the SoundManager will try to load each one, log a warning if the file is
 * missing, and silently no-op when the event fires. This means dropping a
 * new audio file under public/audio/<id>.ogg "just works" without touching
 * registries.
 */
export function defaultSoundConfig(): SoundManagerConfig {
  const events: SoundEventBinding[] = soundEventRegistry
    .list()
    .map(entry => bindingForEvent(entry.id));

  return {
    events,
    initialVolume: 0.85,
    initialMuted: false,
  };
}

// ── Module-level singleton ──────────────────────────────────────────────────
// React 18+ StrictMode (Vite dev default) double-invokes useMemo factories
// and re-runs effect cleanups, which would construct/destroy multiple
// SoundManagers in quick succession. That race causes Howler to log
// spurious "Decoding audio data failed" warnings (because in-flight
// decodes complete after the first instance's `unload()` clears its
// `_sounds` array, so Howler's internal success-path guard rejects them).
// Keeping a single page-lifetime instance avoids the race entirely; the
// page tab unload is the only real teardown point.
//
// Lazily initialised so server-side / Node imports of this module never
// touch the browser-only Howler globals.

let cachedManager: SoundManager | null = null;

export function getSharedSoundManager(): SoundManager {
  if (!cachedManager) {
    cachedManager = new SoundManager(defaultSoundConfig());
  }
  return cachedManager;
}
