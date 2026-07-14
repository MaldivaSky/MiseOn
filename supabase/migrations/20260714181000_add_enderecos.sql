-- Tabela para múltiplos endereços do cliente
CREATE TABLE enderecos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  cep TEXT NOT NULL,
  logradouro TEXT NOT NULL,
  numero TEXT,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf VARCHAR(2) NOT NULL,
  ponto_referencia TEXT,
  padrao BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS e Políticas para enderecos_cliente
ALTER TABLE enderecos_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_le_endereco ON enderecos_cliente FOR SELECT USING (true);
CREATE POLICY pub_cria_endereco ON enderecos_cliente FOR INSERT WITH CHECK (true);
CREATE POLICY pub_atualiza_endereco ON enderecos_cliente FOR UPDATE USING (true);
CREATE POLICY pub_deleta_endereco ON enderecos_cliente FOR DELETE USING (true);

-- Tabela para favoritos do cliente
CREATE TABLE favoritos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cliente_id, produto_id)
);

-- RLS e Políticas para favoritos_cliente
ALTER TABLE favoritos_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_le_favorito ON favoritos_cliente FOR SELECT USING (true);
CREATE POLICY pub_cria_favorito ON favoritos_cliente FOR INSERT WITH CHECK (true);
CREATE POLICY pub_deleta_favorito ON favoritos_cliente FOR DELETE USING (true);


