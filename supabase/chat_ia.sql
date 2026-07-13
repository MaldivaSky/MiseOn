-- ============================================================
-- MiseOn — Módulo Chat + Atendimento IA (websocket via Realtime)
-- Rodar após schema.sql
-- ============================================================

CREATE TYPE autor_msg AS ENUM ('CLIENTE', 'IA', 'LOJA');

CREATE TABLE conversas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  telefone    TEXT,                      -- se identificado
  nome        TEXT,
  pedido_id   UUID REFERENCES pedidos(id) ON DELETE SET NULL, -- pedido gerado pela conversa
  ia_ativa    BOOLEAN DEFAULT true,      -- false = humano assumiu
  encerrada   BOOLEAN DEFAULT false,
  criado_em   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mensagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  autor       autor_msg NOT NULL,
  conteudo    TEXT NOT NULL,
  metadata    JSONB,                     -- ex: carrinho montado pela IA (function calling)
  criado_em   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_msgs_conversa ON mensagens (conversa_id, criado_em);

ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

-- Anon: cria conversa e mensagens, lê a própria conversa (uuid = token)
CREATE POLICY pub_conversa_ins ON conversas FOR INSERT WITH CHECK (true);
CREATE POLICY pub_conversa_sel ON conversas FOR SELECT USING (true);
CREATE POLICY pub_msg_ins      ON mensagens FOR INSERT WITH CHECK (true);
CREATE POLICY pub_msg_sel      ON mensagens FOR SELECT USING (true);

-- Loja: gestão das conversas do próprio tenant
CREATE POLICY adm_conversas ON conversas FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_mensagens ON mensagens FOR ALL
  USING (fn_meu_acesso((SELECT loja_id FROM conversas WHERE id = conversa_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE conversas;

-- NOTA (fase 2): a resposta da IA roda numa Supabase Edge Function
-- (deno) chamando Gemini com function calling sobre o cardápio:
--   tools: listar_cardapio(loja_id), adicionar_ao_carrinho(...), fechar_pedido(...)
-- O front escuta INSERT em `mensagens` via Realtime (websocket).
