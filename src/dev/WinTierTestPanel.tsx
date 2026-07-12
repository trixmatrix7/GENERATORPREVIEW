// Dev-only — buttons to trigger each implemented win tier's banner animation
// without having to roll a real spin in that band. Rendered inline in the left
// Sidebar (under the Spin controls), collapsible so it never covers the HUD.

import { useState } from 'react';
import type { PixiApp } from '@/game/PixiApp';
import type { SoundManager } from '@/audio/SoundManager';
import type { HostSnapshotV1 } from '@/bridge/types';
import { selectWinSound } from '@/audio/useSoundLayer';
import { FX_REGISTRY } from '@/game/effects/fxRegistry';
import { MECH_REGISTRY } from '@/game/effects/mechRegistry';
import { STATE_PRESETS, setActiveStatePreset, getActiveStatePreset } from '@/config/statePresets';

interface Props {
  pixiApp: PixiApp;
  snapshot: HostSnapshotV1;
  soundManager: SoundManager;
}

// Multipliers picked to land safely inside each marquee tier's band
// (WIN_CELEBRATION_CONFIG: minBigWin 15, mega 25, epic 100; MAX = the game's
// max-win cap, 5000× — see GameConfig.maxWinMultiplier). The sound is resolved
// via the SAME selectWinSound() the live game uses.
const TIERS = [
  { id: 'big',  label: 'Big Win',  multiplier: 20   },
  { id: 'mega', label: 'Mega Win', multiplier: 40   },
  { id: 'epic', label: 'Epic Win', multiplier: 150  },
  { id: 'max',  label: 'MAX WIN',  multiplier: 5000 },
] as const;

export function WinTierTestPanel({ pixiApp, snapshot, soundManager }: Props) {
  const decimals = snapshot.token.decimals ?? 18;
  const symbol = snapshot.token.symbol ?? '$';
  const wager = 10n ** BigInt(decimals); // 1 whole token, regardless of player bet UI
  const [open, setOpen] = useState(true);

  const trigger = (multiplier: number) => {
    const winAmount = wager * BigInt(multiplier);
    pixiApp.__testWin(winAmount, symbol, decimals, 'WIN', wager);
    const sound = selectWinSound(winAmount, wager);
    if (sound) soundManager.play(sound);
    // Coin-chime accents on big+ wins — same soft ticks and timings as the
    // live overlay in useSoundLayer.ts (melodic layers would clash with the
    // signature win jingle).
    if (sound === 'win-big' || sound === 'win-mega') {
      window.setTimeout(() => soundManager.play('coin-chime'), 200);
      window.setTimeout(() => soundManager.play('coin-chime'), 600);
    }
    if (sound === 'win-mega') {
      window.setTimeout(() => soundManager.play('coin-chime'), 1100);
      window.setTimeout(() => soundManager.play('coin-chime'), 1700);
      window.setTimeout(() => soundManager.play('coin-chime'), 2300);
    }
  };

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.35)',
        color: '#fff',
        border: '1px solid #2a2a2e',
        borderRadius: 8,
        padding: 8,
        fontSize: 11,
        fontFamily: 'monospace',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'transparent', border: 'none', color: '#F8FA5E',
          fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
          cursor: 'pointer', textAlign: 'left', padding: 0, marginBottom: 2,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>TEST FEATURES</span><span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (<>
      {TIERS.map(tier => (
        <button
          key={tier.id}
          onClick={() => trigger(tier.multiplier)}
          style={{
            background: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {tier.label} ({tier.multiplier}×)
        </button>
      ))}
      <button
        onClick={() => pixiApp.__testHoldAndWin()}
        style={{
          background: '#222',
          color: '#FFC93C',
          border: '1px solid #6b551d',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          textAlign: 'left',
          marginTop: 4,
        }}
      >
        Hold &amp; Win
      </button>
      <button
        onClick={() => pixiApp.__testStickyWildReveal()}
        style={{
          background: '#1a1206',
          color: '#FFD24A',
          border: '1px solid #7a5c1e',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          textAlign: 'left',
          marginTop: 4,
        }}
        title="Screen dims, 3–25 wilds pop criss-cross with the AAA shine, then stay put"
      >
        ✦ Sticky Wilds
      </button>
      <button
        onClick={() => pixiApp.__testExpandingWild()}
        style={{
          background: '#07170c',
          color: '#8fe6a0',
          border: '1px solid #2a6b3f',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          textAlign: 'left',
          marginTop: 4,
        }}
        title="Wild lands on 1–2 reels, clear-beat, the money tower races out of the landing cell and locks the reel"
      >
        ⤢ Expanding Wild
      </button>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {([3, 4] as const).map(n => (
          <button
            key={n}
            onClick={() => pixiApp.__testScatterTrigger(symbol, decimals, wager, n)}
            style={{
              flex: 1,
              background: '#041c14',
              color: '#7fe8c0',
              border: '1px solid #2a7a5a',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              fontFamily: 'monospace',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            title={`Real trigger spin: reels roll and land ${n} scatters (with anticipation), scatter BONUS anim, then the full FS round`}
          >
            ◎ Trigger {n} SC
          </button>
        ))}
        <button
          onClick={() => pixiApp.__testSymbolWin(1)}
          style={{
            flex: 1,
            background: '#04101c',
            color: '#7fc8ff',
            border: '1px solid #2a5a7a',
            borderRadius: 4,
            padding: '4px 6px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          title="Plays the scatter BONUS animation on the board's scatter cells (re-skins the centre cell if none visible)"
        >
          ✹ SC anim
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {([[2, '▶ Prem A win'], [3, '▶ Prem B win']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => pixiApp.__testSymbolWin(id)}
            style={{
              flex: 1,
              background: '#12081c',
              color: '#e6a0ff',
              border: '1px solid #5a2a7a',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              fontFamily: 'monospace',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            title="Plays this premium's WIN spritesheet on its board cells for ~3.5s (re-skins the centre cell if none is visible)"
          >
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          // Force turbo off for the demo so the iris transition always plays
          // (the free-spins entry is skipped in turbo/reduced-motion).
          const wasTurbo = pixiApp.turbo;
          pixiApp.turbo = false;
          pixiApp.__testFreeSpins(symbol, decimals, wager, 8);
          window.setTimeout(() => { pixiApp.turbo = wasTurbo; }, 1600);
        }}
        style={{
          background: '#160a24',
          color: '#C79BFF',
          border: '1px solid #5a3a8a',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          textAlign: 'left',
          marginTop: 4,
        }}
        title="Scatter trigger → Looney-Tunes iris transition into the free-spins round"
      >
        ✺ Free Spins (iris)
      </button>
      <button
        onClick={() => {
          // Preview the ways-light win-line: ensure it's on, then spin into a
          // win where several symbols connect (1→3→3→2→1 fan) so you can see the
          // comet branch through multiple connections.
          pixiApp.applyVisualParam('waysLight', 'on');
          pixiApp.__testWaysWin(symbol, decimals, wager);
        }}
        style={{
          background: '#04171c',
          color: '#8fe8ff',
          border: '1px solid #2a6b7a',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          textAlign: 'left',
          marginTop: 4,
        }}
        title="Preview the ways-light win-line connection (synthetic 5-of-a-kind)"
      >
        ⟶ Win Line (ways-light)
      </button>

      {/* ── State-animation presets (10 AAA flavours, generator-replicable) ── */}
      <StatePresetPicker pixiApp={pixiApp} />

      {/* ── Mechanics — sticky-wild-class feature showcases ── */}
      <div style={{ marginTop: 6, borderTop: '1px solid #2a2a2e', paddingTop: 6 }}>
        <div style={{ color: '#F8FA5E', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>MECHANICS ({MECH_REGISTRY.length})</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {MECH_REGISTRY.map(m => (
            <button key={m.id} type="button" onClick={() => pixiApp.runMechanic(m.id)} title={m.description}
              style={{ background: '#1c1410', color: '#ffd9a0', border: '1px solid #6b4a1d', borderRadius: 4, padding: '3px 5px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── FX library — one button per showcase effect ── */}
      <FxLibrary pixiApp={pixiApp} />
      </>)}
    </div>
  );
}

function StatePresetPicker({ pixiApp }: { pixiApp: PixiApp }) {
  const [active, setActive] = useState(getActiveStatePreset().id);
  return (
    <div style={{ marginTop: 6, borderTop: '1px solid #2a2a2e', paddingTop: 6 }}>
      <div style={{ color: '#F8FA5E', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>STATE PRESETS</div>
      <select
        value={active}
        onChange={e => {
          setActive(e.target.value);
          setActiveStatePreset(e.target.value);
          // Instant feel check: pulse a plain low symbol with the new WIN
          // timing (landing/idle apply from the next spin automatically).
          pixiApp.__testSymbolWin(8);
        }}
        title={STATE_PRESETS.find(p => p.id === active)?.description}
        style={{
          width: '100%', background: '#222', color: '#fff', border: '1px solid #444',
          borderRadius: 4, padding: '4px 6px', fontSize: 11, fontFamily: 'monospace',
        }}
      >
        {STATE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div style={{ color: '#888', fontSize: 10, marginTop: 3 }}>
        {STATE_PRESETS.find(p => p.id === active)?.description}
      </div>
    </div>
  );
}

const FX_GROUP_LABEL: Record<string, string> = {
  win: 'WIN FX', anticipation: 'ANTICIPATION FX', ambient: 'AMBIENT FX',
  transition: 'TRANSITION FX', symbol: 'SYMBOL FX',
};

function FxLibrary({ pixiApp }: { pixiApp: PixiApp }) {
  const [open, setOpen] = useState(false);
  const groups = [...new Set(FX_REGISTRY.map(e => e.group))];
  return (
    <div style={{ marginTop: 6, borderTop: '1px solid #2a2a2e', paddingTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'transparent', border: 'none', color: '#F8FA5E', fontFamily: 'monospace',
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer', textAlign: 'left',
          padding: 0, width: '100%', display: 'flex', justifyContent: 'space-between',
        }}
      >
        <span>FX LIBRARY ({FX_REGISTRY.length})</span><span>{open ? '▾' : '▸'}</span>
      </button>
      {open && groups.map(g => (
        <div key={g}>
          <div style={{ color: '#9aa', fontSize: 10, letterSpacing: 1, margin: '6px 0 3px' }}>{FX_GROUP_LABEL[g] ?? g}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            {FX_REGISTRY.filter(e => e.group === g).map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => pixiApp.runFx(e.id)}
                title={e.description}
                style={{
                  background: '#1b1b22', color: '#cfd3ff', border: '1px solid #3a3a4a',
                  borderRadius: 4, padding: '3px 5px', fontSize: 10, fontFamily: 'monospace',
                  cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
                  whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
