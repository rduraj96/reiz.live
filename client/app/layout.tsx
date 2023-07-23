import "./globals.css";
import { Inconsolata } from "next/font/google";

const inter = Inconsolata({
  subsets: ["latin"],
});

export const metadata = {
  title: "Reiz FM",
  description: "Free online radio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
