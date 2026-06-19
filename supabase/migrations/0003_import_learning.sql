-- ============================================================================
-- Aprendizado de classificação na importação.
-- Guarda, por organização, o "padrão" de uma despesa (descrição normalizada)
-- e a classificação escolhida (empresa, categoria, status). Em importações
-- futuras, o sistema reaplica automaticamente.
-- ============================================================================

create table public.import_classifications (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  pattern       text not null,                 -- descrição normalizada (chave)
  company_id    uuid references public.companies(id) on delete set null,
  category_name text,                          -- nome da categoria (plano de contas)
  status        text,                          -- 'pago' | 'pendente'
  hits          int not null default 1,        -- quantas vezes foi confirmada
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, pattern)
);
create index on public.import_classifications (org_id);

create trigger touch_import_classifications
  before update on public.import_classifications
  for each row execute function public.touch_updated_at();

alter table public.import_classifications enable row level security;

create policy "imp_class_select" on public.import_classifications for select
  using (org_id in (select public.auth_user_orgs()));
create policy "imp_class_write" on public.import_classifications for all
  using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));
