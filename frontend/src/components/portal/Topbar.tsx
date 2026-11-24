"use client";

import { useEffect, useState } from "react";
import { Menu, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Barra superior do conteúdo: colapsar sidebar (desktop) / abrir menu (mobile) + seção atual.
// Igual ao header do site (§12.3): sticky, ganha sombra `--shadow-header` ao rolar > 24px.
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
  const rolado = useRolado(24);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10",
        "border-b border-border bg-background/95 backdrop-blur-md",
        "transition-shadow duration-250 ease-[ease]",
        rolado && "shadow-header",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="hidden text-muted-foreground hover:text-accent-foreground md:inline-flex"
        onClick={onToggleCollapse}
        aria-label="Recolher menu lateral"
      >
        <PanelLeft className="size-5" strokeWidth={1.6} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-accent-foreground md:hidden"
        onClick={onOpenMobile}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" strokeWidth={1.6} />
      </Button>

      <nav aria-label="Você está em" className="flex min-w-0 items-center gap-2 text-[15px]">
        <span className="hidden text-muted-foreground sm:inline">Portal do Parceiro</span>
        <span aria-hidden className="hidden text-border sm:inline">
          /
        </span>
        <span className="truncate font-semibold text-strong">{titulo}</span>
      </nav>

      {gestor && (
        <span className="tag ml-auto hidden sm:inline-flex">
          <span className="size-1.5 rounded-full bg-primary" />
          {/* Texto completo só em telas largas; no mobile encurta pra não espremer o título. */}
          <span className="hidden md:inline">Visão do gestor · todos os parceiros</span>
          <span className="md:hidden">Visão do gestor</span>
        </span>
      )}
    </header>
  );
}

/** true quando a página rolou além de `limite` px (atualizado via rAF, como no site). */
function useRolado(limite: number) {
  const [rolado, setRolado] = useState(false);
  useEffect(() => {
    let frame = 0;
    const atualizar = () => {
      frame = 0;
      setRolado(window.scrollY > limite);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(atualizar);
    };
    atualizar();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [limite]);
  return rolado;
}
