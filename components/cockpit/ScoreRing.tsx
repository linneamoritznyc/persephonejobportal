export default function ScoreRing({ score, low, high, size = 56 }: { score: number | null; low?: number | null; high?: number | null; size?: number }) {
  const s = score == null ? 0 : Math.max(0, Math.min(100, score));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = s > 85 ? "var(--color-green)" : s >= 60 ? "var(--color-gold)" : "var(--color-amber)";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} aria-label={score == null ? "No score" : `Score ${Math.round(s)}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line)" strokeWidth="4" fill="none" />
        {low != null && high != null ? (
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-silver)" strokeOpacity=".25" strokeWidth="6" fill="none" strokeDasharray={`${(c * (high - low)) / 100} ${c}`} strokeDashoffset={(-c * low) / 100} />
        ) : null}
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={`${(c * s) / 100} ${c}`} style={{ transition: "stroke-dasharray 200ms" }} />
      </svg>
      <span className="absolute num font-semibold" style={{ fontSize: size * 0.3 }}>{score == null ? "-" : Math.round(s)}</span>
    </div>
  );
}
