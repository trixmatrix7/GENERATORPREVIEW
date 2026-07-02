// Game state machine reducer — pure function, no side effects.
// Consumed by useGameState hook which wires it to Penpal bridge events.
//
// Free spins are now settled entirely on-chain in a single onRandomness call.
// The state machine has no 'free_spins' phase — outcome.freeSpinsTriggered is
// informational for the UI to display a banner/counter after settlement.

import type { GameState, GameAction, RecentBet } from './types';
import type { SessionItem } from '@/bridge/types';
import { GAME_CONFIG } from '@/config/gameConfig';
import { formatUnits } from 'viem';

const MAX_RECENT_BETS = 20;

export function initialState(): GameState {
  return {
    phase: 'connecting',
    snapshot: null,
    betDisplay: GAME_CONFIG.defaultBetDisplay,
    betBaseUnits: '1000000', // 1 USDC default (6 decimals — updated from snapshot)
    lastOutcome: null,
    pendingSession: null,
    autoSpinsRemaining: 0,
    recentBets: [],
    errorMessage: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case 'BRIDGE_CONNECTED':
      return { ...state, phase: 'idle' };

    case 'SNAPSHOT_UPDATED': {
      const snapshot = action.payload;

      let next = { ...state, snapshot };

      if (state.pendingSession) {
        const settled = snapshot.sessions.items.find(
          s => s.sessionKey === state.pendingSession!.sessionKey && s.isSettled,
        );
        if (settled && state.phase === 'spinning') {
          next = { ...next, phase: 'resolving' };
        }
      }

      return next;
    }

    case 'BET_CHANGED':
      if (state.phase !== 'idle') return state;
      return {
        ...state,
        betDisplay: action.payload.display,
        betBaseUnits: action.payload.baseUnits,
      };

    case 'SPIN_REQUESTED':
      if (state.phase !== 'idle') return state;
      return { ...state, phase: 'awaiting_tx' };

    case 'SESSION_OPENED': {
      const { sessionKey } = action.payload;
      const pending: SessionItem = {
        sessionId: '',
        sessionKey,
        gameAddress: '0x0000000000000000000000000000000000000000',
        isSettled: false,
        lastEventTimestamp: Date.now(),
        raw: {},
      };
      return { ...state, phase: 'spinning', pendingSession: pending };
    }

    case 'SPIN_SETTLED': {
      const { outcome, session } = action.payload;
      // "Win" only when payout exceeds the wager (actual profit)
      const wagerBig = BigInt(session.wager ?? '0');
      const isWin = outcome.winAmount > 0n && outcome.winAmount >= wagerBig;

      const newBet: RecentBet = {
        sessionId: session.sessionId,
        wager: session.wager ?? '0',
        payout: session.payout ?? '0',
        multiplier: computeMultiplier(session),
        outcome: isWin ? 'win' : 'loss',
        settledAt: session.settledAt ?? Date.now(),
        raw: session.raw,
      };

      const recentBets = [newBet, ...state.recentBets].slice(0, MAX_RECENT_BETS);

      return {
        ...state,
        phase: isWin ? 'settled_win' : 'settled_loss',
        lastOutcome: outcome,
        pendingSession: null,
        recentBets,
      };
    }

    case 'WIN_ANIMATION_DONE':
      if (state.phase !== 'settled_win' && state.phase !== 'settled_loss') return state;
      return { ...state, phase: 'idle' };

    case 'AUTO_SPIN_START':
      return { ...state, autoSpinsRemaining: action.payload.count };

    case 'AUTO_SPIN_TICK':
      return {
        ...state,
        autoSpinsRemaining: Math.max(0, state.autoSpinsRemaining - 1),
      };

    case 'AUTO_SPIN_STOP':
      return { ...state, autoSpinsRemaining: 0 };

    case 'ERROR':
      return {
        ...state,
        phase: 'error',
        errorMessage: action.payload,
        pendingSession: null,
      };

    case 'CLEAR_ERROR':
      return { ...state, phase: 'idle', errorMessage: null };

    default:
      return state;
  }
}

function computeMultiplier(session: SessionItem): number {
  const wager = BigInt(session.wager ?? '0');
  const payout = BigInt(session.payout ?? '0');
  if (wager === 0n) return 0;
  return Number((payout * 100n) / wager) / 100;
}

/** Format base units to display string using token decimals from snapshot. */
export function formatBet(baseUnits: string, decimals: number): string {
  return formatUnits(BigInt(baseUnits), decimals);
}
