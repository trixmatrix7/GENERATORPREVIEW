// ui/GameHud.tsx — the in-game slot HUD (bottom bar), chain.wtf design language.
// Balance · Bet ± · SPIN · Win · Turbo / Autoplay / Buy Bonus / Paytable / Sound.
// This is the player-facing chrome (separate from the dev studio sidebar) so the
// preview reads like the real game.

import { controller } from '../game/controller';
import { useStudio } from '../store/useStudio';
import { useRuntime } from '../store/useRuntime';
import { BET_LEVELS } from '../config/gameConfig';
import { Coin } from './Coin';

export function GameHud() {
  const balance = useStudio((s) => s.balance);
  const betIndex = useStudio((s) => s.betIndex);
  const setBetIndex = useStudio((s) => s.setBetIndex);
  const muted = useStudio((s) => s.muted);
  const setMuted = useStudio((s) => s.setMuted);
  const turbo = useStudio((s) => s.turbo);
  const setTurbo = useStudio((s) => s.setTurbo);

  const busy = useRuntime((s) => s.busy);
  const winX = useRuntime((s) => s.winX);
  const autoplayLeft = useRuntime((s) => s.autoplayLeft);
  const setOverlay = useRuntime((s) => s.setOverlay);

  const bet = BET_LEVELS[betIndex];
  const win = winX * bet;

  const autoplaying = autoplayLeft > 0;

  const startAutoplay = async () => {
    if (autoplaying) {
      useRuntime.getState().setAutoplay(0);
      return;
    }
    useRuntime.getState().setAutoplay(10);
    while (useRuntime.getState().autoplayLeft > 0) {
      if (useStudio.getState().balance < BET_LEVELS[useStudio.getState().betIndex]) break;
      await controller.spin();
      useRuntime.getState().setAutoplay(useRuntime.getState().autoplayLeft - 1);
    }
    useRuntime.getState().setAutoplay(0);
  };

  return (
    <div className="game-hud">
      <div className="hud-stat">
        <span className="hud-lbl">Balance</span>
        <span className="hud-val tabular">
          <Coin /> {balance.toFixed(2)}
        </span>
      </div>

      <div className="hud-bet">
        <button className="hud-round" disabled={busy || autoplaying} onClick={() => setBetIndex(betIndex - 1)} aria-label="Bet down">
          −
        </button>
        <div className="hud-stat center">
          <span className="hud-lbl">Bet</span>
          <span className="hud-val tabular">
            <Coin /> {bet.toFixed(2)}
          </span>
        </div>
        <button className="hud-round" disabled={busy || autoplaying} onClick={() => setBetIndex(betIndex + 1)} aria-label="Bet up">
          +
        </button>
      </div>

      <button className="hud-spin" disabled={busy} onClick={() => void controller.spin()}>
        <span className="hud-spin-inner">{busy ? '···' : 'SPIN'}</span>
      </button>

      <div className="hud-stat">
        <span className="hud-lbl">Win</span>
        <span className={`hud-val tabular ${win > 0 ? 'won' : ''}`}>
          <Coin /> {win > 0 ? win.toFixed(2) : '0.00'}
        </span>
      </div>

      <div className="hud-cluster">
        <button className={`hud-chip ${turbo ? 'on' : ''}`} title="Turbo spin" onClick={() => setTurbo(!turbo)}>
          ⚡
        </button>
        <button className={`hud-chip ${autoplaying ? 'on' : ''}`} title="Autoplay 10" onClick={() => void startAutoplay()}>
          {autoplaying ? `⏹ ${autoplayLeft}` : '⟳ 10'}
        </button>
        <button className="hud-chip buy" disabled={busy} title="Buy the Free Spins feature (100× bet)" onClick={() => void controller.scenario('bonus-buy')}>
          BUY
        </button>
        <button className="hud-chip" title="Paytable" onClick={() => setOverlay('paytable')}>
          ℹ
        </button>
        <button className="hud-chip" title={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
