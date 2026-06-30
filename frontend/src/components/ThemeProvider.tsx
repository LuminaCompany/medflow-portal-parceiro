"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

// next-themes dirige a classe `.dark` (padrão shadcn). Sidebar é sempre escura,
// independentemente do tema do conteúdo. disableTransitionOnChange evita flash.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
