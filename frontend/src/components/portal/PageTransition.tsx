"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";

// Efeito ao trocar de aba: remonta por rota → fade curto (.25s ease, como o site — sem spring).
// prefers-reduced-motion neutraliza via CSS global.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
