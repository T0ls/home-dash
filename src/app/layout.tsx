import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Homepage",
  description: "Dashboard dei servizi self-hosted",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="relative isolate flex min-h-full flex-col bg-zinc-950">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(56,189,248,0.15),transparent),radial-gradient(ellipse_60%_40%_at_90%_10%,rgba(168,85,247,0.12),transparent)]"
        />
        {children}
      </body>
    </html>
  );
}
