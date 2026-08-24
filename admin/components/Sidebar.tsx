"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

const MODERATOR_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Users", href: "/users" },
  { label: "Reports", href: "/reports" },
  { label: "Audit Log", href: "/audit-log" },
];

const SUPER_ADMIN_ITEMS = [
  { label: "AI Settings", href: "/ai-settings" },
  { label: "Site Settings", href: "/site-settings" },
  { label: "Payments", href: "/payments" },
  { label: "Admins", href: "/admins" },
];

export function Sidebar({
  role,
  email,
  onSignOut,
}: {
  role: UserRole;
  email: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  const items = [
    ...MODERATOR_ITEMS,
    ...(role === "super_admin" ? SUPER_ADMIN_ITEMS : []),
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-surface border-r border-line flex flex-col">
      <div className="px-4 py-5 border-b border-line">
        <div className="text-sm font-bold text-brand">SweetScene</div>
        <div className="text-xs text-muted">Admin Panel</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-brand/10 text-brand border-l-2 border-brand"
                  : "text-foreground-dim hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-line">
        <div className="text-xs text-muted mb-1 truncate">{email}</div>
        <div className="text-xs text-muted mb-2">
          Role: <span className="text-brand-light">{role}</span>
        </div>
        <button
          onClick={onSignOut}
          className="w-full text-xs text-danger hover:underline text-left"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
