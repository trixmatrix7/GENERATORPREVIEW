# AUDIO-WORKFLOW — von Suno zum cleanen Slot-Mix (in Minuten, nicht Tagen)

Das Problem der letzten 5 Tage war NICHT Suno und NICHT die Sounds selbst —
es war die **fehlende Mastering-Stufe**. Rohe Generierungen (Suno/ElevenLabs)
kommen bei 0 dBFS Peak raus (volle Amplitude). Sobald zwei gleichzeitig
laufen, summiert der Browser sie über 0 dB → hartes digitales Clipping = **das
Kracken**. Rohmaterial → Master → Spiel. Diese drei Schritte, jedes Mal.

## Die 2 Schutzschichten (beide schon eingebaut)

1. **Master-Limiter im Spiel** (`src/audio/masterBus.ts`) — sitzt auf Howlers
   Master-Bus (Kompressor + tanh-Soft-Clipper). Bewiesen: 6 gleichzeitige
   0-dBFS-Quellen (+15 dBFS Summe) kommen bei −1,4 dBFS, 0 geclippte Samples
   raus. **Egal was du reinlädst, es kann nicht mehr krachen.** Läuft automatisch.
2. **Mastering-Pipeline** (`scripts/master-audio.sh`) — bringt jeden rohen
   Sound auf pegelrichtige Lautheit + True-Peak-Deckel, BEVOR er ins Spiel kommt.
   So greift der Limiter fast nie ein = der Mix bleibt punchy statt gequetscht.

## Schritt für Schritt (pro Slot)

### 1. Generieren (Suno / ElevenLabs)
Prompts + Rollen-/Key-Vorgaben stehen pro Slot im Research-Report
(Crack Farm = `research/slot-feel/17`). **Wichtig: EIN Root-Key pro Theme**
(Crack Farm = D-Dur @118 BPM) — dann docken alle Stinger an die Musik an.
Roh runterladen (WAV/MP3 egal), Peak ignorieren — die Pipeline regelt das.

### 2. Mastern (ein Befehl pro Sound)
```
scripts/master-audio.sh <rohdatei> <rolle> [ziel.ogg]
```
Rollen (Ziel-Lautheit / Deckel — das ist der ganze Trick):
| Rolle | für | Ziel |
|-------|-----|------|
| `music` | Base-/FS-Musikbett | −20 LUFS, −3 dBTP (sitzt UNTER den SFX) |
| `loop` | Spin-Bett (sehr leise) | −24 LUFS, −6 dBTP |
| `sfx` | reel-stop, wild-land, Klicks, Tier-Quips | Peak −4 dBTP |
| `stinger` | FS-Trigger, tier-up, Riser | −15 LUFS, −2 dBTP |
| `win` | win-small…mega, Marquee | −14 LUFS, −1,5 dBTP (die lauten Peaks) |

Ganzer Ordner auf einmal (Manifest = `datei<TAB>rolle` pro Zeile):
```
scripts/master-all.sh scripts/audio-manifest.tsv <rohordner> <zielordner>
```

### 3. Einspielen
- Gemasterte `.ogg` nach `public/audio/` (bzw. `public/audio/<theme>/`).
- Event in `src/audio/defaultSoundConfig.ts`: Volume setzen + **OGG_FIRST-Set
  ergänzen** (sonst SPA-Fallback-Decode-Tod — siehe Kommentar dort).
- Preview: einmal abspielen, Console auf „Decoding failed" prüfen. Fertig.

## Mix-Philosophie (warum es dann „ein Gesamtbild" wird)

- **Ein Root-Key** pro Theme → alles klingt zusammengehörig.
- **Betten leise (−20/−24), Wins laut (−14)** → Dynamik, nicht Dauerlärm.
- **Stops leise/kurz** → Wins und Features tragen den Mix (Ground-Truth aus
  den analysierten Top-Slots, Report 14 §6). Nicht jeder Sound muss laut sein.
- Der Limiter ist das Netz, nicht der Mix — wenn die Pipeline-Pegel stimmen,
  hörst du ihn nie arbeiten.

## A/B der bestehenden 2 Slots
Alle aktuellen Assets liegen gemastert in `public/audio/_remastered/`.
Anhören, und wenn besser, live schalten:
```
cp public/audio/_remastered/*.ogg public/audio/   # (Backup vorher: die Originale sind in git)
```
Dann build + deploy wie gewohnt.

## Wenn doch mal was „hart" klingt
- Zu laut/gequetscht → Rolle war zu heiß (win statt sfx?) → neu mastern.
- Zu leise → im `defaultSoundConfig` Volume hoch (nicht die Datei lauter mastern).
- Kracht IMMER noch → dann ist es KEIN Pegel-Problem, sondern die Quelle selbst
  hat Distortion drin (Suno-Artefakt) → neuen Take generieren.
