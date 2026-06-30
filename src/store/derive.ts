// store/derive.ts — derives the renderer config from the persisted studio state:
// merged registries (defaults + pasted entries), active theme + symbol set, and
// the resolved param values for the live preset.

import { useMemo } from 'react';
import { useStudio } from './useStudio';
import { DEFAULT_REGISTRIES, mergeRegistries, type Registries } from '../registries';
import type { ThemeEntry, ThemeSymbol } from '../registries/types';
import { THEMES, DARK_THEME, type CanvasTheme } from '../config/canvasTheme';
import { resolveParams } from '../registries/presets';
import type { ParamValues } from '../config/adjustableParams';

export interface DerivedConfig {
  registries: Registries;
  theme: CanvasTheme;
  symbolMeta: Map<number, ThemeSymbol>;
  params: ParamValues;
}

export function useDerivedConfig(): DerivedConfig {
  const customEntries = useStudio((s) => s.customEntries);
  const themeId = useStudio((s) => s.themeId);
  const working = useStudio((s) => s.working);

  const registries = useMemo(() => mergeRegistries(DEFAULT_REGISTRIES, customEntries), [customEntries]);

  const theme = THEMES[themeId] ?? DARK_THEME;

  const symbolMeta = useMemo(() => {
    const entry =
      (registries.themes.find((t) => (t as ThemeEntry).themeId === themeId) as ThemeEntry | undefined) ??
      (registries.themes[0] as ThemeEntry | undefined);
    const map = new Map<number, ThemeSymbol>();
    for (const s of entry?.symbols ?? []) map.set(s.id, s);
    return map;
  }, [registries, themeId]);

  const params = useMemo(() => resolveParams(working), [working]);

  return { registries, theme, symbolMeta, params };
}
