// ui/CodePanel.tsx — paste a typed registry entry as code → it's parsed,
// applied live to the running preview, AND saved (persisted) so it survives
// reload and can be copied back out for the dev to paste into the real
// generator. This is the studio's "add files as code + saved" surface.

import { useState } from 'react';
import { useStudio } from '../store/useStudio';
import { parseEntryCode } from '../registries/parseEntry';
import { REGISTRY_NAMES, type RegistryName } from '../registries';

const PLACEHOLDER = `{
  id: 'symbol-win-juice-soft',
  name: 'Win juice (soft)',
  state: 'win',
  trigger: 'cell:winning',
  scope: 'cell',
  anchor: 'cell:winning',
  duration: 0.5,
  loop: false,
  easing: 'power2.out',
  compatibleGrids: ['5x5', '5x3'],
  compatibleModels: ['ways'],
}`;

export function CodePanel() {
  const customEntries = useStudio((s) => s.customEntries);
  const addCustomEntry = useStudio((s) => s.addCustomEntry);
  const removeCustomEntry = useStudio((s) => s.removeCustomEntry);
  const author = useStudio((s) => s.author);

  const [code, setCode] = useState('');
  const [target, setTarget] = useState<RegistryName | 'auto'>('auto');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const apply = () => {
    const res = parseEntryCode(code, target);
    if (!res.ok || !res.entry || !res.registry) {
      setMsg({ kind: 'err', text: res.error ?? 'Parse failed.' });
      return;
    }
    addCustomEntry({
      registry: res.registry,
      entry: res.entry,
      source: code,
      createdAt: Date.now(),
      author: author || undefined,
    });
    setMsg({ kind: 'ok', text: `Applied to ${res.registry}: ${res.entry.id}` });
  };

  const copyOut = (source?: string) => {
    if (source) void navigator.clipboard?.writeText(source);
  };

  return (
    <div className="code-panel">
      <p className="hint">
        Paste a typed registry entry (object literal). It applies to the live preview and is saved here.
        Same <code>id</code> overrides the default entry.
      </p>

      <div className="row">
        <label className="lbl">Registry</label>
        <select value={target} onChange={(e) => setTarget(e.target.value as RegistryName | 'auto')}>
          <option value="auto">auto-detect</option>
          {REGISTRY_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <textarea
        className="code"
        spellCheck={false}
        placeholder={PLACEHOLDER}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={14}
      />

      <div className="row gap">
        <button className="btn primary" onClick={apply} disabled={!code.trim()}>
          Apply &amp; Save
        </button>
        <button className="btn ghost" onClick={() => { setCode(''); setMsg(null); }}>
          Clear
        </button>
      </div>

      {msg && <div className={`parse-msg ${msg.kind}`}>{msg.text}</div>}

      <div className="saved">
        <div className="saved-head">Saved entries ({customEntries.length})</div>
        {customEntries.length === 0 && <div className="empty">None yet — your pasted entries land here.</div>}
        {customEntries.map((c) => (
          <div className="saved-item" key={`${c.registry}:${c.entry.id}`}>
            <div className="meta">
              <span className="reg">{c.registry}</span>
              <span className="eid">{c.entry.id}</span>
              {c.author && <span className="auth">@{c.author}</span>}
            </div>
            <div className="acts">
              <button className="btn tiny" onClick={() => copyOut(c.source)} title="Copy source">
                copy
              </button>
              <button className="btn tiny danger" onClick={() => removeCustomEntry(c.registry, c.entry.id)}>
                remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
