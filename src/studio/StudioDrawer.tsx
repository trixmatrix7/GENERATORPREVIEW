// StudioDrawer — the preview-only additions on top of the 1:1 generator
// runtime. Everything here drives the dev's REAL public APIs
// (applyVisualParam, setBackgroundImage, the registries) and never touches the
// frozen spec/math. Collapsible so the game view stays exactly like the
// generator's harness.

import { useEffect, useRef, useState } from 'react';
import type { PixiApp } from '@/game/PixiApp';
import { ADJUSTABLE_PARAMS } from '@/config/adjustableParams';
import { REGISTRIES, type StudioRegistryName } from './registryCatalog';
import { loadCustomEntries, saveCustomEntries, type CustomEntry } from './persistence';
import { parseEntryCode } from './parseEntry';
import { entrySnippet, sourceSnippet, download } from './exportEntry';

interface Props {
  pixiApp: PixiApp | null;
}

export function StudioDrawer({ pixiApp }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'params' | 'background' | 'add' | 'export'>('params');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-3 right-3 z-[300] rounded-full bg-[#FFE168] text-black font-bold text-[12px] px-4 py-2 shadow-lg cursor-pointer"
        title="Studio tools (preview-only overlay)"
      >
        {open ? 'Close Studio' : 'Studio'}
      </button>

      {open && (
        <div className="fixed top-0 right-0 h-full w-[340px] z-[290] bg-[#141417] border-l border-[#2a2a2e] flex flex-col text-[#f4f4f5] font-[var(--font-body)]">
          <div className="flex items-center gap-1 p-2 border-b border-[#2a2a2e]">
            {(['params', 'background', 'add', 'export'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer ${tab === t ? 'bg-[#FFE168] text-black' : 'bg-[#1c1c20] text-[#a1a1aa]'}`}
              >
                {t === 'params' ? 'Params' : t === 'background' ? 'Background' : t === 'add' ? 'Add (code)' : 'Export'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {tab === 'params' && <ParamsTab pixiApp={pixiApp} />}
            {tab === 'background' && <BackgroundTab pixiApp={pixiApp} />}
            {tab === 'add' && <AddTab />}
            {tab === 'export' && <ExportTab />}
          </div>
          <div className="p-2 border-t border-[#2a2a2e] text-[10px] text-[#6b6b73]">
            Preview-only overlay — the spec/math is never modified. Entries you add export verbatim (lossless).
          </div>
        </div>
      )}
    </>
  );
}

/* ── Params: the dev's real chat-config whitelist, applied live ── */
function ParamsTab({ pixiApp }: { pixiApp: PixiApp | null }) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>(
    () => Object.fromEntries(ADJUSTABLE_PARAMS.map(p => [p.id, p.default])),
  );

  const apply = (id: string, value: string | number | boolean) => {
    setValues(v => ({ ...v, [id]: value }));
    pixiApp?.applyVisualParam(id, value);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-[#6b6b73] leading-relaxed">
        The generator's adjustable-params whitelist (chat-config) — applied live via{' '}
        <code className="text-[#FFE168]">applyVisualParam</code>.
      </p>
      {ADJUSTABLE_PARAMS.map(p => (
        <label key={p.id} className="flex flex-col gap-1 text-[12px]" title={p.description}>
          <span className="text-[#a1a1aa]">
            {p.label} <em className="not-italic text-[#6b6b73]">({p.layer})</em>
          </span>
          {p.type === 'enum' && p.options ? (
            <select
              value={String(values[p.id])}
              onChange={e => apply(p.id, e.target.value)}
              className="bg-[#0e0e10] border border-[#2a2a2e] rounded-md px-2 py-1.5 text-[12px]"
            >
              {p.options.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : p.type === 'boolean' ? (
            <input type="checkbox" checked={Boolean(values[p.id])} onChange={e => apply(p.id, e.target.checked)} />
          ) : (
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={Number(values[p.id])}
              onChange={e => apply(p.id, Number(e.target.value))}
            />
          )}
        </label>
      ))}
    </div>
  );
}

/* ── Background: PixiApp.setBackgroundImage (dev API) ── */
function BackgroundTab({ pixiApp }: { pixiApp: PixiApp | null }) {
  const [url, setUrl] = useState('');
  const [active, setActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = async (src: string | null) => {
    await pixiApp?.setBackgroundImage(src);
    setActive(!!src);
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void set(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-3 text-[12px]">
      <p className="text-[11px] text-[#6b6b73] leading-relaxed">
        Full-canvas background behind the reels — the generator's own{' '}
        <code className="text-[#FFE168]">setBackgroundImage</code> (cover-fit, frosted reel backdrop).
      </p>
      <button
        type="button"
        className="bg-[#1c1c20] border border-[#2a2a2e] rounded-md px-3 py-2 cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        Upload image…
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      <div className="flex gap-2">
        <input
          className="flex-1 bg-[#0e0e10] border border-[#2a2a2e] rounded-md px-2 py-1.5"
          placeholder="…or paste an image URL"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <button
          type="button"
          disabled={!url.trim()}
          className="bg-[#1c1c20] border border-[#2a2a2e] rounded-md px-3 cursor-pointer disabled:opacity-40"
          onClick={() => void set(url.trim())}
        >
          Set
        </button>
      </div>
      {active && (
        <button type="button" className="text-[#ff5a5a] text-left cursor-pointer" onClick={() => void set(null)}>
          Clear background
        </button>
      )}
    </div>
  );
}

/* ── Add (code): paste a registry entry → validated + saved verbatim ── */
function AddTab() {
  const [code, setCode] = useState('');
  const [target, setTarget] = useState<StudioRegistryName | 'auto'>('auto');
  const [entries, setEntries] = useState<CustomEntry[]>(() => loadCustomEntries());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = () => {
    const res = parseEntryCode(code, target);
    if (!res.ok || !res.entry || !res.registry) {
      setMsg({ ok: false, text: res.error ?? 'Parse failed.' });
      return;
    }
    const next = [
      ...entries.filter(e => !(e.registry === res.registry && e.id === res.entry!.id)),
      { registry: res.registry, id: res.entry.id, source: code, createdAt: Date.now() },
    ];
    setEntries(next);
    saveCustomEntries(next);
    setMsg({ ok: true, text: `Saved to ${res.registry}: ${res.entry.id}` });
  };

  const remove = (registry: StudioRegistryName, id: string) => {
    const next = entries.filter(e => !(e.registry === registry && e.id === id));
    setEntries(next);
    saveCustomEntries(next);
  };

  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <p className="text-[11px] text-[#6b6b73] leading-relaxed">
        Paste a typed registry entry (the generator's exact interfaces). It's validated, saved verbatim (comments/hex/
        functions preserved) and exportable for the dev — the spec itself is never changed.
      </p>
      <select
        value={target}
        onChange={e => setTarget(e.target.value as StudioRegistryName | 'auto')}
        className="bg-[#0e0e10] border border-[#2a2a2e] rounded-md px-2 py-1.5"
      >
        <option value="auto">auto-detect registry</option>
        {Object.keys(REGISTRIES).map(n => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <textarea
        spellCheck={false}
        rows={12}
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder={`{\n  id: 'my-effect',\n  name: 'My Effect',\n  description: '…',\n  version: '1.0.0',\n  implemented: false,\n  // …registry-specific fields\n}`}
        className="bg-[#0e0e10] border border-[#2a2a2e] rounded-md p-2 font-mono text-[11px] leading-relaxed text-[#d8e0c8]"
      />
      <button type="button" disabled={!code.trim()} className="bg-[#FFE168] text-black font-bold rounded-md px-3 py-2 cursor-pointer disabled:opacity-40" onClick={apply}>
        Validate &amp; Save
      </button>
      {msg && <div className={`text-[11px] ${msg.ok ? 'text-[#46d17a]' : 'text-[#ff5a5a]'}`}>{msg.text}</div>}

      <div className="mt-2 text-[10px] uppercase tracking-wider text-[#6b6b73]">Saved ({entries.length})</div>
      {entries.map(e => (
        <div key={`${e.registry}:${e.id}`} className="flex items-center justify-between bg-[#0e0e10] border border-[#232327] rounded-md px-2 py-1.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#6b6b73]">{e.registry}</span>
            <span className="font-mono text-[11px]">{e.id}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" className="text-[11px] text-[#FFE168] cursor-pointer" onClick={() => void navigator.clipboard?.writeText(e.source)}>
              copy
            </button>
            <button type="button" className="text-[11px] text-[#ff5a5a] cursor-pointer" onClick={() => remove(e.registry, e.id)}>
              remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Export: any real registry entry (or custom) as a dev-ready snippet ── */
function ExportTab() {
  const names = Object.keys(REGISTRIES) as StudioRegistryName[];
  const [registry, setRegistry] = useState<StudioRegistryName>(names[0]);
  const [entryId, setEntryId] = useState('');
  const [text, setText] = useState('');
  const custom = loadCustomEntries();

  const entriesFor = (r: StudioRegistryName) => REGISTRIES[r].list();

  useEffect(() => {
    const first = entriesFor(registry)[0];
    if (first) {
      setEntryId(first.id);
      setText(entrySnippet(registry, first));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry]);

  const pick = (id: string) => {
    setEntryId(id);
    const c = custom.find(e => e.registry === registry && e.id === id);
    if (c) {
      setText(sourceSnippet(registry, c.source));
      return;
    }
    const e = REGISTRIES[registry].get(id);
    if (e) setText(entrySnippet(registry, e));
  };

  const customForRegistry = custom.filter(c => c.registry === registry && !REGISTRIES[registry].get(c.id));

  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <p className="text-[11px] text-[#6b6b73] leading-relaxed">
        Export any entry as a drop-in snippet for <code className="text-[#FFE168]">src/registries/</code>. Custom
        (pasted) entries export verbatim — zero quality loss.
      </p>
      <select value={registry} onChange={e => setRegistry(e.target.value as StudioRegistryName)} className="bg-[#0e0e10] border border-[#2a2a2e] rounded-md px-2 py-1.5">
        {names.map(n => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select value={entryId} onChange={e => pick(e.target.value)} className="bg-[#0e0e10] border border-[#2a2a2e] rounded-md px-2 py-1.5">
        {entriesFor(registry).map(e => (
          <option key={e.id} value={e.id}>
            {e.name} {e.implemented ? '' : '· stub'}
          </option>
        ))}
        {customForRegistry.map(c => (
          <option key={c.id} value={c.id}>
            {c.id} · custom
          </option>
        ))}
      </select>
      <textarea readOnly rows={12} value={text} className="bg-[#0e0e10] border border-[#2a2a2e] rounded-md p-2 font-mono text-[11px] leading-relaxed text-[#d8e0c8]" />
      <div className="flex gap-2">
        <button type="button" disabled={!text} className="bg-[#FFE168] text-black font-bold rounded-md px-3 py-2 cursor-pointer disabled:opacity-40" onClick={() => void navigator.clipboard?.writeText(text)}>
          Copy
        </button>
        <button type="button" disabled={!text} className="bg-[#1c1c20] border border-[#2a2a2e] rounded-md px-3 py-2 cursor-pointer disabled:opacity-40" onClick={() => download(`${entryId || 'entry'}.ts`, text)}>
          Download
        </button>
      </div>
    </div>
  );
}
