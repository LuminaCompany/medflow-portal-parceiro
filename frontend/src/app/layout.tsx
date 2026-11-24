import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ThemeProvider } from "@/components/ThemeProvider";
import "@/styles/globals.css";

// Família única do site Medflow (DESIGN-SYSTEM-SITE-MEDFLOW §4.1): Inter 400/500/600/700.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Medflow — Portal do Parceiro",
  description: "Transparência de antecipação de recebíveis médicos.",
  icons: { icon: "/fav.icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#7137D6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
