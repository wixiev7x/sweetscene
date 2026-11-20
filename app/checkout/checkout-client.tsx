"use client";

import { useState } from "react";
import Script from "next/script";
import Link from "next/link";

type PaddleGlobal = {
  Environment: { set: (env: "sandbox") => void };
  Initialize: (opts: {
    token: string;
    eventCallback?: (e: { name?: string }) => void;
  }) => void;
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

export default function CheckoutClient({
  token,
  env,
}: {
  token: string | null;
  env: "sandbox" | "production";
}) {
  const [state, setState] = useState<"loading" | "open" | "done" | "closed" | "error">(
    token ? "loading" : "error",
  );
  function init() {
    if (!token || !window.Paddle) {
      setState("error");
      return;
    }
    if (!new URLSearchParams(window.location.search).has("_ptxn")) {
      setState("error");
      return;
    }
    if (env === "sandbox") window.Paddle.Environment.set("sandbox");
    window.Paddle.Initialize({
      token,
      eventCallback: (e) => {
        if (e.name === "checkout.loaded") setState("open");
        if (e.name === "checkout.completed") {
          setState("done");
          setTimeout(() => window.location.assign("/billing?status=success"), 2500);
        }
        if (e.name === "checkout.closed") setState((s) => (s === "done" ? s : "closed"));
        if (e.name === "checkout.error") setState("error");
      },
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      {token && (
        <Script
          src="https://cdn.paddle.com/paddle/v2/paddle.js"
          strategy="afterInteractive"
          onLoad={init}
          onError={() => setState("error")}
        />
      )}
      <div className="max-w-md text-center">
        {state === "loading" && <p className="type-body text-muted">Opening secure checkout…</p>}
        {state === "open" && <p className="type-body text-muted">Complete your purchase in the checkout window.</p>}
        {state === "done" && (
          <p className="type-body text-foreground">Payment received — your balance updates in a moment.</p>
        )}
        {state === "closed" && (
          <p className="type-body text-muted">
            Checkout closed. <Link href="/billing" className="text-accent-candle underline">Back to billing</Link>
          </p>
        )}
        {state === "error" && (
          <p className="type-body text-muted">
            Checkout isn&apos;t available right now.{" "}
            <Link href="/billing" className="text-accent-candle underline">Back to billing</Link>
          </p>
        )}
      </div>
    </div>
  );
}
