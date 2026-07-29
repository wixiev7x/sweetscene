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
    "bg-gradient-to-r from-brand-dark to-pink-600 hover:from-brand hover:to-pink-500 text-white",
  danger:
    "bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white",
  accent:
    "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black",
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
    "rounded-xl font-medium active:scale-95 transform transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none";
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${GRADIENTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}