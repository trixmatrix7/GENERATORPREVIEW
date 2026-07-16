# REEL-SPIN sound — the bed while reels run

> Research sweep 2026-07-16 (round 2). Estimates marked.

## Executive summary

The reel-spin bed is the quietest, most disciplined layer in a slot's mix: a short (2-4s) seamless loop or near-silence sitting an estimated 10-18 dB under the music, whose real job is to make the reel STOPS read louder by contrast. Studios diverge sharply: Pragmatic runs a soft airy whoosh-hum that swells with the music; Hacksaw runs almost nothing (music keeps pulsing, dry tick stops carry the spin); Nolimit layers mechanical/industrial rattle; land-based steppers (Aristocrat/IGT) are the reference: motor whir + physical clunks. The bed starts glued to the spin-start whoosh (one-shot into loop), pitches/filters UP only during anticipation (documented: rising pitch + volume on final-reel slowdown), and ends either per-reel (thinned as each reel stops) or cut with a 50-100ms fade on the last stop. Turbo shortens or drops it entirely. Concrete recipes for a barn slot (wood creak loop + tick layer, ~2.4s, est. -14 dB vs music, per-reel wooden clunk stops) and a synthwave slot (filtered white-noise riser + 16th-note arp gate, est. -12 dB, tape-stop stops) are given below.

## Anatomy: what actually plays between spin start and first stop, per studio

The spin phase is a 4-part chain: **(1) spin-start transient** (button click + whoosh, ~150-400ms), **(2) spin bed** (loop or silence, ~0.6-2.5s in normal mode), **(3) optional anticipation layer** (only when a tease is live), **(4) per-reel stop hits**. The bed is the least noticed and most studio-defining part.

Per-studio character (these are listening-based characterizations — the studios publish nothing; treat as informed estimates):

- **Pragmatic Play**: soft, airy launch **whoosh** into a low, unobtrusive hum/wind bed; the driving 130-140 BPM music (documented industry norm for slot soundtracks) carries the motion, and in tumble games (Gates of Olympus, Sweet Bonanza) the "spin" is mostly music + a drop whoosh — reviews describe the reel phase as music that "surges" and swells rather than a distinct mechanical loop, with stops delivered as "punchy snares, deep bass hits" (RapReviews analysis of Gates of Olympus).
- **Hacksaw Gaming**: closest to **near-silence**. Their documented design language is "narrow soundscapes built around rhythmic pulses... ambient textures," audio "applied with precision" only at feature moments. In practice (estimate): no audible bed at all — the music pulse continues untouched and short dry **ticks/clicks per reel stop** are the only spin-phase SFX. The spin reads through the stops, not through a loop.
- **Nolimit City**: documented "industrial scores, tense ambient sounds, visceral effects." Estimate from their catalog: a genuine **mechanical rattle/clatter layer** (chain, ratchet, metal) under the spin, theme-distorted (horror games add whispers/drones under the same rattle).
- **Aristocrat / IGT land-based steppers (the reference)**: physically generated — **stepper-motor whir** (a real pitched hum around the motor's pulse rate) + a hard **electromechanical clunk per reel stop**, with a bright chime layered on special stops. This is the sound every digital "mechanical" bed imitates. Video slots kept a synthetic "rolling" loop precisely because players expect the motor to be audible.

Commercial SFX libraries confirm the standard asset kit: "REEL SPIN START BUTTONs, smooth REEL SPIN WHOOSH noises, REEL STOPs... ANTICIPATION WIND-UPs" (SONNISS Universal Slots library, 430 files) — i.e. the industry ships start-whoosh, loop, anticipation, and stops as four separate assets.

## Level, mix and dynamic behavior

- **Bed sits far below music.** No studio publishes numbers; estimate from practice: **-12 to -18 dB relative to the music bus** for a hum/noise bed, -8 to -12 dB for a deliberately mechanical bed (Nolimit-style). The documented principle: "music sits in the background while sound effects sit up front" but the spin bed is the one SFX that behaves like background — it must survive the 100th repetition.
- **Ducking runs the other way.** The bed doesn't duck music; **stops and win sounds duck both**. A published Unity casino-adjacent recipe: duck-volume threshold **≈ -45 dB, ratio 250%** on the music bus keyed from SFX — aggressive, so even quiet ticks poke through. For slots a gentler 2-4 dB music dip on each reel stop (estimate) is typical.
- **Pitch/filter over spin duration**: flat during a normal spin (a bed that constantly rises would fatigue). It moves only in **anticipation**: documented behavior — "as the final reel slows... the pitch rises, the volume increases" and "sounds grow louder, notes climb higher, small pauses appear before the final symbol lands." Implementation: either swap to a dedicated anticipation wind-up asset or ramp playbackRate 1.0→1.15 + open a low-pass filter on the existing bed (estimate of common practice).
- **Turbo**: documented — turbo "shortens or reduces complexity" of audio and "often sacrifices any soundtrack or animations." In practice the bed is the first casualty: sub-second spins keep only start-click + stop hits; some games drop even the whoosh. Rule: **if the spin is < ~600ms, skip the loop entirely** — a loop that plays < 1 cycle sounds like a glitch.
- **Sonic fatigue is the design constraint**: Bally/GDC-circuit designers state the goal is audio that is "engaging, anticipatory" without fatigue; historical C-major tuning is documented as abandoned, but the bright/'audio bling' high-frequency bias for positive events persists (Karen Collins' research).

## Construction: loop texture, length, start/stop stitching

Three construction schools:
1. **Looped noise texture** (Pragmatic-style): band-passed wind/air whoosh, 1.5-3s seamless loop, no rhythmic content — safest, never fights the music's tempo.
2. **Rhythmic ticking/gears** (mechanical themes): commercial reel-spin loops ship at **3-4 seconds** (AudioJungle 'Slot Machine Reel Spin Loops': three seamless loops of 3s/4s/3s, 'turning gears... clicking and ticking... cogwheel rotation', 16-bit/44.1k WAV). Tick rate should imply reel speed — 8-14 ticks/sec reads as 'fast reel' (estimate).
3. **Musical bed**: no SFX loop at all; the music itself is written at 130-140 BPM with 'little audio hints — dinging and whooshing between spins' (Twenty Thousand Hertz, designer quotes). Hacksaw is the extreme of this school.

**Start stitching**: the bed never starts cold. Standard pattern: one-shot **spin-start whoosh (150-400ms) with the loop starting underneath it at 0 volume, faded in 80-150ms** so the whoosh masks the loop's entry (estimate of universal practice; granular synthesis is the documented technique for making the 'whirr of virtual reels' from the whoosh's own tail, so they share DNA and splice invisibly).

**End stitching** — two working patterns:
- **Cut on LAST stop** (most common): bed persists at full level through all five stops, then 50-100ms fade on the final stop; the stop hits are mixed loud enough to dominate it. Simple, robust.
- **Thin per reel** (premium feel): bed volume or filter steps down ~20% per stopped reel (5 reels: 100→80→60→40→20→0%), so the last reel spins in near-silence — this hands the stage to the anticipation layer. Estimate; matches the documented 'audio layering builds incrementally with each reel stop'.
- Never crossfade into music — music never stopped; the bed just leaves.

**Web implementation** (your PixiJS/HTML5 case): one Howler `Howl` with `loop:true` for the bed, `fade(vol,0,80)` on last stop; `rate()` ramp for anticipation. Web Audio loop-points (loop between two sample points after a one-shot head) let you ship start-whoosh+loop as ONE file — supported natively via `loopStart/loopEnd` on `AudioBufferSourceNode`. Per your repo's audio rule, ship as OGG.

## The stop-sound interplay: contrast is the whole game

The documented psychology: 'quiet moments make loud moments hit harder' — designers explicitly think in film terms. Two proven strategies:

- **Silence-before-stop (Hacksaw school)**: no bed → every dry tick stop is a figure on an empty ground. Works when stops are short (<80ms), bright (2-6kHz transient), and rhythmically even. The risk is the game feeling dead; Hacksaw compensates with a constantly pulsing music bed so 'silence' is really 'music-only'.
- **Bed-as-ground (Pragmatic/Nolimit school)**: the bed is a continuous ground that each stop **interrupts** — the stop reads as a change of state, not just a sound. Requires the bed to be spectrally OUT of the stop's way: bed lives < 500Hz + gentle noise, stops live 1-6kHz. If bed and stops share a band, stops smear and the spin feels mushy.
- **Escalation across stops** (documented): ascending-pitch stop sets are a standard library product ('5x ascending notes' scatter stops on AudioJungle); 'audio layering builds incrementally with each subsequent reel stop.' Keep normal stops identical or near-identical per reel, and reserve pitch-ascending stops for scatter/tease states — ascending EVERY spin fatigues and falsely signals significance.
- **Anticipation replaces the bed, never stacks on it**: when a 2-scatter tease triggers reel-5 slowdown, the bed ducks/thins and a dedicated wind-up (riser, rising pitch + volume, documented behavior) takes over. The stop that follows lands on the riser's peak — that gap ('small pauses appear before the final symbol lands') is the documented near-miss amplifier from Collins' research: 'sound increases the physiological and psychological response to near misses.'

## Recipe A — barn/farm slot (wooden reels, e.g. Crack Farm)

**Bed construction (3 layers, sum to one 2.4s seamless loop):**
1. **Wood rumble**: recorded rolling-pin-on-wood-table or wooden crate drag, pitched down -5 to -7 st, low-passed at 400Hz. This is the 'motor'.
2. **Tick layer**: dry wooden tick (pencil on hardwood / ratchet pawl on wood) at **10 ticks/sec**, ±3% random pitch per tick baked in, band 1-3kHz, mixed ~-6 dB under the rumble. This is the 'reel teeth' — the mechanical-rattle read.
3. **Air**: very quiet barn-room tone / faint wind, -18 dB under rumble, to hide the loop seam.
Loop at exactly 2.4s (24 ticks) — seam hidden in a tick transient.

**Start**: spin-start = existing wood-clatter whoosh (you already ship wood-clatter SFX per commit c8049be); bed enters under it with an 80ms fade-in, delayed ~60ms after the whoosh transient.

**Level**: bed at **-14 dB relative to music bus** (starting estimate; A/B at -12 and -16). No ducking of music by the bed. Each reel stop ducks music 2 dB / 120ms release (estimate).

**Stops**: per-reel **wooden clunk** (dropped plank + damped mallet on crate, 60-90ms) — identical sample, ±2% pitch randomization, NOT ascending. Bed thins per stop: multiply bed volume by 0.8 on each reel stop; `fade(current, 0, 80)` on reel 5. Scatter tease: on 2 scatters landed, crossfade bed (150ms) into a **rope-creak + rising fiddle-scrape riser** (~1.2s, pitch +4 st over duration), stop lands at riser peak.

**Turbo**: skip bed entirely (spin < 600ms); keep start-clatter at -3 dB and a single combined stop hit.

## Recipe B — synthwave/Miami slot (e.g. Vice Heat)

**Bed construction (2 layers, one 2.0s loop at the music's tempo — critical: this school is MUSICAL, the bed must be tempo-locked):**
1. **Filtered noise riser-plateau**: white noise through a band-pass sweeping 300Hz→1.2kHz over the first 300ms then HOLDING (not endlessly rising), light chorus, stereo width ~70%. Reads as 'engine of light', the digital answer to motor whir.
2. **Gated 16th-note arp**: single detuned-saw note (root of the music's key), sidechain-gated at 16ths from the music tempo (e.g. 125 BPM → 120ms per 16th), low-passed 2kHz, -8 dB under the noise layer. This is the 'ticking' translated to synth.
Loop = exactly 1 bar of the soundtrack so the seam is metric, not spliced.

**Start**: spin-start = short reverse-cymbal + laser-ish zap whoosh (250ms); bed enters ON the next 16th-note grid point after the button press (quantized entry ≤120ms latency — feels tight and musical).

**Level**: bed at **-12 dB vs music** (synth beds tolerate being slightly louder than mechanical ones because they read as part of the music; estimate). Optional: sidechain the bed itself from the music's kick 2-3 dB for cohesion.

**Stops**: per-reel **tape-stop / pitch-drop blip** (40ms, saw pluck with -12 st drop) + tiny noise tick on top. Keep pitch flat across reels 1-5 normally; scatter-tease stops use the ascending 5-note set (documented library pattern) in the music's key. Bed behavior on stops: do NOT thin per reel (kills the musical plateau) — cut with a 60ms fade + a 'power-down' filter sweep 1.2kHz→300Hz on the final stop, which doubles as the resolution gesture.

**Anticipation**: ramp bed playbackRate 1.0→1.12 + open filter to 4kHz over the reel-5 slowdown, add one rising synth-brass note (documented: pitch and volume rise into a brief pause before the final symbol).

**Turbo**: replace bed with just the gated arp layer at -16 dB (keeps groove continuity at sub-second spins), or drop it below 500ms spins.

## Sources

- [Twenty Thousand Hertz — Slot Machines: The addictive power of sound (designer interviews: 130-140 BPM, C-major history, fatigue, audio bling)](https://www.20k.org/episodes/slotmachines)
- [Collins et al. (2013) — The Impact of Sound on Psychophysical Response to Slot Machine Play (near-miss amplification, attention cueing)](https://www.greo.ca/Modules/EvidenceCentre/files/Collins%20et%20al(2013)The_impact_of_sound_on_psychophysical_response.pdf)
- [GDC Vault — Beyond Cha-Ching! Music for Slot Machines (Peter Inouye, Bally Technologies)](https://www.gdcvault.com/play/1017949/Beyond-Cha-Ching-Music-for)
- [SONNISS — Universal Slots Sound Effects Library (standard asset kit: spin whoosh, reel stops, anticipation wind-ups; 430 files)](https://sonniss.com/sound-effects/universal-slots-sound-effects-library/)
- [AudioJungle — Slot Machine Reel Spin Loops (3-4s seamless gear/tick loops)](https://audiojungle.net/item/slot-machine-reel-spin-loops/23798194)
- [AudioJungle — Slot Special Reel Stop (5x ascending-note scatter stop)](https://audiojungle.net/item/slot-special-reel-stop/27793463)
- [Editions Complexe — What anticipation animations signal during online slot spins (reel slowdown + rising pitch/volume behavior)](https://www.editionscomplexe.com/what-anticipation-animations-signal-during-online-slot-spins/)
- [RapReviews — Gates of Olympus sound effects analysis (stop hits: punchy snares, bass hits, hi-hat rolls)](https://www.rapreviews.com/2025/06/gates-of-olympus-sound-effects-resemble-modern-rap-production-elements/)
- [xsnoize — How Gates of Olympus uses music to enhance gameplay (music surges during tumbles/spins)](https://www.xsnoize.com/how-gates-of-olympus-uses-music-to-enhance-gameplay/)
- [GameDesigning.org — Behind the Speakers: How Slot Developers Design Audio (Hacksaw restraint, quiet-makes-loud principle)](https://gamedesigning.org/beyond/behind-the-speakers-how-slot-developers-design-audio-for-emotional-impact/)
- [GamblingNews — Behind the scenes: How Slots Sound Design is Heading for the Next Level (studio roundtable: mixing, 100th-repetition rule)](https://www.gamblingnews.com/news/behind-the-scenes-how-slots-sound-design-is-heading-for-the-next-level/)
- [Unity Learn — Audio mixing (duck volume recipe: threshold -45 dB, ratio 250%)](https://learn.unity.com/course/tanks-make-a-battle-game-for-web-and-mobile/tutorial/audio-mixing-1?version=6.0)
- [BetMGM — Should You Use Turbo Spin and Autoplay? (turbo sacrifices soundtrack/animations)](https://casino.betmgm.com/en/blog/guides/are-auto-spin-turbo-spin-worth-it-slots/)
- [Ironskullet — Slot Machine Sound Effects: How They're Made (granular synthesis for reel whirr, layering, rhythmic progression)](https://ironskullet.com/slot-machine-sound-effects-how-theyre-made-and-what-they-teach-us-about-music-production/)
- [IGT — Mechanical Reels / stepper product line (land-based stepper reference)](https://www.igt.com/products-and-services/gaming/mechanical-reels)
- [web.dev — Developing game audio with the Web Audio API (loop points, crossfades)](https://web.dev/articles/webaudio-games)
- [howler.js (loop, fade, rate control for HTML5 implementation)](https://howlerjs.com/)
