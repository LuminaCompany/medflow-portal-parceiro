-- Feature 004: Avisos de Pagamento (parceiro avisa pagamento por Unidade; gestor verifica/rejeita).
-- Primeira tabela Postgres do portal. Acesso SÓ pelo backend (service role) — frontend nunca
-- toca o Postgres direto (isolamento R-001). RLS habilitada deny-all (defesa em profundidade).

create table if not exists public.pagamentos_avisos (
  id                   uuid primary key default gen_random_uuid(),
  contratante          text not null,                 -- escopo + agrupamento (identidade do parceiro)
  unidade              text not null,
  valor                numeric(14,2) not null,        -- snapshot do total pendente no momento do envio
  solicitacao_codigos  jsonb not null default '[]',   -- snapshot dos códigos das solicitações cobertas
  status               text not null default 'pendente'
                       check (status in ('pendente', 'verificado', 'rejeitado', 'cancelado')),
  motivo_rejeicao      text,
  created_at           timestamptz not null default now(),  -- "data do aviso"
  verificado_at        timestamptz,
  updated_at           timestamptz not null default now()
);

-- 1 aviso ATIVO por unidade: trava reenvio enquanto pendente/verificado.
-- cancelado/rejeitado são terminais e liberam um novo aviso da mesma unidade.
create unique index if not exists pagamentos_avisos_ativo_uq
  on public.pagamentos_avisos (contratante, unidade)
  where status in ('pendente', 'verificado');

-- Listagens do gestor filtram/ordenam por status e contratante.
create index if not exists pagamentos_avisos_contratante_status_idx
  on public.pagamentos_avisos (contratante, status);

-- updated_at automático em todo UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pagamentos_avisos_set_updated_at on public.pagamentos_avisos;
create trigger pagamentos_avisos_set_updated_at
  before update on public.pagamentos_avisos
  for each row execute function public.set_updated_at();

-- Deny-all: nenhuma policy criada => anon/authenticated não leem nem escrevem.
-- Só o service role (backend) acessa, pois ele faz bypass de RLS.
alter table public.pagamentos_avisos enable row level security;
