import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  /* Moderator tier OR admin. Section-level layouts and the server
     actions enforce the finer-grained rules (users/settings/
     characters/audit are admin-only). */
  const { data: modData } = await supabase.rpc("assert_current_user_mod");
  const isMod =
    (Array.isArray(modData) ? modData[0] === true : modData === true);

  if (!isMod) {
    redirect("/lobby");
  }

  const { data: roleData } = await supabase.rpc("get_my_admin_role");
  const role = (
    Array.isArray(roleData) ? roleData[0] : roleData
  ) as string | null;

  const isAdmin = role === "admin";

  const navItems = [
    { href: "/admin", label: "Dashboard", show: true },
    { href: "/admin/users", label: "Users", show: isAdmin },
    { href: "/admin/characters", label: "Characters", show: isAdmin },
    { href: "/admin/reports", label: "Reports", show: true },
    { href: "/admin/moderation", label: "Moderation", show: true },
    { href: "/admin/audit-log", label: "Audit Log", show: isAdmin },
    { href: "/admin/settings", label: "Settings", show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link
            href="/admin"
            className="font-bold text-sm tracking-wide hover:text-foreground-dim"
          >
            Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted">
            {navItems
              .filter((item) => item.show)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-foreground-dim"
                >
                  {item.label}
                </Link>
              ))}
          </nav>
          <Link
            href="/"
            className="ml-auto text-sm text-muted hover:text-foreground-dim"
          >
            View site &rarr;
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
