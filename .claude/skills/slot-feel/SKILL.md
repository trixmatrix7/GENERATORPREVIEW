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
2. Jede neue vermessene Erkenntnis und jede Noski-Korrektur wird HIER als Regel ergänzt
   (kurz, mit Report-Verweis) — dieser Skill ist die Summe, die Reports sind der Beleg.
3. Video-Analyse-Methode: research/tools/analyze_slot_video.py (Audio-Onsets + Reel-Motion)
   + Frame-Sweep 1-2fps + gezielte 10-30fps-Bursts auf jede Unklarheit. Nie schätzen — messen.

## 1. Präsentations-Konventionen (vermessen, Report 14 = Wild Storm Ground Truth)

**PAYLINES (Crack Farm):**
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
- Roaming-Wechsel = **kontinuierlicher GLIDE** über die rollenden Reels (~2s, Pop-out 1,1–1,5×,
  Lean 15–20° in Fahrtrichtung), kein Teleport, kein Neu-Wachsen (preGrown-Park + Slam).
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

**WAYS (Vice):** ways-immersive (Leap/Dance, Dim trägt) — Comet/Deko sind ALTERNATIVEN zur
Immersive, nie beides. Sequentiell Combo-für-Combo. (Ways-Video-Ground-Truth: Report 15.)

## 2. Architektur-Grenzen (verbindlich)

- **NIE anfassen:** src/engine/*, src/config/symbolAnimations.ts, src/game/Reel.ts (byte-identisch zum Dev-Repo).
- Pay-Model-Zweige über `activePayModel()` (src/game/winEval.ts-Façade) — Vice-Pfade bleiben
  byte-gleich, Crack-Farm-Verhalten nur im `'lines'`-Branch.
- Neue MATH-Profile in BEIDE Registries (mathProfiles.ts + activeMath.ts), sonst Desync.
- Präsentations-Mathe muss Settlement-Mathe exakt spiegeln (Mock + Sim + Display = eine Regel).

## 3. Crispy-HD-Regeln (Pixi, Reports 11 + 14-Lektionen)

- DPR-Cap 2, autoDensity; **nie über Author-Größe skalieren** (Art in 2× Displaygröße authoren).
- Heavy-Downscale-Einzeltexturen: mipmaps + maxAnisotropy 8 + source.update().
- **Atlas-Frames können NICHT mipmappen (Bleed)** → Symbol-Sheets beim Laden in EINZELNE
  Canvas-Texturen slicen (`PixiApp.sliceSheetHD`), dann mipmaps+aniso pro Frame. Downscale
  ohne Mipmaps = Alias-Flimmern in Bewegung ("pixelig").
- **Filter auf Zellen/Symbolen: grundsätzlich vermeiden.** Wenn unvermeidbar: `resolution:
  'inherit'` + `antialias: 'inherit'` (Default-Resolution 1 halbiert auf DPR-2 die Dichte).
  Brightness-Filter BLEICHEN die Art (blasser Matt-Film) — Emphase stattdessen als additives
  Licht HINTER dem Symbol (Backlight-Burst) oder echte Art-Varianten.
- Charakter-Sheets: HD authoren (Frame ≥ Displaygröße), >4096px in mehrere Sheets splitten.

## 4. Audio-Regeln (hart, zweimal gelernt)

- **NIE synthetisierte/tonale Sounds oder Pitch-Ladders live schalten, bevor Noski sie gehört
  hat** — Synthese liest sich für ihn immer als "AI/fatal". Hooks verdrahten, Volume 0, echte
  Drops abwarten.
- Jeder MP3-Drop → .ogg + OGG_FIRST-Eintrag (defaultSoundConfig), sonst SPA-Fallback-Decode-Tod.
- Mix-Referenz WS: Stops fast unhörbar, Wins/Features tragen. Unser Wood-Clatter ist eine
  bewusste Gegenentscheidung (Noski-approved) — nicht "korrigieren".
- Sound-Spezifikationen für echte Drops: research/slot-feel/05.

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

- Report 15 (Ways-Video-Ground-Truth: Nolimit/Relax/Paperclip) + 16 (Paylines quer:
  Pragmatic Dog House/Big Bass, Colorful Play Savage Santa) — in Arbeit; Learnings hier eintragen.
- Audio-Conductor (bpm/key/bar-grid), Key-Disziplin (05/07) — P1 offen.
- D4 (Plaque-Stacking) + D9 (Marquee-Feintiming) aus Report 14 §8.
