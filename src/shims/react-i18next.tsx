// react-i18next shim — the preview runs standalone (English only), so the dev
// files that call useTranslation() compile verbatim without pulling in i18next.
// Keys mirror src/i18n/locales/en.json from the dev repo for the strings the
// ported UI actually uses.

// Verbatim from the dev repo's src/i18n/locales/en.json.
const STRINGS: Record<string, string> = {
  connecting: 'Connecting to chain.wtf…',
  mode_manual: 'Manual',
  mode_auto: 'Auto',
  bet_amount: 'Bet Amount',
  spin: 'SPIN',
  skip: 'SKIP',
  turbo: '⚡',
  stop_auto: 'Stop Auto ({{count}} left)',
  win_chance: 'Win Chance',
  profit_on_win: 'Profit on Win',
  total_win: 'Total Win ({{multiplier}}×)',
  free_spins_badge: 'FREE SPINS — {{count}} played',
  auto_spins_label: 'Number of spins',
  audio_label: 'Audio',
  wallet_disconnected: 'Connect your wallet to play.',
  wallet_setup_required: 'Wallet setup required.',
  insufficient_balance: 'Insufficient balance',
  error_dismiss: 'Dismiss',
  fairness: 'Fairness',
  recent_bets: 'Recent Bets',
  win: 'WIN',
  loss: 'LOSS',
  no_bets: 'No bets yet',
};

function translate(key: string, opts?: Record<string, unknown>): string {
  let out = STRINGS[key] ?? key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
    }
  }
  return out;
}

const i18nObject = {
  t: translate,
  language: 'en',
  changeLanguage: async (_lng?: string) => i18nObject,
};

export function useTranslation() {
  return { t: translate, i18n: i18nObject };
}

export const initReactI18next = { type: '3rdParty' as const, init: () => {} };

export const Trans = ({ children }: { children?: unknown }) => children as never;
