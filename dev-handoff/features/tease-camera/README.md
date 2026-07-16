# Tease Camera — POV Anticipation Dolly

**Type:** grid effect / camera (needs render code) · **Grids:** 5x3, 5x5 (any reel count) · **Theme-agnostic.**

Reference skin: *Vice Heat*. Nothing below is Vice-specific — it is driven purely by scatter positions and reel-landing order, so it works in any game that has a Scatter symbol and a left-to-right reel-stop cascade.

---

## What it is

A **true point-of-view dolly**. When a bonus (free-spins) trigger is still in play late in a spin, the whole *world* — background art **included** — is pushed toward the viewer in discrete steps, pinned on the machine centre, then either bounces relaxed back out (miss) or stays locked (hit). It reads like a camera physically leaning in over the cabinet as the tension climbs.

The crucial distinction from a naive "scale the grid" zoom: the effect scales a single **camera-root container (`world`)** that holds *both* the animated background layers *and* the reel scene (`sceneRoot`). Because the background scales with the reels, parallax reads as a real dolly rather than a flat UI pop. Screen-fixed overlays (the free-spins iris, the win marquee, the boot screen) are added to the Pixi `stage` **above** `world`, so they never move with the camera.

```
stage
├─ world              ← THE CAMERA. scale + position tweened by the dolly
│  ├─ background sprite(s)   (index 0/1 — scales too → real parallax)
│  └─ sceneRoot             (header + frame + reels)
└─ overlays (iris / marquee / boot)   ← screen-fixed, never dollied
```

---

## The sequential one-reel-at-a-time gates

The camera is driven by the reel layer's near-miss detector, which fires **camera hooks** as scatters and teased reels land. The gates arm one after another — never all at once, and never at spin start (that would telegraph the outcome).

**Near-miss condition (per settled board):** `≥ 2 scatters total` **AND** at least one reel is still pending to the right of the rightmost scatter reel. Stacked scatters on a single early reel count. If the only scatters are on the last reel, nothing is pending, so no tease fires. The teased reels are every pending reel after the rightmost scatter, in landing order.

**Gate sequence:**

| Beat | Trigger | Camera call |
|---|---|---|
| Arm | The **2nd visible scatter lands** (`landedScatterReels === 2`) | `zoomStep(0)` — first push in |
| Step | Each **teased reel lands** (position `p` in the tease order) | `zoomStep(p + 1)` — one step closer |
| Resolve | **All reels stopped** | `release(finalScatterCount >= 3)` |

The 2nd-scatter beat also opens the first *reel* gate (the first pending reel begins its slow decel). Every subsequent gate arms only when the previous teased reel has actually landed, so the slowdown marches rightward in lockstep with the camera pushing in.

**Resolution:**
- **Miss** (`< 3` scatters on the final board) → `release(false)` → the camera pulls back out with a relaxed overshoot.
- **Hit** (`>= 3` scatters) → `release(true)` → the camera **stays locked**. The dolly deliberately does *not* animate the exit; the win/trigger choreography and the free-spins iris own it (the iris hard-resets the camera at its fully-black beat, so the reset is never visible).
- **Spin skipped / interrupted** → `release(false)` (bounce out).

---

## The camera math

Per step, target scale is:

```
s = base + perStep * step        // default: 1.06 + 0.05 * step
```

Step 0 = 1.06, step 1 = 1.11, step 2 = 1.16, … The world is scaled to `s` and simultaneously repositioned so the **machine centre stays fixed on screen** (the pin). With the machine centre expressed in world coordinates `(cx, cy)`:

```
cx = sceneRoot.x + (rw / 2) * sceneRoot.scale.x
cy = sceneRoot.y + (HEADER_H + rh / 2) * sceneRoot.scale.y
     where rw = reelSet.totalWidth  + FRAME_PAD * 2
           rh = reelSet.totalHeight + FRAME_PAD * 2

world.scale    → (s, s)
world.position → ( cx * (1 - s), cy * (1 - s) )   // keeps (cx,cy) on the same pixel
```

Both tweens run `duration 0.65, ease power2.out` on each step (GSAP `overwrite:'auto'`, so a new step cleanly retargets a step still in flight). `HEADER_H = 52`, `FRAME_PAD = 28` in the reference build.

**Miss release:** `world.scale → (1,1)` and `world.position → (0,0)`, `duration 0.9, ease back.out(1.4)` — the slight overshoot is the "relax" bounce.

**Hard reset** (used only at the iris' black beat, never seen): kill all `world` tweens, snap `scale = 1`, `position = 0`.

**Guards (mandatory):** the push is a no-op unless the app is live, and it is skipped entirely under `prefers-reduced-motion` (no dolly at all). `release` is a no-op if the camera was never engaged this spin.

---

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `base` | `1.06` | Scale at the first step (2nd scatter landed) |
| `perStep` | `0.05` | Extra scale added per landed teased reel |
| `pushDuration` | `0.65 s` | Per-step push-in tween |
| `pushEase` | `power2.out` | Per-step ease |
| `missReleaseDuration` | `0.9 s` | Bounce-out on a miss |
| `missReleaseEase` | `back.out(1.4)` | Overshoot on the miss bounce |
| `armOnScatterLand` | `2` | Which visible-scatter landing opens the chain |
| `hitThreshold` | `3` | Final scatter count that counts as a hit (lock kept) |
| `pin` | machine centre | Fixed screen point the dolly zooms toward |
| `scalesBackground` | `true` | The background is inside `world`, so it dollies too (POV parallax) |
| `reducedMotion` | skip | No dolly when the OS reduce-motion flag is set |

### feature.json

```json
{
  "id": "tease-camera-pov-dolly",
  "name": "Tease Camera (POV Anticipation Dolly)",
  "description": "A true POV dolly: the whole world (animated background included) pushes toward the machine centre in steps as a bonus tease builds — armed on the 2nd landed scatter, one step closer per landed teased reel, bounced back out on a miss, held locked on a hit (the iris owns the exit).",
  "version": "1.0.0",
  "implemented": true,
  "compatibleGrids": ["5x3", "5x5"],
  "type": "grid-effect",
  "scope": "full-canvas",
  "trigger": "2nd visible scatter lands while reels still pending",
  "intensity": "strong",
  "settings": {
    "base": 1.06,
    "perStep": 0.05,
    "pushDuration": 0.65,
    "pushEase": "power2.out",
    "missReleaseDuration": 0.9,
    "missReleaseEase": "back.out(1.4)",
    "armOnScatterLand": 2,
    "hitThreshold": 3,
    "scalesBackground": true,
    "reducedMotion": "skip"
  }
}
```

---

## Render wiring (exact call sites)

**Camera container + three methods — `src/game/PixiApp.ts`:**
- `private readonly world = new Container()` — the camera root. In `buildScene()` it is added to `stage` first (so overlays append above it), and both the background sprite(s) and `sceneRoot` are added *inside* it.
- `teaseZoomStep(step)` — computes `s`, the machine-centre pin, tweens `world.scale`/`world.position`. Guarded by `isLive` + `prefersReducedMotion()`.
- `releaseTeaseZoom(hit)` — `hit` → return (stay locked); else bounce `world` back to identity.
- `resetTeaseZoom()` — hard snap to identity, called from the FS iris' black beat.

**Hooks handed to the reel layer — `src/game/PixiApp.ts` (init):**
```ts
this.reelSet.cameraHooks = {
  zoomStep: step => this.teaseZoomStep(step),
  release:  hit  => this.releaseTeaseZoom(hit),
};
```

**Gate logic — `src/game/ReelSet.ts` (`stopOnStops` post-stop hook + `detectNearMiss`):**
- `detectNearMiss(stops)` returns `{ teasedReels, scatterReels, scatterCount }` or `null`.
- On each reel's landed callback: count visible scatters; when the count hits `2`, set `teaseZoomOn = true` and call `cameraHooks.zoomStep(0)`; on each teased reel land call `cameraHooks.zoomStep(tPos + 1)`.
- After `Promise.all` of all reel stops: recount final scatters and call `cameraHooks.release(finalScatterCount >= 3)`.
- `skipSpin()` calls `cameraHooks.release(false)`.

---

## How to add it to a new game

1. Wrap the background layers **and** the reel scene in one camera container; add that container to the stage before any overlay, and add overlays (iris/marquee/boot) to the stage so they sit above it.
2. Implement `zoomStep(step)` / `release(hit)` on the camera container using the math above (pin = machine centre).
3. Wire the reel layer's near-miss detector to call `zoomStep(0)` on the 2nd landed scatter, `zoomStep(p+1)` per landed teased reel, and `release(scatterCount >= hitThreshold)` after all reels stop.
4. Leave the exit on a hit to the iris/win choreography; only miss bounces the camera itself.
5. Guard both entry points with the reduce-motion check and a live-app check.
