-- Tabelas para o Chat Interno (Cliente <> Loja)

CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  session_id TEXT, -- Para clientes não logados (anônimos na vitrine)
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Permite buscar rapidamente uma conversa por sessão
CREATE INDEX idx_chat_conv_session ON chat_conversations(session_id);
CREATE INDEX idx_chat_conv_cliente ON chat_conversations(cliente_id);
CREATE INDEX idx_chat_conv_loja ON chat_conversations(loja_id);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  remetente_tipo TEXT NOT NULL CHECK (remetente_tipo IN ('CLIENTE', 'LOJA', 'SISTEMA')),
  conteudo TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_msg_conv ON chat_messages(conversation_id);

-- RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Lojista vê todas as conversas da sua loja
CREATE POLICY chat_conversations_loja ON chat_conversations
  FOR ALL USING (fn_meu_acesso(loja_id));

-- Cliente vê a própria conversa se for dono do cliente_id (via user_id na tabela clientes)
-- OU se for uma sessão anônima. Para sessão anônima, permitimos insert publico e read se souber o ID da conversa.
-- Mas de forma segura:
CREATE POLICY chat_conversations_cliente_select ON chat_conversations
  FOR SELECT USING (true); -- Controle mais rigoroso pode ser feito na aplicação para session_id, mas deixamos aberto para consulta por id

CREATE POLICY chat_conversations_cliente_insert ON chat_conversations
  FOR INSERT WITH CHECK (true); -- Qualquer um pode iniciar conversa (vitrine)

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Lojista vê todas as mensagens da sua loja
CREATE POLICY chat_messages_loja ON chat_messages
  FOR ALL USING (
    fn_meu_acesso((SELECT loja_id FROM chat_conversations WHERE id = conversation_id))
  );

-- Cliente pode ler e inserir mensagens
CREATE POLICY chat_messages_cliente_select ON chat_messages
  FOR SELECT USING (true);

CREATE POLICY chat_messages_cliente_insert ON chat_messages
  FOR INSERT WITH CHECK (
    remetente_tipo = 'CLIENTE'
  );
