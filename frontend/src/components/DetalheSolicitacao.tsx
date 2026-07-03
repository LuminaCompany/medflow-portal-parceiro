import { Stethoscope } from "lucide-react";

import { BadgeStatus } from "./BadgeStatus";
import { Separator } from "@/components/ui/separator";
import { formatData, formatMoeda, formatPercent } from "@/lib/format";
import type { ResumoMedico, SolicitacaoDetalhe } from "@/lib/types";

// Conteúdo do painel lateral: resumo do médico (hero) + solicitação clicada + PII (D5).
export function DetalheSolicitacao({ detalhe }: { detalhe: SolicitacaoDetalhe }) {
  const { solicitacao: s, medico: m, resumo_medico: r } = detalhe;
  return (
    <div className="flex flex-col gap-6">
      {/* Hero: visão geral do médico (agregado de todas as suas solicitações no escopo) */}
      <HeroMedico nome={m.nome} resumo={r} />

      {/* Chip da solicitação aberta — o restante do painel detalha esta linha. */}
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground/80 ring-1 ring-border/60">
          {s.codigo}
        </span>
        <BadgeStatus status={s.status} />
      </div>

      <Secao titulo="Financeiro">
        <Linha k="Originação" v={formatMoeda(s.valor)} />
        <Linha k="Recebido pelo cliente" v={formatMoeda(s.recebido_cliente)} />
        <Linha k="IOF" v={formatMoeda(s.iof)} />
        <Linha k="Juros e descontos" v={formatMoeda(s.juros_descontos)} />
        <Linha k="Taxa de juros (mês)" v={formatPercent(s.taxa_juros_mes)} />
        {/* Margens da MedFlow: só chegam na visão do gestor (backend faz strip p/ parceiro). */}
        {s.lucro_operacional != null && (
          <Linha k="Lucro operacional" v={formatMoeda(s.lucro_operacional)} />
        )}
        {s.agio_base != null && <Linha k="ÁGIO base" v={formatMoeda(s.agio_base)} />}
        <Linha k="Rebate" v={formatMoeda(s.cashback)} destaque />
      </Secao>

      <Secao titulo="Datas & unidade">
        <Linha k="Data do pedido" v={formatData(s.data_pedido)} />
        <Linha k="Vencimento" v={formatData(s.data_vencimento)} />
        <Linha k="Prazo" v={s.prazo_dias != null ? `${s.prazo_dias} dias` : "—"} />
        {s.unidade ? <Linha k="Unidade" v={s.unidade} /> : null}
      </Secao>

      <Secao titulo="Médico">
        <Linha k="Nome" v={m.nome} />
        {m.ambiguo ? (
          <Linha k="Dados" v="Nomes iguais na planilha" />
        ) : (
          <>
            <Linha k="CPF" v={m.cpf ?? "—"} />
            <Linha k="Telefone" v={m.telefone ?? "—"} />
            <Linha k="E-mail" v={m.email ?? "—"} />
            <Linha k="PIX" v={m.pix ?? "—"} />
            <Linha k="Nascimento" v={m.nascimento ?? "—"} />
          </>
        )}
      </Secao>
    </div>
  );
}

// Card de topo: panorama do médico — total antecipado + contadores agregados.
function HeroMedico({ nome, resumo: r }: { nome: string; resumo: ResumoMedico }) {
  const emAberto = r.n_a_pagar + r.n_atrasadas;
  return (
    <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/[0.02] p-4 ring-1 ring-primary/10">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-primary/80 uppercase">
        <Stethoscope className="size-3.5" />
        Médico
      </div>
      <div className="mt-1 font-display text-lg font-bold leading-tight">{nome}</div>

      <div className="mt-3">
        <div className="text-xs text-muted-foreground">Total antecipado</div>
        <div className="font-display text-3xl font-bold tabular-nums">{formatMoeda(r.valor_total)}</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Solicitações" valor={String(r.n_solicitacoes)} />
        <Stat label="Ticket médio" valor={formatMoeda(r.ticket_medio)} />
        <Stat label="Pagas" valor={String(r.n_pagas)} />
        <Stat
          label="Em aberto"
          valor={String(emAberto)}
          alerta={r.n_atrasadas > 0 ? `${r.n_atrasadas} em atraso` : undefined}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-primary/10 pt-3 text-xs text-muted-foreground">
        <span>
          Rebate acumulado{" "}
          <strong className="font-semibold text-success tabular-nums">
            {formatMoeda(r.total_rebate)}
          </strong>
        </span>
        {r.desde ? <span>· Desde {formatData(r.desde)}</span> : null}
        {r.unidades.length > 0 ? (
          <span>
            · {r.unidades.length} unidade{r.unidades.length === 1 ? "" : "s"}
          </span>
        ) : null}
        {r.total_lucro_operacional != null ? (
          <span>
            · Lucro op.{" "}
            <strong className="font-semibold text-foreground tabular-nums">
              {formatMoeda(r.total_lucro_operacional)}
            </strong>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, valor, alerta }: { label: string; valor: string; alerta?: string }) {
  return (
    <div className="rounded-lg bg-background/60 p-2.5 ring-1 ring-border/60">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold tabular-nums">{valor}</div>
      {alerta ? <div className="text-[11px] font-medium text-destructive">{alerta}</div> : null}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {titulo}
      </h3>
      <Separator className="mb-2" />
      <dl className="flex flex-col">{children}</dl>
    </div>
  );
}

function Linha({ k, v, destaque }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{k}</dt>
      <dd
        className={
          destaque
            ? "text-sm font-semibold tabular-nums text-success"
            : "text-sm font-medium tabular-nums text-foreground"
        }
      >
        {v}
      </dd>
    </div>
  );
}
