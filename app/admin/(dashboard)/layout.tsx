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

  const { data } = await supabase.rpc("assert_current_user_admin");
  const isAdmin = (data as unknown as boolean[] | null)?.[0];

  if (!isAdmin) {
    redirect("/lobby");
  }

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
            <Link href="/admin" className="hover:text-foreground-dim">
              Dashboard
            </Link>
            <Link href="/admin/users" className="hover:text-foreground-dim">
              Users
            </Link>
            <Link href="/admin/characters" className="hover:text-foreground-dim">
              Characters
            </Link>
            <Link href="/admin/reports" className="hover:text-foreground-dim">
              Reports
            </Link>
            <Link href="/admin/moderation" className="hover:text-foreground-dim">
              Moderation
            </Link>
            <Link href="/admin/audit-log" className="hover:text-foreground-dim">
              Audit Log
            </Link>
            <Link href="/admin/settings" className="hover:text-foreground-dim">
              Settings
            </Link>
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
