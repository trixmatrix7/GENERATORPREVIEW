# Symbol Sheets — per-symbol IDLE + WIN spritesheets

**Type:** symbol animation (needs render overlay; data-driven) · **Grids:** 5x3, 5x5 · **Theme-agnostic.**

Reference skin: *Vice Heat*. The mechanic is universal — any symbol can be given a looping idle animation and/or a win animation that plays *in place of* its static icon, on that cell's exact footprint.

---

## What it is

Two optional per-symbol spritesheet overlays, both sliced the same way and both parented to the cell so they inherit its transform:

1. **WIN sheet** — plays while a cell is in the `win` state (part of a connection). It **spawns on the resting art's exact footprint and cross-fades over the static icon** — no relocation. If the symbol also has an idle loop, the win sheet **grows to ~1.28× of its rest scale** (`back.out(1.8)`, 0.45 s) so the reveal reads as a swell, not a shrink; if there is no idle loop, it is a **pure cross-fade with zero scaling** (the emphasis comes from the board dimming around it). On win-end it cross-fades back and the static icon / idle loop returns.
2. **IDLE sheet** — loops continuously on the cell's footprint, **permanently replacing** the static icon whenever the cell rests. It is synced on every static render, re-fit on theme/size refresh, and starts at a **random frame** so stacked copies of the same symbol desync. The win sheet hides it during `win` and hands back afterward (the loop keeps running underneath, so its phase stays organic).

Both overlays wear a shared **soft-edge feathered rounded-rect mask** so the square video frame melts into the cell and only the character/badge reads — never a hard card.

---

## The two guards

Some symbols must opt out of the generic fallback tweens, else in-place scaling of upscaled art looks wrong:

| Guard set | Effect | Reference use |
|---|---|---|
| `STATIC_LOOK_SYMBOLS` | The cell art **never warps in place** — `landing`, `idle`, `featured`, and even `win` *without* a wired win sheet are all absorbed into a clean still. A wired **win sheet is the one allowed animation.** | Scatter (id 1) — the BONUS badge |
| `NO_IDLE_SYMBOLS` | The **fallback idle breathing is suppressed** (landing slam and win presentation stay untouched) — a lone pulsing cell on an otherwise still board reads weird. | Wild (id 0) — the 1:1 money-stack |

These are `Set<number>` of symbol ids, populated at boot per game.

---

## Sheet geometry format

Every sheet (idle and win) is `{ file, cols, rows, count, fps }`. Frames are sliced **row-major**: `fw = sheet.width / cols`, `fh = sheet.height / rows`, frame `i` = `((i % cols) * fw, floor(i / cols) * fh, fw, fh)` for `count` frames. `count` may be less than `cols × rows` (trailing cells ignored). Playback loops at `fps`.

Reference assets (frame 256 × 256 unless noted):

| Symbol | Kind | File | cols × rows | count | fps |
|---|---|---|---|---|---|
| HIGH_A (2) | win | `prem_a_win.webp` (1792²) | 7 × 7 | 48 | 12 |
| HIGH_B (3) | win | `prem_b_win.webp` (1792²) | 7 × 7 | 48 | 12 |
| MID_C (4) | win | `car_win.webp` (1792²) | 7 × 7 | 48 | 12 |
| MID_D (5) | win | `koffer_win.webp` (1792²) | 7 × 7 | 48 | 12 |
| SCATTER (1) | win | `scatterwin.webp` (2048 × 2304) | 8 × 9 | 67 | 15 |
| SCATTER (1) | idle | `scatteridle.webp` (2560 × 2304) | 10 × 9 | 90 | 10 |

WILD (0) has no sheet — it uses `NO_IDLE_SYMBOLS` + its hard landing slam.

---

## Behaviour reference

| Aspect | Value |
|---|---|
| Win-sheet spawn | On resting footprint; `restScale = restW / frameWidth`, `restW = idleSheet.width` if an idle loop runs, else `cell * 0.94` |
| Win-sheet grow (idle present) | `→ restScale * 1.28`, `0.45 s`, `back.out(1.8)` |
| Win-sheet grow (no idle) | none — pure cross-fade, zero scale |
| Win-sheet cross-fade in | `alpha 0→1, 0.12 s`; static icon fades out `0.14 s` |
| Win-sheet end | reverse cross-fade; idle loop re-shown; static icon restored |
| Idle-sheet fit | matches the static icon's position/width/height exactly |
| Idle-sheet desync | starts at `random * frameCount` |
| Mask | shared feathered rounded-rect (`getSoftEdgeMask`) |
| Reduced motion | win sheet not started; falls back to static outline |

---

### feature.json

```json
{
  "id": "symbol-sheets",
  "name": "Per-Symbol Idle + Win Spritesheets",
  "description": "Optional per-symbol idle-loop and win spritesheets that render in place of the static icon on the cell's exact footprint. Win sheets cross-fade over the resting art (growing ~1.28x when an idle loop is present, otherwise zero-scale); idle sheets loop permanently and desync across stacked copies. Two opt-out guards keep upscaled art from warping.",
  "version": "1.0.0",
  "implemented": true,
  "compatibleGrids": ["5x3", "5x5"],
  "type": "symbol-animation",
  "winSheets": {
    "2": { "file": "theme/<skin>/prem_a_win.webp", "cols": 7, "rows": 7, "count": 48, "fps": 12 },
    "3": { "file": "theme/<skin>/prem_b_win.webp", "cols": 7, "rows": 7, "count": 48, "fps": 12 },
    "4": { "file": "theme/<skin>/car_win.webp",    "cols": 7, "rows": 7, "count": 48, "fps": 12 },
    "5": { "file": "theme/<skin>/koffer_win.webp", "cols": 7, "rows": 7, "count": 48, "fps": 12 },
    "1": { "file": "theme/<skin>/scatterwin.webp", "cols": 8, "rows": 9, "count": 67, "fps": 15 }
  },
  "idleSheets": {
    "1": { "file": "theme/<skin>/scatteridle.webp", "cols": 10, "rows": 9, "count": 90, "fps": 10 }
  },
  "staticLookSymbols": [1],
  "noIdleSymbols": [0],
  "settings": {
    "winGrowScale": 1.28,
    "winGrowDuration": 0.45,
    "winGrowEase": "back.out(1.8)",
    "crossFadeIn": 0.12,
    "idleDesyncRandomStart": true
  }
}
```

---

## Render wiring (exact call sites)

**Registries + guards — `src/game/AnimatedSymbol.ts`:**
- `SYMBOL_WIN_SHEETS: Map<number, { frames, fps }>` and `SYMBOL_IDLE_SHEETS: Map<number, { frames, fps }>` — filled by the two loaders below.
- `STATIC_LOOK_SYMBOLS: Set<number>` and `NO_IDLE_SYMBOLS: Set<number>` — opt-out guards.
- `startWinSheet()` — spawns/grows/cross-fades the win overlay (called from the state dispatch when `state === 'win'` and a win sheet exists; returns before any other win effect).
- `syncIdleSheet()` — replaces the icon with the idle loop; called at the end of every static render (`enableStaticMode`).
- `stopWinSheet()` / `stopIdleSheet()` — teardown + restore.
- The state dispatcher enforces both guards: STATIC_LOOK absorbs `landing`/`idle`/`featured`/sheet-less `win`; NO_IDLE absorbs fallback `idle`.

**Loaders — `src/game/PixiApp.ts`:**
- `setSymbolWinSheet(symbolId, url, cols, rows, count, fps=12)` — slices row-major into `SYMBOL_WIN_SHEETS`. `url=null` clears.
- `setSymbolIdleSheet(symbolId, url, cols, rows, count, fps=12)` — same into `SYMBOL_IDLE_SHEETS`, then `reelSet.refreshAllTiles()` so resting cells pick the loop up immediately.

**Wiring from config — `src/App.tsx`:**
```ts
void pixiAppRef.setSymbolWinSheet(2, `${B}prem_a_win.webp`, 7, 7, 48, 12);
// …3,4,5…
void pixiAppRef.setSymbolIdleSheet(1, `${B}scatteridle.webp`, 10, 9, 90, 10);
void pixiAppRef.setSymbolWinSheet(1, `${B}scatterwin.webp`, 8, 9, 67, 15);
STATIC_LOOK_SYMBOLS.add(1);   // scatter badge: only the win sheet animates
NO_IDLE_SYMBOLS.add(0);       // wild: no fallback breathing
```

---

## How to add a sheet per symbol

1. Export a spritesheet whose frames are square portraits, packed row-major, at a fixed cols×rows.
2. Call `setSymbolWinSheet(id, …)` for a win animation and/or `setSymbolIdleSheet(id, …)` for a rest loop.
3. If the art is heavily upscaled and must never warp in place, add its id to `STATIC_LOOK_SYMBOLS`; if a lone idle breath looks odd, add it to `NO_IDLE_SYMBOLS`.
4. Idle + win on the same symbol compose automatically: idle loops while resting, the win sheet swells over it on a connection and hands back on win-end.
