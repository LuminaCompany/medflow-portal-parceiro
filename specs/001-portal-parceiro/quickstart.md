# Quickstart — Portal do Parceiro MedFlow

Setup local + como expor a planilha com segurança. Stack: **Python/FastAPI** (backend),
**Next.js** (frontend), **Supabase** (auth), **Google Sheets** (dados financeiros).

---

## 1. Expor a planilha para requisições (jeito recomendado e seguro)

> ⚠️ **Segurança**: o **OAuth Client ID/Secret** enviado é o tipo **errado** (é OAuth de
> usuário) e o secret foi exposto em texto puro → **revogue e gere outro**. O backend
> headless usa **Service Account** (chave JSON). Não precisa de e-mail/senha.
>
> A planilha hoje está **pública** — qualquer um com o link lê os dados de **todos** os
> parceiros. Trocar por **Service Account** (leitura server-side, planilha privada).
>
> A planilha tem **3 abas**, todas usadas: `Dados Tratados` (solicitações),
> `Cadastro de Clientes` (Cliente→Contratante), `base de dados` (detalhe/PII do médico).

1. **Google Cloud Console** → criar/escolher um projeto.
2. **APIs & Services → Library → ativar "Google Sheets API"**.
3. **APIs & Services → Credentials → Create Credentials → Service Account**.
4. No Service Account → **Keys → Add Key → JSON** → baixar o arquivo.
5. Copiar o e-mail da conta: algo como `portal-medflow@projeto.iam.gserviceaccount.com`.
6. Abrir a **planilha** → **Compartilhar** → adicionar esse e-mail como **Leitor**.
7. **Remover** o acesso "Qualquer pessoa com o link" (deixar privada).
8. Guardar para o backend:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = conteúdo do JSON (string única).
   - `SHEET_ID` = `1y99JgtSuAHF4vo3PMZ03A1GU84k_wCohPymdt8n8-LE`
   - Abas (por nome): `Dados Tratados`, `Cadastro de Clientes`, `base de dados`
     (`Dados Tratados` = `gid=278430548`).

> Alternativa rápida só para protótipo (NÃO usar em produção com dado real): manter o
> CSV público `…/export?format=csv&gid=…`. Inseguro — evitar.

---

## 2. Backend (FastAPI)

```bash
cd backend
py -m venv .venv && . .venv/Scripts/activate   # Windows (Git Bash)
pip install -r requirements.txt                 # fastapi uvicorn pydantic[...] google-api-python-client supabase
cp .env.example .env                            # preencher vars abaixo
uvicorn app.main:app --reload --port 8000
```

`.env` (backend):
```
GOOGLE_SERVICE_ACCOUNT_JSON={...}      # chave JSON do Service Account
SHEET_ID=1y99JgtSuAHF4vo3PMZ03A1GU84k_wCohPymdt8n8-LE
SHEET_TAB_SOLICITACOES=Dados Tratados
SHEET_TAB_CADASTRO=Cadastro de Clientes
SHEET_TAB_BASE=base de dados
SHEET_CACHE_TTL=180                    # segundos
SUPABASE_URL=...                       # do projeto Supabase
SUPABASE_SERVICE_ROLE_KEY=...          # SÓ no backend, nunca no frontend
SUPABASE_JWT_SECRET=...                # validar tokens
CORS_ORIGINS=http://localhost:3000
```

Teste rápido: `GET http://localhost:8000/api/me` com um Bearer válido.

---

## 3. Supabase (auth + usuários)

**Sem tabela** — usuários ficam só no **Auth** (`auth.users`); papel e parceiro no
`app_metadata` (ver data-model §2).

1. Criar o login no **Authentication** do Supabase (e-mail + senha) **ou** pela aba
   **Parceiros** do portal (gestor) — backend usa a Auth Admin API.
2. Setar `role` + `contratante` no **`app_metadata`** (não `user_metadata`, que o usuário
   poderia alterar). No dashboard, via SQL Editor:
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"parceiro","contratante":"BESA Medical Group"}' where email='...';`
   (gestor: `{"role":"gestor","contratante":null}`). Pela aba Parceiros isso é automático.
3. `contratante` de cada parceiro **deve casar exatamente** com a planilha
   (ex.: `BESA Medical Group`, `A.H. GESTÃO MÉDICA`, `MMR Serviços Médicos`,
   `AZEVEDO MAIA SERVIÇOS MÉDICOS`).

---

## 4. Frontend (Next.js)

```bash
cd frontend
pnpm install
cp .env.local.example .env.local
pnpm dev                                # http://localhost:3000
```

`.env.local` (frontend — só chaves públicas):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # anon (público) — nunca a service role
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

- Tokens OKLCH do DESIGN.md em `styles/tokens.css`; tema via `next-themes`.
- O frontend **nunca** lê a planilha direto — sempre via API (isolamento).

---

## 5. Verificação de isolamento (crítico — R-001/CS-002)

1. Logar como parceiro A → conferir que toda tela só traz dados do `contratante` de A.
2. Tentar `GET /api/solicitacoes?parceiros=<outro>` como parceiro → deve `403`/ignorar.
3. Conferir os dois gates: (a) **escopo por Contratante** — o parceiro **nunca** recebe
   linha de outro parceiro; (b) **máscara por papel (D5′)** — o payload do parceiro **não**
   traz `lucro_operacional` nem `agio_base` (margens da MedFlow). O parceiro vê a
   lista-modelo de colunas + PII do médico; o gestor vê todas, inclusive as margens.
4. Logar como gestor → consolidado de todos + admin de logins.

---

## 6. Deploy

**Frontend — Vercel**
- Projeto Next.js; apenas envs públicas (`NEXT_PUBLIC_*`).
- `NEXT_PUBLIC_API_BASE_URL` = URL pública do backend na VPS (ex.: `https://api.seudominio.com`).

**Backend — VPS própria com EasyPanel (container Docker)**
- Criar um serviço **App** no EasyPanel a partir do repositório; ele builda via `backend/Dockerfile`.
- `backend/Dockerfile` (mínimo):
  ```dockerfile
  FROM python:3.11-slim
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY . .
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```
- EasyPanel faz proxy + HTTPS (Let's Encrypt) e expõe um domínio para a porta 8000.
- Envs **secretas** no painel do serviço (nunca no front): `GOOGLE_SERVICE_ACCOUNT_JSON`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SHEET_ID`, abas, `SHEET_CACHE_TTL`.
- `CORS_ORIGINS` = domínio do frontend na Vercel.
- Container persistente → o cache TTL em processo sobrevive entre requisições (sem cold start).
