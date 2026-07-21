-- ============================================================================
-- LEDGER FINANCEIRO DE DUPLA ENTRADA & ATOMICIDADE
-- ============================================================================

-- 1. Tabela de Sequência de Pedidos (Prevenção de Race Condition)
CREATE TABLE IF NOT EXISTS public.pedido_sequencia (
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  ultimo_numero INTEGER DEFAULT 0,
  PRIMARY KEY (loja_id, data)
);

CREATE OR REPLACE FUNCTION public.fn_numero_pedido() RETURNS TRIGGER AS $$
BEGIN
  LOOP
    -- Atualização atômica
    UPDATE public.pedido_sequencia
    SET ultimo_numero = ultimo_numero + 1
    WHERE loja_id = NEW.loja_id AND data = CURRENT_DATE
    RETURNING ultimo_numero INTO NEW.numero;

    IF FOUND THEN
      RETURN NEW;
    END IF;

    -- Tratamento de concorrência na criação do primeiro registro do dia
    BEGIN
      INSERT INTO public.pedido_sequencia (loja_id, data, ultimo_numero)
      VALUES (NEW.loja_id, CURRENT_DATE, 1)
      RETURNING ultimo_numero INTO NEW.numero;
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;
END; $$ LANGUAGE plpgsql;

-- 2. Plano de Contas e Ledger Financeiro
CREATE TABLE IF NOT EXISTS public.contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ATIVO', 'PASSIVO', 'RECEITA', 'CUSTO', 'RESULTADO')),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(codigo, loja_id)
);

CREATE TABLE IF NOT EXISTS public.lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  historico TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  conta_debitada UUID NOT NULL REFERENCES public.contas(id),
  conta_creditada UUID NOT NULL REFERENCES public.contas(id),
  referencia_tipo TEXT NOT NULL CHECK (referencia_tipo IN ('PEDIDO', 'PAGAMENTO', 'ESTORNO', 'CASHBACK', 'TAXA_IFOOD')),
  referencia_id UUID,
  criado_em TIMESTAMPTZ DEFAULT now(),
  CHECK (conta_debitada != conta_creditada)
  -- Nota de Senioridade: Uma constraint com subqueries (chk_dupla_entrada) não é suportada nativamente no PostgreSQL para a instrução CHECK. 
  -- No entanto, como o design determina que cada linha possui UMA conta debitada, UMA creditada e UM valor, 
  -- o balanceamento (Soma Débitos = Soma Créditos) é MATEMATICAMENTE GARANTIDO por definição em nível de linha, tornando a subquery redundante.
);

-- Popular contas padrão para lojas novas e existentes
CREATE OR REPLACE FUNCTION public.fn_criar_contas_padrao() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.contas (codigo, nome, tipo, loja_id) VALUES
    ('1.1.01', 'Caixa', 'ATIVO', NEW.id),
    ('1.1.02', 'Banco Efí', 'ATIVO', NEW.id),
    ('2.1.01', 'Fornecedores', 'PASSIVO', NEW.id),
    ('3.1.01', 'Receita Vendas', 'RECEITA', NEW.id),
    ('3.1.02', 'Receita iFood', 'RECEITA', NEW.id),
    ('4.1.01', 'Custo Mercadoria Vendida', 'CUSTO', NEW.id),
    ('4.1.02', 'Taxa iFood Retida', 'CUSTO', NEW.id),
    ('5.1.01', 'Resultado do Exercício', 'RESULTADO', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_criar_contas_padrao ON public.lojas;
CREATE TRIGGER trg_criar_contas_padrao
  AFTER INSERT ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.fn_criar_contas_padrao();

DO $$
DECLARE v_loja RECORD;
BEGIN
  FOR v_loja IN SELECT id FROM public.lojas LOOP
    INSERT INTO public.contas (codigo, nome, tipo, loja_id) VALUES
      ('1.1.01', 'Caixa', 'ATIVO', v_loja.id),
      ('1.1.02', 'Banco Efí', 'ATIVO', v_loja.id),
      ('2.1.01', 'Fornecedores', 'PASSIVO', v_loja.id),
      ('3.1.01', 'Receita Vendas', 'RECEITA', v_loja.id),
      ('3.1.02', 'Receita iFood', 'RECEITA', v_loja.id),
      ('4.1.01', 'Custo Mercadoria Vendida', 'CUSTO', v_loja.id),
      ('4.1.02', 'Taxa iFood Retida', 'CUSTO', v_loja.id),
      ('5.1.01', 'Resultado do Exercício', 'RESULTADO', v_loja.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 3. Baixa de Estoque sem Vulnerabilidade (Verificação Imperativa e Rollback)
CREATE OR REPLACE FUNCTION public.fn_baixar_estoque(p_pedido_id UUID) RETURNS void AS $$
DECLARE
  v_loja UUID;
  r RECORD;
  v_novo_estoque NUMERIC;
BEGIN
  SELECT loja_id INTO v_loja FROM public.pedidos WHERE id = p_pedido_id AND NOT estoque_baixado;
  IF v_loja IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT ft.insumo_id, SUM(ft.quantidade_consumida * ip.quantidade) AS qtd
    FROM public.itens_pedido ip
    JOIN public.produtos p ON p.id = ip.produto_id AND p.controla_estoque
    JOIN public.fichas_tecnicas ft ON ft.produto_id = p.id
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY ft.insumo_id
  LOOP
    UPDATE public.insumos SET quantidade_atual = quantidade_atual - r.qtd
    WHERE id = r.insumo_id AND quantidade_atual >= r.qtd
    RETURNING quantidade_atual INTO v_novo_estoque;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estoque insuficiente para insumo % (necessário %)', r.insumo_id, r.qtd;
    END IF;

    INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática por pedido', p_pedido_id);
  END LOOP;

  FOR r IN
    SELECT o.insumo_id, SUM(COALESCE(o.quantidade_insumo,1) * ip.quantidade) AS qtd
    FROM public.itens_pedido ip
    JOIN public.itens_pedido_opcoes ipo ON ipo.item_id = ip.id
    JOIN public.opcoes o ON o.id = ipo.opcao_id AND o.insumo_id IS NOT NULL
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY o.insumo_id
  LOOP
    UPDATE public.insumos SET quantidade_atual = quantidade_atual - r.qtd
    WHERE id = r.insumo_id AND quantidade_atual >= r.qtd
    RETURNING quantidade_atual INTO v_novo_estoque;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estoque insuficiente (adicionais) para insumo % (necessário %)', r.insumo_id, r.qtd;
    END IF;

    INSERT INTO public.movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática (extras)', p_pedido_id);
  END LOOP;

  UPDATE public.pedidos SET estoque_baixado = true WHERE id = p_pedido_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Trigger do Ledger Financeiro pós-estoque
CREATE OR REPLACE FUNCTION public.fn_lancar_custo_estoque() RETURNS TRIGGER AS $$
DECLARE
  v_conta_estoque UUID;
  v_conta_cmv UUID;
BEGIN
  SELECT id INTO v_conta_estoque FROM public.contas WHERE codigo = '1.1.01' AND loja_id = NEW.loja_id LIMIT 1;
  SELECT id INTO v_conta_cmv FROM public.contas WHERE codigo = '4.1.01' AND loja_id = NEW.loja_id LIMIT 1;

  IF v_conta_estoque IS NOT NULL AND v_conta_cmv IS NOT NULL THEN
    INSERT INTO public.lancamentos_financeiros (
      loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id
    )
    SELECT
      NEW.loja_id,
      'Baixa de estoque por pedido ' || NEW.pedido_id,
      SUM(ip.quantidade * custo_unitario.insumo),
      v_conta_cmv,
      v_conta_estoque,
      'PEDIDO',
      NEW.pedido_id
    FROM public.itens_pedido ip
    JOIN public.produtos p ON p.id = ip.produto_id
    JOIN (
      SELECT ft.produto_id, SUM(ft.quantidade_consumida * (i.preco_embalagem / NULLIF(i.qtd_embalagem, 0))) AS insumo
      FROM public.fichas_tecnicas ft
      JOIN public.insumos i ON i.id = ft.insumo_id
      WHERE i.loja_id = NEW.loja_id
      GROUP BY ft.produto_id
    ) custo_unitario ON custo_unitario.produto_id = p.id
    WHERE ip.pedido_id = NEW.pedido_id
    GROUP BY ip.pedido_id
    HAVING SUM(ip.quantidade * custo_unitario.insumo) > 0;
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lancar_custo_estoque ON public.movimentacoes_estoque;
CREATE TRIGGER trg_lancar_custo_estoque
  AFTER INSERT ON public.movimentacoes_estoque
  FOR EACH ROW
  WHEN (NEW.tipo = 'BAIXA_VENDA' AND NEW.pedido_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_lancar_custo_estoque();

-- 5. View de Lucro
CREATE OR REPLACE VIEW public.vw_lucro_real_produto AS
SELECT
  p.id AS produto_id,
  p.nome,
  p.preco AS preco_venda,
  COALESCE(SUM(lf.valor) FILTER (WHERE c.nome = 'Custo Mercadoria Vendida'), 0) AS custo_real,
  COALESCE(SUM(lf.valor) FILTER (WHERE c.nome IN ('Receita Vendas', 'Receita iFood')), 0) AS receita_real,
  COALESCE(SUM(lf.valor) FILTER (WHERE c.nome = 'Resultado do Exercício'), 0) AS resultado_exercicio,
  (COALESCE(SUM(lf.valor) FILTER (WHERE c.nome IN ('Receita Vendas', 'Receita iFood')), 0) - COALESCE(SUM(lf.valor) FILTER (WHERE c.nome = 'Custo Mercadoria Vendida'), 0)) AS lucro_real,
  CASE WHEN COALESCE(SUM(lf.valor) FILTER (WHERE c.nome IN ('Receita Vendas', 'Receita iFood')), 0) > 0 THEN
    ROUND(100 * (COALESCE(SUM(lf.valor) FILTER (WHERE c.nome IN ('Receita Vendas', 'Receita iFood')), 0) - COALESCE(SUM(lf.valor) FILTER (WHERE c.nome = 'Custo Mercadoria Vendida'), 0)) / COALESCE(SUM(lf.valor) FILTER (WHERE c.nome IN ('Receita Vendas', 'Receita iFood')), 0), 2)
  END AS margem_pct
FROM public.produtos p
LEFT JOIN public.lancamentos_financeiros lf ON lf.referencia_id = p.id AND lf.referencia_tipo = 'PEDIDO'
LEFT JOIN public.contas c ON c.id = lf.conta_debitada OR c.id = lf.conta_creditada
GROUP BY p.id, p.nome, p.preco;
