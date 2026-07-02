// Game state machine types.
// The state machine drives both the PixiJS animation layer and the React UI.

import type { HostSnapshotV1, SessionItem } from '@/bridge/types';
import type { SpinOutcome } from '@/engine/SlotEngine';

/** All possible states the slot game can be in. */
export type GamePhase =
  | 'connecting'       // Waiting for Penpal bridge to resolve
  | 'idle'             // Ready to spin; player can set bet and press spin
  | 'awaiting_tx'      // openSession promise pending (tx submitted, waiting for receipt)
  | 'spinning'         // Reels animating (randomness not yet fulfilled on-chain)
  | 'resolving'        // Randomness fulfilled; reels decelerating to stops
  | 'settled_win'      // Spin resolved with a win; win animation playing
  | 'settled_loss'     // Spin resolved with no win (no animation — per spec)
  | 'error';           // Unrecoverable error state

/** Full game state snapshot consumed by React and PixiJS. */
export interface GameState {
  phase: GamePhase;

  /** Latest snapshot pushed from the host. */
  snapshot: HostSnapshotV1 | null;

  /** Current bet amount as a display string (e.g. "1.00"). */
  betDisplay: string;

  /** Current bet in token base units (bigint string for serialisation). */
  betBaseUnits: string;

  /** Decoded outcome of the most recently settled spin. */
  lastOutcome: SpinOutcome | null;

  /** Session being tracked (between openSession and settlement). */
  pendingSession: SessionItem | null;

  /** Auto-spin remaining count (0 = not auto-spinning). */
  autoSpinsRemaining: number;

  /** Recent settled sessions (last N, newest first). */
  recentBets: RecentBet[];

  /** Error message to display in error phase. */
  errorMessage: string | null;
}

/** A single historical bet entry shown in the sidebar. */
export interface RecentBet {
  sessionId: string;
  wager: string;
  payout: string;
  multiplier: number;
  outcome: 'win' | 'loss';
  settledAt: number;
  /** Stored for the per-bet verification modal. */
  raw: SessionItem['raw'];
}

/** Actions dispatched into the state machine reducer. */
export type GameAction =
  | { type: 'BRIDGE_CONNECTED' }
  | { type: 'SNAPSHOT_UPDATED'; payload: HostSnapshotV1 }
  | { type: 'BET_CHANGED'; payload: { display: string; baseUnits: string } }
  | { type: 'SPIN_REQUESTED' }
  | { type: 'SESSION_OPENED'; payload: { sessionKey: string } }
  | { type: 'SPIN_SETTLED'; payload: { outcome: SpinOutcome; session: SessionItem } }
  | { type: 'AUTO_SPIN_START'; payload: { count: number } }
  | { type: 'AUTO_SPIN_TICK' }
  | { type: 'AUTO_SPIN_STOP' }
  | { type: 'WIN_ANIMATION_DONE' }
  | { type: 'ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };
