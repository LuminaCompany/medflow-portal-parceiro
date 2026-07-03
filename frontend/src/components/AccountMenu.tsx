"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronsUpDown, Loader2, LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Menu de conta no rodapé da sidebar (RF-003): avatar + nome + sair.
// Gestor também edita o próprio nome de exibição por aqui (`podeEditarNome`).
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
  podeEditarNome = false,
}: {
  nome: string;
  papel: string;
  collapsed?: boolean;
  podeEditarNome?: boolean;
}) {
  const router = useRouter();
  const [editarAberto, setEditarAberto] = useState(false);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
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
                <span className="truncate text-xs text-sidebar-foreground/75">{papel}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/70" />
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
            {podeEditarNome && (
              <DropdownMenuItem onSelect={() => setEditarAberto(true)}>
                <Pencil />
                Editar nome
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={sair}>
              <LogOut />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {podeEditarNome && (
        <EditarNomeDialog aberto={editarAberto} onAberto={setEditarAberto} nomeAtual={nome} />
      )}
    </>
  );
}

/**
 * Dialog de edição do próprio nome de exibição. Grava em `user_metadata.display_name` via
 * `supabase.auth.updateUser` (o próprio usuário pode alterar o seu user_metadata — não é dado
 * de isolamento, que vive no app_metadata). Ao salvar, recarrega para o portal refletir o nome.
 */
function EditarNomeDialog({
  aberto,
  onAberto,
  nomeAtual,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  nomeAtual: string;
}) {
  const [nome, setNome] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);

  const valor = nome.trim();
  const podeSalvar = valor !== "" && valor !== nomeAtual.trim() && !salvando;

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ data: { display_name: valor } });
    if (error) {
      setSalvando(false);
      toast.error("Não foi possível salvar o nome. Tente novamente.");
      return;
    }
    // Nome vive no user_metadata do token; recarrega p/ `GET /api/me` refletir.
    window.location.reload();
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (salvando) return;
        onAberto(o);
        if (o) setNome(nomeAtual); // reabre sempre com o nome vigente
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">Editar nome</DialogTitle>
          <DialogDescription>
            Este é o nome exibido no portal. Você pode alterá-lo quando quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 py-1">
          <Label htmlFor="editar-nome">Nome de exibição</Label>
          <Input
            id="editar-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                salvar();
              }
            }}
            maxLength={80}
            placeholder="Seu nome"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onAberto(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!podeSalvar}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
