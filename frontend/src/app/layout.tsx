import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-Tsukiko - Twitch Streaming Companion",
  description: "AI-powered streaming companion with real-time chat, screen analysis, and TTS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
