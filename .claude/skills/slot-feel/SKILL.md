---
name: slot-feel
description: Das lebende Slot-Gefühl-Regelwerk dieses Repos. IMMER laden bei Arbeit an Slot-Präsentation, Animationen, Win-Choreografie, Audio, Schärfe/HD, Features oder neuen Games — enthält die destillierten Bau-Regeln aus der Video-Ground-Truth-Forschung (research/slot-feel/) und die verbindlichen Engineering-Lektionen.
---

# Slot-Feel — das lebende Regelwerk

Destillat aus `research/slot-feel/00-16` (Studio-Formeln, vermessene Video-Ground-Truth).
**Tiefe & Belege:** immer die Reports lesen — dieser Skill trägt nur die verbindlichen Regeln.

## 0. So wächst dieser Skill (Pflicht-Protokoll)

1. **Research first (Noski-Arbeitsregel):** Vor JEDEM Feature erst research/slot-feel/ checken;
   fehlt das Thema → Video-/Web-Recherche, Findings als NEU NUMMERIERTER Report ablegen.
2. **JEDER Fortschritt bei EGAL WAS gehört HIER rein (Noski-Regel 2026-07-20, hart):** nicht nur
   vermessene Research — auch jede Noski-Korrektur, jeder Look-/Crispiness-/Animations-/
   Engineering-Fortschritt, jeder Fix. Sofort als kurze Regel ergänzen, mit Verweis auf Report
   ODER `[[memory]]` ODER `file.ts:zeile`. Der Skill ist die lebende Summe von ALLEM, was wir
   gelernt haben — wenn etwas besser wurde, steht das WARUM/WIE hier, sonst geht es wieder verloren.
3. Video-Analyse-Methode: research/tools/analyze_slot_video.py (Audio-Onsets + Reel-Motion)
   + Frame-Sweep 1-2fps + gezielte 10-30fps-Bursts auf jede Unklarheit. Nie schätzen — messen.

## 1. Präsentations-Konventionen (vermessen, Report 14 = Wild Storm Ground Truth)

**PAYLINES — ZWEI Familien (Report 16):** BEAM (Colorful Play/Stakelogic — Wild Storm, Savage
Santa: edge-to-edge Beam durch Zell-Mitten, Beam-Leben ~0,35s < Label, Nicht-Gewinner dimmen,
Gewinner recolor+wiggle+1,2×, Betrag auf der Linie; Beam-FARBE = Theme, Anatomie = Signatur)
vs NO-LINE (Pragmatic — Dog House, Big Bass: KEIN Strich, Gewinner pulsen in place, KEIN Dim,
Betrag NUR als Bottom-HUD-Formel „LINIE n ZAHLT base × mult = total"). **Crack Farm = BEAM.**

**PAYLINES (Crack Farm, Familie BEAM):**
- Nach letztem Stop **~0,5s STILLE** (Board hell, nichts bewegt sich), dann Präsentation.
- Linien **einzeln nacheinander** (0,5–1,2s/Linie), NIE alle auf einmal, **EIN Durchlauf, kein Loop**;
  danach Coin-Ceremony und **neutrale Ruhe** (kein All-Lit-Reststand — das liest sich als "ways").
- Beam = voller Payline-Pfad **edge-to-edge über ALLE 5 Reels** durch Zell-Mitten (auch
  nicht-zahlende), gerade Reihen schnurgerade, Zickzack als weiche Sinus-Bögen; ~0,2s Draw,
  ~0,5s Lebensdauer (Base ohne Comet-Kopf, FS mit).
- Gewinner: Backlight-Glow-Burst (additiv HINTER dem Symbol — NIE Brightness-Filter, s. §3),
  leichte Vergrößerung, Betrag als **freier Bold-Text mit Outline OHNE Kasten** auf der Linie.
- Nicht-Gewinner dimmen 40–50% — auch frühere Gewinner, die auf der aktuellen Linie nicht liegen.
- Verlust-Spin: **absolut nichts** (keine Präsentation, direkt Idle).

**Multiplikator-Türme (Roaming/Sticky, Report 14 §3):**
- **Relocation = aufrechter Tanz ÜBER die Reels (2026-07-20 Noski-Korrektur, ref `wild storm .mov`;
  ERSETZT das alte "Lean 15-20°"):** der Plant/Tornado-Ghost bleibt **DEAD VERTIKAL und EBEN** —
  KEIN Kippen/Lean, KEIN vertikaler Bogen. Er wischt links↔rechts über die Reels (Route: äußeres
  Reel → anderes äußeres → Ziel), Speed NUR über horizontale Squash-Stretch, weiche `power3.out`-
  Landung OHNE Overshoot, dann steht er still. Übergabe via `glideArrival` → preGrown-Park mit
  cleanem `back.out(1.6)`-Grow (nicht springy). Kein Teleport, kein Neu-Wachsen. Das alte
  Lean+Overshoot+Snap-back las sich für Noski "unclean". [[crackfarm-plant-relocation-dance]]
- **Erst-Landung = echte Frame-by-Frame-GROW-Clip** (Crack Farm): der Wild wächst als Sheet-
  Animation (Spross→volle Fliegenfalle) statt Mask-Wipe über Static; friert nahtlos auf
  `wild_column.png` (= letzter Grow-Frame) ein, Bloom landet auf dem Lock-in-Slam. Nur bei
  Erst-Landung (nicht preGrown/Relocation). `ReelSet.setExpandGrowSheet`.
- Badge sitzt am **Turm-BODEN**; **Debüt erst nach dem ersten beteiligten Win** (kein 1×-Badge).
- Upgrade: alte Zahl instant weg, neue spawnt klein+dimm über dem Slot, driftet ~0,12s rein,
  Pop ≤100ms; **nach einem Marquee verzögert**. Win-Plaque tickt live "base ×1…×N" (90ms/Step,
  max ~8 Steps, Badge pulst synchron), morpht dann ins Produkt.

**Spin/Stop:**
- Stop = **100–150ms Blur-Auflösung → harter Dead-Lock. KEIN Bounce, keine Feder.**
- Stagger links→rechts ~400ms (WS) / bei uns 150ms-Basis + Tease-Verlängerung.
- Einsatz-Abzug als animierter Balance-Tick-down während des Spins.

**Marquee (Big Win):** Szene+HUD dimmen fast schwarz → ~0,5s wortloser Licht-Burst → Tier-Wort +
Tally **ease-out ~2,2s, landet EXAKT** (kein Overshoot) → ~0,6s Hold → Auto-Exit gesamt ~3,5s.
GESAMTGEWINN wird still hinter dem Marquee verrechnet.

**WAYS (Vice) — Invarianten aus 10 vermessenen Games (Report 15):**
- **NIE Linien/Beams/Comets** — Verbindung nur über Zell-Betonung (Rim/Frame/Glow-Wash) + Dim.
- Betrag = **COUNT-UP** (tickt 0→Endwert, ~1–2s, beschleunigend), nie statisch; „N WAYS"-Zähler.
- Zwei Familien: Per-Kind-Sequenz (0,6–1,0s/Kind, Betrag am Cluster) oder All-at-once-Slam
  (alle Kinds simultan + Center-Total). EIN Durchlauf, kein Loop; Gewinner-Art nie weiß recolort.
- Vice = Familie A (Immersive-Dance + Dim + sequentielle Kinds) — Basis stimmt; offene
  Deltas W1–W5 in Report 15 §6 (Center-Count-up, Rim-Glow, Stretch-Smear-Stop).

## 2. Architektur-Grenzen (verbindlich)

- **NIE anfassen:** src/engine/*, src/config/symbolAnimations.ts, src/game/Reel.ts (byte-identisch zum Dev-Repo).
- Pay-Model-Zweige über `activePayModel()` (src/game/winEval.ts-Façade) — Vice-Pfade bleiben
  byte-gleich, Crack-Farm-Verhalten nur im `'lines'`-Branch.
- Neue MATH-Profile in BEIDE Registries (mathProfiles.ts + activeMath.ts), sonst Desync.
- Präsentations-Mathe muss Settlement-Mathe exakt spiegeln (Mock + Sim + Display = eine Regel).

## 3. Crispy-HD-Regeln (Pixi, Reports 11 + 14-Lektionen)

- **Renderer-Resolution FLOOR 2, nicht nur Cap (2026-07-20, DER Crispiness-Durchbruch):** DPR-1-
  Monitore (Preview-Pane meldet `devicePixelRatio===1`) samplen sonst die weiche **128²-Mip** von
  512²-Art in ~110-126px-Zellen (≈4× Minification) → matt/blurry; das Maskottchen wirkt nur scharf,
  weil es nahe 1:1 rendert (320²→267px). Fix: `resolution: Math.max(2, Math.min(dpr,2))` in
  `PixiApp.init` → supersampled global (Backing = 2× CSS-Box, Browser boxt runter) → Symbole lösen
  aus der 256²-Mip = knackscharf bei jedem DPR. Cap bleibt 2 (Fill-Rate). Global → hilft Vice mit.
  Diagnose: `__pixi.app.renderer.resolution` + Sprite `texture.source.width` vs gerendertes `width`.
  [[pixi-sharpness-resolution-floor]]
- **`extract.pixels` rendert in Renderer-Resolution** (Falle beim Floor 2): Rückgabe-`width/height`
  sind `resolution×` der Textur-Logik. Layout-Mathe die darauf rechnet (z.B. `setFrameImage`
  Alpha-Fenster-Erkennung des Barn-Rahmens) MUSS mit `kx=tex.width/tw, ky=tex.height/th` zurück in
  Textur-Logik-Space normieren — sonst kommt das Fenster 2× zu breit raus, sx halbiert, Rahmen
  schrumpft auf halbe Größe ("Rahmen verschoben"). No-op bei Resolution 1.
- **nie über Author-Größe skalieren** (Art in 2× Displaygröße authoren).
- Heavy-Downscale-Einzeltexturen: mipmaps + maxAnisotropy 8 + source.update().
- **Atlas-Frames können NICHT mipmappen (Bleed)** → Symbol-Sheets beim Laden in EINZELNE
  Canvas-Texturen slicen (`PixiApp.sliceSheetHD`), dann mipmaps+aniso pro Frame. Downscale
  ohne Mipmaps = Alias-Flimmern in Bewegung ("pixelig").
- **Filter-Default GLOBAL auf `Filter.defaultOptions.resolution = 'inherit'` setzen (2026-07-20,
  direkt nach `app.init`):** Pixis Default ist `resolution: 1` → JEDER Filter ohne eigene Resolution
  (u.a. der Reel-SPIN-BLUR im FROZEN `Reel.ts`, der seinen BlurFilter ohne Resolution baut) rendert
  auf der Floor-2-Szene mit HALBER Dichte → Symbole bleiben bis zum Landen-Snap weich ("alter Blur-
  Look kurz vorm Landen", Noski). Global auf 'inherit' → der eingefrorene Reel-Blur erbt volle Res
  OHNE Reel.ts anzufassen; die absetzenden Symbole bleiben scharf, nur der Motion-Blur (strengthY→0)
  faded. Verify: Spin auslösen, `reels[0].container.filters[0].resolution === 'inherit'`.
- **Filter auf Zellen/Symbolen: grundsätzlich vermeiden.** Wenn unvermeidbar: `resolution:
  'inherit'` + `antialias: 'inherit'` (Default-Resolution 1 halbiert auf DPR-2 die Dichte).
  Brightness-Filter BLEICHEN die Art (blasser Matt-Film) — Emphase stattdessen als additives
  Licht HINTER dem Symbol (Backlight-Burst) oder echte Art-Varianten.
- Charakter-Sheets: HD authoren (Frame ≥ Displaygröße), >4096px in mehrere Sheets splitten.
- **mp4-gebackene Symbol-Sheets DRIFTEN farblich (2026-07-20, Noski: "kein Kontrast, Farbe nicht
  gleich"):** H.264 + Chroma-Key macht Win-/Land-Sheets ~30-40% entsättigt, kontrastärmer, mit
  Blau-/Magenta-Stich vs die statischen PNG-Bakes. Fix: pro Sheet ein per-Kanal-(Mean,Std)-
  Transfer vom RUHENDEN letzten Frame → Static, auf ALLE Frames anwenden (Ruhepose matcht Static,
  Animation weicht natürlich ab); + Despill (`B=min(B,G)`) + Edge-Bleed gegen Magenta-Rand. Eine
  ANDERE Pose (z.B. Wild-Win = Blüte statt Topf-Static) NUR sanft nachsättigen, nie mean-matchen.
  **Und Identität prüfen:** mp4-Symbolreihenfolge ≠ Static-Bake-Reihenfolge → mid_c/mid_d waren
  vertauscht (Hund↔Schaf). Beim Sheet-Adden IMMER Static vs Sheet pro Symbol montieren. Verify:
  PNG in-page fetchen + Opak-Pixel-Sättigung/Luminanz messen (extract.pixels ist auf WebGL schwarz).
  [[sheet-from-mp4-grade-and-identity]]
- **Frosted-Reel-Pane ist theme-abhängig** (`PixiApp.setReelFrosted`): das geblurte BG-Duplikat
  hinter den Symbolen passt zu dunklen Neon-Themes (Vice); bei hellen/warmen BGs scheint es
  durch transparente Symbol-Ecken als milchig-weißer Schleier — für solche Themes AUS.

## 4. Audio-Regeln (hart, zweimal gelernt)

- **DAS KRACKEN = CLIPPING durch 0-dBFS-Assets** (2026-07-18 diagnostiziert): jede Roh-
  Generierung (Suno/ElevenLabs) peakt bei 0 dBFS; überlappende Sounds summieren über 0 dB →
  hartes digitales Clipping. Zwei Schutzschichten EINGEBAUT: (1) Master-Bus-Limiter
  `src/audio/masterBus.ts` (Kompressor + tanh-Soft-Clipper auf Howlers masterGain, via
  `ensureMasterBus()` in SoundManager.play() lazy installiert; bewiesen: +15 dBFS Summe →
  −1,4 dBFS, 0 Clips) — reine Infra, RISIKOFREI, darf live ohne Hör-Freigabe. (2) Mastering-
  Pipeline `scripts/master-audio.sh` + `master-all.sh` (rollen-Ziel-LUFS + True-Peak-Deckel:
  music −20, loop −24, sfx Peak −4, stinger −15, win −14 dBTP). **Kompletter Workflow:
  `scripts/AUDIO-WORKFLOW.md`.** Roh generieren → mastern → einspielen (+OGG_FIRST). Der
  Limiter greift dann fast nie = Mix bleibt punchy.
- **KEINE selbst erzeugten Sounds. Punkt.** (3× bestätigt, zuletzt 2026-07-18: "deine sounds
  sind alle kacke, läuft mir kalt übern rücken".) Weder scipy-Foley noch Synthese noch
  "ich bau das schnell selbst" ANBIETEN. Nur Sounds, die Noski liefert, gehen live.
  **Fehlt ein Sound → Volume 0 (Stille), nicht Platzhalter.** Auch kein Fallback-Chime für
  Events ohne Aufnahme. `SoundManager.setEventVolume(id, 0)` ist das Werkzeug dafür.
- **Suno ≠ SFX.** Suno ist ein MUSIK-Modell: für Musikbetten stark (Sunny Farm Groove sitzt),
  für isoliertes Foley strukturell schwach. Lange "Studio-Prosa"-Prompts machen es SCHLECHTER —
  kurze, konkrete Klangbeschreibungen + harte Negative (`no music, no melody, no instruments,
  no drums`) funktionieren. Für Foley/Tierlaute sind echte Samples (Freesound) oder ein
  SFX-Modell der richtige Weg — NICHT ich.
- **Lange Takes sind gut:** `scripts/extract-sfx.py <clip> <outdir>` findet in einem 20-30s-Take
  alle Events, bewertet sie (Peak/Attack/Abstand/Clipping) und exportiert die besten Kandidaten.
  Noski soll NICHT selbst schneiden — er liefert den Rohtake, ich extrahiere.
- Reines Re-Mastering von PEGELN (Lautheit/True-Peak) ändert den Klang-Charakter nicht und ist erlaubt.
- Jeder MP3-Drop → .ogg + OGG_FIRST-Eintrag (defaultSoundConfig), sonst SPA-Fallback-Decode-Tod.
- Mix-Referenz WS: Stops fast unhörbar, Wins/Features tragen. Unser Wood-Clatter ist eine
  bewusste Gegenentscheidung (Noski-approved) — nicht "korrigieren".
- Sound-Spezifikationen für echte Drops: research/slot-feel/05.
- **Crack-Farm-Produktionsplan (Suno): research/slot-feel/17** — Key D-Dur @118 BPM für ALLES
  Tonale, Tier-Quips pro Symbol-Connection, Review-Ordner `public/audio/_review/` vor Freigabe,
  Marquee-Musik bleibt universal (nie themen).

## 5. Verify-Muster (Browser-Pane, verbindlich vor jedem Commit)

- `window.__pixi` (dev-only) treibt PixiApp deterministisch; TS-private = runtime-public.
- **EINE Instanz-Referenz pro Test-Closure** — `window.__pixi` kann zwischen JS-Calls remounten!
- Sampler-Interval auf Runtime-Felder (revealCombo wrappen, getBounds, texture.uid) statt
  Screenshots vertrauen (stale-Screenshot-Macke); document.hidden vor fps-Messungen prüfen.
- Vite serviert TS: `await import('/src/game/xy.ts')` für In-Page-Modulzugriff/Unit-Tests.
- Hidden-Pane-Hänger: Node-Prozesse killen, frischer preview_start, neuer Tab.

## 6. Workflow pro Feature (Kurz-Checkliste)

1. DB checken (research/slot-feel/README) → ggf. neue Recherche + Report.
2. Bauen im richtigen Branch (lines/ways getrennt, Engine frozen).
3. Verifizieren (Pattern §5, numerisch + Screenshot), Console-Errors = 0.
4. `npx vite build` → Commit (Trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`)
   → `npx vercel build --prod` + `npx vercel deploy --prebuilt --prod --yes` → Live-Hash-Check
   (`curl -s https://generatorpr.vercel.app | grep -o 'assets/index-[^"]*\.js'` vs dist/index.html).
5. Neue Erkenntnis? → Report + DIESEN Skill ergänzen (§0).

## 7. Offene Referenz-Themen

- Reports 14 (Wild Storm), 15 (Ways ×10), 16 (Paylines cross-studio) = FERTIG & vermessen.
- Offene Präsentations-Deltas (nach Noski-Freigabe, Report 16 §3): P6 grüner Slime-Beam
  (Crack Farm), P3 Winner-Wiggle, P1/D4 Label-Stacking, P2 Beam<Label-Entkopplung, P5
  Deferred-Badge-Reveal am Stop. Vice-Ways-Deltas W1–W5 (Report 15 §6) — nur mit Go, weil
  sie vom Original-Generator-Look abweichen.
- Audio: Suno-Plan Report 17 (Key D @118, Tier-Quips, Review-Ordner). Conductor + Key-
  Disziplin (05/07) weiter P1.
- D9 (Marquee-Feintiming) aus Report 14 §8.
