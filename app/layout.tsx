import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces, Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import NotificationBell from "@/components/NotificationBell";
import AgeCohortGate from "@/components/AgeCohortGate";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import LenisProvider from "@/components/LenisProvider";
import CupidCursor from "@/components/CupidCursor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ── Chat fonts ── loaded once at root; exposed as CSS vars in globals.css */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "sweetscene — anonymous AI roleplay dating",
  description:
    "Match anonymously, roleplay inside a shared scene with an AI director, and decide if the fog lifts. 16+.",
  keywords: ["AI roleplay", "anonymous dating", "matchmaking", "dreamcoins"],
};

export const viewport: Viewport = {
  themeColor: "#a855f7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${manrope.variable} ${spaceGrotesk.variable} h-full antialiased bg-black`}
    >
      <body className="min-h-full flex flex-col">
        <LenisProvider>
          {children}
        </LenisProvider>
        <div className="fixed top-3 right-3 z-50">
          <NotificationBell />
        </div>
        <AgeCohortGate />
        <ServiceWorkerRegister />
        <CupidCursor />
      </body>
    </html>
  );
}
