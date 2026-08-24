import { requireSuperAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { signOut } from "@/lib/actions/auth";
import { SiteSettingsClient } from "./SiteSettingsClient";

export default async function SiteSettingsPage() {
  const session = await requireSuperAdmin();
  return (
    <div>
      <Sidebar role={session.role} email={session.user.email} onSignOut={signOut} />
      <main className="ml-56 p-8">
        <SiteSettingsClient />
      </main>
    </div>
  );
}
