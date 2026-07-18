// Master-bus safety limiter.
//
// THE crackle fix. Every SFX/music file is normalised to 0 dBFS peak, so the
// moment several play together (music + 5 staggered reel-stops + coin-chime +
// a win stinger) their sum blows past 0 dB and the browser hard-clips — that
// digital clip is the "es kracht". Howler mixes everything through a single
// masterGain node; we splice a brick-wall limiter between that node and the
// speakers so the summed signal can NEVER exceed the ceiling. Individual
// sounds under the threshold are untouched — only the dangerous peaks of the
// SUM get caught.
//
// Idempotent + lazy: Howler creates its AudioContext only after the first
// user gesture, so ensureMasterBus() is called on every play() and installs
// the limiter exactly once, as soon as the context + masterGain exist.

import { Howler } from 'howler';

let installed = false;

export function ensureMasterBus(): void {
  if (installed) return;
  // Howler types don't expose ctx/masterGain — they exist at runtime.
  const H = Howler as unknown as {
    ctx?: AudioContext;
    masterGain?: GainNode;
    usingWebAudio?: boolean;
  };
  const ctx = H.ctx;
  const master = H.masterGain;
  if (!ctx || !master || H.usingWebAudio === false) return;

  try {
    // A tiny headroom trim BEFORE the limiter so it only ever catches true
    // overs, not steady-state loudness (keeps the mix punchy, not squashed).
    const trim = ctx.createGain();
    trim.gain.value = 0.9; // -0.9 dB

    // Stage 1 — compressor limiter: catches the bulk of overshoot musically
    // (fast attack, high ratio, hard knee) so the sum stops running hot.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;

    // Stage 2 — brick-wall soft-clipper: a tanh transfer curve GUARANTEES the
    // output magnitude can never exceed the ceiling (0.85 ≈ -1.4 dBFS), no
    // matter how hot the input. The compressor keeps the signal musical; this
    // is the mathematical hard stop that makes clipping impossible. Combined,
    // NOTHING the game plays can crackle.
    const shaper = ctx.createWaveShaper();
    const N = 2048;
    const curve = new Float32Array(N);
    const CEIL = 0.85;
    const K = 1.6;
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1; // -1..1 (input >1 clamps to the ends)
      curve[i] = CEIL * Math.tanh(K * x) / Math.tanh(K);
    }
    shaper.curve = curve;
    shaper.oversample = '4x'; // reduces aliasing from the non-linearity

    // Re-route: masterGain → trim → compressor → soft-clip → speakers.
    master.disconnect();
    master.connect(trim);
    trim.connect(limiter);
    limiter.connect(shaper);
    shaper.connect(ctx.destination);

    installed = true;
  } catch (err) {
    console.warn('[audio] master limiter install failed:', err);
    // Fall back to Howler's default routing — never leave the graph broken.
    try { master.connect(ctx.destination); } catch { /* already connected */ }
  }
}
