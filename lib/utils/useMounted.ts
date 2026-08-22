import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

function getServerSnapshot(): boolean {
  return false;
}

function getClientSnapshot(): boolean {
  return true;
}

/**
 * Returns `false` during SSR and the first server-rendered hydration
 * pass, then `true` after hydration on the client. Use this instead of
 * the `useState(false) + useEffect(() => setMounted(true))` pattern to
 * avoid calling setState synchronously inside an effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
}