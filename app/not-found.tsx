import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] bg-background text-foreground flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <p className="type-eyebrow text-accent-candle mb-3">404</p>
        <h1 className="type-display text-3xl mb-3">
          This scene doesn&rsquo;t <span className="gradient-text">exist.</span>
        </h1>
        <p className="type-body text-muted mb-8">
          The page you were looking for has left the stage. The rest of the house is still open.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand to-brand-dark px-6 text-sm font-semibold text-accent-foreground ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
          >
            Back to Explore
          </Link>
          <Link
            href="/matchmake"
            className="inline-flex h-11 items-center rounded-full border border-line-strong px-6 text-sm font-medium text-foreground hover:border-accent-candle hover:text-accent-candle ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
          >
            Find a match
          </Link>
        </div>
      </div>
    </div>
  );
}
