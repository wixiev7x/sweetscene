"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MOBILE_NAV = [
  {
    href: "/",
    label: "Explore",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    href: "/lobby",
    label: "Chat",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: "/create-character",
    label: "Create",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
      </svg>
    ),
    isPrimary: true,
  },
  {
    href: "/feed",
    label: "Feed",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#111111]/95 backdrop-blur-md border-t border-white/[0.07] safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_NAV.map(({ href, label, icon, isPrimary }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          if (isPrimary) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl"
                aria-label={label}
              >
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-full"
                  style={{ background: "linear-gradient(135deg,#9333ea,#e91e8c)", boxShadow: "0 4px 16px rgba(233,30,140,0.4)" }}
                >
                  {icon}
                </span>
                <span className="text-[9px] text-[#888] mt-0.5">{label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl"
              aria-label={label}
            >
              <span className={isActive ? "text-brand-light" : "text-[#555]"}>{icon}</span>
              <span className={`text-[9px] ${isActive ? "text-brand-light" : "text-[#555]"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
