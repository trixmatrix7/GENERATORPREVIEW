import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, ShieldCheck, ExternalLink, X, TrendingUp, TrendingDown } from 'lucide-react';
import { formatUnits } from 'viem';
import type { RecentBet } from '@/state/types';

interface Props {
  bets: RecentBet[];
  decimals: number;
  tokenSymbol: string;
  chainId: number;
}

export function RecentBets({ bets, decimals, tokenSymbol, chainId }: Props) {
  const { t } = useTranslation();
  const [selectedBet, setSelectedBet] = useState<RecentBet | null>(null);
  const [fairnessOpen, setFairnessOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-[var(--font-body)] text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.06em]">
          <History size={16} /> {t('recent_bets')}
        </span>
        <button
          className="flex items-center gap-1 bg-transparent border border-[var(--color-border)] rounded-[var(--radius-pill)] text-[var(--color-aqua)] font-[var(--font-body)] text-[11px] font-medium px-[10px] py-1 cursor-pointer transition-all duration-150 hover:bg-[var(--color-surface-raised)] hover:border-[var(--color-aqua)]"
          onClick={() => setFairnessOpen(true)}
          type="button"
        >
          <ShieldCheck size={16} /> {t('fairness')}
        </button>
      </div>

      <ul className="list-none flex flex-col gap-[3px] max-h-[200px] overflow-y-auto flex-1">
        {bets.length === 0 && (
          <li className="font-[var(--font-body)] text-[12px] text-[var(--color-text-disabled)] text-center py-6 px-3">
            {t('no_bets')}
          </li>
        )}
        {bets.map(bet => (
          <li
            key={bet.sessionId}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-raised)] rounded-[var(--radius-sm)] cursor-pointer transition-[background] duration-[120ms] font-[var(--font-body)] text-[13px] border border-transparent hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border)]"
            onClick={() => setSelectedBet(bet)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setSelectedBet(bet)}
          >
            <span className="flex-1 text-[var(--color-text-primary)] font-medium">
              {formatUnits(BigInt(bet.wager), decimals)} {tokenSymbol}
            </span>
            <span className="text-[var(--color-text-secondary)] min-w-[48px] text-right text-[12px]">
              {bet.multiplier.toFixed(2)}×
            </span>
            <span className={[
              'flex items-center gap-1 min-w-[52px] justify-end font-medium text-[12px]',
              bet.outcome === 'win' ? 'text-[var(--color-green)]' : 'text-[var(--color-text-disabled)]',
            ].join(' ')}>
              {bet.outcome === 'win'
                ? <><TrendingUp size={14} /> {t('win')}</>
                : <><TrendingDown size={14} /> {t('loss')}</>}
            </span>
          </li>
        ))}
      </ul>

      {selectedBet && (
        <BetModal
          bet={selectedBet}
          decimals={decimals}
          tokenSymbol={tokenSymbol}
          chainId={chainId}
          onClose={() => setSelectedBet(null)}
        />
      )}

      {fairnessOpen && <FairnessModal onClose={() => setFairnessOpen(false)} />}
    </div>
  );
}

function BetModal({ bet, decimals, tokenSymbol, chainId, onClose }: {
  bet: RecentBet; decimals: number; tokenSymbol: string; chainId: number; onClose: () => void;
}) {
  const explorerBase = getExplorerBase(chainId);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center z-[100]" onClick={onClose} role="dialog" aria-modal>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 w-[min(480px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto shadow-[var(--shadow-lg)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-[var(--font-display)] text-[18px] font-bold italic">Bet Verification</h3>
          <button className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer p-1.5 rounded-[var(--radius-sm)] flex transition-all duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-y-2 gap-x-4 font-[var(--font-body)] text-[13px] mb-4">
          <Row label="Bet ID" value={bet.sessionId} />
          <Row label="Wager" value={`${formatUnits(BigInt(bet.wager), decimals)} ${tokenSymbol}`} />
          <Row label="Payout" value={`${formatUnits(BigInt(bet.payout), decimals)} ${tokenSymbol}`} />
          <Row label="Multiplier" value={`${bet.multiplier.toFixed(2)}×`} />
          <Row label="VRF Randomness" value={bet.raw.randomness ?? '— pending settlement'} mono />
          <Row label="On-chain Game State" value={bet.raw.gameState ? shorten(bet.raw.gameState) : '—'} mono />
          <Row label="Outcome" value={bet.outcome === 'win' ? '✓ Win' : '✗ Loss'} />
        </dl>
        {bet.raw.requestId && explorerBase && (
          <a className="inline-flex items-center gap-1 text-[var(--color-aqua)] font-[var(--font-body)] text-[13px] font-medium no-underline transition-opacity duration-150 hover:opacity-80" href={`${explorerBase}/tx/${bet.raw.requestId}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} /> Verify On-Chain
          </a>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-[var(--color-text-secondary)] whitespace-nowrap font-medium">{label}</dt>
      <dd className={mono ? "font-mono text-[11px] bg-[var(--color-bg)] px-1.5 py-0.5 rounded-[var(--radius-xs)] break-all text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] break-all"}>
        {value}
      </dd>
    </>
  );
}

function FairnessModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center z-[100]" onClick={onClose} role="dialog" aria-modal>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 w-[min(480px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto shadow-[var(--shadow-lg)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-[var(--font-display)] text-[18px] font-bold italic"><ShieldCheck size={18} /> Provably Fair</h3>
          <button className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer p-1.5 rounded-[var(--radius-sm)] flex transition-all duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        {[
          'Every spin outcome is determined by an on-chain VRF (Verifiable Random Function) via the CasinoGameFacet on Base L2.',
          'Your game contract is a pure Solidity function: given the same randomness seed, it always produces the same reel stops and payout. You can independently verify any outcome using the on-chain transaction data and the open-source contract.',
          'No outcome is decided client-side. The frontend only renders what the chain confirms.',
        ].map((p, i) => (
          <p key={i} className="font-[var(--font-body)] text-[14px] text-[var(--color-text-secondary)] leading-[1.65] mb-3 last:mb-0">{p}</p>
        ))}
      </div>
    </div>
  );
}

function shorten(hex: string): string {
  return hex.length > 20 ? `${hex.slice(0, 10)}…${hex.slice(-8)}` : hex;
}

function getExplorerBase(chainId: number): string | null {
  if (chainId === 8453) return 'https://basescan.org';
  if (chainId === 84532) return 'https://sepolia.basescan.org';
  return null;
}
