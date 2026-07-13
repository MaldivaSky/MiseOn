-- ============================================================
-- MiseOn — schema_v6: conta do cliente (login Google obrigatório
-- pra pedir) + histórico de pedidos + CRM de clientes pro lojista
-- ============================================================

ALTER TABLE clientes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE clientes ADD COLUMN email TEXT;
ALTER TABLE clientes ADD COLUMN forma_pagamento_preferida metodo_pgto;
ALTER TABLE clientes ADD CONSTRAINT clientes_loja_user_unique UNIQUE (loja_id, user_id);

ALTER TABLE pedidos ADD COLUMN cliente_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- só permite gravar um pedido "em nome de" quem realmente está logado
-- (continua permitindo cliente_user_id nulo, se um dia reabrir pedido sem login)
DROP POLICY IF EXISTS pub_cria_pedido ON pedidos;
CREATE POLICY pub_cria_pedido ON pedidos
  FOR INSERT WITH CHECK (cliente_user_id IS NULL OR cliente_user_id = auth.uid());

-- cliente autenticado gerencia o próprio cadastro
CREATE POLICY cliente_seu_perfil ON clientes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- cliente autenticado lista o próprio histórico de pedidos
CREATE POLICY cliente_seus_pedidos ON pedidos
  FOR SELECT USING (cliente_user_id = auth.uid());

-- Reescreve o upsert de cliente: se o front já resolveu o cliente_id (fluxo
-- autenticado, upsert por user_id), só atualiza as estatísticas nessa linha.
-- Se não veio (fluxo antigo/anônimo), cai no upsert por telefone de sempre.
-- Também passa a valer pra QUALQUER tipo de pedido, não só DELIVERY —
-- agora todo pedido vira lead, inclusive retirada no balcão.
CREATE OR REPLACE FUNCTION fn_trg_upsert_cliente() RETURNS TRIGGER AS $$
DECLARE v_id UUID;
BEGIN
  IF NEW.telefone_contato IS NOT NULL THEN
    IF NEW.cliente_id IS NOT NULL THEN
      UPDATE clientes SET
        total_pedidos = total_pedidos + 1,
        ultimo_pedido = now(),
        nome = COALESCE(NEW.identificador_cliente, nome),
        endereco = COALESCE(NEW.endereco_entrega, endereco),
        bairro = COALESCE(NEW.bairro, bairro)
      WHERE id = NEW.cliente_id;
    ELSE
      INSERT INTO clientes (loja_id, telefone, nome, endereco, bairro, total_pedidos, ultimo_pedido)
      VALUES (NEW.loja_id, NEW.telefone_contato, NEW.identificador_cliente, NEW.endereco_entrega, NEW.bairro, 1, now())
      ON CONFLICT (loja_id, telefone) DO UPDATE
        SET total_pedidos = clientes.total_pedidos + 1,
            ultimo_pedido = now(),
            nome = EXCLUDED.nome,
            endereco = COALESCE(EXCLUDED.endereco, clientes.endereco),
            bairro   = COALESCE(EXCLUDED.bairro, clientes.bairro)
      RETURNING id INTO v_id;
      NEW.cliente_id = v_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
