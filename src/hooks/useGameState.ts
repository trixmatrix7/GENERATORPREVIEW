// useGameState — wires the state machine to the bridge, PixiJS, and session events.

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { parseUnits } from 'viem';
import type { HostApiV1, HostSnapshotV1 } from '@/bridge/types';
import { gameReducer, initialState } from '@/state/GameStateMachine';
import { decodeSpinOutcome, encodeGameData } from '@/engine/SlotEngine';
import { decodeFruitStacksOutcome } from '@/game/decodeFruitStacks';
import { decodeSushiOutcome } from '@/game/decodeSushi';
import { decodeViceOutcome } from '@/game/decodeVice';
import { isViceMathConfig } from '@/game/viceSpin';
import { FRUIT_BUY_STAGES } from '@/game/fruitStacksMath';
import { SUSHI_BUY_STAGES } from '@/game/sushiMath';
import { activePayModel } from '@/game/winEval';
import { encodeAbiParameters, decodeAbiParameters } from 'viem';
import type { PixiApp } from '@/game/PixiApp';
import { EMPTY_HEX, GAME_CONFIG } from '@/config/gameConfig';
import { mathProfileById, loadMathProfileId } from '@/config/mathProfiles';

const SPIN_TIMEOUT_MS = 60_000;

/** Studio-wide user notice: fired when an action costs more than the linked
 *  funds — App listens on 'slot:notice' and shows the toast (all games). */
function notifyInsufficientFunds(): void {
  window.dispatchEvent(new CustomEvent('slot:notice', { detail: 'NOT ENOUGH FUNDS TO DO THAT' }));
}

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
        // VICE bought/ante rounds: the session wager is the PREMIUM (base bet ×
        // costMult for a buy, or × anteCostMult for an ante spin). Settlement
        // already credits + caps the payout on the BASE bet, but the FS
        // PRESENTATION keys off outcome.wager — the 5000× cap, the per-spin win
        // eval and the running TOTAL plaque (PixiApp). Passed the premium, a
        // bought round therefore displays costMult× too large and never reaches
        // the cap (Noski's TOTAL WIN 25779 on a 5000× game = ~129× × 200). Decode
        // the round at the BASE bet — the same `bet` the mockHost settle derives
        // — so display == settled payout and can never exceed 5000× the base bet.
        // Vice-only: fires only when this profile carries viceBuyStages/anteBet;
        // every other game (and a plain Vice spin, gameData '0x') keeps `wager`.
        let decodeWager = wager;
        // Vice rounds decode through their OWN façade (the round script), which
        // recovers the base bet from the encoded stage itself.
        const isVice = activePayModel() === 'ways'
          && isViceMathConfig(mathProfileById(loadMathProfileId()).build?.());
        {
          const build = mathProfileById(loadMathProfileId()).build?.() as {
            viceBuyStages?: Array<{ stage: number; costMult: number }>;
            anteBet?: { costMult: number };
          } | undefined;
          if (build?.viceBuyStages || build?.anteBet) {
            const gd = settled.raw.gameData;
            let stageCode = 0;
            if (typeof gd === 'string' && gd.length >= 66) {
              try { stageCode = Number(decodeAbiParameters([{ type: 'uint8' }], gd as `0x${string}`)[0]); } catch { stageCode = 0; }
            }
            const viceBuy = build.viceBuyStages?.find(s => s.stage === stageCode);
            if (viceBuy) {
              decodeWager = wager / BigInt(viceBuy.costMult);
            } else if (stageCode === 3 && build.anteBet) {
              decodeWager = (wager * 100n) / BigInt(Math.round(build.anteBet.costMult * 100));
            }
          }
        }
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
            : activePayModel() === 'cluster'
            ? decodeSushiOutcome(
                settled.raw.gameState as `0x${string}`,
                wager,
                settled.raw.randomness as `0x${string}`,
              )
            // Vice Heat bypasses the frozen uint8[5] decode too — its whole
            // round (base spin, hot expansion, every free spin with its towers
            // and credited win) is re-derived from the randomness via the same
            // pure core the settlement used, so the presentation replays the
            // settled round instead of inventing one.
            : isVice
            ? decodeViceOutcome(
                settled.raw.gameState as `0x${string}`,
                wager,
                settled.raw.randomness as `0x${string}`,
              )
            : decodeSpinOutcome(
                settled.raw.gameState as `0x${string}`,
                decodeWager,
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

    const wager = BigInt(current.betBaseUnits || '0');
    const balance = BigInt(snapshot.balances.smartVaultBalance ?? '0');
    if (wager <= 0n || wager > balance) {
      if (wager > balance) notifyInsufficientFunds();
      return;
    }

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
      // VICE ANTE ("3x FS chance"): while toggled, every spin costs
      // bet x anteMult and runs on the certified 3x-scatter strips —
      // gameData uint8(3) tells settlement to swap them for this spin.
      const anteBet = (mathProfileById(loadMathProfileId()).build?.() as { anteBet?: { costMult: number } } | undefined)?.anteBet;
      const anteOn = !!anteBet && localStorage.getItem('vice:ante') === '1';
      const anteWager = anteOn
        ? (wager * BigInt(Math.round(anteBet!.costMult * 100))) / 100n
        : wager;
      const { sessionKey } = await hostApi.openSession({
        wager: anteWager.toString(),
        gameData: anteOn ? encodeAbiParameters([{ type: 'uint8' }], [3]) : encodeGameData(),
        randomnessRequestData: EMPTY_HEX,
      });
      dispatch({ type: 'SESSION_OPENED', payload: { sessionKey } });
    } catch (err: unknown) {
      if (spinTimerRef.current) { clearTimeout(spinTimerRef.current); spinTimerRef.current = null; }
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      dispatch({ type: 'ERROR', payload: mapTxError(msg) });
    }
  }, [hostApi, snapshot, pixiApp]);

  // VICE staged bonus buy: stage 1 = 3-scatter round (100x), stage 2 =
  // 4-scatter sticky round — wager = bet x costMult, gameData carries the
  // stage; settlement forces the scatters onto the board so the spin
  // presents like a natural trigger (2 land, tease, rest drop in).
  const handleBuyVice = useCallback(async (stage: number) => {
    if (!hostApi || !snapshot) return;
    const current = stateRef.current;
    if (current.phase !== 'idle') return;
    const stages = (mathProfileById(loadMathProfileId()).build?.() as { viceBuyStages?: Array<{ stage: number; costMult: number }> } | undefined)?.viceBuyStages;
    const st = stages?.find(x => x.stage === stage);
    if (!st) return;
    const baseBet = BigInt(current.betBaseUnits || '0');
    const cost = baseBet * BigInt(st.costMult);
    const balance = BigInt(snapshot.balances.smartVaultBalance ?? '0');
    if (cost <= 0n || cost > balance) {
      if (cost > balance) notifyInsufficientFunds();
      return;
    }

    dispatch({ type: 'SPIN_REQUESTED' });
    pixiApp?.spin();
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      const ph = stateRef.current.phase;
      if (ph === 'spinning' || ph === 'awaiting_tx' || ph === 'resolving') {
        dispatch({ type: 'ERROR', payload: 'Spin timed out — please try again.' });
      }
    }, SPIN_TIMEOUT_MS);
    try {
      const { sessionKey } = await hostApi.openSession({
        wager: cost.toString(),
        gameData: encodeAbiParameters([{ type: 'uint8' }], [stage]),
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
    if (cost <= 0n || cost > balance) {
      if (cost > balance) notifyInsufficientFunds();
      return;
    }

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

  // FRUIT STACKS purchased FS stage: wager = bet x stage cost, gameData
  // carries the stage; settlement + decode derive the same bought round.
  const handleBuyFruit = useCallback(async (stage: number) => {
    if (!hostApi || !snapshot) return;
    const current = stateRef.current;
    if (current.phase !== 'idle') return;
    const def = FRUIT_BUY_STAGES[stage - 1];
    if (!def) return;
    const baseBet = BigInt(current.betBaseUnits || '0');
    const cost = baseBet * BigInt(def.costMult);
    const balance = BigInt(snapshot.balances.smartVaultBalance ?? '0');
    if (cost <= 0n || cost > balance) {
      if (cost > balance) notifyInsufficientFunds();
      return;
    }

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
        gameData: encodeAbiParameters([{ type: 'uint8' }], [stage]),
        randomnessRequestData: EMPTY_HEX,
      });
      dispatch({ type: 'SESSION_OPENED', payload: { sessionKey } });
    } catch (err: unknown) {
      if (spinTimerRef.current) { clearTimeout(spinTimerRef.current); spinTimerRef.current = null; }
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      dispatch({ type: 'ERROR', payload: mapTxError(msg) });
    }
  }, [hostApi, snapshot, pixiApp]);

  // SUSHI PARTY purchased FS stage (single stage): wager = bet x 100, gameData
  // carries the stage; settlement + decode derive the same bought cluster round.
  const handleBuySushi = useCallback(async (stage: number) => {
    if (!hostApi || !snapshot) return;
    const current = stateRef.current;
    if (current.phase !== 'idle') return;
    const def = SUSHI_BUY_STAGES[stage - 1];
    if (!def) return;
    const baseBet = BigInt(current.betBaseUnits || '0');
    const cost = baseBet * BigInt(def.costMult);
    const balance = BigInt(snapshot.balances.smartVaultBalance ?? '0');
    if (cost <= 0n || cost > balance) {
      if (cost > balance) notifyInsufficientFunds();
      return;
    }

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
        gameData: encodeAbiParameters([{ type: 'uint8' }], [stage]),
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
    handleBuyFruit,
    handleBuySushi,
    handleBuyVice,
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
