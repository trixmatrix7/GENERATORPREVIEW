// exportEntry — dev-ready snippets. Custom entries export VERBATIM (lossless);
// built-in entries serialize from the real registry objects.

import type { RegistryEntry } from '@/registries';
import type { StudioRegistryName } from './registryCatalog';

/** Object → TS literal (unquoted keys). */
export function toTsLiteral(obj: unknown): string {
  return JSON.stringify(obj, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');
}

const target = (registry: StudioRegistryName) =>
  `// → src/registries/${registry}.ts  (add this object to the entries array)`;

export function entrySnippet(registry: StudioRegistryName, entry: RegistryEntry): string {
  return `${target(registry)}\n${toTsLiteral(entry)},\n`;
}

/** Custom (pasted) entry → the stored source byte-for-byte. */
export function sourceSnippet(registry: StudioRegistryName, source: string): string {
  return `${target(registry)}\n${source.trim()}\n`;
}

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
