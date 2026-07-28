# Sound pack (OGG only)

Every event ships as a single `.ogg` (Noski's rule: no wav/mp3 — a missing
`.wav` on an SPA host returns `index.html` and Howler dies with "Decoding
audio data failed", so OGG is loaded **first/only**). Drop these into
`public/audio/`. The contract is **flat**: `preset.audio.events` is a map keyed
by your registry ids and every file is referenced as `/audio/<id>.ogg`, so
dropping `public/audio/<id>.ogg` "just works". `format: "ogg"`, `dir: "audio/"`.

This folder is Noski's **final mix**, set in the Audio Studio on 2026-07-26 and
re-exported into `preset/vice-heat.chainwtf-preset.json`. The levels below are
`preset.audio.events[*].volume` verbatim — build to these, not to taste.

## Shipped — 11 files, 8 audible events

| Event id | File | Vol | Flags | Role |
|---|---|---|---|---|
| `ambient-music` | ambient-music.ogg | **0.35** | loop, exclusive, `role: music` | base-game bed; **ducks** under the win marquee |
| `win-screen-music` | win-screen-music.ogg | **0.95** | exclusive, `role: music` | the win marquee track — theme-**neutral** (runs in every game); starts+ends with the marquee, fast-fades on skip |
| `connect-symbol` | connect-symbol.ogg | **0.53** | `role: sfx` | every winning ways **connection** |
| `coin-chime` | coin-chime.ogg | **0.53** | `role: sfx` | the coin ceremony / rising win tally |
| `spin-start` | spin-start.ogg | **0.47** | `role: sfx` | reels launch |
| `reel-stop` | reel-stop.ogg | **0.16** | `role: sfx` | fires 5× per spin on the stop stagger (sits **under** the one-shots — that is why it is this quiet) |
| `scatter-land` | scatter-land.ogg | **0.55** | `role: sfx` | a scatter/BONUS badge lands |
| `free-spin-trigger` | free-spin-trigger.ogg | **0.59** | `role: sfx` | the FS round is awarded |
| `win-small` | win-small.ogg | **0** | `enabled: false` | off by design — see below |
| `win-normal` | win-normal.ogg | **0** | `enabled: false` | off by design — see below |
| `win-big` | win-big.ogg | **0** | `enabled: false` | off by design — see below |

`win-mega` is a **12th event in the preset with no file in this pack** — see the
preloader rule below.

Two names are the ones that historically break, because they exist under
different ids on each side: **`win-screen-music`** (ours was once
`win-marquee`) and **`connect-symbol`**. If either logs *"unavailable — running
silently"*, the win screen and the win connections have no sound. `coin-chime.ogg`
and `connect-symbol.ogg` are byte-identical here — both were exported from the
same source pick — but they are **two events**; do not collapse them.

`trim` (`{offsetMs, durMs, fadeOutMs, gainDb}`) is a legal per-event field in the
schema; **none of the 12 Vice events carries one**, so play each file whole.

## The four win tiers are OFF on purpose

`win-small` / `win-normal` / `win-big` / `win-mega` all ship `"volume": 0` with
`"enabled": false`. The **marquee music covers those tiers** — a per-connection
stinger stacked on top of it reads as noise. This is a mix decision, not a
missing asset: three of the four still have a file in this pack, so re-enabling
one is a volume change, nothing more.

> ⚠️ **Preloader rule — skip every event with `"enabled": false`, and never
> preload from its `file`.** `win-mega` has no `.ogg` anywhere: not in this
> folder, not in the repo (only a `.wav`, which is the one format that must
> never ship). The exporter now writes `"file": null` for a volume-0 event, but
> the preset copy in this package was exported before that fix and still carries
> a literal `"/audio/win-mega.ogg"`. Preload it and you 404; on an SPA host that
> 404 hands back `index.html`, which is exactly the decode death the OGG-only
> rule exists to prevent. Gate on `enabled`, not on the presence of a path.

## Mixing contract

- `mixing.marqueeDucksAmbient: true` — when a win marquee starts, `ambient-music`
  fades to 0 over **350 ms** *without stopping* (the loop keeps running muted
  underneath), and unducks over **450 ms** when the marquee exits, restored to
  `binding.volume × master` **unconditionally**. Mute is an orthogonal layer: the
  unduck target must not be gated on mute, or a session that unmutes mid-marquee
  comes back at the wrong level. Verify the duck **releases** — if the group is
  still keyed on an old id, the ambient bed never returns and it reads as
  detached, hanging marquee music.
- `mixing.exclusiveGroups: [["ambient-music", "win-screen-music"]]` — a
  re-triggered celebration must not stack a second copy of a track.
- All volumes are 0–1 and multiply by the user's master volume.

## Five events our mix uses that your runtime never dispatches

`fs-retrigger`, `tease-riser`, `tease-miss`, `wild-land`, `wild-expand`. They
play on our build and are **silent in yours until you fire those events**. They
are deliberately not in the flat 12-event contract and their files are **not in
this pack** — ask and we ship them. Not a blocker; decide with us whether those
beats are in scope rather than discovering them later. Noski's levels for them,
if you do wire them: `fs-retrigger` 0.64, `tease-riser` 0.26, `tease-miss` 0.26,
`wild-expand` 0.12, `wild-land` 0.09.

Everything else our registry knows (`reel-spin-loop`, `near-miss-tease`,
`win-tally-tick` / `win-tally-end`, `tier-up`, `multi-*`, `fs-counter-*`) is at
**0** in the final mix and is not exported. No bed under the spin — music plus
the stop thumps carry it.

---

## History — the reconstruction pack (superseded 2026-07-26)

> **Do not build to this section.** It records the synthesized placeholder pack
> that shipped before Noski's Audio Studio mix, so nobody re-derives its levels
> from an old copy of this file. Every number here is **void**.

The placeholder pack used `win-marquee` (renamed → `win-screen-music`), had no
`connect-symbol` at all, and ran at: `spin-start` 0.78, `reel-stop` 0.58,
`coin-chime` 0.3, `scatter-land` 0.8, `free-spin-trigger` 1.0, `wild-land` 0.8,
`wild-expand` 0.85, `near-miss-tease` 0.4. Those sounds were noise-shaped foley
(band-pass-swept noise for whooshes, jittered paper ticks for cash) rather than
tonal synthesis — noise-based foley reads "organic", tonal synthesis reads "AI".
That whole pack is gone; the shipped files are authored picks from the sound
library, and only `ambient-music` and `win-screen-music` sit outside it.
