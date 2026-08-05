"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
    label: "Explore",
    href: "/",
    active: true,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: "Chat",
    href: "/lobby",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm-7 20a7 7 0 0 1 14 0" />
      </svg>
    ),
    label: "My Characters",
    href: "/characters/my",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
    label: "Generate",
    href: "/create-character",
    badge: "NEW",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    label: "Feed",
    href: "/feed",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    label: "Community",
    href: "/community",
  },
];

const BOTTOM_NAV = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    ),
    label: "Help Desk",
    href: "/help",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    label: "Safety Center",
    href: "/safety",
  },
];

export function ExploreSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-[210px] shrink-0 bg-[#111111] border-r border-white/[0.06] h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="text-xl font-bold"
            style={{
              background: "linear-gradient(90deg, #e91e8c, #9333ea)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            sweetscene
          </span>
          <span className="text-[10px] text-brand/60 font-semibold tracking-widest">.ai</span>
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 space-y-0.5 mt-2">
        {NAV.map(({ icon, label, href, badge }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group
                ${isActive
                  ? "bg-brand/15 text-brand-light"
                  : "text-[#888] hover:text-white hover:bg-white/[0.06]"
                }`}
            >
              <span className={isActive ? "text-brand" : "text-[#555] group-hover:text-white transition-colors"}>
                {icon}
              </span>
              <span>{label}</span>
              {badge && (
                <span className="ml-auto text-[9px] font-bold tracking-wider bg-brand/20 text-brand-light px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="h-px bg-white/[0.06] mx-5 my-3" />

      {/* Bottom nav */}
      <nav className="px-3 space-y-0.5 mb-3">
        {BOTTOM_NAV.map(({ icon, label, href }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#555] hover:text-white hover:bg-white/[0.06] transition-colors group"
          >
            <span className="text-[#444] group-hover:text-white transition-colors">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Language + Profile */}
      <div className="px-3 space-y-0.5 mb-3">
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#555] hover:text-white hover:bg-white/[0.06] transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
          <span>Language</span>
        </Link>
        <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#555] hover:text-white hover:bg-white/[0.06] transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Profile</span>
        </Link>
      </div>

      {/* Upgrade CTA */}
      <div className="px-4 pb-6">
        <Link
          href="/upgrade"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #9333ea 0%, #e91e8c 100%)",
            boxShadow: "0 4px 20px rgba(233, 30, 140, 0.3)",
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Upgrade
        </Link>
      </div>
    </aside>
  );
}
