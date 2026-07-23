// Clean-Budgets — per-event playback budgets for the Clean-Sounds engine
// (src/audio/soundCleaner.ts).
//
// Problem: user-picked library sounds can be too long or start late. Before
// export, every bound sound is auto-trimmed to its event's timing — WITHOUT
// re-encoding. The cleaner only computes PLAYBACK parameters that Howler
// already supports (sprite window, volume gain, fade-out); these budgets are
// the per-event timing contract.
//
// The maxMs values come from our frame-measured presentation work
// (research/slot-feel/): a reel-stop thud must be done in ~350ms or it smears
// into the next stagger step, the tally tick sits on a ~70ms grid so 80ms is
// the ceiling, the tease riser runs the full ~2.6s tease window, etc.
//
// SKIP events (ambient-music, win-marquee, reel-spin-loop) are music beds /
// loops — they are managed by their own fade choreography in SoundManager and
// must NEVER be trimmed by this engine.

export interface CleanBudget {
  /** Maximum playback window measured from the detected onset, in ms. */
  maxMs: number;
  /** Fade-out applied at the end of the window, in ms. */
  fadeOutMs: number;
  /** Loudness target in dBFS the peak is normalized towards. */
  targetPeakDb: number;
  /** true = never touch this event (loops / music beds). */
  skip?: boolean;
}

/** Global loudness target: peaks are pulled towards -3 dBFS. */
export const TARGET_PEAK_DB = -3;

/** Default fade-out: 12% of the budget window, but never under 30ms. */
export function defaultFadeOutMs(maxMs: number): number {
  return Math.max(30, Math.round(maxMs * 0.12));
}

function budget(maxMs: number, fadeOutMs?: number): CleanBudget {
  return {
    maxMs,
    fadeOutMs: fadeOutMs ?? defaultFadeOutMs(maxMs),
    targetPeakDb: TARGET_PEAK_DB,
  };
}

function skipBudget(): CleanBudget {
  return { maxMs: 0, fadeOutMs: 0, targetPeakDb: TARGET_PEAK_DB, skip: true };
}

/**
 * Per-event clean budgets, keyed by soundEvents registry id
 * (src/registries/soundEvents.ts). Events without an entry here (e.g. the
 * per-symbol quip-N voices) are left untouched by the cleaner.
 */
export const CLEAN_BUDGETS: Readonly<Record<string, CleanBudget>> = {
  // Spin mechanics — tight one-shots on the reel choreography grid.
  'spin-start': budget(600),
  'reel-stop': budget(350),

  // Landing accents.
  'wild-land': budget(400),
  'scatter-land': budget(400),
  'wild-expand': budget(900),
  'coin-chime': budget(500),

  // Win tier stings.
  'win-small': budget(1500),
  'win-normal': budget(1800),
  'win-big': budget(2500),
  'win-mega': budget(3000),
  'free-spin-trigger': budget(2000),

  // Tease / marquee choreography.
  'near-miss-tease': budget(800),
  'tease-miss': budget(800),
  'tier-up': budget(900),
  // Tally tick sits on a ~70ms grid — the sample must be gone before the
  // next tick fires, so a hard 80ms cap with a snappy 20ms fade.
  'win-tally-tick': budget(80, 20),
  'win-tally-end': budget(700),
  // Riser runs the whole tease window; the long 300ms tail keeps the cut
  // from clicking when the resolve lands mid-sweep.
  'tease-riser': budget(2600, 300),

  // SKIP — loops & music beds, managed by their own fade choreography.
  'ambient-music': skipBudget(),
  'win-marquee': skipBudget(),
  'reel-spin-loop': skipBudget(),
};

/** Budget lookup; undefined = event unknown to the cleaner (leave as-is). */
export function getCleanBudget(eventId: string): CleanBudget | undefined {
  return CLEAN_BUDGETS[eventId];
}
