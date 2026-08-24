import { requireAdmin } from "@/lib/auth";
import { getStats } from "@/lib/actions/stats";
import { signOut } from "@/lib/actions/auth";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await requireAdmin();
  const stats = await getStats();

  const cards: { label: string; value: number; accent?: "danger" | "warning" }[] = [
    { label: "Total Users", value: stats?.total_users ?? 0 },
    { label: "Active Bans", value: stats?.active_bans ?? 0, accent: "danger" },
    { label: "Banned Users", value: stats?.banned_users ?? 0 },
    { label: "Open Reports", value: stats?.open_reports ?? 0, accent: "warning" },
    { label: "Reports (24h)", value: stats?.reports_24h ?? 0 },
    { label: "Pending Moderation", value: stats?.pending_moderation ?? 0 },
    { label: "Total Moderators", value: stats?.total_moderators ?? 0 },
    { label: "Total Super Admins", value: stats?.total_super_admins ?? 0 },
  ];

  const quickLinks = [
    { label: "View Reports", href: "/reports" },
    { label: "Manage Users", href: "/users" },
    { label: "Audit Log", href: "/audit-log" },
  ];

  if (session.role === "super_admin") {
    quickLinks.push(
      { label: "AI Settings", href: "/ai-settings" },
      { label: "Site Settings", href: "/site-settings" },
    );
  }

  return (
    <div>
      <Sidebar role={session.role} email={session.user.email} onSignOut={signOut} />
      <main className="ml-56 p-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>
        {!stats ? (
          <div className="bg-surface border border-line rounded-lg p-8 text-center">
            <p className="text-muted">Stats are currently unavailable.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((card) => (
                <div key={card.label} className="bg-surface border border-line rounded-lg p-4">
                  <p className="text-xs text-muted uppercase tracking-wide">{card.label}</p>
                  <p
                    className={`text-2xl font-bold ${
                      card.accent === "danger"
                        ? "text-danger"
                        : card.accent === "warning"
                          ? "text-warning"
                          : "text-foreground"
                    }`}
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-foreground mb-3">Quick Links</h2>
              <div className="flex flex-wrap gap-3">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="bg-surface-raised border border-line rounded-md px-4 py-2 text-sm text-foreground hover:border-line-strong transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
