import "./globals.css";
import { Inconsolata } from "next/font/google";
import localFont from "@next/font/local";
import StationInfo from "@/components/StationInfo";
import { StationProvider } from "@/contexts/StationContext";

// const inter = Inconsolata({
//   subsets: ["latin"],
// });

const neue = localFont({
  src: [
    {
      path: "../public/fonts/PPNeueMontreal-Medium.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/PPNeueMontreal-Bold.otf",
      weight: "700",
      style: "bold",
    },
    {
      path: "../public/fonts/PPNeueMontreal-Thin.otf",
      weight: "200",
      style: "thin",
    },
    {
      path: "../public/fonts/PPNeueMontreal-Book.otf",
      weight: "300",
      style: "semibold",
    },
  ],
  variable: "--font-neue",
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
      <body className={neue.variable}>
        <StationProvider>{children}</StationProvider>
      </body>
    </html>
  );
}
