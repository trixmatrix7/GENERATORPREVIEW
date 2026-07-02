import { useTranslation } from 'react-i18next';

interface Props {
  isLoading: boolean;
  canSkip: boolean;
  onSpin: () => void;
  onSkip: () => void;
  disabled: boolean;
}

export function SpinButton({ isLoading, canSkip, onSpin, onSkip, disabled }: Props) {
  const { t } = useTranslation();

  if (canSkip) {
    return (
      <button
        className="w-full h-[46px] flex items-center justify-center
          bg-[var(--color-surface-raised)] border border-[var(--color-border)]
          text-[var(--color-text-secondary)] font-[var(--font-display)] text-[14px] font-semibold italic tracking-[0.04em]
          rounded-[var(--radius-pill)] cursor-pointer
          transition-all duration-150
          hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
          active:scale-[0.98]"
        onClick={onSkip}
        type="button"
        aria-label="Skip animation"
      >
        {t('skip')}
      </button>
    );
  }

  return (
    <button
      className="btn-spin-sheen relative overflow-hidden w-full h-[46px] flex items-center justify-center gap-2
        bg-[linear-gradient(180deg,#0843E8_0%,var(--color-blue)_100%)]
        text-[var(--color-text-primary)] font-[var(--font-display)] text-[16px] font-bold italic tracking-[0.06em]
        border-none rounded-[var(--radius-pill)] cursor-pointer
        shadow-[var(--shadow-glow-blue),var(--shadow-md)]
        transition-all duration-200
        hover:brightness-110 hover:-translate-y-px
        active:scale-[0.98] active:translate-y-0 active:shadow-[var(--shadow-sm)]
        disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
      onClick={onSpin}
      disabled={disabled || isLoading}
      type="button"
      aria-label="SPIN"
    >
      {isLoading ? <Spinner /> : t('spin')}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="animate-spin-fast inline-block w-5 h-5 rounded-full border-[2.5px] border-white/25 border-t-white"
      aria-hidden
    />
  );
}
