# FS-only background (drop-in)

A background image that is shown **only during the free-spins round**. The art
itself ships like any other asset (drop `fs_background.png`/`.jpg` next to the
theme's base background — same format, cover-fit). What this package adds is
the **code + timing**: the swap happens where the player can't see it.

Purely visual — no odds/paytable/RTP touched. With no FS background set,
everything behaves exactly as before (the round keeps the base background).

## The timing (this is the whole feature)

```
iris CLOSE            FULL-BLACK BEAT           iris OPEN → intro → round        round ends
──────────────────────┃━━━━━━━━━━━━━┃──────────────────────────────────────────┃──────────
0.00s          0.70s  ┃    SWAP     ┃  0.82s      (intro screen, N spins)      ┃  RESTORE
                      ┃  enter()    ┃                                          ┃  exit()
```

- **`enter()` at the full-black beat** of the transition — in our iris timeline
  that is `t = 0.72` (close ends 0.70, intro is armed 0.74). The screen is
  entirely covered, so the background change is invisible. One line:

  ```ts
  tl.call(() => this.fsBackground.enter(), undefined, 0.72);
  ```

- **`exit()` when the round ends** — right where you hide the free-spins
  counter/overlay:

  ```ts
  this.hideFreeSpinOverlay(fsOverlay);
  this.fsBackground.exit();
  ```

- Skipped-transition paths (turbo / reduced-motion): if your build skips the
  iris there, either skip the FS bg too (what we do) or call `enter()` right
  before the first free spin — it is just a hard cut then.

## Files

| File | What it is | How to use |
|------|-----------|------------|
| `fsBackground.ts` | `FsBackground` controller (setImage / enter / exit / dispose) + a reference `present()` | Drop in; inject 3 small hooks |

## Integration — 3 points

### 1. Construct with your background pipeline (3 hooks)

```ts
this.fsBackground = new FsBackground({
  present: tex => this.presentBgTexture(tex),  // repoint bg WITHOUT destroying the old texture
  clear:   () => this.clearToGradientStage(),  // whatever you show with no bg image
  current: () => this.bgTexture,               // the texture currently shown
});
```

⚠️ `present()` must be **reversible**: it repoints the sprite/derived layers
(frosted reel backdrop etc.) but must NOT destroy the previous texture — the
reference implementation is at the bottom of `fsBackground.ts`.

### 2. Wire the two timing calls
`enter()` at the transition's full-black beat, `exit()` where the round's
overlay hides (see the diagram above — it is one line each).

### 3. Feed it the asset

```ts
await this.fsBackground.setImage(themeUrl('fs_background.png')); // or null to clear
```

Safe to call mid-round (reflects immediately). In our studio this is an
Assets-tab slot (`setFreeSpinsBackgroundImage`), persisted like the other
slots — for a generated game it can simply be the theme-folder convention.

## Teardown
Call `dispose()` from your destroy. It handles dying mid-round without a
double-destroy (the presented texture may BE the FS texture at that moment):

```ts
this.fsBackground.dispose(base => { /* destroy `base` if you own it */ });
```

## Notes
- Same image format/size guidance as the base background (it runs through the
  identical cover-fit pipeline).
- If your reel backdrop shows a frosted/blurred copy of the background, rebuild
  it inside `present()` (ours does) — otherwise the reels keep the old frost.
