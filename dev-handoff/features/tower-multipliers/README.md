# Tower Multipliers ×1–×5

**Universal.** Any game whose wilds expand to fill a whole reel can take this: each
full-reel wild carries a multiplier badge, and a win pays × the **highest** badge it
crosses. In Vice Heat it is what carries the free-spins RTP.

---

## The rule, in one paragraph

Every reel that stands **fully wild during a free spin** is dealt a badge of **×1–×5**,
drawn from a weight table. When the board is scored, each winning combination is
multiplied by the **HIGHEST badge among the expanded reels it crosses** — a ways
combination starts on reel 0 and runs `matchCount` reels, so it crosses reels
`0 … matchCount-1`. Scatter pay is never multiplied, and nothing is applied on top of
the 5-wild instant max win.

```
weights          [55, 20, 9, 6, 10]   ← ×1 … ×5, so 55% of towers are a plain ×1
rule             highest-crossed
scatter pay      never multiplied
instant max win  never multiplied (it is already the cap)
hot spins        no badge (base-game feature, this mechanic is free-spins only)
sticky towers    keep the badge they were dealt when they JOINED, for the whole round
per-spin towers  (3-scatter tier) re-expand each spin, so they draw fresh badges each spin
```

## Why HIGHEST and not the product

This was measured, not chosen:

| model | 4-scatter buy RTP |
|---|---|
| product of all crossed badges | **187%** — multiplicative in tower count, unshippable |
| sum of crossed badges | floors at **90.53%** even with the weights pushed to the floor |
| **highest crossed badge** | lands on target and stays there across all four modes |

The product blows up precisely because towers accumulate: a 4-scatter round routinely
stands 3–4 towers, and ×3·×5·×2 is a different game.

## ⚠️ Draw the badges from a RESERVED seed namespace

This is the part that is easy to get wrong and expensive to discover late.

The badge draw must **not** consume words from the same randomness stream that produces
the reel stops. We derive it from a reserved namespace — in our implementation
`keccak(seed, 1n << 200n)` — so the reels land **identically whether the mechanic is on
or off**. That is what lets two independently written simulators agree on the same seed,
and what makes a re-certification meaningful.

If you draw badges inline from the round's stream, every stop after the first badge
shifts, and every RTP figure in the preset becomes meaningless for your build.

## Presentation

- The badge is **art**, not a procedural plate: a 5-frame strip (`wild_multi_sheet.webp`,
  ×1 … ×5), sliced into individually mipmapped textures at load.
- It sits in the **lower third** of the column (`slotYFrac 0.86`) so it clears the
  vertical "WILD" lettering on the tower art, sized off the reel **width**
  (`sizeFrac 0.82`) with the height following the frame's own aspect so the plate never
  distorts.
- **It pops on.** When the badge locks it drops in from ~10% of the reel height above its
  slot, overshoots to `expandWildMultiPop` (default 1.45), and settles on a `back.out(3)`
  over `expandWildMultiPopTime` (default 0.42s) while the tower flexes once underneath —
  badge and tower read as one impact rather than two fades. Both numbers are studio
  parameters, shipped in the preset's `visualParams`.

## Preset keys

```json
"custom": {
  "towerMultiplierWeights": [55, 20, 9, 6, 10],
  "towerMultiplierRule": "highest-crossed …",
  "towerMultiplierStickyRule": "a sticky tower keeps the badge it joined with …",
  "towerMultiplierOnHotSpins": false
}
```

Visual settings live at the preset root under `visualParams`:
`expandWildMultiPop`, `expandWildMultiPopTime` (plus the tower's
`expandWildBackdrop*` / `expandWildBorder*` — see `features/expanding-wild`).

## Reference implementation

`src/game/viceSpin.ts` — `drawTowerMultiplier()` and `applyTowerMultipliers()`. It is a
**pure, seed-derived** function shared by settlement (`src/dev/mockHost.ts`) and the
decode façade, so the displayed round and the paid round are the same function of the
same seed by construction.

## Certified numbers with this mechanic live

`custom-math/sim_vice_core.mjs` (drives the live round core):
natural **96.46%** ±1.59pp / 20M · buy3 **96.35%** ±0.97pp · buy4 **96.08%** ±0.39pp / 4M,
zero max-win-cap violations. A ×5 badge reaches the board in **0.22%** of natural rounds.
