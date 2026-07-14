-- Dados comerciais/fiscais da loja, usados no cupom de venda (nota não fiscal)
-- impresso para o cliente. Campos opcionais — se vazios, são omitidos no cupom.
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS razao_social TEXT;
