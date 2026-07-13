# Vice Heat — custom math model (for dev review)

> **Für Noski:** Unser eigenes 96%-Modell — alles zahlt ab 3er, FS = Expanding
> Wilds, Hot-Spin im Base Game. Analytisch exakt berechnet + 5M-Sim. Dieses
> Paket geht so an den Dev.

## The model (5×3 · 243 ways · RTP 96.00%)

- **Every symbol pays from 3-of-a-kind** (base game connects constantly — measured hit frequency **47.1%**).
- **Wilds only on reels 2–5** (reel 1 clean → no wild-line double counting; the same gate the current template uses).
- **FREE SPINS = expanding wilds:** every wild-carrying reel becomes FULLY WILD **before** ways evaluation. No FS multiplier needed — the expansion is the juice: **per-FS-spin EV ≈ 13.6× a base spin**. Trigger 3+ scatters (1-in-25.3), 10 spins, +5 retrigger, cap 50.
- **HOT SPIN (base game):** 1-in-40 base spins play in expansion mode — presented as the "screen darkens" special spin: brief darkening → the spin rolls → any landed wilds expand. Gives the base game a real shot at the FS feeling.
- Session cap 5000×, min wager 10000 — template invariants unchanged.

## The numbers

| Metric | Value | Method |
|---|---|---|
| RTP | **96.0003%** | exact analytic (see below) |
| RTP (MC sanity) | 96.11% | 5,000,000 spins, seed 31337 |
| Hit frequency | 47.1% | MC |
| FS trigger | 1-in-25.3 | analytic |
| E[FS spins/round] | 12.46 (incl. retriggers, cap 50) | count-process, 2M trials |
| Base:Feature split | ≈27% : 73% | analytic decomposition |

**Why analytic:** the expansion tail makes MC noisy (±1% even at 5M — our seed
spread was 94.9–97.9 before we switched). The ways expectation factorises over
independent reels: `E[win_s] = Σ_k pay_k(s) · Π_{i≤k} E[n_i] · P(n_{k+1}=0)`,
scatters via per-reel convolution, FS length via a count-only process. The
final integer-bps paytable lands on 96.0003% exactly. `analytic_vice_heat.py`
reproduces it in seconds; `simulate_vice_heat.py` is the MC cross-check.

## Files

- `vice_heat_expanding.json` — the manifest, standard shape (reelStrips,
  payTable, scatterPay, FS params, minWager, maxWin) + a `custom` block for the
  two new rules (`expandingWildsInFreeSpins`, `hotSpinChance1In: 40`).
- `analytic_vice_heat.py` — exact RTP derivation (run: `python analytic_vice_heat.py`).
- `simulate_vice_heat.py` — full MC simulator incl. FS retriggers + session cap.

## What the dev needs to add (contract side)

Two settlement rules beyond the current template (both deterministic from the
spin randomness, no new RNG):
1. **FS expansion:** in FS resolution, reels containing ≥1 wild evaluate with
   count = ROWS for every symbol (full-wild reel).
2. **Hot spin:** derive a 1-in-40 flag from the existing spin seed; when set,
   apply the same expansion rule to a base spin.
Everything else (strips, paytable, ways evaluation, caps) is the unchanged
template pipeline — render TS+Sol from the manifest as usual and re-run the
5M gate on the bigint simulator.
