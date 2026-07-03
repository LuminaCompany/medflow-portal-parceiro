import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { ThemeProvider } from "@/components/ThemeProvider";
import "@/styles/globals.css";

// Display/marca = Montserrat (identidade MedFlow). Corpo = Geist; código = Geist Mono.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MedFlow — Portal do Parceiro",
  description: "Transparência de antecipação de recebíveis médicos.",
  icons: { icon: "/fav.icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${montserrat.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
