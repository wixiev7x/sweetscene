type Size = "sm" | "md";

const DOT_SIZES: Record<Size, string> = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
};

export function TypingDots({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      aria-label="Typing"
      role="status"
    >
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className={`${DOT_SIZES[size]} rounded-full bg-brand-light`}
          style={{
            animation: "typingBounce 1.4s infinite ease-in-out",
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}