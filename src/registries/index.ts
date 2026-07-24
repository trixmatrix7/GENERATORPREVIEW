// Central export for all module registries.
// The generator agents import from here to discover available modules.

export { createRegistry } from './types.js';
export type { RegistryEntry, ConstraintSet, FileBinding, RegistryIndex } from './types.js';

export { slotTypeRegistry } from './slotTypes.js';
export type { SlotTypeEntry } from './slotTypes.js';

export { baseFeatureRegistry } from './baseFeatures.js';
export type { BaseFeatureEntry } from './baseFeatures.js';

export { bonusMechanicRegistry } from './bonusMechanics.js';
export type { BonusMechanicEntry } from './bonusMechanics.js';

export { reelTemplateRegistry } from './reelTemplates.js';
export type { ReelTemplateEntry } from './reelTemplates.js';

export { paytableTemplateRegistry } from './paytableTemplates.js';
export type { PaytableTemplateEntry } from './paytableTemplates.js';

export { symbolAnimationRegistry } from './symbolAnimations.js';
export type { SymbolAnimationEntry } from './symbolAnimations.js';

export { canvasLayerRegistry } from './canvasLayers.js';
export type { CanvasLayerEntry } from './canvasLayers.js';

export { winPresentationRegistry } from './winPresentation.js';
export type { WinPresentationEntry } from './winPresentation.js';

export { uiConfigRegistry } from './uiConfigs.js';
export type { UIConfigEntry } from './uiConfigs.js';

export { soundEventRegistry } from './soundEvents.js';
export type { SoundEventEntry } from './soundEvents.js';

export { textAnimationRegistry } from './textAnimations.js';
export type { TextAnimationEntry, TextAnimationTarget } from './textAnimations.js';

export { transitionAnimationRegistry } from './transitionAnimations.js';
export type { TransitionAnimationEntry, GamePhase } from './transitionAnimations.js';

export { winScreenTierRegistry } from './winScreenTiers.js';
export type { WinScreenTierEntry } from './winScreenTiers.js';
