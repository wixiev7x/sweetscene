import { requireSuperAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { signOut } from "@/lib/actions/auth";
import { AISettingsClient } from "./AISettingsClient";

export default async function AISettingsPage() {
  const session = await requireSuperAdmin();
  return (
    <div>
      <Sidebar role={session.role} email={session.user.email} onSignOut={signOut} />
      <main className="ml-56 p-8">
        <AISettingsClient />
      </main>
    </div>
  );
}
