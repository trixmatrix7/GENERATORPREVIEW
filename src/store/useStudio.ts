// store/useStudio.ts — the studio state, persisted to localStorage (the "saved
// in our preview generator" requirement). The persistence layer is abstracted
// here so a shared backend (Vercel KV / Supabase) can replace `storage` later
// without touching components.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GridId } from '../config/gridConfig';
import { DEFAULT_GRID } from '../config/gridConfig';
import { DEFAULT_THEME_ID } from '../config/canvasTheme';
import { DEFAULT_BET_INDEX, BET_LEVELS } from '../config/gameConfig';
import {
  BUILTIN_PRESETS,
  DEFAULT_PRESET_ID,
  type AnimationPreset,
  type SymbolStateConfig,
  type EffectToggles,
} from '../registries/presets';
import type { CustomEntry } from '../registries';
import type { SymbolState } from '../registries/types';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export interface StudioState {
  author: string;
  grid: GridId;
  themeId: string;
  betIndex: number;
  muted: boolean;
  volume: number;

  selectedPresetId: string;
  working: AnimationPreset; // the live-edited preset
  customPresets: AnimationPreset[];
  customEntries: CustomEntry[]; // pasted registry entries (live + persisted)

  // actions
  setAuthor: (a: string) => void;
  setGrid: (g: GridId) => void;
  setTheme: (id: string) => void;
  setBetIndex: (i: number) => void;
  setMuted: (m: boolean) => void;
  setVolume: (v: number) => void;

  selectPreset: (id: string) => void;
  setParam: (key: string, value: number) => void;
  setStateConfig: (state: SymbolState, patch: Partial<SymbolStateConfig>) => void;
  toggleEffect: (key: keyof EffectToggles, value: boolean) => void;
  resetWorking: () => void;
  saveWorkingAsPreset: (name: string) => void;
  deletePreset: (id: string) => void;

  addCustomEntry: (e: CustomEntry) => void;
  removeCustomEntry: (registry: CustomEntry['registry'], id: string) => void;
}

const findPreset = (id: string, custom: AnimationPreset[]): AnimationPreset =>
  custom.find((p) => p.id === id) ?? BUILTIN_PRESETS.find((p) => p.id === id) ?? BUILTIN_PRESETS[0];

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      author: '',
      grid: DEFAULT_GRID,
      themeId: DEFAULT_THEME_ID,
      betIndex: DEFAULT_BET_INDEX,
      muted: false,
      volume: 0.6,

      selectedPresetId: DEFAULT_PRESET_ID,
      working: clone(BUILTIN_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!),
      customPresets: [],
      customEntries: [],

      setAuthor: (author) => set({ author }),
      setGrid: (grid) => set({ grid }),
      setTheme: (themeId) => set({ themeId }),
      setBetIndex: (betIndex) => set({ betIndex: Math.max(0, Math.min(BET_LEVELS.length - 1, betIndex)) }),
      setMuted: (muted) => set({ muted }),
      setVolume: (volume) => set({ volume }),

      selectPreset: (id) =>
        set({ selectedPresetId: id, working: clone(findPreset(id, get().customPresets)) }),

      setParam: (key, value) => set((s) => ({ working: { ...s.working, params: { ...s.working.params, [key]: value } } })),

      setStateConfig: (state, patch) =>
        set((s) => ({
          working: { ...s.working, states: { ...s.working.states, [state]: { ...s.working.states[state], ...patch } } },
        })),

      toggleEffect: (key, value) =>
        set((s) => ({ working: { ...s.working, effects: { ...s.working.effects, [key]: value } } })),

      resetWorking: () => set((s) => ({ working: clone(findPreset(s.selectedPresetId, s.customPresets)) })),

      saveWorkingAsPreset: (name) =>
        set((s) => {
          const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s.customPresets.length + 1}`;
          const preset: AnimationPreset = { ...clone(s.working), id, name, builtIn: false, author: s.author || undefined };
          return { customPresets: [...s.customPresets, preset], selectedPresetId: id, working: clone(preset) };
        }),

      deletePreset: (id) =>
        set((s) => {
          const customPresets = s.customPresets.filter((p) => p.id !== id);
          const stillSelected = s.selectedPresetId === id ? DEFAULT_PRESET_ID : s.selectedPresetId;
          return {
            customPresets,
            selectedPresetId: stillSelected,
            working: clone(findPreset(stillSelected, customPresets)),
          };
        }),

      addCustomEntry: (e) =>
        set((s) => {
          const rest = s.customEntries.filter((c) => !(c.registry === e.registry && c.entry.id === e.entry.id));
          return { customEntries: [...rest, e] };
        }),

      removeCustomEntry: (registry, id) =>
        set((s) => ({ customEntries: s.customEntries.filter((c) => !(c.registry === registry && c.entry.id === id)) })),
    }),
    {
      name: 'chain-slot-preview-studio',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
