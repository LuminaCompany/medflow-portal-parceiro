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

// `ease` do CSS (o site usa sempre `ease`, nunca spring — §12.1).
const EASE = [0.25, 0.1, 0.25, 1] as const;

/**
 * Sidebar = o "header/footer" do site Medflow: roxo chapado (#7137D6), texto `--fundo`,
 * divisores brancos translúcidos (.14). Item ativo vira "pílula invertida" (branco + roxo).
 */
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
      animate={{ width: collapsed ? 80 : 272 }}
      transition={{ duration: 0.25, ease: EASE }}
      className={cn(
        "sticky top-0 z-30 hidden h-svh shrink-0 flex-col overflow-hidden md:flex",
        "bg-sidebar text-sidebar-foreground",
        "border-r border-sidebar-border",
      )}
    >
      {/* Marca: wordmark branco (expandido) / símbolo "W" (recolhido) */}
      <div
        className={cn(
          "flex h-[96px] shrink-0 items-center border-b border-sidebar-border px-6",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Medflow — Visão Geral"
          className={cn(
            "flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring",
            collapsed ? "items-center justify-center" : "flex-col items-start gap-2.5",
          )}
        >
          {collapsed ? (
            <div className="relative size-10">
              <Image src="/fav.icon.png" alt="medflow" fill priority sizes="40px" />
            </div>
          ) : (
            <>
              <div className="relative h-8 w-[150px]">
                <Image
                  src="/logo-roxo.png"
                  alt="medflow"
                  fill
                  priority
                  sizes="150px"
                  className="object-contain object-left"
                />
              </div>
              <span className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.16em] whitespace-nowrap text-sidebar-foreground/80 uppercase before:h-[3px] before:w-5 before:rounded-[2px] before:bg-current">
                Portal do Parceiro
              </span>
            </>
          )}
        </Link>
      </div>

      {/* Navegação */}
      <nav aria-label="Navegação principal" className="mt-5 flex flex-1 flex-col gap-1 px-4">
        {items.map((item) => {
          const ativo = pathname.startsWith(item.href);
          const Icon = item.icon;
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium",
                "transition-colors duration-150 ease-[ease]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                ativo
                  ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.6} />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: EASE }}
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
      <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border p-4">
        {/* "Dar uma sugestão ou reportar um erro" — acima da linha do login */}
        <FeedbackDialog
          role={papel as Role}
          trigger={
            collapsed ? (
              <button
                type="button"
                aria-label="Dar uma sugestão ou reportar um erro"
                title="Dar uma sugestão ou reportar um erro"
                className="mx-auto flex size-10 items-center justify-center rounded-[10px] text-sidebar-foreground/85 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring"
              >
                <MessageSquarePlus className="size-5" strokeWidth={1.6} />
              </button>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-sidebar-foreground/85 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring"
              >
                <MessageSquarePlus className="size-5 shrink-0" strokeWidth={1.6} />
                <span className="leading-tight">Dar uma sugestão ou reportar um erro</span>
              </button>
            )
          }
        />

        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between pl-3")}>
          {!collapsed && (
            <span className="text-[11px] font-semibold tracking-[0.1em] text-sidebar-foreground/70 uppercase tabular-nums">
              Versão {APP_VERSION}
            </span>
          )}
          <ThemeToggle />
        </div>
        {collapsed && (
          <span className="text-center text-[10px] font-semibold tracking-wide text-sidebar-foreground/70 tabular-nums">
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
