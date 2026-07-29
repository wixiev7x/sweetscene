export function ProgressBar({
  value,
  max,
  className = "",
  widthClass = "w-24",
}: {
  value: number;
  max: number;
  className?: string;
  widthClass?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div
      className={`${widthClass} h-1 rounded-full bg-white/10 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand to-pink-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}