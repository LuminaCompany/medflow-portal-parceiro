-- Feature 014: Divisão por Unidade (A.H. GESTÃO MÉDICA).
-- Linha da AH que chega na planilha SEM Unidade Referência e cuja OBS não diz (com certeza)
-- quanto é de PA e quanto é de PS vira pendência; o gestor informa as unidades + valores no
-- portal e a divisão fica salva aqui. NÃO toca sheet/CRM — o portal reparte a linha na leitura.
-- Acesso SÓ pelo backend (service role). RLS habilitada deny-all (defesa em profundidade).

create table if not exists public.divisoes_unidade (
  id             uuid primary key default gen_random_uuid(),
  contratante    text not null,               -- da linha do sheet (nunca do corpo do request)
  codigo_origem  text not null,               -- coluna A do sheet (código do CRM, estável)
  cliente        text,                        -- contexto p/ o gestor
  valor_total    numeric(14,2) not null,      -- Originação no momento: mudou no sheet ⇒ invalida
  partes         jsonb not null,              -- [{"unidade": "PA Lorena", "valor": "350.00"}, …]
  criado_por     text not null,               -- nome do gestor
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint divisoes_unidade_linha_unica unique (contratante, codigo_origem),
  constraint divisoes_unidade_partes_array check (jsonb_typeof(partes) = 'array')
);

-- updated_at automático (função criada na migration 20260629_pagamentos_avisos.sql).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists divisoes_unidade_set_updated_at on public.divisoes_unidade;
create trigger divisoes_unidade_set_updated_at
  before update on public.divisoes_unidade
  for each row execute function public.set_updated_at();

-- Deny-all: nenhuma policy => anon/authenticated não leem nem escrevem. Só o service role (backend).
alter table public.divisoes_unidade enable row level security;
