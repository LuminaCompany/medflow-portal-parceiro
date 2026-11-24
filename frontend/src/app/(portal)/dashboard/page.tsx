"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CircleCheckBig,
  FileText,
  Gift,
  Receipt,
  Stethoscope,
} from "lucide-react";

import { BarraFiltros } from "@/components/filtros/BarraFiltros";
import { PageHeader } from "@/components/portal/PageHeader";
import { Segmentado } from "@/components/portal/Segmentado";
import { StatCard } from "@/components/portal/StatCard";
import { ErroCarregamento } from "@/components/portal/ErroCarregamento";
import { SeletorTempoOverview } from "@/components/portal/SeletorTempoOverview";
import { INTERVALO_VAZIO, type Intervalo } from "@/components/ui/date-range-picker";
import { GraficoMensal } from "@/components/GraficoMensal";
import { GraficoRebate } from "@/components/GraficoRebate";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useFiltros } from "@/lib/filtros/useFiltros";
import { formatMoeda } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import type { Overview } from "@/lib/types";

const TODOS_OS_MESES = Array.from({ length: 12 }, (_, i) => i + 1);

// Base do gráfico "Rebate Mensal": mês em que a solicitação foi originada (visão comercial)
// ou mês em que ela vence (visão de caixa — é por vencimento que o lote é pago).
type BaseRebate = "originacao" | "vencimento";

const BASES_REBATE: { id: BaseRebate; label: string }[] = [
  { id: "originacao", label: "Originação" },
  { id: "vencimento", label: "Vencimento" },
];

function DashboardView() {
  const { me } = useMe();
  const papel = me?.role === "gestor" ? "gestor" : "parceiro";
  const { queryString } = useFiltros("overview");
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [meses, setMeses] = useState<number[]>(TODOS_OS_MESES);
  const [intervalo, setIntervalo] = useState<Intervalo>(INTERVALO_VAZIO); // período de originação; substitui ano/meses
  const [baseRebate, setBaseRebate] = useState<BaseRebate>("originacao");
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

  // Base do gráfico de rebate: por vencimento, o recorte temporal também passa a valer sobre a
  // data de vencimento (o backend manda a série pronta). `?? []` cobre backend antigo no deploy.
  const porVencimento = baseRebate === "vencimento";
  const serieRebate = (porVencimento ? data?.serie_rebate_vencimento : data?.serie_mensal) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Visão geral"
        titulo={`Olá${primeiroNome ? `, ${primeiroNome}` : ""}`}
        descricao="Resumo da sua operação de antecipação."
      />

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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
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
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="p-7 max-sm:p-5 lg:col-span-2">
              <CardHeader className="px-0">
                <CardTitle className="block-title">Solicitações Mensais</CardTitle>
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

            <div className="flex flex-col gap-5">
              <TicketMedio data={data} />
              <Link
                href="/vencimentos"
                className="surface-card group flex items-center gap-4 p-6 transition-[box-shadow,transform] duration-200 ease-[ease] hover:-translate-y-0.5 hover:shadow-hover"
              >
                <span className="icon-tile">
                  <CalendarClock />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] leading-tight font-semibold text-primary">
                    Próximos Vencimentos
                  </span>
                  <span className="mt-1 block text-[13px] text-muted-foreground">
                    Acompanhe pagamentos pendentes
                  </span>
                </span>
                <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent text-primary transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-foreground">
                  <ArrowUpRight className="size-4" strokeWidth={2.2} />
                </span>
              </Link>
            </div>
          </div>

          {/* Rebate mensal (roxo-escuro) — abaixo das solicitações, mesmo tamanho (col-span-2).
              O toggle troca a régua do gráfico (agrupamento E recorte): originado no mês
              (`serie_mensal`) ou vencendo no mês (`serie_rebate_vencimento`). */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="p-7 max-sm:p-5 lg:col-span-2">
              <CardHeader className="px-0">
                <CardTitle className="block-title">Rebate Mensal</CardTitle>
                <CardDescription>
                  {porVencimento
                    ? "Soma do rebate por mês de vencimento."
                    : "Soma do rebate por mês de originação."}
                </CardDescription>
                <CardAction>
                  <ToggleBaseRebate base={baseRebate} onBase={setBaseRebate} />
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                {serieRebate.length > 0 ? (
                  <GraficoRebate serie={serieRebate} />
                ) : (
                  <Empty className="h-[300px]">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Gift />
                      </EmptyMedia>
                      <EmptyTitle>Sem histórico ainda</EmptyTitle>
                      <EmptyDescription>
                        {porVencimento
                          ? "Quando houver rebate vencendo no recorte, a evolução aparece aqui."
                          : "Quando houver rebate, a evolução mensal aparece aqui."}
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

function ToggleBaseRebate({
  base,
  onBase,
}: {
  base: BaseRebate;
  onBase: (base: BaseRebate) => void;
}) {
  return (
    <Segmentado
      tamanho="sm"
      ariaLabel="Base do gráfico de rebate"
      valor={base}
      onChange={(v) => onBase(v as BaseRebate)}
      opcoes={BASES_REBATE.map(({ id, label }) => ({ v: id, label }))}
    />
  );
}

function TicketMedio({ data }: { data: Overview }) {
  return (
    <Card className="p-7 max-sm:p-5">
      <CardHeader className="px-0">
        <CardTitle className="block-title">Ticket Médio</CardTitle>
        <CardDescription>Média da originação por solicitação no recorte.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex items-center gap-3.5">
          <span className="icon-tile">
            <Receipt />
          </span>
          <span className="text-[28px] leading-none font-semibold tracking-[-0.03em] text-strong tabular-nums">
            {formatMoeda(data.cards.ticket_medio)}
          </span>
        </div>
        <div className="border-t pt-3 text-[13px] text-muted-foreground">
          {data.cards.total_solicitacoes} solicitação(ões) ·{" "}
          <span className="tabular-nums">{formatMoeda(data.cards.valor_total)}</span> originados
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[148px] rounded-card" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-[400px] rounded-card lg:col-span-2" />
        <Skeleton className="h-[400px] rounded-card" />
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
