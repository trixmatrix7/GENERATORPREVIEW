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
- **Relocation-Lock: der Ghost VERSCHWINDET NICHT (2026-07-20):** kein Fade-out am Tanzende
  (Noski: "verschwindet kurz durchsichtig"). Er bleibt bei plantAlpha sichtbar auf dem Ziel-Reel
  stehen; das Ziel-Reel-Container wird auf `alpha 0` gesetzt (+ in `expandHiddenReels`), sodass
  nichts durchspint = fixiert, WÄHREND die anderen Reels droppen. `clearRoamGlide` entfernt den
  Ghost erst wenn der echte Turm reinpoppt → nie eine leere/durchsichtige Lücke.
- **Erst-Landung = echte Frame-by-Frame-GROW-Clip** (Crack Farm): der Wild wächst als Sheet-
  Animation (Spross→volle Fliegenfalle) statt Mask-Wipe über Static; friert nahtlos auf
  `wild_column.png` (= letzter Grow-Frame) ein, Bloom landet auf dem Lock-in-Slam (Bloom-Tempo
  25% langsamer via T_LOCK-Dehnung × 1.25, damit man das Aufgehen sieht). Nur bei Erst-Landung
  (nicht preGrown/Relocation). `ReelSet.setExpandGrowSheet`.
- **FS-Intro = 3 Pflanzen gehen auf (2026-07-20):** getierte Intro-Screens (fs3/fs4/fs5 = 0×/8×/32×
  Start) als plant-LOSE Hintergründe (die eingebackene Center-Pflanze per Field-Copy-Inpaint
  rausretuschiert), dann 3 Grow-Plants nebeneinander in `buildLayeredIntroScene` auf `bgRoot`
  (Design-Space x 660/960/1260, Boden y838), Center-out-Ripple, ~1.35s (langsamer als in-reel),
  via `setFsIntroGrowSheet`. Tier-Wahl `scatterCount>=5?'fs5':>=4?'fs4':'fs3'`. **Regel: baked-in-
  Assets IMMER plant-los machen bevor man Live-Grow-Overlays draufsetzt** (sonst Doppel-Pflanze).
- Badge sitzt am **Turm-BODEN**; **Debüt erst nach dem ersten beteiligten Win** (kein 1×-Badge).
- Upgrade: alte Zahl instant weg, neue spawnt klein+dimm über dem Slot, driftet ~0,12s rein,
  Pop ≤100ms; **nach einem Marquee verzögert**. Win-Plaque tickt live "base ×1…×N" (90ms/Step,
  max ~8 Steps, Badge pulst synchron), morpht dann ins Produkt.

**SCATTER-PAYS TUMBLER (Fruit Stacks, Report 18 + 15fps-Burst vermessen 2026-07-21):**
- Kaskaden-Wins ticken in eine **TOP-PLATE über dem Grid** (price-area-Art, ~250px, y=-58 im
  ReelSet-Space); Verlust-Spin = keine Plate.
- **Multi-Beat = Referenz-Anatomie:** Gift PULST → sein ×N löst sich, fliegt gebogen zur Plate
  (Stagger 160ms) → Plate liest "«win» ×«sum»" (Preis+Multi CONNECTED) → ~0,8s Hold → resolved
  zum Produkt (Pop). Pool-Wert reitet in die Summe (Referenz-Regel: Pool zählt nur wenn NEUES
  Gift droppt). FS: **Pool-Badge** (Gift-Icon + ×pool) rechts vom Grid, tickt NACH dem Beat hoch.
- **Winner-Removal = FRUIT-NINJA-CUT** (Noski-Wunsch): heller Slash in Zufallswinkel über die
  Zelle, Symbol splittet in 2 polygon-maskierte Hälften (rotierte Rect-Maske durch den Origin),
  fliegen entlang der Cut-Normalen auseinander + faden. Kein Scale-Pop mehr (nur Placeholder).
- Win-Screens = Layer-Set wie Vice (big/mega/epic/max/win/plate auf 1080p-Canvas ausgerichtet)
  → `setWinTierGeometry` mit Alpha-BBox-Messwerten PRO Theme (Fruit: plateCy 0.686, Vice 0.768
  — falsche Geo = Betrag sitzt neben der Plate).

- **Cluster = DROP, kein Reel-Spin (2026-07-22, Noski):** Fruit Stacks spinnt NICHT — Board
  fällt nach unten raus (`playFruitDropOut`, Spalten-Stagger), neues Board regnet von oben rein
  (`playFruitDropIn`, Spalte für Spalte l→r). **Tease = Slow-Drop:** ab 2 stehenden Scattern
  droppen die restlichen Spalten LANGSAM Symbol für Symbol (×2.6, Stagger 160ms). Keine
  Separatoren (Cluster-Look), Symbole 10% kleiner (SYMBOL_SIZE_MULS 0.9). Frozen Reel bleibt
  unberührt — Zellen werden per setSymbol normalisiert, Reels rollen nie.
- **Gift-Badges sind an die GIFTS GEPINNT:** der Math-Kern trackt Gift-Positionen durch jede
  Gravity (TumbleStep.cratesAfter); Badge-Render nutzt IMMER cratesAfter des aktuellen Steps
  (stale Landing-Cell = Badge hängt über fremdem Symbol — der Bug). Tier-Art am Gift selbst
  (silber ×2-5 / rot ×6-30 / gold ×31-500, Referenz-Stufen) via Display-Ids 11-13 + setSymbol.
  Verify: custom-math/verify_crate_ride.mjs (cratesAfter-Zelle muss id 0 auf boardAfter sein).

- **FEEL-Regeln (Noski 2026-07-22, "Gefühl reinbringen, nichts abgehackt"):** Atempausen sind
  Pflicht-Choreo: ~0,45s Ruhe nach Land vor dem ersten Burst, ~0,35s zwischen Kaskaden-Steps,
  ~0,45s bevor Gifts aufwachen, ~1,0s Hold auf "win ×N", ~0,5s nach dem Resolve. Winner-Removal
  = CHARGE (0,22s langsamer Swell) → BURST (Saft-Tropfen sprühen, Art platzt weg) — kein Slice,
  kein Hard-Cut. Win-Beträge: Display-Font (Poppins italic), weich einblühen, LANGSAM von den
  Symbolen WEGGLEITEN (1,5s) + clean ausfaden — nie statisch, nie snappen. Multi-Einschlag:
  Plate-Punch (elastic-scale 1,3 + Mini-Shake + weißer Flash) bei jeder ×N-Ankunft. Normal-Drop
  = ALLE Spalten GEMEINSAM, Reel 1 landet ~70ms vor Reel 2 (Mikro-Stagger); Landung = SQUASH IM SYMBOL:
  Art staucht beim Aufprall NACH UNTEN zusammen (scaleY ×0.84, leichter X-Bulge, y sinkt mit,
  damit der BODEN stehen bleibt), federt mit back.out(2.2) zurück — Position verlässt nie die
  Zelle. NIE Positions-Hop (las sich klein/laggy), NIE back.out-Overshoot beim Fallen (taucht
  unter die Zelle — beide 2026-07-22 von Noski verworfen); Slow-Walzen-Tease NUR im NACHDROPPEN ab 2
  stehenden Scattern (bleibt bei 3+ bis Spin-Ende). UI-Sounds dezent (uiSfx.ts, CC0-Picks).

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

## 1b. Tumbler-Timing = Winna-Ground-Truth (frame-vermessen 2026-07-22, 30fps, ±33ms)

Gemessen aus Noskis Winna-Trillion-Recording (12 saubere Spins, 56 Tumbles, Motion-Energy
pro Spalte; Rohdaten scratchpad/winna_analysis/timings.json). DIE Referenz für Fruit Stacks:

- **Drop-Out = EIN Board-Ereignis:** alle Spalten kollabieren SIMULTAN (Stagger-Median 0ms,
  p75 33ms!), Dauer ~400ms (Base) / ~733ms (tief im Bonus mit Stacks — bimodal). Spalten-
  Stagger beim Drop-Out ist FALSCH.
- **Refill-Fall 442ms** (p25 408 / p75 471) — 260ms liest sich als Teleport. Fallzeit = Gewicht.
- **Refill-Ankunft nicht uniform:** Spalten 1-3 fast zeitgleich (±1 Frame), nach rechts
  aufweitend; Gesamt-Spread col1→col6 200-400ms. Gleichmäßiger Spaltenversatz = Roboter.
  Implementiert als COL_DELAYS [0, .01, .03, .10, .19, .30]s.
- **Tumble-Collapse 333ms** (Win-Pop → Board-Minimum) — ein langer Charge-Swell (220ms) davor
  macht den Rhythmus zäh; Swell max ~100ms.
- **Tumble-Refill 500ms**, **Pause zwischen Tumbles 367ms**, **Pause Settle→erster Tumble 400ms**,
  **Autoplay-Kadenz ~3.6s** (inkl. Tally-Dwell).
- Methode wiederverwendbar: ffmpeg-Graustufen-Pipe → numpy Motion-Energy (Board + 6 Spalten-
  Strips) → Hysterese-Segmentierung → Phasen über Brightness-Dip (Leere-Signal). Scripts in
  scratchpad/winna_analysis/. **Bei jedem neuen Referenz-Video zuerst DIESE Messung, dann bauen.**

**Nachmessung 2026-07-23 (3-Agent-Sweep: Sizing / Pool-Feld / Flüge — alles eingebaut):**

- **Größen-Hierarchie:** normale Symbole füllen nur **0.65–0.80 der Zelle** (deutliche Luft,
  berühren sich nie); GIFT premium-groß (**1.12×** der Symbole); **SCATTER klar größer als
  ALLES: ~1.5×** der Symbole (W = 1.05×1.26 der ZELLE, ragt oben+unten raus). Scatter ≈
  symbol-groß liest sich als „nichts Besonderes".
- **Gift-×N:** Ziffern-Cap **~0.35 der Zellhöhe**, unten mittig ÜBER die Box-Unterkante gelegt
  (~60 % des Texts unter der Box). Font: fett-rundliche Ballon-Numerals AUFRECHT (Baloo 2
  ExtraBold = Match; NICHT italic, nicht Luckiest Guy), vertikaler Gold-Gradient hell→amber,
  rotbraune Outline + Drop-Shadow.
- **FS-Pool-Badge (rechte Rail):** Gesamt ~**⅓ der Grid-Höhe**, Zentrum ~123px (≈1.15 Zellen)
  rechts der Grid-Kante, Zentrum-y **0.55** der Grid-Höhe; Wert in Gold-Ring-Pill unterm Gift.
  **Tick: Zahl swappt HART** (nie Count-up), **nur der TEXT** poppt 1.4×→1.0 in ~350ms weich,
  Pill+Box statisch, **KEIN Weiß-Flash** — der „Flash" ist Stern-Burst + größerer Text.
- **Flüge:** BASE = 2 Phasen, erst **senkrecht hoch** (~2 Zellen, 300ms, beschleunigend), dann
  in ~200ms zur Plaque einbiegen; Peak-Scale ~1.6× in Flugmitte; Dauer distanzUNabhängig ~0.5s.
  FS = **direkt diagonal** zum Badge in ~300ms, wächst riesig (~2.4×), schrumpft in die Pill.
  Pool-APPLY am Spin-Ende: Charge ~200ms über der Pill → **Komet-Dash ~130ms** zur Plaque.
- **Beträge poppen, fliegen NIE:** Cluster-Betrag erscheint quasi instant in voller Größe,
  steht FIX (überlebt Collapse+Refill!), fadet ~270ms wenn der ×N-Flug startet. Plaque zeigt
  nur den BETRAG; Count-up nur beim Sammel-Tick (~700ms ease-out) und im Big-Win-Overlay —
  **Multiplikation ist IMMER Instant-Swap**, von Gold-Sternen kaschiert.

## 2. Architektur-Grenzen (verbindlich)

- **NIE anfassen:** src/engine/*, src/config/symbolAnimations.ts, src/game/Reel.ts (byte-identisch zum Dev-Repo).
- Pay-Model-Zweige über `activePayModel()` (src/game/winEval.ts-Façade) — Vice-Pfade bleiben
  byte-gleich, Crack-Farm-Verhalten nur im `'lines'`-Branch.
- Neue MATH-Profile in BEIDE Registries (mathProfiles.ts + activeMath.ts), sonst Desync.
- Präsentations-Mathe muss Settlement-Mathe exakt spiegeln (Mock + Sim + Display = eine Regel).

## 3. Crispy-HD-Regeln (Pixi, Reports 11 + 14-Lektionen)

- **mp4-Bake-Sheets: ERST auf Opazität prüfen, dann graden (2026-07-22, Vice-Scatter):** Sheets aus
  mp4-Captures können den Aufnahme-Hintergrund **voll opak** mitbringen (Vice-Scatter: dunkellila
  RGB≈30/16/49) — das liest sich in-game als „Verdunklungseffekt", obwohl das Symbol selbst farblich
  auf Parität ist. Plain-Mean-Gains sind dann bg-verseucht; mit der Static-Alpha maskiert messen.
  Fix-Rezept: Alpha = `max(fp_tight, band·dkey)` — enge Static-Footprint-Maske (Feather 2, KEIN
  Dilate: dilatierte Maske lässt einen dunklen Halo-Ring stehen) plus per-Frame Corner-gesampleter
  Distance-Key im Dilate-Band (Glow/Burst überlebt, Bg fliegt). Win-Sheets: `max(fp_tight, dkey)`
  frame-weit (Burst wandert). **Regrade auf f0 kalibrieren, nicht auf den Frame-Mittelwert** —
  Flash-Frames verschmutzen den Mittelwert; der Cross-Fade zur Static passiert bei f0, also muss f0
  auf Gain ≈1.0 landen (Vice: prem_b −27% Sättigung → sat×1.35 um Luma, koffer Blau-Lift → B×0.88).
  Verify: f0-Gain-Zahlen + Checker-Montage (Static | Sheet-f0) + Ring-Pixel-Count.
  [[sheet-from-mp4-grade-and-identity]]

- **Layered-Intro-Packs: Positionen IMMER aus dem Komposit messen (2026-07-23, Fruit-Stacks-Intro):**
  Künstler-Exporte einzelner Elemente kommen oft ZENTRIERT und übergroß (alle cx≈960) — die echten
  cx/cy/tw liefert nur das Komposit, per Diff gegen den Background (`|comp−bg|.sum(rgb)`). Fallen:
  (a) das Messband darf Nachbar-Elemente nicht überlappen (Grids links/rechts → tw clippt an die
  Bandkanten und wird ~2× zu breit); harter Threshold (>140) gegen Glow-Ausfransen. (b) Fehlt ein
  Layer als Solo-Export (linkes Grid), lässt er sich als Diff-Alpha aus dem Komposit freistellen.
  (c) Rollen nach Inhalt: Grids/Text-Tafeln = 'card' (STATISCH, Text darf nie warpen), Objekte =
  'symbol' (nur Y-Float, kein In-Place-Scale = bleibt scharf), Logo = 'logo' (Hero), CTA = 'press',
  Bokeh-Vollbild = 'coverbg'. Verify: Aspekt Quell-Crop ≈ Komposit-Box (±2%), dann 2×-Sample der
  Live-Sprites (dy/dsx/drot/da) — Cards müssen 0-Diff zeigen. Script: scratchpad/bake_fruit_intro.py.
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
- **Bildgen-Prompt-Regeln (Noski, hart, 2026-07-21):** NIE "casino"/"slot" im Prompt; NUR
  Design-Inhalt (kein "game"/"asset", keine Masse - Sizing macht Noski); Artstyle illustrated/
  gezeichnet: hand-drawn illustration + bold clean outlines + smooth cel shading + rich saturated
  colors + soft painterly highlights, identischer Wortlaut pro Set. [[feedback-higgsfield-prompt-rules]]
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
- **Land-Sheet-NAHTSTELLE: erster UND letzter Frame MÜSSEN exakt der Static sein** (2026-07-20,
  Noski: "buggt beim landing zwischen graue alte Symbol und Spritesheet, nicht sauber grade").
  Ein mp4-Land-Clip startet/endet NICHT in der Ruhepose (Kuh: Static = Zunge raus, Clip = Maul
  offen) → jede Übergabe Static-Icon↔Sheet ploppt (Pose- + Grau-Sprung). `AnimatedSymbol.
  startLandSheet` blendet das Icon aus und zeigt `sheet.frames[0]`, am Ende Icon wieder ein bei
  letztem Frame — beide Boundaries müssen daher pixelgleich zum Static sein. Fix ASSET-seitig
  (Reel.ts ist frozen): Static-PNG (`symbol_X_landing.png` == das Ruhe-Icon) in **Frame 0 und
  Frame N-1** compositen, Zelle vorher auf transparent löschen; Frame 1 + Frame N-2 als 50%
  Cross-Dissolve Static↔Movement, damit die Bewegung nicht hart aus dem Static springt. Ergebnis:
  Static → f0(=Static) → Bewegung → f(N-1)(=Static) → Static, NAHTLOS. Bewegung startet ~1 Frame
  (@16fps ~60ms) nach Reel-Drop = "direkt am Landen". Verify: Montage STATIC|f0|f1|f2|…|f(N-1)
  bauen — f0 und f(N-1) müssen identisch zum STATIC sein, Farbe über alle Frames konstant.
  NICHT 0,1,N-2,N-1 alle mit Static überschreiben (das fror die Bewegung ~125ms ein).
- **Frosted-Reel-Pane ist theme-abhängig** (`PixiApp.setReelFrosted`): das geblurte BG-Duplikat
  hinter den Symbolen passt zu dunklen Neon-Themes (Vice); bei hellen/warmen BGs scheint es
  durch transparente Symbol-Ecken als milchig-weißer Schleier — für solche Themes AUS.

- **Neue Symbol-IDs (>9) NIE in die SymbolId-Union** (2026-07-21, Fruit Stacks 9-Pay-Umbau):
  das FROZEN symbolAnimations.ts enumeriert `Record<SymbolIdType, ...>` EXHAUSTIV — Union
  erweitern = Typbruch im Frozen File. Muster: `export const FRUIT_LOW_I = 10 as SymbolIdType`
  + Registry-Eintrag via Cast `(SYMBOLS as Record<number, SymbolDef>)[10] = {...}` in symbols.ts
  (nicht frozen). AnimatedSymbol ist safe (SYMBOL_ANIMATIONS[id]?.states optional-chained);
  id 9 (COIN) ist als Pay-Symbol nutzbar solange der Pay-Model-Branch die Engine-COIN-Pfade
  (Hold&Win) umgeht.

## 3b. Buy-/Ante-Math-Regeln (2026-07-22, Vice-Zertifizierung)

- **Buy-Preise folgen dem EV, nie dem Industriestandard:** „100× für 3sc" passt nur, wenn die
  3sc-Runde Ø ~96× zahlt. Vice: 3sc häufig+klein (1-in-67, Ø22×) → fairer Preis 24×; 4sc
  selten+riesig (1-in-922, Ø281×) → 295×. IMMER forced Rounds simulieren (200k+), nie schätzen.
- **Forced-Board-EV gehört in den Buy-Preis:** Wenn der Kauf echte Scatter aufs Board zwingt und
  Display==Payout gilt, wird das Board voll ausgewertet (Scatter-Pay + zufällige Linien-Wins ≈
  0.95×/1.38× bei 3/4 Scattern) — separat messen (Fenster konditioniert!) und addieren.
- **Scatter-Dichte wirkt ~KUBISCH auf die Trigger-Chance** (3-aus-5): Strips-Scatter ×3 ⇒ Trigger
  ×17, nicht ×3. Für „3× FS-Chance": +1 Scatter auf 3 von 5 Strips ⇒ ×3.47 bei 1-in-18; Ante-Kosten
  aus Voll-Sim (Base-Pays sinken leicht durch ersetzte Lows, FS-Retrigger steigen mit).
- **Buy-Präsentation = natürlicher Trigger:** Stops deterministisch zwingen (Scatter-Reel: nächstes
  Fenster mit EXAKT 1 Scatter; Rest: scatter-frei), Settlement kodiert finale Stops → die normale
  Landing-Choreo (2 landen → Tease → Rest) läuft von selbst, kein Sonder-Pfad.

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
- **Sound-Kuration OHNE Ohren = MESSEN (2026-07-22, Ultra-Clean-Preset):** ffmpeg→f32-Decode,
  dann pro Kandidat Attack-Zeit (bis 85% Peak), Dauer, Peak/RMS dBFS, Spektral-Centroid
  (Helligkeit), Tail-Energie (letzte 30%) — "clean" = kurzer Attack, null Tail, moderater
  Centroid, leiser RMS. Pro Event-Rolle eigene Ziel-Fenster (Pop hell+kurz, Thud dumpf+kurz,
  Riser leise+lang). Script: scratchpad analyze_lib.py; Presets in src/audio/soundPresets.ts
  (Anwendung = replaceSource + setEventOverride → persistiert + einzeln nachtweakbar).
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
- **`__pixi` ist ein HANDLE-OBJEKT, NICHT die PixiApp-Instanz (2026-07-21):** `Object.
  getPrototypeOf(window.__pixi)` = Object.prototype — App-Methoden-Hooks darauf greifen ins
  Leere (und verschmutzen Object.prototype). Runtime-Hooks IMMER über echte Klassen-Prototypen
  der Felder setzen: `Object.getPrototypeOf(__pixi.reelSet)` = ReelSet.prototype funktioniert.
  Verifiziert beim Fruit-Stacks-Tumble-Verify (playTumbleStep-Hook lieferte, resolveTumble-Hook
  auf dem Handle nicht).
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

- Reports 14 (Wild Storm), 15 (Ways ×10), 16 (Paylines cross-studio), 18 (Fruit Stacks /
  Winna-Trillion 6×5-Scatter-Pays-Tumbler Ground Truth) = FERTIG & vermessen. Fruit-Stacks-
  Bau-Regeln: Tumble NUR im Non-Frozen-Layer orchestrieren (PixiApp.resolve-Loop +
  ReelSet-Cascade-Methode via getVisibleBoard/setSymbol; FS-Sub-Spin-Loop = Präzedenz);
  frozen uint8[5]-Decode via Decode-Façade in useGameState.ts umgehen (Hold&Win-Re-Enactment-
  Muster); Theme-Prompts `design/fruit-stacks/HIGGSFIELD_PROMPTS.md`.
- Offene Präsentations-Deltas (nach Noski-Freigabe, Report 16 §3): P6 grüner Slime-Beam
  (Crack Farm), P3 Winner-Wiggle, P1/D4 Label-Stacking, P2 Beam<Label-Entkopplung, P5
  Deferred-Badge-Reveal am Stop. Vice-Ways-Deltas W1–W5 (Report 15 §6) — nur mit Go, weil
  sie vom Original-Generator-Look abweichen.
- Audio: Suno-Plan Report 17 (Key D @118, Tier-Quips, Review-Ordner). Conductor + Key-
  Disziplin (05/07) weiter P1.
- D9 (Marquee-Feintiming) aus Report 14 §8.
