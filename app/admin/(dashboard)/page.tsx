"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAdminStatsV2 } from "@/lib/actions/admin";

type Stats = {
  open_reports: number;
  total_reports: number;
  total_users: number;
  total_characters: number;
  banned_users: number;
  featured_characters: number;
  active_bans: number;
  pending_moderation: number;
  reports_last_24h: number;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getAdminStatsV2();
      if (!("error" in result)) {
        setStats(result);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  const cards = [
    {
      label: "Total Users",
      value: stats?.total_users ?? 0,
      href: "/admin/users",
      color: "text-blue-400",
    },
    {
      label: "Active Bans",
      value: stats?.active_bans ?? 0,
      href: "/admin/users",
      color: "text-orange-400",
    },
    {
      label: "Banned Users",
      value: stats?.banned_users ?? 0,
      href: "/admin/users",
      color: "text-red-400",
    },
    {
      label: "Open Reports",
      value: stats?.open_reports ?? 0,
      href: "/admin/reports",
      color: "text-red-400",
    },
    {
      label: "Reports (24h)",
      value: stats?.reports_last_24h ?? 0,
      href: "/admin/reports",
      color: "text-amber-400",
    },
    {
      label: "Pending Moderation",
      value: stats?.pending_moderation ?? 0,
      href: "/admin/moderation",
      color: "text-amber-400",
    },
    {
      label: "Total Characters",
      value: stats?.total_characters ?? 0,
      href: "/admin/characters",
      color: "text-green-400",
    },
    {
      label: "Featured Characters",
      value: stats?.featured_characters ?? 0,
      href: "/admin/characters",
      color: "text-brand-light",
    },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="block bg-surface border border-line rounded-xl p-6 hover:border-line-strong transition-colors"
            >
              <p className="text-sm text-muted mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/admin/reports"
            className="px-4 py-2 bg-surface border border-line rounded-lg hover:border-line-strong transition-colors"
          >
            Report Queue
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-2 bg-surface border border-line rounded-lg hover:border-line-strong transition-colors"
          >
            User Management
          </Link>
          <Link
            href="/admin/moderation"
            className="px-4 py-2 bg-surface border border-line rounded-lg hover:border-line-strong transition-colors"
          >
            Moderation Queue
          </Link>
          <Link
            href="/admin/characters"
            className="px-4 py-2 bg-surface border border-line rounded-lg hover:border-line-strong transition-colors"
          >
            Character Management
          </Link>
          <Link
            href="/admin/audit-log"
            className="px-4 py-2 bg-surface border border-line rounded-lg hover:border-line-strong transition-colors"
          >
            Audit Log
          </Link>
          <Link
            href="/admin/settings"
            className="px-4 py-2 bg-surface border border-line rounded-lg hover:border-line-strong transition-colors"
          >
            Platform Settings
          </Link>
        </div>
      </div>
    </main>
  );
}
