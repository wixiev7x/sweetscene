import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole, AuthSession } from "@/lib/types";

export async function requireAdmin(): Promise<AuthSession> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: aalData } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel !== "aal2") {
    redirect("/login?step=totp");
  }

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "moderator" && role !== "super_admin") {
    redirect("/login?error=not_admin");
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    role: role as UserRole,
  };
}

export async function requireSuperAdmin(): Promise<AuthSession> {
  const session = await requireAdmin();
  if (session.role !== "super_admin") {
    redirect("/dashboard?error=super_admin_required");
  }
  return session;
}
