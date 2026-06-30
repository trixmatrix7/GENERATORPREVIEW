// spec/index.ts — THE FROZEN SPEC.
//
// This is the immutable core: the Fantasy Slots math + contract parity. Presets,
// the code panel, and the overlay can NEVER modify anything here — they only read
// it. Everything tunable/addable lives in `src/registries` (the OVERLAY).
//
//   SPEC (frozen)        = src/engine/* + src/config/{symbols,gameConfig,reels,paytable}
//   OVERLAY (yours)      = src/registries/* + presets + pasted code
//
// At runtime we deep-freeze the spec objects so a stray write throws instead of
// silently corrupting parity. If you ever need to change the actual game math,
// that's a NEW spec import (a new ZIP from the dev) — not an overlay edit.

import { SPEC, HOLD_WIN, GAME_META } from '../config/gameConfig';
import { PAY_TABLE, SCATTER_PAY } from '../engine/paytable';
import { REEL_STRIPS, REEL_COUNT, REEL_LENGTH } from '../engine/reels';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

/** The frozen spec surface. Read-only — the overlay adapts to THIS, never edits it. */
export const FROZEN_SPEC = deepFreeze({
  meta: GAME_META,
  math: SPEC,
  holdWin: HOLD_WIN,
  payTable: PAY_TABLE,
  scatterPay: SCATTER_PAY,
  reels: { strips: REEL_STRIPS, count: REEL_COUNT, length: REEL_LENGTH },
});

/** Human label for the loaded spec (shown in the UI as "frozen"). */
export const SPEC_LABEL = `${GAME_META.name} · ${GAME_META.gridType} · RTP ${SPEC.targetRtpPct}%`;

/** Compile-time guard: the overlay may only target these registries, never the spec. */
export const SPEC_IS_FROZEN = true as const;
