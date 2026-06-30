// ui/ExportPanel.tsx — export individual features as dev-ready code. Pick any
// registry entry (built-in or your pasted ones), or bake the active animation
// preset / bundle all custom entries → copy or download → dev pastes into the
// real generator.

import { useState, useEffect } from 'react';
import { useStudio } from '../store/useStudio';
import { useDerivedConfig } from '../store/derive';
import { REGISTRY_NAMES, type RegistryName } from '../registries';
import { entrySnippet, sourceSnippet, presetToSnippet, customBundle, download } from '../registries/exportEntry';

export function ExportPanel() {
  const { registries } = useDerivedConfig();
  const working = useStudio((s) => s.working);
  const customEntries = useStudio((s) => s.customEntries);

  const [registry, setRegistry] = useState<RegistryName>('symbolAnimations');
  const [entryId, setEntryId] = useState('');
  const [text, setText] = useState('');
  const [name, setName] = useState('entry.ts');

  const entries = registries[registry];
  const pickEntry = (rid: RegistryName, eid: string) => {
    const e = registries[rid].find((x) => x.id === eid) ?? registries[rid][0];
    if (!e) return;
    // custom (pasted) entries export VERBATIM source → zero quality loss
    const custom = customEntries.find((c) => c.registry === rid && c.entry.id === eid);
    setText(custom?.source ? sourceSnippet(rid, custom.source) : entrySnippet(rid, e));
    setName(`${e.id}.ts`);
  };
  const onRegistry = (rid: RegistryName) => {
    setRegistry(rid);
    const first = registries[rid][0];
    setEntryId(first?.id ?? '');
    if (first) pickEntry(rid, first.id);
  };
  const onEntry = (eid: string) => {
    setEntryId(eid);
    pickEntry(registry, eid);
  };

  // populate on first open so the panel isn't blank
  useEffect(() => {
    if (!text) {
      const first = registries[registry][0];
      if (first) {
        setEntryId(first.id);
        setText(entrySnippet(registry, first));
        setName(`${first.id}.ts`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = () => text && navigator.clipboard?.writeText(text);

  return (
    <div className="stack">
      <p className="hint">
        Export any single feature as a typed registry entry — copy or download, then the dev pastes it
        straight into the real generator. <strong>Entries you pasted export verbatim</strong> (comments,
        hex colors, functions, formatting all preserved — zero quality loss). Pick a registry + entry, or
        bake the whole preset.
      </p>

      <div className="row gap">
        <select value={registry} onChange={(e) => onRegistry(e.target.value as RegistryName)}>
          {REGISTRY_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select className="full" value={entryId} onChange={(e) => onEntry(e.target.value)}>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} {e.implemented ? '' : '· inert'}
            </option>
          ))}
        </select>
      </div>

      <div className="row gap">
        <button className="btn" onClick={() => { setText(presetToSnippet(working, registries)); setName(`preset-${working.id}.ts`); }}>
          Bake animation preset
        </button>
        <button className="btn" onClick={() => { setText(customBundle(customEntries)); setName('custom-overlay.ts'); }}>
          All custom ({customEntries.length})
        </button>
      </div>

      <textarea className="code" readOnly spellCheck={false} value={text} rows={12} placeholder="Pick a registry + entry above…" />

      <div className="row gap">
        <button className="btn primary" disabled={!text} onClick={copy}>
          Copy
        </button>
        <button className="btn" disabled={!text} onClick={() => download(name, text)}>
          Download {name}
        </button>
      </div>
    </div>
  );
}
