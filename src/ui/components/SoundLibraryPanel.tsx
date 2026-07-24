// SoundLibraryPanel — the curated CC0 sound library (Mixkit, ~30 per event,
// categories mapped per research/slot-feel/05). Pick → hear it instantly →
// it is LIVE in the running build at once (replaceSource + persisted in the
// assets store, so Save Build fixes it into the slot and Export carries it).

import { useRef, useState } from 'react';
import type { SoundManager } from '@/audio/SoundManager';
import { loadAssets, saveAssets } from '@/studio/assetPersistence';
import library from '@/data/soundLibrary.json';
import { SOUND_PRESETS } from '@/audio/soundPresets';
import { defaultSoundConfig } from '@/audio/defaultSoundConfig';

const LIB = library as Record<string, { name: string; url: string }[]>;

const LABELS: Record<string, string> = {
  'ambient-music': 'Background-Musik',
  'reel-spin-loop': 'Reel-Spin-Loop',
  'spin-start': 'Spin-Start',
  'reel-stop': 'Reel-Drop',
  'coin-chime': 'Connection-Win',
  'win-marquee': 'Win-Marquee',
  'scatter-land': 'Scatter-Land',
  'wild-land': 'Wild-Land',
  'multi-fly': 'Multi-Flug',
  'multi-collect': 'Multi-Collect',
  'multi-apply': 'Multi-Apply (Win xN)',
  'free-spin-trigger': 'FS-Trigger',
  'fs-counter-down': 'FS-Counter runter',
  'fs-counter-up': 'FS-Counter hoch (Retrigger)',
  'fs-retrigger': 'FS-Retrigger (+5)',
  'near-miss-tease': 'Near-Miss-Riser',
  'win-small': 'Win-Jingle S',
  'win-normal': 'Win-Jingle M',
  'win-big': 'Win-Jingle L',
  'tease-riser': 'Tease-Riser',
  'tease-miss': 'Tease-Miss',
};

export function SoundLibraryPanel({ soundManager }: { soundManager: SoundManager }) {
  const [picks, setPicks] = useState<Record<string, string>>(() => loadAssets().sounds ?? {});
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPreview = () => {
    previewRef.current?.pause();
    previewRef.current = null;
    if (previewTimer.current) { clearTimeout(previewTimer.current); previewTimer.current = null; }
  };
  const preview = (url: string) => {
    stopPreview();
    if (soundManager.muted) return; // master mute covers auditions too
    const a = new Audio(url);
    // Floor 0.5: bei leisem Game-Master bleibt die Audition trotzdem hoerbar
    a.volume = Math.max(0.5, Math.min(1, 0.8 * soundManager.volume));
    previewRef.current = a;
    void a.play().catch(() => undefined);
    // SFX previews are short anyway; hard-stop after 4s so a long file can
    // never keep playing under the game (the double-music bug, Noski).
    previewTimer.current = setTimeout(stopPreview, 4000);
  };

  const apply = (eventId: string, url: string) => {
    const next = { ...picks };
    if (url) next[eventId] = url;
    else delete next[eventId];
    setPicks(next);
    saveAssets({ sounds: next }); // live in the build store — Save Build fixes it
    if (!url) {
      // BACK TO GAME-DEFAULT: restore the original source — replaceSource
      // stops + unloads the running howl, so a playing library sound (the
      // stuck win-marquee, Noski) dies instantly instead of looping on.
      stopPreview();
      const def = defaultSoundConfig().events.find(e => e.id === eventId);
      if (def) soundManager.replaceSource(eventId, [...def.src], def.volume, def.loop);
      // replaceSource carries a was-playing state over — the restored default
      // must stay SILENT (only the music bed keeps running).
      if (eventId === 'ambient-music') soundManager.play('ambient-music');
      else soundManager.stop(eventId);
      return;
    }
    if (url) {
      const design = soundManager.getEventDefault(eventId);
      soundManager.replaceSource(eventId, [url], design > 0 ? undefined : 0.5);
      if (eventId === 'ambient-music') {
        // MUSIC auditions through the REAL game channel (exclusive Howl) —
        // a second HTMLAudio player would run in parallel forever.
        stopPreview();
        soundManager.play('ambient-music');
      } else {
        preview(url);
      }
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = SOUND_PRESETS.find(pr => pr.id === presetId);
    if (!preset) return;
    stopPreview(); // kill any lingering audition player first
    const next = { ...picks };
    for (const [eventId, def] of Object.entries(preset.events)) {
      next[eventId] = def.url;
      soundManager.replaceSource(eventId, [def.url], def.volume);
      soundManager.setEventOverride(eventId, def.volume); // persists + tweakable
    }
    setPicks(next);
    saveAssets({ sounds: next });
    soundManager.play('ambient-music'); // the new bed takes over immediately
  };

  return (
    <div className="flex flex-col gap-[7px]">
      {/* one-click curated mixes */}
      <div className="flex gap-1.5">
        {SOUND_PRESETS.map(pr => (
          <button
            key={pr.id}
            type="button"
            onClick={() => applyPreset(pr.id)}
            className="rounded-[var(--radius-pill)] border border-[var(--color-yellow)] px-2 py-[3px] text-[10px] font-semibold text-[var(--color-yellow)] transition-colors hover:bg-[var(--color-yellow)] hover:text-black"
          >✨ {pr.name}</button>
        ))}
      </div>
      {Object.entries(LABELS).map(([eventId, label]) => {
        const options = LIB[eventId] ?? [];
        if (options.length === 0) return null;
        const cur = picks[eventId] ?? '';
        return (
          <div key={eventId} className="flex items-center gap-1.5">
            <span
              className="w-[104px] shrink-0 truncate text-[10px] tracking-wide"
              style={{ color: cur ? 'var(--color-yellow)' : 'var(--color-text-secondary)' }}
              title={eventId}
            >{label}</span>
            <select
              value={cur}
              onChange={e => apply(eventId, e.target.value)}
              aria-label={`${label} library sound`}
              className="h-[22px] flex-1 min-w-0 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] text-[var(--color-text-primary)]"
            >
              <option value="">— Game-Default —</option>
              {options.map(o => (
                <option key={o.url} value={o.url}>{o.name}</option>
              ))}
            </select>
            <button
              type="button"
              title="Anhören"
              onClick={() => cur ? preview(cur) : undefined}
              disabled={!cur}
              className="h-[22px] w-[24px] shrink-0 rounded-[4px] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
            >▶</button>
          </div>
        );
      })}
      <div className="text-[9px] leading-snug text-[var(--color-text-secondary)] opacity-70">
        Auswahl ist sofort im Build aktiv · „Save Build" fixiert sie im Slot · Export nimmt sie mit. Quelle: Mixkit (CC-frei, kommerziell nutzbar).
      </div>
    </div>
  );
}
