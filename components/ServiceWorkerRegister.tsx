"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!reloaded) {
          reloaded = true;
          window.location.reload();
        }
      });
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}