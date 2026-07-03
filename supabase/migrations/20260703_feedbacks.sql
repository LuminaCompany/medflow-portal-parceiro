-- Feature 006: Feedbacks (sugestão / bug) enviados por parceiros e gestores.
-- Tabela do portal (Postgres). Acesso SÓ pelo backend (service role) — frontend nunca toca o
-- Postgres direto (isolamento R-001). RLS habilitada deny-all (defesa em profundidade).
-- NÃO é dado financeiro isolado por Contratante: o gestor vê TODOS os feedbacks (é o destinatário).
-- Guardamos o autor (id/nome/papel/contratante) só como contexto de quem reportou.

create table if not exists public.feedbacks (
  id            uuid primary key default gen_random_uuid(),
  autor_id      text not null,                 -- Supabase user id de quem enviou
  autor_nome    text not null,                 -- nome de exibição (contexto do gestor)
  autor_papel   text not null,                 -- 'parceiro' | 'gestor'
  contratante   text,                          -- Contratante do autor (null p/ gestor)
  aba           text not null,                 -- aba onde o item está (ou "Não se encaixa")
  tipo          text not null
                check (tipo in ('sugestao', 'bug')),
  descricao     text not null,
  status        text not null default 'aberto'
                check (status in ('aberto', 'feito')),
  concluido_por text,                          -- nome do gestor que marcou "feito"
  concluido_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Listagem do gestor filtra/ordena por status, tipo e data.
create index if not exists feedbacks_status_created_idx
  on public.feedbacks (status, created_at desc);

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

drop trigger if exists feedbacks_set_updated_at on public.feedbacks;
create trigger feedbacks_set_updated_at
  before update on public.feedbacks
  for each row execute function public.set_updated_at();

-- Deny-all: nenhuma policy => anon/authenticated não leem nem escrevem. Só o service role (backend).
alter table public.feedbacks enable row level security;
