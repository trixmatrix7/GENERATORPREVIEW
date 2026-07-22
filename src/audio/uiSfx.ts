// uiSfx — subtle UI button sounds (Noski: "allgemein dezenter Button-Sound,
// cleane dezente Sounds, keine harten"). Sources are curated CC0 picks from
// the baked Mixkit library. Deliberately tiny + independent of the
// SoundManager registry (UI chrome, not game events); volume sits low.

const L = `${import.meta.env.BASE_URL}audio/library/`;

const SRC = {
  click: `${L}reel-stop/select-click-d230e8.ogg`,             // generic soft tap
  spin: `${L}reel-stop/cool-interface-click-tone-adc015.ogg`, // spin button
  open: `${L}reel-stop/opening-software-interface-7bf9ce.ogg`,// buy page opens
} as const;

const cache = new Map<string, HTMLAudioElement>();

function play(url: string, volume: number): void {
  try {
    let a = cache.get(url);
    if (!a) {
      a = new Audio(url);
      cache.set(url, a);
    }
    a.currentTime = 0;
    a.volume = volume;
    void a.play().catch(() => undefined);
  } catch { /* no audio context yet */ }
}

export const uiSfx = {
  click: () => play(SRC.click, 0.22),
  spin: () => play(SRC.spin, 0.3),
  open: () => play(SRC.open, 0.28),
};
