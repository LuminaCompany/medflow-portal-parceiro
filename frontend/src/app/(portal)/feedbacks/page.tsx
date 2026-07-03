"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bug,
  CircleCheckBig,
  Inbox,
  Lightbulb,
  Loader2,
  MessageSquare,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { StatCard } from "@/components/portal/StatCard";
import { ErroCarregamento } from "@/components/portal/ErroCarregamento";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import { formatDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Feedback, FeedbacksGestor } from "@/lib/types";

type FiltroStatus = "todos" | "aberto" | "feito";
type FiltroTipo = "todos" | "sugestao" | "bug";

// Mural de Feedbacks (gestor-only): sugestões e bugs enviados por parceiros e gestores.
export default function FeedbacksPage() {
  const [data, setData] = useState<FeedbacksGestor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [fStatus, setFStatus] = useState<FiltroStatus>("todos");
  const [fTipo, setFTipo] = useState<FiltroTipo>("todos");

  const recarregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    apiGet<FeedbacksGestor>("/api/feedbacks")
      .then(setData)
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Falha ao carregar feedbacks."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar, tentativa]);

  const feedbacks = useMemo(() => {
    const todos = data?.feedbacks ?? [];
    return todos.filter(
      (f) =>
        (fStatus === "todos" || f.status === fStatus) &&
        (fTipo === "todos" || f.tipo === fTipo),
    );
  }, [data, fStatus, fTipo]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <MessageSquare className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedbacks</h1>
          <p className="mt-0.5 text-muted-foreground">
            Sugestões e erros reportados pelos parceiros e gestores. Marque como feito ao concluir.
          </p>
        </div>
      </div>

      {carregando ? (
        <FeedbacksSkeleton />
      ) : erro ? (
        <ErroCarregamento onRetry={() => setTentativa((t) => t + 1)} mensagem={erro} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard index={0} label="Abertos" value={String(data?.cards.abertos ?? 0)} icon={Inbox} tone="warning" highlight={(data?.cards.abertos ?? 0) > 0} />
            <StatCard index={1} label="Concluídos" value={String(data?.cards.concluidos ?? 0)} icon={CircleCheckBig} tone="success" />
            <StatCard index={2} label="Sugestões" value={String(data?.cards.sugestoes ?? 0)} icon={Lightbulb} tone="brand" />
            <StatCard index={3} label="Bugs" value={String(data?.cards.bugs ?? 0)} icon={Bug} tone="brand" />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-4">
            <FiltroGrupo
              valor={fStatus}
              onChange={(v) => setFStatus(v as FiltroStatus)}
              opcoes={[
                { v: "todos", label: "Todos" },
                { v: "aberto", label: "Abertos" },
                { v: "feito", label: "Concluídos" },
              ]}
            />
            <FiltroGrupo
              valor={fTipo}
              onChange={(v) => setFTipo(v as FiltroTipo)}
              opcoes={[
                { v: "todos", label: "Todos" },
                { v: "sugestao", label: "Sugestões" },
                { v: "bug", label: "Bugs" },
              ]}
            />
          </div>

          {feedbacks.length > 0 ? (
            <div className="flex flex-col gap-3">
              {feedbacks.map((f) => (
                <FeedbackCard key={f.id} feedback={f} onMutate={recarregar} />
              ))}
            </div>
          ) : (
            <Empty className="border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquare />
                </EmptyMedia>
                <EmptyTitle>Nenhum feedback por aqui</EmptyTitle>
                <EmptyDescription>
                  Quando parceiros ou gestores enviarem sugestões e erros, eles aparecerão aqui.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </>
      )}
    </div>
  );
}

function FiltroGrupo({
  valor,
  onChange,
  opcoes,
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: { v: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            valor === o.v
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PAPEL_LABEL: Record<string, string> = { parceiro: "Parceiro", gestor: "Gestor" };

function FeedbackCard({ feedback: f, onMutate }: { feedback: Feedback; onMutate: () => void }) {
  const feito = f.status === "feito";
  const ehBug = f.tipo === "bug";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors",
        feito && "opacity-75",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={cn(
            ehBug ? "bg-destructive/12 text-danger-ink" : "bg-primary/12 text-primary",
          )}
        >
          {ehBug ? <Bug className="size-3" /> : <Lightbulb className="size-3" />}
          {f.tipo_label}
        </Badge>
        <Badge variant="outline">{f.aba}</Badge>
        {feito ? (
          <Badge className="bg-success/15 text-success-ink">
            <CircleCheckBig className="size-3" />
            Concluído
          </Badge>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {formatDataHora(f.created_at)}
        </span>
      </div>

      <p className="text-sm whitespace-pre-wrap text-foreground/90">{f.descricao}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{f.autor_nome}</span>
          {" · "}
          {PAPEL_LABEL[f.autor_papel] ?? f.autor_papel}
          {f.contratante ? ` · ${f.contratante}` : ""}
          {feito && f.concluido_por ? (
            <span className="text-success-ink"> · concluído por {f.concluido_por}</span>
          ) : null}
        </p>
        {feito ? (
          <AcaoReabrir feedback={f} onMutate={onMutate} />
        ) : (
          <AcaoFeito feedback={f} onMutate={onMutate} />
        )}
      </div>
    </div>
  );
}

function AcaoFeito({ feedback: f, onMutate }: { feedback: Feedback; onMutate: () => void }) {
  const [enviando, setEnviando] = useState(false);
  async function marcar() {
    setEnviando(true);
    try {
      await apiSend("POST", `/api/feedbacks/${f.id}/feito`);
      toast.success("Feedback concluído.");
      onMutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível concluir.");
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Button size="sm" className="bg-success text-white hover:bg-success/90" onClick={marcar} disabled={enviando}>
      {enviando ? <Loader2 className="animate-spin" /> : <CircleCheckBig />}
      Marcar como feito
    </Button>
  );
}

function AcaoReabrir({ feedback: f, onMutate }: { feedback: Feedback; onMutate: () => void }) {
  const [enviando, setEnviando] = useState(false);
  async function reabrir() {
    setEnviando(true);
    try {
      await apiSend("POST", `/api/feedbacks/${f.id}/reabrir`);
      toast.success("Feedback reaberto.");
      onMutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível reabrir.");
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={reabrir} disabled={enviando}>
      {enviando ? <Loader2 className="animate-spin" /> : <Undo2 />}
      Reabrir
    </Button>
  );
}

function FeedbacksSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
