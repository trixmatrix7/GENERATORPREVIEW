# Reel background — colour tint (drop-in)

A tunable tint over the **reel window** (behind the symbols): a real **RGB colour
picker** plus **hue / saturation / brightness / opacity** sliders that stay in
two-way sync. No math or spec touched — it only colours the reel-backdrop layer.

Defaults reproduce a neutral dark backdrop (near-black @ 62% opacity), so dropping
it in changes nothing until a value is moved.

## Files

| File | What it is | How to use |
|------|-----------|------------|
| `color.ts` | Dependency-free HSL ⇄ hex helpers | Drop in as-is |
| `ReelBgTint.ts` | Framework-agnostic controller (owns the 4 values, exposes `.rgb` / `.alpha` / `.hex`) | Drop in as-is |
| `reelBackgroundParams.ts` | The 5 whitelist entries | Spread into your `ADJUSTABLE_PARAMS` |

## Integration — 3 points

### 1. Whitelist + the new `color` type
Spread `REEL_BACKGROUND_PARAMS` into your adjustable-params array, and add the
`color` type to your union (its value is a `"#rrggbb"` string):

```ts
export type AdjustableParamType = 'enum' | 'number' | 'boolean' | 'color';
```

### 2. Render the `color` type in your param panel
One extra case next to your `enum` / `number` / `boolean` inputs. Keep the picker
and the H/S/L sliders in sync via the shared state (`ReelBgTint`):

```tsx
// inside your param control switch:
p.type === 'color' ? (
  <input
    type="color"
    value={String(values[p.id])}
    onChange={e => apply(p.id, e.target.value)}
  />
) : /* ...your number / enum / boolean inputs... */
```

Two-way sync (do this in your `apply(id, value)`, mirroring what the controller
does internally):

```ts
import { numToHsl, hexToNum, hslToHex } from './color';

// when applying a value into your local `values` state:
if (id === 'reelBgColor') {
  const { h, s, l } = numToHsl(hexToNum(String(value)));
  next.reelBgHue = h; next.reelBgSaturation = s; next.reelBgLightness = l;
} else if (id === 'reelBgHue' || id === 'reelBgSaturation' || id === 'reelBgLightness') {
  next.reelBgColor = hslToHex(Number(next.reelBgHue), Number(next.reelBgSaturation), Number(next.reelBgLightness));
}
```

### 3. Apply it to your reel-backdrop layer
Keep one `ReelBgTint` instance; in `applyVisualParam`, feed the param in and, if
it belonged to us, redraw. Fill your reel-window rect with `.rgb` at `.alpha`
(place it **above** any frosted/blurred background copy so it tints it):

```ts
private reelBgTint = new ReelBgTint();

applyVisualParam(id: string, value: string | number | boolean) {
  if (this.reelBgTint.set(id, value as string | number)) {
    this.redrawReelTint();   // your one-line roundRect fill, see ReelBgTint.ts
    return;
  }
  // ...your other params...
}
```

## Notes
- `reelBgColor` and the H/S/L sliders edit the **same** tint — `ReelBgTint` keeps
  them consistent, so there is never a double-apply or a stale control.
- `reelBgOpacity` is the transparency: `0` = the scene shows fully through, `100`
  = a solid colour panel.
- Purely presentational; the odds / paytable / RTP are untouched.
