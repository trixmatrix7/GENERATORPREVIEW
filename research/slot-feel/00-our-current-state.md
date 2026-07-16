# 00 — Our current state (the baseline for the gap analysis)

Every tunable "feel parameter" our two games run TODAY. The studio reports
(01–06) get compared against this file; the deltas live in
[07-gap-analysis](07-gap-analysis-our-games.md).

## Games

| | Vice Heat (5×5) | Crack Farm (5×3) |
|---|---|---|
| Pay model | 3125 ways | 10 paylines |
| Math | ~96% RTP, hit 69.3%, max 5000× | ~96% RTP, hit 44.6%, max 5000× |
| FS | 3sc=7 per-spin expand · 4sc=10 sticky towers | 3sc=8 roaming plant · 4sc=6 sticky plants + multi (cap 20×) |
| Win presentation | ways-immersive (leap/dance, no lines) | classic lines (frames + comet, pulse in place) |
| State preset | dev default | crack-slam (rigid symbols, deep board thud) |

## Spin & landing (display layer)

- Reel motion: dev's frozen `Reel.ts` — launch/stop timings come from the
  generator baseline (`FALLBACK_TIMINGS`) modified by state presets.
- Landing (rich state, wild/scatter): `downDuration 0.06s`, `scaleCompress
  0.78`, overshoot ~1.18, rotation kick 3°.
- Land bounce (plain symbols): squash `0.07s`, squash 0.90/stretch 1.06.
- LandingImpact multipliers (global): `squashMul 1.7`, `stretchMul 1.6`,
  `snapMul 0.75`; board thud `2.2px` per stop, `4px` last reel.
  - Crack Farm overrides: `squashMul 1.1`, `thudAmp 6`, `thudLastAmp 11`
    (deep board slam instead of symbol squash).
- Symbols fill 88% of the 120×110 cell (was 72%).

## Anticipation / tease

- Trigger: 2 scatters visible → sequential gold-gate tease, one reel at a
  time (event-driven: gate N opens when teased reel N−1 lands).
- Camera: true POV dolly (world incl. background), scale 1.06 + 0.05/step,
  miss = back.out(1.4) 0.9s bounce-out, hit = lock (iris owns the exit).
- Audio: `near-miss-tease` sting @ 0.4 vol. No continuous riser yet.

## Win presentation

- Tally: every connection gets one step with its own +amount; combos sorted
  ascending; per-combo win sheets (Vice) or frames+comet (Crack Farm).
- Marquee tiers: BIG ≥15×, MEGA ≥25×, EPIC ≥100×, MAX = cap hit.
- Count-up: `[2.6, 3.6, 4.6, 5.6]s` per tier; hold `[1.0, 1.2, 1.4, 1.8]s`;
  size `sizeMul 0.48`, tier growth `[1.0, 1.16, 1.34, 1.6]`; pulse amp 0.03.
- Coin rain behind the marquee (300f @ 45fps, chroma-keyed).
- Skip: pointer tap → 0.26s graceful fade + fast music fade.

## Audio package (OGG, per event)

| Event | Vol | Notes |
|---|---|---|
| ambient-music | 0.35 | loop, exclusive; DUCKS under marquee |
| win-marquee | 0.95 | one track for ALL tiers (theme-neutral orchestral) |
| spin-start | 0.78 | click |
| reel-stop | 0.58 | fires 5×/spin (same sample each reel — NO pitch ladder) |
| coin-chime | 0.30 | connection swish (one-shot per connection) |
| scatter-land | 0.8 | |
| wild-land | 0.8 | cash-bundle drop (Vice) / wood (Crack Farm pack) |
| wild-expand | 0.85 | riffle riser + slam |
| free-spin-trigger | 1.0 | |
| near-miss-tease | 0.4 | |
| win-small/normal/big/mega | 0 | MUTED (synthesized versions sounded "AI") |
| reel-spin-loop | 0 | OFF (no bed under the spin) |

Known audio gaps (our own diagnosis, to check against research):
- No per-reel pitch ladder on stops.
- No win-TALLY loop (rising ticks during count-up) — only the marquee track.
- One marquee track for all tiers (no escalation per tier).
- No key/tempo discipline documented — stingers not authored to the music's
  key/beat grid.
- Win-tier jingles muted → the marquee carries all win audio.
- No terminator hit at count-up end.

## Transitions / flow

- Boot loader (real progress) → game intro (iris-open, breathing layers) →
  base. FS: iris blink (close 0.55s power3.in, black beat, open 0.6s
  power2.out), 7s intro hold, tap-to-start. Outro: TOTAL WIN count-up 4.2s,
  ≤15s hold, tap-anywhere, iris back.
