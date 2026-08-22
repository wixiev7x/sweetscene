import { ReactNode } from "react";

export function EmptyState({
  title,
  subtitle,
  icon,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}
    >
      {icon && <div className="mb-4 text-muted-faint">{icon}</div>}
      <p className="text-muted-strong text-sm font-medium">{title}</p>
      {subtitle && (
        <p className="text-muted text-sm mt-1 max-w-xs">{subtitle}</p>
      )}
    </div>
  );
}