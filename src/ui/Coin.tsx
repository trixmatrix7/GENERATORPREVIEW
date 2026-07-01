// ui/Coin.tsx — the chain.wtf coin mark. Per the design kit, amounts show a coin
// glyph, never the text "USDC".
export function Coin({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="coin" aria-hidden="true">
      <defs>
        <linearGradient id="coinG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe98a" />
          <stop offset="1" stopColor="#ffcf33" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#coinG)" stroke="#b8860b" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#b8860b" strokeWidth="1.1" opacity="0.55" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#7a5a00" fontFamily="Poppins, sans-serif">
        $
      </text>
    </svg>
  );
}
