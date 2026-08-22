"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isAdmin,
  listPlatformSettings,
  setPlatformSetting,
  clearPlatformSetting,
  type PlatformSettingRow,
} from "@/lib/actions/admin";

/**
 * Phase 12 — Platform settings.
 *
 * Lets the operator set API credentials at runtime instead of baking
 * them into the deployment. Values resolve database-first, env-fallback
 * (see lib/config/settings.ts), so a key set here takes effect within
 * 30 seconds with no redeploy.
 *
 * This page never receives a raw credential. The server sends a masked
 * preview and a source label; there is no reveal. Losing a key means
 * rotating it at the provider, which is the right move anyway.
 */

const SOURCE_STYLES: Record<
  PlatformSettingRow["source"],
  { label: string; className: string }
> = {
  database: {
    label: "Dashboard",
    className: "bg-green-500/10 text-green-400 border-green-500/30",
  },
  environment: {
    label: "Environment",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  unset: {
    label: "Not set",
    className: "bg-muted/10 text-muted-strong border-line-strong",
  },
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PlatformSettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    kind: "ok" | "err";
  } | null>(null);

  const load = useCallback(async () => {
    const result = await listPlatformSettings();
    if ("error" in result) {
      setMessage({ text: result.error, kind: "err" });
      return;
    }
    setSettings(result.settings);
  }, []);

  useEffect(() => {
    (async () => {
      const admin = await isAdmin();
      if (!admin) {
        router.replace("/lobby");
        return;
      }
      setAuthorized(true);
      await load();
      setLoading(false);
    })();
  }, [router, load]);

  async function handleSave(key: string) {
    const value = drafts[key] ?? "";
    if (!value.trim()) {
      setMessage({ text: "Enter a value first.", kind: "err" });
      return;
    }

    setBusyKey(key);
    setMessage(null);

    const result = await setPlatformSetting(key, value);

    if ("error" in result) {
      setMessage({ text: result.error, kind: "err" });
    } else {
      /* Clear the input immediately — a credential should not sit in
         the DOM after it has been stored. */
      setDrafts((d) => ({ ...d, [key]: "" }));
      setMessage({ text: "Saved. Live within 30 seconds.", kind: "ok" });
      await load();
    }

    setBusyKey(null);
  }

  async function handleClear(key: string, label: string) {
    if (
      !confirm(
        `Clear "${label}"?\n\nThe platform will fall back to the environment variable, or stop working if none is set.`
      )
    ) {
      return;
    }

    setBusyKey(key);
    setMessage(null);

    const result = await clearPlatformSetting(key);

    if ("error" in result) {
      setMessage({ text: result.error, kind: "err" });
    } else {
      setMessage({ text: "Cleared.", kind: "ok" });
      await load();
    }

    setBusyKey(null);
  }

  if (!authorized || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/admin"
            className="text-sm text-muted hover:text-foreground-dim"
          >
            ← Admin
          </Link>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Platform Settings
        </h1>
        <p className="text-sm text-muted mb-6">
          Credentials set here are stored in the database and override the
          matching environment variable. Nothing is ever sent back to the
          browser — you will only see a masked preview.
        </p>

        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg border text-sm ${
              message.kind === "ok"
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {settings.map((s) => {
            const source = SOURCE_STYLES[s.source];
            const busy = busyKey === s.key;

            return (
              <div
                key={s.key}
                className="bg-surface border border-line rounded-xl p-4 md:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <h2 className="font-semibold">{s.label}</h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${source.className}`}
                  >
                    {source.label}
                  </span>
                </div>

                <p className="text-xs text-muted mb-3">{s.hint}</p>

                <div className="text-xs font-mono text-muted-strong mb-3 break-all">
                  <span className="text-muted-faint">{s.env}</span>
                  {" = "}
                  {s.preview ?? (
                    <span className="text-muted-faint italic">not set</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type={s.secret ? "password" : "text"}
                    value={drafts[s.key] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [s.key]: e.target.value }))
                    }
                    placeholder={
                      s.source === "unset" ? "Enter value" : "Enter new value"
                    }
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                    className="flex-1 min-w-0 bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-line-focus disabled:opacity-50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(s.key)}
                      disabled={busy || !(drafts[s.key] ?? "").trim()}
                      className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {busy ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => handleClear(s.key, s.label)}
                      disabled={busy || s.source !== "database"}
                      className="px-4 py-2 bg-surface-raised border border-line-strong rounded-lg text-sm hover:border-line-focus disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 md:p-5">
          <h2 className="font-semibold text-amber-400 mb-2 text-sm">
            Not manageable here
          </h2>
          <p className="text-xs text-muted-strong mb-3">
            Four values must stay in the deployment environment. They are
            read before this table can be reached, or reading them from it
            would defeat their purpose.
          </p>
          <ul className="text-xs text-muted-strong space-y-1.5 font-mono">
            <li>
              <span className="text-foreground-dim">
                NEXT_PUBLIC_SUPABASE_URL
              </span>{" "}
              — needed to reach the database
            </li>
            <li>
              <span className="text-foreground-dim">
                SUPABASE_SERVICE_ROLE_KEY
              </span>{" "}
              — needed to read this table
            </li>
            <li>
              <span className="text-foreground-dim">MESSAGE_ENCRYPTION_KEY</span>{" "}
              — storing it beside the ciphertext defeats encryption at rest
            </li>
            <li>
              <span className="text-foreground-dim">
                NEXT_PUBLIC_TURNSTILE_SITE_KEY
              </span>{" "}
              — inlined into the client bundle at build time
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
