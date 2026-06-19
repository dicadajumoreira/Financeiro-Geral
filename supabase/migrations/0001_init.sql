-- ============================================================================
-- Financeiro Geral — Migração inicial (Fase 1 / MVP núcleo)
-- Modelo SaaS multi-tenant com isolamento por organização via RLS.
--
-- Hierarquia:
--   organization (tenant)  ->  companies (empresas/CNPJs)  ->  dados financeiros
--   memberships liga auth.users a uma organização com um papel (role).
--
-- Convenções:
--   * Toda tabela de negócio carrega org_id (raiz do isolamento) e, quando
--     pertinente, company_id.
--   * RLS habilitada em todas as tabelas; o acesso é concedido a membros da org.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type membership_role as enum ('owner', 'admin', 'finance', 'viewer');
create type account_type     as enum ('receita', 'despesa');
create type transaction_kind as enum ('receita', 'despesa');
create type transaction_status as enum ('pendente', 'pago', 'parcial', 'atrasado', 'cancelado');
create type contact_type     as enum ('cliente', 'fornecedor', 'ambos', 'funcionario');
create type recurrence_frequency as enum ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');
create type attachment_kind  as enum ('comprovante', 'nota_fiscal', 'boleto', 'contrato', 'outro');

-- ----------------------------------------------------------------------------
-- PERFIS (espelham auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ORGANIZAÇÕES (tenant)
-- ----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- MEMBROS (liga usuário <-> organização com papel)
-- ----------------------------------------------------------------------------
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        membership_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on public.memberships (user_id);
create index on public.memberships (org_id);

-- ----------------------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER evita recursão de RLS em memberships)
-- ----------------------------------------------------------------------------
create or replace function public.auth_user_orgs()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

create or replace function public.has_org_role(p_org uuid, p_roles membership_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid() and role = any(p_roles)
  );
$$;

-- Membro pode escrever? (qualquer papel exceto viewer)
create or replace function public.can_write_org(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_org_role(p_org, array['owner','admin','finance']::membership_role[]);
$$;

-- ----------------------------------------------------------------------------
-- EMPRESAS (CNPJs)
-- ----------------------------------------------------------------------------
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  legal_name    text not null,            -- razão social
  trade_name    text,                     -- nome fantasia
  cnpj          text,
  tax_regime    text,                     -- Simples, Lucro Presumido, Lucro Real
  email         text,
  phone         text,
  address       jsonb,
  logo_url      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.companies (org_id);

-- ----------------------------------------------------------------------------
-- PLANO DE CONTAS (um por empresa)
-- ----------------------------------------------------------------------------
create table public.chart_of_accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  parent_id   uuid references public.chart_of_accounts(id) on delete set null,
  code        text,                       -- ex: 3.1.01
  name        text not null,
  type        account_type not null,
  dre_group   text,                       -- agrupador para DRE (ex: "Receita Bruta", "Custos", "Despesas Operacionais")
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on public.chart_of_accounts (company_id);
create index on public.chart_of_accounts (org_id);

-- ----------------------------------------------------------------------------
-- CENTROS DE CUSTO (por empresa)
-- ----------------------------------------------------------------------------
create table public.cost_centers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  code        text,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on public.cost_centers (company_id);

-- ----------------------------------------------------------------------------
-- CONTATOS (clientes / fornecedores / funcionários)
-- Compartilhados na organização, opcionalmente vinculados a uma empresa.
-- ----------------------------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  type          contact_type not null default 'cliente',
  name          text not null,
  document      text,                     -- CNPJ ou CPF
  email         text,
  phone         text,
  address       jsonb,
  bank_info     jsonb,                    -- dados bancários para pagamento
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.contacts (org_id);
create index on public.contacts (company_id);

-- ----------------------------------------------------------------------------
-- CONTAS BANCÁRIAS (por empresa)
-- ----------------------------------------------------------------------------
create table public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,          -- apelido da conta
  bank_name       text,
  bank_code       text,
  agency          text,
  account_number  text,
  type            text default 'corrente', -- corrente, poupanca, caixa, aplicacao
  opening_balance numeric(14,2) not null default 0,
  opening_date    date,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index on public.bank_accounts (company_id);

-- ----------------------------------------------------------------------------
-- RECORRÊNCIAS (regra geradora de lançamentos repetidos)
-- ----------------------------------------------------------------------------
create table public.recurrences (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  kind            transaction_kind not null,
  description     text not null,
  amount          numeric(14,2) not null,
  account_id      uuid references public.chart_of_accounts(id) on delete set null,
  cost_center_id  uuid references public.cost_centers(id) on delete set null,
  contact_id      uuid references public.contacts(id) on delete set null,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  frequency       recurrence_frequency not null default 'mensal',
  day_of_month    int,                    -- dia base de vencimento (recorrência mensal)
  start_date      date not null,
  end_date        date,                   -- nulo = sem fim
  occurrences     int,                    -- nulo = ilimitado
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index on public.recurrences (company_id);

-- ----------------------------------------------------------------------------
-- LANÇAMENTOS (receitas e despesas — avulsas ou geradas por recorrência)
-- ----------------------------------------------------------------------------
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  company_id       uuid not null references public.companies(id) on delete cascade,
  kind             transaction_kind not null,
  description      text not null,
  amount           numeric(14,2) not null,
  account_id       uuid references public.chart_of_accounts(id) on delete set null,
  cost_center_id   uuid references public.cost_centers(id) on delete set null,
  contact_id       uuid references public.contacts(id) on delete set null,
  bank_account_id  uuid references public.bank_accounts(id) on delete set null,
  competence_date  date not null,         -- regime de competência
  due_date         date not null,         -- vencimento
  payment_date     date,                  -- regime de caixa (pago/recebido em)
  paid_amount      numeric(14,2),         -- valor efetivamente pago (parcial)
  status           transaction_status not null default 'pendente',
  payment_method   text,
  document_number  text,
  notes            text,
  recurrence_id    uuid references public.recurrences(id) on delete set null,
  installment_number int,
  installment_total  int,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.transactions (company_id);
create index on public.transactions (org_id);
create index on public.transactions (due_date);
create index on public.transactions (payment_date);
create index on public.transactions (status);

-- ----------------------------------------------------------------------------
-- ANEXOS (comprovantes, notas fiscais, boletos — por lançamento)
-- Os arquivos vão para o bucket 'attachments' no Supabase Storage.
-- ----------------------------------------------------------------------------
create table public.attachments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  transaction_id  uuid not null references public.transactions(id) on delete cascade,
  kind            attachment_kind not null default 'comprovante',
  file_name       text not null,
  storage_path    text not null,          -- caminho no bucket
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index on public.attachments (transaction_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Cria profile automaticamente ao registrar usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ao criar organização, torna o criador owner automaticamente
create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.memberships (org_id, user_id, role)
  values (new.id, coalesce(new.created_by, auth.uid()), 'owner')
  on conflict (org_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_org_created
  after insert on public.organizations
  for each row execute function public.handle_new_org();

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles      before update on public.profiles      for each row execute function public.touch_updated_at();
create trigger touch_organizations before update on public.organizations for each row execute function public.touch_updated_at();
create trigger touch_companies     before update on public.companies     for each row execute function public.touch_updated_at();
create trigger touch_contacts      before update on public.contacts      for each row execute function public.touch_updated_at();
create trigger touch_transactions  before update on public.transactions  for each row execute function public.touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.organizations     enable row level security;
alter table public.memberships       enable row level security;
alter table public.companies         enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.cost_centers      enable row level security;
alter table public.contacts          enable row level security;
alter table public.bank_accounts     enable row level security;
alter table public.recurrences       enable row level security;
alter table public.transactions      enable row level security;
alter table public.attachments       enable row level security;

-- PROFILES: cada usuário gerencia o próprio; membros da mesma org podem ver-se
create policy "profiles_select_self_or_org" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.memberships m1
      join public.memberships m2 on m1.org_id = m2.org_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid());

-- ORGANIZATIONS
create policy "orgs_select_member" on public.organizations for select
  using (id in (select public.auth_user_orgs()));
create policy "orgs_insert_authenticated" on public.organizations for insert
  with check (auth.uid() is not null and created_by = auth.uid());
create policy "orgs_update_admin" on public.organizations for update
  using (public.has_org_role(id, array['owner','admin']::membership_role[]));
create policy "orgs_delete_owner" on public.organizations for delete
  using (public.has_org_role(id, array['owner']::membership_role[]));

-- MEMBERSHIPS
create policy "memberships_select" on public.memberships for select
  using (org_id in (select public.auth_user_orgs()));
create policy "memberships_insert_admin" on public.memberships for insert
  with check (public.has_org_role(org_id, array['owner','admin']::membership_role[]));
create policy "memberships_update_admin" on public.memberships for update
  using (public.has_org_role(org_id, array['owner','admin']::membership_role[]));
create policy "memberships_delete_admin" on public.memberships for delete
  using (public.has_org_role(org_id, array['owner','admin']::membership_role[]));

-- Macro de políticas padrão para tabelas org-scoped (select p/ membros, escrita p/ não-viewers)
-- COMPANIES
create policy "companies_select" on public.companies for select using (org_id in (select public.auth_user_orgs()));
create policy "companies_write"  on public.companies for all using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

-- CHART OF ACCOUNTS
create policy "coa_select" on public.chart_of_accounts for select using (org_id in (select public.auth_user_orgs()));
create policy "coa_write"  on public.chart_of_accounts for all using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

-- COST CENTERS
create policy "cc_select" on public.cost_centers for select using (org_id in (select public.auth_user_orgs()));
create policy "cc_write"  on public.cost_centers for all using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

-- CONTACTS
create policy "contacts_select" on public.contacts for select using (org_id in (select public.auth_user_orgs()));
create policy "contacts_write"  on public.contacts for all using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

-- BANK ACCOUNTS
create policy "bank_select" on public.bank_accounts for select using (org_id in (select public.auth_user_orgs()));
create policy "bank_write"  on public.bank_accounts for all using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

-- RECURRENCES
create policy "rec_select" on public.recurrences for select using (org_id in (select public.auth_user_orgs()));
create policy "rec_write"  on public.recurrences for all using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

-- TRANSACTIONS
create policy "tx_select" on public.transactions for select using (org_id in (select public.auth_user_orgs()));
create policy "tx_write"  on public.transactions for all using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

-- ATTACHMENTS
create policy "att_select" on public.attachments for select using (org_id in (select public.auth_user_orgs()));
create policy "att_write"  on public.attachments for all using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));
