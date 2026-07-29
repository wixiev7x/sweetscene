"use client";

/* usePathname is a client hook, so this file is a client boundary. It
   worked without the directive only because every consumer happened to
   be a client component already — the first server component to import
   it would have crashed at render. */

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/lobby", label: "Lobby" },
  { href: "/characters", label: "Characters" },
  { href: "/characters/my", label: "Mine" },
  { href: "/create-character", label: "Create" },
  { href: "/profile", label: "Profile" },
];

export function SiteNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={`sticky top-0 z-10 border-b border-white/5 backdrop-blur-md bg-black/40 px-6 py-4 flex items-center justify-between ${className}`}
    >
      <Link
        href="/"
        className="text-xl font-bold text-brand-light hover:text-brand-lighter transition-colors"
      >
        sweetscene
      </Link>
      <div className="flex items-center gap-6">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                active ? "text-brand-light" : "text-muted hover:text-foreground-dim"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}