-- ============================================================
-- MiseOn — schema_v3: personalização de marca (fonte/cor do texto)
-- + Storage bucket para upload de imagens (logo, banner, produtos)
-- Rodar DEPOIS de schema.sql + schema_v2.sql.
-- ============================================================

ALTER TABLE lojas ADD COLUMN fonte TEXT NOT NULL DEFAULT 'Inter';
ALTER TABLE lojas ADD COLUMN cor_texto TEXT NOT NULL DEFAULT '#111827';

-- ── Storage: bucket público "loja-assets", gravável só pelo admin da loja ──
-- Estrutura de pastas: loja-assets/{loja_id}/... (o primeiro segmento do path
-- é o loja_id, usado pela policy abaixo pra checar acesso via fn_meu_acesso).
insert into storage.buckets (id, name, public)
values ('loja-assets', 'loja-assets', true)
on conflict (id) do nothing;

create policy loja_assets_leitura_publica on storage.objects
  for select using (bucket_id = 'loja-assets');

create policy loja_assets_upload_admin on storage.objects
  for insert with check (
    bucket_id = 'loja-assets'
    and fn_meu_acesso(((storage.foldername(name))[1])::uuid)
  );

create policy loja_assets_update_admin on storage.objects
  for update using (
    bucket_id = 'loja-assets'
    and fn_meu_acesso(((storage.foldername(name))[1])::uuid)
  );

create policy loja_assets_delete_admin on storage.objects
  for delete using (
    bucket_id = 'loja-assets'
    and fn_meu_acesso(((storage.foldername(name))[1])::uuid)
  );
