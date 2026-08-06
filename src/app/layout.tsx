import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/picotube/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PicoTube — Minimal video streaming",
  description:
    "PicoTube is a compact, ad-free YouTube client. No accounts, no ads, just streaming. Powered by the YouTube Data API and YouTube embeds.",
  keywords: ["PicoTube", "YouTube", "streaming", "minimal", "no ads", "no account"],
  authors: [{ name: "PicoTube" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "PicoTube — Minimal video streaming",
    description: "Compact, ad-free YouTube client. No accounts required.",
    siteName: "PicoTube",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PicoTube",
    description: "Minimal YouTube client. No accounts, no ads.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
