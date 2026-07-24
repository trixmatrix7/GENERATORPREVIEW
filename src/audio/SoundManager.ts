// SoundManager — thin wrapper around Howler.js mapping our sound-event
// registry IDs to playable Howl instances.
//
// Design goals:
//   - Single audio context shared across all events (Howler's default).
//   - Per-event default volume + master volume + mute, all persisted.
//   - Graceful degradation: missing files log but never throw, so the engine
//     still runs silent if audio assets aren't present.
//   - Web Audio gesture gate handled by Howler automatically; we don't try
//     to play anything until the player presses Spin (which counts as a
//     gesture in every browser).
//
// Sound paths are configured per-game via SoundManagerConfig so generated
// games (with their own asset packs) can swap them without code changes.

import { Howl } from 'howler';
import { ensureMasterBus } from './masterBus';

export interface SoundEventBinding {
  /** Sound-event registry ID (e.g. 'spin-start'). */
  id: string;
  /** Source URL(s). Howler picks the first format the browser supports. */
  src: string[];
  /** Per-event default volume 0–1 (multiplied by master volume). */
  volume: number;
  /** Whether to loop. Use for ambient music. */
  loop?: boolean;
  /**
   * If true, calling play() while already playing replaces the previous
   * sound (useful for ambient music). Defaults to false (overlap).
   */
  exclusive?: boolean;
}

export interface SoundManagerConfig {
  events: SoundEventBinding[];
  initialVolume: number;
  initialMuted: boolean;
}

const STORAGE_KEY = 'slot:audio-prefs';
// Per-event USER volume overrides (the studio's SOUND panel). An override
// WINS over the game wiring's design volume (setEventVolume/replaceSource)
// so Noski's tweaks survive theme boots + reloads.
const EVENT_VOL_KEY = 'slot:audio-event-volumes';
// CLEAN-SOUNDS playback params (Audio Studio "Clean Sounds"): per event a
// computed trim window + gain so a too-long / late-onset pick still hits the
// event's timing budget. Applied at PLAY time (seek + per-id volume + timed
// fade-stop) — no re-encoding. Written by src/audio/soundCleaner.ts.
const CLEAN_KEY = 'slot:audio-clean';

interface CleanPlayback {
  offsetMs: number;
  durMs: number;
  fadeOutMs: number;
  gainDb: number;
}

let cleanCache: Record<string, CleanPlayback> | null = null;
function getCleanParams(eventId: string): CleanPlayback | null {
  if (cleanCache === null) {
    try { cleanCache = JSON.parse(window.localStorage.getItem(CLEAN_KEY) ?? '{}') as Record<string, CleanPlayback>; }
    catch { cleanCache = {}; }
  }
  const cp = cleanCache[eventId];
  return cp && Number.isFinite(cp.durMs) && cp.durMs > 0 ? cp : null;
}
/** Re-read the clean map (Audio Studio just re-ran Clean Sounds — also fired
 *  cross-frame via the storage event into the embed preview). */
export function reloadCleanParams(): void { cleanCache = null; }

function loadEventOverrides(): Map<string, number> {
  const out = new Map<string, number>();
  if (typeof window === 'undefined') return out;
  try {
    const raw = window.localStorage.getItem(EVENT_VOL_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, number>;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out.set(k, Math.max(0, Math.min(1, v)));
    }
  } catch { /* corrupt prefs */ }
  return out;
}

interface PersistedPrefs {
  volume: number;
  muted: boolean;
}

function loadPrefs(): PersistedPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedPrefs>;
    if (typeof parsed.volume === 'number' && typeof parsed.muted === 'boolean') {
      return { volume: parsed.volume, muted: parsed.muted };
    }
  } catch {
    /* ignore corrupt prefs */
  }
  return null;
}

function savePrefs(prefs: PersistedPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors */
  }
}

export class SoundManager {
  private howls = new Map<string, Howl>();
  private bindings = new Map<string, SoundEventBinding>();
  private exclusivePlaying = new Map<string, number>(); // eventId → soundId
  private overrides = loadEventOverrides();
  private _volume: number;
  private _muted: boolean;
  private listeners = new Set<() => void>();

  constructor(config: SoundManagerConfig) {
    const prefs = loadPrefs();
    this._volume = prefs?.volume ?? config.initialVolume;
    this._muted = prefs?.muted ?? config.initialMuted;

    for (const binding of config.events) {
      this.bindings.set(binding.id, binding);
      try {
        const howl = new Howl({
          src: binding.src,
          loop: binding.loop ?? false,
          volume: this.effVolume(binding.id),
          mute: this._muted,
          onloaderror: (_id, err) => {
            // Do not throw — game must keep running silently.
            console.warn(`[audio] failed to load '${binding.id}':`, err);
          },
        });
        this.howls.set(binding.id, howl);
      } catch (err) {
        console.warn(`[audio] failed to construct Howl for '${binding.id}':`, err);
      }
    }
  }

  /** Play a sound by registry ID. No-op if the binding is missing.
   *  `opts.rate` pitches THIS instance (1 = normal) — used for the rising
   *  per-connection tally ladder. */
  play(eventId: string, opts?: { rate?: number }): void {
    const howl = this.howls.get(eventId);
    const binding = this.bindings.get(eventId);
    if (!howl || !binding) return;
    // Install the master-bus limiter as soon as the audio context is live
    // (idempotent) — this is what stops overlapping sounds from clipping.
    ensureMasterBus();

    if (binding.exclusive) {
      const prev = this.exclusivePlaying.get(eventId);
      if (prev !== undefined && howl.playing(prev)) {
        // Already playing — leave it alone.
        return;
      }
      // HART alle Ids dieses Howls stoppen, bevor eine neue startet: vor dem
      // Audio-Unlock meldet Howler gequeute Sounds als "not playing" — jeder
      // Boot-Aufruf passierte so den Guard und queuete eine WEITERE Instanz;
      // beim Unlock starteten alle zusammen und drifteten hoerbar auseinander
      // (Noski: "Musik ueberlappt sich irgendwann und spielt doppelt").
      try { howl.stop(); } catch { /* fresh howl */ }
      const id = howl.play();
      if (opts?.rate) howl.rate(opts.rate, id);
      this.exclusivePlaying.set(eventId, id);
    } else {
      const id = howl.play();
      if (opts?.rate) howl.rate(opts.rate, id);
      this.applyClean(eventId, howl, id);
    }
  }

  /** Apply the Clean-Sounds trim window to ONE playing instance: seek to the
   *  onset, gain-correct, and fade-stop at the budget end. Loops/exclusive
   *  music never get clean params (the cleaner skips them), so this only
   *  ever touches one-shot SFX instances. */
  private applyClean(eventId: string, howl: Howl, id: number): void {
    const cp = getCleanParams(eventId);
    if (!cp) return;
    try {
      if (cp.offsetMs > 5) howl.seek(cp.offsetMs / 1000, id);
      const gainMul = Math.min(4, Math.max(0.2, Math.pow(10, cp.gainDb / 20)));
      howl.volume(this.effVolume(eventId) * gainMul, id);
      const fadeAt = Math.max(0, cp.durMs - cp.fadeOutMs);
      window.setTimeout(() => {
        try {
          if (!howl.playing(id)) return;
          howl.fade(howl.volume(id) as number, 0, Math.max(20, cp.fadeOutMs), id);
          window.setTimeout(() => { try { howl.stop(id); } catch { /* gone */ } }, cp.fadeOutMs + 40);
        } catch { /* torn down */ }
      }, fadeAt);
    } catch { /* seek unsupported mid-load — play uncleaned */ }
  }

  /** Re-read the per-event volume overrides from localStorage and apply them
   *  live — used by the EMBED preview when the Audio Studio (parent page)
   *  changes volumes and the storage event fires into this frame. */
  reloadEventOverrides(): void {
    this.overrides = loadEventOverrides();
    for (const [id, howl] of this.howls) {
      try { howl.volume(this.effVolume(id)); } catch { /* torn down */ }
    }
    this.notify();
  }

  /** EFFECTIVE per-event volume: user override (SOUND panel) wins over the
   *  binding's design volume; master multiplies on top. */
  private effVolume(eventId: string): number {
    const design = this.bindings.get(eventId)?.volume ?? 0;
    return (this.overrides.get(eventId) ?? design) * this._volume;
  }

  /** Set one event's resting volume (0 = silent). Used to mute sounds that
   *  have no approved recording yet — silence beats a placeholder. */
  setEventVolume(eventId: string, volume: number): void {
    const binding = this.bindings.get(eventId);
    if (!binding) return;
    this.bindings.set(eventId, { ...binding, volume });
    const howl = this.howls.get(eventId);
    if (howl) { try { howl.volume(this.effVolume(eventId)); } catch { /* torn down */ } }
  }

  // ── Per-event USER overrides (studio SOUND panel) ────────────────────────

  /** The value the SOUND panel shows: override if set, else design volume. */
  getEventVolume(eventId: string): number {
    return this.overrides.get(eventId) ?? this.bindings.get(eventId)?.volume ?? 0;
  }

  /** The game wiring's design volume (RESET target). */
  getEventDefault(eventId: string): number {
    return this.bindings.get(eventId)?.volume ?? 0;
  }

  hasEventOverride(eventId: string): boolean {
    return this.overrides.has(eventId);
  }

  /** Set (or clear with null) a user override; applies live + persists. */
  setEventOverride(eventId: string, volume: number | null): void {
    if (volume === null) this.overrides.delete(eventId);
    else this.overrides.set(eventId, Math.max(0, Math.min(1, volume)));
    const howl = this.howls.get(eventId);
    if (howl) { try { howl.volume(this.effVolume(eventId)); } catch { /* torn down */ } }
    try {
      window.localStorage.setItem(EVENT_VOL_KEY, JSON.stringify(Object.fromEntries(this.overrides)));
    } catch { /* quota */ }
    this.notify();
  }

  clearEventOverrides(): void {
    this.overrides.clear();
    for (const [id, howl] of this.howls) {
      try { howl.volume(this.effVolume(id)); } catch { /* torn down */ }
    }
    try { window.localStorage.removeItem(EVENT_VOL_KEY); } catch { /* quota */ }
    this.notify();
  }

  /** All registered event ids (for the SOUND panel's row list). */
  listEventIds(): string[] {
    return [...this.bindings.keys()];
  }

  /** True once this event's audio file actually decoded. Used to fall back
   *  gracefully while an optional sound (e.g. a per-symbol win voice) has not
   *  been dropped in yet — a missing file loads as 'unloaded'. */
  hasLoaded(eventId: string): boolean {
    const howl = this.howls.get(eventId);
    if (!howl) return false;
    try { return howl.state() === 'loaded'; } catch { return false; }
  }

  /** Stop a sound (typically used for looping ambient music). */
  stop(eventId: string): void {
    const howl = this.howls.get(eventId);
    if (!howl) return;
    howl.stop();
    this.exclusivePlaying.delete(eventId);
  }

  /** DUCK a playing loop to silence WITHOUT stopping it — the loop keeps
   *  running muted underneath (used for ambient music while the win-marquee
   *  track plays). unduck() fades the bound volume back in. */
  duck(eventId: string, ms = 350): void {
    const howl = this.howls.get(eventId);
    if (!howl || !howl.playing()) return;
    howl.fade(howl.volume() as number, 0, ms);
  }

  unduck(eventId: string, ms = 450): void {
    const howl = this.howls.get(eventId);
    const binding = this.bindings.get(eventId);
    if (!howl || !binding || !howl.playing()) return;
    // Restore the BOUND volume unconditionally — mute is an orthogonal layer
    // (howl.mute()), so a muted session must still land on the right volume.
    howl.fade(howl.volume() as number, this.effVolume(eventId), ms);
  }

  /** Fade the currently-playing instance out over `ms`, then stop it. Only
   *  the captured instance is touched, so a NEW play() started during the
   *  fade (back-to-back celebrations) is never killed by the old fade. */
  fadeStop(eventId: string, ms = 600): void {
    const howl = this.howls.get(eventId);
    const binding = this.bindings.get(eventId);
    if (!howl || !binding || !howl.playing()) return;
    const id = this.exclusivePlaying.get(eventId);
    const from = this.effVolume(eventId);
    if (id !== undefined) {
      howl.fade(from, 0, ms, id);
      if (this.exclusivePlaying.get(eventId) === id) this.exclusivePlaying.delete(eventId);
      setTimeout(() => {
        try { howl.stop(id); howl.volume(from); } catch { /* torn down */ }
      }, ms + 40);
    } else {
      howl.fade(from, 0, ms);
      setTimeout(() => {
        // CRITICAL: fade() leaves the Howl's volume at 0. Without restoring it
        // the NEXT play() is silent — that's why the reel rattle only sounded
        // on the first spin (Noski).
        try { howl.stop(); howl.volume(from); } catch { /* torn down */ }
      }, ms + 40);
    }
  }

  /**
   * Swap the source URL(s) of an existing event at runtime. Used by the
   * sound-swap UI to preview / commit user-uploaded replacements without
   * rebuilding the manager. The previous Howl is unloaded; the new one
   * inherits the same volume / loop / exclusive flags from the original
   * binding. Returns false if the event ID is unknown.
   */
  replaceSource(eventId: string, src: string[], volume?: number, loop?: boolean): boolean {
    const binding = this.bindings.get(eventId);
    if (!binding) return false;

    const prev = this.howls.get(eventId);
    const wasPlaying = prev ? prev.playing() : false;
    if (prev) {
      try {
        prev.stop();
        prev.unload();
      } catch {
        /* ignore */
      }
    }

    // Optional per-swap volume override (e.g. a theme wants its music bed at a
    // different resting level than the default binding).
    const nextBinding: SoundEventBinding = {
      ...binding, src,
      volume: volume ?? binding.volume,
      loop: loop ?? binding.loop,
    };
    this.bindings.set(eventId, nextBinding);
    this.exclusivePlaying.delete(eventId);

    try {
      const howl = new Howl({
        src,
        loop: nextBinding.loop ?? false,
        volume: this.effVolume(eventId),
        mute: this._muted,
        onloaderror: (_id, err) => {
          console.warn(`[audio] failed to load '${eventId}':`, err);
        },
      });
      this.howls.set(eventId, howl);
      // If the old source was mid-play (e.g. a looping music bed), keep it
      // playing seamlessly on the new source.
      if (wasPlaying) {
        const id = howl.play();
        if (nextBinding.exclusive) this.exclusivePlaying.set(eventId, id);
      }
      return true;
    } catch (err) {
      console.warn(`[audio] failed to construct Howl for '${eventId}':`, err);
      this.howls.delete(eventId);
      return false;
    }
  }

  stopAll(): void {
    for (const howl of this.howls.values()) {
      howl.stop();
    }
    this.exclusivePlaying.clear();
  }

  /** Set master volume 0–1. Persists to localStorage. */
  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this._volume = clamped;
    for (const [id, howl] of this.howls) {
      if (!this.bindings.has(id)) continue;
      howl.volume(this.effVolume(id));
    }
    this.persist();
    this.notify();
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    for (const howl of this.howls.values()) {
      howl.mute(muted);
    }
    this.persist();
    this.notify();
  }

  toggleMuted(): void {
    this.setMuted(!this._muted);
  }

  get volume(): number {
    return this._volume;
  }

  get muted(): boolean {
    return this._muted;
  }

  /** Subscribe to state changes (volume/muted). Returns an unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Tear down all Howl instances. Call on app unmount. */
  destroy(): void {
    for (const howl of this.howls.values()) {
      try {
        howl.unload();
      } catch {
        /* ignore */
      }
    }
    this.howls.clear();
    this.bindings.clear();
    this.exclusivePlaying.clear();
    this.listeners.clear();
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private persist(): void {
    savePrefs({ volume: this._volume, muted: this._muted });
  }
}
