# Handoff — Sistema Financeiro Geral (Multi-empresas + CRM)

> Documento de transferência para continuar o projeto em outra sessão/conta do Claude.
> Data: 2026-06-19 · Branch de trabalho: `claude/multi-company-financial-system-rdcl3c`
> Repositório: `dicadajumoreira/financeiro-geral`

---

## 1. Objetivo do projeto

Sistema financeiro **multi-empresas** (vários CNPJs) com **CRM**, funcionando 100% online:
- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui → deploy no **Netlify**
- **Backend/Banco:** **Supabase** (PostgreSQL + Auth + Storage + Realtime)

### Requisitos pedidos pela cliente (Juliana)
- Gestão financeira de várias empresas com CNPJs diferentes
- Lançamento de **despesas e receitas** recorrentes e avulsas
- **Conciliação bancária** (importar extratos)
- Relatórios e visualizações gerais e individuais por empresa
- Despesas com funcionários + **cálculos trabalhistas automáticos**
- **Anexar** comprovantes, notas fiscais e boletos por lançamento
- Importação de extratos bancários
- Visualização de **Fluxo de Caixa** e **DRE**
- CRM "completo e robusto"

---

## 2. Decisões já tomadas (confirmadas pela cliente)

| Tema | Decisão |
|------|---------|
| **Entrega** | MVP em **fases** (núcleo financeiro primeiro) |
| **Stack frontend** | React + Vite + TypeScript + Tailwind + shadcn/ui |
| **Backend** | Supabase (Postgres + Auth + Storage) · Deploy Netlify |
| **Multi-tenant** | É **SaaS para revender a terceiros** → isolamento por organização via RLS desde a base |
| **CRM** | No MVP só **cadastro de clientes/fornecedores**; módulo comercial completo (funil, oportunidades, propostas) fica para **fase posterior** |
| **Plano de contas** | **Um por empresa** (independente) |
| **Folha/encargos** | **Encargos principais** (INSS patronal, FGTS, provisões de férias e 13º) — não é folha completa |
| **Importação de extratos** | Formatos **OFX, CSV/Excel e PDF** |
| **Infra** | Cliente **já tem** contas Supabase e Netlify |
| **Padrões assumidos** | Idioma **PT-BR**, moeda **BRL**, suporte a regime de **caixa e competência**, **Supabase Auth** para login |

---

## 3. Roadmap por fases

- **Fase 1 (EM ANDAMENTO) — MVP núcleo:** estrutura do projeto, multi-tenant com RLS, autenticação, organizações/membros/perfis, empresas (CNPJs), plano de contas por empresa, centros de custo, contatos (clientes/fornecedores), contas bancárias, lançamentos (receitas/despesas, avulsas e recorrentes), anexos, dashboard + Fluxo de Caixa + DRE.
- **Fase 2:** conciliação bancária (import OFX/CSV/PDF + sugestão de matches).
- **Fase 3:** funcionários + cálculos de encargos trabalhistas.
- **Fase 4:** CRM comercial completo (funil, oportunidades, propostas).

---

## 4. O que JÁ foi criado (estado atual do repositório)

Estrutura inicial do projeto scaffolded:

```
.
├── package.json              # React 18, Vite 5, TS, Tailwind, react-router, react-query,
│                             # @supabase/supabase-js, recharts, zod, react-hook-form, date-fns
├── index.html
├── vite.config.ts            # alias "@/" -> src
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── tailwind.config.js        # tokens shadcn (cores via CSS vars, darkMode class)
├── postcss.config.js
├── netlify.toml              # build + SPA redirect + cache headers
├── .env.example              # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
├── .gitignore
└── supabase/
    └── migrations/
        └── 0001_init.sql     # SCHEMA COMPLETO da Fase 1 com RLS multi-tenant
```

### Schema do banco (`0001_init.sql`) — já escrito
Tabelas criadas com RLS habilitada e isolamento por `org_id`:
- `profiles` (espelha auth.users, trigger on signup)
- `organizations` (tenant) + trigger que torna criador `owner`
- `memberships` (user ↔ org, roles: owner/admin/finance/viewer)
- `companies` (empresas/CNPJs)
- `chart_of_accounts` (plano de contas por empresa, com dre_group)
- `cost_centers` (centros de custo)
- `contacts` (clientes/fornecedores/funcionários)
- `bank_accounts` (contas bancárias)
- `recurrences` (regras de lançamento recorrente)
- `transactions` (lançamentos — competence_date, due_date, payment_date, status, parcelas)
- `attachments` (anexos por lançamento → bucket Storage)

Funções auxiliares de segurança (SECURITY DEFINER p/ evitar recursão de RLS):
`auth_user_orgs()`, `has_org_role()`, `can_write_org()`.

Enums: `membership_role`, `account_type`, `transaction_kind`, `transaction_status`,
`contact_type`, `recurrence_frequency`, `attachment_kind`.

---

## 5. PROGRESSO DA FASE 1 (✅ implementado)

Frontend e backend do MVP núcleo já construídos e com **build passando** (`npm run build`):

1. ✅ **Frontend base:** `main.tsx`, `App.tsx` (rotas + guards), `index.css` (tema), `favicon.svg`, `lib/supabase.ts`, `lib/utils.ts`, `lib/format.ts` (BRL/datas/CNPJ), `lib/recurrence.ts`, `types/database.ts`, `vite-env.d.ts`
2. ✅ **Auth & contexto:** `AuthContext`, `OrgContext`, páginas Login/Signup/Onboarding
3. ✅ **Componentes UI** (`components/ui/`): button, input, textarea, select, label, card, badge, table, dialog, spinner
4. ✅ **Layout:** `AppLayout` (sidebar + topbar), `CompanySwitcher`, `PageHeader`, `RequireCompany`, `nav.ts`
5. ✅ **Módulos:** Dashboard, Empresas, Plano de Contas (+plano padrão), Contatos, Contas Bancárias, Lançamentos (CRUD + filtros + marcar pago + anexos), Recorrências (+geração de lançamentos), Fluxo de Caixa (caixa/competência), DRE
6. ✅ **Storage:** `0002_storage.sql` cria bucket `attachments` + políticas RLS
7. ✅ **Anexos:** `AttachmentsManager` (upload/download/excluir via Storage)

### Pendências / próximos passos
- Configurar Supabase (rodar migrações) e Netlify (env vars) — ver `README.md`
- Deduplicar `npm` chunk grande (code-splitting) — opcional
- **Centros de Custo**: tabela e uso no lançamento existem; falta tela de CRUD dedicada (hoje só via banco)
- Exportação de relatórios para Excel/PDF (pedido da cliente) — pendente
- Iniciar **Fase 2** (conciliação bancária: import OFX/CSV/PDF)

### Configuração de infra pendente (cliente já tem as contas)
- Rodar a migração `0001_init.sql` no Supabase (SQL Editor ou CLI)
- Criar bucket de Storage `attachments` (privado)
- Pegar `Project URL` e `anon key` (Supabase > Settings > API) → preencher `.env`
- No Netlify: setar env vars `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; build `npm run build`, publish `dist`

---

## 6. Como retomar nesta outra conta

1. Faça checkout da branch `claude/multi-company-financial-system-rdcl3c`.
2. Leia este `HANDOFF.md` e o `supabase/migrations/0001_init.sql`.
3. Continue pela seção **5. Próximos passos**, começando pelo frontend base (item 1).
4. Mantenha o isolamento multi-tenant: toda query/inserção deve respeitar `org_id` (o RLS já protege no banco, mas o frontend deve sempre enviar `org_id`/`company_id`).
5. Padrão de UI: shadcn/ui + Tailwind, PT-BR, formatação BRL.

> Observação: o código ainda **não foi commitado/pushed** até a geração deste documento (verificar `git status`). Recomenda-se commitar o scaffold antes de migrar de sessão.
