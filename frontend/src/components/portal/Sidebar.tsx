"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

import { AccountMenu } from "@/components/AccountMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const PAPEL_LABEL: Record<string, string> = { parceiro: "Parceiro", gestor: "Gestor" };

export function Sidebar({
  items,
  nome,
  papel,
  collapsed,
}: {
  items: NavItem[];
  nome: string;
  papel: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 264 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "sticky top-0 z-30 hidden h-svh shrink-0 flex-col overflow-hidden md:flex",
        "bg-sidebar text-sidebar-foreground",
        "border-r border-sidebar-border/60",
      )}
    >
      {/* Atmosfera: brilho roxo ambiente no topo + textura sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-70"
        style={{
          background:
            "radial-gradient(120% 60% at 18% 0%, oklch(0.6 0.2 292 / 0.28), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="animate-glow pointer-events-none absolute -top-24 -left-16 size-56 rounded-full blur-3xl"
        style={{ background: "oklch(0.62 0.2 300 / 0.22)" }}
      />

      {/* Marca */}
      <div className={cn("relative flex h-[72px] items-center px-4", collapsed && "justify-center px-0")}>
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold text-white shadow-lg ring-1 ring-white/15"
            style={{
              background: "linear-gradient(135deg, oklch(0.58 0.2 292), oklch(0.45 0.16 288))",
              boxShadow: "0 6px 20px oklch(0.5 0.2 292 / 0.45)",
            }}
          >
            <span className="italic">m</span>
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2 }}
                className="grid leading-none"
              >
                <span className="font-display text-xl font-bold tracking-tight text-white">
                  med<span className="font-extrabold italic">flow</span>
                </span>
                <span className="mt-1 text-[10px] font-medium tracking-[0.18em] text-sidebar-foreground/45">
                  PORTAL DE PARCEIROS
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navegação */}
      <nav className="relative mt-3 flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const ativo = pathname.startsWith(item.href);
          const Icon = item.icon;
          const link = (
            <Link
              key={item.href}
              href={item.href}
              data-active={ativo}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                ativo && "bg-sidebar-accent text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {ativo && (
                <motion.span
                  layoutId="nav-active-bar"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  className="absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary"
                  style={{ boxShadow: "0 0 12px oklch(0.7 0.18 292 / 0.8)" }}
                />
              )}
              <Icon
                className={cn(
                  "size-[19px] shrink-0 transition-colors",
                  ativo ? "text-sidebar-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                )}
              />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.18 }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );

          return collapsed ? (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      {/* Rodapé: tema + conta */}
      <div className="relative mt-auto flex flex-col gap-1 border-t border-sidebar-border/50 p-3">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-1")}>
          {!collapsed && (
            <span className="text-[11px] font-medium tracking-wide text-sidebar-foreground/40">
              {PAPEL_LABEL[papel] ?? papel}
            </span>
          )}
          <ThemeToggle />
        </div>
        <AccountMenu nome={nome} papel={PAPEL_LABEL[papel] ?? papel} collapsed={collapsed} />
      </div>
    </motion.aside>
  );
}
