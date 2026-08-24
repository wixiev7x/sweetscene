"use client";

import { useEffect, useState } from "react";
import { getSettings, setSetting } from "@/lib/actions/settings";

const DEFAULTS: Record<string, string> = {
  maintenance_mode: "false",
  registration_enabled: "true",
  reveal_rules: "Reveal is 100% mutual consent...",
  site_name: "SweetScene",
};

const inputClass =
  "bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none";

export function SiteSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({ ...DEFAULTS });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSettings().then((result) => {
      const filtered = result.filter((s) => s.category === "site");
      const next = { ...DEFAULTS };
      for (const s of filtered) {
        if (s.key in DEFAULTS && s.value_text) {
          next[s.key] = s.value_text;
        }
      }
      setForm(next);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      for (const [key, value] of Object.entries(form)) {
        const res = await setSetting(key, value, false, "site");
        if (res.error) {
          setMessage({ type: "error", text: res.error });
          setSaving(false);
          return;
        }
      }
      setMessage({ type: "success", text: "Settings saved successfully." });
    } catch {
      setMessage({ type: "error", text: "Failed to save settings." });
    }
    setSaving(false);
  }

  function toggle(key: "maintenance_mode" | "registration_enabled") {
    setForm({ ...form, [key]: form[key] === "true" ? "false" : "true" });
  }

  if (loading) {
    return <p className="text-foreground-dim">Loading...</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Site Settings</h1>

      {message && (
        <div
          className={
            message.type === "success"
              ? "bg-success/10 text-success border border-success rounded-md px-4 py-3 text-sm"
              : "bg-danger/10 text-danger border border-danger rounded-md px-4 py-3 text-sm"
          }
        >
          {message.text}
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">General</h2>
        <label className="block">
          <span className="block text-sm text-foreground-dim mb-1">Site Name</span>
          <input
            type="text"
            value={form.site_name}
            onChange={(e) => setForm({ ...form, site_name: e.target.value })}
            className={inputClass + " w-full"}
          />
        </label>
      </div>

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Toggles</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Maintenance Mode</p>
            <p className="text-xs text-foreground-dim">Disable the site for all users.</p>
          </div>
          <button
            onClick={() => toggle("maintenance_mode")}
            className={
              form.maintenance_mode === "true"
                ? "bg-success text-white rounded-md px-4 py-2 text-sm font-medium"
                : "bg-surface-raised border border-line text-foreground-dim rounded-md px-4 py-2 text-sm font-medium"
            }
          >
            {form.maintenance_mode === "true" ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Registration</p>
            <p className="text-xs text-foreground-dim">Allow new users to register.</p>
          </div>
          <button
            onClick={() => toggle("registration_enabled")}
            className={
              form.registration_enabled === "true"
                ? "bg-success text-white rounded-md px-4 py-2 text-sm font-medium"
                : "bg-surface-raised border border-line text-foreground-dim rounded-md px-4 py-2 text-sm font-medium"
            }
          >
            {form.registration_enabled === "true" ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Reveal Rules</h2>
        <textarea
          value={form.reveal_rules}
          onChange={(e) => setForm({ ...form, reveal_rules: e.target.value })}
          rows={5}
          className={inputClass + " w-full resize-y"}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
