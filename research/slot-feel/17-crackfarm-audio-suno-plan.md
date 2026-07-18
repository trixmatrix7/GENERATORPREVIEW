# 17 — Crack Farm AUDIO-PRODUKTIONSPLAN (Suno) — komplette Asset-Liste + Prompts

Ziel: ALLE Audio-Assets für Crack Farm mit Suno produzieren (Musik + Jingles + witzige
Tier-Quips), dann OGG-Pipeline → Hör-Freigabe durch Noski → Volumes hoch.
**Harte Regel ([[slot-feel]] §4): NICHTS geht live, bevor Noski es gehört hat.** Alle neuen
Events starten mit Volume 0 bzw. Dateien landen erst zum Anhören in `public/audio/_review/`.

## 1. Musik-Fundament (Key-/Tempo-Disziplin, Report 05)

- **Root-Key: D-Dur. Tempo: 118 BPM.** JEDES tonale Asset (Musik, Jingles, Quips mit Tonhöhe)
  wird in D-Dur / D-Pentatonik produziert — Stinger landen aufs Beat-Grid (508ms/Beat).
  Das ist das "gewisse Etwas" aus der Sound-Bibel: ein Key, ein Puls, alles dockt an.
- Stil-Welt: **Twisted Bluegrass / Psychobilly-Farm** — Banjo, Kontrabass-Slap, Washboard,
  Maultrommel, Fiddle; dazu "verstrahlte" Elemente: Theremin-Wobble, Bubble-/Slime-FX,
  detuned Music-Box. Goofy + leicht unheimlich, nie Horror.
- **Marquee-Musik bleibt UNIVERSAL** ([[marquee-universal-not-themed]]): Orchester-Fanfare +
  5-Noten-Hook laufen in allen Games; Crack-Farm-Färbung NUR über SFX/Quips. Kein
  Theme-Marquee-Song produzieren!

## NOSKI-ENTSCHEIDUNG (2026-07-18): dezent verstrahlt + eigener Ambience-Layer
- Musik = überwiegend fröhlicher/sonniger Country-Bluegrass, nur SUBTILE schräge Akzente
  (gelegentliches Theremin-Wobble + vereinzelte Slime-Pops) — NICHT carnival-eerie-dominant.
- Farm-Geräusche = SEPARATER leiser Loop-Event `ambient-farm` UNTER der Musik (Volume ~0.15),
  nicht in die Musik eingewoben (mehr Balance-Kontrolle).
- Finale Prompts (dezent-Version):
  - Base: `cheerful country bluegrass instrumental, bright banjo picking, warm upright bass,
    light washboard and brushes, friendly fiddle melody, feel-good farm groove, only subtle
    quirky touches — an occasional faint theremin wobble and a soft slime bubble pop here and
    there, mostly wholesome and sunny, D major, 118 bpm, loopable, no vocals`
  - FS: `upbeat country bluegrass instrumental, driving banjo tremolo, stomping kick, hand
    claps, joyful fiddle runs, celebratory farm hoedown energy, rising excitement, just a light
    mischievous edge (subtle theremin, faint slime pops), stays fun and bright not creepy, D
    major, 118 bpm, loopable, no vocals`
  - Ambience: `gentle farm ambience bed, soft countryside wind, distant occasional rooster
    crows, quiet crickets and buzzing flies, faint creaking barn wood, calm sunny afternoon, no
    melody, no drums, no music, subtle and continuous, loopable background` (role=loop, vol 0.15)

## 2. MUSIK (Suno, als Loops)

| Asset (ogg) | Länge | Loop | Suno-Prompt |
|---|---|---|---|
| `ambient-music` (Base) | 90–120s | ja | "Quirky twisted bluegrass instrumental, banjo picking, slap upright bass, washboard rhythm, jaw harp accents, playful eerie carnival undertone, subtle theremin wobble, D major, 118 bpm, loopable, no vocals, video game background music, mischievous barnyard mood" |
| `fs-music` (Free Spins) | 60–90s | ja | "Uptempo psychobilly bluegrass instrumental, driving banjo tremolo, stomping kick, hand claps, fiddle runs, mutant carnival energy, rising tension, D major, 118 bpm, loopable, no vocals, video game bonus round music, wild and unhinged but fun" |
| `fs-outro-bed` (Total-Win-Screen) | 20–30s | ja | "Triumphant bluegrass victory groove, warm banjo and fiddle harmony, celebratory, relaxed tempo 90 bpm, D major, loopable, no vocals, short game victory background" |

Integration: `ambient-music` ersetzt aktuelles Bett via `SoundManager.replaceSource`
(crackfarm-Boot, wie Wood-Pack); `fs-music` = neuer Registry-Event ODER replaceSource beim
FS-Entry + zurück beim Outro (Events sind exclusive-Gruppe mit ambient).

## 3. JINGLES / STINGER (kurz, tonal, alle D-Dur @118)

| Asset | Länge | Moment | Suno-Prompt-Kern |
|---|---|---|---|
| `free-spin-trigger` | ~2,5s | 3. Scatter gelandet | "Short excited bluegrass fanfare sting, banjo flourish ending in a comedic goat bleat, D major, 118 bpm, game bonus trigger jingle" |
| `fs-intro-sting` | ~3s | Intro-Karte auf | "Rising banjo + fiddle build-up sting with slime bubble pops, ends on suspended chord, D major, game bonus intro" |
| `fs-outro-jingle` | ~4s | Total-Win-Karte | "Warm victorious bluegrass cadence, banjo + fiddle unison run to root chord, satisfied ending, D major, game win jingle" |
| `win-small/normal/big/mega` | 0,8–2s | Connection-Stinger (aktuell vol 0) | 4 Varianten: "Short cheerful banjo pluck run, N notes ascending D major pentatonic, bright, game win sting" — Länge/Notenzahl steigt pro Tier (2→3→5→7 Noten), mega mit Fiddle-Oktave |
| `tier-up` | ~0,7s | Marquee-Tier-Promote | UNIVERSAL (kein Farm-Sound): "Single orchestral brass hit with shimmer, short, impactful, game tier up" |
| `multi-up` (NEU) | ~0,6s | Badge-Upgrade (Spawn→Drift→Pop) | "Wet slime pop followed by a single cowbell hit, comedic, short, game power-up" |

## 4. WITZIGE TIER-QUIPS (Noski-Kernwunsch — pro Symbol-Connection)

Feuert wenn die Linie dieses Symbols revealed (Tally-Step). Kurz (0,4–0,9s), trocken,
Comedy-Timing. Suno-Tipp: als "sound effect, no music" prompten; wenn Suno zu musikalisch
wird → ElevenLabs SFX als Fallback (gleiche Prompts). Dateien: `public/audio/crackfarm/quips/quip-<id>.ogg`.

| SymbolId | Art | Quip | Prompt |
|---|---|---|---|
| HIGH_A (2) | Zombie-KUH | verstrahltes Muh | "Funny mutant cow moo, slightly pitch-bent and gurgly at the end, cartoon style, short sound effect, no music" |
| HIGH_B (3) | ZIEGE | **Meme-Mähh** | "Comedic goat bleat scream, MEEEH, exaggerated cartoon goat, short, punchy, no music" |
| MID_C (4) | HUND | Goofy Wuff | "Happy goofy dog double bark with a small pant, cartoon style, short, no music" |
| MID_D (5) | SCHAF | Dopey Bäh | "Dopey sleepy sheep baa, low and derpy, cartoon, short, no music" |
| LOW_E (6) | KAROTTE | Crunch | "Crisp carrot crunch bite with a tiny slime squish tail, cartoon, short, no music" |
| LOW_F (7) | MAIS | Popcorn | "Three quick popcorn pops with cartoon boing, short, playful, no music" |
| LOW_G (8) | EIMER | Blech+Slosh | "Metal bucket clonk with wet slime slosh, cartoon, short, no music" |
| WILD (0) | TOPF/PFLANZE | Slime-Pop | "Big wet bubble pop with springy plant boing, cartoon, short, no music" |
| SCATTER (1) | GELDSACK | Cha-Ching | "Coin pouch shake and cha-ching with hay rustle, cartoon, short, no music" |

Integration (Code-Änderung, NACH Hör-Freigabe):
- `ReelSetAudioHooks.onWinStep(index, total)` → um `symbolId` erweitern (PixiApp-Tally übergibt
  `ordered[i].symbolId`), crackfarm-Boot mappt auf `quip-<id>` via `soundManager.play`.
- Quips ersetzen im Lines-Tally den Chime-Ladder (der bleibt Vice); Volume ~0,5, kein Rate-Pitch.
- Alle 9 Quips als Events registrieren ODER ein Event mit replaceSource pro Reveal — sauberer:
  eigene Event-IDs `quip-0..8` + OGG_FIRST.

## 5. SFX-FOLEY (eher ElevenLabs SFX / Aufnahme; Suno nur wenn's organisch klingt)

| Event (existiert, vol 0 o. Ersatz) | Design (Report 05-Spec) |
|---|---|
| `win-tally-tick` / `win-tally-end` | Holz-Block-Tick (kein Ton-Ladder!); End = Washboard-Zip + dumpfer Thud aufs Grid |
| `tease-riser` / `tease-miss` | Fiddle-Tremolo-Riser 1,5s (D-Drone); Miss = kurzes Wah-Wah + 650ms Stille |
| `wild-land` | Seed-Drop: Erd-Thud + Squelch (ersetzt Cash-Drop im crackfarm-Pack) |
| `wild-expand` | Ranken-Knarzen + Slime-Squelch aufsteigend, Slam-Akzent bei ~0,5s (Growth-Ende) |
| `roam-whoosh` (NEU) | Wind/Blätter-Whoosh ~2s für den Pflanzen-Glide, leises Lean-Kreischen |
| `scatter-land` | Münz-Klimpern im Sack + Stroh |
| `reel-stop` (Wood-Clatter) | BLEIBT — Noski-approved Gegenmodell zur leisen WS-Referenz |
| `coin-chime` | bleibt (Vice-Ladder), crackfarm nutzt künftig Quips |

## 6. Produktions-Pipeline

1. Suno generieren (mehrere Takes, beste wählen) → WAV/MP3 laden.
2. Konvertierung: `ffmpeg -i in.wav -c:a libvorbis -q:a 5 out.ogg` — Musik auf ~−14 LUFS,
   SFX-Peaks ~−6 dBFS; Loops: Schnitt auf Takt-Grenze (118 BPM = 2,034s/Takt), Crossfade-Check.
3. Ablage: erst `public/audio/_review/` → **Noski hört** → dann `public/audio/` bzw.
   `public/audio/crackfarm/` + OGG_FIRST-Einträge + Volumes setzen ([[feedback-audio-mp3-to-ogg]]).
4. Verify: jede Datei einmal im Preview abfeuern (soundManager.play), Console auf Decode-Fehler.

## 7. Prioritäten

- **P0:** ambient-music, fs-music, Ziegen-Mäh + Kuh + Schaf + Hund (die 4 Tier-Quips tragen den Humor), free-spin-trigger.
- **P1:** restliche Quips, win-small…mega, fs-intro/outro, multi-up, wild-land/expand.
- **P2:** tally-tick/end, tease-riser/miss, roam-whoosh, fs-outro-bed.

Referenz-Mix (Report 14 §6): Stops leise, WINS und FEATURES tragen den Mix — Quips und
Trigger-Jingle dürfen prominent sitzen, Musik-Bett ~0,35, Ducking beim Marquee wie gehabt.
