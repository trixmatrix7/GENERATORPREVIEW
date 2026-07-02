// WinTierResolver — selects the appropriate win-screen tier based on
// the ratio of totalWin to wager. Used by PixiApp to drive tiered
// banner animations (counter rollup, screen shake, etc.).
//
// Tier bands match winScreenTiers.ts registry entries and the sound
// layer in useSoundLayer.ts so audio + visual stay in lockstep.

import { winScreenTierRegistry } from '@/registries/index';
import type { WinScreenTierEntry } from '@/registries/winScreenTiers';

export type WinTierId = 'small-win' | 'normal-win' | 'big-win' | 'mega-win' | 'super-mega-win' | 'epic-win';

/**
 * Resolve the win tier for a given win amount and wager.
 * Returns the highest tier whose band contains the win/bet multiplier.
 * Falls back to 'small-win' if nothing matches (shouldn't happen with
 * a well-formed registry).
 */
export function resolveWinTier(winAmount: bigint, wager: bigint): WinScreenTierEntry {
  if (wager <= 0n) return getFallback();
  const ratio = Number(winAmount) / Number(wager);

  const tiers = winScreenTierRegistry.list();
  // Iterate from highest tier downward — pick the first where ratio fits.
  for (let i = tiers.length - 1; i >= 0; i--) {
    const tier = tiers[i];
    if (ratio >= tier.minMultiplier && ratio < tier.maxMultiplier) {
      return tier;
    }
  }
  return getFallback();
}

function getFallback(): WinScreenTierEntry {
  return winScreenTierRegistry.get('small-win') ?? {
    id: 'small-win',
    name: 'Small Win',
    description: '',
    version: '1.0.0',
    implemented: true,
    minMultiplier: 0,
    maxMultiplier: 2,
    components: ['dim-highlight-pulse'],
    duration: 1.5,
  };
}
