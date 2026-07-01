// ui/Controls.tsx — the studio sidebar. Test triggers, the 4 animation states,
// live params, effect toggles, presets (save/load/delete), the code panel, the
// outcome inspector, and settings.

import { useState, useRef, useEffect, useContext, createContext } from 'react';
import { controller, type ScenarioName } from '../game/controller';
import { useStudio, type SoundSet } from '../store/useStudio';
import { useRuntime } from '../store/useRuntime';
import { useDerivedConfig } from '../store/derive';
import { CodePanel } from './CodePanel';
import { ExportPanel } from './ExportPanel';
import { ADJUSTABLE_PARAMS } from '../config/adjustableParams';
import { BET_LEVELS } from '../config/gameConfig';
import { GRIDS, type GridId } from '../config/gridConfig';
import { THEMES } from '../config/canvasTheme';
import { BUILTIN_PRESETS, type SymbolStateConfig } from '../registries/presets';
import type { SymbolState } from '../registries/types';

const EASES = ['power2.out', 'power3.out', 'back.out', 'back.out(1.8)', 'elastic.out', 'sine.inOut', 'bounce.out', 'none'];
const STATES: { key: SymbolState; label: string; hint: string }[] = [
  { key: 'idle', label: 'Idle / glow pulse', hint: 'scatterCount ≥ 2 breathing' },
  { key: 'landing', label: 'Landing squash', hint: 'reel-stop impact' },
  { key: 'win', label: 'Win juice', hint: 'cell:winning pop' },
  { key: 'reset', label: 'Win reset', hint: 'ways settle-back' },
];

const SCENARIOS: { name: ScenarioName; label: string }[] = [
  { name: 'win', label: 'Ways Win' },
  { name: 'free-spins', label: 'Free Spins' },
  { name: 'near-miss', label: 'Near Miss' },
  { name: 'big-win', label: 'Big Win' },
  { name: 'mega-win', label: 'Mega Win' },
  { name: 'hold-win', label: 'Hold & Win' },
  { name: 'bonus-buy', label: 'Bonus Buy' },
];

// broadcast "open all" / "close all" to every Section
const SectionCmd = createContext<{ cmd: 'open' | 'close' | null; nonce: number }>({ cmd: null, nonce: 0 });

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ctx = useContext(SectionCmd);
  useEffect(() => {
    if (ctx.cmd === 'open') setOpen(true);
    else if (ctx.cmd === 'close') setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.nonce]);
  return (
    <div className={`section ${open ? 'open' : ''}`}>
      <button className="section-head" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

/** Drag/swipe anywhere on the panel (except over a control) to scroll it.
 *  For mouse-wheel-free scrolling. */
function useDragScroll(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let active = false;
    let dragging = false;
    let startY = 0;
    let startTop = 0;
    const isControl = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest('input,select,textarea,button,a,[role="slider"]');
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || isControl(e.target)) return;
      active = true;
      dragging = false;
      startY = e.clientY;
      startTop = el.scrollTop;
    };
    const move = (e: PointerEvent) => {
      if (!active) return;
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dy) > 6) {
        dragging = true;
        el.classList.add('dragging');
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
      }
      if (dragging) {
        el.scrollTop = startTop - dy;
        e.preventDefault();
      }
    };
    const up = (e: PointerEvent) => {
      if (dragging) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* */
        }
      }
      active = false;
      dragging = false;
      el.classList.remove('dragging');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [ref]);
}

export function Controls() {
  const busy = useRuntime((s) => s.busy);
  const ref = useRef<HTMLElement>(null);
  const [cmd, setCmd] = useState<{ cmd: 'open' | 'close' | null; nonce: number }>({ cmd: null, nonce: 0 });
  useDragScroll(ref);

  const by = (dy: number) => ref.current?.scrollBy({ top: dy, behavior: 'smooth' });
  const to = (top: number) => ref.current?.scrollTo({ top, behavior: 'smooth' });
  const expandAll = () => setCmd((c) => ({ cmd: 'open', nonce: c.nonce + 1 }));
  const collapseAll = () => setCmd((c) => ({ cmd: 'close', nonce: c.nonce + 1 }));
  const onKey = (e: React.KeyboardEvent) => {
    const step = 320;
    if (e.key === 'ArrowDown') by(120);
    else if (e.key === 'ArrowUp') by(-120);
    else if (e.key === 'PageDown') by(step);
    else if (e.key === 'PageUp') by(-step);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(ref.current?.scrollHeight ?? 0);
    else return;
    e.preventDefault();
  };

  return (
    <aside className="controls" ref={ref} tabIndex={0} onKeyDown={onKey}>
      <div className="scroll-tools">
        <span className="st-label">scroll</span>
        <button className="btn tiny" title="Up" onClick={() => by(-340)}>▲</button>
        <button className="btn tiny" title="Down" onClick={() => by(340)}>▼</button>
        <button className="btn tiny" title="Top" onClick={() => to(0)}>⤒</button>
        <button className="btn tiny" title="Bottom" onClick={() => to(ref.current?.scrollHeight ?? 0)}>⤓</button>
        <span className="st-spacer" />
        <button className="btn tiny" title="Open all sections" onClick={expandAll}>Expand all</button>
        <button className="btn tiny" title="Collapse all sections" onClick={collapseAll}>Collapse</button>
      </div>
      <SectionCmd.Provider value={cmd}>
      <Section title="Spin & Test">
        <TestTriggers busy={busy} />
      </Section>
      <Section title="Systems (overlay)">
        <Systems />
      </Section>
      <Section title="Animation states (4)">
        <StatesEditor />
      </Section>
      <Section title="Presets">
        <Presets />
      </Section>
      <Section title="Parameters">
        <Params />
      </Section>
      <Section title="Effects">
        <Effects />
      </Section>
      <Section title="Add entry (code)" defaultOpen={false}>
        <CodePanel />
      </Section>
      <Section title="Export feature" defaultOpen={false}>
        <ExportPanel />
      </Section>
      <Section title="Inspector" defaultOpen={false}>
        <Inspector />
      </Section>
      <Section title="Grid · Theme · Bet">
        <GridThemeBet />
      </Section>
      <Section title="Background">
        <Background />
      </Section>
      <Section title="Settings" defaultOpen={false}>
        <Settings />
      </Section>
      </SectionCmd.Provider>
    </aside>
  );
}

function TestTriggers({ busy }: { busy: boolean }) {
  return (
    <div className="stack">
      <div className="row gap">
        <button className="btn primary big" disabled={busy} onClick={() => void controller.spin()}>
          SPIN
        </button>
        <button className="btn ghost" onClick={() => controller.stop()}>
          Stop
        </button>
      </div>
      <div className="label-row">Scenarios</div>
      <div className="grid-btns">
        {SCENARIOS.map((s) => (
          <button key={s.name} className="btn" disabled={busy} onClick={() => void controller.scenario(s.name)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="label-row">Preview a state</div>
      <div className="grid-btns">
        {STATES.map((s) => (
          <button key={s.key} className="btn subtle" onClick={() => void controller.previewState(s.key)}>
            {s.label.split(' ')[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatesEditor() {
  const working = useStudio((s) => s.working);
  const setStateConfig = useStudio((s) => s.setStateConfig);
  return (
    <div className="stack">
      {STATES.map(({ key, label, hint }) => {
        const cfg: SymbolStateConfig = working.states[key];
        return (
          <div className="state-card" key={key}>
            <div className="state-top">
              <label className="switch">
                <input type="checkbox" checked={cfg.enabled} onChange={(e) => setStateConfig(key, { enabled: e.target.checked })} />
                <span>{label}</span>
              </label>
              <span className="hint-inline">{hint}</span>
            </div>
            <div className="state-controls">
              <label className="mini">
                ease
                <select value={cfg.easing} onChange={(e) => setStateConfig(key, { easing: e.target.value })}>
                  {EASES.map((ez) => (
                    <option key={ez} value={ez}>
                      {ez}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mini">
                speed {cfg.durationScale.toFixed(2)}×
                <input type="range" min={0.4} max={2} step={0.05} value={cfg.durationScale} onChange={(e) => setStateConfig(key, { durationScale: +e.target.value })} />
              </label>
              <label className="mini">
                strength {cfg.intensity.toFixed(2)}×
                <input type="range" min={0.3} max={2} step={0.05} value={cfg.intensity} onChange={(e) => setStateConfig(key, { intensity: +e.target.value })} />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Presets() {
  const selectedPresetId = useStudio((s) => s.selectedPresetId);
  const customPresets = useStudio((s) => s.customPresets);
  const selectPreset = useStudio((s) => s.selectPreset);
  const saveWorkingAsPreset = useStudio((s) => s.saveWorkingAsPreset);
  const deletePreset = useStudio((s) => s.deletePreset);
  const resetWorking = useStudio((s) => s.resetWorking);
  const [name, setName] = useState('');

  return (
    <div className="stack">
      <select className="full" value={selectedPresetId} onChange={(e) => selectPreset(e.target.value)}>
        <optgroup label="Built-in">
          {BUILTIN_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
        {customPresets.length > 0 && (
          <optgroup label="Custom">
            {customPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <div className="row gap">
        <input className="full" placeholder="save current as…" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={() => { saveWorkingAsPreset(name.trim()); setName(''); }}>
          Save
        </button>
      </div>
      <div className="row gap">
        <button className="btn ghost" onClick={resetWorking}>
          Reset edits
        </button>
        {customPresets.some((p) => p.id === selectedPresetId) && (
          <button className="btn ghost danger" onClick={() => deletePreset(selectedPresetId)}>
            Delete preset
          </button>
        )}
      </div>
    </div>
  );
}

function Systems() {
  const { registries } = useDerivedConfig();
  const activeSpinSystemId = useStudio((s) => s.activeSpinSystemId);
  const setSpinSystem = useStudio((s) => s.setSpinSystem);
  const activeWinPresentationId = useStudio((s) => s.activeWinPresentationId);
  const setWinPresentation = useStudio((s) => s.setWinPresentation);
  const soundSet = useStudio((s) => s.soundSet);
  const setSoundSet = useStudio((s) => s.setSoundSet);
  const spinSystems = registries.spinSystems.filter((e) => e.implemented);
  const winPres = registries.winPresentation.filter((e) => 'mode' in e && e.implemented);

  return (
    <div className="stack">
      <label className="mini">
        Spin system <span className="hint-inline">how the board animates in</span>
        <select value={activeSpinSystemId} onChange={(e) => setSpinSystem(e.target.value)}>
          {spinSystems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mini">
        Win presentation <span className="hint-inline">how wins reveal</span>
        <select value={activeWinPresentationId} onChange={(e) => setWinPresentation(e.target.value)}>
          {winPres.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mini">
        Sound set
        <select value={soundSet} onChange={(e) => setSoundSet(e.target.value as SoundSet)}>
          <option value="full">Full</option>
          <option value="minimal">Minimal</option>
          <option value="off">Off</option>
        </select>
      </label>
      <p className="hint">
        These are <strong>overlay</strong> categories — swappable + code-addable, all adapting to the frozen
        spec. Paste your own spin system / win presentation / sound in the <em>Add entry (code)</em> panel.
      </p>
    </div>
  );
}

function Params() {
  const working = useStudio((s) => s.working);
  const setParam = useStudio((s) => s.setParam);
  const groups = [...new Set(ADJUSTABLE_PARAMS.map((p) => p.group))];
  return (
    <div className="stack">
      {groups.map((g) => (
        <div key={g} className="param-group">
          <div className="param-group-title">{g}</div>
          {ADJUSTABLE_PARAMS.filter((p) => p.group === g).map((p) => {
            const val = working.params[p.key] ?? p.default;
            return (
              <label className="param" key={p.key} title={p.description}>
                <span className="pname">
                  {p.label}
                  <em>
                    {val}
                    {p.unit ?? ''}
                  </em>
                </span>
                <input type="range" min={p.min} max={p.max} step={p.step} value={val} onChange={(e) => setParam(p.key, +e.target.value)} />
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Effects() {
  const effects = useStudio((s) => s.working.effects);
  const toggleEffect = useStudio((s) => s.toggleEffect);
  const items: { key: keyof typeof effects; label: string }[] = [
    { key: 'scatterOrbit', label: 'Scatter orbit' },
    { key: 'anticipationColumns', label: 'Anticipation columns' },
    { key: 'shockwave', label: 'Win shockwave' },
    { key: 'winScreens', label: 'Win screens' },
  ];
  return (
    <div className="toggles">
      {items.map((it) => (
        <label className="switch" key={it.key}>
          <input type="checkbox" checked={effects[it.key]} onChange={(e) => toggleEffect(it.key, e.target.checked)} />
          <span>{it.label}</span>
        </label>
      ))}
    </div>
  );
}

function Background() {
  const backgroundImage = useStudio((s) => s.backgroundImage);
  const setBackgroundImage = useStudio((s) => s.setBackgroundImage);
  const [url, setUrl] = useState('');

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBackgroundImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="stack">
      <p className="hint">
        Full-canvas background behind the reels (16:9). Placeholder until you add one. Use a 16:9 image so it isn't
        stretched. Saved with your studio state.
      </p>
      <label className="btn" style={{ textAlign: 'center' }}>
        Upload image…
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <div className="row gap">
        <input className="full" placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn" disabled={!url.trim()} onClick={() => setBackgroundImage(url.trim())}>
          Set
        </button>
      </div>
      {backgroundImage && (
        <div className="row gap">
          <span className="hint" style={{ margin: 0, flex: 1 }}>
            {backgroundImage.startsWith('data:') ? 'Uploaded image active' : 'URL image active'}
          </span>
          <button className="btn ghost danger" onClick={() => { setBackgroundImage(''); setUrl(''); }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function GridThemeBet() {
  const grid = useStudio((s) => s.grid);
  const setGrid = useStudio((s) => s.setGrid);
  const themeId = useStudio((s) => s.themeId);
  const setTheme = useStudio((s) => s.setTheme);
  const betIndex = useStudio((s) => s.betIndex);
  const setBetIndex = useStudio((s) => s.setBetIndex);
  const bet = BET_LEVELS[betIndex];

  return (
    <div className="stack">
      <div className="row gap">
        <span className="lbl">Grid</span>
        {(Object.keys(GRIDS) as GridId[]).map((g) => (
          <button key={g} className={`btn pill ${grid === g ? 'active' : ''}`} onClick={() => setGrid(g)}>
            {g} <em>({GRIDS[g].ways} ways)</em>
          </button>
        ))}
      </div>
      <div className="row gap">
        <span className="lbl">Theme</span>
        <select value={themeId} onChange={(e) => setTheme(e.target.value)}>
          {Object.values(THEMES).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="row gap">
        <span className="lbl">Bet</span>
        <button className="btn pill" onClick={() => setBetIndex(betIndex - 1)}>
          −
        </button>
        <span className="bet tabular">{bet.toFixed(2)}</span>
        <button className="btn pill" onClick={() => setBetIndex(betIndex + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

function Inspector() {
  const o = useRuntime((s) => s.outcome);
  if (!o) return <div className="empty">Spin to inspect the outcome.</div>;
  return (
    <div className="inspector">
      <Row k="seed" v={`${o.seed.slice(0, 12)}…`} copy={o.seed} />
      <Row k="grid" v={o.grid} />
      <Row k="total win" v={`${o.totalWinX.toFixed(2)}× = ${o.totalWin.toFixed(2)}`} />
      <Row k="tier" v={o.tier} />
      <Row k="base win" v={`${o.base.baseWinX.toFixed(2)}×`} />
      <Row k="connections" v={String(o.base.connections.length)} />
      <Row k="scatters" v={String(o.base.scatterCount)} />
      <Row k="free spins" v={o.freeSpins.triggered ? `${o.freeSpins.played} played → ${o.freeSpins.totalWinX.toFixed(2)}×` : '—'} />
      <Row k="hold & win" v={o.holdWin.triggered ? `${o.holdWin.totalMultiplierX.toFixed(0)}× (${o.holdWin.initialCoins} coins)` : '—'} />
      <Row k="capped" v={o.capped ? 'yes (5000×)' : 'no'} />
      <button className="btn ghost full" onClick={() => void controller.spin(o.seed)}>
        Replay this seed
      </button>
    </div>
  );
}

function Row({ k, v, copy }: { k: string; v: string; copy?: string }) {
  return (
    <div className="irow">
      <span className="ik">{k}</span>
      <span className="iv tabular" onClick={() => copy && navigator.clipboard?.writeText(copy)} title={copy ? 'click to copy' : undefined}>
        {v}
      </span>
    </div>
  );
}

function Settings() {
  const author = useStudio((s) => s.author);
  const setAuthor = useStudio((s) => s.setAuthor);
  const muted = useStudio((s) => s.muted);
  const setMuted = useStudio((s) => s.setMuted);
  const volume = useStudio((s) => s.volume);
  const setVolume = useStudio((s) => s.setVolume);
  return (
    <div className="stack">
      <label className="mini">
        Your name (saved on entries you add)
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Noski" />
      </label>
      <label className="switch">
        <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
        <span>Mute</span>
      </label>
      <label className="mini">
        Volume {(volume * 100) | 0}%
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(+e.target.value)} />
      </label>
    </div>
  );
}
