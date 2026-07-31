import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LyricForge AI — Word-perfect lyric videos, forged in minutes",
  description:
    "AI-powered lyrical video editor: Whisper word-level sync, 32 canvas animation presets, karaoke highlighting and WebCodecs 1080p60 export. Perpetual license, source included.",
  keywords: [
    "lyric video editor",
    "karaoke video",
    "whisper alignment",
    "webcodecs export",
    "AI video tool",
  ],
  openGraph: {
    title: "LyricForge AI",
    description: "Word-perfect lyric videos, forged in minutes.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#07070c] text-forge-text antialiased">{children}</body>
    </html>
  );
}
