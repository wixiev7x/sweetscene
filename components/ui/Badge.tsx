import { ReactNode } from "react";

type Tone = "nsfw" | "sfw" | "visibility" | "tier" | "personality" | "tag" | "vip" | "admin" | "banned";

const TONES: Record<Tone, string> = {
  nsfw: "bg-red-500/10 text-red-400 border border-red-500/20",
  sfw: "bg-green-500/10 text-green-400 border border-green-500/20",
  visibility: "bg-brand/10 text-brand-light border border-brand/20",
  tier: "bg-brand/10 text-brand-lighter border border-brand/20",
  personality: "bg-brand/10 text-brand-lighter/80 border border-brand/10",
  tag: "bg-white/5 text-muted border border-white/5",
  vip: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  admin: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  banned: "bg-red-500/10 text-red-400 border border-red-500/20",
};

export function Badge({
  tone = "tag",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}