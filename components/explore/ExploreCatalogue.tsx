"use client";

import { useState, useMemo } from "react";
import { ExploreFilterBar } from "./ExploreFilterBar";
import { CharacterCard } from "./CharacterCard";
import { CHARACTERS } from "@/lib/data/characters";

export function ExploreCatalogue() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeGender, setActiveGender] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSort, setActiveSort] = useState("Popular · Month");

  const filtered = useMemo(() => {
    let list = [...CHARACTERS];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (activeCategory !== "All") {
      list = list.filter((c) =>
        c.tags.some((t) => t.toLowerCase() === activeCategory.toLowerCase())
      );
    }

    // Gender filter
    if (activeGender === "Female") {
      list = list.filter((_, i) => i % 3 !== 1); // rough heuristic for demo
    } else if (activeGender === "Male") {
      list = list.filter((_, i) => i % 3 === 1);
    } else if (activeGender === "Anime") {
      list = list.filter((c) => c.tags.includes("Anime"));
    }

    // Sort
    if (activeSort.includes("Popular") || activeSort.includes("All Time")) {
      list.sort((a, b) => b.chats - a.chats);
    } else if (activeSort === "Newest") {
      list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    } else if (activeSort === "Most Chats") {
      list.sort((a, b) => b.chats - a.chats);
    } else if (activeSort === "Popular · Week") {
      list.sort((a, b) => b.likes - a.likes);
    }

    return list;
  }, [activeCategory, activeGender, searchQuery, activeSort]);

  return (
    <div className="flex flex-col min-h-screen">
      <ExploreFilterBar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        activeGender={activeGender}
        onGenderChange={setActiveGender}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeSort={activeSort}
        onSortChange={setActiveSort}
      />

      {/* Grid */}
      <div className="flex-1 px-5 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-[#444]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4">
              <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p className="text-sm">No characters found for &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((char) => (
              <CharacterCard key={char.id} char={char} />
            ))}
          </div>
        )}
      </div>

      {/* Load more */}
      {filtered.length > 0 && (
        <div className="flex justify-center pb-12 pt-4">
          <button
            className="px-8 py-3 rounded-xl text-sm font-semibold text-white border border-white/[0.1] hover:border-brand/40 hover:bg-brand/10 transition-all"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
