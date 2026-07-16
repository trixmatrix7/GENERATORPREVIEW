# PixiJS SHARPNESS — how studios get ultra-crisp symbols

> Research sweep 2026-07-16 (round 2). Estimates marked.

## Executive summary

Top slot studios get "ultra-sharp" PixiJS art from four compounding practices, not one setting: (1) renderer resolution locked to devicePixelRatio with autoDensity so 1 texture pixel ≈ 1 device pixel at the common display size; (2) source art authored ~2x the largest display size and downscaled through mipmapped linear filtering (never upscaled); (3) art direction that survives filtering — bold outlines, flat fills, alpha-bled/premultiplied edges, 2px+ atlas padding with extrude; (4) scale discipline — symbols sized so the everyday scale factor is close to 1.0 (or a clean 0.5), roundPixels for static states, and no full-screen filters over crisp art. Spine keeps characters sharp because it transforms high-res texture pieces at render resolution instead of baking scaled frames. For a 120×110-cell grid: author symbols at ~256px, display at ~110–120px on a DPR-matched renderer, mipmaps on, premultiplied-safe PNG export.

## 1. Renderer settings — where 80% of 'blurry PixiJS' comes from

The single biggest sharpness lever is **renderer resolution vs CSS size**. If the canvas backing store is 1280×800 but CSS stretches it across a 2x (or 1.5x Windows) display, every pixel is interpolated by the browser and *nothing* downstream can fix it.

- **`resolution: window.devicePixelRatio`** (v8: `await app.init({ resolution: window.devicePixelRatio, autoDensity: true })`). `autoDensity: true` keeps the canvas CSS size in logical pixels while the backing store is DPR-times larger — this is the standard retina recipe ([PixiJS renderer config](https://app.studyraid.com/en/read/12379/399718/renderer-configuration-options)).
- **Cap DPR on weak devices**: `Math.min(devicePixelRatio, 2)` is the common production cap — DPR 3 phones are fill-rate limited and 2x is visually near-identical at slot viewing distance ([PlayCanvas DPR guide](https://developer.playcanvas.com/user-manual/optimization/runtime-devicepixelratio/) documents the same tiering pattern). Estimate: most commercial slots cap at 2.
- **Fractional DPR (1.25/1.5 on Windows)**: don't round it — render at the true fractional DPR; rounding to 1 is what makes Windows-laptop demos look soft (pixi issue #4866 covers fractional-DPR scaling bugs).
- **`antialias`**: MSAA only smooths *geometry edges* (Graphics, meshes) — it does **nothing** for texture/sprite sharpness. For a sprite-only slot, `antialias: false` is free performance; turn it on only if you draw vector Graphics at runtime. On mobile you get exactly 4x MSAA when requested, and the attribute is a request, not a guarantee ([WebGL AA notes](https://medium.com/@pixelscommander/why-does-webgl-antialiasing-lie-51e5d3e208bb)).
- **`roundPixels: true`** floors x/y at render time, killing sub-pixel interpolation — text and *resting* symbols get visibly crisper, but moving objects (reel spin!) get less smooth / can jitter (pixi issues #9868, #10373). The studio pattern (estimate, but strongly implied by behavior): roundPixels on static layers/final rest positions, off (or irrelevant due to motion blur of speed) during the spin. In v8 it's settable per-renderer AND per-sprite (`sprite.roundPixels = true`).
- **`powerPreference: 'high-performance'`** requests the discrete GPU on dual-GPU laptops — a frame-rate lever, not a sharpness lever, but stable 60fps prevents the 'shimmering while moving' perception.
- **Never CSS-scale the canvas** to a size other than what autoDensity set. Any CSS transform/scale on the canvas element reintroduces browser resampling.

## 2. Texture strategy — author big, display small, mipmaps on

**The standard sharpness trick is real: author at ~2x the largest on-screen size and only ever downscale.** Upscaling past 1.0 is unfixable; downscaling through good filtering looks like supersampling. Slot art outsourcers confirm the convention: symbols delivered at **256×256–512×512 per state**, with 2x/3x variants for hi-DPI ([Whimsy Games slot art guide](https://igaming.whimsygames.co/blog/slot-game-art-services-a-complete-guide-to-visual-production-in-modern-igaming/), [Game-Ace](https://game-ace.com/blog/10-types-of-slot-assets-in-online-casino-gaming/)).

- **Sweet spot ratio**: display-size × DPR × ~1.25–2. For a 120×110 cell on a DPR-2 screen the texture is sampled at ~240px — a 256px source is nearly 1:1 (perfect), a 512px source needs mipmaps to avoid shimmer. A 1024px source displayed at 120px *without mipmaps* looks WORSE than 256px: plain bilinear minification only samples 4 texels, so heavy downscales alias and sparkle.
- **Mipmaps fix heavy downscales**: v8 `textureSource.autoGenerateMipmaps = true` (or in TextureSourceOptions). WebGL2 handles NPOT mipmaps; on WebGL1 NPOT textures can't mipmap or repeat — pad atlases to POT (2048/4096) if you must support WebGL1 ([html5gamedevs downscaling thread](https://www.html5gamedevs.com/topic/43947-maintaining-sharpness-while-downscaling-large-sprites/)).
- **Mipmap blur caveat**: default trilinear LOD selection over-blurs between levels; the classic fix is a **LOD bias of −1.0** in the sampler/shader (pixi [issue #2277](https://github.com/pixijs/pixijs/issues/2277)) — in v8 you can approximate with `maxAnisotropy: 4–16` on the TextureStyle, which sharpens minification for nearly free on desktop GPUs (Pixi's default anisotropic level is 0 = off).
- **scaleMode**: `'linear'` for painterly slot art always; `'nearest'` only for deliberate pixel-art themes at integer scales.
- **Max texture size**: keep atlases ≤2048×2048 for safe mobile coverage; 4096 is the practical ceiling (also PixiJS's SVG-texture ceiling). Split symbol atlases by usage (base symbols vs win-animation sheets) rather than one mega-atlas.
- **KTX2/Basis compressed textures**: UASTC = high quality mode, ETC1S = small/lossier ([Khronos artist guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)). Block-compression artifacts show worst exactly on flat-fill, hard-outline slot art — that's why premium-look studios largely ship **plain PNG/WebP atlases for symbols** and reserve ETC1S for backgrounds (estimate based on artifact behavior + shipped-asset inspection; runtime transcode target can further degrade quality per [glTF-Transform discussion](https://github.com/donmccurdy/glTF-Transform/discussions/1614)). If VRAM forces compression: UASTC for symbols, ETC1S for backgrounds.

## 3. Art side — why Hacksaw-style art looks sharp and how to export like it

**Hacksaw's crispness is art-directed before it's engineered**: thick dark outlines, flat/simple fills, slightly desaturated palette, graphic-novel look ([WagerManiacs review](https://wagermaniacs.com/hacksaw-gaming/)). This style is intrinsically filtering-proof: bold outlines survive bilinear blur (a 3–4px-wide line at 2x source is still ≥1.5px after downscale), flat fills have no high-frequency detail to alias, and high edge contrast reads as 'sharp' even when technically filtered. Painterly/3D-rendered art with 1px specular details is what turns to mush at 120px.

- **Export pipeline**: vector or high-res raster masters → PNG exports at 2x–3x display size. PixiJS can rasterize SVG at load with `resolution: 2..4` on the texture, or keep true vectors via `GraphicsContext` (infinite crispness, but slower fills, 4096px texture cap for the raster path) ([PixiJS SVG guide](https://pixijs.com/8.x/guides/components/assets/svg)).
- **The dark/white fringe problem (premultiplied alpha halos)**: GPUs bilinear-filter RGB and A independently, so fully-transparent pixels' hidden RGB (usually black or white) bleeds into edge pixels → dark or light halos, worst in mipmaps and on downscale. Two fixes, per [Adrian Courrèges' canonical article](https://www.adriancourreges.com/blog/2017/05/09/beware-of-transparent-pixels/): **(a) alpha-bleed on export** — dilate edge colors into transparent regions (TexturePacker 'Alpha bleeding' / 'Reduce border artifacts', Photoshop SuperPNG plugin, Solidify); **(b) premultiplied alpha** — store [aR,aG,aB,a] and blend ONE/ONE_MINUS_SRC_ALPHA. PixiJS uploads with `alphaMode: 'premultiply-alpha-on-upload'` by default, so the main author-side job is (a): never ship PNGs whose transparent pixels are pure black/white garbage.
- **Atlas padding/extrude**: ≥2px shape padding between sprites plus 1–2px extrude (edge-pixel repeat), or neighbors bleed into each other under linear filtering; with mipmaps you need MORE padding — each mip level halves your effective padding, so 4–8px padding for mipmapped atlases ([TexturePacker settings](https://www.codeandweb.com/texturepacker/documentation/texture-settings), [Kyle Halladay on mip-safe atlases](https://kylehalladay.com/blog/tutorial/2016/11/04/Texture-Atlassing-With-Mips.html)).
- **SDF/MSDF for text**: big win counters and 'BIG WIN' numerals as MSDF BitmapText stay razor-sharp at any scale from one small atlas — PixiJS v8 supports MSDF .fnt natively; generate via AssetPack from a TTF ([PixiJS bitmap text guide](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap)). This is exactly the asset type (huge, scaled-up, animated numbers) where raster text falls apart.

## 4. Animation tech — Spine vs spritesheets, and why Spine characters stay sharp

**Spine (Esoteric Software) is the de-facto industry standard for slot symbol/character animation** — 'almost every game provider relies on Spine' per iGaming outsourcers ([Gamix Labs Spine-for-slots guide](https://gamixlabs.com/blog/creating-symbol-animations-in-spine-for-slot-games/), [PaintPool](https://paintpoolstudio.com/blog/spine-animation-slot-games/)).

- **Why Spine stays sharp at any scale**: the runtime transforms *full-resolution texture attachments* on the GPU every frame — a character scaled to 140% during a win celebration still samples its original 2x-authored parts, and interpolation is per-frame smooth (no 24fps steps). A pre-baked spritesheet of the same animation would need every frame stored at the largest size it ever reaches, or it blurs when the win-pop scales it up. Bone data is tiny, so one atlas + skeleton JSON replaces megabytes of frames ([Spine in depth](https://en.esotericsoftware.com/spine-in-depth)).
- **Who uses what** (estimates from shipped-game asset inspection + outsourcer specs): Spine for hero characters, wilds, scatters, big-win presentations; baked PNG spritesheets for particle-like effects, explosions, glows (things AE/particles produce better); static PNG + code tweens (scale/rotate/shader) for low-pay card symbols. Hacksaw-style studios lean harder on code tweens over Spine because flat art animates well with transforms alone.
- **Frame sizes**: symbol win-animation sheets at **256–512px per frame**; 512 for hero symbols, 256 for standard ([Whimsy Games](https://igaming.whimsygames.co/blog/slot-game-art-services-a-complete-guide-to-visual-production-in-modern-igaming/) cites 256–512 per state as the standard target). Full-screen transitions get baked at 1024+ or done in Spine.
- **FPS conventions**: baked sheets at **24–30fps** (30 is the mobile-safe convention; [Game-Ace](https://game-ace.com/blog/10-types-of-slot-assets-in-online-casino-gaming/)); Spine is fps-independent (interpolated). AE→spritesheet via PNG sequence or the Sheetah plugin; keep sheet dimensions power-of-two (512/1024/2048).
- **Sharpness rule for baked sheets**: bake the frame at the *maximum* scale the animation reaches (e.g., win-pop to 1.3× of a 120px cell at DPR 2 → bake ≥312px frames, i.e., use 512-class frames), then only downscale.

## 5. Scaling discipline + PixiJS v8 specifics

**Scaling discipline — the part everyone skips:**
- **Design the asset chain so the everyday display scale is ~1.0** (or exactly 0.5 of a 2x asset). Your grid: cell 120×110, DPR-2 backing store samples at 240×220 → a 256px symbol master displayed at `scale ≈ 0.9` is in the ideal 0.75–1.0 downscale band where linear filtering looks perfect without mipmaps. Avoid living at scale 0.3 or 1.4.
- **Avoid continuously-animated fractional downscales on detailed art** — that's what shimmers. Idle 'breathing' scale animations should stay within ±5% or use mipmapped textures.
- **Snap resting positions to integers** (or use roundPixels on the settled board) — a symbol resting at x=213.5 is bilinear-smeared by half a pixel forever.
- **Logical-resolution architecture**: lay out in fixed logical units, let `resolution`+`autoDensity` carry DPR, and scale the *stage* uniformly to fit the window — never per-sprite ad-hoc scales that multiply into ugly totals.

**PixiJS v8 specifics:**
- Texture quality lives on **TextureSource / TextureStyle**: `scaleMode: 'linear'|'nearest'`, separate `minFilter/magFilter/mipmapFilter`, `maxAnisotropy` (default 0/1 — raising to 4–16 sharpens minification), `autoGenerateMipmaps`, `resolution` ([TextureSourceOptions docs](https://pixijs.download/dev/docs/rendering.TextureSourceOptions.html)).
- **`@2x` filename convention still works via Assets**: loading `symbol@2x.png` sets `texture.source.resolution = 2`, so the sprite *measures* at logical size while carrying double density — the cleanest retina-asset mechanism; zero code changes at call sites.
- **`antialias` on a TextureSource/RenderTexture** forces an extra blit to resolve — only matters for render textures, skip for image textures.
- **Filters soften**: any filter (glow, outline, displacement on win effects) re-renders the subtree into an intermediate texture. If `filter.resolution` is lower than the renderer's (historically defaulted to 1 while renderer was 2 — pixi [issue #6453](https://github.com/pixijs/pixijs/issues/6453)), your 2x-crisp sprite comes back at 1x, visibly blurred. In v8 set `filter.resolution = 'inherit'` (or explicitly `window.devicePixelRatio`), and set `antialias:'inherit'`. Better: bake glows/outlines into the art or a second sprite; reserve runtime filters for transient effects.
- **`cacheAsTexture` (v8) / cacheAsBitmap** has the same trap — pass the matching resolution or the cached copy is soft.
- **WebGPU vs WebGL**: v8's WebGPU backend changes none of the above rules; texture sampling behavior is identical in practice.

## 6. CHECKLIST — 17 concrete changes, ordered by impact

1. **`resolution: window.devicePixelRatio, autoDensity: true`** in `app.init()` — cap at 2 on weak GPUs, keep fractional DPRs (1.25/1.5) exact. Without this nothing else matters.
2. **Never CSS-scale the canvas** beyond what autoDensity sets; no `transform: scale()` on the canvas or ancestors (browser zoom ≠ 100% also softens — test at 100%).
3. **Author every symbol at ≥ display-size × maxDPR** (your grid: ≥240px → use 256px masters; hero symbols 512px). Only downscale, never upscale.
4. **Ship `@2x` assets via Pixi's resolution suffix** so sprites keep logical sizes while carrying device-pixel density.
5. **Size symbols so common display scale ≈ 0.75–1.0** of the texture (or exactly 0.5). Kill 'scale 0.23' situations by re-exporting the asset smaller.
6. **Alpha-bleed all transparent PNGs on export** (TexturePacker 'Reduce border artifacts'/alpha bleeding, SuperPNG, Solidify) — kills dark/white edge halos.
7. **Atlas hygiene: ≥2px padding + 1–2px extrude**; 4–8px padding if the atlas is mipmapped.
8. **Enable mipmaps (`autoGenerateMipmaps: true`) on any texture displayed below ~70% of source size**; keep those atlases POT for WebGL1 safety.
9. **Set `maxAnisotropy: 4–16`** on symbol TextureStyles to counteract mipmap over-blur (the modern stand-in for the LOD-bias −1 trick).
10. **`roundPixels: true`** on settled/static layers and all text; leave motion layers free. Snap final reel-stop positions to integer device pixels.
11. **Fix filter softness**: `filter.resolution = 'inherit'`, `antialias: 'inherit'`; prefer baked glow/outline sprites over runtime filters on persistent art.
12. **MSDF BitmapText for win counters and headline text** — sharp at every scale of the count-up animation.
13. **Bake win-animation frames at the animation's max reached scale** (512-class frames for symbols that pop to ~1.3×); 24–30fps sheets.
14. **Use Spine (or transform-based tweens) instead of baked sheets for characters** that scale/move a lot — full-res parts sampled at render resolution stay sharp.
15. **`antialias: false` on the renderer** for sprite-only scenes (free perf, zero sharpness cost); enable only for runtime vector Graphics.
16. **Skip ETC1S/Basis compression on symbol art** (block artifacts on flat fills + outlines); if compressing, UASTC for symbols, ETC1S for backgrounds only.
17. **Art-direct for filtering**: outlines ≥3px at authoring resolution, flat fills, high edge contrast — the Hacksaw recipe that makes assets look sharp even after inevitable resampling.

Quick verify ritual: screenshot the running game, zoom 400% in an image editor, compare a symbol edge against the source PNG — halos, double-width outlines, or gray edge ramps point to items 1, 6, or 11.

## Sources

- [PixiJS v8 ApplicationOptions (resolution, autoDensity, antialias, roundPixels)](https://pixijs.download/dev/docs/app.ApplicationOptions.html)
- [PixiJS v8 TextureSourceOptions (scaleMode, mipmaps, maxAnisotropy)](https://pixijs.download/dev/docs/rendering.TextureSourceOptions.html)
- [PixiJS v8 Textures guide](https://pixijs.com/8.x/guides/components/textures)
- [PixiJS issue #2277 — mipmap LOD bias for sharp downscales](https://github.com/pixijs/pixijs/issues/2277)
- [html5gamedevs — Maintaining sharpness while downscaling large sprites](https://www.html5gamedevs.com/topic/43947-maintaining-sharpness-while-downscaling-large-sprites/)
- [Adrian Courrèges — Beware of Transparent Pixels (premultiplied alpha halos)](https://www.adriancourreges.com/blog/2017/05/09/beware-of-transparent-pixels/)
- [TexturePacker texture/atlas settings (padding, extrude, alpha bleeding)](https://www.codeandweb.com/texturepacker/documentation/texture-settings)
- [Kyle Halladay — Minimizing mipmap artifacts in atlased textures](https://kylehalladay.com/blog/tutorial/2016/11/04/Texture-Atlassing-With-Mips.html)
- [PixiJS SVG assets guide (rasterize resolution vs GraphicsContext)](https://pixijs.com/8.x/guides/components/assets/svg)
- [PixiJS Bitmap/MSDF text guide](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap)
- [PixiJS issue #6453 — renderer resolution vs filter resolution blur](https://github.com/pixijs/pixijs/issues/6453)
- [PixiJS issues #9868 / #10373 — roundPixels behavior and jitter](https://github.com/pixijs/pixijs/issues/10373)
- [PixiJS issue #4866 — fractional devicePixelRatio scaling](https://github.com/pixijs/pixijs/issues/4866)
- [PlayCanvas — Device Pixel Ratio optimization (DPR capping pattern)](https://developer.playcanvas.com/user-manual/optimization/runtime-devicepixelratio/)
- [Spine: In Depth — why skeletal animation stays sharp/smooth](https://en.esotericsoftware.com/spine-in-depth)
- [Gamix Labs — Spine symbol animations for slot games](https://gamixlabs.com/blog/creating-symbol-animations-in-spine-for-slot-games/)
- [Whimsy Games — Slot game art production guide (256–512px per state, 2x/3x delivery)](https://igaming.whimsygames.co/blog/slot-game-art-services-a-complete-guide-to-visual-production-in-modern-igaming/)
- [Game-Ace — 10 types of slot game assets (spritesheet/Spine delivery, fps)](https://game-ace.com/blog/10-types-of-slot-assets-in-online-casino-gaming/)
- [Khronos KTX artist guide (UASTC vs ETC1S quality tradeoffs)](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)
- [WagerManiacs — Hacksaw Gaming art style review](https://wagermaniacs.com/hacksaw-gaming/)
- [Denis Radin — Why does WebGL antialiasing lie (MSAA semantics)](https://medium.com/@pixelscommander/why-does-webgl-antialiasing-lie-51e5d3e208bb)
