import { useEffect, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { formatUnits, parseUnits } from 'viem';
import { GAME_CONFIG } from '@/config/gameConfig';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  balance: string;
  decimals: number;
  tokenSymbol: string;
}

export function BetInput({ value, onChange, disabled, balance, decimals, tokenSymbol }: Props) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const balanceBig = BigInt(balance || '0');

  useEffect(() => {
    if (!isFocused) setLocalValue(value);
  }, [value, isFocused]);

  function toBigSafe(display: string): bigint {
    try { return parseUnits(display || '0', decimals); } catch { return 0n; }
  }

  function clamp(raw: bigint): bigint {
    const min = GAME_CONFIG.minBetBaseUnits;
    const max = balanceBig > 0n
      ? (balanceBig < GAME_CONFIG.maxBetBaseUnits ? balanceBig : GAME_CONFIG.maxBetBaseUnits)
      : GAME_CONFIG.maxBetBaseUnits;
    if (raw < min) return min;
    if (raw > max) return max;
    return raw;
  }

  function commitValue(display: string) {
    const raw = toBigSafe(display);
    if (raw > 0n) {
      onChange(display);
    } else {
      const minDisplay = formatUnits(GAME_CONFIG.minBetBaseUnits, decimals);
      setLocalValue(minDisplay);
      onChange(minDisplay);
    }
  }

  function handleChange(raw: string) {
    setLocalValue(raw);
    const parsed = toBigSafe(raw);
    if (parsed > 0n) onChange(raw);
  }

  function handleBlur() {
    setIsFocused(false);
    commitValue(localValue);
  }

  function handleHalf() {
    const current = toBigSafe(localValue);
    const half = clamp(current / 2n);
    const display = formatUnits(half, decimals);
    setLocalValue(display);
    onChange(display);
  }

  function handleDouble() {
    const current = toBigSafe(localValue);
    const doubled = clamp(current * 2n);
    const display = formatUnits(doubled, decimals);
    setLocalValue(display);
    onChange(display);
  }

  const balanceDisplay = formatUnits(balanceBig, decimals);

  const chipClass = [
    'w-[38px] h-[40px] shrink-0 flex items-center justify-center',
    'bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-[var(--radius-sm)]',
    'text-[var(--color-text-secondary)] font-[var(--font-body)] text-[13px] font-semibold',
    'cursor-pointer transition-all duration-150',
    'hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
    'active:scale-[0.95]',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
  ].join(' ');

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex justify-between items-center font-[var(--font-body)] text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.07em]">
        <span>Bet Amount</span>
        <span className="normal-case tracking-normal text-[11px]">
          {balanceDisplay} {tokenSymbol}
        </span>
      </div>
      <div className="flex gap-[5px] items-center">
        <div className={[
          'flex-1 min-w-0 flex items-center gap-1.5 h-[40px] px-2.5',
          'bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)]',
          'transition-colors duration-200',
          isFocused ? 'border-[var(--color-blue)] shadow-[0_0_0_2px_rgba(2,49,197,0.18)]' : '',
        ].join(' ')}>
          <Coins size={14} className="text-[var(--color-text-disabled)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[var(--color-text-primary)] font-[var(--font-body)] text-[15px] font-medium disabled:text-[var(--color-text-disabled)]"
            value={localValue}
            disabled={disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') inputRef.current?.blur(); }}
          />
          <span className="font-[var(--font-body)] text-[11px] font-medium text-[var(--color-text-disabled)] shrink-0">
            {tokenSymbol}
          </span>
        </div>
        <button className={chipClass} onClick={handleHalf} disabled={disabled} type="button">½</button>
        <button className={chipClass} onClick={handleDouble} disabled={disabled} type="button">2×</button>
      </div>
    </div>
  );
}
