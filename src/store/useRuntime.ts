// store/useRuntime.ts — ephemeral runtime state (NOT persisted): busy flag,
// current phase, the live win counter, and the last outcome for the inspector.

import { create } from 'zustand';
import type { Outcome } from '../engine/types';

export interface RuntimeState {
  busy: boolean;
  phase: string;
  winX: number;
  outcome: Outcome | null;
  setBusy: (b: boolean) => void;
  setPhase: (p: string) => void;
  setWin: (x: number) => void;
  setOutcome: (o: Outcome | null) => void;
}

export const useRuntime = create<RuntimeState>((set) => ({
  busy: false,
  phase: 'idle',
  winX: 0,
  outcome: null,
  setBusy: (busy) => set({ busy }),
  setPhase: (phase) => set({ phase }),
  setWin: (winX) => set({ winX }),
  setOutcome: (outcome) => set({ outcome, winX: 0 }),
}));
