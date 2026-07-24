// SoundParamsPanel — per-event volume sliders (the studio "SOUND" section).
// Every core sound event gets its own 0-100% slider so Noski can tweak the
// mix live (background music, reel spin/drop, connection, wins …). Values
// are USER OVERRIDES on the SoundManager: they win over the game wiring's
// design volumes and persist across reloads (slot:audio-event-volumes).
// RESET returns to the game's tuned defaults.

import { useEffect, useState } from 'react';
import type { SoundManager } from '@/audio/SoundManager';

interface Row {
  label: string;
  /** All event ids this slider drives (groups: e.g. every quip-*). */
  ids: string[];
}

const CORE_ROWS: Row[] = [
  { label: 'Background-Musik', ids: ['ambient-music'] },
  { label: 'Reel-Spin-Loop', ids: ['reel-spin-loop'] },
  { label: 'Spin-Start', ids: ['spin-start'] },
  { label: 'Reel-Drop', ids: ['reel-stop'] },
  { label: 'Connection-Wisch', ids: ['coin-chime'] },
  { label: 'Win-Marquee-Musik', ids: ['win-marquee'] },
  { label: 'Scatter-Land', ids: ['scatter-land'] },
  { label: 'Win-Jingles (S/M/L)', ids: ['win-small', 'win-normal', 'win-big'] },
  { label: 'Tease (Riser/Miss)', ids: ['tease-riser', 'tease-miss'] },
  { label: 'Wild-Land', ids: ['wild-land'] },
  { label: 'Wild-Expand', ids: ['wild-expand'] },
  { label: 'Multi-Flug', ids: ['multi-fly'] },
  { label: 'Multi-Collect', ids: ['multi-collect'] },
  { label: 'Multi-Apply (Win xN)', ids: ['multi-apply'] },
  { label: 'FS-Trigger', ids: ['free-spin-trigger'] },
  { label: 'Near-Miss-Tease', ids: ['near-miss-tease'] },
  { label: 'Win-Jingle XL (Mega)', ids: ['win-mega'] },
  { label: 'Tally-Ticks (Count-Up)', ids: ['win-tally-tick', 'win-tally-end'] },
  { label: 'Tier-Up-Slam', ids: ['tier-up'] },
];

export function SoundParamsPanel({ soundManager }: { soundManager: SoundManager }) {
  const [, force] = useState(0);
  useEffect(() => soundManager.subscribe(() => force(n => n + 1)), [soundManager]);

  // Tier-Quips (Crack Farm per-symbol voices) as ONE grouped slider — only
  // when the game actually registered quip events.
  const quipIds = soundManager.listEventIds().filter(id => id.startsWith('quip-'));
  const rows: Row[] = quipIds.length
    ? [...CORE_ROWS, { label: 'Tier-Quips', ids: quipIds }]
    : CORE_ROWS;

  const setRow = (row: Row, v: number) => {
    for (const id of row.ids) soundManager.setEventOverride(id, v);
  };

  return (
    <div className="flex flex-col gap-[7px]">
      {rows.map(row => {
        const v = soundManager.getEventVolume(row.ids[0]);
        const overridden = row.ids.some(id => soundManager.hasEventOverride(id));
        return (
          <div key={row.label} className="flex items-center gap-2">
            <span
              className="w-[118px] shrink-0 truncate text-[10px] tracking-wide"
              style={{ color: overridden ? 'var(--color-yellow)' : 'var(--color-text-secondary)' }}
              title={row.ids.join(', ')}
            >{row.label}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(v * 100)}
              onChange={e => setRow(row, Number(e.target.value) / 100)}
              aria-label={`${row.label} volume`}
              className="h-1 flex-1 cursor-pointer accent-[var(--color-blue)]"
            />
            <span className="w-[30px] shrink-0 text-right text-[10px] tabular-nums text-[var(--color-text-secondary)]">
              {Math.round(v * 100)}%
            </span>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => soundManager.clearEventOverrides()}
        className="mt-1 self-start rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2 py-[3px] text-[10px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
      >Reset auf Game-Defaults</button>
    </div>
  );
}
