import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Admin-only section: character management (feature/hide/delete). */
export default async function CharactersLayout({
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
