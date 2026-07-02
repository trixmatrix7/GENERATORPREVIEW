// Registry type infrastructure for the Slot Generator.
// Each registry is a typed array of entries that the generator agents reference
// to compose new games without writing code.

/** Grid ids defined in src/config/gridConfig.ts. V2 ships '5x3' and '5x5';
 *  Stage 3 widens to the 3–7 × 3–5 envelope. Kept as a plain string union
 *  here (rather than importing the GridConfig type) so the registry layer
 *  stays decoupled from the engine layer. */
export type GridId = '5x3' | '5x5';

export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  implemented: boolean;
  /** Grid shapes this entry can be composed onto.
   *  - Omitted / undefined → compatible with every shipped grid (grid-agnostic
   *    entries like sounds, themes, text animations).
   *  - Explicit array → entry is grid-specific (e.g., slot-type ways-243 only
   *    applies to 5×3). Empty array means the entry ships no grid yet
   *    (unimplemented stubs).
   *
   *  Generator agents read this when composing a game to filter compatible
   *  entries against the requested grid. */
  compatibleGrids?: readonly GridId[];
}

/** True when `entry` can be composed onto a game running on `grid`.
 *  Omitted compatibleGrids means "all grids" (grid-agnostic).
 *  Empty array means "no grids yet" (unimplemented stub). */
export function isCompatibleWithGrid(entry: RegistryEntry, grid: GridId): boolean {
  if (entry.compatibleGrids === undefined) return true;
  return entry.compatibleGrids.includes(grid);
}

export interface ConstraintSet {
  min?: number;
  max?: number;
  enum?: string[];
  dependencies?: string[];
}

export interface FileBinding {
  file: string;
  field: string;
  transform?: string;
}

export type RegistryIndex<T extends RegistryEntry> = {
  readonly entries: readonly T[];
  get(id: string): T | undefined;
  list(): readonly T[];
  listImplemented(): readonly T[];
};

/** Registry-level defaults applied to every entry that doesn't override them.
 *  Currently scoped to `compatibleGrids`: registries whose entries are all
 *  grid-agnostic (sounds, themes, animations, etc.) declare it once here
 *  instead of repeating on every entry. Per-entry values always win. */
export interface RegistryDefaults {
  compatibleGrids?: readonly GridId[];
}

export function createRegistry<T extends RegistryEntry>(
  entries: readonly T[],
  defaults?: RegistryDefaults,
): RegistryIndex<T> {
  const enriched: readonly T[] = defaults
    ? entries.map(e => ({
        ...e,
        compatibleGrids: e.compatibleGrids ?? defaults.compatibleGrids,
      }))
    : entries;
  const map = new Map(enriched.map(e => [e.id, e]));
  return {
    entries: enriched,
    get: (id: string) => map.get(id),
    list: () => enriched,
    listImplemented: () => enriched.filter(e => e.implemented),
  };
}
