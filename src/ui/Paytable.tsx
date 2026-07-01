// ui/Paytable.tsx — "für die Symbole": the symbol paytable overlay. Every value
// comes straight from the spec (engine/paytable.ts + gameConfig SPEC/HOLD_WIN).

import { useRuntime } from '../store/useRuntime';
import { useStudio } from '../store/useStudio';
import { useDerivedConfig } from '../store/derive';
import { PAY_TABLE, SCATTER_PAY, BPS_DIVISOR } from '../engine/paytable';
import { SPEC, HOLD_WIN, BET_LEVELS } from '../config/gameConfig';
import { SymbolId } from '../config/symbols';
import { Coin } from './Coin';

const ORDER = [
  SymbolId.WILD,
  SymbolId.HIGH_A,
  SymbolId.HIGH_B,
  SymbolId.MID_C,
  SymbolId.MID_D,
  SymbolId.LOW_E,
  SymbolId.LOW_F,
  SymbolId.LOW_G,
];

const fmtX = (bps: number) => (bps > 0 ? `${(bps / BPS_DIVISOR).toFixed(bps / BPS_DIVISOR < 1 ? 3 : 2)}×` : '—');

export function Paytable() {
  const open = useRuntime((s) => s.overlay === 'paytable');
  const close = () => useRuntime.getState().setOverlay('none');
  const { symbolMeta } = useDerivedConfig();
  const bet = BET_LEVELS[useStudio((s) => s.betIndex)];
  if (!open) return null;

  const tile = (id: number, big = false) => {
    const m = symbolMeta.get(id);
    const c = m?.placeholderColor ?? 0x555555;
    const hex = `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
    return (
      <div className={`pt-tile ${big ? 'big' : ''}`} style={{ borderColor: hex, color: hex }}>
        {m?.label ?? id}
      </div>
    );
  };

  return (
    <div className="overlay-backdrop" onClick={close}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <h2 className="display italic-black">Paytable</h2>
          <button className="btn ghost" onClick={close}>
            ✕
          </button>
        </div>
        <p className="hint">
          {SPEC.rtpBps / 100}% RTP · {5 ** 5} ways · pays shown are <strong>per way × bet</strong>. Wins pay left→right on
          3+ consecutive reels. Wild substitutes for all except Scatter.
        </p>

        <div className="pt-grid">
          {ORDER.map((id) => {
            const pays = PAY_TABLE[id];
            return (
              <div className="pt-row" key={id}>
                {tile(id)}
                <div className="pt-pays">
                  {[3, 4, 5].map((n) => (
                    <span key={n} className="pt-pay">
                      <em>{n}×</em> {fmtX(pays ? pays[n - 3] : 0)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-special">
          <div className="pt-special-row">
            {tile(SymbolId.SCATTER, true)}
            <div>
              <div className="pt-name">Scatter</div>
              <div className="pt-desc">
                Pays anywhere: 3→{fmtX(SCATTER_PAY[0])} 4→{fmtX(SCATTER_PAY[1])} 5→{fmtX(SCATTER_PAY[2])}. <strong>3+ triggers {SPEC.freeSpinsCount} Free Spins</strong> at ×{SPEC.freeSpinsMultiplier} (retrigger, cap {SPEC.freeSpinsCap}).
              </div>
            </div>
          </div>
          <div className="pt-special-row">
            {tile(SymbolId.COIN, true)}
            <div>
              <div className="pt-name">Coin — Hold &amp; Win</div>
              <div className="pt-desc">
                {HOLD_WIN.triggerMinCoins}+ coins trigger {HOLD_WIN.startRespins} respins. Coins hold; each new coin resets respins. Jackpots {HOLD_WIN.jackpots.join(' / ')}× · full board = Grand {HOLD_WIN.grandValue}×.
              </div>
            </div>
          </div>
        </div>

        <div className="pt-features">
          <span className="chip">Max win {SPEC.maxWinMultiplier}×</span>
          <span className="chip">Buy Bonus 100× ({(bet * 100).toFixed(0)})</span>
          <span className="chip">Near-miss tease</span>
        </div>
      </div>
    </div>
  );
}
