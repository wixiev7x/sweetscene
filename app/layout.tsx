import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NotificationBell from "@/components/NotificationBell";
import AgeCohortGate from "@/components/AgeCohortGate";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sweetscene — anonymous AI roleplay dating",
  description:
    "Match anonymously, roleplay inside a shared scene with an AI director, and decide if the fog lifts. 16+.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <div className="fixed top-3 right-3 z-50">
          <NotificationBell />
        </div>
        <AgeCohortGate />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
