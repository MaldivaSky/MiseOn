-- ============================================================
-- MiseOn — schema_v5: disponibilidade REAL do produto, derivada
-- do estoque dos insumos da ficha técnica (não só um toggle manual)
-- ============================================================
--
-- `produtos.disponivel` continua existindo e significa "o lojista
-- quer vender isso" (86 manual, sazonal, etc). O que faltava é a
-- pergunta "dá pra FAZER esse produto com o estoque de insumos que
-- tem agora?" — isso não pode ser um campo salvo (ficaria
-- desatualizado a cada venda), tem que ser calculado na hora.
--
-- fn_produtos_com_estoque roda com SECURITY DEFINER pra poder ler
-- `insumos`/`fichas_tecnicas` mesmo vindo do cliente anônimo da
-- vitrine (que não tem policy de leitura nessas duas tabelas) —
-- mas só devolve um booleano por produto, nunca a quantidade real
-- do insumo. Reutilizada tanto pela vitrine pública quanto pelo
-- admin (mesma função, mesma regra, sem duplicar lógica).

CREATE OR REPLACE FUNCTION fn_produtos_com_estoque(p_loja_id UUID)
RETURNS TABLE(produto_id UUID, tem_estoque BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    CASE
      -- produto não controla estoque (ex: serviço, taxa) → sempre disponível
      WHEN NOT p.controla_estoque THEN true
      -- produto controla estoque mas não tem ficha técnica cadastrada ainda →
      -- não bloqueia a venda (senão todo produto novo nasceria "esgotado")
      WHEN NOT EXISTS (SELECT 1 FROM fichas_tecnicas WHERE produto_id = p.id) THEN true
      -- tem ficha técnica: só está disponível se TODOS os insumos da receita
      -- têm quantidade suficiente pra fazer pelo menos 1 unidade
      ELSE NOT EXISTS (
        SELECT 1 FROM fichas_tecnicas ft
        JOIN insumos i ON i.id = ft.insumo_id
        WHERE ft.produto_id = p.id AND i.quantidade_atual < ft.quantidade_consumida
      )
    END AS tem_estoque
  FROM produtos p
  WHERE p.loja_id = p_loja_id;
$$;

GRANT EXECUTE ON FUNCTION fn_produtos_com_estoque(UUID) TO anon, authenticated;
