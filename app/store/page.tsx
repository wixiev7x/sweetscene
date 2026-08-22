"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/utils/sound";

const PACKS = [
  { amount: 500, price: "$1.99", label: "Starter" },
  { amount: 2000, price: "$4.99", label: "Popular" },
  { amount: 5000, price: "$9.99", label: "Best Value" },
  { amount: 12000, price: "$19.99", label: "Whale" },
];

export default function StorePage() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("tokens_balance")
            .eq("id", user.id)
            .single();
          if (data?.tokens_balance != null) setBalance(data.tokens_balance);
        }
      } catch {
        // not logged in
      }
    }
    fetchBalance();
  }, []);

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 md:pl-16 pb-14 md:pb-0">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-light text-foreground-dim mb-2">Store</h1>
        <p className="text-sm text-muted mb-6">Buy tokens for AI matchmaking and chat.</p>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8 text-center">
          <p className="text-xs text-muted-faint uppercase tracking-widest mb-1">Your Balance</p>
          <p className="text-3xl font-light text-neon-magenta">
            <span className="text-neon-magenta">&#x25C8;</span> {balance != null ? balance : 0}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {PACKS.map((pack) => (
            <div key={pack.amount} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center hover:border-neon-magenta/40 transition-all">
              <p className="text-xs text-muted-faint uppercase tracking-widest mb-2">{pack.label}</p>
              <p className="text-2xl font-light text-foreground mb-1">
                <span className="text-neon-magenta">&#x25C8;</span> {pack.amount.toLocaleString()}
              </p>
              <p className="text-sm text-muted mb-4">{pack.price}</p>
              <Link
                href="/login"
                onClick={() => playSound("click")}
                className="block w-full text-center text-xs px-4 py-2.5 rounded-full text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all"
              >
                Buy
              </Link>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-faint text-center">
          Tokens power AI responses in your scenes. Each match has a shared pool.
        </p>
      </div>
    </main>
  );
}
