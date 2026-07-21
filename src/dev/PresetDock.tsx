// PresetDock — fixed bottom-left panel: instant grid switch (5×5 ↔ 5×3, the
// generator's two grids) + named slot presets. A preset snapshots the current
// grid + every Assets-tab swap (symbols/bg/frame/fsBg/expanding wild); clicking
// one applies it and reloads so the whole stack (engine grid, cell backdrops,
// frame, borders) re-derives exactly like a fresh boot. Presets persist in
// localStorage until deleted — build many slots, test each in one click.

import { useState } from 'react';
import { loadAssets, replaceAssets, type SavedAssets } from '@/studio/assetPersistence';
import { MATH_PROFILES, loadMathProfileId, saveMathProfileId } from '@/config/mathProfiles';

export type GridId = '5x5' | '5x3' | '6x5';
const GRID_KEY = 'studio-grid';
const PRESETS_KEY = 'studio-presets';

export function loadGridId(): GridId {
  const g = localStorage.getItem(GRID_KEY);
  return g === '5x3' ? '5x3' : g === '6x5' ? '6x5' : '5x5';
}

interface SlotPreset {
  id: number;
  name: string;
  grid: GridId;
  assets: SavedAssets;
}

function loadPresets(): SlotPreset[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') as SlotPreset[]; }
  catch { return []; }
}

export function PresetDock({ grid, onGrid }: { grid: GridId; onGrid: (g: GridId) => void }) {
  const [presets, setPresets] = useState<SlotPreset[]>(loadPresets);
  const [open, setOpen] = useState(true);

  const persist = (next: SlotPreset[]) => {
    setPresets(next);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch { /* quota */ }
  };

  const savePreset = () => {
    const name = window.prompt('Preset name?', `Slot ${presets.length + 1} (${grid})`);
    if (!name) return;
    persist([...presets, { id: Date.now(), name, grid, assets: loadAssets() }]);
  };

  const applyPreset = (p: SlotPreset) => {
    replaceAssets(p.assets);
    localStorage.setItem(GRID_KEY, p.grid);
    window.location.reload(); // full re-derive: engine grid + all visuals
  };

  const btn = (active: boolean) => ({
    background: active ? '#2563eb' : '#222', color: '#fff',
    border: '1px solid ' + (active ? '#2563eb' : '#444'), borderRadius: 4,
    padding: '3px 8px', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
  } as const);

  return (
    <div style={{
      position: 'fixed', left: 10, bottom: 10, zIndex: 60, width: 190,
      background: 'rgba(0,0,0,0.55)', border: '1px solid #2a2a2e', borderRadius: 8,
      padding: 8, color: '#fff', fontSize: 11, fontFamily: 'monospace',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        background: 'transparent', border: 'none', color: '#F8FA5E', fontFamily: 'monospace',
        fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: 0,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>GRID + PRESETS</span><span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (<>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" style={btn(grid === '5x5')} onClick={() => onGrid('5x5')}>5×5</button>
          <button type="button" style={btn(grid === '5x3')} onClick={() => onGrid('5x3')}>5×3</button>
          <button type="button" style={btn(grid === '6x5')} onClick={() => onGrid('6x5')}>6×5</button>
          <button type="button" style={{ ...btn(false), marginLeft: 'auto', color: '#8fe6a0' }} onClick={savePreset} title="Snapshot the current grid + all asset swaps as a named preset">
            + Save
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ color: '#9aa', fontSize: 10, letterSpacing: 1 }}>MATH</span>
          {MATH_PROFILES.map(m => (
            <button key={m.id} type="button" title={m.description}
              onClick={() => { saveMathProfileId(m.id); window.location.reload(); }}
              style={btn(loadMathProfileId() === m.id)}>
              {m.name}
            </button>
          ))}
        </div>
        {presets.map(p => (
          <div key={p.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => applyPreset(p)}
              title={`Apply "${p.name}" (${p.grid}) — swaps grid + assets instantly`}
              style={{ ...btn(false), flex: 1, textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
            >
              {p.name} <span style={{ color: '#888' }}>· {p.grid}</span>
            </button>
            <button type="button" onClick={() => persist(presets.filter(x => x.id !== p.id))} title="Delete preset"
              style={{ ...btn(false), color: '#ff7a6b', padding: '3px 6px' }}>×</button>
          </div>
        ))}
        {presets.length === 0 && <span style={{ color: '#777' }}>No presets yet — set up a slot, hit + Save.</span>}
      </>)}
    </div>
  );
}
