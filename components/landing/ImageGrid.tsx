"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * A masonry-style immersive image grid for the landing page.
 * Each image has a subtle parallax shift on scroll using framer-motion's
 * useScroll / useTransform — uses `transform` only, never top/left.
 *
 * Images are intentionally borderline-SFW placeholders that the operator
 * will replace with final NSFW assets before launch.
 */

const IMAGES = [
  { src: "/images/hero-girl-1.png", alt: "Scene character", aspect: "tall", offset: -40 },
  { src: "/images/hero-guy-1.png", alt: "Scene character", aspect: "tall", offset: 60 },
  { src: "/images/hero-girl-2.png", alt: "Scene character", aspect: "tall", offset: -20 },
  { src: "/images/grid-girl-1.png", alt: "Scene character", aspect: "tall", offset: 80 },
  { src: "/images/grid-girl-2.png", alt: "Scene character", aspect: "tall", offset: -60 },
  { src: "/images/grid-guy-2.png", alt: "Scene character", aspect: "tall", offset: 40 },
  { src: "/images/grid-girl-4.png", alt: "Scene character", aspect: "tall", offset: -80 },
  { src: "/images/grid-girl-5.png", alt: "Scene character", aspect: "tall", offset: 20 },
  { src: "/images/grid-girl-6.png", alt: "Scene character", aspect: "tall", offset: -30 },
  { src: "/images/hero-girl-3.png", alt: "Scene character", aspect: "tall", offset: 50 },
];

function ParallaxImage({
  src,
  alt,
  offset,
  delay,
}: {
  src: string;
  alt: string;
  offset: number;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [offset * -1, offset]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl"
      style={{ aspectRatio: "3 / 4" }}
    >
      <motion.div style={{ y }} className="absolute inset-0 will-change-transform">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          loading="lazy"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {/* Subtle gradient overlay — darkens edges for cohesion */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      </motion.div>

      {/* Rose glow on hover */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 bg-brand/10 pointer-events-none rounded-xl ring-1 ring-brand/30" />
    </motion.div>
  );
}

export function ImageGrid() {
  return (
    <section
      aria-label="Featured scenes"
      className="relative py-16 px-4 md:px-8 overflow-hidden"
    >
      {/* Background gradient wash */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_50%,rgba(168,85,247,0.06)_0%,transparent_70%)]" />

      {/* 5-column masonry grid on desktop, 2-column on mobile */}
      <div className="columns-2 md:columns-4 lg:columns-5 gap-3 space-y-3 max-w-7xl mx-auto">
        {IMAGES.map((img, i) => (
          <div key={img.src} className="break-inside-avoid">
            <ParallaxImage
              src={img.src}
              alt={img.alt}
              offset={img.offset}
              delay={i * 0.05}
            />
          </div>
        ))}
      </div>

      {/* Vignette fade to black at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </section>
  );
}
