# Vínculo login→Contratante e Unidade→Contratante passam a ser definidos pelo gestor

**Status:** accepted (2026-06-29) — feature 003. Complementa o ADR 0001 (Unidade obrigatória),
que segue válido.

## Contexto

Duas perguntas estavam mal definidas:

1. **Como um login sabe sua Contratante?** Já vivia em `app_metadata.contratante`, mas era
   texto livre digitado pelo gestor — um typo silenciosamente quebrava o isolamento (R-001).
2. **A qual Contratante uma Unidade pertence?** Era **implícito**: a Unidade "pertencia" a
   quem coocorresse com ela na mesma linha do sheet. O escopo filtrava só por Contratante, então
   o parceiro via **todas** as unidades da sua Contratante, sem controle do gestor.

## Decisão

**Parceiro = Contratante.** A configuração de um parceiro (cor + allowlist de Unidades) é da
Contratante e fica **sincronizada** no `app_metadata` de todos os logins dela (sem tabela nova).

1. **login→Contratante:** o gestor escolhe a Contratante num **dropdown** alimentado pelas
   Contratantes distintas do sheet (`GET /api/admin/contratantes`). Uma Contratante pode ter
   1..N logins. O valor continua em `app_metadata.contratante`.

2. **Unidade→Contratante:** passa a ser **definido pelo gestor**, não pelo sheet. Cada parceiro
   tem uma **allowlist de Unidades** (`app_metadata.unidades`). O editor lista **todas** as
   Unidades do sistema (existência = aparecer no sheet) com um toggle e um badge de vínculo:
   órfã (0 contratantes) · uma contratante · **conflito** (2+, aviso forte).

3. **Escopo final do parceiro = Contratante igual E Unidade ∈ allowlist.** Ponto único:
   `domain/scope.py:filtra_por_escopo`. A allowlist só **restringe dentro** da Contratante —
   atribuir uma unidade de outra contratante **nunca** concede acesso cross (Princípio VI,
   inegociável). O badge "2+ contratantes" é higiene de config, não vazamento.

### Semântica da allowlist (falha fechada)

- `unidades` **ausente/None** (nunca configurada) → sem restrição de Unidade (back-compat: o
  parceiro continua vendo tudo da Contratante até o gestor configurar e salvar).
- `unidades` **lista explícita** → só essas Unidades; `[]` → não vê nenhuma solicitação.
- **Default na criação:** pré-marca as Unidades que coocorrem com a Contratante no sheet
  (replica o comportamento anterior). Gestor edita granularmente depois.

## Consequences

- Escrita propaga para todos os logins da Contratante (`PartnersService.editar_config`, fan-out).
- A página de Parceiros lista **todas** as Contratantes do sheet (existem por si), mesmo sem
  login: `GET /api/admin/partners` faz a união (logins ∪ contratantes do sheet). Contratante
  sem login vira card vazio (cor determinística, sem allowlist) e tem "Editar parceiro"
  **bloqueado** até existir ≥1 login (a config só persiste no `app_metadata` do login). Logins
  nunca são criados automaticamente. "Gerenciar logins" (add/editar/remover) é a ação principal.
- Logins legados sem `unidades` continuam funcionando (None = irrestrito) até o gestor salvar.
- Não há tabela de aplicação nova: tudo permanece no Supabase Auth `app_metadata` + sheet
  (read-only), coerente com a arquitetura atual.
