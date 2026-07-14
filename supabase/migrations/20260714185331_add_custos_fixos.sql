-- Tabela para rateio de despesas fixas
CREATE TABLE IF NOT EXISTS configuracoes_custo (
  loja_id UUID PRIMARY KEY REFERENCES lojas(id) ON DELETE CASCADE,
  custo_aluguel NUMERIC(10,2) DEFAULT 0,
  custo_energia NUMERIC(10,2) DEFAULT 0,
  custo_agua NUMERIC(10,2) DEFAULT 0,
  custo_internet NUMERIC(10,2) DEFAULT 0,
  custo_gas NUMERIC(10,2) DEFAULT 0,
  outros_custos_fixos NUMERIC(10,2) DEFAULT 0,
  expectativa_vendas_mes INT DEFAULT 1000,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE configuracoes_custo ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'adm_config_custos' AND tablename = 'configuracoes_custo'
    ) THEN
        CREATE POLICY adm_config_custos ON configuracoes_custo FOR ALL USING (fn_meu_acesso(loja_id));
    END IF;
END
$$;

-- Coluna flexível para o motor dinâmico de conversões do insumo
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS detalhes_rendimento JSONB;

-- View refatorada para retornar taxa de rateio e Lucro Líquido Real
DROP VIEW IF EXISTS vw_custo_produto;
CREATE VIEW vw_custo_produto AS
SELECT
  p.id AS produto_id,
  p.loja_id,
  p.nome,
  p.preco AS preco_venda,
  COALESCE(SUM(ft.quantidade_consumida * (i.preco_embalagem / NULLIF(i.qtd_embalagem,0))), 0) AS custo_insumos,
  
  -- Rateio = (Total Fixo Mensal / Expectativa de Vendas)
  COALESCE(
    (SELECT (custo_aluguel + custo_energia + custo_agua + custo_internet + custo_gas + outros_custos_fixos) / NULLIF(expectativa_vendas_mes, 0)
     FROM configuracoes_custo cc WHERE cc.loja_id = p.loja_id), 0
  ) AS taxa_rateio,
  
  p.preco - COALESCE(SUM(ft.quantidade_consumida * (i.preco_embalagem / NULLIF(i.qtd_embalagem,0))), 0) AS lucro_bruto,
  
  -- Lucro Líquido Real = Preço - Custo Insumos - Rateio
  (p.preco - COALESCE(SUM(ft.quantidade_consumida * (i.preco_embalagem / NULLIF(i.qtd_embalagem,0))), 0)) - 
  COALESCE(
    (SELECT (custo_aluguel + custo_energia + custo_agua + custo_internet + custo_gas + outros_custos_fixos) / NULLIF(expectativa_vendas_mes, 0)
     FROM configuracoes_custo cc WHERE cc.loja_id = p.loja_id), 0
  ) AS lucro_liquido,

  CASE WHEN p.preco > 0 THEN
    ROUND(100 * (p.preco - COALESCE(SUM(ft.quantidade_consumida * (i.preco_embalagem / NULLIF(i.qtd_embalagem,0))), 0)) / p.preco, 1)
  END AS margem_pct
FROM produtos p
LEFT JOIN fichas_tecnicas ft ON ft.produto_id = p.id
LEFT JOIN insumos i ON i.id = ft.insumo_id
GROUP BY p.id;
