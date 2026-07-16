# 14 — Wild Storm (Stakelogic) VIDEO GROUND TRUTH — 5×3 Referenz-Vermessung

Quelle: Noskis Screen-Recording `wild storm .mov` (2114×1178 @60fps, 197s, Stake-Wrapper, Demo-Mode).
Methode: Audio-Onset-Analyse (spectral flux, normalisiert) + per-Reel-Motion-Diff (30fps)
+ 7-Segment-Frame-Katalog (2fps) + gezielte 10–30fps-Bursts auf jede Unklarheit.
Alle Zeiten gemessen, nicht geschätzt. **Das ist unsere 5×3-Referenz für Crack Farm.**

## 1. Spin-Gefühl (Base)

- Reels rollen ABWÄRTS mit starkem vertikalen Motion-Blur (Symbole als Farbstreifen erkennbar).
- Press → Reel 1 Stop: ~0,6–0,7s. Stop-Stagger strikt links→rechts **~400ms/Reel**.
  Press → letzter Stop: **~2,4–2,8s** (ohne Turbo).
- **Stop = KEIN Bounce.** Gemessen @30fps: Blur löst sich über ~100–150ms in lesbare Symbole auf
  (ein einziger Sub-Cell-Übergangsframe, Symbole ~20–25% Zelle vor Endposition),
  dann harter Dead-Lock. Null Feder, null Zurückschwingen.
  (Der „Overshoot-Settle" aus 10fps-Sicht war nur der letzte Sub-Cell-Frame.)
- Einsatzabzug = animierter Balance-Tick-DOWN während des Spins (2 Steps).
- **Verlust-Spin: absolut nichts.** Kein GEWINN-Feld, keine Präsentation, direkt Idle, Controls ~1s nach letztem Stop.
- Spin-Button wird rotes STOP-Quadrat; Buy-Button + Einsatz-Stepper dimmen während des Spins.

## 2. Win-Präsentation (DER Kernbefund)

### Base, eine Linie (komplett vermessen @10fps, 19.4–21.4s)
1. Letzter Stop → **~0,65s STILLE-PAUSE** (Board hell, nichts passiert).
2. Dann SIMULTAN: Board dimmt ~50% · cyan ~4px-Linie beginnt links→rechts zu zeichnen ·
   Betrag-Text sitzt bereits AUF der Linie · HUD-GEWINN tickt (fast instant, ~0,1s).
3. Linie voll gezeichnet **edge-to-edge über ALLE 5 Reels** in ~0,15–0,2s — durch Symbol-MITTEN,
   auch über nicht-zahlende Reels hinweg (volle Payline-Form!). Gerade Reihen = schnurgerade,
   Zickzack = weiche Sinus-Kurven mit runden Ecken. Base: schlichter Strich OHNE Comet-Kopf.
4. Gewinner-Symbole recoloren **0,1–0,2s NACH Linien-Ende** auf helle WEISS-Variante
   (dediziertes Highlight-Recolor, nicht nur Brightness) und **wackeln/rocken** (Rotation oszilliert).
5. Linie radiert sich links→rechts wieder aus: **Strich-Lebensdauer ~0,5s**.
6. Betrag-Text überlebt die Linie (~1,0s), Weiß-Recolor fadet ~0,8s, Dim weg nach ~1,2s.
7. **Gesamte Präsentation ~1,25s, EIN Durchlauf, kein Loop.** Danach Balance-Tally hoch (~0,7s), Ruhezustand = neutral.

### Multi-Linie (FS, mehrfach beobachtet)
- **Sequentieller Linie-für-Linie-Zyklus, NIE alle auf einmal, KEINE All-Winners-Phase.**
- Kadenz **~0,5–1,2s pro Linie** (schneller ohne Multi-Tick, länger mit).
- Start ~0,4–0,9s nach letztem Stop.
- Im FS hat der Linien-Beam einen **Comet-Kopf mit Trail** (~0,4–0,6s Durchlauf); Base = Strich ohne Kopf.
- Nicht-Gewinner dimmen 40–50% — auch Symbole, die auf einer FRÜHEREN Linie gewonnen haben,
  aber nicht auf der aktuellen liegen.
- Gewinner: juiced Variante (weiß/eis-blau ODER symbol-eigenes Juice: J wird molten-orange
  mit Goo-Drips, Tomate glossy), **~1,2× vergrößert** (überlappt Nachbarn), animiert
  (Gießkanne kippt + gießt).
- **Betrag-Plaque = freier Bold-Text mit dunklem Outline, KEIN Kasten/Panel**, sitzt auf/über der
  Linie beim linkesten Gewinner. Fertige Linien-Beträge **BLEIBEN STEHEN (stapeln sich)**,
  während spätere Linien spielen.
- HUD-GEWINN tickt KONTINUIERLICH über alle Linien; GESAMTGEWINN zählt live mit (FS).
- Durchlauf endet neutral (bzw. mündet in Marquee); **kein Endlos-Loop beobachtet.**

### Mit Tower-Multiplikator (FS)
- Plaque zeigt Basis-Betrag + orangenes „xN"-Suffix, das **live 1-um-1 hochtickt** bis zum
  Badge-Wert (x1→x2… / x6→x16→x32, ~0,4–0,6s), Badge pulst dabei vergrößert+glühend,
  Gewinner flashen white-hot; danach morpht die Plaque in das **Produkt und zählt hoch**
  (0,50 x8 → 4,00). HUD synchron.

## 3. Tornado-Wild-Tower (= unser Plant-Pendant)

- **Erste Landung:** Tower fällt als reel-hoher Block MIT dem Reel ein ODER Slab landet im Strip
  und der Funnel wächst in-place in ~0,4–0,5s heraus (mit Debris). **Noch OHNE Badge!**
- **Badge erscheint erst nach dem ersten Win mit Tower-Beteiligung** (poppt klein→voll, ~0,3s).
- **Roaming (Kern-Choreo, @10fps vermessen):** Beim Spin-Start hebt der Tower ab und **gleitet
  KONTINUIERLICH** (kein Hüpfen) über die blurrenden Reels — Peak **~5 Reels/s**, volle
  Sweep-Strecke rechts+zurück in **~2,3s**, parkt dann auf dem neuen (zufälligen) Reel.
  Dabei: Funnel **poppt 1,3–1,5× aus dem Panel heraus** (überragt die Ränder), **lehnt sich
  15–20° in Fahrtrichtung**, Panel bleibt vertikal/ungestaucht, Badge klebt am unteren
  Drittel und fährt mit. Tower rendert ÜBER den laufenden Reels; Funnel tuckt sich erst
  ~1s nach dem Parken wieder ein.
- **Multi-Verdopplung** nach jedem Spin mit Tower-Win: 2→4→8→16→32→64… (bis 1024×).
  **Upgrade-Choreo:** alte Zahl verschwindet INSTANT, neue spawnt klein+dimm ~halbe Zelle
  ÜBER dem Slot, driftet in ~0,1s runter in den Slot, dann **Pop auf volle Größe ≤100ms**.
  Gesamt ~0,2–0,25s. **Läuft ein Marquee, wird das Upgrade bis NACH dem Marquee verzögert.**
- Zweiter Tower kann landen (badge-los = 1×); beide roamen danach gleichzeitig, können sich kreuzen.

## 4. Scatter / Retrigger / Screens

- Scatter (Sturmwolke+Blitz+BONUS): landet VERGRÖSSERT (überragt Zelle). 3. Scatter:
  white Scale-up-Flash über den Rahmen hinaus, dann pulsen alle drei.
- Übergang: riesige Cartoon-Wolke wischt über den Screen → Intro-Karte (8 FREE SPINS,
  „Zum Fortfahren drücken") ~3s → FS-Board mit Regen über den Reels.
- **Retrigger: 1 Scatter = +1 FS — Zähler tickt hoch IN DEM MOMENT wo er landet (noch bevor
  Reel 5 steht!)**, Wolke pufft ~1,3×, „+1 FS"-Gradient-Text schwebt ~1s hoch. Kein Screen.
- FS-Outro: Fullscreen TOTAL WIN, Gold-Tally ~1,5s, Klick zum Schließen.

## 5. Big-Win-Marquee (NICE @ 16×, komplett vermessen)

- Szene INKL. HUD dimmt fast schwarz; grüner Radial-Burst von unten, **~0,5s wortlos**.
- Dann Tier-Wort (Graffiti-Caps) + horizontaler Lens-Flare-Beam; Gold-Tally startet.
- **Tally ease-out ~2,2s, landet EXAKT auf dem Wert — kein Overshoot, kein sichtbarer Terminator.**
- Münzfontäne **SPÄRLICH: 2–5 Coins gleichzeitig** (Rinnsal, kein Regen).
- Wert hält ~0,6s, Tier-Wort schrumpft/fadet ZUERST, alles weg nach **~3,2–3,5s, Auto-Exit ohne Klick**.
- GESAMTGEWINN wird still HINTER dem Marquee verrechnet (tickt nie sichtbar).
- Tiers beobachtet: NICE (~16×), EPIC (~112×).

## 6. Audio-Befund (Recording sehr leise, −37dB Peak — nur Struktur belastbar)

- **Reel-Stops praktisch unhörbar** — kaum Onsets an Stop-Zeitpunkten selbst bei niedriger Schwelle.
  Der Mix trägt WINS und FEATURES, nicht die Stops. (Gegenmodell zu unserem Wood-Clatter —
  bewusste Design-Alternative, kein Fehler bei uns.)
- Onset-Dichte-Peaks bei Win-/Feature-Momenten (44s, 65s, 95–130s FS, 140s, 180s).
- Ein Tick-Train 9 Ticks @ ~89ms (Video-Start, Balance-/UI-Tally).

## 7. Sonstiges

- Buy-Menü: 5 Karten mit Blitz-Volatilitäts-Rating (EXTRA CHANCE 2× Einsatz „aktivieren",
  TORNADO SPIN 50×, BONUS 100×, SUPER BONUS 250×, RANDOM BONUS 250× mit Odds-Karte
  **52% Bonus / 40% Super / 8% Hidden**).
- Ökonomie: 3sc = 8 FS; Multi bis 1024×; Max-Win 15.000×; SUPER BONUS startet mit Tower + 8×-Badge ab Spin 1.
- Erster Spin nach Load hat ~1,2s Server-Delay; danach 0,2–0,6s.

## 8. Delta-Liste → Crack Farm (priorisiert)

| # | Delta | Aufwand | Wirkung |
|---|-------|---------|---------|
| D1 | **Voller Payline-Pfad edge-to-edge** über alle 5 Reels durch Zell-Mitten (auch nicht-zahlende Reels), runde Sinus-Bögen; Draw ~0,2s, Lebensdauer ~0,5s | mittel | groß — DAS macht den „echte Payline"-Look |
| D2 | **Stille-Pause ~0,5s** nach letztem Stop vor der Win-Präsentation | klein | mittel (Spannung) |
| D3 | **Winner-Juice**: White-Hot-Flash/Recolor + ~1,2× Enlarge statt nur Lift | klein | mittel |
| D4 | **Plaque-Stack**: fertige Linien-Beträge bleiben stehen, während nächste Linie spielt | mittel | mittel |
| D5 | **xN-Tick-up** auf der Plaque bei Tower-Crossing (x1→x2→…), Badge pulst synchron | mittel | groß im FS |
| D6 | **Roaming-Glide**: Plant gleitet sichtbar über die laufenden Reels (~2,3s Sweep, Lean, Pop-out) statt Teleport auf neues Reel | groß | sehr groß — Signature-Move |
| D7 | **Badge-Debüt erst nach erstem Win** + Spawn-oben→Drift→Pop-Upgrade-Choreo; Upgrade nach Marquee verzögern | mittel | mittel |
| D8 | Retrigger-Muster („+X FS"-Fly, Zähler tickt bei Landung) — falls wir Retrigger je bauen | — | notiert |
| D9 | Marquee-Timing-Referenz: 0,5s wortlos → 2,2s Ease-out-Tally exakt → 0,6s Hold → Auto-Exit 3,5s | klein | Feinschliff |
| D10 | Zyklus-Konvention: WS läuft EINMAL durch alle Linien und ruht neutral; unser Endlos-Loop = klassische Konvention (DB 08). Kadenz 1,15s liegt im WS-Fenster (0,5–1,2s). **Entscheidung Noski: Loop behalten oder Single-Pass?** | — | offen |

Nicht übernehmen: unhörbare Stops (unser Wood-Clatter ist gewollt), spärliche Marquee-Coins
(unser Coin-Regen ist gewollt), Verdopplungs-Mathe (unsere +1-crossing-Mathe ist zertifiziert —
nur die PRÄSENTATION aus D5/D7 übernehmen).
