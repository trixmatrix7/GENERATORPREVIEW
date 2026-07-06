# Sticky Wild — Pop + Shine (dev drop-in)

Self-contained **visual** for the sticky-wild treatment: the AAA **pop-in +
animated border/glow + shine sweep + subtle breath** on a single cell.

**This is the LOOK only.** On purpose, it contains **none** of:
- the random 3–25 wild count,
- any math / RTP / board / persistence logic,
- our project's wild art (it ships a plain placeholder box).

You wire it to your real wilds for your use case; everything about the look is
config-driven so you can tune it.

## Files
- `StickyWildPop.ts` — the effect + config + a placeholder cell + a demo call.

Deps: **pixi.js v8**, **gsap v3** (already in the project).

## Use it
Call it once per cell that should get the treatment, above your reels:

```ts
import { applyStickyWildPop, DEFAULT_STICKY_WILD_POP } from './StickyWildPop';

// `overlay` = a Container above your reel cells.
// `rect`    = the cell rectangle in overlay-local space: { x, y, w, h }.
const handle = applyStickyWildPop(overlay, rect);

// later, when the wild leaves / the round ends:
handle.destroy();
```

Want to see it with no art first? One-liner demo (placeholder box + pop):

```ts
import { demoStickyWildPop } from './StickyWildPop';
demoStickyWildPop(overlay, { x: 100, y: 100, w: 120, h: 120 });
```

Replace `drawPlaceholderWildCell` with your real wild symbol when you integrate.

## Tune the look
Pass a partial config (or copy `DEFAULT_STICKY_WILD_POP` and edit):

```ts
applyStickyWildPop(overlay, rect, {
  ...DEFAULT_STICKY_WILD_POP,
  popMs: 620,            // slower pop
  shineSweepMs: 500,     // faster shine
  shineWidthFactor: 0.30,// thinner shine band
  shineStrength: 0.28,   // softer shine
  borderColor: 0x8fdcff, // ice instead of gold
});
```

Every knob (from `StickyWildPopConfig`):

| Value | What it does |
|---|---|
| `borderColor` / `shineColor` | rim colour / shine colour |
| `popMs` | pop-in duration — bigger = **slower pop** |
| `popFromScale` | scale it pops in from (0.72 punchy, 1 = no pop) |
| `breathMs` / `breathScale` | idle breath speed / amount (breathScale 1 = off) |
| `shineSweepMs` | one shine crossing — smaller = **faster shine** |
| `shineGapMs` | pause between shine sweeps |
| `shineWidthFactor` | shine band width vs cell — smaller = **thinner** |
| `shineStrength` | shine brightness 0..1 (keep subtle) |
| `borderWidth` | crisp border thickness — thinner/thicker |
| `glowWidth` / `glowStrength` | soft outer glow thickness / alpha |
| `cornerRadiusFactor` | cell corner rounding |

`STICKY_WILD_POP_COLORS` has ready presets (gold/ice/emerald/violet/magenta/white)
to feed `borderColor`.

The `DEFAULT_STICKY_WILD_POP` values match the preview 1:1, so it looks identical
to what you saw — adjust from there for your use case.
