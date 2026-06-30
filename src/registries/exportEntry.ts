// registries/exportEntry.ts — turn any overlay entry/preset into dev-ready code
// (a typed registry-entry literal) you can copy or download and paste straight
// into the real generator. The inverse of parseEntry.ts.

import type { AnyEntry, RegistryName, SymbolAnimationEntry } from './types';
import type { AnimationPreset } from './presets';
import type { Registries } from './index';
import { ADJUSTABLE_PARAMS } from '../config/adjustableParams';

/** Object → TS object literal (unquoted keys). Valid to paste into a .ts registry. */
export function toTsLiteral(obj: unknown): string {
  return JSON.stringify(obj, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');
}

/** One entry as a drop-in snippet (with a comment pointing at the target file). */
export function entrySnippet(registry: RegistryName, entry: AnyEntry): string {
  return `// → src/registries/${registry}.ts  (add this object to the ${registry} array)\n${toTsLiteral(entry)},\n`;
}

/** Trigger a browser download of `text` as `filename`. */
export function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Bake a live animation preset into dev-ready symbolAnimations entries + params.
 *  This is the "converted into the specs as needed" step for the 4-state feel. */
export function presetToSnippet(preset: AnimationPreset, registries: Registries): string {
  const base = registries.symbolAnimations.filter((e) => 'state' in e) as SymbolAnimationEntry[];
  const entries = base.map((e) => {
    const st = preset.states[e.state];
    if (!st) return e;
    return {
      ...e,
      implemented: st.enabled,
      easing: st.easing,
      duration: Math.round(e.duration * st.durationScale * 1000) / 1000,
    } as SymbolAnimationEntry;
  });
  const params: Record<string, number> = Object.fromEntries(ADJUSTABLE_PARAMS.map((p) => [p.key, p.default]));
  for (const k of Object.keys(preset.params)) {
    const v = preset.params[k];
    if (v !== undefined) params[k] = v;
  }
  return (
    `// Animation preset "${preset.name}" → dev entries\n` +
    `// 1) symbolAnimations.ts — replace/extend the 4 state entries:\n` +
    entries.map((e) => toTsLiteral(e) + ',').join('\n') +
    `\n\n// 2) effect toggles (which gridEffects are implemented):\n` +
    toTsLiteral(preset.effects) +
    `\n\n// 3) adjustable params (map to your chat-config whitelist):\n` +
    toTsLiteral(params) +
    '\n'
  );
}

/** All user-pasted custom entries as one bundle file. */
export function customBundle(
  custom: { registry: RegistryName; entry: AnyEntry; author?: string }[],
): string {
  if (!custom.length) return '// no custom entries yet\n';
  const byReg = new Map<RegistryName, AnyEntry[]>();
  for (const c of custom) {
    const arr = byReg.get(c.registry) ?? [];
    arr.push(c.entry);
    byReg.set(c.registry, arr);
  }
  let out = '// Custom overlay entries exported from the preview generator.\n// Paste each block into the matching src/registries/*.ts array.\n\n';
  for (const [registry, entries] of byReg) {
    out += `// ── ${registry} ──────────────────────────────\n`;
    out += entries.map((e) => toTsLiteral(e) + ',').join('\n') + '\n\n';
  }
  return out;
}
