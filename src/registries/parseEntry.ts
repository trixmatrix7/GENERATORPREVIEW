// registries/parseEntry.ts — turn a pasted code snippet into a typed registry
// entry. Accepts a JS/TS object literal (optionally prefixed with
// `export const x: Type =`). Best-effort strips TS-only syntax, evals the
// object, fills defaults, and infers the target registry. Local dev tool only —
// the snippet is the author's own code.

import type { AnyEntry, RegistryName } from './types';
import { REGISTRY_NAMES } from './index';

export interface ParseResult {
  ok: boolean;
  entry?: AnyEntry;
  registry?: RegistryName;
  error?: string;
}

function extractObjectLiteral(code: string): string {
  const start = code.indexOf('{');
  const end = code.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No object literal { … } found.');
  return code.slice(start, end + 1);
}

function stripTsOnly(src: string): string {
  return src
    .replace(/\bas\s+const\b/g, '')
    .replace(/\bas\s+[A-Za-z_][\w.<>\[\]]*/g, '') // `as SomeType`
    .replace(/\/\/[^\n]*/g, '') // line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // block comments
}

export function inferRegistry(entry: Record<string, unknown>): RegistryName | undefined {
  if ('state' in entry && 'anchor' in entry) return 'symbolAnimations';
  if ('style' in entry && !('scope' in entry)) return 'spinSystems';
  if ('components' in entry) return 'winPresentation';
  if ('synth' in entry) return 'soundEvents';
  if ('tier' in entry && 'thresholdX' in entry) return 'winScreenTiers';
  if ('layer' in entry && 'z' in entry) return 'canvasLayers';
  if ('themeId' in entry && 'symbols' in entry) return 'themes';
  if ('intensity' in entry && 'scope' in entry) return 'gridEffects';
  if ('trigger' in entry && 'duration' in entry) return 'transitionAnimations';
  return undefined;
}

export function parseEntryCode(code: string, registryHint?: RegistryName | 'auto'): ParseResult {
  try {
    const obj = extractObjectLiteral(stripTsOnly(code));
    // eslint-disable-next-line no-new-func
    const value = new Function(`return (${obj});`)() as Record<string, unknown>;
    if (!value || typeof value !== 'object') return { ok: false, error: 'Snippet did not evaluate to an object.' };
    if (!value.id || typeof value.id !== 'string') return { ok: false, error: 'Entry needs a string `id`.' };

    const registry =
      registryHint && registryHint !== 'auto' ? registryHint : inferRegistry(value);
    if (!registry || !REGISTRY_NAMES.includes(registry)) {
      return { ok: false, error: 'Could not infer the registry — pick one from the dropdown.' };
    }

    const entry: AnyEntry = {
      version: '1.0.0',
      implemented: true,
      compatibleGrids: ['5x5', '5x3'],
      compatibleModels: ['ways'],
      name: String(value.name ?? value.id),
      description: String(value.description ?? ''),
      ...(value as object),
    } as AnyEntry;

    return { ok: true, entry, registry };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
