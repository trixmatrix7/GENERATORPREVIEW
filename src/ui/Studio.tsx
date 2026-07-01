// ui/Studio.tsx — top-level layout: header (brand · RTP · live win · phase),
// the Pixi stage, and the controls sidebar.

import { StageCanvas } from './StageCanvas';
import { Controls } from './Controls';
import { GameHud } from './GameHud';
import { Paytable } from './Paytable';
import { useRuntime } from '../store/useRuntime';
import { useStudio } from '../store/useStudio';
import { GAME_META, SPEC, BET_LEVELS } from '../config/gameConfig';

export function Studio() {
  const winX = useRuntime((s) => s.winX);
  const phase = useRuntime((s) => s.phase);
  const busy = useRuntime((s) => s.busy);
  const betIndex = useStudio((s) => s.betIndex);
  const bet = BET_LEVELS[betIndex];

  return (
    <div className="studio">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span>
          <div className="brand-text">
            <h1 className="display italic-black">{GAME_META.name}</h1>
            <span className="sub">Preview Generator · {GAME_META.gridType}</span>
          </div>
        </div>
        <div className="chips">
          <span className="chip spec" title="The Fantasy math/contract is frozen — presets & code only overlay, never edit it">🔒 spec frozen</span>
          <span className="chip">RTP {SPEC.targetRtpPct}%</span>
          <span className="chip">max {SPEC.maxWinMultiplier}×</span>
          <span className={`chip phase ${busy ? 'busy' : ''}`}>{busy ? phase : 'idle'}</span>
        </div>
        <div className="winbox">
          <span className="winlabel">WIN</span>
          <span className="winval display tabular">{winX > 0 ? `${winX.toFixed(2)}×` : '—'}</span>
          <span className="winamt tabular">{winX > 0 ? `${(winX * bet).toFixed(2)}` : ''}</span>
        </div>
      </header>
      <main className="workspace">
        <section className="stage-wrap">
          <div className="stage-16x9">
            <StageCanvas />
            <GameHud />
          </div>
        </section>
        <Controls />
      </main>
      <Paytable />
    </div>
  );
}
