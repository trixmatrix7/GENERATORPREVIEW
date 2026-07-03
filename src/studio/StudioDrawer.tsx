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

type Tab = 'features' | 'params' | 'assets' | 'add' | 'export';
const TAB_LABELS: Record<Tab, string> = {
  features: 'Features',
  params: 'Params',
  assets: 'Assets',
  add: 'Add (code)',
  export: 'Export',
};

export function StudioDrawer({ pixiApp }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('features');

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
          <div className="flex items-center gap-1 p-2 border-b border-[#2a2a2e] flex-wrap">
            {(['features', 'params', 'assets', 'add', 'export'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium cursor-pointer ${tab === t ? 'bg-[#FFE168] text-black' : 'bg-[#1c1c20] text-[#a1a1aa]'}`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {tab === 'features' && <FeaturesTab pixiApp={pixiApp} />}
            {tab === 'params' && <ParamsTab pixiApp={pixiApp} />}
            {tab === 'assets' && <AssetsTab pixiApp={pixiApp} />}
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

/* ── Features: pick win-line (win-presentation) features → added to the slot.
 *  Mirrors the generator's FeatureSelection.winPresentation (a list of registry
 *  ids). Ticking a runtime-live feature (e.g. ways-light-comet) applies it to
 *  the slot immediately via the dev's applyVisualParam. ── */
const WINLINE_RUNTIME: Record<string, string> = { 'ways-light-comet': 'waysLight' };
const WAYS_SUB_PARAMS = ['waysLightColor', 'waysLightSpeed', 'waysLightWidth'];
const FEATURE_STORAGE = 'slot:feature-selection';

function loadSelection(defaults: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(FEATURE_STORAGE);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set(defaults);
}
function saveSelection(s: Set<string>): void {
  try { localStorage.setItem(FEATURE_STORAGE, JSON.stringify([...s])); } catch { /* ignore */ }
}

function FeaturesTab({ pixiApp }: { pixiApp: PixiApp | null }) {
  const winline = REGISTRIES.winPresentation.list();
  const defaults = winline.filter(e => e.implemented).map(e => e.id);
  const [selected, setSelected] = useState<Set<string>>(() => loadSelection(defaults));
  const [subVals, setSubVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ADJUSTABLE_PARAMS.filter(p => WAYS_SUB_PARAMS.includes(p.id)).map(p => [p.id, String(p.default)]),
    ),
  );

  // Re-apply the current selection + sub-settings whenever the PixiApp (re)mounts.
  useEffect(() => {
    if (!pixiApp) return;
    for (const [id, param] of Object.entries(WINLINE_RUNTIME)) {
      pixiApp.applyVisualParam(param, selected.has(id) ? 'on' : 'off');
    }
    for (const id of WAYS_SUB_PARAMS) pixiApp.applyVisualParam(id, subVals[id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiApp]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    saveSelection(next);
    const param = WINLINE_RUNTIME[id];
    if (param) pixiApp?.applyVisualParam(param, next.has(id) ? 'on' : 'off');
  };
  const setSub = (id: string, v: string) => {
    setSubVals(s => ({ ...s, [id]: v }));
    pixiApp?.applyVisualParam(id, v);
  };

  const subParams = ADJUSTABLE_PARAMS.filter(p => WAYS_SUB_PARAMS.includes(p.id));
  const featureSelection = JSON.stringify({ winPresentation: [...selected] }, null, 2);

  return (
    <div className="flex flex-col gap-3 text-[12px]">
      <p className="text-[11px] text-[#6b6b73] leading-relaxed">
        <span className="text-[#a1a1aa]">Win-line features.</span> Tick one to add it to the slot — a{' '}
        <span className="text-[#FFE168]">● live</span> feature applies instantly; <em className="not-italic">baseline</em>{' '}
        features are the runtime default. This is your <code className="text-[#FFE168]">FeatureSelection.winPresentation</code>.
      </p>

      {winline.map(e => {
        const live = e.id in WINLINE_RUNTIME;
        const on = selected.has(e.id);
        return (
          <div key={e.id} className={`rounded-md border p-2 ${on ? 'border-[#3a3a20] bg-[#1a1a12]' : 'border-[#232327] bg-[#0e0e10]'}`}>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={on} onChange={() => toggle(e.id)} className="mt-0.5 accent-[#FFE168]" />
              <span className="flex flex-col">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{e.name}</span>
                  {live ? <span className="text-[9px] text-[#FFE168]">● live</span> : <span className="text-[9px] text-[#6b6b73] uppercase">baseline</span>}
                </span>
                <span className="text-[10px] text-[#6b6b73] leading-snug">{e.description}</span>
              </span>
            </label>

            {/* inline settings for the ways-light comet when it's selected */}
            {e.id === 'ways-light-comet' && on && (
              <div className="mt-2 ml-6 flex flex-col gap-1.5">
                {subParams.map(p => (
                  <label key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#a1a1aa]">{p.label.replace('Ways-light ', '')}</span>
                    <select
                      value={subVals[p.id]}
                      onChange={ev => setSub(p.id, ev.target.value)}
                      className="bg-[#0e0e10] border border-[#2a2a2e] rounded px-2 py-1 text-[11px]"
                    >
                      {(p.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[#6b6b73]">FeatureSelection (for the dev)</span>
          <button type="button" className="text-[11px] text-[#FFE168] cursor-pointer" onClick={() => void navigator.clipboard?.writeText(featureSelection)}>
            copy
          </button>
        </div>
        <pre className="mt-1 bg-[#0e0e10] border border-[#232327] rounded-md p-2 font-mono text-[10px] text-[#d8e0c8] whitespace-pre-wrap">{featureSelection}</pre>
      </div>
    </div>
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

/* ── Assets: reskin the slot like the generator's Asset-Swap — per-symbol PNGs
 *  (setUserAssetTextures), a full-canvas background (setBackgroundImage), and a
 *  frame overlay (setFrameImage). All the dev's real runtime APIs. ── */
const SYMBOL_SLOTS: { id: number; label: string }[] = [
  { id: 0, label: 'Wild' }, { id: 1, label: 'Scatter' }, { id: 2, label: 'High A' },
  { id: 3, label: 'High B' }, { id: 4, label: 'Mid C' }, { id: 5, label: 'Mid D' },
  { id: 6, label: 'Low E' }, { id: 7, label: 'Low F' }, { id: 8, label: 'Low G' },
  { id: 9, label: 'Coin' },
];

const readDataUrl = (file: File, cb: (url: string) => void) => {
  const r = new FileReader();
  r.onload = () => cb(String(r.result));
  r.readAsDataURL(file);
};

function AssetsTab({ pixiApp }: { pixiApp: PixiApp | null }) {
  const [symbols, setSymbols] = useState<Record<number, string>>({});
  const [bg, setBg] = useState<string | null>(null);
  const [frame, setFrame] = useState<string | null>(null);

  const applySymbols = (next: Record<number, string>) => {
    setSymbols(next);
    const map = new Map<number, string>(Object.entries(next).map(([k, v]) => [Number(k), v]));
    void pixiApp?.setUserAssetTextures(map);
  };

  return (
    <div className="flex flex-col gap-4 text-[12px]">
      <p className="text-[11px] text-[#6b6b73] leading-relaxed">
        Reskin the slot — the generator's real asset APIs. Drop PNGs (transparent background works best).
        The <span className="text-[#a1a1aa]">spec/math never changes</span>; these are render-only swaps.
      </p>

      {/* Symbols */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[#6b6b73] mb-1.5">Symbols · setUserAssetTextures</div>
        <div className="grid grid-cols-2 gap-1.5">
          {SYMBOL_SLOTS.map(s => (
            <label
              key={s.id}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer ${symbols[s.id] ? 'border-[#3a3a20] bg-[#1a1a12]' : 'border-[#232327] bg-[#0e0e10]'}`}
              title={`Upload art for ${s.label}`}
            >
              {symbols[s.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={symbols[s.id]} alt="" className="w-6 h-6 object-contain rounded" />
              ) : (
                <span className="w-6 h-6 grid place-items-center text-[10px] text-[#6b6b73] border border-[#232327] rounded">{s.id}</span>
              )}
              <span className="flex-1 text-[11px]">{s.label}</span>
              {symbols[s.id] && (
                <span
                  role="button"
                  className="text-[#ff5a5a] text-[11px]"
                  onClick={ev => { ev.preventDefault(); const n = { ...symbols }; delete n[s.id]; applySymbols(n); }}
                >
                  ✕
                </span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readDataUrl(f, url => applySymbols({ ...symbols, [s.id]: url })); }} />
            </label>
          ))}
        </div>
        {Object.keys(symbols).length > 0 && (
          <button type="button" className="mt-1.5 text-[#ff5a5a] text-[11px] cursor-pointer" onClick={() => applySymbols({})}>
            Reset all symbols
          </button>
        )}
      </div>

      {/* Background */}
      <AssetSlot
        title="Background · setBackgroundImage"
        note="Full-canvas image behind the reels (cover-fit, frosted reel backdrop). Use a 16:9 image."
        active={bg}
        onPick={url => { setBg(url); void pixiApp?.setBackgroundImage(url); }}
        onClear={() => { setBg(null); void pixiApp?.setBackgroundImage(null); }}
        allowUrl
      />

      {/* Frame */}
      <AssetSlot
        title="Frame · setFrameImage (preview)"
        note="Overlay a custom frame PNG over the procedural reel frame — use one with a transparent centre window so the reels show through. (Frame is procedural in the generator; this overlay is preview-only.)"
        active={frame}
        onPick={url => { setFrame(url); void pixiApp?.setFrameImage(url); }}
        onClear={() => { setFrame(null); void pixiApp?.setFrameImage(null); }}
      />
    </div>
  );
}

function AssetSlot({ title, note, active, onPick, onClear, allowUrl }: {
  title: string; note: string; active: string | null;
  onPick: (url: string) => void; onClear: () => void; allowUrl?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[#6b6b73] mb-1.5">{title}</div>
      <p className="text-[10px] text-[#6b6b73] leading-snug mb-1.5">{note}</p>
      <div className="flex gap-2 items-center">
        <button type="button" className="bg-[#1c1c20] border border-[#2a2a2e] rounded-md px-3 py-1.5 cursor-pointer" onClick={() => fileRef.current?.click()}>
          Upload…
        </button>
        {active && <button type="button" className="text-[#ff5a5a] text-[11px] cursor-pointer" onClick={onClear}>Clear</button>}
        {active && <img src={active} alt="" className="w-8 h-8 object-contain rounded border border-[#232327]" />}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readDataUrl(f, onPick); }} />
      {allowUrl && (
        <div className="flex gap-2 mt-1.5">
          <input className="flex-1 bg-[#0e0e10] border border-[#2a2a2e] rounded-md px-2 py-1.5 text-[11px]" placeholder="…or paste an image URL" value={url} onChange={e => setUrl(e.target.value)} />
          <button type="button" disabled={!url.trim()} className="bg-[#1c1c20] border border-[#2a2a2e] rounded-md px-3 cursor-pointer disabled:opacity-40" onClick={() => onPick(url.trim())}>Set</button>
        </div>
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
