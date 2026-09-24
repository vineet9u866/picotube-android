import type { Metadata, Viewport } from "next";
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
    "PicoTube is a compact, ad-free YouTube client. No accounts, no ads, just streaming. Powered by YouTube embeds.",
  keywords: ["PicoTube", "YouTube", "streaming", "minimal", "no ads", "no account"],
  authors: [{ name: "PicoTube" }],
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
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

export const viewport: Viewport = {
  // viewport-fit=cover enables the safe-area-inset-* env variables used in
  // globals.css to prevent the Android nav bar / iOS notch from clipping
  // content. Fixes screenshot #3 (bottom row cut off) and #1 (Share button
  // cut off on the right).
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Allow the app to be added to home screen and behave like a PWA — when
  // installed, it opens in fullscreen and respects safe-area-insets.
  themeColor: "#e11d48",
  userScalable: false,
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
