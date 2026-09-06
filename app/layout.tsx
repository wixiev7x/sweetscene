import type { Metadata, Viewport } from "next";
import { Fraunces, Sora, Space_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import SiteNav from "@/components/SiteNav";

const fraunces = Fraunces({
  variable: "--font-press-start",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sweetscene.love"
  ),
  title: "SweetScene — Anonymous AI Matchmaking",
  description:
    "Anonymous matchmaking. Match first. Build connection. Reveal only when both sides agree. 16+ to join, 18+ for NSFW.",
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
      className={`${fraunces.variable} ${sora.variable} ${spaceMono.variable} h-full antialiased scanline-overlay noise-overlay`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteNav />
        <div className="flex-1 md:pl-56">{children}</div>
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
