# 10 — Symbol animation STATES: what the greats run, and the simple recipes

> Analyst-authored from the studio reports (01–06) + direct game observation.
> Question answered: which states exist, how are they SIMPLY animated, and
> what makes them feel right. Our engine's four states (idle / landing / win /
> featured) map cleanly — the differences are in the RECIPES, not the states.

## The canonical state set (all top studios)

| State | When | Who runs what |
|---|---|---|
| **idle / rest** | board at rest | Hacksaw: DEAD STILL (crisp readability IS the brand). Pragmatic: still, except light ambient shimmer on premiums. Nolimit: still, occasional 1-shot "blink" on character symbols every 4–8s. **Rule: rest means rest** — a busy idle cheapens wins. |
| **landing** | reel stops | Universal: tiny squash-settle ≤150ms, board-level thud carries the weight (not per-symbol warping). Scatters/bonus symbols OVERRIDE with a bigger entrance (pop + ring + stinger). |
| **win** | part of a paying combo | THE hero state. Play-once "burst" (300–600ms) → then a **win-idle loop** while the line/tally cycles. Never warp the art in-place (pixelates) — either a dedicated win SHEET on the footprint, or whole-object motion (pop/pulse), never both. |
| **anticipation / featured** | tease running, scatter waiting | Glow/pulse on the LANDED scatters + darkened board; the symbol itself pulses scale 1.0→1.05 slowly (0.8–1.2s sine). Distinct from win — softer, expectant. |

Extra states some studios add (not required): **collect** (money symbols fly
to a collector — Big Bass), **transform** (symbol morphs — Book-of expanding
symbol ceremony), **death** (tumble pop — scatter-pays games).

## Simple recipes that produce "genau das Gefühl"

1. **Idle discipline**: everything perfectly still; at most ONE ambient
   element per game (our farmer mascot). If premiums breathe, ≤2% scale,
   ≥3s period, randomized phase — and lows never move.
2. **Landing = board weight, not symbol crunch** (what we shipped as
   crack-slam): symbol compress ≥0.88, board thud carries the punch. The
   landing must complete in ≤200ms so 5 staggered stops read as a rhythm.
3. **Win burst-then-loop**: 1 play-once accent (scale pop to ~1.2–1.3 with
   back.out, or the win sheet's first pass) synced to the win sound's
   transient, then a calm 1–2s loop while the presentation cycles. The
   burst NEVER loops — repetition kills impact.
4. **The dim sells the win**: non-winners to 30–50% brightness beats any
   amount of winner animation. Winners on a lifted layer.
5. **Anticipation pulse ≠ win pulse**: slower, softer, waiting; add the glow
   ring on the cell, not on the art.
6. **Sync rule**: every state transition lands ON its sound (stop on thunk,
   burst on hit, scatter pop on stinger). A 50ms offset is audible/feelable.

## Our engine mapping (already in place / to tune)

- Our four states = idle, landing, win, featured — canonical ✓.
- `STATIC_LOOK_SYMBOLS` (scatter) + `NO_IDLE_SYMBOLS` (wild) = the "rest
  means rest" discipline ✓. Crack Farm runs ALL symbols static-idle ✓
  (matches Hacksaw's crisp identity).
- crack-slam preset = recipe #2 ✓ (board thud, near-rigid symbols).
- Win: Vice premiums have win SHEETS on the footprint ✓; Crack Farm has NO
  win sheets yet (❌ gap 07-P2 #5) — currently pulse-only. The pulse follows
  recipe #3's pop (scalePeak 1.46 crack-slam) but has no burst-then-loop
  separation: the win pulse LOOPS the pop. → tune: one hard pop, then a
  soft 1.007 breathing loop instead of repeating the full pulse.
- Featured: gold-gate glow + featured state ✓ (recipe #5).
