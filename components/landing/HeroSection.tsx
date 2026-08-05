"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * Full-viewport hero section for the sweetscene landing page.
 *
 * Layout: two flanking image columns with the headline centred between
 * them. On mobile the images collapse behind the text as background layers.
 * Framer-motion scroll-driven parallax on the images (transform only).
 */
export function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const yLeft = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const yRight = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* ── Left image column ── */}
      <motion.div
        style={{ y: yLeft }}
        className="absolute left-0 top-0 bottom-0 w-[28%] md:w-[30%] pointer-events-none hidden sm:block will-change-transform"
        aria-hidden="true"
      >
        <div className="relative h-full">
          <Image
            src="/images/hero-girl-1.png"
            alt=""
            fill
            className="object-cover"
            priority
            sizes="30vw"
          />
          <Image
            src="/images/hero-girl-2.png"
            alt=""
            fill
            className="object-cover"
            priority={false}
            sizes="30vw"
            style={{ objectPosition: "top", clipPath: "inset(55% 0 0 0)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
        </div>
      </motion.div>

      {/* ── Right image column ── */}
      <motion.div
        style={{ y: yRight }}
        className="absolute right-0 top-0 bottom-0 w-[28%] md:w-[30%] pointer-events-none hidden sm:block will-change-transform"
        aria-hidden="true"
      >
        <div className="relative h-full">
          <Image
            src="/images/hero-guy-1.png"
            alt=""
            fill
            className="object-cover"
            priority
            sizes="30vw"
          />
          <Image
            src="/images/hero-girl-3.png"
            alt=""
            fill
            className="object-cover"
            priority={false}
            sizes="30vw"
            style={{ objectPosition: "top", clipPath: "inset(55% 0 0 0)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/30 via-transparent to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
        </div>
      </motion.div>

      {/* ── Mobile full-bleed background ── */}
      <div className="absolute inset-0 sm:hidden pointer-events-none" aria-hidden="true">
        <Image
          src="/images/couple-scene.png"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />
      </div>

      {/* ── Radial glow ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(168,85,247,0.12) 0%, transparent 70%)",
        }}
      />

      {/* ── Centre content ── */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl mx-auto"
      >
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-xs tracking-[0.5em] text-brand/60 uppercase mb-6"
        >
          Anonymous &bull; Uncensored &bull; Unforgettable
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-6xl md:text-8xl font-bold tracking-tight text-balance"
          style={{
            background: "linear-gradient(135deg, #c084fc 0%, #f472b6 50%, #c084fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          sweetscene
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="text-2xl md:text-3xl font-light text-foreground-dim italic mt-3"
        >
          Match. Roleplay. Reveal.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="text-base text-muted max-w-md mt-6 leading-relaxed"
        >
          Two strangers. One shared scene. An AI director breaks the ice.
          You decide if the fog lifts.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.6 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/lobby"
            className="px-8 py-4 rounded-xl font-medium text-lg text-white inline-flex items-center gap-2 transition-all duration-300 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #9333ea, #ec4899)",
              boxShadow: "0 0 30px rgba(168,85,247,0.4)",
            }}
          >
            Enter the Lobby
            <span aria-hidden="true">&rarr;</span>
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 rounded-xl font-medium text-base text-foreground-dim border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 active:scale-95"
          >
            Sign In
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
          className="text-xs text-muted-faint mt-6"
        >
          18+ platform &bull; Anonymous by default &bull; NSFW gated
        </motion.p>
      </motion.div>

      {/* ── Scroll hint ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-xs text-muted-faint tracking-widest uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-px h-8 bg-gradient-to-b from-brand/40 to-transparent"
        />
      </motion.div>
    </section>
  );
}
