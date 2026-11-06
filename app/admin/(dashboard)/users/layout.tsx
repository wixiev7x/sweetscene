import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Admin-only section: user management (bans, tokens, emails) is
 * restricted to the admin tier — moderators get the report inbox and
 * moderation queue only.
 */
export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data } = await supabase.rpc("assert_current_user_admin");
  const isAdmin =
    (Array.isArray(data) ? data[0] === true : data === true);

  if (!isAdmin) {
    redirect("/admin");
  }

  return <>{children}</>;
}
