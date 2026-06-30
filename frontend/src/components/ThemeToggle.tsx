"use client";

import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// Alterna o tema do CONTEÚDO (claro/escuro). Vive na sidebar (sempre escura).
// Ícone lucide animado — sem emoji. Respeita prefers-reduced-motion via CSS global.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const escuro = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-lg",
        "text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
        "focus-visible:outline-2 focus-visible:outline-sidebar-ring",
        className,
      )}
    >
      {montado ? (
        <motion.span
          key={escuro ? "sun" : "moon"}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          {escuro ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </motion.span>
      ) : (
        <span className="size-[18px]" />
      )}
    </button>
  );
}
