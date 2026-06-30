// gameConfig.ts — Fantasy Slots spec constants (from the ZIP: src/config/gameConfig.ts,
// game.manifest.json, parity-manifest.json). These mirror SlotGame.sol exactly.

export const GAME_META = {
  name: 'Fantasy Slots',
  description: 'A high volatility 3125-ways slot game with Fantasy theme.',
  version: '1.0.0',
  gridType: 'ways-3125',
} as const;

/** Math / settlement constants — must match SlotGame.sol + paytable.ts. */
export const SPEC = {
  targetRtpPct: 96.2,
  houseEdgePct: 3.8,
  rtpBps: 9620,

  maxWinMultiplier: 5000, // MAX_WIN_MULTIPLIER — total spin win cap (× bet)
  bpsDivisor: 10_000, // BPS_DIVISOR
  minMatchingReels: 3, // MIN_MATCH

  // Free spins
  freeSpinsCount: 18, // FREE_SPINS_COUNT
  freeSpinsMultiplier: 18, // FREE_SPIN_MULTIPLIER (flat)
  freeSpinsCap: 50, // FREE_SPINS_CAP (max plays)
  freeSpinsTriggerScatters: 3,

  // Bonus buy — cost as ×100 of base bet (0 disables). Fantasy spec = 0 (disabled on-chain),
  // but the preview exposes a buy control for testing the FS feature.
  bonusBuyCostX100: 0,
} as const;

/** Hold & Win constants — mirror SlotGame.sol _playHoldAndWin + src/engine/holdAndWin.ts. */
export const HOLD_WIN = {
  triggerMinCoins: 6, // HW_TRIGGER_MIN
  startRespins: 3, // HW_START_RESPINS
  landProbBps: 550, // HW_LAND_P_BPS (0.055)
  jackpotProbBps: 400, // HW_JACKPOT_P_BPS (0.04)
  grandValue: 500, // HW_GRAND_VALUE (full-board grand, in bet-multiples)
  coinValues: [1, 1, 1, 2, 2, 3, 5, 10], // HW_COIN_VALUES
  jackpots: [15, 40, 150], // [MINI, MINOR, MAJOR]
} as const;

/** Preview-only bet ladder (display units). On-chain bet is base units; here it's a display number. */
export const BET_LEVELS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
export const DEFAULT_BET_INDEX = 3; // 1.00

/** Win tiers (× bet) for celebration screens — preview default thresholds. */
export const WIN_TIERS = {
  small: 0, // 0–2×
  normal: 2, // 2–10×
  big: 10, // 10–50×
  mega: 50, // 50×+
} as const;
