# FS-only background (drop-in: logic + upload field)

A background image that is shown **only during the free-spins round**, then the
base background comes back. This package is just **the logic + one more upload
field** — it plugs into the background-upload pattern the generator already
has, and it does NOT require any transition screen (none is assumed to exist).

Purely visual — no odds/paytable/RTP touched. With no FS background set,
everything behaves exactly as before (the round keeps the base background).

## Files

| File | What it is | How to use |
|------|-----------|------------|
| `fsBackground.ts` | `FsBackground` controller (setImage / enter / exit / dispose) + a reference reversible `present()` | Drop in; inject 3 small hooks |

## 1. The upload field (same pattern as the existing background field)

Add **one more upload field** next to the existing background upload — label it
"FS background". Its value feeds `setImage()`, exactly like the base
background field feeds `setBackgroundImage()`:

```ts
// identical handling to your existing background upload field:
<input type="file" accept="image/*" onChange={e => {
  const f = e.target.files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => void fsBackground.setImage(String(r.result));  // data URL
  r.readAsDataURL(f);
}} />
// clear button → fsBackground.setImage(null)
```

Same image format/size guidance as the base background — it runs through the
identical cover-fit pipeline. (A theme-folder convention like
`fs_background.png` works as the default value if you prefer shipping it as an
asset; the field then just overrides it.)

## 2. Construct with your background pipeline (3 hooks)

```ts
this.fsBackground = new FsBackground({
  present: tex => this.presentBgTexture(tex),  // repoint bg WITHOUT destroying the old texture
  clear:   () => this.clearToGradientStage(),  // whatever you show with no bg image
  current: () => this.bgTexture,               // the texture currently shown
});
```

⚠️ `present()` must be **reversible**: it repoints the sprite/derived layers
(frosted reel backdrop etc.) but must NOT destroy the previous texture — a
reference implementation is at the bottom of `fsBackground.ts`.

## 3. Two calls around the free-spins round

```ts
// when the free-spins round STARTS (before the first free spin):
this.fsBackground.enter();

// when the round ENDS (right where the counter/overlay hides):
this.fsBackground.exit();
```

That's it — with no transition screen this is a straight swap at round start.
Both calls are no-ops when no FS background is set.

> **Later, if a transition screen exists:** move the `enter()` call to the
> moment the screen is fully covered (in our preview the iris timeline is
> fully black at `t = 0.72`, between close-end 0.70 and intro-arm 0.74), so the
> swap is never visible. The logic doesn't change — only where the one line
> lives.

## Teardown
Call `dispose()` from your destroy. It handles dying mid-round without a
double-destroy (the presented texture may BE the FS texture at that moment):

```ts
this.fsBackground.dispose(base => { /* destroy `base` if you own it */ });
```

## Notes
- `setImage()` is safe mid-round (reflects immediately); `null` clears.
- If your reel backdrop shows a frosted/blurred copy of the background, rebuild
  it inside `present()` (ours does) — otherwise the reels keep the old frost.
