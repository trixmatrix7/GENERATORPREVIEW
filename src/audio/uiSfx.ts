// uiSfx — subtle UI button sounds (Noski: "allgemein dezenter Button-Sound,
// cleane dezente Sounds, keine harten"). Sources are curated CC0 picks from
// the baked Mixkit library. Deliberately tiny + independent of the
// SoundManager registry (UI chrome, not game events); volume sits low.

import { getSharedSoundManager } from './defaultSoundConfig';

const L = `${import.meta.env.BASE_URL}audio/library/`;

const SRC = {
  click: `${L}reel-stop/modern-technology-select-fa3707.ogg`, // measured: 13ms attack, -25dB
  spin: `${L}reel-stop/cool-interface-click-tone-adc015.ogg`, // spin button
  open: `${L}reel-stop/opening-software-interface-7bf9ce.ogg`,// buy page opens
} as const;

const cache = new Map<string, HTMLAudioElement>();

function play(url: string, volume: number): void {
  try {
    // UI chrome follows the MASTER mute/volume (Noski: mute killed nothing
    // here — HTMLAudio bypasses the Howler channels).
    const sm = getSharedSoundManager();
    if (sm.muted) return;
    let a = cache.get(url);
    if (!a) {
      a = new Audio(url);
      cache.set(url, a);
    }
    a.currentTime = 0;
    a.volume = Math.max(0, Math.min(1, volume * sm.volume));
    void a.play().catch(() => undefined);
  } catch { /* no audio context yet */ }
}

export const uiSfx = {
  click: () => play(SRC.click, 0.22),
  spin: () => play(SRC.spin, 0.3),
  open: () => play(SRC.open, 0.28),
};
