// gen-win-jingles.mjs — synthesizes the game's SIGNATURE win jingle family.
//
// One recognizable motif (a rising C-major fanfare, "da-da-da-DAA") rendered in
// four escalating arrangements — the Pragmatic trick: the same melody at every
// tier is what makes a win sound *recognizable*. Pure additive/FM synthesis
// (no samples, no licensing): bright brass lead + glockenspiel doubling +
// sub impacts + pentatonic sparkle rain + noise riser.
//
//   node scripts/gen-win-jingles.mjs
//
// writes: public/audio/win-small.wav / win-normal.wav / win-big.wav / win-mega.wav
// (16-bit stereo 44.1 kHz — replaces the old Mixkit stock, incl. the mega SIREN)

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');

// ── note table ──────────────────────────────────────────────────────────────
const N = {
  G2: 98.0, C3: 130.81, G3: 196.0,
  C4: 261.63, E4: 329.63, G4: 392.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, Fs5: 739.99, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.0,
  B6: 1975.53, C7: 2093.0, D7: 2349.32, E7: 2637.02, G7: 3135.96,
};

// ── stereo buffer helpers ───────────────────────────────────────────────────
function makeBuf(sec) { const n = Math.ceil(sec * SR); return { L: new Float64Array(n), R: new Float64Array(n), n }; }
function panLR(p) { const t = ((p + 1) / 2) * Math.PI / 2; return [Math.cos(t), Math.sin(t)]; }

/** Bright "brass" — additive harmonics with rolloff + gentle vibrato. */
function brass(buf, t0, dur, f, gain, pan = 0) {
  const [gl, gr] = panLR(pan);
  const s0 = Math.round(t0 * SR), ns = Math.round(dur * SR);
  let phase = 0;
  for (let i = 0; i < ns; i++) {
    const t = i / SR;
    const vib = t > 0.1 ? 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) : 1;
    phase += (2 * Math.PI * f * vib) / SR;
    let v = 0;
    for (let h = 1; h <= 10; h++) v += Math.sin(phase * h) / Math.pow(h, 1.25);
    const atk = Math.min(t / 0.01, 1);
    const rel = t > dur - 0.03 ? (dur - t) / 0.03 : 1;
    const env = atk * Math.exp(-2.2 * t / dur) * Math.max(0, rel);
    const x = v * env * gain * 0.22;
    const idx = s0 + i; if (idx >= buf.n) break;
    buf.L[idx] += x * gl; buf.R[idx] += x * gr;
  }
}

/** Glockenspiel — inharmonic partials with fast exponential decay. */
function bell(buf, t0, dur, f, gain, pan = 0) {
  const [gl, gr] = panLR(pan);
  const parts = [[1, 1, 0.5], [2.76, 0.35, 0.22], [5.4, 0.12, 0.1]];
  const s0 = Math.round(t0 * SR), ns = Math.round(Math.min(dur, 1.4) * SR);
  for (let i = 0; i < ns; i++) {
    const t = i / SR;
    const atk = Math.min(t / 0.002, 1);
    let v = 0;
    for (const [m, a, tau] of parts) v += a * Math.sin(2 * Math.PI * f * m * t) * Math.exp(-t / tau);
    const x = v * atk * gain * 0.5;
    const idx = s0 + i; if (idx >= buf.n) break;
    buf.L[idx] += x * gl; buf.R[idx] += x * gr;
  }
}

/** Sub impact — sine with a fast pitch drop (the "weight" under the chord). */
function sub(buf, t0, f, gain) {
  const s0 = Math.round(t0 * SR), ns = Math.round(0.6 * SR);
  let phase = 0;
  for (let i = 0; i < ns; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * f * (1 + 0.6 * Math.exp(-t / 0.05))) / SR;
    const env = Math.min(t / 0.005, 1) * Math.exp(-t / 0.3);
    const x = Math.sin(phase) * env * gain;
    const idx = s0 + i; if (idx >= buf.n) break;
    buf.L[idx] += x; buf.R[idx] += x;
  }
}

/** Riser — noise swell + a sine gliss up an octave, cut on the downbeat. */
function riser(buf, t0, dur, f0, gain) {
  const s0 = Math.round(t0 * SR), ns = Math.round(dur * SR);
  let phase = 0, noise = 0;
  for (let i = 0; i < ns; i++) {
    const t = i / SR, p = t / dur;
    phase += (2 * Math.PI * (f0 * (1 + p))) / SR;
    noise = 0.6 * noise + 0.4 * (Math.random() * 2 - 1); // cheap lowpass noise
    const rel = p > 0.94 ? (1 - p) / 0.06 : 1;
    const x = (noise * 0.5 + Math.sin(phase) * 0.45) * Math.pow(p, 2.1) * rel * gain;
    const idx = s0 + i; if (idx >= buf.n) break;
    buf.L[idx] += x * 0.9; buf.R[idx] += x * 0.9;
  }
}

/** The signature motif: da-da-da-DAA (rising fanfare). Wide detuned lead + bells. */
function motif(buf, t0, notes, holdDur, gain) {
  const step = 0.115;
  notes.forEach((f, k) => {
    const t = t0 + k * step;
    const dur = k === notes.length - 1 ? holdDur : step + 0.05;
    // wide lead: center + two detuned voices hard-panned
    brass(buf, t, dur, f, gain, 0);
    brass(buf, t, dur, f * 0.9965, gain * 0.55, -0.85);
    brass(buf, t, dur, f * 1.0035, gain * 0.55, 0.85);
    bell(buf, t, dur, f, gain * 0.55, k % 2 ? 0.3 : -0.3);
  });
}

/** Pentatonic sparkle rain. */
function sparkles(buf, t0, dur, scale, count, gain) {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let k = 0; k < count; k++) {
    const t = t0 + (k / count) * dur + rnd() * 0.05;
    bell(buf, t, 0.5, scale[Math.floor(rnd() * scale.length)], gain * (0.7 + rnd() * 0.5), rnd() * 1.6 - 0.8);
  }
}

// ── master + wav writer ─────────────────────────────────────────────────────
function master(buf) {
  let peak = 0;
  for (let i = 0; i < buf.n; i++) peak = Math.max(peak, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  const g = peak > 0 ? 0.88 / peak : 1;
  const fadeIn = Math.round(0.005 * SR), fadeOut = Math.round(0.07 * SR);
  for (let i = 0; i < buf.n; i++) {
    let fl = buf.L[i] * g, fr = buf.R[i] * g;
    fl = Math.tanh(fl * 1.15) / Math.tanh(1.15); fr = Math.tanh(fr * 1.15) / Math.tanh(1.15); // soft glue
    const fade = Math.min(i / fadeIn, (buf.n - 1 - i) / fadeOut, 1);
    buf.L[i] = fl * Math.max(0, fade); buf.R[i] = fr * Math.max(0, fade);
  }
}
function writeWav(path, buf) {
  const bytes = 44 + buf.n * 4;
  const b = Buffer.alloc(bytes);
  b.write('RIFF', 0); b.writeUInt32LE(bytes - 8, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(buf.n * 4, 40);
  for (let i = 0; i < buf.n; i++) {
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf.L[i] * 32767))), 44 + i * 4);
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf.R[i] * 32767))), 46 + i * 4);
  }
  writeFileSync(path, b);
  console.log(`${path}  ${(bytes / 1024).toFixed(0)}kb  ${(buf.n / SR).toFixed(2)}s`);
}

// ── the four arrangements (same motif = recognizable) ───────────────────────
const SPARKLE_C = [N.C6, N.D6, N.E6, N.G6, N.A6, N.C7];
const SPARKLE_G = [N.G6, N.A6, N.B6, N.D7, N.E7, N.G7];

{ // win-small: quick "ta-daa!" — the motif's last two notes.
  const buf = makeBuf(1.15);
  bell(buf, 0, 0.15, N.G5, 0.55, -0.2);
  brass(buf, 0, 0.15, N.G5, 0.3);
  bell(buf, 0.12, 0.9, N.C6, 0.7, 0.1);
  brass(buf, 0.12, 0.55, N.C6, 0.4);
  brass(buf, 0.12, 0.55, N.C6 * 0.9965, 0.22, -0.85);
  brass(buf, 0.12, 0.55, N.C6 * 1.0035, 0.22, 0.85);
  sparkles(buf, 0.3, 0.45, SPARKLE_C, 3, 0.16);
  master(buf); writeWav(join(OUT, 'win-small.wav'), buf);
}

{ // win-normal: the full signature motif.
  const buf = makeBuf(1.8);
  motif(buf, 0.02, [N.C5, N.E5, N.G5, N.C6], 0.7, 0.42);
  brass(buf, 0.365, 0.6, N.E5, 0.16, -0.4); // soft chord under the hold
  brass(buf, 0.365, 0.6, N.G5, 0.16, 0.4);
  sub(buf, 0.365, N.C3, 0.3);
  sparkles(buf, 0.6, 0.6, SPARKLE_C, 4, 0.15);
  master(buf); writeWav(join(OUT, 'win-normal.wav'), buf);
}

{ // win-big: riser → motif → flourish → chord hit.
  const buf = makeBuf(2.6);
  riser(buf, 0, 0.35, N.G4, 0.3);
  motif(buf, 0.35, [N.C5, N.E5, N.G5, N.C6], 0.62, 0.45);
  bell(buf, 1.0, 0.12, N.E6, 0.4, -0.3);
  bell(buf, 1.1, 0.7, N.G6, 0.5, 0.3);
  brass(buf, 1.1, 0.55, N.G6, 0.2);
  for (const [f, p] of [[N.C5, -0.5], [N.E5, -0.17], [N.G5, 0.17], [N.C6, 0.5]]) brass(buf, 1.1, 0.7, f, 0.2, p);
  sub(buf, 1.1, N.C3, 0.42);
  sparkles(buf, 1.25, 0.9, SPARKLE_C, 6, 0.17);
  master(buf); writeWav(join(OUT, 'win-big.wav'), buf);
}

{ // win-mega: riser → motif → motif up a step → triumphant G-major arrival.
  const buf = makeBuf(3.8);
  riser(buf, 0, 0.45, N.G4, 0.34);
  motif(buf, 0.45, [N.C5, N.E5, N.G5, N.C6], 0.5, 0.44);
  motif(buf, 1.35, [N.D5, N.Fs5, N.A5, N.D6], 0.5, 0.47);
  // arrival chord (V→I into G): wide, with bell crown + sub weight
  for (const [f, p] of [[N.G4, -0.6], [N.B4, -0.3], [N.D5, 0], [N.G5, 0.3], [N.D6, 0.6]]) brass(buf, 2.25, 0.95, f, 0.22, p);
  bell(buf, 2.25, 1.2, N.G6, 0.55, 0);
  bell(buf, 2.32, 1.0, N.B6, 0.3, 0.4);
  sub(buf, 2.25, N.G2, 0.5);
  sparkles(buf, 2.45, 1.15, SPARKLE_G, 10, 0.18);
  master(buf); writeWav(join(OUT, 'win-mega.wav'), buf);
}

console.log('done — signature win jingle family rendered.');
