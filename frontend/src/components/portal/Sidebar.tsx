"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

import { MessageSquarePlus } from "lucide-react";

import { AccountMenu } from "@/components/AccountMenu";
import { FeedbackDialog } from "@/components/portal/FeedbackDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

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
          className={cn(
            "flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            collapsed ? "items-center justify-center" : "flex-col items-start gap-1.5",
          )}
        >
          <div className={cn("relative shrink-0", collapsed ? "size-9" : "h-9 w-[160px]")}>
            <Image
              src="/logo-roxo.png"
              alt="medflow"
              fill
              priority
              sizes="160px"
              className="object-contain object-left"
            />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2 }}
                className="text-[10px] font-medium tracking-[0.18em] text-sidebar-foreground/75"
              >
                PORTAL DE PARCEIROS
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
                  ativo ? "text-sidebar-primary" : "text-sidebar-foreground/75 group-hover:text-sidebar-foreground",
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

      {/* Rodapé: feedback + versão + tema + conta */}
      <div className="relative mt-auto flex flex-col gap-2 border-t border-sidebar-border/50 p-3">
        {/* "Dar uma sugestão ou reportar um erro" — acima da linha do login */}
        <FeedbackDialog
          role={papel as Role}
          trigger={
            collapsed ? (
              <button
                type="button"
                aria-label="Dar uma sugestão ou reportar um erro"
                title="Dar uma sugestão ou reportar um erro"
                className="mx-auto flex size-9 items-center justify-center rounded-xl text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
              >
                <MessageSquarePlus className="size-[19px]" />
              </button>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
              >
                <MessageSquarePlus className="size-[18px] shrink-0" />
                <span className="leading-tight">Dar uma sugestão ou reportar um erro</span>
              </button>
            )
          }
        />

        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-1")}>
          {!collapsed && (
            <span className="rounded-full bg-sidebar-accent/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sidebar-foreground/60">
              {APP_VERSION}
            </span>
          )}
          <ThemeToggle />
        </div>
        {collapsed && (
          <span className="text-center text-[10px] font-semibold tracking-wide text-sidebar-foreground/50">
            {APP_VERSION}
          </span>
        )}
        <AccountMenu
          nome={nome}
          papel={PAPEL_LABEL[papel] ?? papel}
          collapsed={collapsed}
          podeEditarNome={papel === "gestor"}
        />
      </div>
    </motion.aside>
  );
}
