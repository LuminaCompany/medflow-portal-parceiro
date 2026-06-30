// Tipos compartilhados da API (espelham contracts/api.md). Valores monetários chegam
// como string decimal ("1300.00") — formatação de exibição em lib/format.ts.

export type Role = "parceiro" | "gestor";
export type StatusKey = "pago" | "a_pagar" | "atrasado";

export interface Me {
  id: string;
  nome_exibicao: string;
  role: Role;
  contratante: string | null;
}

export interface Solicitacao {
  codigo: string;
  cliente: string;
  valor: string;
  recebido_cliente: string | null;
  iof: string | null;
  juros_descontos: string | null;
  taxa_juros_mes: string | null;
  data_pedido: string;
  prazo_dias: number | null;
  data_vencimento: string;
  unidade: string | null;
  cashback: string;
  status: StatusKey;
  status_label: string;
  medico_grupo_id: string | null;
  // Só na visão do gestor (backend faz strip p/ parceiro):
  lucro_operacional?: string | null;
  agio_base?: string | null;
  contratante?: string;
  cor_parceiro?: string | null;
}

export interface Medico {
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  pix: string | null;
  pix_tipo: string | null;
  nascimento: string | null;
}

// Agregado do médico (mesmo Contratante, dentro do escopo) — card do painel lateral.
export interface ResumoMedico {
  n_solicitacoes: number;
  valor_total: string; // Σ originação (total antecipado do médico)
  total_recebido_cliente: string;
  total_rebate: string;
  ticket_medio: string;
  n_pagas: number;
  n_a_pagar: number;
  n_atrasadas: number;
  unidades: string[];
  desde: string | null; // 1ª antecipação (data ISO)
  total_lucro_operacional?: string; // só na visão do gestor
}

export interface SolicitacaoDetalhe {
  solicitacao: Solicitacao;
  medico: Medico;
  resumo_medico: ResumoMedico;
}

export interface Paginada<T> {
  items: T[];
  total: number;
  has_more: boolean;
}

export interface UnidadeVencimentosParceiro {
  unidade: string;
  vencido: string; // Σ status atrasado
  a_vencer: string; // Σ status a_pagar
  total_pendente: string; // vencido + a_vencer (chave de ordenação)
  tudo_pago: boolean; // total_pendente == 0
  solicitacoes: Solicitacao[];
}

export interface VencimentosParceiro {
  cards: {
    total_pendente: string;
    em_atraso: string;
    n_atrasadas: number;
    n_a_pagar: number;
  };
  unidades: UnidadeVencimentosParceiro[];
  atrasados: Solicitacao[];
  proximos: Solicitacao[];
  pagos: Solicitacao[];
}

export interface UnidadeVencimentos {
  unidade: string;
  total: string; // Σ Originação de todas as solicitações (incl. pagas)
  status: StatusKey;
  status_label: string;
  solicitacoes: Solicitacao[];
}

export interface ContratanteVencimentos {
  contratante: string;
  vencido: string; // Σ status atrasado
  a_vencer: string; // Σ status a_pagar
  total_pendente: string; // vencido + a_vencer (chave de ordenação)
  tudo_pago: boolean; // total_pendente == 0
  unidades: UnidadeVencimentos[];
}

export interface VencimentosGestor {
  cards: { solicitacoes_a_pagar: number; valor_total_a_receber: string };
  contratantes: ContratanteVencimentos[];
}

export interface Overview {
  cards: {
    total_solicitacoes: number;
    valor_total: string;
    total_cashback: string;
    ticket_medio: string;
    em_aberto: number;
    pagas: number;
    medicos_impactados: number;
  };
  serie_mensal: { mes: string; valor: string }[];
  ano: number;
  anos_disponiveis: number[];
}

export interface ParceiroBotao {
  contratante: string;
  cor: string;
  total: number;
}

export interface ParceiroLogin {
  id: string;
  email: string;
  nome_exibicao: string;
  contratante: string;
  cor: string | null;
  unidades: string[] | null; // allowlist (null = não restrito / legado)
  created_at: string;
}

// Parceiro = Contratante (feature 003): config compartilhada + seus logins.
export interface Parceiro {
  contratante: string;
  cor: string | null;
  unidades: string[] | null; // allowlist sincronizada (null = todas / legado)
  logins: ParceiroLogin[];
}

// Opção do dropdown de Contratantes (origem: sheet).
export interface ContratanteOpcao {
  contratante: string;
  total: number;
}

export type UnidadeStatus = "orfa" | "ok" | "conflito";

// Unidade do sistema + vínculo por config (badges) e origem no sheet.
export interface UnidadeInfo {
  unidade: string;
  contratantes: string[]; // parceiros que têm a unidade na allowlist (config)
  status: UnidadeStatus; // 0 / 1 / 2+ contratantes
  sheet_contratantes: string[]; // coocorrência no sheet
}

// --- Avisos de Pagamento (feature 004) ---
export type AvisoStatus = "pendente" | "verificado" | "rejeitado" | "cancelado";

export interface PagamentoAviso {
  id: string;
  contratante: string;
  unidade: string;
  valor: string; // snapshot do total pendente no envio
  solicitacao_codigos: string[];
  status: AvisoStatus;
  status_label: string;
  motivo_rejeicao: string | null;
  created_at: string | null;
  verificado_at: string | null;
}

// Visão do parceiro (aba Vencimentos): mapa unidade → aviso vigente.
export interface MeusAvisos {
  avisos: Record<string, PagamentoAviso>;
}

// Unidade pendente sem aviso ativo (bloco "Falta aviso" do gestor).
export interface UnidadeFaltaAviso {
  unidade: string;
  valor: string;
  motivo_rejeicao: string | null; // motivo do último aviso rejeitado, se houver
}

export interface ContratantePagamentos {
  contratante: string;
  cor: string | null;
  aguardando: PagamentoAviso[];
  verificadas: PagamentoAviso[];
  falta_aviso: UnidadeFaltaAviso[];
}

export interface PagamentosGestor {
  cards: { aguardando: number; verificadas: number; falta_aviso: number };
  contratantes: ContratantePagamentos[];
}

export interface Pendencia {
  codigo: string;
  cliente: string | null;
  contratante: string | null;
  valor: string | null;
  data_pedido: string | null;
  data_vencimento: string | null;
  linha_origem: number;
  motivos: string[];
}
