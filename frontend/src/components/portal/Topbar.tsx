"use client";

import { Menu, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Barra superior do conteúdo: colapsar sidebar (desktop) / abrir menu (mobile) + seção atual.
export function Topbar({
  titulo,
  onToggleCollapse,
  onOpenMobile,
  gestor,
}: {
  titulo: string;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
  gestor: boolean;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center gap-2 px-3 sm:px-5",
        "border-b border-border/70 bg-background/75 backdrop-blur-xl",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={onToggleCollapse}
        aria-label="Recolher menu lateral"
      >
        <PanelLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobile}
        aria-label="Abrir menu"
      >
        <Menu />
      </Button>
      <Separator orientation="vertical" className="!h-5" />
      <span className="font-display text-sm font-semibold tracking-tight text-foreground">
        {titulo}
      </span>

      {gestor && (
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-3 py-1 text-xs font-medium text-brand-ink">
          <span className="size-1.5 rounded-full bg-brand-bright" />
          Visão do gestor · todos os parceiros
        </span>
      )}
    </header>
  );
}
