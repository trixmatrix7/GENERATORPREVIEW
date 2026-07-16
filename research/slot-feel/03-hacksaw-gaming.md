# Hacksaw Gaming — the formula

> Research sweep 2026-07-16. Estimates are marked as estimates.

## Executive summary

Hacksaw Gaming's "clean and modern" feel is a deliberate system: flat 2D vector/comic art that rejects glossy 3D casino rendering, portrait-mobile-first layouts designed for the smallest screen first, high-contrast readable symbols, and a UI kept identical across every title. Win and feature presentation concentrates spectacle into a few engineered peaks (full-reel VS-duel multipliers, collect-then-Showdown structures, screen takeovers) while the base game stays visually quiet. Audio follows the same shape: restrained ambient music that "whispers when the reels fall still" and creeps up rather than blares, dry percussive event sounds, and dynamic escalation only when something connects. The commercial wrapper is a standardized multi-tier FeatureSpins/bonus-buy menu (3x boosted spins up to 400x direct buys) that made them the streamer-era studio. The exportable formula: subtract decoration everywhere, then spend the whole saved attention budget on 2-3 peak moments.

## Studio identity and signature games (stat sheet)

Hacksaw started in scratchcards, pivoted to slots around 2019-2020 with the portrait-first 'Pocketz' series, and reached prime lobby positions within ~18 months (COO Marcus Cordes, SlotCatalog interview). They rode the Twitch/streamer wave harder than anyone: TrainwrecksTV and Roshtein buying straight into Dead Man's Hand / Duel at Dawn made the games famous, because 'even a losing bonus still creates drama.'

Reference stat sheet (from bigwinboard reviews):

| Game | Grid / win type | RTP | Hit freq | Volatility | Max win | Buy costs |
|---|---|---|---|---|---|---|
| Wanted Dead or a Wild (2021) | 5x5, 15 fixed lines | 96.38% | 19.3% | High 4/5 | 12,500x | 80x / 200x / 400x |
| Chaos Crew | 5x5, 15 lines | 96.30% | 23.4% | 5/5 | 10,000x | (bonus buy RTP 95.92%) |
| Le Bandit (2023) | 6x5 cluster (5+ connected), Super Cascades | 96.34% | 32.47% | Med 3/5 | 10,000x | 3x / 50x / 100x / 250x |
| Hand of Anubis | 5x6 cluster + tumble | 96.24% | 36% | 5/5 'extreme' | 10,000x | 129x / 200x |
| Dork Unit | 5x4, 16 lines | 96.24% | 30.96% | Med 3/5 | 10,000x | 3x / 100x / 200x |
| RIP City | 5x5 lines | 96.22% | 18% | Med 3/5 | 12,500x | (max-win odds ~1 in 6,000,000) |

Pattern to copy: RTP always ~96.2-96.4 default with 3-4 downgradable variants (94.x / 92.x / 88.x); max win pinned at a marketable round number (10,000x or 12,500x); exactly 2-3 named bonus rounds per game, each individually triggerable AND buyable. Note the identity split: line games (Wanted, Chaos Crew, RIP City) run low hit frequency 18-23% and feel dry-then-explosive; cluster/cascade games (Le Bandit, Hand of Anubis) run 32-36% hit frequency for constant micro-motion. Both share the same shell.

## Art direction: the flat-crisp anatomy

What reviewers and analysts consistently identify:

- REJECTION of the late-2010s 'gaudy, glittering' 3D-rendered casino look. Instead: clean, flat, cartoonish vector graphics 'that popped cleanly on small screens' with a graphic-novel / street-art edge (BitcoinChaser analysis). Bigwinboard repeatedly calls the house style 'retro Disney / Hanna-Barbera' (RIP City, Le Bandit) - bold-outline anthropomorphic characters, deliberately limited animation frames.
- LIMITED PALETTES with one violent accent axis: RIP City is 'black, grey, and white as the predominant tones while liberally splashing around pinks, yellows, blues, and greens.' Chaos Crew clashes 'wild pinks and cyan' against a dark moody backdrop. Wanted uses a blood-red smouldering-sun sky over near-silhouette 'twisted trees and a barbed-wire fence' - the background 'almost looks like a canvas... not much distinguishing detail' (Fruityslots). Backgrounds are intentionally low-information so the grid owns 100% of attention.
- MOBILE-FIRST literally: Cordes states every game is designed 'for the smallest screen first' (portrait), then scaled up. That forces bold silhouettes, thick outlines, and no fine detail that dies at 60px symbol size. Symbols 'read instantly at any screen size.'
- RETRO TRICKS as intentional style: for Stick 'em they used 'a colour offset across the game and a LOWER FRAME RATE in the animations to mimic the old cartoon style' (Cordes) - i.e., stepped/held-frame animation is a feature, not a performance compromise. Actionable in Pixi: animate character sprites at 8-12fps steps while tweens/particles run at 60fps.
- CHARACTERS LIVE OUTSIDE THE GRID: Smokey the raccoon (Le Bandit), the two jackal deities (Hand of Anubis), Cranky and Sketchy (Chaos Crew) sit beside/behind the grid, mostly idle, occasionally reacting with speech-bubble quips - ambient personality that never blocks reels.
- Tone range is wide (dark-foreboding Hand of Anubis vs candy-bin 1970s-kids-TV Dork Unit) but the RENDERING language (flat, chunky, outlined, high-contrast) never changes - that is why any Hacksaw game is recognizable in one screenshot.

## Win and feature presentation

- BASE WINS ARE UNDERSTATED: line/cluster hits get a quick symbol highlight and a clean win-amount pop; no long celebration on small wins. Multiple analysts: 'even though games can be chaotic, the UI stays clean so you always see what created the spike' - multiplier values are always numerically visible ON the symbols (VS reels show their 2x-100x number permanently), so streams and thumbnails are self-explanatory.
- THE VS DUEL (Wanted Dead or a Wild): VS symbol lands, expands to full-reel wild; two outlaws appear on either side of the screen, each revealing a multiplier 2x-100x; a quick gun duel animation plays and the SURVIVOR'S multiplier applies to the whole reel. Multiple VS reels in one win ADD their multipliers, then multiply line wins. This is their masterpiece of 'mechanic as theater': the RNG reveal is staged as a 1-2 second character duel (estimate) instead of a number flip.
- COLLECT-THEN-DETONATE structure (Dead Man's Hand): phase 1 collects wilds and multipliers, counter resets to 3 spins on every collect (classic near-miss engine, up to ~10 wilds and 27x-31x seen in testing); phase 2 'Showdown' places ALL collected wilds on the grid for 3 spins with the summed multiplier - deliberate delayed-gratification detonation. Bigwinboard: 'a real blast.'
- STICKY/RESPIN PRESENTATION (Le Bandit): winning clusters leave GOLDEN SQUARES burned into the grid background - persistent state painted on the board itself, not in a side meter. A Rainbow symbol then 'activates' all golden squares, flipping each to reveal Bronze/Silver/Gold coins, Pot of Gold or Clover. Super Cascade: a win removes ALL symbols of the winning type (not just the winners), making cascades feel surgical and fast.
- Escalation is spatialized: Chaos Crew accrues persistent multipliers displayed ABOVE each reel; Hand of Anubis builds an 'Underworld' multiplier row BELOW the grid activated by orbs landing above it. Progress is always physically on the play area.
- Personality in dead moments: Chaos Crew placeholder symbols flash 'Nope!' text on non-hits - the game acknowledges dead spins with a wink instead of silence.
- Hidden 'epic' tier: several titles hide an undocumented Hot Mode / Hidden Epic Bonus (e.g. 5 scatters simultaneously in Rad Maxx = 'TO THE MAXX!'), giving streamers a rare discoverable super-event.
- Win-tier ceremony exists (Big Win count-up with tier cards) but is short and skippable; the count-up ticks fast (estimate: full 10,000x ceremony under ~8s, small wins resolve in well under 1s - consistent with reviewer descriptions of 'snappy pacing, crisp animations').

## Audio identity: dry, spare, then it explodes

- The most-quoted line (Wanted, Fruityslots): 'The slow soundtrack that WHISPERS when the reels fall still ties in nicely with the theme... the upbeat acoustic music that ensues when things start to kick off really makes it a solid experience.' Idle state is near-silence with sparse ambience (distant gunfire, rattlesnakes in Wanted); intensity is reserved for connection moments. OutOfOfficeNY: the 'soundtrack often creeps up on you rather than blaring in your face.'
- DYNAMIC MUSIC ENGINE from day one: Cordes says their very first slot shipped 'a music engine with dynamic progression to enhance the player's experience' - layered stems that add intensity as features approach/land, rather than separate looped tracks (base loop -> anticipation layer -> feature blowout).
- EVENT SOUNDS ARE DRY AND PERCUSSIVE: reel stops are short transient thuds/clicks with almost no reverb tail (estimate from play: stop transients ~50-100ms, tightly gated), so 5 stops in sequence read as a drum fill, not mush. Feature triggers get one crisp signature hit - Chaos Crew free spins fire 'a quick little record scratch sound.' Wanted: pistol cracks on duels, a 'ker-ching' on balance credit.
- MUSIC AS THEME COMMENTARY, NOT PASTICHE: Wanted avoids 'cheerful cowboy melodies' for dark country guitar riffs over ambient dread; Chaos Crew backs punk visuals with an electro track that 'sounds nothing like the original punk sound while still conveying the ethos,' plus 'a lone, mournful piano tune' drifting over the noise - one incongruous melodic element on top of the bed is a recurring Hacksaw trick. Dork Unit went full hummable: 'ragtime loops and staccato horn stabs' (bigwinboard called it Hacksaw's most hummable release).
- SILENCE AS DYNAMIC RANGE: because the base bed is so quiet/dry, the feature music explosion lands with enormous perceived loudness without clipping. Practical mix rule (estimate): base ambience sits ~-12 to -18dB below feature music; reel-stop SFX punch through both.
- Hacksaw publishes its OSTs (YouTube 'Hacksaw Slots Music' series, Apple Music, SoundCloud) - the music is treated as brandable IP, which tells you how much identity weight they put on it.

## FeatureSpins / bonus-buy UX

Hacksaw standardized a MULTI-TIER buy menu that is identical across the portfolio (a dedicated menu screen listing every option with its cost multiple and its own certified RTP):

- Tier 0 - 'BonusHunt FeatureSpins' at 3x stake: not a bonus purchase but a boosted-spin MODE - bonus trigger chance ~5x normal, or a guaranteed mechanic per spin (Spinman: 2 guaranteed hero symbols; Miami Mayhem: 2 guaranteed expanding reels). This keeps 'playing the base game' interesting for grinders and streamers between buys.
- Tiers 1-3 - direct buys of each named bonus, priced by volatility: Le Bandit 50x / 100x / 250x; Dork Unit 100x / 200x; Wanted 80x / 200x / 400x; Hand of Anubis 129x / 200x. Each row shows its own RTP (Le Bandit: 96.28-96.4% depending on option, vs 96.34% base) - transparent, so the buy never feels like a worse deal.
- UX consequences worth copying: (1) one consistent menu layout portfolio-wide - 'bet selectors, win displays, and info panels in identical positions across all titles'; (2) every option named like a product (Duel at Dawn, All That Glitters Is Gold, Luck Of The Bandit), not 'Bonus 1/2/3'; (3) the ladder of price points (3x -> 50x -> 100x -> 250x -> 400x) creates a spend staircase and gives streamers a menu of content beats.
- Reviewer-noted design tension: base games are often deliberately dry ('RIP City chewed through masses of regular spins with few natural bonus triggers, making the bonus-buy button appealing'; Dork Unit base 'pretty dry') - the drought IS part of the buy-menu funnel. Decide consciously if you want that.

## Pacing (estimates marked)

- Portfolio positioning: 'built around fast pacing and feature-driven gameplay... great for short, high-intensity sessions' (BonusRiver); 'animations stay tight and snappy, which keeps spins feeling fast when playing multiple rounds' (Spinman review).
- ESTIMATES from play/footage: default spin-to-result ~1.5-2.0s; reels stop in a fast left-to-right ripple ~80-120ms apart rather than long sequential stops; quick-spin/turbo cuts a full cycle to ~1s; cascade steps in Le Bandit/Anubis resolve in ~350-500ms each (remove -> drop -> settle); small win presentation adds <1s; no forced multi-second celebration below big-win tier. Anticipation slow-downs (scatter tease) are used sparingly - only when 2 bonus scatters are already down - so they retain their meaning.
- The tempo CONTRAST is the design: quiet fast base -> occasional 1-2s staged reveal (duel) -> long-form ceremony only in bonuses (Dead Man's Hand collect phase intentionally elastic via its reset-to-3 counter). Bigwinboard on Wanted: 'bonus games bucked all over the place... regardless of the official volatility rating' - the pacing variance inside the bonus is what creates the drama.
- Load times are part of feel: pure HTML5, 'extremely fast loading times even on slower connections' - light flat art doubles as a performance budget.

## The Hacksaw formula, synthesized (actionable checklist)

Why it feels 'clean and modern' - each point maps to a concrete implementation rule for a PixiJS studio:

1. SUBTRACT FIRST. Low-detail canvas-like background, limited palette + one accent axis, no ambient particle spam, no chrome/gloss. The grid is the loudest thing on screen. (Rule: if a pixel does not carry game state, dim it.)
2. READABILITY = LUXURY. Thick-outline flat symbols designed at phone size first; multiplier numbers permanently rendered on the symbols that carry them; 'the UI stays clean so you always see what created the spike.'
3. ONE RENDERING LANGUAGE, MANY TONES. Themes swing from horror to candy, but flat/chunky/outlined + character-beside-grid + identical control layout never change. Consistency across titles is itself the brand.
4. SPECTACLE IS RATIONED. Base wins resolve in <1s; the saved attention budget is spent on 2-3 staged peaks: mechanic-as-theater reveals (VS duel), collect-then-detonate bonuses (Showdown), persistent state painted onto the board (Golden Squares, above-reel multipliers).
5. AUDIO MIRRORS VISUALS. Near-silent dry base (whispering ambience), tight percussive reel stops and one signature transient per event (record scratch, pistol crack), dynamic-layer music engine that only fully opens in features. Silence is the headroom that makes the explosion feel huge.
6. STEPPED CHARACTER ANIMATION (8-12fps holds) over smooth tweens for props/wins - reads as intentional style, saves performance, matches the flat art.
7. COMMERCIAL SHELL IS STANDARDIZED. Same buy-menu UX everywhere: named bonuses, tiered prices (3x boosted mode up to 400x top buy), per-option RTP shown. RTP ~96.3 with downgrade variants, round-number max win (10,000x/12,500x), 2-3 bonuses per game.
8. DESIGN FOR THE CLIP. Every peak moment must be legible in a 10-second vertical clip with the numbers visible - that is the streamer-era acceptance test Hacksaw applies, implicitly, to everything.

## Sources

- [Wanted Dead or a Wild - Bigwinboard review](https://www.bigwinboard.com/wanted-dead-or-a-wild-hacksaw-gaming-slot-review/)
- [Le Bandit - Bigwinboard review](https://www.bigwinboard.com/le-bandit-hacksaw-gaming-slot-review/)
- [Chaos Crew - Bigwinboard review](https://www.bigwinboard.com/chaos-crew-hacksaw-gaming-slot-review/)
- [Dork Unit - Bigwinboard review](https://www.bigwinboard.com/dork-unit-hacksaw-gaming-slot-review/)
- [Hand of Anubis - Bigwinboard review](https://www.bigwinboard.com/hand-of-anubis-hacksaw-gaming-slot-review/)
- [RIP City - Bigwinboard review](https://www.bigwinboard.com/rip-city-hacksaw-gaming-slot-review/)
- [Marcus Cordes (COO) interview - SlotCatalog](https://slotcatalog.com/en/read/interviews/Marcus-Cordes-COO-at-Hacksaw-Gaming-enters-the-spotlight-for-this-weeks-game-studio-interview)
- [Wanted Dead or a Wild - Fruityslots review](https://fruityslots.com/slots/reviews/wanted-dead-or-a-wild/)
- [Hacksaw Gaming provider review - OutOfOfficeNY](https://outofofficeny.com/gambling/hacksaw-gaming-provider-review-artful-chaos-high-volatility-and-slots-that-bite-back/)
- [How Hacksaw Rode the Streaming Wave - BitcoinChaser](https://bitcoinchaser.com/hacksaw-gaming-rode-streaming-wave/)
- [Hacksaw Hidden Epic Bonuses / Hot Mode guide - LTC Casino](https://www.ltccasino.io/cryptocasino/hacksaw-hidden-epic-bonuses/)
- [Hacksaw Gaming review: why their slots are going viral - Twinqo](https://blog.twinqo.io/hacksaw-gaming-review-why-their-slots-are-going-viral/)
- [Hacksaw Gaming provider page - Bigwinboard](https://www.bigwinboard.com/online-casino-game-developers/hacksaw-gaming/)
- [Hacksaw Slots Music OST series - YouTube](https://www.youtube.com/playlist?list=PLbgjqVycCqtSWDV_9_2jb1APCuXFqXtCC)
