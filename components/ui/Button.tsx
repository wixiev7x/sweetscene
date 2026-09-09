import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "danger" | "accent" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

const GRADIENTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 text-accent-foreground",
  danger:
    "bg-gradient-to-r from-danger to-crimson-600 hover:from-danger/90 hover:to-crimson-500 text-accent-foreground",
  accent:
    "bg-gradient-to-r from-warning to-accent-candle hover:from-warning/90 hover:to-accent-candle-deep text-accent-foreground",
  ghost:
    "bg-white/5 border border-white/10 text-foreground-dim hover:bg-white/10 hover:text-foreground",
};

const SIZES: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const base =
    "rounded-xl font-medium active:scale-95 transform transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 select-none focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none inline-flex items-center justify-center gap-2";
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${GRADIENTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && (
        <span
          className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin"
          aria-hidden="true"
        />
      )}
      {loading ? "Loading…" : children}
    </button>
  );
}
