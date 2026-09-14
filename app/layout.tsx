import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Fira_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import SiteNav from "@/components/SiteNav";
import HeartCursor from "@/components/HeartCursor";
import ScrollProgress from "@/components/ui/ScrollProgress";

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const firaSans = Fira_Sans({
  variable: "--font-fira",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sweetscene.love"
  ),
  title: {
    default: "SweetScene — Anonymous AI Matchmaking",
    template: "%s · SweetScene",
  },
  description:
    "Anonymous matchmaking. Match first. Build connection. Reveal only when both sides agree. 16+ platform to join.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "SweetScene — Anonymous AI Matchmaking",
    description:
      "Match anonymously. Build connection in an AI-guided scene. Reveal only when both sides agree.",
    siteName: "SweetScene",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#150f1d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSerif.variable} ${firaSans.variable} h-full antialiased scanline-overlay noise-overlay`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#site-main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[10001] focus:px-4 focus:py-2 focus:rounded-full focus:bg-surface-raised focus:border focus:border-line-strong focus:text-foreground focus:text-sm"
        >
          Skip to content
        </a>
        <SiteNav />
        <HeartCursor />
        <ScrollProgress />
        <main
          id="site-main"
          className="flex-1 w-full md:pl-56 pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </main>
        <ServiceWorkerRegister />
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--surface-raised)",
              border: "1px solid var(--line-strong)",
              color: "var(--foreground)",
            },
          }}
        />
      </body>
    </html>
  );
}
