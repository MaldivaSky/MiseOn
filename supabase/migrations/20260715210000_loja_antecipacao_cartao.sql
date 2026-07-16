-- ============================================================
-- MiseOn — Prazo de recebimento do cartão configurável por loja
-- false (padrão): cobrança processada na modalidade padrão (~30 dias, taxa menor)
-- true: cobrança processada na modalidade antecipada (~2 dias úteis, taxa maior)
-- O roteamento acontece na edge function cartao-pagar (credenciais por modalidade).
-- ============================================================

alter table public.lojas
  add column if not exists antecipacao_cartao boolean not null default false;
