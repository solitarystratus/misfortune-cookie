/**
 * app/layout.tsx
 * Minimal root layout for Next.js App Router.
 * Sets the midnight-blue background on <html> so no flash of white
 * appears before React hydrates, and configures the mobile viewport.
 */
import type { Metadata, Viewport } from "next";
import "./globals.css"; // Required — Tailwind won't load without this

export const metadata: Metadata = {
  title: "Misfortune Cookie",
  description: "Let the cosmos tell you what's wrong with you. AI-powered roasts, locally in your browser.",
  openGraph: {
    title: "Misfortune Cookie",
    description: "Let the cosmos tell you what's wrong with you.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,          // prevent pinch-zoom on mobile
  themeColor: "#0A0F1C",        // matches the midnight-blue background
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      style={{ background: "#0A0F1C" }}
    >
      <body style={{ margin: 0, padding: 0, background: "#0A0F1C" }}>
        {children}
      </body>
    </html>
  );
}
