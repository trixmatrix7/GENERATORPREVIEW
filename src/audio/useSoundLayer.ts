// useSoundLayer — React hook that owns a SoundManager singleton and
// dispatches sounds in response to game state transitions.
//
// State-driven sounds (handled here):
//   - spin:start            : phase → 'spinning'
//   - win:small/big/mega    : phase → 'settled_win', selected by amount
//   - freespin:trigger      : on settled_win when outcome.freeSpinsTriggered
//   - music:ambient         : autoplay on first spin (after a user gesture)
//
// PixiJS-driven sounds (delegated to PixiApp callbacks, see PixiApp.onReelStopped):
//   - reel:stop             : per reel, fired by ReelSet
//   - scatter:land          : per reel, fired by ReelSet when scatter visible
//
// All sounds gracefully no-op if the underlying file is missing.

import { useEffect, useRef } from 'react';
import type { SoundManager } from './SoundManager';
import { getSharedSoundManager } from './defaultSoundConfig';
import type { GameState } from '@/state/types';

// Win-tier band thresholds (multiples of bet). Match winScreenTiers registry
// bands so sound + visual stay in lockstep.
// 4 distinct stings: small (<2×), normal (2×-10×), big (10×–50×), mega (50×+).
const WIN_TIER_NORMAL_MIN = 2;
const WIN_TIER_BIG_MIN = 10;
const WIN_TIER_MEGA_MIN = 50;

export function selectWinSound(winAmount: bigint, wager: bigint): string | null {
  if (winAmount <= 0n || wager <= 0n) return null;
  const ratio = Number(winAmount) / Number(wager);
  if (ratio >= WIN_TIER_MEGA_MIN) return 'win-mega';
  if (ratio >= WIN_TIER_BIG_MIN) return 'win-big';
  if (ratio >= WIN_TIER_NORMAL_MIN) return 'win-normal';
  return 'win-small';
}

/**
 * Owns a SoundManager keyed to the lifetime of the component that mounts
 * this hook. Returns the manager so the consumer can wire it into PixiApp
 * callbacks and the audio control UI.
 */
export function useSoundLayer(state: GameState | null): SoundManager {
  // Page-lifetime singleton. NOT a useMemo + new SoundManager pattern —
  // that double-fires under React StrictMode and races with Howler's
  // in-flight decodes (see defaultSoundConfig.ts comment block).
  const manager = getSharedSoundManager();

  // Track previous phase so we only fire sounds on TRANSITIONS, not every
  // re-render where phase happens to equal 'spinning'.
  const prevPhaseRef = useRef<GameState['phase'] | null>(null);
  const ambientStartedRef = useRef(false);
  // Deferred coin-chime accents. Tracked so a new spin (or unmount) cancels
  // any still-pending chimes — otherwise back-to-back fast spins stack phantom
  // chimes into the singleton SoundManager after the celebration was killed.
  const accentTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearAccents = () => {
    for (const t of accentTimersRef.current) clearTimeout(t);
    accentTimersRef.current = [];
  };
  const scheduleAccent = (fn: () => void, delayMs: number) => {
    accentTimersRef.current.push(setTimeout(fn, delayMs));
  };

  // Cancel any pending accents when the hook unmounts.
  useEffect(() => () => clearAccents(), []);

  useEffect(() => {
    if (!state) return;
    const prev = prevPhaseRef.current;
    const next = state.phase;
    prevPhaseRef.current = next;

    if (prev === next) return;

    // Any phase transition invalidates accents queued by the previous one.
    clearAccents();

    // First spin starts ambient music (counts as a user gesture so Web Audio
    // unlocks). Subsequent spins don't restart it.
    if (next === 'awaiting_tx' || next === 'spinning') {
      if (!ambientStartedRef.current) {
        manager.play('ambient-music');
        ambientStartedRef.current = true;
      }
    }

    // Reel-spin-loop: start on spin, stop when settled.
    if (next === 'spinning' && prev !== 'spinning') {
      manager.play('spin-start');
      manager.play('reel-spin-loop');
    }
    if ((next === 'settled_win' || next === 'settled_loss') && prev === 'spinning') {
      manager.stop('reel-spin-loop');
    }

    if (next === 'settled_win' && prev !== 'settled_win') {
      const outcome = state.lastOutcome;
      if (outcome) {
        const wager = BigInt(state.betBaseUnits || '0');
        const winSound = selectWinSound(outcome.winAmount, wager);
        if (winSound) manager.play(winSound);
        // Coin-chime accent on big/mega tiers — timed to celebration timeline.
        if (winSound === 'win-big' || winSound === 'win-mega') {
          scheduleAccent(() => manager.play('coin-chime'), 200);
          scheduleAccent(() => manager.play('coin-chime'), 600);
        }
        if (winSound === 'win-mega') {
          scheduleAccent(() => manager.play('coin-chime'), 1100);
          scheduleAccent(() => manager.play('coin-chime'), 1700);
          scheduleAccent(() => manager.play('coin-chime'), 2300);
        }
        if (outcome.freeSpinsTriggered) manager.play('free-spin-trigger');
      }
    }
  }, [state, manager]);

  return manager;
}
