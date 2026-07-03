"use client";

import { useState } from "react";
import { Bug, Lightbulb, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiSend } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FeedbackTipo } from "@/lib/types";

// Abas do portal + escape "Não se encaixa". O usuário pode escolher QUALQUER aba (mesmo as que
// não vê no seu papel) — o feedback é lido pelo gestor.
const ABAS = [
  "Visão Geral",
  "Solicitações",
  "Vencimentos",
  "Pagamentos",
  "Parceiros",
  "Pendências",
  "Feedbacks",
  "Login / entrada",
  "Não se encaixa em nenhuma aba",
] as const;

/**
 * Diálogo de feedback (sugestão / bug), disponível a parceiros e gestores. Campos:
 *  - Aba: onde o item está (select) · Tipo: sugestão | bug (toggle) · Descrição (textarea).
 * Recebe o `trigger` (o botão que abre) via prop — quem monta decide a aparência.
 */
export function FeedbackDialog({ trigger }: { trigger: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<string>("");
  const [tipo, setTipo] = useState<FeedbackTipo>("sugestao");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);

  function reset() {
    setAba("");
    setTipo("sugestao");
    setDescricao("");
  }

  const podeEnviar = aba.trim() !== "" && descricao.trim() !== "" && !enviando;

  async function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      await apiSend("POST", "/api/feedbacks", { aba, tipo, descricao });
      toast.success(
        tipo === "bug" ? "Erro reportado. Obrigado!" : "Sugestão enviada. Obrigado!",
      );
      setAberto(false);
      reset();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar o feedback.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (enviando) return;
        setAberto(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">
            Dar uma sugestão ou reportar um erro
          </DialogTitle>
          <DialogDescription>
            Conte para a equipe o que pode melhorar ou o que não funcionou. Vai direto para os
            gestores.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* Aba */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb-aba">Em qual aba?</Label>
            <Select value={aba} onValueChange={setAba}>
              <SelectTrigger id="fb-aba" className="w-full" size="default">
                <SelectValue placeholder="Escolha a aba…" />
              </SelectTrigger>
              <SelectContent>
                {ABAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo: toggle sugestão | bug */}
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              <ToggleTipo
                ativo={tipo === "sugestao"}
                onClick={() => setTipo("sugestao")}
                icon={<Lightbulb className="size-4" />}
                label="Sugestão"
                tom="brand"
              />
              <ToggleTipo
                ativo={tipo === "bug"}
                onClick={() => setTipo("bug")}
                icon={<Bug className="size-4" />}
                label="Bug / erro"
                tom="danger"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb-desc">
              {tipo === "bug"
                ? "Descreva detalhadamente seu erro"
                : "Descreva detalhadamente sua sugestão"}
            </Label>
            <Textarea
              id="fb-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={
                tipo === "bug"
                  ? "O que você fez, o que esperava e o que aconteceu?"
                  : "O que poderia ser melhor e por quê?"
              }
              maxLength={4000}
              className="min-h-32"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={!podeEnviar}>
            {enviando ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleTipo({
  ativo,
  onClick,
  icon,
  label,
  tom,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tom: "brand" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        !ativo && "border-input text-muted-foreground hover:bg-accent/60",
        ativo && tom === "brand" && "border-primary bg-primary/10 text-primary",
        ativo && tom === "danger" && "border-destructive bg-destructive/10 text-danger-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
