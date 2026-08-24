import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function BannedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ban_reason, banned_until, banned_at")
    .eq("id", user.id)
    .single();

  if (!profile?.ban_reason && !profile?.banned_at) {
    redirect("/lobby");
  }

  const isPermanent = !profile?.banned_until;
  const expiryDate = profile?.banned_until
    ? new Date(profile.banned_until).toLocaleString()
    : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-surface border border-line rounded-lg p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-danger mb-4">
          Account Suspended
        </h1>
        <p className="text-foreground-dim text-sm mb-6">
          Your account has been banned from SweetScene.
        </p>

        {profile?.ban_reason && (
          <div className="bg-surface-raised border border-line rounded-md p-4 mb-4 text-left">
            <p className="text-xs text-muted uppercase mb-1">Reason</p>
            <p className="text-sm text-foreground">{profile.ban_reason}</p>
          </div>
        )}

        <div className="bg-surface-raised border border-line rounded-md p-4 mb-6 text-left">
          <p className="text-xs text-muted uppercase mb-1">Duration</p>
          <p className="text-sm text-foreground">
            {isPermanent
              ? "Permanent ban"
              : `Until ${expiryDate}`}
          </p>
        </div>

        <p className="text-xs text-muted">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}
