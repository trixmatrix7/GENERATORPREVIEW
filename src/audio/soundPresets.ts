// Curated sound PRESETS over the CC0 library — one click sets the whole
// mix. "Ultra Clean" (Noski, AAA+ pass 2026-07-22) was picked NUMERICALLY:
// every candidate measured (attack time, duration, peak/RMS, spectral
// centroid, decay tail) and the cleanest per event chosen — short bright
// pops, soft sweeps, fast attacks, no noisy tails. Volumes follow the
// measured-reference mix rule (research/slot-feel/14 §6): stops nearly
// inaudible, wins carry, music sits low underneath.

const L = `${import.meta.env.BASE_URL}audio/library/`;

export interface SoundPreset {
  id: string;
  name: string;
  /** eventId → { url, volume } — applied via replaceSource. */
  events: Record<string, { url: string; volume: number }>;
}

/** Measured picks (290 candidates, scratchpad lib_analysis): shortest
 *  attacks, zero noisy tails, bright-but-soft spectra, low resting RMS. */
export const ULTRA_CLEAN: SoundPreset = {
  id: 'ultra-clean',
  name: 'Ultra Clean (AAA)',
  events: {
    // tumble pop — 0.53s, 33ms attack, bright 3.5kHz, zero tail
    'coin-chime': { url: `${L}coin-chime/space-coin-win-notification-cc796e.ogg`, volume: 0.38 },
    // board land — 0.22s, 1ms attack, -25dB resting (nearly inaudible tap)
    'reel-stop': { url: `${L}reel-stop/cool-interface-click-tone-adc015.ogg`, volume: 0.2 },
    // spin start — soft 0.8s sweep
    'spin-start': { url: `${L}spin-start/fast-small-sweep-transition-a5ee99.ogg`, volume: 0.22 },
    // plate impact — 0.15s deep 0.9kHz thud
    'wild-land': { url: `${L}reel-stop/arcade-game-jump-coin-fdb57d.ogg`, volume: 0.34 },
    // gift flight — soft low whoosh
    'wild-expand': { url: `${L}spin-start/arrow-whoosh-4ba7f0.ogg`, volume: 0.16 },
    // scatter — quiet magic bubbles (attack 26ms, -23dB)
    'scatter-land': { url: `${L}scatter-land/magic-bubbles-spell-f303f8.ogg`, volume: 0.42 },
    // FS trigger — clean 1.75s winning notification
    'free-spin-trigger': { url: `${L}free-spin-trigger/winning-notification-64c08f.ogg`, volume: 0.55 },
    // tease riser — very quiet (-35dB) cybernetic rise
    'near-miss-tease': { url: `${L}near-miss-tease/cybernetic-technology-affirmation-3c6642.ogg`, volume: 0.45 },
    // marquee — 4.1s payout fanfare
    'win-marquee': { url: `${L}win-marquee/payout-award-d55ce2.ogg`, volume: 0.8 },
    // music bed — constant-energy 3min track, sits LOW under the SFX
    'ambient-music': { url: `${L}ambient-music/adone-6fddec.ogg`, volume: 0.16 },
  },
};

export const SOUND_PRESETS: SoundPreset[] = [ULTRA_CLEAN];
