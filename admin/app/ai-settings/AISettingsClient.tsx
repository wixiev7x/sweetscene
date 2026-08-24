"use client";

import { useEffect, useState } from "react";
import { getSettings, setSetting, getSecretSetting } from "@/lib/actions/settings";

const DEFAULTS: Record<string, string> = {
  ai_provider: "deepseek",
  ai_model: "deepseek-chat",
  ai_temperature: "0.9",
  ai_max_tokens: "200",
  ai_nsfw_level: "off",
  ai_system_prompt: "",
};

const inputClass =
  "bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none";

export function AISettingsClient() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({ ...DEFAULTS });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((result) => {
      const filtered = result.filter(
        (s) => s.category === "ai" || s.category === "ai_secret"
      );
      const next = { ...DEFAULTS };
      for (const s of filtered) {
        if (s.key in DEFAULTS && s.value_text) {
          next[s.key] = s.value_text;
        }
      }
      setForm(next);
      setApiKeyConfigured(!!filtered.find((s) => s.key === "ai_api_key"));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      for (const [key, value] of Object.entries(form)) {
        const res = await setSetting(key, value, false, "ai");
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

  async function handleUpdateKey() {
    if (!apiKeyInput) return;
    setKeySaving(true);
    const res = await setSetting("ai_api_key", apiKeyInput, true, "ai");
    setKeySaving(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setApiKeyInput("");
    setApiKeyConfigured(true);
    setToast("API key updated.");
  }

  async function handleReveal() {
    setRevealing(true);
    const res = await getSecretSetting("ai_api_key");
    setRevealing(false);
    if (res.error) {
      setToast(res.error);
      return;
    }
    setRevealedKey(res.value || "Not set");
    setTimeout(() => setRevealedKey(null), 10000);
  }

  if (loading) {
    return <p className="text-foreground-dim">Loading...</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">AI Settings</h1>

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

      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface-raised border border-line rounded-md px-4 py-3 text-sm text-foreground shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Provider</h2>
        <label className="block">
          <span className="block text-sm text-foreground-dim mb-1">AI Provider</span>
          <select
            value={form.ai_provider}
            onChange={(e) => setForm({ ...form, ai_provider: e.target.value })}
            className={inputClass}
          >
            <option value="deepseek">deepseek</option>
            <option value="mock">mock</option>
            <option value="openai">openai</option>
          </select>
        </label>
      </div>

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">API Key</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground-dim">
            {apiKeyConfigured ? "•••••••• (configured)" : "Not set"}
          </span>
          {revealedKey && (
            <span className="text-sm text-foreground bg-surface-raised border border-line rounded-md px-2 py-1">
              {revealedKey}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            placeholder="New API key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className={inputClass + " flex-1"}
          />
          <button
            onClick={handleUpdateKey}
            disabled={keySaving || !apiKeyInput}
            className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
          >
            {keySaving ? "Saving..." : "Update Key"}
          </button>
          <button
            onClick={handleReveal}
            disabled={revealing || !apiKeyConfigured}
            className="bg-surface-raised border border-line text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
          >
            {revealing ? "..." : "Reveal"}
          </button>
          <button
            onClick={() => setToast("Connection test — feature coming soon")}
            className="bg-surface-raised border border-line text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Test Connection
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Model</h2>
        <label className="block">
          <span className="block text-sm text-foreground-dim mb-1">Model</span>
          <input
            type="text"
            value={form.ai_model}
            onChange={(e) => setForm({ ...form, ai_model: e.target.value })}
            className={inputClass + " w-full"}
          />
        </label>
        <label className="block">
          <span className="block text-sm text-foreground-dim mb-1">
            Default Temperature: {form.ai_temperature}
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={form.ai_temperature}
            onChange={(e) => setForm({ ...form, ai_temperature: e.target.value })}
            className="w-full"
          />
        </label>
        <label className="block">
          <span className="block text-sm text-foreground-dim mb-1">Max Tokens</span>
          <input
            type="number"
            value={form.ai_max_tokens}
            onChange={(e) => setForm({ ...form, ai_max_tokens: e.target.value })}
            className={inputClass + " w-full"}
          />
        </label>
        <label className="block">
          <span className="block text-sm text-foreground-dim mb-1">NSFW Level</span>
          <select
            value={form.ai_nsfw_level}
            onChange={(e) => setForm({ ...form, ai_nsfw_level: e.target.value })}
            className={inputClass}
          >
            <option value="off">off</option>
            <option value="soft">soft</option>
            <option value="unrestricted">unrestricted</option>
          </select>
        </label>
      </div>

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">System Prompt</h2>
        <textarea
          value={form.ai_system_prompt}
          onChange={(e) => setForm({ ...form, ai_system_prompt: e.target.value })}
          rows={6}
          className={inputClass + " w-full resize-y"}
          placeholder="Enter system prompt..."
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
