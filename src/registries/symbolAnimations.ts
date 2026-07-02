import { RegistryEntry, createRegistry } from './types.js';

export interface SymbolAnimationEntry extends RegistryEntry {
  state: string;
  triggerCondition: string;
  duration: number;
  easing: string;
  repeat: number;
}

const entries: readonly SymbolAnimationEntry[] = [
  {
    id: 'idle',
    name: 'Idle State',
    description: 'Default resting state. Symbol at full opacity and scale.',
    version: '1.0.0',
    implemented: true,
    state: 'idle',
    triggerCondition: 'default',
    duration: 0,
    easing: 'none',
    repeat: 0,
  },
  {
    id: 'landing',
    name: 'Landing Animation',
    description: 'Compress → overshoot → settle sequence on WILD and SCATTER symbols when reels stop.',
    version: '1.0.0',
    implemented: true,
    state: 'landing',
    triggerCondition: 'reel stop (WILD/SCATTER only)',
    duration: 0.5,
    easing: 'power2.out',
    repeat: 0,
  },
  {
    id: 'win',
    name: 'Win Pulse',
    description: 'Gentle brightness/scale pulse on winning symbol positions. Non-winning symbols dim.',
    version: '1.0.0',
    implemented: true,
    state: 'win',
    triggerCondition: 'symbol is part of a winning combination',
    duration: 1.2,
    easing: 'sine.inOut',
    repeat: -1,
  },
  {
    id: 'featured',
    name: 'Featured Highlight',
    description: 'Enhanced glow effect for promotional or jackpot symbols.',
    version: '1.0.0',
    implemented: true,
    state: 'featured',
    triggerCondition: 'custom trigger',
    duration: 2.0,
    easing: 'sine.inOut',
    repeat: -1,
  },
  {
    id: 'static',
    name: 'Static (No Animation)',
    description: 'Fallback for prefersReducedMotion or unsupported states.',
    version: '1.0.0',
    implemented: true,
    state: 'static',
    triggerCondition: 'prefersReducedMotion() or explicit',
    duration: 0,
    easing: 'none',
    repeat: 0,
  },
] as const;

export const symbolAnimationRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
