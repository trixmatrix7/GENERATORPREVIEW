// AudioStudioPage — the second page of the studio: slot preview as an
// iframe on the left, a large audio rail on the right (LibraryBrowser +
// AudioPresetPanel + the existing SoundParamsPanel volume sliders). Dark
// studio theme following StudioDrawer / SoundLibraryPanel conventions.
//
// "Clean Sounds" runs cleanAll from src/audio/soundCleaner.ts over the
// currently bound event → URL picks (the SoundLibraryPanel persistence
// shape), persists the resulting params and notifies the runtime via the
// 'slot:audio-clean-updated' CustomEvent.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getSharedSoundManager } from '@/audio/defaultSoundConfig';
import { cleanAll, saveCleanParams } from '@/audio/soundCleaner';
import { loadAssets } from '@/studio/assetPersistence';
import { SoundParamsPanel } from '@/ui/components/SoundParamsPanel';
import { LibraryBrowser } from './LibraryBrowser';
import { AudioPresetPanel } from './AudioPresetPanel';
import { describeCleanResult, EVENT_LABELS } from './types';

interface Props {
  onBack: () => void;
  iframeSrc: string;
  onExport: () => void;
}

interface CleanProgress {
  done: number;
  total: number;
  eventId: string;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-[#2a2a2e] bg-[#141417] p-3">
      <h2
        className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >{title}</h2>
      {children}
    </section>
  );
}

export function AudioStudioPage(props: Props) {
  const soundManager = useMemo(() => getSharedSoundManager(), []);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState<CleanProgress | null>(null);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [cleanNote, setCleanNote] = useState<string | null>(null);

  // The slot runs in a same-origin iframe with its OWN window: forward the
  // audio CustomEvents into it (best effort) so its runtime can react
  // without a reload. localStorage is shared either way.
  useEffect(() => {
    const forward = (e: Event) => {
      try {
        const win = iframeRef.current?.contentWindow;
        if (win && win !== window) win.dispatchEvent(new CustomEvent(e.type));
      } catch { /* cross-origin — persistence still carries it on reload */ }
    };
    window.addEventListener('slot:audio-clean-updated', forward);
    window.addEventListener('slot:audio-preset-applied', forward);
    return () => {
      window.removeEventListener('slot:audio-clean-updated', forward);
      window.removeEventListener('slot:audio-preset-applied', forward);
    };
  }, []);

  const runClean = async () => {
    if (cleaning) return;
    // Bindings = the currently bound event → URL picks (the SoundLibraryPanel
    // persistence shape in the assets store).
    const bindings: Record<string, string> = { ...(loadAssets().sounds ?? {}) };
    const total = Object.keys(bindings).length;
    if (total === 0) {
      setCleanNote('Keine Library-Picks gebunden — erst Sounds zuweisen, Clean arbeitet auf den gebundenen Event-Sounds.');
      setResults(null);
      return;
    }
    setCleaning(true);
    setResults(null);
    setCleanNote(null);
    setProgress({ done: 0, total, eventId: '' });
    try {
      const map = await cleanAll(bindings, (done: number, totalCount: number, eventId: string) => {
        setProgress({ done, total: totalCount, eventId });
      });
      saveCleanParams(map);
      setResults(map as Record<string, unknown>);
      window.dispatchEvent(new CustomEvent('slot:audio-clean-updated'));
    } catch (err) {
      setCleanNote(`Clean fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCleaning(false);
      setProgress(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-[#0b0b0e] text-[#f4f4f5]"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* ── header ── */}
      <div className="flex h-[54px] shrink-0 items-center gap-3 border-b border-[#2a2a2e] px-4">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1.5 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
        >← Zurück zum Studio</button>
        <h1
          className="text-[15px] font-bold tracking-[0.2em] text-[#f7b733]"
          style={{ fontFamily: 'var(--font-display)' }}
        >AUDIO STUDIO</h1>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => { void runClean(); }}
          disabled={cleaning}
          className="rounded-[var(--radius-pill)] border border-[#f7b733] px-3 py-1.5 text-[11px] font-semibold text-[#f7b733] transition-colors hover:bg-[#f7b733] hover:text-black disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#f7b733]"
        >
          {cleaning && progress
            ? `Clean… ${progress.done}/${progress.total}`
            : 'Clean Sounds'}
        </button>
        <button
          type="button"
          onClick={props.onExport}
          className="rounded-[var(--radius-pill)] bg-[#FFE168] px-3.5 py-1.5 text-[11px] font-bold text-black shadow-md transition-opacity hover:opacity-90"
        >Export Build</button>
      </div>

      {/* ── body: iframe left, audio rail right ── */}
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <iframe
          ref={iframeRef}
          src={props.iframeSrc}
          title="Slot-Vorschau"
          allow="autoplay"
          className="h-full min-w-[55%] flex-1 rounded-[12px] border border-[#2a2a2e] bg-black"
        />
        <div className="flex w-[460px] max-w-[45%] shrink-0 flex-col gap-3 overflow-y-auto pr-1">
          {(cleaning || results !== null || cleanNote) && (
            <Section title="Clean Sounds">
              {cleaning && progress && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] text-[var(--color-text-primary)]">
                    {progress.done}/{progress.total}
                    {progress.eventId && (
                      <span className="text-[var(--color-text-secondary)]">
                        {' '}— {EVENT_LABELS[progress.eventId] ?? progress.eventId}
                      </span>
                    )}
                  </div>
                  <div className="h-[4px] w-full overflow-hidden rounded-[2px] bg-[var(--color-surface-raised)]">
                    <div
                      className="h-full rounded-[2px] bg-[#f7b733] transition-[width]"
                      style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {cleanNote && (
                <div className="text-[11px] leading-snug text-[#ff8a8a]">{cleanNote}</div>
              )}
              {results !== null && (
                <div className="flex flex-col gap-[3px]">
                  {Object.entries(results).length === 0 && (
                    <div className="text-[10px] text-[var(--color-text-secondary)]">Keine Ergebnisse.</div>
                  )}
                  {Object.entries(results).map(([eventId, params]) => (
                    <div key={eventId} className="flex items-baseline gap-1.5 text-[10px]">
                      <span className="w-[118px] shrink-0 truncate text-[var(--color-text-secondary)]" title={eventId}>
                        {EVENT_LABELS[eventId] ?? eventId}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]" title={describeCleanResult(params)}>
                        {describeCleanResult(params)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="Sound-Bibliothek">
            <LibraryBrowser soundManager={soundManager} />
          </Section>

          <Section title="Audio-Presets">
            <AudioPresetPanel soundManager={soundManager} />
          </Section>

          {/* Existing volume sliders — SoundParamsPanel only needs the shared
              SoundManager, so it mounts here as-is. */}
          <Section title="Volumes">
            <SoundParamsPanel soundManager={soundManager} />
          </Section>
        </div>
      </div>
    </div>
  );
}
