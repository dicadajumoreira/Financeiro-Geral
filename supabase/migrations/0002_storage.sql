-- ============================================================================
-- Storage: bucket de anexos (comprovantes, notas fiscais, boletos)
-- Caminho dos arquivos: {org_id}/{transaction_id}/{arquivo}
-- O isolamento usa a 1ª pasta do caminho (org_id) contra as memberships.
-- ============================================================================

-- Cria o bucket privado (idempotente)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Leitura: membros da organização dona da pasta raiz
create policy "attachments_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] in (select public.auth_user_orgs()::text)
  );

-- Upload: membros que podem escrever na organização
create policy "attachments_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
    and public.can_write_org(((storage.foldername(name))[1])::uuid)
  );

-- Exclusão: idem upload
create policy "attachments_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and public.can_write_org(((storage.foldername(name))[1])::uuid)
  );
