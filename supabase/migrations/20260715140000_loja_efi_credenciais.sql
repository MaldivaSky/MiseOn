-- Credenciais da API Efí POR LOJA (modelo "conta própria por tenant").
-- Cada lojista usa a própria conta Efí: a cobrança Pix/cartão nasce na conta dele,
-- o cliente vê o NOME da loja e o dinheiro cai direto — sem split, sem a plataforma
-- segurar dinheiro de terceiros.
--
-- SEGURANÇA: client_secret e certificado são sensíveis. Por isso ficam FORA da tabela
-- `lojas` (que tem leitura pública pela vitrine) e nesta tabela dedicada, com RLS que
-- só libera o dono da loja (fn_meu_acesso) e o superadmin. As Edge Functions leem via
-- service_role (que ignora RLS). A vitrine pública NUNCA acessa esta tabela.
create table if not exists public.loja_efi_credenciais (
  loja_id           uuid primary key references public.lojas(id) on delete cascade,
  efi_client_id     text,
  efi_client_secret text,
  efi_pix_key       text,       -- chave Pix da conta do lojista (recebedor da cobrança)
  efi_cert_base64   text,       -- PEM (cert+chave) em base64, para o mTLS do Pix
  atualizado_em     timestamptz default now()
);

alter table public.loja_efi_credenciais enable row level security;

drop policy if exists cred_acesso on public.loja_efi_credenciais;
create policy cred_acesso on public.loja_efi_credenciais
  for all to authenticated
  using (fn_meu_acesso(loja_id)) with check (fn_meu_acesso(loja_id));

drop policy if exists cred_superadmin on public.loja_efi_credenciais;
create policy cred_superadmin on public.loja_efi_credenciais
  for all to authenticated
  using (fn_sou_superadmin()) with check (fn_sou_superadmin());
