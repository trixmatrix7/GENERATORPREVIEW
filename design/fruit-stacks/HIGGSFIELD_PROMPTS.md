# Fruit Stacks — Higgsfield Prompt-Pack (v3)

**HARTE PROMPT-REGELN (Noski 2026-07-21):**
1. **NIE "casino"/"slot"** in Generation-Prompts.
2. **NUR Design im Prompt** — kein "game", kein "asset", keine Maße/Größen/Framing-Prozente
   (Sizing macht Noski selbst), keine Render-/Engine-Wörter.
3. **EIN Artstyle, illustrated:** die Symbole sollen GEZEICHNET aussehen — `hand-drawn
   illustration, bold clean outlines, smooth cel shading, rich saturated colors, soft
   painterly highlights`. Dieser Style-Wortlaut identisch in jedem Prompt = Konsistenz.
4. Symbole auf **Magenta #F60BF3** (Chroma-Key-Pipeline); nichts darf die Magenta-Kante
   berühren. Multiplier-Kiste OHNE Zahl (×N rendert die Engine).

## Symbole

| Slot | Symbol | Prompt |
|---|---|---|
| HIGH_A (2) | Ananas | `hand-drawn illustration of a golden pineapple with spiky green crown leaves, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| HIGH_B (3) | Melone | `hand-drawn illustration of a watermelon wedge with juicy red flesh, dark seeds and a striped green rind, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| MID_C (4) | Trauben | `hand-drawn illustration of a plump bunch of purple grapes with one small green leaf, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| MID_D (5) | Erdbeere | `hand-drawn illustration of a big red strawberry with tiny seeds and a fresh green calyx, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| LOW_E (6) | Orange | `hand-drawn illustration of a whole orange with one green leaf, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| LOW_F (7) | Zitrone | `hand-drawn illustration of a bright yellow lemon with one green leaf, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| LOW_G (8) | Kirschen | `hand-drawn illustration of a pair of red cherries on one joined green stem, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| SCATTER (1) | **B-Scatter V1** (B + Früchte) | `hand-drawn illustration of a big bold golden letter B standing large in the center, with a thick strong black outline around the letter so it clearly stands out, high contrast and easily readable, surrounded by small fruits and green leaves hugging its edges, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| SCATTER (1) | **B-Scatter V2** (Sternfrucht + B) | `hand-drawn illustration of a golden starfruit slice shaped like a five-pointed star, with a big bold letter B placed large in the center of the star, the letter has a thick strong black outline and high contrast so it is clearly readable and stands out, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |
| MULTI (0) | Frucht-Kiste | `hand-drawn illustration of a small wooden crate filled with little fruits, cherries, a lemon and grapes, with a warm golden glow rising from it, bold clean outlines, smooth cel shading, rich saturated colors, soft painterly highlights, on a plain solid magenta background hex F60BF3` |

**Scatter-Regel (Noski):** wie die Referenz einen Buchstaben eingebaut — großes mittiges,
kontrastreiches, LESERLICHES **B** mit stärkerer SCHWARZER Outline zum Rausstechen;
2 Varianten generieren, bessere gewinnt.

## Background — Frucht-Wald

```
hand-drawn illustration of a lush magical fruit forest, big trees carrying glowing
oranges, apples and berries, deep green and teal tones with soft warm light falling
through the leaves, the middle of the scene stays dark and calm, bold clean outlines,
smooth cel shading, rich saturated colors, soft painterly highlights
```

## Rahmen (innen MUSS Magenta sein)

```
hand-drawn illustration of a rounded rectangular golden frame decorated with painted fruit
vines and small citrus slices in the corners, the inner window and the outer background are
plain solid magenta hex F60BF3, bold clean outlines, smooth cel shading, rich saturated colors
```

## Logo

```
hand-drawn illustration of the lettering "FRUIT STACKS" in two stacked lines, juicy
orange-to-red letters with a gold outline and small green leaves sprouting from them, bold
clean outlines, smooth cel shading, rich saturated colors, on a plain solid magenta
background hex F60BF3, correct spelling exactly "FRUIT STACKS"
```

(Spelling wackelt bei Bildmodellen → mehrere Versuche, beste 2 an mich.)

## Handoff

Noski generiert + legt Rohbilder ab (Downloads reicht) → ich: Chroma-Key → Despill →
Montage-Identitäts-Check → `public/theme/fruitstacks/`. Phase 2 (nach Freigabe):
Multiplier-Kisten-Tiers, FS-/Buy-Karten, Marquee-Plaques, Pool-Badge, Tally-Chips.
