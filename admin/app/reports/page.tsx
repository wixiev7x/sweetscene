import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { Sidebar } from "@/components/Sidebar";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const session = await requireAdmin();

  return (
    <div>
      <Sidebar role={session.role} email={session.user.email} onSignOut={signOut} />
      <main className="ml-56 p-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Reports</h1>
        <ReportsClient />
      </main>
    </div>
  );
}
