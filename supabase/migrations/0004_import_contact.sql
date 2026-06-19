-- ============================================================================
-- Aprendizado de importação: também lembrar o fornecedor (contato) por padrão.
-- ============================================================================

alter table public.import_classifications
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;
