// Dev-only — buttons to trigger each implemented win tier's banner animation
// without having to roll a real spin in that band. Rendered inline in the left
// Sidebar (under the Spin controls), collapsible so it never covers the HUD.

import { useState } from 'react';
import type { PixiApp } from '@/game/PixiApp';
import type { SoundManager } from '@/audio/SoundManager';
import type { HostSnapshotV1 } from '@/bridge/types';
import { selectWinSound } from '@/audio/useSoundLayer';

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
      </>)}
    </div>
  );
}
