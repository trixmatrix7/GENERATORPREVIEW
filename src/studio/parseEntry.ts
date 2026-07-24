// parseEntry — validate a pasted registry-entry snippet against the dev's
// registry shapes. Best-effort: strips TS-only syntax, evals the object
// literal, infers the target registry from its fields. Local dev tool — the
// snippet is the author's own code.

import type { RegistryEntry } from '@/registries';
import { REGISTRIES, type StudioRegistryName } from './registryCatalog';

export interface ParseResult {
  ok: boolean;
  entry?: RegistryEntry & Record<string, unknown>;
  registry?: StudioRegistryName;
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
    .replace(/\bas\s+[A-Za-z_][\w.<>\[\]]*/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Field-signature → registry inference, matched against the dev interfaces. */
function inferRegistry(e: Record<string, unknown>): StudioRegistryName | undefined {
  if ('states' in e || ('trigger' in e && 'anchor' in e)) return 'symbolAnimations';
  if ('tier' in e || 'minMultiplier' in e) return 'winScreenTiers';
  if ('components' in e || ('trigger' in e && 'sequence' in e)) return 'winPresentation';
  if ('src' in e || 'volume' in e || 'loop' in e) return 'soundEvents';
  if ('fromPhase' in e || 'toPhase' in e) return 'transitionAnimations';
  if ('target' in e && ('animation' in e || 'style' in e)) return 'textAnimations';
  if ('layer' in e || 'zIndex' in e) return 'canvasLayers';
  if ('strips' in e || 'reelCount' in e) return 'reelTemplates';
  if ('pays' in e || 'payTable' in e) return 'paytableTemplates';
  if ('ways' in e || 'gridId' in e) return 'slotTypes';
  return undefined;
}

export function parseEntryCode(code: string, hint?: StudioRegistryName | 'auto'): ParseResult {
  try {
    const obj = extractObjectLiteral(stripTsOnly(code));
    // eslint-disable-next-line no-new-func
    const value = new Function(`return (${obj});`)() as Record<string, unknown>;
    if (!value || typeof value !== 'object') return { ok: false, error: 'Snippet did not evaluate to an object.' };
    if (!value.id || typeof value.id !== 'string') return { ok: false, error: 'Entry needs a string `id`.' };
    if (!value.name) return { ok: false, error: 'Entry needs a `name` (dev RegistryEntry contract).' };

    const registry = hint && hint !== 'auto' ? hint : inferRegistry(value);
    if (!registry || !(registry in REGISTRIES)) {
      return { ok: false, error: 'Could not infer the registry — pick one from the dropdown.' };
    }

    const entry = {
      description: '',
      version: '1.0.0',
      implemented: false, // dev invariant: a stub ships safely
      ...value,
    } as RegistryEntry & Record<string, unknown>;

    return { ok: true, entry, registry };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
