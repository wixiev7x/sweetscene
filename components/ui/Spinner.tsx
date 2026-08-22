type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "w-5 h-5 border-2",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-[3px]",
};

export function Spinner({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${SIZES[size]} rounded-full border-brand/30 border-t-brand animate-spin ${className}`}
    />
  );
}

export function LoadingState({
  text = "Loading...",
  size = "md",
}: {
  text?: string;
  size?: Size;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Spinner size={size} />
      <p className="text-muted text-sm">{text}</p>
    </div>
  );
}