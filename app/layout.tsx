import type { Metadata, Viewport } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import NotificationBell from "@/components/NotificationBell";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import SiteNav from "@/components/SiteNav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SweetScene — Anonymous AI Matchmaking",
  description:
    "Anonymous matchmaking. Match first. Build connection. Reveal only when both sides agree.",
};

export const viewport: Viewport = {
  themeColor: "#050508",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${pressStart2P.variable} h-full antialiased scanline-overlay noise-overlay`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteNav />
        <div className="flex-1">{children}</div>
        <div className="fixed top-3 right-3 z-50">
          <NotificationBell />
        </div>
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
