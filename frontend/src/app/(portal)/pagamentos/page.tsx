"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleCheckBig,
  Clock,
  HandCoins,
  Loader2,
  ShieldQuestion,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { StatCard } from "@/components/portal/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import { formatData, formatMoeda } from "@/lib/format";
import type {
  ContratantePagamentos,
  PagamentoAviso,
  PagamentosGestor,
  UnidadeFaltaAviso,
} from "@/lib/types";

export default function PagamentosPage() {
  const [data, setData] = useState<PagamentosGestor | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(() => {
    setCarregando(true);
    apiGet<PagamentosGestor>("/api/pagamentos")
      .then(setData)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Falha ao carregar pagamentos."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const contratantes = data?.contratantes ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <HandCoins className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pagamentos</h1>
          <p className="mt-0.5 text-muted-foreground">
            Avisos de pagamento enviados pelos parceiros. Verifique e atualize o status na planilha.
          </p>
        </div>
      </div>

      {carregando ? (
        <PagamentosSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard index={0} label="Aguardando verificação" value={String(data?.cards.aguardando ?? 0)} icon={Clock} tone="warning" highlight={(data?.cards.aguardando ?? 0) > 0} />
            <StatCard index={1} label="Verificadas" value={String(data?.cards.verificadas ?? 0)} icon={CircleCheckBig} tone="success" />
            <StatCard index={2} label="Falta aviso" value={String(data?.cards.falta_aviso ?? 0)} icon={ShieldQuestion} tone="brand" />
          </div>

          {contratantes.length > 0 ? (
            <div className="flex flex-col gap-5">
              {contratantes.map((c) => (
                <SecaoContratante key={c.contratante} c={c} onMutate={recarregar} />
              ))}
            </div>
          ) : (
            <Empty className="border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HandCoins />
                </EmptyMedia>
                <EmptyTitle>Nenhum pagamento por aqui</EmptyTitle>
                <EmptyDescription>
                  Quando os parceiros enviarem avisos de pagamento, eles aparecerão aqui.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </>
      )}
    </div>
  );
}

function SecaoContratante({ c, onMutate }: { c: ContratantePagamentos; onMutate: () => void }) {
  const aguardando = c.aguardando ?? [];
  const verificadas = c.verificadas ?? [];
  const falta = c.falta_aviso ?? [];
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="flex-row items-center gap-3 border-b bg-muted/30 px-5 py-4">
        <span
          className="size-4 shrink-0 rounded-full ring-1 ring-border"
          style={{ background: c.cor ?? "#94a3b8" }}
        />
        <CardTitle className="font-display text-lg font-bold">{c.contratante || "—"}</CardTitle>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {aguardando.length > 0 ? (
            <Badge className="bg-warning/15 text-warning">
              <Clock className="size-3" />
              {aguardando.length} aguardando
            </Badge>
          ) : null}
          {verificadas.length > 0 ? (
            <Badge className="bg-success/15 text-success">
              <CircleCheckBig className="size-3" />
              {verificadas.length} verificada{verificadas.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
          {falta.length > 0 ? (
            <Badge variant="outline">
              <ShieldQuestion className="size-3" />
              {falta.length} sem aviso
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 p-5">
        {aguardando.length > 0 ? (
          <Bloco titulo="Aguardando verificação" tom="warning">
            <div className="grid gap-3 md:grid-cols-2">
              {aguardando.map((a) => (
                <AvisoCard key={a.id} aviso={a} onMutate={onMutate} />
              ))}
            </div>
          </Bloco>
        ) : null}

        {verificadas.length > 0 ? (
          <Bloco titulo="Verificadas" tom="success">
            <div className="grid gap-3 md:grid-cols-2">
              {verificadas.map((a) => (
                <AvisoCard key={a.id} aviso={a} onMutate={onMutate} />
              ))}
            </div>
          </Bloco>
        ) : null}

        {falta.length > 0 ? (
          <Bloco titulo="Falta aviso" tom="neutro">
            <div className="flex flex-col gap-2">
              {falta.map((u) => (
                <FaltaRow key={u.unidade} u={u} />
              ))}
            </div>
          </Bloco>
        ) : null}
      </CardContent>
    </Card>
  );
}

const TOM_TITULO: Record<string, string> = {
  warning: "text-warning",
  success: "text-success",
  neutro: "text-muted-foreground",
};

function Bloco({
  titulo,
  tom,
  children,
}: {
  titulo: string;
  tom: keyof typeof TOM_TITULO;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className={`text-xs font-bold tracking-wide uppercase ${TOM_TITULO[tom]}`}>{titulo}</h3>
      {children}
    </section>
  );
}

function AvisoCard({ aviso, onMutate }: { aviso: PagamentoAviso; onMutate: () => void }) {
  const verificado = aviso.status === "verificado";
  const codigos = aviso.solicitacao_codigos ?? [];
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{aviso.unidade}</p>
          <p className="text-xs text-muted-foreground">
            Enviado em {formatData(aviso.created_at?.slice(0, 10))}
            {verificado && aviso.verificado_at
              ? ` · verificado em ${formatData(aviso.verificado_at.slice(0, 10))}`
              : ""}
          </p>
        </div>
        <span className="shrink-0 text-right font-display text-xl font-bold tabular-nums text-primary">
          {formatMoeda(aviso.valor)}
        </span>
      </div>

      {codigos.length > 0 ? (
        <Accordion type="single" collapsible>
          <AccordionItem value="codigos" className="border-0">
            <AccordionTrigger className="py-1.5 text-xs font-medium text-muted-foreground hover:no-underline">
              {codigos.length} solicitaç{codigos.length === 1 ? "ão" : "ões"} coberta
              {codigos.length === 1 ? "" : "s"}
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <div className="flex flex-wrap gap-1.5 pt-1">
                {codigos.map((cod) => (
                  <span
                    key={cod}
                    className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80"
                  >
                    {cod}
                  </span>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      {verificado ? (
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
            <CircleCheckBig className="size-4" />
            Verificado
          </span>
          <AcaoReabrir aviso={aviso} onMutate={onMutate} />
        </div>
      ) : (
        <div className="flex gap-2">
          <AcaoVerificar aviso={aviso} onMutate={onMutate} />
          <AcaoRejeitar aviso={aviso} onMutate={onMutate} />
        </div>
      )}
    </div>
  );
}

function AcaoVerificar({ aviso, onMutate }: { aviso: PagamentoAviso; onMutate: () => void }) {
  const [enviando, setEnviando] = useState(false);
  async function verificar() {
    setEnviando(true);
    try {
      await apiSend("POST", `/api/pagamentos/avisos/${aviso.id}/verificar`);
      toast.success("Pagamento verificado.");
      onMutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível verificar.");
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Button size="sm" className="flex-1 bg-success text-white hover:bg-success/90" onClick={verificar} disabled={enviando}>
      {enviando ? <Loader2 className="animate-spin" /> : <CircleCheckBig />}
      Verificar pagamento
    </Button>
  );
}

function AcaoRejeitar({ aviso, onMutate }: { aviso: PagamentoAviso; onMutate: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function rejeitar() {
    setEnviando(true);
    try {
      await apiSend("POST", `/api/pagamentos/avisos/${aviso.id}/rejeitar`, { motivo });
      toast.success("Aviso rejeitado.");
      setAberto(false);
      setMotivo("");
      onMutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível rejeitar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setAberto(true)}>
        <TriangleAlert />
        Rejeitar
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => !enviando && setAberto(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">Rejeitar aviso</DialogTitle>
            <DialogDescription>
              {aviso.unidade} · {formatMoeda(aviso.valor)}. Informe o motivo — o parceiro verá e poderá
              enviar um novo aviso.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Ex: pagamento não localizado no extrato"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && motivo.trim()) rejeitar();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={rejeitar} disabled={enviando || !motivo.trim()}>
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Rejeitar aviso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AcaoReabrir({ aviso, onMutate }: { aviso: PagamentoAviso; onMutate: () => void }) {
  const [enviando, setEnviando] = useState(false);
  async function reabrir() {
    setEnviando(true);
    try {
      await apiSend("POST", `/api/pagamentos/avisos/${aviso.id}/reabrir`);
      toast.success("Verificação desfeita.");
      onMutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível desfazer.");
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={reabrir} disabled={enviando}>
      {enviando ? <Loader2 className="animate-spin" /> : <Undo2 />}
      Desfazer
    </Button>
  );
}

function FaltaRow({ u }: { u: UnidadeFaltaAviso }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-3 py-2.5">
      <ShieldQuestion className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{u.unidade}</p>
        {u.motivo_rejeicao ? (
          <p className="truncate text-xs text-destructive" title={u.motivo_rejeicao}>
            Aviso anterior rejeitado: {u.motivo_rejeicao}
          </p>
        ) : null}
      </div>
      <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
        {formatMoeda(u.valor)}
      </span>
    </div>
  );
}

function PagamentosSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
