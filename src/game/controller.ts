// game/controller.ts — the bridge between the React UI and the imperative
// PixiApp. Buttons call controller methods; it builds deterministic outcomes
// from the engine and drives the renderer, mirroring the on-chain lifecycle.

import { spin } from '../engine/spin';
import {
  forceAnyWin,
  forceFreeSpins,
  forceNearMiss,
  forceBigWin,
  forceMega,
  demoHoldWin,
} from '../engine/scenarios';
import { useStudio } from '../store/useStudio';
import { useRuntime } from '../store/useRuntime';
import { BET_LEVELS } from '../config/gameConfig';
import type { PixiApp } from './PixiApp';
import type { Outcome } from '../engine/types';
import type { SymbolState } from '../registries/types';

export type ScenarioName =
  | 'spin'
  | 'win'
  | 'free-spins'
  | 'near-miss'
  | 'big-win'
  | 'mega-win'
  | 'hold-win'
  | 'bonus-buy';

class StudioController {
  private app: PixiApp | null = null;

  setApp(app: PixiApp | null): void {
    this.app = app;
  }

  private bet(): number {
    return BET_LEVELS[useStudio.getState().betIndex] ?? 1;
  }
  private grid() {
    return useStudio.getState().grid;
  }

  private async run(o: Outcome): Promise<void> {
    if (!this.app) return;
    useRuntime.getState().setOutcome(o);
    useRuntime.getState().setBusy(true);
    try {
      await this.app.spin(o);
    } finally {
      useRuntime.getState().setBusy(false);
    }
  }

  async spin(seed?: `0x${string}`): Promise<void> {
    await this.run(spin({ grid: this.grid(), bet: this.bet(), seed }));
  }

  async scenario(name: ScenarioName): Promise<void> {
    const grid = this.grid();
    const bet = this.bet();
    let o: Outcome;
    switch (name) {
      case 'win':
        o = forceAnyWin(grid, bet);
        break;
      case 'free-spins':
        o = forceFreeSpins(grid, bet);
        break;
      case 'near-miss':
        o = forceNearMiss(grid, bet);
        break;
      case 'big-win':
        o = forceBigWin(grid, bet);
        break;
      case 'mega-win':
        o = forceMega(grid, bet);
        break;
      case 'hold-win':
        o = demoHoldWin(grid, bet);
        break;
      case 'bonus-buy':
        o = spin({ grid, bet, buyBonus: true });
        break;
      case 'spin':
      default:
        o = spin({ grid, bet });
        break;
    }
    await this.run(o);
  }

  async previewState(state: SymbolState): Promise<void> {
    await this.app?.previewState(state);
  }

  stop(): void {
    this.app?.stop();
    useRuntime.getState().setBusy(false);
  }
}

export const controller = new StudioController();
