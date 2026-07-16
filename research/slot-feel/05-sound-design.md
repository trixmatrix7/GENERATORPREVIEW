# Slot SOUND DESIGN — the cross-studio bible

> Research sweep 2026-07-16. Estimates are marked as estimates.

## Executive summary

Slot audio "magic" is not better samples — it is a musical system: every stinger, reel stop, win jingle and rollup lives in the same key/tempo family as the base loop, fires on a beat grid, and sits in a disciplined mix with aggressive ducking. Nolimit City (Ableton, designers David/Viktor/Lars, "reverb on 99% of all SFX"), Hacksaw (Chaos Crew's bonus track good enough that players stream it standalone) and Pragmatic all treat the audio package as one composed piece, not a folder of SFX. The classic weaknesses of "almost right" packages are: reel stops that don't pitch-step left→right, win tallies whose length/coin-density doesn't scale with win size, stingers recorded in a different key than the loop, and no sidechain ducking, so celebration layers smear into mush. Research (Dixon/Collins, U. Waterloo) confirms the rollup sound itself drives the perceived win — skin-conductance to a celebrated 'loss disguised as win' matches a real win — so tally design is the highest-leverage single asset. Concrete numeric recipes (attack times, pitch curves, tally durations, LUFS targets, tier ladders) are given below, with analyst estimates marked [est.] where studios don't publish figures.

## Anatomy of a complete slot audio package (the checklist)

A competitive package (per game) contains roughly 40–80 assets. Cross-referencing commercial slot SFX libraries (Fusehive Universal Slots, SONNISS casino packs) and shipped games, the canonical set is:

1. **Base-game music loop** — 60–120 s, seamless loop, deliberately under-arranged (leaves the top octave and transient space free for SFX). Nolimit's David: 'the most challenging thing is to create short music loops that will not be boring after a while' — file-size limits force short loops, so use progressive layering (add hats/arp stems after N spins) instead of longer audio.
2. **Spin start** — button click (5–15 ms transient) + a short 'whoosh/sweep' as reels launch (100–300 ms, high-pass filtered noise) [est.].
3. **Reel spin bed** — low loopable whirr/air under the spin; many modern online slots (Hacksaw) run almost silent beds and let the music carry it.
4. **Per-reel stop ×5** — see dedicated section; ideally 5 distinct pitched variants, not one file ×5.
5. **Anticipation riser** — 1–2 loopable risers + a 'tease' loop for the slowed reel, plus a resolve-hit and a fail/near-miss tail.
6. **Scatter/bonus symbol land stinger** — one per scatter count (1st, 2nd, 3rd land escalate in pitch/size); Hacksaw reviews single out 'clear audio signals emphasizing free spins, retriggers, and multiplier increases'.
7. **Win presentation**: line/way hit sounds (small), win tally loop (count-up), tally terminator hit, and 3–5 win-tier jingles (nice/big/mega/epic).
8. **Big-win ceremony music** — a separate 15–30 s celebratory cue with coin-shower layer and tier-upgrade stingers.
9. **Free-spins music loop(s)** — David (Nolimit): 'normal bonuses, super bonuses and so on — we need more tracks to make each bonus more exciting'. Minimum: one FS loop + FS-intro stinger + FS-outro/total-win fanfare.
10. **Feature stingers** — wild expand, multiplier up, symbol transform, retrigger.
11. **UI clicks** — bet up/down, menu, autoplay; short (<80 ms), quiet (−20 dB rel. to wins) [est.].
12. **Ambient layer** — optional theme bed (crickets/wind for a barn; distant traffic/surf for Miami) at very low level, mono-compatible.

Gap test for the studio: if any of 4, 5, 7-terminator, or the tier ladder in 8 is missing or shared across tiers, that is where 'almost right' comes from.

## Reel stop sounds — the transient recipe

What Pragmatic/Hacksaw/Nolimit stops share (from listening analysis of Gates of Olympus, Chaos Crew, San Quentin — all [est.] since none publish specs):

- **Three-layer construction**: (a) low 'thunk' body 80–200 Hz giving weight, (b) mid 'click/clack' 1–3 kHz giving definition, (c) a theme flavor layer (wood clatter for farm, gated synth blip for synthwave). Sum length 80–150 ms; anything longer smears at turbo speed.
- **Attack**: near-instant, 0–5 ms; the thunk layer can have 5–10 ms attack so the click reads first. No reverb tail beyond ~150 ms on the stop itself (keep the board 'dry and tight'; put space on wins instead).
- **Pitch stepping left→right**: the classic pattern is each successive reel stop pitched UP ~1–2 semitones (or steps of a pentatonic/major scale in the game's key), so a full 5-stop sequence plays a rising motif. This is why good games feel 'musical' on every spin. Some studios instead keep pitch constant and only pitch UP the stops during anticipation. Recommended: scale steps in the game key, e.g. root–2nd–3rd–5th–octave [est., matches audible behavior in many Pragmatic/Play'n GO titles].
- **Timing**: the sound fires on the frame the reel's bounce-back begins (not when the symbols first reach position) — sound-on-impact, so the 'thunk' matches the visual settle. Stagger between reels ~120–200 ms normal, ~60–80 ms turbo [est.].
- **Variation**: 2–3 round-robin samples per reel or ±20–30 cents random pitch to kill machine-gun fatigue over thousands of spins.
- **Mix seat**: stops sit ABOVE the music in the 1–4 kHz band; carve a 2 kHz notch in the music loop so stops never fight it (frequency slotting, see mixing section).
- **Scatter lands override the normal stop**: replace (don't stack) reel N's stop with the scatter stinger, pitched to the same scale step, +3–6 dB louder.

## Win tally / rollup — the single highest-leverage asset

Research: Dixon, Collins et al. (J. Gambling Studies 2013, U. Waterloo) showed skin-conductance to 'losses disguised as wins' equals real wins when the celebration sound plays, and pairing them with silence/negative sound removes the effect — the rollup SOUND is the perceived win. Design it like this:

- **Structure**: [tier jingle intro hit] → [count-up loop] → [terminator]. The loop is a tight rhythmic bed (16th-note coin ticks / arpeggio in the game key); the terminator is a big resolving hit ON THE DOWNBEAT with a short coin splash + reverb tail — the only place a 1–2 s tail is welcome.
- **Duration maps to win size, not linearly**: small win ≈0.5–1 s (or skip tally, just play jingle); medium 1.5–3 s; big-win ceremony 5–10 s; land-based rollups historically ran much longer. Never let count-up speed be constant credits/sec — scale it so duration stays in these bands [est., standard industry practice].
- **Rising pitch/tempo during count-up**: the loop pitch-shifts up (+2 to +5 semitones total, stepped per tier boundary, staying on scale notes) and/or the tick density doubles as the counter accelerates. Gonzo's Quest cascades are the canonical reference: 'each cascade speeds up the audio, the pitch rises, the rhythm tightens.'
- **Coin-tick density scales with amount**: sparse ticks (8ths) for 1–5×, 16ths for 5–15×, continuous coin-shower granular layer above that. Ironskullet's production analysis names **granular synthesis** as the standard technique for cascading-coin textures — one 2 s coin-pile recording granulated gives infinite density control from a parameter.
- **The terminator must resolve harmonically**: Karen Collins documents that slots deliberately leave phrases UNRESOLVED on losses and resolve on wins — so end the tally on the tonic chord of the game key, downbeat-aligned. An off-key or off-beat terminator is exactly the 'lack of magic' symptom.
- **Skip/slam behavior**: on user tap, jump the counter and fire the terminator immediately — but still quantize it to the next 16th of the music grid (≤120 ms wait) so it lands musically [est., best practice].

## Musical key + tempo discipline — the missing 'magic' (most likely)

This is the strongest candidate for the studio's gap. The harmonizing practice, assembled from composer interviews (Laura Taylor, Willie Wilcox/Scientific Games, Peter Inouye/Light & Wonder 'Beyond Cha-Ching!' GDC 2013, Nolimit's team):

- **One root key per theme, documented**. The 'everything in C' story is a myth for modern games (Taylor: 'No, it's not') — but everything WITHIN one game shares a key family. Pick e.g. A minor for the synthwave game, D major/mixolydian for the barn game, and write it into the asset spec sheet. Every stinger, reel-stop scale, tally loop, jingle and terminator is authored in that key or its relative.
- **One tempo grid per game state**. Base loop e.g. 100 BPM, free spins 128 BPM (research cited by 20K Hertz: slots favor 130–140 BPM for excitement states, avoid ~80 BPM). All stingers are authored AT that BPM so their internal rhythm locks when triggered.
- **Quantize triggers to the beat grid**: fire stingers on the next 8th/16th note of the running loop rather than instantly (a 0–150 ms delay is imperceptible against animation but transforms cohesion). Middleware (Wwise/FMOD) does this natively ('stinger sync to bar/beat'); in a custom PixiJS engine it's ~20 lines: track loop start time, compute next grid point, schedule via WebAudio `AudioBufferSourceNode.start(t)`.
- **Risers resolve on the downbeat**: author anticipation risers at exact musical lengths (1 or 2 bars at game BPM) and time the reel-stop reveal to the bar line, not vice versa — i.e., let AUDIO timing quantize the animation (stretch the anticipation spin by up to ~200 ms to hit the bar) [est., standard interactive-music practice per Berklee/O'Reilly interactive-music texts].
- **Stingers as chord extensions**: write each stinger to start on a chord tone of whatever bar of the loop it may land on — practical shortcut: keep the loop's harmony static (one- or two-chord vamp) so any tonic-based stinger always fits. This is why so many slot loops are harmonically simple.
- **Shared motif**: one 3–5 note hook appears in the loop, the scatter stinger, the tally terminator and the big-win fanfare (transposed/re-orchestrated). This single trick makes a package feel 'composed', matching the studio's existing universal-marquee approach (one 5-note hook).

## Anticipation audio — riser construction and near-miss handling

When 2 scatters are locked and reel 4/5 slows:

- **Riser = 3 stacked elements**: (1) filtered white-noise sweep, low-pass opening from ~500 Hz to ~8 kHz over the riser length; (2) pitched element rising 1 octave (synth or string gliss, IN KEY, targeting the 5th or octave of the root); (3) pulse layer — heartbeat-style low thump or snare roll that accelerates (drum-roll accelerando is repeatedly cited across slot-psychology write-ups). Length: 1–2 bars of game BPM so the resolve lands on a downbeat.
- **Duck the music hard**: drop the base loop −6 to −12 dB (or low-pass it to ~800 Hz) for the anticipation window so the riser owns the spectrum; industry articles describe it as 'the audio gets quieter for a split second. Then a new sound cuts in.' [levels est.]
- **Reel-tease loop**: the slowed reel gets its own ticking loop (ratchet clicks) that decelerates with the reel — clicks mapped 1:1 to symbol pass-bys sells the physical connection.
- **Two endings, authored separately**: HIT = terminator hit + scatter stinger (pitched above the riser's end note) + immediate FS-trigger fanfare; MISS = the riser must NOT resolve — cut it with a short damped 'thud' and ~300–500 ms of near-silence before the music fades back in over ~1 s [est.]. That silence is the near-miss punch; research shows near-misses generate stronger arousal than ordinary losses, and the silence is what encodes 'so close'.
- **Escalate per scatter**: 1st scatter land = small chime; 2nd = bigger stinger + start heartbeat; 3rd = full hit. Each pitched a step higher than the last (audible in Pragmatic's Gates of Olympus scatter sequence [est.]).

## Big-win ceremony — layering and tier escalation

The ceremony is a MIX EVENT, not one file. Reference behavior (Pragmatic big/mega/epic, Nolimit, ELK Toro 7s' signature airhorns on countups):

- **Layer stack during ceremony**: (1) ceremony music cue (anthemic, same key, often double-time feel of base loop); (2) count-up tick layer (the tally, still running, still pitching up); (3) coin-shower granular bed whose density tracks the counter velocity; (4) tier-upgrade stingers; (5) crowd/applause or theme voice (Aristocrat Buffalo yells 'BUFFALO!'). Base game music is fully stopped, not ducked.
- **Tier ladder**: Pragmatic-style thresholds are Big ≈20–25×, Mega ≈50×, Epic/Olympus ≈100× bet [est. from observed games]. Each tier boundary during a single count-up fires: a riser (½ bar) → title-card slam ON the downbeat → key kick UP (music modulates +2 semitones or adds a layer). The count does NOT stop at boundaries; the slam rides over it.
- **The slam**: tier title-card hit = low boom (50–80 Hz, 5 ms attack) + cymbal/impact + the game's motif played by the full arrangement. Loudest single moment in the game, target ~−10 LUFS momentary [est.].
- **Ending**: counter finishes → terminator chord (tonic) → applause/coin tail decays ~2 s → base loop re-enters with a 1-bar fill, ideally on the next bar line rather than a cold restart.
- **ELK's airhorn lesson**: one absurd, ownable signature sound per studio in the countup (airhorn, whip crack, rooster for the barn game) is what streamers remember and imitate — a branding asset, not just SFX.

## Mixing: ducking, loudness, frequency slotting, reverb

- **Frequency slotting**: author the music loop to live in lows + low-mids (fundamental energy 100–800 Hz, gentle shelf down above 5 kHz); keep 1–4 kHz and 6–12 kHz headroom for SFX transients and coin sparkle ('winning sounds: bright, high-frequency, sparkly/tinkly' — Karen Collins). Research also warns to emphasize mid/low range in the LOOP specifically to prevent fatigue over long sessions.
- **Sidechain ducking conventions** [est. levels, standard practice]: wins/stingers duck music −4 to −8 dB (attack 10 ms, release 300–600 ms, release timed ≈ one beat at game BPM so the pump is musical); anticipation ducks −6 to −12 dB or low-pass; big win stops music entirely; UI clicks duck nothing.
- **Loudness targets**: mobile/handheld game integrated loudness ≈ −16 LUFS (PlayStation's mobile guideline is −18 ±2 LU); music stems ≈ −16 LUFS with ~10 dB dynamic range; true peak ≤ −1 dBTP. Make the big-win slam the loudness ceiling and scale everything down from it; if base-game spins already sit at −14, there is no headroom left for the ceremony — a classic 'no magic' cause.
- **Reverb**: Nolimit uses 'reverb on 99% of all sound effects... useful for creating the right feeling for the environment' — but SHORT ambience-matched reverb (barn = small wood room, 0.4–0.8 s; Miami = plate/hall 1–3 s with 30–80 ms pre-delay per synthwave practice). One shared send per game so all SFX sit in the same space; dry stops, wet wins.
- **QA ritual**: David (Nolimit): 'I always listen in different speakers and headphones to make sure it sounds good everywhere' — explicitly test phone speaker (mono, no bass): the thunk layer must have a 1 kHz component or stops vanish on phones.
- **Session-fatigue valve**: soften/limit stinger stacking over time; slot-audio pieces describe trimming 'the sound wall' after long sessions; cap simultaneous win-line voices (~4–6) and steal oldest voices.

## Authoring workflow, tools, and theme-specific foley (barn + Miami synthwave)

**Tools/workflow (Nolimit City reference)**: one composer-designer per game, Ableton Live + NI KOMPLETE + sample libraries + real guitar/bass/drums; ~1 game/month cadence; demo early, iterate with the game team ('the team's input for me is important'). Ironskullet: standard toolkit is layering + pitch/tempo adjust + reverb/compression in the DAW, with granular synthesis for coin cascades and hybrid sampling+synthesis (record real coins/bells, then process/pitch/layer).

**Barn/farm game (wood foley)**:
- Record a weathered wooden pallet with a broomstick levered between slats for creaks (documented foley staple); creaks read better recorded from a distance, hits close-miked.
- Reel stop = wood block/plank hit (close, low-tuned) + a small 'clatter' of dry seeds/grain in a wooden box for flavor + soft low thump. Kill tails.
- Win layers: banjo/fiddle plucks in game key for line hits; rooster crow as the studio signature; coin sounds can be swapped for grain-pour granular texture to stay in theme while keeping the coin-density behavior.
- Two-mic trick from foley guides: shotgun on the prop + condenser aimed away for room reflection = instant 'barn air' without a reverb plugin.

**Miami synthwave game (synthesis)**:
- Palette: Juno/Jupiter/Prophet-style saw pads, sparkling arpeggios, mono saturated saw/square bass, TR-808/LinnDrum drums, and the genre's defining GATED-REVERB SNARE (big reverb + hard noise-gate cutoff).
- Reel stop = short square-wave blip (pitched per reel on the minor scale) + gated noise burst + 808-style low tom for weight. Anticipation riser = resonant filter sweep on a saw chord + accelerating 16th-note arp.
- Sidechain pumping (kick ducks bass/pads) is genre-native — reuse the same sidechain bus to duck music under wins and it will feel stylistically intentional, not technical.
- Tally ticks = arpeggiator notes instead of coin ticks; terminator = gated-reverb snare slam + tonic power chord. Reverb: plate/hall 1–3 s, 30–80 ms pre-delay.

**Implementation note for the PixiJS runtime**: WebAudio gives sample-accurate scheduling (`source.start(atTime)`) — build a tiny 'conductor' object holding {bpm, barStartTime, key, scaleSteps[]} per game; all stinger triggers and reel-stop pitch choices query it. That one abstraction implements the entire key/tempo discipline section.

## Reference games to study (why each)

- **Chaos Crew (Hacksaw)** — bonus-round track so strong players stream it standalone; study how the bonus music is a real SONG with arrangement development, and how feature events (multiplier up) get clear pitched signals over it.
- **Gates of Olympus / Sweet Bonanza (Pragmatic)** — the industry-default tumble/tally grammar: per-tumble pitch escalation, scatter-land escalation, big/mega/epic tier slams; reviewers consistently note the soundtrack 'fits the theme perfectly' — i.e., competent, systematic, replicable.
- **Gonzo's Quest (NetEnt)** — canonical cascade audio: 'each cascade speeds up the audio, the pitch rises, the rhythm tightens.'
- **xWays Hoarder + The Crypt + Beelzebub (Nolimit)** — vocal hooks and full songs as bonus music ('Hell Yeah', 'Get My Bones Right' — 20K+ Spotify plays); the ceiling for music-as-brand.
- **Toro 7s (ELK)** — signature airhorn during big-win countups; the 'ownable sound' strategy.
- **Buffalo (Aristocrat)** — land-based master class in theme voice + escalating symbol-land audio (coin pops one by one, hoofbeats, 'BUFFALO!' call).
- **Immortal Romance (Games Global)** — bonus music with lyrics players remember years later.
- **The Final Countdown / The Cult series (Big Time Gaming)** — licensed-music route; note how reel sounds are tuned to the song's key.
- **Podcast/talks worth the hour**: Twenty Thousand Hertz 'Slot Machines' episode (Collins, Taylor, Wilcox); Composer Quest ep. 129 (High 5 Games trio on 'reel spins, rollups, symbols, celebrations, underscores'); GDC Vault 'Beyond Cha-Ching! Music for Slot Machines' (Peter Inouye, 2013).

## Action checklist for the studio (ordered by expected impact)

1. **Write a per-game audio spec sheet**: root key, scale, BPM per state (base/FS/ceremony), reel-stop scale steps, tier thresholds. One page. Everything authored against it.
2. **Re-pitch existing reel stops** onto the game scale with left→right stepping; add 2–3 round robins ±25 cents. (Hours of work, immediate 'musical' feel.)
3. **Build the conductor** (bpm/bar-grid scheduler in WebAudio) and quantize stinger/terminator triggers to the 8th/16th grid; make risers bar-length and let them resolve on downbeats.
4. **Rebuild the tally**: duration bands by win multiple, pitch-up steps, granular coin/grain/arp density tied to counter velocity, tonic-chord terminator on the downbeat, quantized skip.
5. **Add ducking**: one sidechain bus, music ducks −6 dB under stingers with beat-length release; full music stop + ceremony cue for big wins.
6. **Author the shared motif** per game and reuse it in loop, scatter stinger, terminator, big-win fanfare.
7. **Frequency-slot the loops** (shelf above 5 kHz, notch at 2 kHz) and master to −16 LUFS integrated / −1 dBTP with the big-win slam as ceiling.
8. **Record theme foley**: pallet+broomstick creaks and plank hits for the barn; synth-blip/gated-snare kit for Miami.
9. **Add near-miss silence**: 300–500 ms audio hole after failed anticipation before music returns.
10. **Phone-speaker QA pass** on every asset (mono, no <200 Hz).

## Sources

- [The Nolimit City Sound Guy Interview (Bigwinboard)](https://www.bigwinboard.com/the-nolimit-city-sound-guy-interview/)
- [Twenty Thousand Hertz — Slot Machines: The addictive power of sound](https://www.20k.org/episodes/slotmachines)
- [Slot Machine Sounds: How They're Made (Ironskullet)](https://ironskullet.com/slot-machine-sound-effects-how-theyre-made-and-what-they-teach-us-about-music-production/)
- [Using Sound to Unmask Losses Disguised as Wins in Multiline Slot Machines (Dixon, Collins et al., J. Gambling Studies)](https://link.springer.com/article/10.1007/s10899-013-9411-8)
- [The Impact of Sound on Psychophysical Response to Slot Machine Play (Collins et al., PDF)](https://www.greo.ca/Modules/EvidenceCentre/files/Collins%20et%20al(2013)The_impact_of_sound_on_psychophysical_response.pdf)
- [GDC Vault — Beyond Cha-Ching! Music for Slot Machines (Peter Inouye)](https://www.gdcvault.com/play/1017949/Beyond-Cha-Ching-Music-for)
- [Composer Quest Ep. 129 — Slot Machine Composing (High 5 Games)](https://www.charliemccarron.com/2015/10/slot-machine-composing/)
- [From Slots to Spotify: Top 10 Online Slot Soundtracks (Hideous Slots)](https://hideousslots.com/news/from-slots-to-spotify-top-online-slot-soundtracks/)
- [Behind the Speakers: How Slot Developers Design Audio for Emotional Impact (GameDesigning.org)](https://gamedesigning.org/beyond/behind-the-speakers-how-slot-developers-design-audio-for-emotional-impact/)
- [Psychology of Slot Game Sound Design (OnlineGamblingExperts)](https://www.onlinegamblingexperts.com/psychology-of-slot-game-sound-design/)
- [What anticipation animations signal during online slot spins (Editions Complexe)](https://www.editionscomplexe.com/what-anticipation-animations-signal-during-online-slot-spins/)
- [Frank Floor Talk: The siren calls of the casino floor (CDC Gaming)](https://cdcgaming.com/commentary/frank-floor-talk-the-siren-calls-of-the-casino-floor/)
- [Airwiggles — Peak level and LUFS for Game Audio](https://www.airwiggles.com/c/gameaudio/peak-level-and-lufs-for-game-audio)
- [Guide: Balancing a Game's Loudness (VNDev Wiki)](https://vndev.wiki/Guide:Balancing_a_Game's_Loudness)
- [Universal Slots Sound Effects Library (Fusehive / A Sound Effect)](https://www.asoundeffect.com/sound-library/universal-slots-sound-effects-library-modern-online-slot-game-sounds-and-win-tunes-royalty-free-sfx/)
- [Discover 5 Music Production Essentials Of Retro & Synthwave (ModeAudio)](https://modeaudio.com/magazine/synthwave-5-production-essentials)
- [Synthwave Production Techniques: Complete Guide (Sean Kim)](https://blog.imseankim.com/synthwave-retro-production-techniques-modern-tools/)
- [How To Create Foley For Games (Game Audio Learning Portal)](https://www.gameaudiolearning.com/knowledgebase/how-to-record-foley-for-games)
- [SFX / Foley tips (FilmSound.org)](http://www.filmsound.org/QA/sfx_tips.htm)
- [The Soundtrack of the Spin: How Slot Games Use Music to Hook Players (Gigwise)](https://www.gigwise.com/the-soundtrack-of-the-spin-how-slot-games-use-music-to-hook-players)
- [How Studio Music Is Made for Slot Machines (TLaudio)](https://www.tlaudio.co.uk/inside-the-studio-creating-music-for-slot-machines/)
