# 07 — Gap analysis: Vice Heat + Crack Farm vs. the research

Status per the 30-point feel checklist (06) + the sound bible (05).
✅ = shipped · 🔶 = partial · ❌ = open. Every open item names the exact
file/config to touch. Updated 2026-07-16 after the v1 feel package shipped.

## ✅ Shipped in the v1 feel package (2026-07-16)

| # | Item | Where |
|---|---|---|
| 14 | Rollup: ticking count + rising loop + **terminator on lock** (also on skip) | `WinCelebration.onTallyTick/onTallyEnd`, `win-tally-tick/-end.ogg`, App hooks |
| 2 | Stops pitched per reel — **major-pentatonic ladder** L→R + ±2% humanization | App `onReelStopped` rate `[1, 9/8, 5/4, 3/2, 5/3]` |
| 11 | Scatter chime pitched to its reel's scale step (L→R escalation) | App `onScatterLanded` |
| 16 | Tier upgrades LIVE mid-count **+ tier-slam stinger** (+2 semitones/tier) | `onTierPromote`, `tier-up.ogg` |
| 28 | Event-driven SFX (fired from the code that moves pixels) | audioHooks architecture |
| 30 | Rising per-connection chime ladder | `onWinStep` rate ladder |

## ✅ Already there before

1 (button reacts instantly) · 5 (turbo) · 7/8 (tiered, event-driven tease — only
live triggers) · 9 (gold gates + featured scatters) · 12-partial (sequential
per-line cycle; Crack Farm lines mode) · 15 (tap completes, tap dismisses) ·
21 (scatter announces on dead spins — idle sheet + stinger) · 22 (frame flash +
per-cell scatter win BEFORE the iris) · 23 (FS intro tap-to-start + 7s auto) ·
24-partial (spins + total-win meters persist) · 25 (TOTAL WIN outro with own
rollup; terminator now included).

## ❌ Open — P1 (highest impact per research)

1. **The anticipation RISER with two authored endings** (05 §risers, 06 #10).
   Today: per-gate sting ladder only; music keeps playing; a miss just ends.
   Target: 1–2-bar riser (noise sweep + in-key pitch + accelerating pulse)
   that DUCKS ambient (−6…−12dB), resolves ON the final reel stop; MISS = cut
   with a damped thud + 300–500ms near-silence, then music fades back over 1s.
   → synthesize `tease-riser.ogg` + `tease-miss.ogg`; wire in
   `ReelSet.stopOnStops` tease block (`duck/unduck` exist in SoundManager).
2. **The audio "conductor"** (05 §implementation note): a per-game
   `{bpm, barStartTime, key, scaleSteps[]}` object; stingers/terminators
   quantize to the next 16th (≤120ms wait), coin bursts land on downbeats
   (06 #17), base music re-enters on a bar line after features (06 #26).
   This is THE architectural piece behind "everything harmonizes".
   → new `src/audio/conductor.ts`; needs the ambient tracks' BPM measured.
3. **Key discipline on the asset sheet** (05 §key/tempo): document a root key
   per game (suggestion from research: A minor for Vice/synthwave, D major
   for Crack Farm/barn) and re-pitch existing stingers to it; ONE shared
   3–5-note motif across loop, scatter stinger, terminator, marquee
   (the marquee hook already exists — reuse its notes).
4. **200–400ms readable stillness** between last stop and first win FX
   (06 #6) — measure our current gap in `resolve()`; if <200ms, add the beat.

## ❌ Open — P2

5. **Crack Farm symbol win animations** (06 #19/20): all symbols are static;
   premiums (farmer, pig, goat, bull) need bespoke win sheets, lows a shared
   shimmer. Wild pot + scatter sack too. (Art drop needed — Noski renders.)
6. **All-winners flash BEFORE the sequential cycle** (06 #12): lines mode
   currently goes straight to the sequential tally.
   → `PixiApp.playWinSequence`: one 300ms all-winners pulse first.
7. **Dim discipline** (06 #13): verify non-winners dim to 30–50% in lines
   mode during the cycle (ways-immersive has the deep dim; lines path check).
8. **Retrigger "+X" flies to the spins counter** (06 #24).
   → FS loop in `PixiApp.resolve` + `showFreeSpinOverlay` counter.
9. **Win-tier jingles are still muted** (win-small/normal/big/mega = 0):
   with tally+terminator now in, author 3 SHORT in-key jingles (05 §7) or
   keep the marquee track as the only big-win music but add a small-win
   "nice" chime for sub-marquee wins (currently only coin-chime swish).

## ❌ Open — P3

10. **Reel-spin bed** (05 §package #3): deliberately OFF today; research says
    a quiet bed + per-reel stops is the norm. Revisit with a very low-level
    theme bed (wind/crickets for barn, synth hum for Vice).
11. **Scatter stinger should REPLACE the reel stop, not stack** (05 §stops).
    → suppress the stop thunk on reels where a scatter stinger fires.
12. **Round-robin stop samples** (05: 2–3 variants/reel) — we have ±2% pitch
    humanization; real sample variants would kill machine-gun fatigue fully.
13. **Big-win ceremony: stop music entirely** (05 §ceremony) — we duck to 0
    but keep it running; stopping + bar-line re-entry is the documented norm
    (needs the conductor, item 2).
14. **Phone-speaker QA ritual** (05 §mixing): verify stops carry a 1kHz
    component (Nolimit practice) — test both games on a phone speaker.

## Pay-model notes (08/09 — reports pending retry)

Crack Farm (lines): stop rhythm should emphasize INDIVIDUAL stops harder than
Vice (already true via crack-slam board thud + pentatonic ladder). Vice (ways):
faster overall read, win presentation via symbol groups (ways-immersive) —
already aligned. Full conventions land in 08/09 when the research retry
completes.
