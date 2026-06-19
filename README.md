# Financeiro Geral

Sistema financeiro **multi-empresas** (SaaS) com gestão de receitas/despesas
(avulsas e recorrentes), anexos, fluxo de caixa e DRE. Construído com **React +
Vite + TypeScript + Tailwind** sobre **Supabase** (Postgres + Auth + Storage) e
hospedado no **Netlify**.

> Roadmap e decisões do projeto: veja [`HANDOFF.md`](./HANDOFF.md).

## Status (Fase 1 — MVP núcleo)

- ✅ Multi-tenant com isolamento por organização (RLS)
- ✅ Autenticação (Supabase Auth) + onboarding de organização
- ✅ Empresas (CNPJs), Plano de Contas (por empresa), Centros de Custo, Contatos, Contas Bancárias
- ✅ Lançamentos (receitas/despesas) avulsos e recorrentes, com anexos
- ✅ Dashboard, Fluxo de Caixa e DRE (consolidado ou por empresa)
- 🔜 Conciliação bancária (Fase 2) · Funcionários/encargos (Fase 3) · CRM (Fase 4)

## Configuração

### 1. Banco de dados (Supabase)
No **SQL Editor** do seu projeto Supabase, rode na ordem:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_storage.sql`

Isso cria as tabelas, as políticas de RLS, os triggers e o bucket `attachments`.

> Em **Authentication → Providers → Email**, defina se quer exigir confirmação
> de e-mail. Para testes rápidos, pode desativar a confirmação.

### 2. Variáveis de ambiente
Copie `.env.example` para `.env` e preencha com os dados de
**Project Settings → API**:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-publica
```

### 3. Rodar localmente
```bash
npm install
npm run dev
```

### 4. Deploy no Netlify
- Conecte o repositório. O `netlify.toml` já define build `npm run build` e publish `dist`.
- Em **Site settings → Environment variables**, adicione
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Scripts
| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção |
| `npm run preview` | Pré-visualiza o build |
| `npm run typecheck` | Apenas checagem de tipos |

## Primeiros passos no app
1. Crie sua conta (Cadastre-se).
2. Crie sua **organização** (onboarding).
3. Cadastre uma **empresa**, selecione-a no seletor do topo.
4. Gere/edite o **plano de contas** e comece a lançar receitas e despesas.
