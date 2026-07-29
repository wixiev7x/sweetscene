export function Skeleton({
  variant = "line",
  className = "",
}: {
  variant?: "line" | "card" | "avatar" | "circle";
  className?: string;
}) {
  const VARIANTS: Record<string, string> = {
    line: "h-4 w-full rounded",
    card: "h-32 w-full rounded-2xl",
    avatar: "h-14 w-14 rounded-xl",
    circle: "h-10 w-10 rounded-full",
  };

  return (
    <div
      className={`animate-pulse bg-white/5 ${VARIANTS[variant]} ${className}`}
      aria-hidden="true"
    />
  );
}