// ControlBar — Noski's REAL chaingames control bar, rebuilt 1:1 from the
// chaingames-complete package (presets/controlbar/control-bar.reference.md +
// the shipped PNG assets in assets/ui/).
//
// Fidelity approach: the reference gives exact DESIGN-SPACE coordinates
// (1200×675 logical canvas; bar 978×124 at BX=111, BY=543; bg gradient full
// width × 150 tall). We lay everything out at those exact px inside a
// 1200×150 bottom strip and scale the strip to the game box width — so the
// arrangement is pixel-identical, only uniformly resized to our measurements.
//
// Assets (public/theme/chain/ui/, @2x PNGs from the package):
//   snd_on/snd_off · dice · help · coin · cluster_idle · cluster_stop
// The − / spin / + / autoplay glyphs are BAKED into the cluster image; only
// transparent hit zones sit over them (exactly like the original ui.js).
// The open*Menu overlay panels are a separate preset set — not wired here.

import { useEffect, useRef, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
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

const UI = `${import.meta.env.BASE_URL}theme/chain/ui/`;

// Design-space constants from the reference (all px in 1200×675 space).
const DESIGN_W = 1200;
const STRIP_H = 150;              // bg gradient: full width, height 150
const BX = 111, BY_IN_STRIP = 18; // bar origin inside the strip (543 − 525)

export function ControlBar({ gameState, snapshot, onBetChange, onSpin, onSkip, onAutoSpin, onStopAuto, onBuyBonus, soundManager }: Props) {
  const decimals = snapshot.token.decimals ?? 18;
  const balance = snapshot.balances.smartVaultBalance ?? '0';
  const isReady = snapshot.wallet.status === 'ready';

  const isIdle = gameState.phase === 'idle' || gameState.phase === 'error';
  const betBig = BigInt(gameState.betBaseUnits || '0');
  const balanceBig = BigInt(balance || '0');
  const canSpin = isReady && gameState.phase === 'idle' && betBig >= GAME_CONFIG.minBetBaseUnits && betBig <= balanceBig;
  const isSpinning = gameState.phase === 'awaiting_tx' || gameState.phase === 'spinning' || gameState.phase === 'resolving';
  const canSkip = gameState.phase === 'resolving';
  const isAutoRunning = gameState.autoSpinsRemaining > 0;

  // ── responsive scale: strip is laid out at 1200 design-px, scaled to fit ──
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(912 / DESIGN_W);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / DESIGN_W));
    ro.observe(el);
    setScale(el.clientWidth / DESIGN_W);
    return () => ro.disconnect();
  }, []);

  // ── values ("toFixed(2)" per the reference setters) ───────────────────────
  const credit = Number(formatUnits(balanceBig, decimals)).toFixed(2);
  const bet = Number(gameState.betDisplay || '0').toFixed(2);
  const winAmount = gameState.phase === 'settled_win' && gameState.lastOutcome
    ? Number(formatUnits(gameState.lastOutcome.winAmount, decimals)).toFixed(2)
    : null;

  // ── bet − / + (same clamp as BetInput ÷2/×2) ──────────────────────────────
  function clamp(raw: bigint): bigint {
    const min = GAME_CONFIG.minBetBaseUnits;
    const max = balanceBig > 0n
      ? (balanceBig < GAME_CONFIG.maxBetBaseUnits ? balanceBig : GAME_CONFIG.maxBetBaseUnits)
      : GAME_CONFIG.maxBetBaseUnits;
    return raw < min ? min : raw > max ? max : raw;
  }
  function stepBet(dir: -1 | 1) {
    if (!isReady || !isIdle) return;
    let current: bigint;
    try { current = parseUnits(gameState.betDisplay || '0', decimals); } catch { current = 0n; }
    const next = clamp(dir === 1 ? current * 2n : current / 2n);
    onBetChange(formatUnits(next, decimals));
  }

  // ── sound icon state (sndOn/sndOff by sound.enabled) ──────────────────────
  const [muted, setMuted] = useState(soundManager?.muted ?? false);
  useEffect(() => {
    if (!soundManager) return;
    return soundManager.subscribe(() => setMuted(soundManager.muted));
  }, [soundManager]);

  // ── bonus buy (above-bar button; renders only when the game carries a cost)
  const bonusBuyCost = (GAME_CONFIG as { bonusBuyCost?: number }).bonusBuyCost;
  const bonusBuyCostBase = bonusBuyCost != null
    ? (betBig * BigInt(Math.round(bonusBuyCost * 100))) / 100n
    : 0n;
  const canBuyBonus =
    isReady && gameState.phase === 'idle' && bonusBuyCost != null &&
    betBig >= GAME_CONFIG.minBetBaseUnits && bonusBuyCostBase <= balanceBig;

  // center-anchored icon (reference: sprites are center-anchored; hit +10 pad)
  const icon = (src: string, x: number, y: number, size: number, title: string, onClick?: () => void) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="absolute p-0 border-none bg-transparent cursor-pointer transition-opacity hover:opacity-80"
      style={{ left: x - size / 2 - 5, top: y - size / 2 - 5, width: size + 10, height: size + 10 }}
    >
      <img src={src} alt="" draggable={false} style={{ width: size, height: size, margin: 5, display: 'block' }} />
    </button>
  );

  // transparent hit zone over the baked-in cluster art
  const hitZone = (x: number, y: number, w: number, h: number, title: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="absolute p-0 border-none bg-transparent cursor-pointer disabled:cursor-not-allowed"
      style={{ left: x, top: y, width: w, height: h }}
    />
  );

  const poppins = { fontFamily: 'var(--font-display)', fontStyle: 'italic' as const };

  return (
    <div ref={hostRef} className="relative w-full select-none" style={{ height: STRIP_H * scale }}>
      <div
        className="absolute left-0 top-0"
        style={{
          width: DESIGN_W,
          height: STRIP_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // reference: vertical gradient, FULL width, height 150, transparent → #111
          background: 'linear-gradient(180deg, rgba(30,30,30,0) 0%, #111111 100%)',
        }}
      >
        {/* ── the bar (978×124 at BX=111) — all children at exact reference px ── */}
        <div className="absolute" style={{ left: BX, top: BY_IN_STRIP, width: 978, height: 124 }}>

          {/* left icons: sound (16,42) 30 · dice (16,82) 30 · help (58,64) 44 */}
          {icon(muted ? `${UI}snd_off.png` : `${UI}snd_on.png`, 16, 42, 30, muted ? 'Sound off' : 'Sound on', () => soundManager?.toggleMuted())}
          {icon(`${UI}dice.png`, 16, 82, 30, 'Provably fair (RNG)')}
          {icon(`${UI}help.png`, 58, 64, 44, 'Rules / paytable')}

          {/* CREDIT row: label 20px #dfe2e5 (108,40) · coin 19px (208,40) · value 18px #eef0f2 (224,40) */}
          <span className="absolute whitespace-nowrap" style={{ ...poppins, left: 108, top: 40, transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, letterSpacing: -1.4, color: '#dfe2e5' }}>CREDIT</span>
          <img src={`${UI}coin.png`} alt="" draggable={false} className="absolute" style={{ left: 208 - 9.5, top: 40 - 9.5, width: 19, height: 19 }} />
          <span className="absolute whitespace-nowrap tabular-nums" style={{ ...poppins, left: 224, top: 40, transform: 'translateY(-50%)', fontSize: 18, fontWeight: 600, color: '#eef0f2' }}>{credit}</span>

          {/* BET row: label (108,84) · coin (220,84) · value (236,84) · hit zone (104,70,150×36) */}
          <span className="absolute whitespace-nowrap" style={{ ...poppins, left: 108, top: 84, transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, letterSpacing: -1.4, color: '#dfe2e5' }}>BET</span>
          <img src={`${UI}coin.png`} alt="" draggable={false} className="absolute" style={{ left: 220 - 9.5, top: 84 - 9.5, width: 19, height: 19 }} />
          <span className="absolute whitespace-nowrap tabular-nums" style={{ ...poppins, left: 236, top: 84, transform: 'translateY(-50%)', fontSize: 18, fontWeight: 600, color: '#eef0f2' }}>{bet}</span>
          {hitZone(104, 70, 150, 36, 'Bet (menu — separate overlay set)', () => { /* openBetMenu: overlay set is a separate preset */ })}

          {/* center status (526,62): "START AND WIN" 30px white italic ls −2 / "WIN  x.xx" */}
          <span
            className="absolute whitespace-nowrap"
            style={{ ...poppins, left: 526, top: 62, transform: 'translate(-50%,-50%)', fontSize: 30, fontWeight: 700, letterSpacing: -2, color: winAmount ? 'var(--color-yellow)' : '#ffffff' }}
          >
            {winAmount ? `WIN  ${winAmount}` : 'START AND WIN'}
          </span>

          {/* right cluster: ONE image (769,0) 209×125 — idle arrows / stop square */}
          <img
            src={isSpinning ? `${UI}cluster_stop.png` : `${UI}cluster_idle.png`}
            alt=""
            draggable={false}
            className="absolute"
            style={{ left: 769, top: 0, width: 209, height: 125 }}
          />
          {/* autoplay-on tint 0xc8e6a0: same PNG masked, green, over the art */}
          {isAutoRunning && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: 769, top: 0, width: 209, height: 125,
                background: '#c8e6a0', opacity: 0.45,
                WebkitMaskImage: `url(${isSpinning ? `${UI}cluster_stop.png` : `${UI}cluster_idle.png`})`,
                maskImage: `url(${isSpinning ? `${UI}cluster_stop.png` : `${UI}cluster_idle.png`})`,
                WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
              }}
            />
          )}
          {/* transparent hit zones per the reference */}
          {hitZone(771, 14, 46, 44, 'Bet −', () => stepBet(-1), !isReady || !isIdle)}
          {hitZone(837, 8, 74, 74, canSkip ? 'Skip' : 'Spin', () => { if (canSkip) onSkip(); else if (canSpin && !isSpinning) onSpin(); }, !canSkip && (!canSpin || isSpinning))}
          {hitZone(930, 14, 46, 44, 'Bet +', () => stepBet(1), !isReady || !isIdle)}
          {hitZone(796, 79, 155, 42, isAutoRunning ? `Stop autoplay (${gameState.autoSpinsRemaining} left)` : 'Autoplay — 10 spins',
            () => { if (isAutoRunning) onStopAuto(); else if (canSpin) onAutoSpin(10); })}

          {/* BONUS BUY — 168×42 at (2, −48): #2c2c2c r12, black outline + white 16% top line */}
          {bonusBuyCost != null && !isAutoRunning && (
            <button
              type="button"
              onClick={onBuyBonus}
              disabled={!canBuyBonus}
              title={`Buy the free-spins round for ${bonusBuyCost}× your bet`}
              className="absolute flex items-center cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-35 disabled:cursor-not-allowed"
              style={{
                left: 2, top: -48, width: 168, height: 42,
                background: '#2c2c2c', borderRadius: 12,
                border: '1.5px solid #000000',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
              }}
            >
              <img src={`${UI}coin.png`} alt="" draggable={false} className="absolute" style={{ left: 24 - 11, top: 21 - 11, width: 22, height: 22 }} />
              <span className="absolute whitespace-nowrap" style={{ ...poppins, left: '50%', top: '50%', transform: 'translate(calc(-50% + 12px),-50%)', fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: '#ffaf68' }}>BONUS BUY</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
