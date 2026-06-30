"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Menu de conta no rodapé da sidebar (RF-003): avatar + nome + sair.
// Sem emoji — avatar com inicial + ícones lucide.
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function AccountMenu({
  nome,
  papel,
  collapsed = false,
}: {
  nome: string;
  papel: string;
  collapsed?: boolean;
}) {
  const router = useRouter();

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl p-2 text-left",
          "text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
          "focus-visible:outline-2 focus-visible:outline-sidebar-ring",
          collapsed && "justify-center",
        )}
      >
        <Avatar className="size-9 rounded-lg border border-sidebar-border/60">
          <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-sm font-semibold text-sidebar-primary-foreground">
            {iniciais(nome)}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <span className="grid flex-1 leading-tight">
              <span className="truncate text-sm font-medium">{nome}</span>
              <span className="truncate text-xs text-sidebar-foreground/55">{papel}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/45" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{nome}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{papel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onSelect={sair}>
            <LogOut />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
