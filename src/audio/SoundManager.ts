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
          volume: binding.volume * this._volume,
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
      const id = howl.play();
      if (opts?.rate) howl.rate(opts.rate, id);
      this.exclusivePlaying.set(eventId, id);
    } else {
      const id = howl.play();
      if (opts?.rate) howl.rate(opts.rate, id);
    }
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
    howl.fade(howl.volume() as number, binding.volume * this._volume, ms);
  }

  /** Fade the currently-playing instance out over `ms`, then stop it. Only
   *  the captured instance is touched, so a NEW play() started during the
   *  fade (back-to-back celebrations) is never killed by the old fade. */
  fadeStop(eventId: string, ms = 600): void {
    const howl = this.howls.get(eventId);
    const binding = this.bindings.get(eventId);
    if (!howl || !binding || !howl.playing()) return;
    const id = this.exclusivePlaying.get(eventId);
    const from = binding.volume * this._volume;
    if (id !== undefined) {
      howl.fade(from, 0, ms, id);
      if (this.exclusivePlaying.get(eventId) === id) this.exclusivePlaying.delete(eventId);
      setTimeout(() => { try { howl.stop(id); } catch { /* torn down */ } }, ms + 40);
    } else {
      howl.fade(from, 0, ms);
      setTimeout(() => { try { howl.stop(); } catch { /* torn down */ } }, ms + 40);
    }
  }

  /**
   * Swap the source URL(s) of an existing event at runtime. Used by the
   * sound-swap UI to preview / commit user-uploaded replacements without
   * rebuilding the manager. The previous Howl is unloaded; the new one
   * inherits the same volume / loop / exclusive flags from the original
   * binding. Returns false if the event ID is unknown.
   */
  replaceSource(eventId: string, src: string[]): boolean {
    const binding = this.bindings.get(eventId);
    if (!binding) return false;

    const prev = this.howls.get(eventId);
    if (prev) {
      try {
        prev.stop();
        prev.unload();
      } catch {
        /* ignore */
      }
    }

    const nextBinding: SoundEventBinding = { ...binding, src };
    this.bindings.set(eventId, nextBinding);
    this.exclusivePlaying.delete(eventId);

    try {
      const howl = new Howl({
        src,
        loop: nextBinding.loop ?? false,
        volume: nextBinding.volume * this._volume,
        mute: this._muted,
        onloaderror: (_id, err) => {
          console.warn(`[audio] failed to load '${eventId}':`, err);
        },
      });
      this.howls.set(eventId, howl);
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
      const binding = this.bindings.get(id);
      if (!binding) continue;
      howl.volume(binding.volume * clamped);
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
