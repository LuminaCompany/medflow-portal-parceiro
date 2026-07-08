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
import { BadgePrazo } from "@/components/portal/BadgePrazo";
import { ErroCarregamento } from "@/components/portal/ErroCarregamento";
import { PagarUnidade } from "@/components/portal/ConfirmarPagamento";
import { ExportarLote } from "@/components/portal/ExportarLote";
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
  StatusKey,
  UnidadeVencimentos,
  UnidadeVencimentosParceiro,
  VencimentosGestor,
  VencimentosParceiro,
} from "@/lib/types";

function VencimentosView() {
  const { me } = useMe();
  const papel = me?.role === "gestor" ? "gestor" : "parceiro";
  const { queryString } = useFiltros("vencimentos");
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
  }, [queryString, tentativa]);

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
        <VistaParceiro data={parceiro} rebateAtivo={!!me?.rebate_ativo} />
      ) : null}
    </div>
  );
}

function VistaParceiro({
  data,
  rebateAtivo,
}: {
  data: VencimentosParceiro;
  rebateAtivo: boolean;
}) {
  // Defesa: payload pode chegar parcial (campos ausentes) — normaliza arrays.
  // Vencimentos = só lotes com pendência (a vencer + vencidos); "Tudo pago" vive na seção Pagos.
  const unidades = (data.unidades ?? []).filter((u) => !u.tudo_pago);
  const pagos = data.pagos ?? [];
  const temAtraso = (data.cards?.n_atrasadas ?? 0) > 0;

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
        <StatCard index={2} label="A Vencer" value={String(data.cards.n_a_pagar)} icon={CalendarClock} tone="brand" />
        <StatCard index={3} label="Pagos" value={String(pagos.length)} icon={CircleCheckBig} tone="success" />
      </div>

      <Secao
        titulo="Vencimentos"
        descricao="A vencer e vencidos, ordenados por data (vencido há mais tempo no topo). Cada linha é um lote (unidade + data de vencimento), pago em separado. Prazo em vermelho quando vencido. Abra para ver as solicitações."
      >
        {unidades.length > 0 ? (
          <Accordion type="multiple" className="flex flex-col gap-2">
            {unidades.map((u) => {
              const chave = chaveLote(u.unidade, u.data_vencimento);
              return (
                <UnidadeLinhaParceiro
                  key={chave}
                  chave={chave}
                  u={u}
                  aviso={avisos[chave]}
                  rebateAtivo={rebateAtivo}
                  onMutate={recarregarAvisos}
                />
              );
            })}
          </Accordion>
        ) : (
          <EmptyVenc titulo="Nenhum vencimento" descricao="Sem dados de vencimento." />
        )}
      </Secao>

      <Secao titulo="Pagos" descricao="Todos os vencimentos já confirmados como pagos.">
        {pagos.length > 0 ? (
          <SecaoVencimentos itens={pagos} tone="success" />
        ) : (
          <EmptyVenc titulo="Nenhum pagamento ainda" descricao="Os vencimentos quitados aparecerão aqui." />
        )}
      </Secao>
    </>
  );
}

type AgruparGestor = "unidade" | "vencimento";

function VistaGestor({ data }: { data: VencimentosGestor }) {
  // Defesa: payload pode chegar parcial — normaliza array.
  const contratantes = data.contratantes ?? [];
  // Toggle de visualização: abrir a contratante por unidade (agregada) ou por lote/vencimento.
  const [agrupar, setAgrupar] = useState<AgruparGestor>("unidade");
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <StatCard index={0} label="Solicitações a Pagar" value={String(data.cards.solicitacoes_a_pagar)} icon={FileText} tone="warning" />
        <StatCard index={1} label="Total a Receber" value={formatMoeda(data.cards.valor_total_a_receber)} icon={Banknote} tone="brand" />
      </div>

      <Secao
        titulo="Vencimentos"
        descricao="Status (Vencido / A Vencer) por contratante. Abra para ver as unidades ou os vencimentos."
        acao={
          <Select value={agrupar} onValueChange={(v) => setAgrupar(v as AgruparGestor)}>
            <SelectTrigger className="h-9 w-[190px]" aria-label="Agrupar contratante por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="unidade">Agrupar por unidade</SelectItem>
                <SelectItem value="vencimento">Agrupar por vencimento</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      >
        {contratantes.length > 0 ? (
          <Accordion type="multiple" className="flex flex-col gap-2">
            {contratantes.map((c) => (
              <ContratanteLinha key={c.contratante} c={c} agrupar={agrupar} />
            ))}
          </Accordion>
        ) : (
          <EmptyVenc titulo="Nenhuma contratante" descricao="Sem dados de vencimento." />
        )}
      </Secao>
    </>
  );
}

// Chave do lote (unidade + data ISO) — espelha `chave_lote` do backend (mapa de avisos).
function chaveLote(unidade: string, data: string | null): string {
  return `${unidade}|${data ?? ""}`;
}

interface LoteGestor {
  unidade: string;
  data: string;
  total: number;
  sols: Solicitacao[];
}

// Regroup client-side: contratante → lotes (unidade + data de vencimento) pendentes. Usa as
// solicitações já enviadas por unidade (cada uma traz data_vencimento); pagas ficam de fora.
function lotesDoContratante(c: ContratanteVencimentos): LoteGestor[] {
  const map = new Map<string, LoteGestor>();
  for (const u of c.unidades ?? []) {
    for (const s of u.solicitacoes ?? []) {
      if (s.status === "pago") continue;
      const key = chaveLote(u.unidade, s.data_vencimento);
      const e = map.get(key) ?? { unidade: u.unidade, data: s.data_vencimento, total: 0, sols: [] };
      e.total += Number(s.valor || 0);
      e.sols.push(s);
      map.set(key, e);
    }
  }
  return [...map.values()].sort((a, b) =>
    a.unidade !== b.unidade ? a.unidade.localeCompare(b.unidade) : a.data < b.data ? -1 : 1,
  );
}

function ContratanteLinha({
  c,
  agrupar,
}: {
  c: ContratanteVencimentos;
  agrupar: AgruparGestor;
}) {
  return (
    <AccordionItem
      value={c.contratante}
      className="overflow-hidden rounded-xl border bg-card not-last:border-b"
    >
      {/* +50% de altura de linha (min-h ~60px) vs. ~40px anterior. */}
      <AccordionTrigger className="min-h-[3.75rem] items-center px-4 py-3 hover:no-underline data-[state=open]:bg-muted/40">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <span className="min-w-0 truncate text-sm font-medium">{c.contratante}</span>
          {c.tudo_pago ? (
            <>
              <div className="flex-1" />
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success-ink">
                <CircleCheckBig className="size-3.5" />
                Tudo pago
              </span>
            </>
          ) : (
            <>
              {/* Status do contratante — escondido no mobile pra caber a linha (evita corte). */}
              <span className="hidden shrink-0 sm:inline-flex">
                <StatusLote vencido={Number(c.vencido) || 0} aVencer={Number(c.a_vencer) || 0} />
              </span>
              <div className="flex-1" />
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                {formatMoeda(c.total_pendente)}
              </span>
            </>
          )}
        </div>
      </AccordionTrigger>
      {/* Linhas simples (sem accordion aninhado — evita clip de altura): unidades ou lotes. */}
      <AccordionContent className="bg-muted/20 px-3 pt-1 pb-3">
        <div className="flex flex-col gap-1.5">
          {agrupar === "vencimento"
            ? lotesDoContratante(c).map((l) => (
                <LoteRow key={chaveLote(l.unidade, l.data)} lote={l} contratante={c.contratante} />
              ))
            : (c.unidades ?? []).map((u) => (
                <UnidadeRow key={u.unidade} u={u} contratante={c.contratante} />
              ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// Linha de unidade na visão do parceiro: status do lote (Vencido / A Vencer, nível unidade);
// expandir mostra a tabela de solicitações da unidade (todos os status).
function UnidadeLinhaParceiro({
  chave,
  u,
  aviso,
  rebateAtivo,
  onMutate,
}: {
  chave: string;
  u: UnidadeVencimentosParceiro;
  aviso?: PagamentoAviso;
  rebateAtivo: boolean;
  onMutate: () => void;
}) {
  return (
    <AccordionItem
      value={chave}
      className="overflow-hidden rounded-xl border bg-card not-last:border-b"
    >
      {/* Exportar + Trigger + controle "Pagar" como IRMÃOS (nunca <button> dentro de <button>).
          "Exportar" fica à ESQUERDA da barra; no desktop (sm+) ficam lado a lado, com o
          cabeçalho crescendo e o "Pagar" à direita. No mobile o "Pagar" cai numa faixa própria
          e nunca é empurrado pra fora da tela (era a causa de "a janela de pagar não abre em
          telas pequenas"). */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 sm:pr-3">
        {/* O AccordionTrigger vira um <header flex> que NÃO cresce sozinho — o seletor de
            último filho faz o header preencher a barra p/ o spacer empurrar o valor à direita. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-3 sm:pl-4 [&>*:last-child]:min-w-0 [&>*:last-child]:flex-1">
          {/* Exportar SÓ deste lote (unidade + vencimento) — modelo da planilha-mestre. */}
          <ExportarLote unidade={u.unidade} dataVencimento={u.data_vencimento} />
          <AccordionTrigger className="min-h-[3.75rem] flex-1 items-center px-2 py-3 hover:no-underline data-[state=open]:bg-muted/40">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <span className="min-w-0 truncate text-sm font-medium">{u.unidade}</span>
            {u.tudo_pago ? (
              <>
                <div className="flex-1" />
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success-ink">
                  <CircleCheckBig className="size-3.5" />
                  Tudo pago
                </span>
              </>
            ) : (
              <>
                {/* Prazo do lote em destaque (vermelho se vencido). */}
                <BadgePrazo data={u.data_vencimento} />
                {/* Status do lote — escondido no mobile (o BadgePrazo já sinaliza atraso) pra caber. */}
                <span className="hidden shrink-0 sm:inline-flex">
                  <StatusLote vencido={Number(u.vencido) || 0} aVencer={Number(u.a_vencer) || 0} />
                </span>
                <div className="flex-1" />
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatMoeda(u.total_pendente)}
                </span>
              </>
            )}
          </div>
        </AccordionTrigger>
        </div>
        {/* empty:hidden → some a faixa quando não há controle (unidade toda paga sem aviso). */}
        <div className="border-t bg-muted/10 px-4 py-2 empty:hidden sm:border-0 sm:bg-transparent sm:p-0">
          <PagarUnidade unidade={u} aviso={aviso} rebateAtivo={rebateAtivo} onMutate={onMutate} />
        </div>
      </div>
      <AccordionContent className="bg-muted/20 px-3 pt-1 pb-3">
        <DataTable colunas={colsSolicUnidade} itens={u.solicitacoes ?? []} getKey={(s) => s.codigo} />
      </AccordionContent>
    </AccordionItem>
  );
}

// Status de um lote/contratante pendente: "Vencido" se há parcela vencida, senão "A Vencer".
// Substitui a antiga barra segmentada — reaproveita os rótulos/cores do BadgeStatus.
function StatusLote({ vencido, aVencer: _aVencer }: { vencido: number; aVencer: number }) {
  const status: StatusKey = vencido > 0 ? "atrasado" : "a_pagar";
  return <BadgeStatus status={status} />;
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
    id: "cashback",
    header: "Rebate",
    align: "right",
    cell: (s) => <span className="text-success">{formatMoeda(s.cashback)}</span>,
  },
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
    cell: (s) => <BadgeStatus status={s.status} />,
  },
];

// Clicar na unidade abre uma janela grande com TODAS as solicitações (scrollável).
// "Exportar" (à esquerda) é IRMÃO do gatilho do diálogo — exporta a unidade inteira.
function UnidadeRow({ u, contratante }: { u: UnidadeVencimentos; contratante: string }) {
  const solicitacoes = u.solicitacoes ?? [];
  const n = solicitacoes.length;
  return (
    <div className="flex items-center gap-2">
      <ExportarLote unidade={u.unidade} contratante={contratante} />
      <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full flex-1 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="truncate text-sm font-medium">{u.unidade}</span>
          <BadgeStatus status={u.status} />
          <span className="ml-auto text-sm font-semibold tabular-nums">{formatMoeda(u.total)}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b p-4">
          <div className="flex items-center gap-3 pr-8">
            <DialogTitle className="truncate">{u.unidade}</DialogTitle>
            <BadgeStatus status={u.status} />
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
    </div>
  );
}

// Lote (unidade + vencimento) na visão do gestor: prazo + valor; abre janela com as solicitações.
// "Exportar" (à esquerda) é IRMÃO do gatilho do diálogo — exporta só este lote.
function LoteRow({ lote, contratante }: { lote: LoteGestor; contratante: string }) {
  const n = lote.sols.length;
  return (
    <div className="flex items-center gap-2">
      <ExportarLote unidade={lote.unidade} dataVencimento={lote.data} contratante={contratante} />
      <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full flex-1 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="truncate text-sm font-medium">{lote.unidade}</span>
          <BadgePrazo data={lote.data} />
          <span className="ml-auto text-sm font-semibold tabular-nums">
            {formatMoeda(String(lote.total))}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b p-4">
          <div className="flex flex-wrap items-center gap-3 pr-8">
            <DialogTitle className="truncate">{lote.unidade}</DialogTitle>
            <BadgePrazo data={lote.data} />
            <span className="ml-auto text-sm font-semibold tabular-nums">
              {formatMoeda(String(lote.total))}
            </span>
          </div>
          <DialogDescription>
            {n} solicitaç{n === 1 ? "ão" : "ões"} a vencer em {formatData(lote.data)}.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DataTable colunas={colsSolicUnidade} itens={lote.sols} getKey={(s) => s.codigo} />
        </div>
      </DialogContent>
      </Dialog>
    </div>
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
    <Card className="p-4 sm:p-5">
      <CardHeader className="flex-row items-start justify-between gap-3 px-0">
        <div>
          <CardTitle role="heading" aria-level={2} className="font-display text-base font-bold">
            {titulo}
          </CardTitle>
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
