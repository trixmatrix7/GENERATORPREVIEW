// ControlBar — bottom HUD bar under the slot, built from Noski's
// chaingames-controlbar preset (bar 978×124 anchored bottom-center; left
// icons + CREDIT/BET readouts, center "START AND WIN" status, right cluster
// with bet −, spin, bet +, autoplay; BONUS BUY floating above-left).
// Per the preset spec this is a separate DOM/React layer (NOT canvas).
// Coords are adapted to our bounded game-box width (regions + proportions
// kept; left/right paddings fit our 912px box). The cluster PNGs aren't in
// the package, so the − / spin / + / autoplay controls are recreated in CSS.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatUnits, parseUnits } from 'viem';
import { Volume2, VolumeX, Dices, HelpCircle, Minus, Plus, RotateCw, Square, Zap } from 'lucide-react';
import { GAME_CONFIG } from '@/config/gameConfig';
import type { GameState } from '@/state/types';
import type { HostSnapshotV1 } from '@/bridge/types';
import type { SoundManager } from '@/audio/SoundManager';

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
}

export function ControlBar({ gameState, snapshot, onBetChange, onSpin, onSkip, onAutoSpin, onStopAuto, onBuyBonus, turbo, onTurboToggle, soundManager }: Props) {
  const { t } = useTranslation();
  const decimals = snapshot.token.decimals ?? 18;
  const balance = snapshot.balances.smartVaultBalance ?? '0';
  const isReady = snapshot.wallet.status === 'ready';

  const isIdle = gameState.phase === 'idle' || gameState.phase === 'error';
  const betBig = BigInt(gameState.betBaseUnits || '0');
  const balanceBig = BigInt(balance || '0');
  const canSpin = isReady && gameState.phase === 'idle' && betBig >= GAME_CONFIG.minBetBaseUnits && betBig <= balanceBig;
  const isLoading = gameState.phase === 'awaiting_tx' || gameState.phase === 'spinning';
  const canSkip = gameState.phase === 'resolving';
  const isAutoRunning = gameState.autoSpinsRemaining > 0;

  // ── readout values ("toFixed(2)" per the preset) ──────────────────────────
  const credit = Number(formatUnits(balanceBig, decimals)).toFixed(2);
  const bet = Number(gameState.betDisplay || '0').toFixed(2);
  const winAmount = gameState.phase === 'settled_win' && gameState.lastOutcome
    ? Number(formatUnits(gameState.lastOutcome.winAmount, decimals)).toFixed(2)
    : null;

  // ── bet − / + (same clamp as BetInput's ÷2/×2) ─────────────────────────────
  function clamp(raw: bigint): bigint {
    const min = GAME_CONFIG.minBetBaseUnits;
    const max = balanceBig > 0n
      ? (balanceBig < GAME_CONFIG.maxBetBaseUnits ? balanceBig : GAME_CONFIG.maxBetBaseUnits)
      : GAME_CONFIG.maxBetBaseUnits;
    return raw < min ? min : raw > max ? max : raw;
  }
  function stepBet(dir: -1 | 1) {
    let current: bigint;
    try { current = parseUnits(gameState.betDisplay || '0', decimals); } catch { current = 0n; }
    const next = clamp(dir === 1 ? current * 2n : current / 2n);
    onBetChange(formatUnits(next, decimals));
  }

  // ── sound icon state (subscribe like AudioControl) ─────────────────────────
  const [muted, setMuted] = useState(soundManager?.muted ?? false);
  useEffect(() => {
    if (!soundManager) return;
    return soundManager.subscribe(() => setMuted(soundManager.muted));
  }, [soundManager]);

  // ── bonus buy (above-bar button per the preset) ────────────────────────────
  const bonusBuyCost = (GAME_CONFIG as { bonusBuyCost?: number }).bonusBuyCost;
  const bonusBuyCostBase = bonusBuyCost != null
    ? (betBig * BigInt(Math.round(bonusBuyCost * 100))) / 100n
    : 0n;
  const canBuyBonus =
    isReady && gameState.phase === 'idle' && bonusBuyCost != null &&
    betBig >= GAME_CONFIG.minBetBaseUnits && bonusBuyCostBase <= balanceBig;

  const iconBtn = 'flex items-center justify-center text-white/85 transition-opacity hover:opacity-80 cursor-pointer bg-transparent border-none p-0';
  const stepBtn = 'flex h-[44px] w-[46px] items-center justify-center rounded-[10px] bg-white/[0.07] border border-white/10 text-white/85 transition-all hover:bg-white/[0.14] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';

  return (
    <div className="relative select-none" style={{ fontFamily: 'var(--font-display)' }}>
      {/* BONUS BUY — floats above the bar, left edge (preset: 168×42 at BY−48) */}
      {bonusBuyCost != null && !isAutoRunning && (
        <button
          type="button"
          onClick={onBuyBonus}
          disabled={!canBuyBonus}
          title={`Buy the free-spins round for ${bonusBuyCost}× your bet`}
          className="absolute -top-[48px] left-2 z-10 flex h-[42px] w-[168px] items-center justify-center gap-2 rounded-[12px] border border-black bg-[#2c2c2c] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-opacity hover:opacity-85 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="text-[15px]">🪙</span>
          <span className="text-[14px] font-bold italic tracking-[0.5px] text-[#ffaf68]">BONUS BUY</span>
        </button>
      )}

      {/* Bar — vertical gradient rgba(30,30,30,0) → #111 per the preset */}
      <div
        className="flex items-center gap-3 px-4 h-[112px]"
        style={{ background: 'linear-gradient(180deg, rgba(30,30,30,0) 0%, #111111 100%)' }}
      >
        {/* ── left: sound / RNG / help icons ── */}
        <div className="flex flex-col gap-2 shrink-0">
          <button type="button" className={iconBtn} title={muted ? 'Unmute' : 'Mute'} onClick={() => soundManager?.toggleMuted()}>
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button type="button" className={iconBtn} title="Provably fair (RNG)">
            <Dices size={20} />
          </button>
        </div>
        <button type="button" className={`${iconBtn} shrink-0`} title="Rules / paytable">
          <HelpCircle size={30} strokeWidth={1.6} />
        </button>

        {/* ── CREDIT / BET readouts (Poppins italic, ls −1.4) ── */}
        <div className="flex flex-col gap-1 shrink-0 ml-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-bold italic tracking-[-1px] text-[#dfe2e5]">CREDIT</span>
            <span className="text-[13px]">🪙</span>
            <span className="text-[15px] font-semibold italic text-[#eef0f2] tabular-nums">{credit}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-bold italic tracking-[-1px] text-[#dfe2e5]">BET</span>
            <span className="text-[13px]">🪙</span>
            <span className="text-[15px] font-semibold italic text-[#eef0f2] tabular-nums">{bet}</span>
          </div>
        </div>

        {/* ── center: win status ("START AND WIN" idle / "WIN x.xx") ── */}
        <div className="flex-1 text-center min-w-0">
          <span className={`text-[26px] font-extrabold italic tracking-[-2px] whitespace-nowrap ${winAmount ? 'text-[var(--color-yellow)]' : 'text-white'}`}>
            {winAmount ? `WIN  ${winAmount}` : 'START AND WIN'}
          </span>
        </div>

        {/* ── right cluster: − / spin / + on top, ⚡ + autoplay below ── */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-4">
            <button type="button" className={stepBtn} onClick={() => stepBet(-1)} disabled={!isReady || !isIdle} title="Bet −">
              <Minus size={20} />
            </button>
            <button
              type="button"
              onClick={canSkip ? onSkip : onSpin}
              disabled={!canSkip && (!canSpin || isLoading)}
              title={canSkip ? 'Skip animation' : 'Spin'}
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full cursor-pointer border-none transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-black"
              style={{
                background: 'radial-gradient(circle at 50% 35%, #ffe9a8 0%, var(--color-yellow) 55%, #caa62e 100%)',
                boxShadow: '0 0 24px rgba(248,250,94,0.45), 0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {canSkip
                ? <Square size={22} fill="currentColor" />
                : isLoading
                  ? <span className="inline-block w-6 h-6 rounded-full border-[3px] border-black/25 border-t-black animate-spin" aria-hidden />
                  : <RotateCw size={30} strokeWidth={2.6} />}
            </button>
            <button type="button" className={stepBtn} onClick={() => stepBet(1)} disabled={!isReady || !isIdle} title="Bet +">
              <Plus size={20} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onTurboToggle}
              title="Turbo mode — reels snap instantly"
              className={`${iconBtn} ${turbo ? 'text-[var(--color-yellow)]' : 'text-white/50'}`}
            >
              <Zap size={16} fill={turbo ? 'currentColor' : 'none'} />
            </button>
            {isAutoRunning ? (
              <button
                type="button"
                onClick={onStopAuto}
                className="h-[34px] px-5 rounded-[10px] bg-[var(--color-red)] border-none text-white text-[13px] font-bold italic tracking-[0.5px] cursor-pointer transition-opacity hover:opacity-90"
              >
                {t('stop_auto', { count: gameState.autoSpinsRemaining })}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAutoSpin(10)}
                disabled={!canSpin}
                title="Autoplay — 10 spins"
                className="h-[34px] px-5 rounded-[10px] bg-white/[0.07] border border-white/10 text-white/85 text-[13px] font-bold italic tracking-[0.5px] cursor-pointer transition-all hover:bg-white/[0.14] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                AUTO SPIN
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
