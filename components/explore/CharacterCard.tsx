"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export interface Character {
  id: string;
  name: string;
  age: number;
  tagline: string;
  tags: string[];
  author: string;
  likes: number;
  chats: number;
  image: string;
  isNew?: boolean;
  isHot?: boolean;
  isVip?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function CharacterCard({ char }: { char: Character }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/characters/${char.id}`}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-[#181818] border border-white/[0.05] hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image area */}
      <div className="relative w-full aspect-[2/3] overflow-hidden bg-[#0f0f0f]">
        <Image
          src={char.image}
          alt={char.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className={`object-cover transition-transform duration-500 ${hovered ? "scale-105" : "scale-100"}`}
        />

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          {char.isNew && (
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#e91e8c] text-white">
              NEW
            </span>
          )}
          {char.isHot && (
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500 text-white">
              HOT
            </span>
          )}
          {char.isVip && (
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-yellow-500 text-black">
              VIP
            </span>
          )}
        </div>

        {/* Chat button on hover */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}
        >
          <span
            className="px-5 py-2 rounded-full text-xs font-semibold text-white transition-transform active:scale-95"
            style={{ background: "linear-gradient(135deg,#9333ea,#e91e8c)", boxShadow: "0 4px 16px rgba(233,30,140,0.5)" }}
          >
            Chat Now
          </span>
        </div>

        {/* Name + age on image bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-white leading-tight truncate">
              {char.name}
            </span>
            <span className="text-xs text-white/60 shrink-0">{char.age}</span>
          </div>
          <p className="text-[11px] text-white/50 mt-0.5 line-clamp-2 leading-snug">
            {char.tagline}
          </p>
        </div>
      </div>

      {/* Stats footer */}
      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-[#555]">
        <span className="truncate text-[#444] text-[10px]">@{char.author}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[#e91e8c]/60">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            {formatCount(char.likes)}
          </span>
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-[#555]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {formatCount(char.chats)}
          </span>
        </div>
      </div>
    </Link>
  );
}
