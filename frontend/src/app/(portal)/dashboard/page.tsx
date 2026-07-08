"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CircleCheckBig,
  FileText,
  Gift,
  Receipt,
  Stethoscope,
} from "lucide-react";

import { BarraFiltros } from "@/components/filtros/BarraFiltros";
import { StatCard } from "@/components/portal/StatCard";
import { ErroCarregamento } from "@/components/portal/ErroCarregamento";
import { SeletorTempoOverview } from "@/components/portal/SeletorTempoOverview";
import { INTERVALO_VAZIO, type Intervalo } from "@/components/ui/date-range-picker";
import { GraficoMensal } from "@/components/GraficoMensal";
import { GraficoRebate } from "@/components/GraficoRebate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useFiltros } from "@/lib/filtros/useFiltros";
import { formatMoeda } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import type { Overview } from "@/lib/types";

const TODOS_OS_MESES = Array.from({ length: 12 }, (_, i) => i + 1);

function DashboardView() {
  const { me } = useMe();
  const papel = me?.role === "gestor" ? "gestor" : "parceiro";
  const { queryString } = useFiltros("overview");
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [meses, setMeses] = useState<number[]>(TODOS_OS_MESES);
  const [intervalo, setIntervalo] = useState<Intervalo>(INTERVALO_VAZIO); // período de originação; substitui ano/meses
  const [data, setData] = useState<Overview | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const mesesKey = meses.join(",");
  // Recorte por mês = subconjunto de meses (não todos os 12). 12 selecionados = ano inteiro.
  const porMes = meses.length > 0 && meses.length < 12;
  const periodoAtivo = intervalo.de !== "";

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams(queryString); // status/unidade/contratante (chips)
    if (periodoAtivo) {
      // Período substitui ano/meses: envia só o intervalo de datas de originação.
      params.set("data_de", intervalo.de);
      params.set("data_ate", intervalo.ate || intervalo.de);
    } else {
      params.set("ano", String(ano));
      if (porMes) params.set("meses", mesesKey);
    }
    apiGet<Overview>(`/api/overview?${params}`)
      .then(setData)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar a visão geral."))
      .finally(() => setCarregando(false));
  }, [ano, porMes, mesesKey, periodoAtivo, intervalo.de, intervalo.ate, queryString]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Se o ano corrente não tiver dados, cai no ano mais recente disponível.
  useEffect(() => {
    if (data && data.anos_disponiveis.length > 0 && !data.anos_disponiveis.includes(ano)) {
      setAno(data.anos_disponiveis[0]);
    }
  }, [data, ano]);

  const primeiroNome = me?.nome_exibicao?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="flex flex-col gap-7">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Olá{primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">Resumo da sua operação de antecipação.</p>
        </div>
      </div>

      {/* Recorte temporal (RF-019): meses sempre visíveis; todos = ano inteiro, subconjunto = por mês */}
      <SeletorTempoOverview
        papel={papel}
        ano={ano}
        anosDisponiveis={data?.anos_disponiveis ?? []}
        meses={meses}
        intervalo={intervalo}
        onAno={setAno}
        onMeses={setMeses}
        onIntervalo={setIntervalo}
      />

      {/* Barra de filtros (chips) — impacta cards e gráfico (RF-F08) */}
      <BarraFiltros aba="overview" papel={papel} />

      {erro && !data ? (
        <ErroCarregamento onRetry={carregar} mensagem={erro} />
      ) : carregando || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard
              index={0}
              label="Total de Solicitações"
              value={String(data.cards.total_solicitacoes)}
              icon={FileText}
              tone="brand"
            />
            <StatCard
              index={1}
              label="Originação Total"
              value={formatMoeda(data.cards.valor_total)}
              icon={Banknote}
              tone="brand"
            />
            <StatCard
              index={2}
              label="Total de Rebate"
              value={formatMoeda(data.cards.total_cashback)}
              icon={Gift}
              tone="success"
            />
            <StatCard
              index={3}
              label="Em Aberto / Pagas"
              value={`${data.cards.em_aberto} / ${data.cards.pagas}`}
              icon={CircleCheckBig}
              tone="warning"
            />
            <StatCard
              index={4}
              label="Médicos Impactados"
              value={String(data.cards.medicos_impactados)}
              icon={Stethoscope}
              tone="brand"
            />
          </div>

          {/* Solicitações mensais + ticket médio (acompanham este card) */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <CardHeader className="px-0">
                <CardTitle className="font-display text-lg font-bold">Solicitações Mensais</CardTitle>
                <CardDescription>Soma da originação por mês.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {data.serie_mensal.length > 0 ? (
                  <GraficoMensal serie={data.serie_mensal} />
                ) : (
                  <Empty className="h-[300px]">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CalendarClock />
                      </EmptyMedia>
                      <EmptyTitle>Sem histórico ainda</EmptyTitle>
                      <EmptyDescription>
                        Quando houver solicitações, a evolução mensal aparece aqui.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <TicketMedio data={data} />
              <Link
                href="/vencimentos"
                className="group flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:ring-primary/25"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <CalendarClock className="size-[18px]" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">Próximos Vencimentos</span>
                  <span className="block text-xs text-muted-foreground">Acompanhe pagamentos pendentes</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Rebate mensal (verde) — abaixo das solicitações, mesmo tamanho (col-span-2) */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <CardHeader className="px-0">
                <CardTitle className="font-display text-lg font-bold">Rebate Mensal</CardTitle>
                <CardDescription>Soma do rebate por mês.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {data.serie_mensal.length > 0 ? (
                  <GraficoRebate serie={data.serie_mensal} />
                ) : (
                  <Empty className="h-[300px]">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Gift />
                      </EmptyMedia>
                      <EmptyTitle>Sem histórico ainda</EmptyTitle>
                      <EmptyDescription>
                        Quando houver rebate, a evolução mensal aparece aqui.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function TicketMedio({ data }: { data: Overview }) {
  return (
    <Card className="p-5">
      <CardHeader className="px-0">
        <CardTitle className="font-display text-lg font-bold">Ticket Médio</CardTitle>
        <CardDescription>Média da originação por solicitação no recorte.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        <div className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Receipt className="size-[18px]" />
          </span>
          <span className="font-display text-2xl font-bold tabular-nums">
            {formatMoeda(data.cards.ticket_medio)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {data.cards.total_solicitacoes} solicitação(ões) ·{" "}
          <span className="tabular-nums">{formatMoeda(data.cards.valor_total)}</span> originados
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[380px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // useSearchParams (em useFiltros) exige fronteira de Suspense no app router.
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardView />
    </Suspense>
  );
}
