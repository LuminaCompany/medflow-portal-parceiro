"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Banknote,
  CalendarClock,
  ChevronRight,
  CircleCheckBig,
  FileText,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { BarraFiltros } from "@/components/filtros/BarraFiltros";
import { BadgeStatus } from "@/components/BadgeStatus";
import { DataTable, type Coluna } from "@/components/DataTable";
import { StatCard } from "@/components/portal/StatCard";
import { ErroCarregamento } from "@/components/portal/ErroCarregamento";
import { PagarUnidade } from "@/components/portal/ConfirmarPagamento";
import { SecaoVencimentos } from "@/components/portal/SecaoVencimentos";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useFiltros } from "@/lib/filtros/useFiltros";
import { formatData, formatMoeda } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import type {
  ContratanteVencimentos,
  MeusAvisos,
  PagamentoAviso,
  Solicitacao,
  UnidadeVencimentos,
  UnidadeVencimentosParceiro,
  VencimentosGestor,
  VencimentosParceiro,
} from "@/lib/types";

type Periodo = "2d" | "1sem" | "2sem";
const PERIODOS: { v: Periodo; label: string }[] = [
  { v: "2d", label: "Próximos 2 dias" },
  { v: "1sem", label: "Próxima semana" },
  { v: "2sem", label: "Próximas 2 semanas" },
];

function VencimentosView() {
  const { me } = useMe();
  const papel = me?.role === "gestor" ? "gestor" : "parceiro";
  const { queryString } = useFiltros("vencimentos");
  const [periodo, setPeriodo] = useState<Periodo>("1sem");
  const [parceiro, setParceiro] = useState<VencimentosParceiro | null>(null);
  const [gestor, setGestor] = useState<VencimentosGestor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    // Guarda contra corrida: troca rápida de período/filtro pode resolver fora de ordem;
    // só a última requisição efetiva o estado.
    let ativo = true;
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams(queryString);
    params.set("proximos", periodo);
    apiGet<VencimentosParceiro | VencimentosGestor>(`/api/vencimentos?${params}`)
      .then((data) => {
        if (!ativo) return;
        if ("atrasados" in data) {
          setParceiro(data);
          setGestor(null);
        } else {
          setGestor(data);
          setParceiro(null);
        }
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar vencimentos.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [periodo, queryString, tentativa]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <CalendarClock className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vencimentos</h1>
          <p className="mt-0.5 text-muted-foreground">
            Acompanhe pagamentos pendentes, atrasados e já realizados.
          </p>
        </div>
      </div>

      <BarraFiltros aba="vencimentos" papel={papel} />

      {carregando ? (
        <VencimentosSkeleton />
      ) : erro && !gestor && !parceiro ? (
        <ErroCarregamento onRetry={() => setTentativa((t) => t + 1)} mensagem={erro} />
      ) : gestor ? (
        <VistaGestor data={gestor} />
      ) : parceiro ? (
        <VistaParceiro data={parceiro} periodo={periodo} onPeriodo={setPeriodo} />
      ) : null}
    </div>
  );
}

function VistaParceiro({
  data,
  periodo,
  onPeriodo,
}: {
  data: VencimentosParceiro;
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
}) {
  // Defesa: payload pode chegar parcial (campos ausentes) — normaliza arrays.
  const unidades = data.unidades ?? [];
  const atrasados = data.atrasados ?? [];
  const proximos = data.proximos ?? [];
  const pagos = data.pagos ?? [];
  const temAtraso = atrasados.length > 0;

  // Estado dos avisos de pagamento por unidade (feature 004) — define o controle de cada linha.
  const [avisos, setAvisos] = useState<Record<string, PagamentoAviso>>({});
  const recarregarAvisos = useCallback(() => {
    apiGet<MeusAvisos>("/api/pagamentos/meus")
      .then((r) => setAvisos(r.avisos ?? {}))
      .catch(() => setAvisos({}));
  }, []);
  useEffect(() => {
    recarregarAvisos();
  }, [recarregarAvisos]);

  // Escala compartilhada: a maior pendência define 100% da barra (comparável entre unidades).
  const maxPendente = Math.max(
    ...unidades.map((u) => Number(u.total_pendente) || 0),
    1,
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Total Pendente" value={formatMoeda(data.cards.total_pendente)} icon={Wallet} tone="brand" />
        <StatCard
          index={1}
          label="Em Atraso"
          value={formatMoeda(data.cards.em_atraso)}
          icon={TriangleAlert}
          tone="danger"
          highlight={temAtraso}
        />
        <StatCard index={2} label="Próximos" value={String(proximos.length)} icon={CalendarClock} tone="brand" />
        <StatCard index={3} label="Pagos" value={String(pagos.length)} icon={CircleCheckBig} tone="success" />
      </div>

      <Secao
        titulo="Vencimentos por Unidade"
        descricao="Vencido (vermelho) e a vencer (roxo) por unidade. Abra para ver as solicitações."
      >
        {unidades.length > 0 ? (
          <Accordion type="multiple" className="flex flex-col gap-2">
            {unidades.map((u) => (
              <UnidadeLinhaParceiro
                key={u.unidade}
                u={u}
                maxPendente={maxPendente}
                aviso={avisos[u.unidade]}
                onMutate={recarregarAvisos}
              />
            ))}
          </Accordion>
        ) : (
          <EmptyVenc titulo="Nenhuma unidade" descricao="Sem dados de vencimento." />
        )}
      </Secao>

      {temAtraso ? (
        <Card className="gap-0 border-destructive/30 bg-destructive/[0.03] p-0 ring-destructive/15">
          <div className="flex items-center gap-3 border-b border-destructive/20 px-5 py-4">
            <span className="grid size-9 place-items-center rounded-xl bg-destructive/12 text-destructive ring-1 ring-destructive/20">
              <TriangleAlert className="size-[18px]" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-destructive">Vencimentos por atraso</h2>
              <p className="text-xs text-destructive/80">
                {new Set(atrasados.map((s) => s.data_vencimento)).size} data(s) vencida(s) — requer atenção
              </p>
            </div>
          </div>
          <div className="p-3">
            <SecaoVencimentos itens={atrasados} tone="danger" defaultOpenFirst />
          </div>
        </Card>
      ) : null}

      <Secao
        titulo="Próximos Vencimentos"
        descricao="Solicitações pendentes agrupadas por data de quitação."
        acao={
          <Select value={periodo} onValueChange={(v) => onPeriodo(v as Periodo)}>
            <SelectTrigger className="h-9" aria-label="Período dos próximos vencimentos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.v} value={p.v}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      >
        {proximos.length > 0 ? (
          <SecaoVencimentos itens={proximos} tone="brand" />
        ) : (
          <EmptyVenc titulo="Nenhum vencimento próximo" descricao="Nada vencendo no período selecionado." />
        )}
      </Secao>

      <Secao titulo="Vencimentos Pagos" descricao="Datas já confirmadas como pagas.">
        {pagos.length > 0 ? (
          <SecaoVencimentos itens={pagos} tone="success" />
        ) : (
          <EmptyVenc titulo="Nenhum pagamento ainda" descricao="Os vencimentos quitados aparecerão aqui." />
        )}
      </Secao>
    </>
  );
}

function VistaGestor({ data }: { data: VencimentosGestor }) {
  // Defesa: payload pode chegar parcial — normaliza array.
  const contratantes = data.contratantes ?? [];
  // Escala compartilhada: a maior pendência define 100% da barra (comparável entre parceiros).
  const maxPendente = Math.max(
    ...contratantes.map((c) => Number(c.total_pendente) || 0),
    1,
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <StatCard index={0} label="Solicitações a Pagar" value={String(data.cards.solicitacoes_a_pagar)} icon={FileText} tone="warning" />
        <StatCard index={1} label="Total a Receber" value={formatMoeda(data.cards.valor_total_a_receber)} icon={Banknote} tone="brand" />
      </div>

      <Secao
        titulo="Vencimentos por parceiro"
        descricao="Vencido (vermelho) e a vencer (roxo) por contratante. Abra para ver as unidades."
      >
        {contratantes.length > 0 ? (
          <Accordion type="multiple" className="flex flex-col gap-2">
            {contratantes.map((c) => (
              <ContratanteLinha key={c.contratante} c={c} maxPendente={maxPendente} />
            ))}
          </Accordion>
        ) : (
          <EmptyVenc titulo="Nenhuma contratante" descricao="Sem dados de vencimento." />
        )}
      </Secao>
    </>
  );
}

function ContratanteLinha({
  c,
  maxPendente,
}: {
  c: ContratanteVencimentos;
  maxPendente: number;
}) {
  return (
    <AccordionItem
      value={c.contratante}
      className="overflow-hidden rounded-xl border bg-card not-last:border-b"
    >
      {/* +50% de altura de linha (min-h ~60px) vs. ~40px anterior. */}
      <AccordionTrigger className="min-h-[3.75rem] items-center px-4 py-3 hover:no-underline data-[state=open]:bg-muted/40">
        <div className="flex flex-1 items-center gap-3">
          <span className="w-44 shrink-0 truncate text-sm font-medium">{c.contratante}</span>
          {c.tudo_pago ? (
            <>
              <div className="flex-1" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
                <CircleCheckBig className="size-3.5" />
                Tudo pago
              </span>
            </>
          ) : (
            <>
              <BarraSegmentada
                vencido={Number(c.vencido) || 0}
                aVencer={Number(c.a_vencer) || 0}
                max={maxPendente}
              />
              <span className="w-32 shrink-0 text-right text-sm font-semibold tabular-nums">
                {formatMoeda(c.total_pendente)}
              </span>
            </>
          )}
        </div>
      </AccordionTrigger>
      {/* Unidades como linhas simples (sem accordion aninhado — evita clip de altura). */}
      <AccordionContent className="bg-muted/20 px-3 pt-1 pb-3">
        <div className="flex flex-col gap-1.5">
          {(c.unidades ?? []).map((u) => (
            <UnidadeRow key={u.unidade} u={u} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// Linha de unidade na visão do parceiro: barra segmentada (igual gestor, nível unidade);
// expandir mostra a tabela de solicitações da unidade (todos os status).
function UnidadeLinhaParceiro({
  u,
  maxPendente,
  aviso,
  onMutate,
}: {
  u: UnidadeVencimentosParceiro;
  maxPendente: number;
  aviso?: PagamentoAviso;
  onMutate: () => void;
}) {
  return (
    <AccordionItem
      value={u.unidade}
      className="overflow-hidden rounded-xl border bg-card not-last:border-b"
    >
      {/* Trigger + controle "Pagar" como IRMÃOS (nunca <button> dentro de <button>).
          O wrapper faz o cabeçalho (1º filho) crescer e o controle ficar fixo à direita. */}
      <div className="flex items-center gap-2 pr-3 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1">
        <AccordionTrigger className="min-h-[3.75rem] items-center px-4 py-3 hover:no-underline data-[state=open]:bg-muted/40">
          <div className="flex flex-1 items-center gap-3">
            <span className="w-44 shrink-0 truncate text-sm font-medium">{u.unidade}</span>
            {u.tudo_pago ? (
              <>
                <div className="flex-1" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
                  <CircleCheckBig className="size-3.5" />
                  Tudo pago
                </span>
              </>
            ) : (
              <>
                <BarraSegmentada
                  vencido={Number(u.vencido) || 0}
                  aVencer={Number(u.a_vencer) || 0}
                  max={maxPendente}
                />
                <span className="w-32 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatMoeda(u.total_pendente)}
                </span>
              </>
            )}
          </div>
        </AccordionTrigger>
        <PagarUnidade unidade={u} aviso={aviso} onMutate={onMutate} />
      </div>
      <AccordionContent className="bg-muted/20 px-3 pt-1 pb-3">
        <DataTable colunas={colsSolicUnidade} itens={u.solicitacoes ?? []} getKey={(s) => s.codigo} />
      </AccordionContent>
    </AccordionItem>
  );
}

function BarraSegmentada({
  vencido,
  aVencer,
  max,
}: {
  vencido: number;
  aVencer: number;
  max: number;
}) {
  return (
    <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
      {vencido > 0 ? (
        <div
          className="h-full bg-destructive/75 transition-[width] duration-300"
          style={{ width: `${Math.max((vencido / max) * 100, 2)}%` }}
        />
      ) : null}
      {aVencer > 0 ? (
        <div
          className="h-full bg-primary/70 transition-[width] duration-300"
          style={{ width: `${Math.max((aVencer / max) * 100, 2)}%` }}
        />
      ) : null}
    </div>
  );
}

const colsSolicUnidade: Coluna<Solicitacao>[] = [
  {
    id: "codigo",
    header: "Código",
    cell: (s) => (
      <span className="font-mono text-xs font-medium text-foreground/80">{s.codigo}</span>
    ),
  },
  { id: "cliente", header: "Cliente", cell: (s) => s.cliente },
  { id: "valor", header: "Originação", align: "right", cell: (s) => formatMoeda(s.valor) },
  {
    id: "data_vencimento",
    header: "Vencimento",
    align: "right",
    cell: (s) => formatData(s.data_vencimento),
  },
  {
    id: "status",
    header: "Status",
    align: "right",
    cell: (s) => <BadgeStatus status={s.status} label={s.status_label} />,
  },
];

// Clicar na unidade abre uma janela grande com TODAS as solicitações (scrollável).
function UnidadeRow({ u }: { u: UnidadeVencimentos }) {
  const solicitacoes = u.solicitacoes ?? [];
  const n = solicitacoes.length;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="truncate text-sm font-medium">{u.unidade}</span>
          <BadgeStatus status={u.status} label={u.status_label} />
          <span className="ml-auto text-sm font-semibold tabular-nums">{formatMoeda(u.total)}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b p-4">
          <div className="flex items-center gap-3 pr-8">
            <DialogTitle className="truncate">{u.unidade}</DialogTitle>
            <BadgeStatus status={u.status} label={u.status_label} />
            <span className="ml-auto text-sm font-semibold tabular-nums">{formatMoeda(u.total)}</span>
          </div>
          <DialogDescription>
            {n} solicitaç{n === 1 ? "ão" : "ões"} — total de Originação da unidade.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DataTable colunas={colsSolicUnidade} itens={solicitacoes} getKey={(s) => s.codigo} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Secao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <CardHeader className="flex-row items-start justify-between gap-3 px-0">
        <div>
          <CardTitle className="font-display text-base font-bold">{titulo}</CardTitle>
          {descricao ? <CardDescription>{descricao}</CardDescription> : null}
        </div>
        {acao}
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

function EmptyVenc({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <Empty className="border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarClock />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        {descricao ? <EmptyDescription>{descricao}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}

function VencimentosSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

export default function VencimentosPage() {
  // useSearchParams (em useFiltros) exige fronteira de Suspense no app router.
  return (
    <Suspense fallback={<VencimentosSkeleton />}>
      <VencimentosView />
    </Suspense>
  );
}
