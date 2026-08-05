"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Footer for the landing page. Contains legal links, age disclaimer,
 * and brand mark. No gambling disclaimer on .love.
 */
export function LandingFooter() {
  return (
    <footer className="py-16 px-6 border-t border-white/5 bg-black relative">
      {/* Top gradient bleed */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-5xl mx-auto"
      >
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-12">
          <span
            className="text-3xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #c084fc, #f472b6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            sweetscene
          </span>
          <p className="text-muted-faint text-sm mt-2 text-center max-w-xs text-balance">
            Anonymous AI roleplay matchmaking. The fog is part of it.
          </p>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 text-center md:text-left">
          <div>
            <h4 className="text-xs tracking-widest uppercase text-muted-faint mb-4">Platform</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/lobby" className="text-sm text-muted hover:text-foreground-dim transition-colors">
                  Lobby
                </Link>
              </li>
              <li>
                <Link href="/characters" className="text-sm text-muted hover:text-foreground-dim transition-colors">
                  Characters
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-muted hover:text-foreground-dim transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs tracking-widest uppercase text-muted-faint mb-4">Tokens</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/profile" className="text-sm text-muted hover:text-foreground-dim transition-colors">
                  Top Up
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-sm text-muted hover:text-foreground-dim transition-colors">
                  Become VIP
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs tracking-widest uppercase text-muted-faint mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/legal/terms" className="text-sm text-muted hover:text-foreground-dim transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-sm text-muted hover:text-foreground-dim transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs tracking-widest uppercase text-muted-faint mb-4">Community</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://discord.gg/sweetscene"
                  className="text-sm text-muted hover:text-foreground-dim transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Discord
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@sweetscene.love"
                  className="text-sm text-muted hover:text-foreground-dim transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
          <p className="text-xs text-muted-faint text-center md:text-left">
            &copy; {new Date().getFullYear()} sweetscene. All scenes reserved.
          </p>
          <p className="text-xs text-muted-faint text-center">
            18+ platform. Contains adult-gated content. CSAM is strictly forbidden and
            reported to authorities. Age verification enforced server-side.
          </p>
        </div>
      </motion.div>
    </footer>
  );
}
