"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Immersive screens (live scenes, DMs) get no footer. */
const HIDE_ON = ["/chat", "/play", "/dm", "/lobby/", "/join", "/checkout"];

const COLS: { title: string; links: [string, string][] }[] = [
  {
    title: "Play",
    links: [
      ["/matchmake", "Matchmake"],
      ["/explore", "Solo characters"],
      ["/scenarios", "Scenarios"],
      ["/create", "Create a character"],
    ],
  },
  {
    title: "SweetScene",
    links: [
      ["/how", "How it works"],
      ["/store", "Plans & pricing"],
      ["/blog", "Blog"],
      ["/community", "Community"],
    ],
  },
  {
    title: "Support",
    links: [
      ["/how", "Help"],
      ["/safety", "Safety Center"],
      ["/guidelines", "Community Guidelines"],
      ["/contact", "Contact"],
      ["/refunds", "Refund Policy"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/terms", "Terms of Service"],
      ["/privacy", "Privacy Policy"],
    ],
  },
];

export default function SiteFooter() {
  const pathname = usePathname() ?? "/";
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <footer className="mt-10 border-t border-line px-4 pb-10 pt-14 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div>
          <Link href="/" className="font-display text-2xl text-foreground">
            sweet<span className="text-brand">scene</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Strangers, stories and slow-burning chemistry. Reveal only when it&rsquo;s worth it.
          </p>
          <p className="mt-4 text-xs text-muted-faint">16+ · Safe-for-work · Payments by Paddle</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted-strong transition-colors hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-muted-faint">
        <p>© {new Date().getFullYear()} SweetScene. All rights reserved.</p>
        <a href="mailto:support@sweetscene.love" className="hover:text-foreground">support@sweetscene.love</a>
      </div>
    </footer>
  );
}
