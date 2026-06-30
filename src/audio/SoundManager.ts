// audio/SoundManager.ts — Layer 11. Procedural Web-Audio synth for every cue in
// the registry (no asset files needed; auto-upgrades to OGG later if wired).
// Browsers block audio until a gesture → call unlock() on first click.

import type { SoundEventEntry } from '../registries/types';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private loops = new Map<string, { stop: () => void }>();
  private _muted = false;
  private _volume = 0.6;

  unlock(): void {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : this._volume;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this._volume;
  }
  isMuted(): boolean {
    return this._muted;
  }
  setVolume(v: number): void {
    this._volume = v;
    if (this.master && !this._muted) this.master.gain.value = v;
  }

  play(entry: SoundEventEntry, pitchMul = 1): void {
    if (!this.ctx || !this.master || this._muted) return;
    if (entry.loop) {
      this.startLoop(entry);
      return;
    }
    const now = this.ctx.currentTime;
    this.oneShot(entry, entry.synth.freq ? entry.synth.freq * pitchMul : undefined, now);
  }

  private oneShot(entry: SoundEventEntry, freqOverride: number | undefined, t0: number): void {
    const ctx = this.ctx!;
    const dur = (entry.synth.durationMs ?? 200) / 1000;
    const gain = ctx.createGain();
    gain.connect(this.master!);
    const vol = entry.volume;
    const f = freqOverride ?? entry.synth.freq ?? 440;

    switch (entry.synth.type) {
      case 'noise':
      case 'thud': {
        const osc = ctx.createOscillator();
        osc.type = entry.synth.type === 'thud' ? 'sine' : 'square';
        osc.frequency.setValueAtTime(f, t0);
        if (entry.synth.type === 'thud') osc.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.4), t0 + dur);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
        break;
      }
      case 'sweep':
      case 'riser':
      case 'wobble': {
        const osc = ctx.createOscillator();
        osc.type = entry.synth.type === 'riser' ? 'sawtooth' : 'triangle';
        const to = entry.synth.freqTo ?? f * 2;
        osc.frequency.setValueAtTime(f, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
        break;
      }
      case 'chime':
      case 'tone':
      default: {
        const osc = ctx.createOscillator();
        osc.type = entry.synth.type === 'chime' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        // soft second partial for chime
        if (entry.synth.type === 'chime') {
          const osc2 = ctx.createOscillator();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(f * 2, t0);
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.0001, t0);
          g2.gain.exponentialRampToValueAtTime(vol * 0.4, t0 + 0.01);
          g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.7);
          osc2.connect(g2);
          g2.connect(this.master!);
          osc2.start(t0);
          osc2.stop(t0 + dur);
        }
        osc.connect(gain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
        break;
      }
    }
  }

  startLoop(entry: SoundEventEntry): void {
    if (!this.ctx || !this.master || this.loops.has(entry.id) || this._muted) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = entry.volume * 0.6;
    gain.connect(this.master);

    if (entry.synth.type === 'noise') {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      src.connect(lp);
      lp.connect(gain);
      src.start();
      this.loops.set(entry.id, { stop: () => { try { src.stop(); } catch { /* */ } gain.disconnect(); } });
    } else {
      // wobble / tone loop with an LFO
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const f = entry.synth.freq ?? 440;
      const to = entry.synth.freqTo ?? f * 1.5;
      osc.frequency.value = f;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 2;
      lfoGain.gain.value = (to - f) / 2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      osc.start();
      lfo.start();
      this.loops.set(entry.id, { stop: () => { try { osc.stop(); lfo.stop(); } catch { /* */ } gain.disconnect(); } });
    }
  }

  stopLoop(id: string): void {
    const l = this.loops.get(id);
    if (l) {
      l.stop();
      this.loops.delete(id);
    }
  }

  stopAllLoops(): void {
    for (const [, l] of this.loops) l.stop();
    this.loops.clear();
  }
}
