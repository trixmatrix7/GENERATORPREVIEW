import { RegistryEntry, createRegistry } from './types.js';

// Transition animation registry — animations that bridge state changes
// (base game ↔ free spins, error ↔ idle, idle ↔ spinning).
//
// These are NOT per-symbol or per-element animations; they're whole-screen
// or whole-canvas transitions. Most entries are placeholders.

export type GamePhase =
  | 'idle'
  | 'spinning'
  | 'evaluating'
  | 'showing-win'
  | 'fs-intro'
  | 'free-spinning'
  | 'fs-outro'
  | 'error';

export interface TransitionAnimationEntry extends RegistryEntry {
  from: GamePhase;
  to: GamePhase;
  duration: number;        // seconds
  components: string[];    // canvas/UI components involved
}

const entries: readonly TransitionAnimationEntry[] = [
  {
    id: 'base-to-fs-intro',
    name: 'Base → Free-Spins Intro',
    description: 'Full-screen overlay panel slides in announcing free-spin count, scatter symbols highlighted underneath.',
    version: '0.1.0',
    implemented: false,
    from: 'showing-win',
    to: 'fs-intro',
    duration: 2.0,
    components: ['fs-intro-overlay', 'scatter-highlight', 'fs-counter-init'],
  },
  {
    id: 'fs-to-base-outro',
    name: 'Free-Spins → Base Outro',
    description: 'Free-spin total payout panel, then crossfade back to base reels.',
    version: '0.1.0',
    implemented: false,
    from: 'free-spinning',
    to: 'idle',
    duration: 2.5,
    components: ['fs-summary-panel', 'crossfade-overlay'],
  },
  {
    id: 'idle-to-spinning',
    name: 'Idle → Spinning',
    description: 'Reels accelerate from rest into spin. Already implemented in Reel.ts.',
    version: '1.0.0',
    implemented: true,
    from: 'idle',
    to: 'spinning',
    duration: 0.3,
    components: ['reel-accelerate'],
  },
  {
    id: 'spinning-to-evaluating',
    name: 'Spinning → Evaluating',
    description: 'Staggered reel deceleration and stop. Already implemented.',
    version: '1.0.0',
    implemented: true,
    from: 'spinning',
    to: 'evaluating',
    duration: 0.6,
    components: ['reel-decelerate', 'reel-stop-stagger'],
  },
  {
    id: 'error-fade-in',
    name: 'Error Modal Fade-In',
    description: 'Backdrop blur fade-in with modal slide-up. Already implemented in App.tsx.',
    version: '1.0.0',
    implemented: true,
    from: 'idle',
    to: 'error',
    duration: 0.3,
    components: ['backdrop-blur', 'modal-slide-up'],
  },
  {
    id: 'fs-counter-update',
    name: 'FS Counter Update',
    description: 'Free-spin counter decrements with a small flip/tick animation between spins.',
    version: '0.1.0',
    implemented: false,
    from: 'free-spinning',
    to: 'free-spinning',
    duration: 0.25,
    components: ['fs-counter-tick'],
  },
] as const;

export const transitionAnimationRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
