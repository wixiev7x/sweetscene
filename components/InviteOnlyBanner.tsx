import { isInviteOnly } from "@/lib/actions/auth";

/** Temporary launch notice. Shows only while signup_gate.invite_only is on. */
export default async function InviteOnlyBanner() {
  if (!(await isInviteOnly())) return null;
  return (
    <div
      role="note"
      aria-label="Invite-only notice"
      className="relative z-[10001] w-full bg-red-600 px-4 py-2 text-center text-white"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em]">Invite only</p>
      <p className="text-xs text-white/85">
        Questions? <a href="mailto:support@sweetscene.love" className="underline underline-offset-2">support@sweetscene.love</a>
      </p>
    </div>
  );
}
