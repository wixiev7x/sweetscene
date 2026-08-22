import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", cb);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", cb);
    }
  };
}

function getServerSnapshot(): string {
  return "false";
}

/**
 * Reads a boolean flag from localStorage reactively via
 * useSyncExternalStore (no setState-in-effect). Call `notifyFlagChange`
 * after writing the same key so other components / tabs re-render.
 */
export function useStoredFlag(key: string): boolean {
  const getClientSnapshot = (): string =>
    typeof window === "undefined"
      ? "false"
      : String(window.localStorage.getItem(key) === "true");

  const value = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  return value === "true";
}

/**
 * Notifies subscribers (and other tabs via the storage event) that a
 * stored flag changed. Call this right after `localStorage.setItem`.
 */
export function notifyFlagChange(): void {
  listeners.forEach((l) => l());
}