// LibraryBrowser — the big themed sound library of the Audio Studio page.
// Browses src/data/themeSoundLibrary.json (built by the library pipeline):
// category chips, search, optional event filter, single-player audition and
// a per-row "Zuweisen" dropdown that binds a sound to a sound event using
// EXACTLY the SoundLibraryPanel pattern (replaceSource on the shared
// SoundManager + persistence in the assets store) so picks land in Save
// Build / Export like before. Paginated (40 rows) so 400+ entries stay fast.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SoundManager } from '@/audio/SoundManager';
import { loadAssets, saveAssets } from '@/studio/assetPersistence';
import {
  CORE_EVENT_IDS,
  EVENT_LABELS,
  formatDurMs,
  parseThemeSoundLibrary,
  type LibrarySound,
  type ThemeSoundLibrary,
} from './types';

const PAGE_SIZE = 40;

// Build-time static import that tolerates the JSON not existing yet: the
// file is produced by a parallel pipeline. import.meta.glob resolves at
// bundle time — a missing file yields an empty record instead of a hard
// compile error, and the browser shows a hint.
const LIB_MODULES = import.meta.glob('/src/data/themeSoundLibrary.json', { eager: true }) as Record<string, unknown>;

function loadLibrary(): ThemeSoundLibrary | null {
  const mod = LIB_MODULES['/src/data/themeSoundLibrary.json'];
  if (!mod) return null;
  const data = (mod as { default?: unknown }).default ?? mod;
  return parseThemeSoundLibrary(data);
}

export function LibraryBrowser({ soundManager }: { soundManager: SoundManager }) {
  const lib = useMemo(loadLibrary, []);

  const [cat, setCat] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>(() => loadAssets().sounds ?? {});
  /** Transient "✓ zugewiesen" note: soundId → event label. */
  const [lastAssign, setLastAssign] = useState<{ soundId: string; label: string } | null>(null);

  // Preset apply (AudioPresetPanel) rewrites the picks behind our back —
  // refresh the bound-badges when it fires.
  useEffect(() => {
    const refresh = () => setPicks(loadAssets().sounds ?? {});
    window.addEventListener('slot:audio-preset-applied', refresh);
    return () => window.removeEventListener('slot:audio-preset-applied', refresh);
  }, []);

  // ── Single audition player (previous one always stops) ───────────────────
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPreview = () => {
    previewRef.current?.pause();
    previewRef.current = null;
    if (previewTimer.current) { clearTimeout(previewTimer.current); previewTimer.current = null; }
    setPlayingId(null);
  };
  useEffect(() => stopPreview, []); // page leave kills the audition
  const preview = (sound: LibrarySound) => {
    stopPreview();
    // Studio-Audition IMMER hoerbar (Noski: "kann die Beispiel-Sounds nicht
    // abspielen") — der Game-Master stand auf 21%, die Vorschau erbte das
    // und war praktisch stumm. Fixe Vorhoer-Lautstaerke, kein Mute-Gate.
    const a = new Audio(sound.url);
    a.volume = 0.75;
    a.onended = () => stopPreview();
    previewRef.current = a;
    setPlayingId(sound.id);
    void a.play().catch(() => stopPreview());
    // Hard cap so a long file can never keep playing under the game
    // (the double-music bug, Noski).
    previewTimer.current = setTimeout(stopPreview, 10000);
  };

  // ── Binding (the SoundLibraryPanel pattern, 1:1) ─────────────────────────
  const assign = (sound: LibrarySound, eventId: string) => {
    const next = { ...picks, [eventId]: sound.url };
    setPicks(next);
    saveAssets({ sounds: next }); // live in the build store — Save Build fixes it
    const design = soundManager.getEventDefault(eventId);
    soundManager.replaceSource(eventId, [sound.url], design > 0 ? undefined : 0.5);
    if (eventId === 'ambient-music') {
      // MUSIC auditions through the REAL game channel (exclusive Howl) —
      // a second HTMLAudio player would run in parallel forever.
      stopPreview();
      soundManager.play('ambient-music');
    } else {
      preview(sound);
    }
    setLastAssign({ soundId: sound.id, label: EVENT_LABELS[eventId] ?? eventId });
  };

  // ── Filtering + pagination ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!lib) return [];
    const q = query.trim().toLowerCase();
    return lib.sounds.filter(s =>
      (cat === 'all' || s.cat === cat) &&
      (!eventFilter || s.events.includes(eventFilter)) &&
      (!q || s.name.toLowerCase().includes(q)),
    );
  }, [lib, cat, query, eventFilter]);
  const visible = filtered.slice(0, shown);

  /** url → bound event labels (badge on rows whose sound is live). */
  const boundByUrl = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [eventId, url] of Object.entries(picks)) {
      const list = map.get(url) ?? [];
      list.push(EVENT_LABELS[eventId] ?? eventId);
      map.set(url, list);
    }
    return map;
  }, [picks]);

  if (!lib) {
    return (
      <div className="rounded-[6px] border border-dashed border-[var(--color-border)] p-3 text-[11px] leading-snug text-[var(--color-text-secondary)]">
        Theme-Sound-Library fehlt oder ist leer (<span className="font-mono">src/data/themeSoundLibrary.json</span>).
        Sie wird von der Library-Pipeline erzeugt — danach diese Seite neu laden.
      </div>
    );
  }

  const chip = (id: string, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => { setCat(id); setShown(PAGE_SIZE); }}
      className={`shrink-0 rounded-[var(--radius-pill)] border px-2 py-[3px] text-[10px] font-semibold transition-colors ${
        cat === id
          ? 'border-[#f7b733] bg-[#f7b733] text-black'
          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      {/* category chips — horizontally scrollable */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {chip('all', 'Alle', lib.sounds.length)}
        {lib.categories.map(c => chip(c.id, c.name, c.count))}
      </div>

      {/* search + event filter */}
      <div className="flex items-center gap-1.5">
        <input
          type="search"
          value={query}
          onChange={e => { setQuery(e.target.value); setShown(PAGE_SIZE); }}
          placeholder="Suchen…"
          aria-label="Library durchsuchen"
          className="h-[24px] flex-1 min-w-0 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)]"
        />
        <select
          value={eventFilter}
          onChange={e => { setEventFilter(e.target.value); setShown(PAGE_SIZE); }}
          aria-label="Nach Event filtern"
          className="h-[24px] w-[128px] shrink-0 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] text-[var(--color-text-primary)]"
        >
          <option value="">Alle Events</option>
          {CORE_EVENT_IDS.map(id => (
            <option key={id} value={id}>{EVENT_LABELS[id] ?? id}</option>
          ))}
        </select>
      </div>

      {/* rows (paginated) */}
      <div className="flex flex-col gap-[3px]">
        {visible.map(s => {
          const bound = boundByUrl.get(s.url);
          const playing = playingId === s.id;
          return (
            <div
              key={s.id}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-[3px]"
            >
              <button
                type="button"
                title={playing ? 'Stopp' : 'Anhören'}
                onClick={() => (playing ? stopPreview() : preview(s))}
                className={`h-[22px] w-[24px] shrink-0 rounded-[4px] border text-[10px] transition-colors ${
                  playing
                    ? 'border-[#f7b733] text-[#f7b733]'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]'
                }`}
              >{playing ? '■' : '▶'}</button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-[var(--color-text-primary)]" title={s.name}>{s.name}</div>
                <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-text-secondary)]">
                  <span className="tabular-nums">{formatDurMs(s.durMs)}</span>
                  {bound && bound.length > 0 && (
                    <span className="truncate text-[#f7b733]" title={bound.join(', ')}>
                      gebunden: {bound.join(' · ')}
                    </span>
                  )}
                  {lastAssign?.soundId === s.id && (
                    <span className="text-[#8be28b]">✓ {lastAssign.label}</span>
                  )}
                </div>
              </div>
              <select
                value=""
                onChange={e => { if (e.target.value) assign(s, e.target.value); }}
                aria-label={`${s.name} einem Event zuweisen`}
                className="h-[22px] w-[110px] shrink-0 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] text-[var(--color-text-primary)]"
              >
                <option value="">Zuweisen…</option>
                {(s.events.length ? CORE_EVENT_IDS.filter(id => s.events.includes(id)) : []).map(id => (
                  <option key={`fit-${id}`} value={id}>★ {EVENT_LABELS[id] ?? id}</option>
                ))}
                {CORE_EVENT_IDS.filter(id => !s.events.includes(id)).map(id => (
                  <option key={id} value={id}>{EVENT_LABELS[id] ?? id}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-2 text-center text-[11px] text-[var(--color-text-secondary)]">Keine Treffer.</div>
      )}
      {filtered.length > shown && (
        <button
          type="button"
          onClick={() => setShown(n => n + PAGE_SIZE)}
          className="self-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-[4px] text-[10px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
        >Mehr laden ({filtered.length - shown} weitere)</button>
      )}

      <div className="text-[9px] leading-snug text-[var(--color-text-secondary)] opacity-70">
        Zuweisung ist sofort im Build aktiv · „Save Build" fixiert sie im Slot · Export nimmt sie mit.
      </div>
    </div>
  );
}
