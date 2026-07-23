// AudioPresetPanel — audio presets PER SLOT (Vice / Crack Farm / Fruit
// Stacks via loadActiveGame). One preset = a full snapshot of the audio
// state: bindings (event → library-URL picks), volume-slider overrides
// ('slot:audio-event-volumes') and clean params ('slot:audio-clean').
// Applying restores all three: bindings via the SoundLibraryPanel pattern
// (replaceSource + assets-store persistence, so Save Build carries them),
// volumes via setEventOverride (live + persisted), clean via localStorage —
// then dispatches 'slot:audio-preset-applied'.

import { useState } from 'react';
import type { SoundManager } from '@/audio/SoundManager';
import { loadAssets, saveAssets } from '@/studio/assetPersistence';
import { defaultSoundConfig } from '@/audio/defaultSoundConfig';
import { loadActiveGame } from '@/studio/buildPresets';
import {
  audioPresetsKey,
  CLEAN_STORAGE_KEY,
  VOLUMES_STORAGE_KEY,
  type AudioPreset,
  type AudioPresetData,
} from './types';

const GAME_LABELS: Record<string, string> = {
  vice: 'Vice Heat',
  crackfarm: 'Crack Farm',
  fruitstacks: 'Fruit Stacks',
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function loadPresets(game: string): AudioPreset[] {
  const list = readJson<unknown>(audioPresetsKey(game), []);
  return Array.isArray(list) ? (list as AudioPreset[]) : [];
}

function persistPresets(game: string, presets: AudioPreset[]): void {
  try { localStorage.setItem(audioPresetsKey(game), JSON.stringify(presets)); }
  catch { /* quota — keep session state */ }
}

export function AudioPresetPanel({ soundManager }: { soundManager: SoundManager }) {
  const [game] = useState(() => loadActiveGame());
  const [presets, setPresets] = useState<AudioPreset[]>(() => loadPresets(game));
  const [name, setName] = useState('');
  const [appliedId, setAppliedId] = useState<number | null>(null);

  const snapshot = (): AudioPresetData => ({
    bindings: { ...(loadAssets().sounds ?? {}) },
    volumes: readJson<Record<string, number>>(VOLUMES_STORAGE_KEY, {}),
    clean: readJson<Record<string, unknown>>(CLEAN_STORAGE_KEY, {}),
  });

  const save = () => {
    const preset: AudioPreset = {
      id: Date.now(),
      name: name.trim() || `Preset ${presets.length + 1}`,
      ts: Date.now(),
      data: snapshot(),
    };
    const next = [preset, ...presets];
    setPresets(next);
    persistPresets(game, next);
    setName('');
  };

  const apply = (preset: AudioPreset) => {
    const bindings = preset.data.bindings ?? {};

    // 1) Events whose pick disappears with this preset → back to the game's
    //    default source (the SoundLibraryPanel "Game-Default" path: the swap
    //    stops + unloads the running howl, the restored default stays silent).
    const current = loadAssets().sounds ?? {};
    for (const eventId of Object.keys(current)) {
      if (bindings[eventId]) continue;
      const def = defaultSoundConfig().events.find(e => e.id === eventId);
      if (def) soundManager.replaceSource(eventId, [...def.src], def.volume, def.loop);
      if (eventId !== 'ambient-music') soundManager.stop(eventId);
    }

    // 2) Bindings live via replaceSource + persisted in the assets store
    //    (Save Build / Export carry them — the SoundLibraryPanel pattern).
    for (const [eventId, url] of Object.entries(bindings)) {
      const design = soundManager.getEventDefault(eventId);
      soundManager.replaceSource(eventId, [url], design > 0 ? undefined : 0.5);
    }
    saveAssets({ sounds: { ...bindings } });

    // 3) Volume overrides: full replace, live + persisted (setEventOverride
    //    writes 'slot:audio-event-volumes' itself).
    soundManager.clearEventOverrides();
    for (const [eventId, v] of Object.entries(preset.data.volumes ?? {})) {
      if (typeof v === 'number' && Number.isFinite(v)) soundManager.setEventOverride(eventId, v);
    }

    // 4) Clean params for the clean consumer.
    try { localStorage.setItem(CLEAN_STORAGE_KEY, JSON.stringify(preset.data.clean ?? {})); }
    catch { /* quota */ }

    // The restored music bed takes over immediately.
    soundManager.play('ambient-music');

    window.dispatchEvent(new CustomEvent('slot:audio-preset-applied', {
      detail: { game, id: preset.id, name: preset.name },
    }));
    // Clean params changed with the preset — let the clean runtime reload them.
    window.dispatchEvent(new CustomEvent('slot:audio-clean-updated'));
    setAppliedId(preset.id);
  };

  const remove = (id: number) => {
    const next = presets.filter(p => p.id !== id);
    setPresets(next);
    persistPresets(game, next);
    if (appliedId === id) setAppliedId(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-[var(--color-text-secondary)]">
        Slot: <span className="font-semibold text-[#f7b733]">{GAME_LABELS[game] ?? game}</span>
        {' '}· Snapshot aus Bindings + Volumes + Clean
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
          placeholder="Preset-Name…"
          aria-label="Preset-Name"
          className="h-[24px] flex-1 min-w-0 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)]"
        />
        <button
          type="button"
          onClick={save}
          className="h-[24px] shrink-0 rounded-[var(--radius-pill)] border border-[#f7b733] px-2.5 text-[10px] font-semibold text-[#f7b733] transition-colors hover:bg-[#f7b733] hover:text-black"
        >Preset speichern</button>
      </div>

      {presets.length === 0 && (
        <div className="py-1 text-[10px] text-[var(--color-text-secondary)] opacity-70">
          Noch keine Presets für diesen Slot gespeichert.
        </div>
      )}

      <div className="flex flex-col gap-[3px]">
        {presets.map(p => {
          const nSounds = Object.keys(p.data.bindings ?? {}).length;
          const nVols = Object.keys(p.data.volumes ?? {}).length;
          return (
            <div
              key={p.id}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-[3px]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-[var(--color-text-primary)]" title={p.name}>
                  {p.name}
                  {appliedId === p.id && <span className="ml-1 text-[9px] text-[#8be28b]">✓ aktiv</span>}
                </div>
                <div className="text-[9px] text-[var(--color-text-secondary)]">
                  {new Date(p.ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {' '}· {nSounds} Sounds · {nVols} Volumes
                </div>
              </div>
              <button
                type="button"
                onClick={() => apply(p)}
                className="h-[22px] shrink-0 rounded-[4px] border border-[var(--color-border)] px-2 text-[10px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
              >Anwenden</button>
              <button
                type="button"
                title="Löschen"
                onClick={() => remove(p.id)}
                className="h-[22px] w-[22px] shrink-0 rounded-[4px] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] transition-colors hover:border-[#ff8a8a] hover:text-[#ff8a8a]"
              >✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
