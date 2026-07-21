// Sidebar — full-height left panel
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatUnits } from 'viem';
import { BetInput } from './components/BetInput';
import { SpinButton } from './components/SpinButton';
import { RecentBets } from './components/RecentBets';
import { AudioControl } from './components/AudioControl';
import { SoundParamsPanel } from './components/SoundParamsPanel';
import { previewWin } from '@/engine/SlotEngine';
import { GAME_CONFIG } from '@/config/gameConfig';
import { WinTierTestPanel } from '@/dev/WinTierTestPanel';
import type { GameState } from '@/state/types';
import type { HostSnapshotV1 } from '@/bridge/types';
import type { SoundManager } from '@/audio/SoundManager';
import type { PixiApp } from '@/game/PixiApp';

interface Props {
  gameState: GameState;
  snapshot: HostSnapshotV1;
  onBetChange: (display: string) => void;
  onSpin: () => void;
  onSkip: () => void;
  onAutoSpin: (count: number) => void;
  onStopAuto: () => void;
  onBuyBonus?: () => void;
  turbo: boolean;
  onTurboToggle: () => void;
  soundManager?: SoundManager;
  /** When set, the dev "Test features" panel is rendered under the Spin controls. */
  pixiApp?: PixiApp | null;
}

type Mode = 'manual' | 'auto';

const section = 'px-3 py-3 border-t border-[var(--color-border-subtle)] first:border-t-0';

export function Sidebar({ gameState, snapshot, onBetChange, onSpin, onSkip, onAutoSpin, onStopAuto, onBuyBonus, turbo, onTurboToggle, soundManager, pixiApp }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('manual');
  const [autoCount, setAutoCount] = useState(10);

  const decimals = snapshot.token.decimals ?? 18;
  const symbol = snapshot.token.symbol ?? '$';
  const balance = snapshot.balances.smartVaultBalance ?? '0';
  const isReady = snapshot.wallet.status === 'ready';
  const chainId = snapshot.integration.chainId;

  const isIdle = gameState.phase === 'idle';
  const betBig = BigInt(gameState.betBaseUnits || '0');
  const balanceBig = BigInt(balance || '0');
  const isInsufficientBalance = betBig > 0n && betBig > balanceBig;

  // Input stays editable during idle AND error so users can fix their bet.
  const canEdit = isReady && (isIdle || gameState.phase === 'error');
  const canSpin =
    isReady &&
    isIdle &&
    betBig >= GAME_CONFIG.minBetBaseUnits &&
    !isInsufficientBalance;

  // Bonus buy — only offered when the game's config carries a cost (generated
  // bonus-buy games). cost = bet × bonusBuyCost.
  const bonusBuyCost = (GAME_CONFIG as { bonusBuyCost?: number }).bonusBuyCost;
  const bonusBuyCostBase = bonusBuyCost != null
    ? (betBig * BigInt(Math.round(bonusBuyCost * 100))) / 100n
    : 0n;
  const canBuyBonus =
    isReady && isIdle && bonusBuyCost != null &&
    betBig >= GAME_CONFIG.minBetBaseUnits && bonusBuyCostBase <= balanceBig;

  // Live stats
  const { winChancePct, profitOnWin } = computeLiveStats(betBig, decimals);
  const totalReturn = betBig + profitOnWin;
  const multiplier = betBig > 0n ? Number((totalReturn * 100n) / betBig) / 100 : 0;

  function handleAutoStart() {
    if (mode === 'auto') {
      // Only arm the counter — the auto-spin effect in useGameState fires
      // every spin (including the first) when idle && remaining > 0. Calling
      // onSpin() here too would fire one extra real-money wager (N+1 bug).
      onAutoSpin(autoCount);
    }
  }

  const isAutoRunning = gameState.autoSpinsRemaining > 0;

  return (
    <aside className="w-[var(--sidebar-width)] h-full bg-[var(--color-surface)] border-r rtl:border-r-0 rtl:border-l border-[var(--color-border)] flex flex-col overflow-y-auto overflow-x-hidden shrink-0">

      {/* Mode + Turbo toggle */}
      <div className={section}>
        <div className="flex bg-[var(--color-bg)] rounded-[var(--radius-pill)] p-[3px] gap-[2px]">
          {(['manual', 'auto'] as Mode[]).map(m => (
            <button
              key={m}
              className={[
                'flex-1 h-[32px] border-none rounded-[var(--radius-pill)] font-[var(--font-display)] text-[12px] font-semibold italic cursor-pointer transition-all duration-200',
                mode === m
                  ? 'bg-[var(--color-blue)] text-white shadow-[var(--shadow-glow-blue)]'
                  : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]',
              ].join(' ')}
              onClick={() => setMode(m)}
              type="button"
            >
              {m === 'manual' ? t('mode_manual') : t('mode_auto')}
            </button>
          ))}
          <button
            className={[
              'w-[32px] h-[32px] border-none rounded-[var(--radius-pill)] text-[14px] cursor-pointer transition-all duration-200 shrink-0',
              turbo
                ? 'bg-[var(--color-yellow)] text-black shadow-[var(--shadow-glow-yellow)]'
                : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]',
            ].join(' ')}
            onClick={onTurboToggle}
            type="button"
            title="Turbo mode — reels snap instantly"
          >
            ⚡
          </button>
        </div>
      </div>

      {/* Audio control — master volume + mute. Hidden when no manager wired. */}
      {soundManager && (
        <div className={section}>
          <label className="block font-[var(--font-body)] text-[10px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-[0.07em]">
            {t('audio_label')}
          </label>
          <AudioControl soundManager={soundManager} />
          {/* Per-event mix panel — every core sound gets its own slider
              (Noski tweakt den Mix live; Overrides überleben Reloads). */}
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              Sound-Parameter
            </summary>
            <div className="mt-2">
              <SoundParamsPanel soundManager={soundManager} />
            </div>
          </details>
        </div>
      )}

      {/* Bet input */}
      <div className={section}>
        <BetInput
          value={gameState.betDisplay}
          onChange={onBetChange}
          disabled={!canEdit}
          balance={balance}
          decimals={decimals}
          tokenSymbol={symbol}
        />
        {isInsufficientBalance && (
          <p className="mt-1 text-[11px] font-medium text-[var(--color-red)]">
            {t('insufficient_balance')}
          </p>
        )}
      </div>

      {/* Free spins badge */}
      {gameState.lastOutcome?.freeSpinsTriggered && (
        <div className={section}>
          <div className="bg-[linear-gradient(135deg,var(--color-yellow)_0%,#e6e854_100%)] text-black rounded-[var(--radius-sm)] px-3 py-1.5 font-[var(--font-display)] text-[12px] font-bold italic text-center shadow-[var(--shadow-glow-yellow)]">
            {t('free_spins_badge', { count: gameState.lastOutcome.freeSpinsPlayed })}
          </div>
        </div>
      )}

      {/* Auto-spin count selector */}
      {mode === 'auto' && !isAutoRunning && (
        <div className={section}>
          <label className="block font-[var(--font-body)] text-[10px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-[0.07em]">
            {t('auto_spins_label')}
          </label>
          <div className="flex gap-[5px]">
            {[10, 25, 50, 100].map(n => (
              <button
                key={n}
                className={[
                  'flex-1 h-[32px] rounded-[var(--radius-sm)] font-[var(--font-body)] text-[12px] font-medium cursor-pointer transition-all duration-150 border',
                  autoCount === n
                    ? 'bg-[var(--color-blue)] text-white border-[var(--color-blue)] shadow-[var(--shadow-glow-blue)]'
                    : 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-secondary)]',
                ].join(' ')}
                onClick={() => setAutoCount(n)}
                type="button"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary CTA */}
      <div className={section}>
        {isAutoRunning ? (
          <button
            className="w-full h-[46px] bg-[var(--color-red)] text-white font-[var(--font-display)] text-[14px] font-bold italic border-none rounded-[var(--radius-pill)] cursor-pointer transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            onClick={onStopAuto}
            type="button"
          >
            {t('stop_auto', { count: gameState.autoSpinsRemaining })}
          </button>
        ) : (
          <SpinButton
            isLoading={gameState.phase === 'awaiting_tx' || gameState.phase === 'spinning'}
            canSkip={gameState.phase === 'resolving'}
            onSpin={mode === 'auto' ? handleAutoStart : onSpin}
            onSkip={onSkip}
            disabled={!canSpin}
          />
        )}
        {bonusBuyCost != null && !isAutoRunning && (
          <button
            className="w-full h-[40px] mt-2 bg-[var(--color-surface-raised)] text-[var(--color-yellow)] border border-[var(--color-yellow)] font-[var(--font-display)] text-[12px] font-bold italic rounded-[var(--radius-pill)] cursor-pointer transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={onBuyBonus}
            disabled={!canBuyBonus}
            type="button"
            title={`Buy the free-spins round for ${bonusBuyCost}× your bet`}
          >
            Buy Bonus · {formatUnits(bonusBuyCostBase, decimals)} {symbol}
          </button>
        )}
      </div>

      {/* Dev "Test features" panel — lives here in the left bar, under the Spin
          controls, so it never overlaps the top-right HUD/menu. */}
      {pixiApp && soundManager && (
        <div className={section}>
          <WinTierTestPanel pixiApp={pixiApp} snapshot={snapshot} soundManager={soundManager} />
        </div>
      )}

      {/* Win Chance & Profit on Win */}
      <div className={section}>
        <div className="flex gap-[6px]">
          <Stat label={t('win_chance')} value={betBig > 0n ? `${winChancePct.toFixed(2)}%` : '—'} />
          <Stat label={t('profit_on_win')} value={betBig > 0n ? `${formatUnits(profitOnWin, decimals)} ${symbol}` : '—'} />
        </div>
      </div>

      {/* Total Win */}
      <div className={section}>
        <div className="flex justify-between items-center bg-[var(--color-surface-raised)] rounded-[var(--radius-md)] px-3 py-2 border border-[var(--color-border-subtle)]">
          <span className="font-[var(--font-body)] text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.06em]">
            {t('total_win', { multiplier: multiplier.toFixed(2) })}
          </span>
          <span className="font-[var(--font-body)] text-[14px] font-semibold text-[var(--color-green)]">
            {betBig > 0n ? `${formatUnits(totalReturn, decimals)} ${symbol}` : '—'}
          </span>
        </div>
      </div>

      {/* Recent Bets */}
      <div className={`${section} flex-1 min-h-0`}>
        <RecentBets
          bets={gameState.recentBets}
          decimals={decimals}
          tokenSymbol={symbol}
          chainId={chainId}
        />
      </div>

      {/* Wallet not ready warning */}
      {!isReady && (
        <div className="px-3 py-2.5 bg-[rgba(213,50,34,0.1)] border-t border-[rgba(213,50,34,0.3)] font-[var(--font-body)] text-[12px] text-[var(--color-red)] text-center">
          {snapshot.wallet.status === 'disconnected'
            ? t('wallet_disconnected')
            : t('wallet_setup_required')}
        </div>
      )}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 flex flex-col gap-0.5 bg-[var(--color-surface-raised)] rounded-[var(--radius-md)] px-2.5 py-2 border border-[var(--color-border-subtle)]">
      <span className="font-[var(--font-body)] text-[9px] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="font-[var(--font-body)] text-[13px] font-semibold text-[var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}

function computeLiveStats(betBig: bigint, _decimals: number): { winChancePct: number; profitOnWin: bigint } {
  return previewWin(betBig);
}
