import { requireAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { signOut } from "@/lib/actions/auth";
import { UsersClient } from "./UsersClient";

export default async function UsersPage() {
  const session = await requireAdmin();
  return (
    <div>
      <Sidebar role={session.role} email={session.user.email} onSignOut={signOut} />
      <main className="ml-56 p-8">
        <UsersClient role={session.role} />
      </main>
    </div>
  );
}
