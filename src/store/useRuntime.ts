// store/useRuntime.ts — ephemeral runtime state (NOT persisted): busy flag,
// current phase, the live win counter, and the last outcome for the inspector.

import { create } from 'zustand';
import type { Outcome } from '../engine/types';

export type Overlay = 'none' | 'paytable';

export interface RuntimeState {
  busy: boolean;
  phase: string;
  winX: number;
  outcome: Outcome | null;
  overlay: Overlay;
  autoplayLeft: number;
  setBusy: (b: boolean) => void;
  setPhase: (p: string) => void;
  setWin: (x: number) => void;
  setOutcome: (o: Outcome | null) => void;
  setOverlay: (o: Overlay) => void;
  setAutoplay: (n: number) => void;
}

export const useRuntime = create<RuntimeState>((set) => ({
  busy: false,
  phase: 'idle',
  winX: 0,
  outcome: null,
  overlay: 'none',
  autoplayLeft: 0,
  setBusy: (busy) => set({ busy }),
  setPhase: (phase) => set({ phase }),
  setWin: (winX) => set({ winX }),
  setOutcome: (outcome) => set({ outcome, winX: 0 }),
  setOverlay: (overlay) => set({ overlay }),
  setAutoplay: (autoplayLeft) => set({ autoplayLeft }),
}));
