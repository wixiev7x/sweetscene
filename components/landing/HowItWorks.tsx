"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/**
 * Three-step explainer section with staggered scroll-reveal animations.
 * The fade-to-black step uses the atmospheric couple image as a background.
 */

const STEPS = [
  {
    number: "01",
    title: "Match Anonymously",
    body: "Pick your scenario, choose AI characters, enter the queue. A stranger enters the same scene — you won't know who until you both choose to reveal.",
    image: "/images/hero-girl-1.png",
    color: "#a855f7",
  },
  {
    number: "02",
    title: "Roleplay Together",
    body: "An AI director narrates, breaks the ice, and keeps the tension alive. Every turn costs dreamcoins from a shared pool — the clock is ticking.",
    image: "/images/couple-scene.png",
    color: "#ec4899",
  },
  {
    number: "03",
    title: "Fade to Black",
    body: "When the tokens run out, the scene fades. Both players see a secret reveal button. Only if both press does the fog lift. Or you part ways in mystery.",
    image: "/images/fade-to-black.png",
    color: "#f97316",
  },
];

export function HowItWorks() {
  return (
    <section
      className="py-24 px-4 md:px-8 relative"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-6xl mx-auto">
        <motion.h2
          id="how-it-works-heading"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-5xl font-light text-foreground-dim text-center mb-20 tracking-wide text-balance"
        >
          How It Works
        </motion.h2>

        <div className="flex flex-col gap-16 md:gap-24">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
              className={`flex flex-col ${
                i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
              } items-center gap-8 md:gap-16`}
            >
              {/* Image side */}
              <div className="w-full md:w-1/2 relative overflow-hidden rounded-2xl aspect-[4/3]">
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${step.color}22 0%, transparent 60%)`,
                  }}
                />
                {/* Step number watermark */}
                <span
                  className="absolute top-4 left-4 text-7xl font-bold opacity-20 leading-none"
                  style={{ color: step.color }}
                  aria-hidden="true"
                >
                  {step.number}
                </span>
              </div>

              {/* Text side */}
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                <span
                  className="text-sm font-mono tracking-widest"
                  style={{ color: step.color }}
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <h3 className="text-3xl md:text-4xl font-light text-foreground text-balance">
                  {step.title}
                </h3>
                <p className="text-muted-strong leading-relaxed text-lg">
                  {step.body}
                </p>
                <div
                  className="w-12 h-px mt-2"
                  style={{ background: step.color }}
                  aria-hidden="true"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
