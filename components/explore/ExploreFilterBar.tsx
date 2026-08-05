"use client";

import { useState } from "react";

const SORT_OPTIONS = ["Popular · Month", "Popular · Week", "Popular · All Time", "Newest", "Most Chats"];
const GENDER_OPTIONS = ["All", "Female", "Male", "Non-Binary", "Anime"];
const STYLE_OPTIONS = ["Any Style", "Realistic", "Anime", "Fantasy", "Cartoon"];
const AGE_OPTIONS = ["Any Age", "18-25", "26-35", "36+", "Mature"];

const CATEGORY_TAGS = [
  "All", "Group Chats", "MILF", "Teen", "Asian", "RPG", "Dominant", "Submissive",
  "Latina", "Fantasy", "Busty", "Blonde", "Step-Fantasy", "BDSM", "Romance",
  "Vampire", "Goth", "Tsundere", "Shy", "Wholesome", "NTR",
];

interface Props {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  activeGender: string;
  onGenderChange: (g: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeSort: string;
  onSortChange: (s: string) => void;
}

export function ExploreFilterBar({
  activeCategory,
  onCategoryChange,
  activeGender,
  onGenderChange,
  searchQuery,
  onSearchChange,
  activeSort,
  onSortChange,
}: Props) {
  const [showSort, setShowSort] = useState(false);
  const [showGender, setShowGender] = useState(false);

  return (
    <div className="sticky top-0 z-20 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/[0.06]">
      {/* Top row: sort + search + gender */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 flex-wrap">
        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowSort(!showSort); setShowGender(false); }}
            className="flex items-center gap-2 bg-[#1e1e1e] hover:bg-[#252525] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-[#ccc] transition-colors whitespace-nowrap"
          >
            {activeSort}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-[#666]">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showSort && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-[#1e1e1e] border border-white/[0.1] rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { onSortChange(opt); setShowSort(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.06] transition-colors ${activeSort === opt ? "text-brand-light" : "text-[#bbb]"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-lg relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] pointer-events-none">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            placeholder="Try 'Shy nurse' or 'Dominant CEO'..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-sm text-[#ccc] placeholder-[#444] focus:outline-none focus:border-brand/40 transition-colors"
          />
        </div>

        {/* Gender filter */}
        <div className="relative">
          <button
            onClick={() => { setShowGender(!showGender); setShowSort(false); }}
            className="flex items-center gap-2 bg-[#1e1e1e] hover:bg-[#252525] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-[#ccc] transition-colors"
          >
            {activeGender}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-[#666]">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showGender && (
            <div className="absolute top-full right-0 mt-1 w-40 bg-[#1e1e1e] border border-white/[0.1] rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { onGenderChange(opt); setShowGender(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.06] transition-colors ${activeGender === opt ? "text-brand-light" : "text-[#bbb]"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Login / Join */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <a href="/login" className="text-sm text-[#888] hover:text-white transition-colors px-3 py-2">
            Login
          </a>
          <a
            href="/signup"
            className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#9333ea,#e91e8c)", boxShadow: "0 2px 12px rgba(233,30,140,0.3)" }}
          >
            Join Free
          </a>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 px-5 pb-3 overflow-x-auto scrollbar-none">
        {CATEGORY_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => onCategoryChange(tag)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap
              ${activeCategory === tag
                ? "bg-brand/20 text-brand-light border-brand/40"
                : "bg-transparent text-[#888] border-white/[0.07] hover:text-white hover:border-white/20"
              }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
