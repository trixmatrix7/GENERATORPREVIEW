# `/public/audio/` — runtime sound assets

Howler.js loads files from this directory at runtime. The mapping
between **sound-event registry IDs** and file paths lives in
`src/audio/defaultSoundConfig.ts`.

## File naming convention

Per registry ID, drop both an `.ogg` and `.mp3` (Howler picks the first
format the browser supports):

```
spin-start.ogg            spin-start.mp3
reel-stop.ogg             reel-stop.mp3
win-small.ogg             win-small.mp3
win-big.ogg               win-big.mp3
win-mega.ogg              win-mega.mp3
scatter-land.ogg          scatter-land.mp3
free-spin-trigger.ogg     free-spin-trigger.mp3
ambient-music.ogg         ambient-music.mp3
```

If both formats can't be sourced, ship `.mp3` only — Howler will skip the
missing `.ogg` candidate and log a warning. The game continues silently for
that one event; no errors.

## Source / licensing

Non-win SFX are sourced from [Mixkit](https://mixkit.co/free-sound-effects/slot-machine/)
under the Mixkit Sound Effects Free License (royalty-free, no attribution required,
commercial use allowed). Ambient music is CC0.

The four WIN sounds are **original, synthesized in-repo** — one signature
rising-fanfare motif rendered in four escalating arrangements (the same melody
at every tier is what makes the win sound recognizable). Regenerate / retune
with `node scripts/gen-win-jingles.mjs`.

| File | Source | License |
|------|--------|---------|
| spin-start.wav | Mixkit "Arcade slot machine wheel" #1933 | Mixkit Free |
| reel-stop.wav | Mixkit "Coins handling" #1939 | Mixkit Free |
| win-small.wav | Original signature jingle (scripts/gen-win-jingles.mjs) | CC0 (ours) |
| win-normal.wav | Original signature jingle (scripts/gen-win-jingles.mjs) | CC0 (ours) |
| win-big.wav | Original signature jingle (scripts/gen-win-jingles.mjs) | CC0 (ours) |
| win-mega.wav | Original signature jingle (scripts/gen-win-jingles.mjs) | CC0 (ours) |
| scatter-land.wav | Mixkit "Melodic bonus collect" #1938 | Mixkit Free |
| free-spin-trigger.wav | Mixkit "Magical coin win" #1936 | Mixkit Free |
| ambient-music.ogg | CC0 placeholder | CC0 |

## Adding a new sound event

1. Add an entry to `src/registries/soundEvents.ts`.
2. Drop the audio files here as `<id>.ogg` + `<id>.mp3`.
3. (Optional) Override the per-event default volume in
   `src/audio/defaultSoundConfig.ts` `DEFAULT_VOLUMES`.
4. The SoundManager picks it up automatically — no code changes needed.

## Generated games

When the generator emits a new game, the assembler copies the active
sound pack into the game's static-asset bundle and writes a manifest so
players can drop in their own sounds without code changes.
