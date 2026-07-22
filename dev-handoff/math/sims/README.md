# Sim-Scripts (Vice Heat Buys + Ante)

Alle Scripts erwarten `../src/data/math_vice_heat.json` relativ zum Repo —
hier im Handoff liegt das Manifest als `../vice_heat_expanding.json`; beim
Ausfuehren entweder den Pfad in Zeile ~13 anpassen oder die Ordnerstruktur
`src/data/math_vice_heat.json` nachbauen. Python 3.10+, keine Dependencies.

- `certify_vice_buys_ante.py` — die BASIS: zertifizierte Engine 1:1 (Ways-Eval,
  FS-Runden, Sticky, Caps). Alle anderen Scripts importieren hieraus.
- `retune_buy_tails.py` + `inspect_buy4_caps.py` — der FINALE Tail-Retune
  (Ergebnisse: `vice_buy3_final.json` / `vice_buy4_final.json` = exakt die
  Blocks in `custom.viceBuyStages`).
- `calibrate_vice_buy_fs_strips.py`, `calibrate_buy4_cap4.py`,
  `confirm_buy4_final.py` — fruehere Kalibrierungsstufen (Historie).
- `dist_check_buy_rounds.py` — Verteilungs-/Max-Win-Check der Kauf-Runden.
- `certify_vice_ante3x.py` — Ante-Zertifizierung (3x-FS-Chance, 3.25x/Spin).
