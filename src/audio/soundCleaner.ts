// Clean-Sounds engine — trims user-picked sounds to their event timing
// WITHOUT re-encoding. It analyzes the decoded audio (onset, peak, duration)
// and computes pure PLAYBACK parameters that Howler applies at play time.
//
// ============================= INTEGRATION =================================
// SoundManager applies a CleanParams entry when (re)building the Howl for an
// event (see loadCleanParams() for the persisted map):
//
//   const clean = cleanMap[eventId];
//   const howl = new Howl({
//     src,
//     // Sprite window: skip dead air, cap the length to the event budget.
//     ...(clean ? { sprite: { clean: [clean.offsetMs, clean.durMs] } } : {}),
//     // Loudness: multiply the bound volume by the linear gain.
//     volume: effVolume(eventId) * (clean ? Math.pow(10, clean.gainDb / 20) : 1),
//   });
//   // Play the sprite instead of the full file:
//   const id = clean ? howl.play('clean') : howl.play();
//   // Fade-out: Howler sprites HARD-cut at the window end, so schedule the
//   // fade to land exactly on the cut (and on any early fadeStop):
//   if (clean && clean.fadeOutMs > 0) {
//     setTimeout(() => howl.fade(howl.volume() as number, 0, clean.fadeOutMs, id),
//                Math.max(0, clean.durMs - clean.fadeOutMs));
//   }
//   // (Remember the existing lesson: fade() leaves volume at 0 — restore the
//   // bound volume before the next play(), same as in fadeStop().)
//
// SKIP events (ambient-music, win-marquee, reel-spin-loop) and unknown event
// ids never get params — their playback stays untouched.
// ===========================================================================

import { getCleanBudget, type CleanBudget } from './cleanBudgets.ts';

/** Result of analyzing a decoded buffer. All times in ms. */
export interface SoundAnalysis {
  /** Detected onset (first block above -40 dBFS minus 5ms pre-roll, >= 0). */
  onsetMs: number;
  /** Absolute sample peak across all channels, in dBFS (<= 0 for real audio). */
  peakDb: number;
  /** Total material duration. */
  durMs: number;
}

/** Playback parameters Howler applies without touching the file. */
export interface CleanParams {
  /** Sprite start: playback begins here (skips dead air before the onset). */
  offsetMs: number;
  /** Sprite length: capped at the event budget, never longer than material. */
  durMs: number;
  /** Fade-out scheduled to end exactly at the sprite cut. */
  fadeOutMs: number;
  /** Volume gain in dB (linear factor = 10^(gainDb/20)), clamped [-12, +9]. */
  gainDb: number;
}

/** Map of eventId -> CleanParams, as persisted for the export build. */
export type CleanParamsMap = Record<string, CleanParams>;

export type CleanProgress = (done: number, total: number, eventId: string) => void;

// Onset detection: first analysis block whose peak exceeds -40 dBFS.
const ONSET_THRESHOLD_DB = -40;
// Pre-roll kept before the detected block so soft attacks aren't clipped.
const ONSET_PRE_ROLL_MS = 5;
// Block size in samples (~2.7ms @ 48kHz) — fine enough for tick-length SFX.
const ONSET_BLOCK_SAMPLES = 128;
// Gain clamp: never duck more than -12dB, never boost more than +9dB.
const GAIN_MIN_DB = -12;
const GAIN_MAX_DB = 9;
// dBFS floor reported for digital silence (log10(0) is -Infinity).
const SILENCE_FLOOR_DB = -100;

const STORAGE_KEY = 'slot:audio-clean';

function ampToDb(amp: number): number {
  if (amp <= 0) return SILENCE_FLOOR_DB;
  return Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(amp));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Scan a decoded buffer for onset, peak and duration. Block-based scan across
 * ALL channels: the onset is the start of the first block whose absolute peak
 * crosses -40 dBFS, minus a 5ms pre-roll (never below 0).
 */
export function analyzeBuffer(buf: AudioBuffer): SoundAnalysis {
  const threshold = Math.pow(10, ONSET_THRESHOLD_DB / 20);
  const channels: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    channels.push(buf.getChannelData(c));
  }

  let peak = 0;
  let onsetSample = -1;
  for (let start = 0; start < buf.length; start += ONSET_BLOCK_SAMPLES) {
    const end = Math.min(start + ONSET_BLOCK_SAMPLES, buf.length);
    let blockPeak = 0;
    for (const data of channels) {
      for (let i = start; i < end; i++) {
        const amp = Math.abs(data[i]);
        if (amp > blockPeak) blockPeak = amp;
      }
    }
    if (blockPeak > peak) peak = blockPeak;
    if (onsetSample < 0 && blockPeak >= threshold) onsetSample = start;
  }

  const durMs = (buf.length / buf.sampleRate) * 1000;
  // All-silent material: treat the onset as 0 so downstream math stays sane.
  const rawOnsetMs = onsetSample < 0 ? 0 : (onsetSample / buf.sampleRate) * 1000;
  const onsetMs = Math.max(0, rawOnsetMs - ONSET_PRE_ROLL_MS);

  return { onsetMs, peakDb: ampToDb(peak), durMs };
}

/**
 * Combine an analysis with an event budget into playback parameters.
 * - offset skips the dead air before the onset,
 * - duration is capped at budget.maxMs but never exceeds the material,
 * - the fade always fits inside the window,
 * - gain pulls the peak to targetPeakDb, clamped to [-12, +9] dB.
 */
export function computeClean(analysis: SoundAnalysis, budget: CleanBudget): CleanParams {
  const materialMs = Math.max(0, analysis.durMs - analysis.onsetMs);
  const durMs = Math.min(budget.maxMs, materialMs);
  const fadeOutMs = Math.min(budget.fadeOutMs, durMs);
  const gainDb = clamp(budget.targetPeakDb - analysis.peakDb, GAIN_MIN_DB, GAIN_MAX_DB);
  return {
    offsetMs: Math.round(analysis.onsetMs),
    durMs: Math.round(durMs),
    fadeOutMs: Math.round(fadeOutMs),
    gainDb: Math.round(gainDb * 10) / 10,
  };
}

/**
 * Fetch + decode one bound sound and compute its CleanParams.
 * Returns null for skip events, unknown event ids, and any fetch/decode
 * failure — a null simply means "play this sound untouched".
 */
export async function cleanEvent(
  url: string,
  eventId: string,
  ctx: AudioContext,
): Promise<CleanParams | null> {
  const budget = getCleanBudget(eventId);
  if (!budget || budget.skip) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(bytes);
    return computeClean(analyzeBuffer(buf), budget);
  } catch {
    return null;
  }
}

/**
 * Clean every binding (eventId -> audio URL) sequentially. Single failures
 * are swallowed (that event just stays untrimmed); progress fires after each
 * event either way. Uses one shared AudioContext and closes it when done.
 */
export async function cleanAll(
  bindings: Record<string, string>,
  onProgress?: CleanProgress,
): Promise<CleanParamsMap> {
  const result: CleanParamsMap = {};
  const entries = Object.entries(bindings);
  if (entries.length === 0) return result;
  if (typeof AudioContext === 'undefined') return result;

  const ctx = new AudioContext();
  try {
    let done = 0;
    for (const [eventId, url] of entries) {
      const params = await cleanEvent(url, eventId, ctx);
      if (params) result[eventId] = params;
      done += 1;
      onProgress?.(done, entries.length, eventId);
    }
  } finally {
    try {
      await ctx.close();
    } catch {
      /* context already torn down */
    }
  }
  return result;
}

function isCleanParams(value: unknown): value is CleanParams {
  if (value === null || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.offsetMs === 'number' &&
    typeof o.durMs === 'number' &&
    typeof o.fadeOutMs === 'number' &&
    typeof o.gainDb === 'number'
  );
}

/** Persist the computed map (localStorage 'slot:audio-clean'). */
export function saveCleanParams(map: CleanParamsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota exceeded / privacy mode — cleaning is recomputable, ignore */
  }
}

/** Load the persisted map; null if absent or unreadable. Entries that fail
 *  shape validation are dropped instead of poisoning the whole map. */
export function loadCleanParams(): CleanParamsMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const map: CleanParamsMap = {};
    for (const [eventId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isCleanParams(value)) map[eventId] = value;
    }
    return map;
  } catch {
    return null;
  }
}
