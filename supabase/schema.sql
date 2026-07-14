-- ============================================================
-- MiseOn — Schema Multi-Tenant (PostgreSQL / Supabase)
-- Cardápio digital + Pedidos + Estoque por Ficha Técnica
-- Padrões herdados: mercadinhosys (multi-tenant, ledger de
-- estoque, módulo de entrega) + mise (motor de custo)
-- ============================================================

-- ── ENUMS ───────────────────────────────────────────────────
CREATE TYPE tipo_pedido    AS ENUM ('DELIVERY', 'SALAO', 'RETIRADA_BALCAO');
CREATE TYPE status_pedido  AS ENUM ('NOVO', 'ACEITO', 'PREPARANDO', 'PRONTO', 'EM_ROTA', 'FINALIZADO', 'CANCELADO');
CREATE TYPE metodo_pgto    AS ENUM ('PIX', 'CREDITO', 'DEBITO', 'DINHEIRO');
CREATE TYPE status_pgto    AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO', 'ESTORNADO');
CREATE TYPE tipo_desconto  AS ENUM ('PERCENTUAL', 'FIXO');
CREATE TYPE tipo_mov_estoque AS ENUM ('ENTRADA', 'BAIXA_VENDA', 'AJUSTE', 'PERDA');

-- ── TENANT ──────────────────────────────────────────────────
CREATE TABLE lojas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,             -- ex: natureba-lanches
  nome            TEXT NOT NULL,
  descricao       TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  cor_primaria    TEXT DEFAULT '#16a34a',
  cor_secundaria  TEXT DEFAULT '#f97316',
  telefone        TEXT,
  whatsapp        TEXT NOT NULL,                    -- destino dos pedidos (wa.me)
  endereco        TEXT,
  pedido_minimo   NUMERIC(10,2) DEFAULT 0,
  aceita_agendamento BOOLEAN DEFAULT false,
  aberto_manual   BOOLEAN,                          -- override do horário (null = automático)
  pix_chave       TEXT,                             -- Pix estático (MVP)
  efi_payee_code  TEXT,                             -- identificador de conta Efí (cartão online)
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT now()
);

-- Usuários (Supabase Auth) vinculados a lojas — dono, esposa, etc.
CREATE TABLE usuarios_loja (
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  loja_id   UUID REFERENCES lojas(id) ON DELETE CASCADE,
  papel     TEXT DEFAULT 'admin',                   -- admin | operador | entregador
  PRIMARY KEY (user_id, loja_id)
);

CREATE TABLE horarios_funcionamento (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id   UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),  -- 0=domingo
  abre      TIME NOT NULL,
  fecha     TIME NOT NULL,
  UNIQUE (loja_id, dia_semana, abre)
);

-- ── VITRINE ─────────────────────────────────────────────────
CREATE TABLE banners_destaque (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id        UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  imagem_url     TEXT NOT NULL,
  titulo         TEXT,
  link_redirecionamento TEXT,                       -- /produto/:id ou /categoria/:id
  ordem_exibicao INT DEFAULT 0,
  is_ativo       BOOLEAN DEFAULT true
);

CREATE TABLE categorias (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id   UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  ordem     INT DEFAULT 0,
  ativo     BOOLEAN DEFAULT true
);

CREATE TABLE produtos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id      UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  nome         TEXT NOT NULL,
  descricao    TEXT,
  preco        NUMERIC(10,2) NOT NULL,
  imagem_url   TEXT,
  is_combo     BOOLEAN DEFAULT false,
  destaque     BOOLEAN DEFAULT false,
  disponivel   BOOLEAN DEFAULT true,                -- acabou? some da vitrine
  controla_estoque BOOLEAN DEFAULT true,            -- baixa via ficha técnica
  ordem        INT DEFAULT 0,
  vendidos     INT DEFAULT 0,                       -- alimenta "Os mais pedidos"
  criado_em    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_produtos_loja ON produtos (loja_id, disponivel);

-- Adicionais/extras (as baguetes têm "acompanhamentos extras")
CREATE TABLE grupos_opcoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id  UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,                        -- ex: "Extras", "Bebida do combo", "Molho"
  min_escolhas INT DEFAULT 0,
  max_escolhas INT DEFAULT 1,
  ordem       INT DEFAULT 0
);

CREATE TABLE opcoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id    UUID NOT NULL REFERENCES grupos_opcoes(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,                        -- ex: "Cebola roxa", "Coca 350ml"
  preco_adicional NUMERIC(10,2) DEFAULT 0,
  insumo_id   UUID,                                 -- FK adicionada após insumos
  quantidade_insumo NUMERIC(12,4),                  -- consumo do insumo ao escolher
  disponivel  BOOLEAN DEFAULT true,
  ordem       INT DEFAULT 0
);

-- ── ESTOQUE / FICHA TÉCNICA (motor do mise) ─────────────────
CREATE TABLE insumos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id          UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  unidade_medida   TEXT NOT NULL DEFAULT 'un',      -- un, g, kg, ml, l
  quantidade_atual NUMERIC(12,4) DEFAULT 0,         -- cache; fonte de verdade = ledger
  estoque_minimo   NUMERIC(12,4) DEFAULT 0,
  -- custo: como comprou (rateio embalagem × uso, padrão mise)
  preco_embalagem  NUMERIC(10,2) DEFAULT 0,
  qtd_embalagem    NUMERIC(12,4) DEFAULT 1,         -- ex: pacote 500g → 500 (na unidade_medida)
  ativo            BOOLEAN DEFAULT true,
  criado_em        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_insumos_loja ON insumos (loja_id);

ALTER TABLE opcoes ADD CONSTRAINT fk_opcao_insumo
  FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE SET NULL;

CREATE TABLE fichas_tecnicas (
  produto_id  UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  insumo_id   UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  quantidade_consumida NUMERIC(12,4) NOT NULL,      -- na unidade_medida do insumo
  PRIMARY KEY (produto_id, insumo_id)
);

-- Ledger auditável (padrão MovimentacaoEstoque do mercadinhosys)
CREATE TABLE movimentacoes_estoque (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  insumo_id   UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  tipo        tipo_mov_estoque NOT NULL,
  quantidade  NUMERIC(12,4) NOT NULL,               -- positivo entra, negativo sai
  custo_total NUMERIC(10,2),                        -- em ENTRADA: valor da compra
  motivo      TEXT,
  pedido_id   UUID,                                 -- FK adicionada após pedidos
  criado_em   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_mov_estoque ON movimentacoes_estoque (loja_id, insumo_id, criado_em DESC);

-- ── CLIENTES / CUPONS / TAXAS ───────────────────────────────
CREATE TABLE clientes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id    UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  telefone   TEXT NOT NULL,
  nome       TEXT,
  endereco   TEXT,
  bairro     TEXT,
  total_pedidos INT DEFAULT 0,
  ultimo_pedido TIMESTAMPTZ,
  criado_em  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (loja_id, telefone)
);

CREATE TABLE cupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id         UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,
  descricao       TEXT,
  tipo            tipo_desconto NOT NULL DEFAULT 'FIXO',
  valor           NUMERIC(10,2) NOT NULL,
  pedido_minimo   NUMERIC(10,2) DEFAULT 0,
  apenas_primeiro_pedido BOOLEAN DEFAULT false,     -- "PRIMEIRA COMPRA!!!"
  metodo_exigido  metodo_pgto,                      -- ex: só no PIX
  validade        DATE,
  limite_usos     INT,
  usos            INT DEFAULT 0,
  ativo           BOOLEAN DEFAULT true,
  UNIQUE (loja_id, codigo)
);

CREATE TABLE taxas_entrega (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id   UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  bairro    TEXT NOT NULL,
  valor     NUMERIC(10,2) NOT NULL,
  ativo     BOOLEAN DEFAULT true,
  UNIQUE (loja_id, bairro)
);

-- ── PEDIDOS ─────────────────────────────────────────────────
CREATE TABLE pedidos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id       UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  numero        INT NOT NULL,                       -- sequencial diário por loja
  tipo_pedido   tipo_pedido NOT NULL DEFAULT 'DELIVERY',
  status        status_pedido NOT NULL DEFAULT 'NOVO',
  -- snapshot do cliente (não depende da tabela clientes)
  cliente_id    UUID REFERENCES clientes(id) ON DELETE SET NULL,
  identificador_cliente TEXT NOT NULL,              -- "Rafael" ou "Mesa 04"
  telefone_contato TEXT,
  endereco_entrega TEXT,
  bairro        TEXT,
  -- valores
  subtotal      NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_entrega  NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto      NUMERIC(10,2) NOT NULL DEFAULT 0,
  cupom_id      UUID REFERENCES cupons(id) ON DELETE SET NULL,
  valor_total   NUMERIC(10,2) NOT NULL DEFAULT 0,
  troco_para    NUMERIC(10,2),                      -- pagamento em dinheiro
  observacao    TEXT,
  agendado_para TIMESTAMPTZ,
  origem        TEXT DEFAULT 'link',                -- link | balcao | whatsapp
  motivo_cancelamento TEXT,
  estoque_baixado BOOLEAN DEFAULT false,
  criado_em     TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pedidos_loja_status ON pedidos (loja_id, status, criado_em DESC);

ALTER TABLE movimentacoes_estoque ADD CONSTRAINT fk_mov_pedido
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;

CREATE TABLE itens_pedido (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id   UUID REFERENCES produtos(id) ON DELETE SET NULL,
  nome_produto TEXT NOT NULL,                       -- snapshot
  preco_unitario NUMERIC(10,2) NOT NULL,            -- snapshot (nunca o preço atual!)
  quantidade   INT NOT NULL CHECK (quantidade > 0),
  observacao   TEXT                                 -- "Sem cebola"
);

CREATE TABLE itens_pedido_opcoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES itens_pedido(id) ON DELETE CASCADE,
  opcao_id     UUID REFERENCES opcoes(id) ON DELETE SET NULL,
  nome_opcao   TEXT NOT NULL,                       -- snapshot
  preco_adicional NUMERIC(10,2) NOT NULL DEFAULT 0  -- snapshot
);

-- Pagamento separado do pedido (permite Pix + dinheiro, 2 cartões, etc.)
CREATE TABLE pagamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  metodo       metodo_pgto NOT NULL,
  status       status_pgto NOT NULL DEFAULT 'PENDENTE',
  valor_pago   NUMERIC(10,2) NOT NULL,
  gateway_txid TEXT,                                -- fase 2: Efí Pix (padrão MySuperStore)
  data_pagamento TIMESTAMPTZ
);

-- ── ENTREGA (versão enxuta do módulo do mercadinhosys) ──────
CREATE TABLE entregadores (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id   UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  telefone  TEXT,
  ativo     BOOLEAN DEFAULT true
);

CREATE TABLE entregas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id     UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  entregador_id UUID REFERENCES entregadores(id) ON DELETE SET NULL,
  saiu_em       TIMESTAMPTZ,
  entregue_em   TIMESTAMPTZ,
  obs           TEXT
);

-- ============================================================
-- FUNÇÕES / TRIGGERS
-- ============================================================

-- Número sequencial diário por loja
CREATE OR REPLACE FUNCTION fn_numero_pedido() RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
  FROM pedidos
  WHERE loja_id = NEW.loja_id AND criado_em::date = now()::date;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_numero_pedido BEFORE INSERT ON pedidos
  FOR EACH ROW WHEN (NEW.numero IS NULL OR NEW.numero = 0)
  EXECUTE FUNCTION fn_numero_pedido();

-- Baixa automática de estoque via ficha técnica
-- Dispara quando o pedido é ACEITO (uma única vez)
CREATE OR REPLACE FUNCTION fn_baixar_estoque(p_pedido_id UUID) RETURNS void AS $$
DECLARE
  v_loja UUID;
  r RECORD;
BEGIN
  SELECT loja_id INTO v_loja FROM pedidos WHERE id = p_pedido_id AND NOT estoque_baixado;
  IF v_loja IS NULL THEN RETURN; END IF;

  -- insumos da ficha técnica dos produtos
  FOR r IN
    SELECT ft.insumo_id, SUM(ft.quantidade_consumida * ip.quantidade) AS qtd
    FROM itens_pedido ip
    JOIN produtos p   ON p.id = ip.produto_id AND p.controla_estoque
    JOIN fichas_tecnicas ft ON ft.produto_id = p.id
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY ft.insumo_id
  LOOP
    UPDATE insumos SET quantidade_atual = quantidade_atual - r.qtd WHERE id = r.insumo_id;
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática por pedido', p_pedido_id);
  END LOOP;

  -- insumos consumidos por opções/extras escolhidos
  FOR r IN
    SELECT o.insumo_id, SUM(COALESCE(o.quantidade_insumo,1) * ip.quantidade) AS qtd
    FROM itens_pedido ip
    JOIN itens_pedido_opcoes ipo ON ipo.item_id = ip.id
    JOIN opcoes o ON o.id = ipo.opcao_id AND o.insumo_id IS NOT NULL
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY o.insumo_id
  LOOP
    UPDATE insumos SET quantidade_atual = quantidade_atual - r.qtd WHERE id = r.insumo_id;
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática (extras)', p_pedido_id);
  END LOOP;
  -- Removemos o UPDATE pedidos daqui para evitar conflito de tupla modificada


  -- contador "mais pedidos"
  UPDATE produtos p SET vendidos = vendidos + ip.quantidade
  FROM itens_pedido ip
  WHERE ip.pedido_id = p_pedido_id AND ip.produto_id = p.id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_trg_status_pedido() RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  IF NEW.status = 'ACEITO' AND OLD.status = 'NOVO' THEN
    PERFORM fn_baixar_estoque(NEW.id);
    NEW.estoque_baixado = true;
  END IF;
  -- estorno de estoque em cancelamento pós-aceite
  IF NEW.status = 'CANCELADO' AND OLD.estoque_baixado THEN
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    SELECT m.loja_id, m.insumo_id, 'AJUSTE', -m.quantidade, 'Estorno por cancelamento', m.pedido_id
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA';
    UPDATE insumos i SET quantidade_atual = i.quantidade_atual - m.quantidade
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA' AND i.id = m.insumo_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_status_pedido BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_trg_status_pedido();

-- Upsert de cliente a cada pedido (base p/ fidelidade e recuperador)
CREATE OR REPLACE FUNCTION fn_trg_upsert_cliente() RETURNS TRIGGER AS $$
DECLARE v_id UUID;
BEGIN
  IF NEW.telefone_contato IS NOT NULL AND NEW.tipo_pedido = 'DELIVERY' THEN
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
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_upsert_cliente BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_trg_upsert_cliente();

-- Custo por produto via ficha técnica (motor do mise)
CREATE OR REPLACE VIEW vw_custo_produto AS
SELECT
  p.id AS produto_id,
  p.loja_id,
  p.nome,
  p.preco AS preco_venda,
  COALESCE(SUM(ft.quantidade_consumida * (i.preco_embalagem / NULLIF(i.qtd_embalagem,0))), 0) AS custo_insumos,
  p.preco - COALESCE(SUM(ft.quantidade_consumida * (i.preco_embalagem / NULLIF(i.qtd_embalagem,0))), 0) AS lucro_bruto,
  CASE WHEN p.preco > 0 THEN
    ROUND(100 * (p.preco - COALESCE(SUM(ft.quantidade_consumida * (i.preco_embalagem / NULLIF(i.qtd_embalagem,0))), 0)) / p.preco, 1)
  END AS margem_pct
FROM produtos p
LEFT JOIN fichas_tecnicas ft ON ft.produto_id = p.id
LEFT JOIN insumos i ON i.id = ft.insumo_id
GROUP BY p.id;

-- Insumos abaixo do mínimo (lista de compras)
CREATE OR REPLACE VIEW vw_estoque_critico AS
SELECT * FROM insumos
WHERE ativo AND quantidade_atual <= estoque_minimo;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE lojas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_loja          ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners_destaque       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_opcoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE opcoes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas_tecnicas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_estoque  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxas_entrega          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido           ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido_opcoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregadores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas               ENABLE ROW LEVEL SECURITY;

-- helper: usuário pertence à loja?
CREATE OR REPLACE FUNCTION fn_meu_acesso(p_loja UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM usuarios_loja WHERE user_id = auth.uid() AND loja_id = p_loja);
$$ LANGUAGE sql SECURITY DEFINER;

-- Público (anon): lê a vitrine
CREATE POLICY pub_lojas      ON lojas      FOR SELECT USING (ativo);
CREATE POLICY pub_horarios   ON horarios_funcionamento FOR SELECT USING (true);
CREATE POLICY pub_banners    ON banners_destaque FOR SELECT USING (is_ativo);
CREATE POLICY pub_categorias ON categorias FOR SELECT USING (ativo);
CREATE POLICY pub_produtos   ON produtos   FOR SELECT USING (disponivel);
CREATE POLICY pub_grupos     ON grupos_opcoes FOR SELECT USING (true);
CREATE POLICY pub_opcoes     ON opcoes     FOR SELECT USING (disponivel);
CREATE POLICY pub_cupons     ON cupons     FOR SELECT USING (ativo);
CREATE POLICY pub_taxas      ON taxas_entrega FOR SELECT USING (ativo);

-- Público (anon): cria pedido
CREATE POLICY pub_cria_pedido ON pedidos            FOR INSERT WITH CHECK (true);
CREATE POLICY pub_cria_item   ON itens_pedido       FOR INSERT WITH CHECK (true);
CREATE POLICY pub_cria_opcao  ON itens_pedido_opcoes FOR INSERT WITH CHECK (true);
CREATE POLICY pub_cria_pgto   ON pagamentos         FOR INSERT WITH CHECK (true);
-- cliente acompanha o próprio pedido pelo id (uuid é o "token")
CREATE POLICY pub_le_pedido   ON pedidos FOR SELECT USING (true);
CREATE POLICY pub_le_item     ON itens_pedido FOR SELECT USING (true);
CREATE POLICY pub_le_ipo      ON itens_pedido_opcoes FOR SELECT USING (true);

-- Gestão (auth vinculado à loja): acesso total ao próprio tenant
CREATE POLICY adm_lojas    ON lojas    FOR ALL USING (fn_meu_acesso(id));
CREATE POLICY adm_usuarios ON usuarios_loja FOR SELECT USING (user_id = auth.uid());
CREATE POLICY adm_horarios ON horarios_funcionamento FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_banners  ON banners_destaque FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_cat      ON categorias FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_prod     ON produtos   FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_grupos   ON grupos_opcoes FOR ALL USING (fn_meu_acesso((SELECT loja_id FROM produtos WHERE id = produto_id)));
CREATE POLICY adm_opcoes   ON opcoes    FOR ALL USING (fn_meu_acesso((SELECT p.loja_id FROM produtos p JOIN grupos_opcoes g ON g.produto_id = p.id WHERE g.id = grupo_id)));
CREATE POLICY adm_insumos  ON insumos   FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_ft       ON fichas_tecnicas FOR ALL USING (fn_meu_acesso((SELECT loja_id FROM produtos WHERE id = produto_id)));
CREATE POLICY adm_mov      ON movimentacoes_estoque FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_cli      ON clientes  FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_cupons   ON cupons    FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_taxas    ON taxas_entrega FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_pedidos  ON pedidos   FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_itens    ON itens_pedido FOR ALL USING (fn_meu_acesso((SELECT loja_id FROM pedidos WHERE id = pedido_id)));
CREATE POLICY adm_ipo      ON itens_pedido_opcoes FOR ALL USING (true);
CREATE POLICY adm_pgto     ON pagamentos FOR ALL USING (fn_meu_acesso((SELECT loja_id FROM pedidos WHERE id = pedido_id)));
CREATE POLICY adm_entregadores ON entregadores FOR ALL USING (fn_meu_acesso(loja_id));
CREATE POLICY adm_entregas ON entregas  FOR ALL USING (fn_meu_acesso((SELECT loja_id FROM pedidos WHERE id = pedido_id)));

-- Realtime no painel de pedidos
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
