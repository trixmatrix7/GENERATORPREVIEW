// BUILD DOCK — the generator-style build management around the game frame:
//   BuildTopBar  (ABOVE the game): name field + SAVE BUILD / CREATE NEW
//                (naked scaffold, all assets + sheets thrown out) / EXPORT
//                (standalone game-preset JSON download).
//   BuildSlots   (BELOW the game, centred): the saved builds as slot chips —
//                click applies + reloads; the Vice base game is always slot 1.

import { useEffect, useState } from 'react';
import {
  listBuilds, saveBuild, deleteBuild, applyBuild, createNewBuild,
  applyViceBase, downloadExport, activeBuildId, isBareBuild, type SavedBuild,
} from './buildPresets';

const chip: React.CSSProperties = {
  background: '#15151d', color: '#e6e6f0', border: '1px solid #34344a',
  borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

export function BuildTopBar() {
  const [name, setName] = useState('');
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Build-Name…"
        style={{
          background: '#101018', color: '#fff', border: '1px solid #34344a',
          borderRadius: 8, padding: '5px 10px', fontSize: 12, width: 160,
        }}
      />
      <button
        style={{ ...chip, background: '#2563eb', borderColor: '#2563eb' }}
        onClick={() => {
          const n = name.trim() || `Build ${listBuilds().length + 1}`;
          saveBuild(n);
          setName('');
          window.dispatchEvent(new Event('builds-changed'));
        }}
      >💾 Save Build</button>
      <button
        style={chip}
        onClick={() => { if (window.confirm('Create NEW build? Alle Assets + Spritesheets werden rausgeworfen (nacktes Grundgerüst).')) createNewBuild(); }}
      >✨ Create New Build</button>
      <button
        style={{ ...chip, background: '#1f6f43', borderColor: '#1f6f43' }}
        onClick={() => downloadExport(name.trim() || 'vice-heat')}
      >⬇ Export Build</button>
    </div>
  );
}

export function BuildSlots() {
  const [builds, setBuilds] = useState<SavedBuild[]>(listBuilds);
  const active = activeBuildId();
  const bare = isBareBuild();
  // Refresh when the top bar saves a build.
  useEffect(() => {
    const cb = () => setBuilds(listBuilds());
    window.addEventListener('builds-changed', cb);
    return () => window.removeEventListener('builds-changed', cb);
  }, []);
  return (
    <div className="flex items-center justify-center gap-2 py-2 flex-wrap">
      <button
        style={{
          ...chip,
          background: !bare && active === null ? '#c026d3' : '#15151d',
          borderColor: !bare && active === null ? '#c026d3' : '#34344a',
        }}
        onClick={() => applyViceBase()}
        title="Das eingebaute Vice-Heat-Spiel (Basis)"
      >⭐ Vice Heat</button>
      {builds.map(b => (
        <span key={b.id} style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            style={{
              ...chip,
              background: active === b.id ? '#2563eb' : '#15151d',
              borderColor: active === b.id ? '#2563eb' : '#34344a',
              paddingRight: 26,
            }}
            onClick={() => applyBuild(b)}
            title={`${b.gridId} · ${b.mathProfileId}${b.bare ? ' · bare' : ''}`}
          >{b.bare ? '▢ ' : ''}{b.name}</button>
          <button
            aria-label="delete"
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', color: '#8b8ba3', border: 'none',
              cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 2,
            }}
            onClick={e => { e.stopPropagation(); setBuilds(deleteBuild(b.id)); }}
          >×</button>
        </span>
      ))}
      {builds.length === 0 && (
        <span style={{ color: '#5b5b72', fontSize: 11 }}>Keine gespeicherten Builds — oben „Save Build" drücken.</span>
      )}
    </div>
  );
}
