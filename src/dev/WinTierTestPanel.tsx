// Dev-only — buttons to trigger each implemented win tier's banner animation
// without having to roll a real spin in that band. Only rendered by HarnessApp.

import type { PixiApp } from '@/game/PixiApp';
import type { SoundManager } from '@/audio/SoundManager';
import type { HostSnapshotV1 } from '@/bridge/types';
import { selectWinSound } from '@/audio/useSoundLayer';

interface Props {
  pixiApp: PixiApp;
  snapshot: HostSnapshotV1;
  soundManager: SoundManager;
}

// Multipliers picked to land safely inside each tier's [min, max) band
// (see src/registries/winScreenTiers.ts). The sound is resolved via the SAME
// selectWinSound() the live game uses, so the panel exercises every sting —
// including win-normal — instead of a stale parallel table.
const TIERS = [
  { id: 'small',  label: 'Small Win',  multiplier: 1   },
  { id: 'normal', label: 'Normal Win', multiplier: 5   },
  { id: 'big',    label: 'Big Win',    multiplier: 25  },
  { id: 'mega',   label: 'Mega Win',   multiplier: 100 },
] as const;

export function WinTierTestPanel({ pixiApp, snapshot, soundManager }: Props) {
  const decimals = snapshot.token.decimals ?? 18;
  const symbol = snapshot.token.symbol ?? '$';
  const wager = 10n ** BigInt(decimals); // 1 whole token, regardless of player bet UI

  const trigger = (multiplier: number) => {
    const winAmount = wager * BigInt(multiplier);
    pixiApp.__testWin(winAmount, symbol, decimals, 'WIN', wager);
    const sound = selectWinSound(winAmount, wager);
    if (sound) soundManager.play(sound);
    // Layer scatter-land as a coin-chime accent for big+ wins (and a second
    // chime mid-celebration for mega). Mirrors the staggered chime overlay
    // wired in useSoundLayer.ts so the test panel matches real gameplay.
    if (sound === 'win-big' || sound === 'win-mega') {
      window.setTimeout(() => soundManager.play('scatter-land'), 250);
    }
    if (sound === 'win-mega') {
      window.setTimeout(() => soundManager.play('scatter-land'), 900);
      window.setTimeout(() => soundManager.play('scatter-land'), 1600);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 36,
        right: 8,
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        borderRadius: 6,
        padding: 8,
        fontSize: 11,
        fontFamily: 'monospace',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 130,
      }}
    >
      <div style={{ color: '#F8FA5E', marginBottom: 2 }}>TEST WIN TIERS</div>
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
    </div>
  );
}
