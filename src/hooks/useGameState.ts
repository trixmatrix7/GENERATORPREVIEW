// useGameState — wires the state machine to the bridge, PixiJS, and session events.

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { parseUnits } from 'viem';
import type { HostApiV1, HostSnapshotV1 } from '@/bridge/types';
import { gameReducer, initialState } from '@/state/GameStateMachine';
import { decodeSpinOutcome, encodeGameData } from '@/engine/SlotEngine';
import { decodeFruitStacksOutcome } from '@/game/decodeFruitStacks';
import { activePayModel } from '@/game/winEval';
import type { PixiApp } from '@/game/PixiApp';
import { EMPTY_HEX, GAME_CONFIG } from '@/config/gameConfig';

const SPIN_TIMEOUT_MS = 60_000;

export function useGameState(
  hostApi: HostApiV1 | null,
  snapshot: HostSnapshotV1 | null,
  pixiApp: PixiApp | null,
) {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const resolvingRef = useRef(false);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Clear all pending timers and block post-unmount dispatches. Without this,
  // a spin that settles (or times out) after the component unmounts would
  // dispatch into a dead reducer and leak the timer.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (spinTimerRef.current) { clearTimeout(spinTimerRef.current); spinTimerRef.current = null; }
      if (winDoneTimerRef.current) { clearTimeout(winDoneTimerRef.current); winDoneTimerRef.current = null; }
    };
  }, []);

  // ── Bridge connect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (hostApi) dispatch({ type: 'BRIDGE_CONNECTED' });
  }, [hostApi]);

  // ── Snapshot updates ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!snapshot) return;
    dispatch({ type: 'SNAPSHOT_UPDATED', payload: snapshot });

    const current = stateRef.current;

    if (current.pendingSession && current.phase === 'spinning') {
      const settled = snapshot.sessions.items.find(
        s => s.sessionKey === current.pendingSession!.sessionKey && s.isSettled,
      );

      if (settled?.raw.gameState && settled.wager && !resolvingRef.current) {
        resolvingRef.current = true;
        if (spinTimerRef.current) { clearTimeout(spinTimerRef.current); spinTimerRef.current = null; }
        const wager = BigInt(settled.wager);
        try {
          // Fruit Stacks bypasses the frozen uint8[5] decode — its 6-reel
          // cascade round is re-derived from the randomness via the same
          // pure core the settlement used (decode façade).
          const outcome = activePayModel() === 'scatterpays'
            ? decodeFruitStacksOutcome(
                settled.raw.gameState as `0x${string}`,
                wager,
                settled.raw.randomness as `0x${string}`,
              )
            : decodeSpinOutcome(
                settled.raw.gameState as `0x${string}`,
                wager,
                settled.raw.randomness as `0x${string}` | undefined,
              );

          // pixiApp.resolve() now AWAITS the win ceremony (coins + counting
          // number) before resolving — so the next spin holds until the win
          // presentation finishes, matching the reference game.
          void pixiApp?.resolve(
            outcome,
            snapshot.token.symbol ?? '$',
            snapshot.token.decimals ?? 18,
          ).then(() => {
            resolvingRef.current = false;
            if (!mountedRef.current) return;
            dispatch({ type: 'SPIN_SETTLED', payload: { outcome, session: settled } });
            const settledDwellMs = outcome.winAmount > 0n ? 600 : 0;
            if (winDoneTimerRef.current) clearTimeout(winDoneTimerRef.current);
            winDoneTimerRef.current = setTimeout(() => {
              winDoneTimerRef.current = null;
              if (mountedRef.current) dispatch({ type: 'WIN_ANIMATION_DONE' });
            }, settledDwellMs);
          });
        } catch (err) {
          resolvingRef.current = false;
          console.error('[slot] Failed to decode game state:', err);
          dispatch({ type: 'ERROR', payload: 'Failed to decode spin result.' });
        }
      }
    }
  }, [snapshot, pixiApp]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleBetChange = useCallback(
    (display: string) => {
      const decimals = snapshot?.token.decimals ?? 18;
      try {
        const baseUnits = parseUnits(display || '0', decimals).toString();
        dispatch({ type: 'BET_CHANGED', payload: { display, baseUnits } });
      } catch {
        // invalid input — ignore
      }
    },
    [snapshot],
  );

  const handleSpin = useCallback(async () => {
    if (!hostApi || !snapshot) return;
    const current = stateRef.current;
    if (current.phase !== 'idle') return;

    // Silently guard — the Sidebar already prevents the button being clickable
    // when balance is insufficient, so we only reach here in valid state.
    const wager = BigInt(current.betBaseUnits || '0');
    const balance = BigInt(snapshot.balances.smartVaultBalance ?? '0');
    if (wager <= 0n || wager > balance) return;

    dispatch({ type: 'SPIN_REQUESTED' });
    pixiApp?.spin();

    // Safety: recover to idle if settlement never arrives
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      const p = stateRef.current.phase;
      if (p === 'spinning' || p === 'awaiting_tx' || p === 'resolving') {
        dispatch({ type: 'ERROR', payload: 'Spin timed out — please try again.' });
      }
    }, SPIN_TIMEOUT_MS);

    try {
      const { sessionKey } = await hostApi.openSession({
        wager: current.betBaseUnits,
        gameData: encodeGameData(),
        randomnessRequestData: EMPTY_HEX,
      });
      dispatch({ type: 'SESSION_OPENED', payload: { sessionKey } });
    } catch (err: unknown) {
      if (spinTimerRef.current) { clearTimeout(spinTimerRef.current); spinTimerRef.current = null; }
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      dispatch({ type: 'ERROR', payload: mapTxError(msg) });
    }
  }, [hostApi, snapshot, pixiApp]);

  // Bonus Buy — pay a premium (cost = bet × bonusBuyCost) to jump straight into
  // the free-spins round. Same session flow as a spin, but the wager is the cost
  // and gameData signals the buy (the contract forces FS at the base bet).
  const handleBuyBonus = useCallback(async () => {
    if (!hostApi || !snapshot) return;
    const current = stateRef.current;
    if (current.phase !== 'idle') return;
    const bonusBuyCost = (GAME_CONFIG as { bonusBuyCost?: number }).bonusBuyCost;
    if (!bonusBuyCost) return;

    const baseBet = BigInt(current.betBaseUnits || '0');
    const cost = (baseBet * BigInt(Math.round(bonusBuyCost * 100))) / 100n;
    const balance = BigInt(snapshot.balances.smartVaultBalance ?? '0');
    if (cost <= 0n || cost > balance) return;

    dispatch({ type: 'SPIN_REQUESTED' });
    pixiApp?.spin();

    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      const p = stateRef.current.phase;
      if (p === 'spinning' || p === 'awaiting_tx' || p === 'resolving') {
        dispatch({ type: 'ERROR', payload: 'Spin timed out — please try again.' });
      }
    }, SPIN_TIMEOUT_MS);

    try {
      const { sessionKey } = await hostApi.openSession({
        wager: cost.toString(),
        gameData: encodeGameData(true),
        randomnessRequestData: EMPTY_HEX,
      });
      dispatch({ type: 'SESSION_OPENED', payload: { sessionKey } });
    } catch (err: unknown) {
      if (spinTimerRef.current) { clearTimeout(spinTimerRef.current); spinTimerRef.current = null; }
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      dispatch({ type: 'ERROR', payload: mapTxError(msg) });
    }
  }, [hostApi, snapshot, pixiApp]);

  const handleAutoSpin = useCallback(
    (count: number) => {
      dispatch({ type: 'AUTO_SPIN_START', payload: { count } });
    },
    [],
  );

  const handleStopAuto = useCallback(() => {
    dispatch({ type: 'AUTO_SPIN_STOP' });
  }, []);

  const handleClearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const handleSkip = useCallback(() => {
    pixiApp?.skip();
  }, [pixiApp]);

  // Auto-spin: fire next spin when idle and autoSpinsRemaining > 0
  useEffect(() => {
    if (state.phase === 'idle' && state.autoSpinsRemaining > 0) {
      dispatch({ type: 'AUTO_SPIN_TICK' });
      void handleSpin();
    }
  }, [state.phase, state.autoSpinsRemaining, handleSpin]);

  return {
    state,
    handleBetChange,
    handleSpin,
    handleBuyBonus,
    handleSkip,
    handleAutoSpin,
    handleStopAuto,
    handleClearError,
    pixiApp,
  };
}

function mapTxError(msg: string): string {
  if (msg.includes('BetRiskExceedsLimit')) return 'Bet exceeds available liquidity. Try a smaller amount.';
  if (msg.includes('user rejected')) return 'Transaction rejected.';
  if (msg.includes('insufficient funds')) return 'Insufficient balance.';
  return msg;
}
