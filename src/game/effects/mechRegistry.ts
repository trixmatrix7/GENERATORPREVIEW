// Mechanic-showcase registry — future generator baseFeatures/bonusMechanics.
import type { MechEntry } from './mechTypes';
import { MECH_PACK_A } from './mech/packMechA';
import { MECH_PACK_B } from './mech/packMechB';

export const MECH_REGISTRY: readonly MechEntry[] = [...MECH_PACK_A, ...MECH_PACK_B];

export function mechById(id: string): MechEntry | undefined {
  return MECH_REGISTRY.find(e => e.id === id);
}
