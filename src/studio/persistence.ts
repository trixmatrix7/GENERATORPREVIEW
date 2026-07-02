// persistence — custom (pasted) registry entries, stored VERBATIM so export is
// lossless. localStorage now; swap for a shared backend later without touching
// the components.

import type { StudioRegistryName } from './registryCatalog';

export interface CustomEntry {
  registry: StudioRegistryName;
  id: string;
  /** The pasted source, byte-for-byte — comments/hex/functions preserved. */
  source: string;
  createdAt: number;
  author?: string;
}

const KEY = 'slot-preview:custom-entries';

export function loadCustomEntries(): CustomEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomEntries(entries: CustomEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* quota — ignore */
  }
}
