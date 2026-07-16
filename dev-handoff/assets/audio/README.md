# Sound pack (OGG only)

Every event ships as a single `.ogg` (Noski's rule: no wav/mp3 — a missing
`.wav` on an SPA host returns `index.html` and Howler dies with "Decoding
audio data failed", so OGG is loaded **first/only**). Drop these into
`public/audio/`. The runtime maps them by event id from the registry — dropping
`public/audio/<id>.ogg` "just works".

| Event id | File | Vol | Flags | Role |
|---|---|---|---|---|
| `ambient-music` | ambient-music.ogg | 0.35 | loop, exclusive | bed music; **ducks** under the win marquee |
| `win-marquee` | win-marquee.ogg | 0.95 | exclusive | tiered win celebration track — theme-**neutral** (runs in every game); starts+ends with the marquee, fast-fades on skip |
| `spin-start` | spin-start.ogg | 0.78 | — | reels launch |
| `reel-stop` | reel-stop.ogg | 0.58 | — | fires 5× per spin on the stop stagger (sits under the one-shots) |
| `coin-chime` | coin-chime.ogg | 0.5 | — | connection **swish** on the rising win tally |
| `scatter-land` | scatter-land.ogg | 0.8 | — | a scatter/BONUS badge lands |
| `wild-land` | wild-land.ogg | 0.8 | — | cash-bundle **money drop** (wild lands) |
| `wild-expand` | wild-expand.ogg | 0.85 | — | bill-**riffle riser + slam** (reel expands to a wild tower) |
| `free-spin-trigger` | free-spin-trigger.ogg | 1.0 | — | the FS round is awarded |
| `near-miss-tease` | near-miss-tease.ogg | 0.4 | — | tension sting during the tease/anticipation |

**Mixing contract**

- `marqueeDucksAmbient: true` — when a win marquee starts, ambient music fades
  toward 0 and unducks (restored to `binding.volume × master`, unconditionally)
  when the marquee exits. Mute is orthogonal: unduck restores the bound volume
  even in a muted session (do not gate the restore target on mute).
- `win-marquee` and `ambient-music` are **exclusive** (a re-triggered
  celebration must not stack a second copy of a track).
- All volumes are 0–1 and multiply by the user's master volume.

**Not shipped (disabled by design)**

- `win-small` / `win-normal` / `win-big` / `win-mega` — per-connection win
  stingers are **off** (the synthesized versions read as "AI sound"). Connection
  audio is carried by the `coin-chime` tally + the marquee track until proper
  non-synthetic drops arrive; then re-enable by dropping `public/audio/<id>.ogg`
  and raising the volume.
- `reel-spin-loop` — **off** (no bed under the spin; music + stop thumps carry it).

**Foley note (how these were made, if regenerating):** the money/whoosh sounds
are noise-shaped (band-pass-swept noise for whooshes, jittered paper ticks for
cash) rather than tonal synthesis — noise-based foley reads "organic", tonal
synthesis reads "AI".
