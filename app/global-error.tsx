"use client";

/* Global error boundary — the last resort. app/error.tsx catches
 * errors inside the route tree, but if the ROOT layout itself throws,
 * only this file can render (it must ship its own <html>/<body>).
 * Without it a root-layout crash shows the browser's default white
 * "this page crashed" screen; with it the user gets a themed card and
 * a way back. */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[SweetScene] Root layout error:", error);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0510",
          color: "#f5f0f7",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px",
            padding: "32px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 20px",
              borderRadius: "50%",
              background: "rgba(219,72,123,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            <span role="img" aria-label="heart">
              💜
            </span>
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "14px", opacity: 0.65, margin: "0 0 24px", lineHeight: 1.5 }}>
            SweetScene hit an unexpected error. Your data is safe — try
            again, or reload in a moment.
          </p>
          {error.digest && (
            <p style={{ fontSize: "10px", opacity: 0.4, margin: "0 0 24px" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              width: "100%",
              height: "48px",
              borderRadius: "999px",
              border: "none",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              color: "#fff",
              background: "linear-gradient(to right, #a3356a, #db487b)",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
