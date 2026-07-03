import type { Coluna } from "./DataTable";
import { BadgeStatus } from "./BadgeStatus";
import { formatData, formatMoeda, formatPercent } from "@/lib/format";
import type { Solicitacao } from "@/lib/types";

// Coluna de solicitação com metadados de visibilidade (tabela híbrida: chave + extras).
export interface ColunaSolic extends Coluna<Solicitacao> {
  label: string; // rótulo curto no seletor de colunas
  essential?: boolean; // sempre visível, fora do seletor
  defaultHidden?: boolean; // existe, mas começa oculta
}

function CodigoChip({ codigo }: { codigo: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground/80 ring-1 ring-border/60">
      {codigo}
    </span>
  );
}

// Todas as colunas disponíveis (modelo completo). A página decide quais exibir.
// `gestor` adiciona a coluna Parceiro.
export function colunasSolicitacao(gestor = false): ColunaSolic[] {
  const cols: ColunaSolic[] = [
    {
      id: "codigo",
      label: "Código",
      header: "Código",
      essential: true,
      sortable: true,
      cell: (s) => <CodigoChip codigo={s.codigo} />,
    },
    { id: "cliente", label: "Cliente", header: "Cliente", essential: true, sortable: true, cell: (s) => (
      <span className="font-medium">{s.cliente}</span>
    ) },
    {
      id: "data_pedido",
      label: "Pedido",
      header: "Pedido",
      sortable: true,
      cell: (s) => formatData(s.data_pedido),
    },
    {
      id: "valor",
      label: "Originação",
      header: "Originação",
      align: "right",
      sortable: true,
      cell: (s) => <span className="font-semibold">{formatMoeda(s.valor)}</span>,
    },
    {
      id: "data_vencimento",
      label: "Quitação",
      header: "Quitação",
      align: "right",
      sortable: true,
      cell: (s) => formatData(s.data_vencimento),
    },
    {
      id: "status",
      label: "Status",
      header: "Status",
      essential: true,
      sortable: true,
      cell: (s) => <BadgeStatus status={s.status} />,
    },
    // --- Extras (modelo completo, ocultas por padrão) ---
    {
      id: "recebido_cliente",
      label: "Recebido cliente",
      header: "Recebido",
      align: "right",
      defaultHidden: true,
      sortable: true,
      cell: (s) => formatMoeda(s.recebido_cliente),
    },
    {
      id: "iof",
      label: "IOF",
      header: "IOF",
      align: "right",
      defaultHidden: true,
      sortable: true,
      cell: (s) => formatMoeda(s.iof),
    },
    {
      id: "taxa_juros_mes",
      label: "Taxa ao mês",
      header: "Taxa/mês",
      align: "right",
      defaultHidden: true,
      sortable: true,
      cell: (s) => formatPercent(s.taxa_juros_mes),
    },
    {
      id: "prazo_dias",
      label: "Prazo",
      header: "Prazo",
      align: "right",
      defaultHidden: true,
      sortable: true,
      cell: (s) => (s.prazo_dias != null ? `${s.prazo_dias}d` : "—"),
    },
    {
      id: "unidade",
      label: "Unidade referência",
      header: "Unidade",
      defaultHidden: true,
      sortable: true,
      cell: (s) => s.unidade ?? "—",
    },
    {
      id: "cashback",
      label: "Rebate",
      header: "Rebate",
      align: "right",
      defaultHidden: true,
      sortable: true,
      cell: (s) => formatMoeda(s.cashback),
    },
  ];

  if (gestor) {
    cols.splice(2, 0, {
      id: "contratante",
      label: "Parceiro",
      header: "Parceiro",
      sortable: true,
      cell: (s) => s.contratante ?? "—",
    });
  }
  return cols;
}
