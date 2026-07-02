// Vendored from @chain-protocol/games-sdk — canonical types (CTO spec verbatim)
// If the npm package becomes available, replace this with the published package.

export type HexString = `0x${string}`;

export type CasinoGameManifestV1 = {
  schemaVersion: 1;
  gameId: string;
  apiVersion: 1;
  defaultLocale: string;
  locales: Record<
    string,
    {
      name: string;
      description?: string;
    }
  >;
  assets?: {
    iconUrl?: string;
    coverUrl?: string;
  };
};

export type HostSnapshotV1 = {
  apiVersion: number;
  integration: {
    chainId: number;
    slug: string;
    gameAddress: `0x${string}`;
    manifest: CasinoGameManifestV1;
  };
  wallet: {
    address?: `0x${string}`;
    smartVaultAddress?: `0x${string}`;
    status: 'ready' | 'disconnected' | 'setup-required' | 'session-key-mismatch';
  };
  token: {
    symbol?: string;
    decimals?: number;
  };
  balances: {
    smartVaultBalance?: string;
  };
  casino?: {
    availableLiquidity?: string;
    maxBetRiskBps?: number;
    maxAllowedReservedProfit?: string;
  };
  sessions: {
    items: Array<{
      sessionId: string;
      sessionKey: string;
      gameAddress: `0x${string}`;
      phase?: number;
      phaseName?: string;
      wager?: string;
      payout?: string;
      outcome?: number;
      isSettled: boolean;
      openedAt?: number;
      settledAt?: number;
      lastEventTimestamp: number;
      raw: {
        gameData?: HexString;
        gameState?: HexString;
        randomness?: HexString;
        requestId?: HexString;
      };
    }>;
  };
  ui: {
    locale: string;
    theme: 'light' | 'dark' | 'system';
  };
};

export type HostApiV1 = {
  openSession(input: {
    wager: string;
    gameData: HexString;
    randomnessRequestData?: HexString;
  }): Promise<{ sessionKey: string; transactionHash: HexString }>;
  submitAction(input: {
    sessionId: string;
    actionData: HexString;
    randomnessRequestData?: HexString;
    approvalAmount?: string;
  }): Promise<{ transactionHash: HexString }>;
  cancelStuckRandomness(input: { sessionId: string }): Promise<{ transactionHash: HexString }>;
};

export type GuestApiV1 = {
  setState(snapshot: HostSnapshotV1 | null): Promise<void>;
};

export type CasinoGameManifestValidationResult =
  | { ok: true; manifest: CasinoGameManifestV1 }
  | { ok: false; reason: string };

export type GameManifestLocale = {
  locale: string;
  name: string;
  description?: string;
};

export type GameManifestMetadata = {
  locale: string;
  name: string;
  description?: string;
  iconUrl?: string;
  coverUrl?: string;
};

export type SessionItem = HostSnapshotV1['sessions']['items'][number];
