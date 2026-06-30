"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";

// Efeito ao trocar de aba: remonta por rota → entrada suave (fade + leve subida).
// prefers-reduced-motion neutraliza via CSS global.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
