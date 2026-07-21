-- Trava contra insumos duplicados por nome (espaco no fim / caixa diferente).
--
-- Contexto: a tela de Estoque nao aplicava trim no nome nem tinha guarda de
-- duplo-clique. Resultado observado no projeto zzuxklwhaoisuuvndtfw:
--   - lanchepaulista: "Tomate" (g) + "tomate " (fatias) x2 — as duas ultimas
--     criadas com 514ms de diferenca, cada uma com saldo, lote, movimentacao
--     e fatores_conversao proprios;
--   - natureba: "Alface americana" (un) x "Alface Americana" (porcao) — a
--     versao `un` detinha as 2 fichas tecnicas e a baixa de venda real, mas
--     estava arquivada: as vendas debitavam um insumo invisivel na tela,
--     enquanto a versao ativa nunca se movia.
--
-- A consolidacao dos dados ja foi aplicada (canonico eleito, saldos ajustados
-- via movimentacao tipo AJUSTE, duplicatas arquivadas com ativo=false; nenhum
-- registro deletado, porque o ledger referencia). Esta migration cuida apenas
-- de impedir que volte a acontecer.

-- 1. Normaliza o que ja existe
UPDATE insumos SET nome = btrim(nome) WHERE nome <> btrim(nome);

-- 2. Normaliza toda escrita futura — cobre tambem writes fora do app
--    (SQL manual, seeds, edge functions), nao so o formulario.
CREATE OR REPLACE FUNCTION fn_insumos_normaliza_nome() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.nome := btrim(NEW.nome);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_insumos_normaliza_nome ON insumos;
CREATE TRIGGER tg_insumos_normaliza_nome
  BEFORE INSERT OR UPDATE OF nome ON insumos
  FOR EACH ROW EXECUTE FUNCTION fn_insumos_normaliza_nome();

-- 3. Unicidade por loja, case-insensitive.
--    Indice PARCIAL (so entre ativos) de proposito: insumos arquivados guardam
--    o historico do ledger e precisam poder repetir nome. Reativar um homonimo
--    devolve 23505, tratado na UI (src/pages/admin/Estoque.tsx).
CREATE UNIQUE INDEX IF NOT EXISTS uq_insumos_loja_nome_ativo
  ON insumos (loja_id, lower(btrim(nome))) WHERE ativo;
