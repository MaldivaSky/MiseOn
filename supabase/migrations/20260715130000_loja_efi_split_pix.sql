-- Dados do favorecido do Split Pix (repasse direto ao lojista).
-- Diferente do cartão (que usa efi_payee_code), o Pix da Efí exige identificar o
-- favorecido por CPF/CNPJ do titular + número da conta Efí. Sem esses dois campos,
-- o Pix cai na conta da plataforma (repasse manual). Preenchidos, a venda vai 100%
-- direto para a conta do lojista via /v2/gn/split/config + vínculo na cobrança.
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS efi_titular_documento text; -- CPF/CNPJ do titular da conta Efí
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS efi_conta             text; -- número da conta Efí do lojista

COMMENT ON COLUMN public.lojas.efi_titular_documento IS 'CPF/CNPJ do titular da conta Efi do lojista (favorecido do split Pix)';
COMMENT ON COLUMN public.lojas.efi_conta IS 'Numero da conta Efi do lojista (favorecido do split Pix)';
