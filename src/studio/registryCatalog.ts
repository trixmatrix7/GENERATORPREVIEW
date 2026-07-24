// registryCatalog — the dev's REAL registries, keyed by their src/registries
// file name so exported snippets point at the exact file the dev pastes into.

import {
  slotTypeRegistry,
  baseFeatureRegistry,
  bonusMechanicRegistry,
  reelTemplateRegistry,
  paytableTemplateRegistry,
  symbolAnimationRegistry,
  canvasLayerRegistry,
  winPresentationRegistry,
  uiConfigRegistry,
  soundEventRegistry,
  textAnimationRegistry,
  transitionAnimationRegistry,
  winScreenTierRegistry,
  type RegistryEntry,
  type RegistryIndex,
} from '@/registries';

export const REGISTRIES = {
  slotTypes: slotTypeRegistry,
  baseFeatures: baseFeatureRegistry,
  bonusMechanics: bonusMechanicRegistry,
  reelTemplates: reelTemplateRegistry,
  paytableTemplates: paytableTemplateRegistry,
  symbolAnimations: symbolAnimationRegistry,
  canvasLayers: canvasLayerRegistry,
  winPresentation: winPresentationRegistry,
  uiConfigs: uiConfigRegistry,
  soundEvents: soundEventRegistry,
  textAnimations: textAnimationRegistry,
  transitionAnimations: transitionAnimationRegistry,
  winScreenTiers: winScreenTierRegistry,
} satisfies Record<string, RegistryIndex<RegistryEntry>>;

export type StudioRegistryName = keyof typeof REGISTRIES;

export const REGISTRY_NAMES = Object.keys(REGISTRIES) as StudioRegistryName[];
