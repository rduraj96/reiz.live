import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const neue = localFont({
  src: [
    { path: "../public/fonts/PPNeueMontreal-Thin.otf", weight: "200", style: "normal" },
    { path: "../public/fonts/PPNeueMontreal-Book.otf", weight: "300", style: "normal" },
    { path: "../public/fonts/PPNeueMontreal-Medium.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/PPNeueMontreal-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-neue",
});

export const metadata: Metadata = {
  title: "REIZDIO",
  description: "Free live radio with a 3D audio visualizer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={neue.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
