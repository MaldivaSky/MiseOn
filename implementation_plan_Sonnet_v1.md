# MiseOn — Plano de Implementação: Seed Demo + OS de Preparos + Frentes de Acesso

## Diagnóstico da Auditoria (o que existe hoje)

### ✅ Frentes já implementadas e funcionais

| Frente | Rota | Status |
|--------|------|--------|
| **SuperAdmin** | `/superadmin` | ✅ Tenants, Onboarding, Churn, Auditoria |
| **Admin** | `/admin` | ✅ Pedidos, Cardápio, Estoque, Compras, Entregas, Financeiro, Marketing, Equipe, Assinatura |
| **Operador (KDS)** | `/admin` (papel=operador) | ✅ Só vê Pedidos + Entregas via `papel` no `AdminLayout` |
| **Entregador** | `/entregador` | ✅ Login, Dashboard, Rota com GPS + Chat |
| **Cliente (vitrine)** | `/:slug` | ✅ Cardápio, Carrinho, Checkout |
| **Cliente (pedido)** | `/pedido/:id` | ✅ Acompanhamento com Live Tracking |
| **Cliente (histórico)** | `/:slug/meus-pedidos` | ✅ Requer Google OAuth |

### ✅ Módulo de Preparos (Receitas Internas) — já existe!
- `EstoquePreparos.tsx` — cadastro de receita base com ficha técnica de insumos brutos
- Botão **"Panela no Fogo!"** — produz N lotes, debita ingredientes, credita o preparo no estoque
- **O que falta:** Ordem de Serviço (OS) impressa/exibida para o operador da cozinha
- **O que falta:** Integração do Preparo na Fila de Pedidos (quando um produto que contém Molho Vermelho é pedido, o KDS precisa mostrar que a cozinha deve usar o molho — e se o molho estiver em falta, alertar)

### ❌ Gaps identificados

| Gap | Impacto | Prioridade |
|-----|---------|------------|
| **OS (Ordem de Serviço) de Preparo** — não existe tela/impressão | Operador não recebe ordem para fazer o molho | 🔴 Alta |
| **KDS ≠ OS** — o KDS atual mostra pedidos de venda; falta a fila de produção interna | Cozinha não sabe que precisa repor o molho | 🔴 Alta |
| **Cliente com conta multi-loja** — `MeusPedidos` usa Google OAuth mas a seed não tem usuário cliente | Demo não mostra histórico do cliente | 🟡 Média |
| **`cliente_user_id` em pedidos** — coluna existe no type mas não está sendo preenchida ao criar pedido via Cardápio.tsx (cliente logado) | Histórico de pedidos não aparece em `MeusPedidos` | 🟡 Média |
| **Políticas RLS de entregadores** — estão usando `auth.uid() IN (SELECT id FROM lojas...)` que está incorreto (compara UUID de user com UUID de loja) | App do entregador pode não autenticar corretamente | 🔴 Alta |
| **Seed sem usuários Auth** — não há como criar usuários Supabase Auth via SQL puro (exige API Admin) | Demo precisa de usuários pré-criados via dashboard ou script | 🟡 Média |

---

## O que será implementado neste plano

### Módulo 1 — Correção RLS das Políticas de Entregadores
As policies atuais fazem `auth.uid() IN (SELECT id FROM lojas)` — **errado**, `id` é UUID da loja, não do usuário. Corrigir para usar `fn_meu_acesso()` ou `usuarios_loja`.

### Módulo 2 — OS (Ordem de Serviço) de Preparos
Tela **KDS de Produção** — uma visão separada do admin que mostra:
- Fila de ordens de produção pendentes (geradas automaticamente quando o estoque de um preparo cai abaixo do mínimo)
- Cada OS detalha: receita, quantidade a produzir, ingredientes necessários, se há insumos suficientes
- Operador confirma produção → sistema executa `produzir()` → estoque atualizado
- Impressão da OS em formato térmico (via `window.print()`)

### Módulo 3 — Seed Demo "Lanche do Paulista"
Novo tenant de demonstração, sem tocar a Natureba:
- Slug: `lanchepaulista`
- Cardápio realista: X-Burguer, Combos, Batatas, Bebidas
- Preparos internos: Molho da Casa, Hambúrguer Blend artesanal
- Pedidos em todos os status
- 3 entregadores (um com email para testar App)
- Configurações de custo completas

### Módulo 4 — Script de criação de usuários Auth (Node.js)
Como o Supabase não permite criar usuários Auth via SQL puro, criar um script `scripts/create-demo-users.js` com o Supabase Admin SDK que cria:

| Usuário | Email | Senha | Papel |
|---------|-------|-------|-------|
| Admin Lanche do Paulista | `admin@lanchepaulista.com` | `Demo@2026!` | admin |
| Operador (Cozinha) | `cozinha@lanchepaulista.com` | `Demo@2026!` | operador |
| Entregador Carlos | `carlos@lanchepaulista.com` | `Demo@2026!` | entregador |
| Cliente Demo | `cliente@demo.com` | `Demo@2026!` | cliente (sem papel no admin) |

### Módulo 5 — Vincular `cliente_user_id` ao criar pedido
Quando o cliente está logado com Google OAuth, preencher `cliente_user_id` no pedido em `Cardapio.tsx`. Isso permite que `MeusPedidos` mostre o histórico corretamente.

---

## Arquitetura das Frentes — Como o sistema reage diferente para cada ator

```
┌─────────────────────────────────────────────────────────────────┐
│                        MISEON ECOSYSTEM                         │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   CLIENTE    │    COZINHA   │  ENTREGADOR  │       ADMIN        │
│  /:slug      │ /admin       │ /entregador  │  /admin            │
│              │ (operador)   │              │  (admin)           │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│ Vitrine      │ KDS Pedidos  │ Login seguro │ KDS + todos módulos│
│ Carrinho     │ KDS Produção │ Dashboard    │ Estoque + Compras  │
│ Checkout     │ (OS de       │ (métricas)   │ Financeiro         │
│ /pedido/:id  │  Preparos)   │ Rota ativa   │ Marketing          │
│ Live Track   │ Aceitar/     │ GPS sharing  │ Equipe             │
│ Meus Pedidos │ Marcar Pronto│ Chat cliente │ Live Tracking      │
│ (Google Auth)│              │ Marcar entg. │ Despacho de rotas  │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

### Fluxo do Molho Vermelho (Ordem de Serviço)
```
1. Cozinheiro cadastra Preparo "Molho da Casa" com ficha técnica
   (Tomate 2kg + Alho 50g + Azeite 100ml → rende 1,5L de molho)

2. Produto "Espaguete à Bolonhesa" tem em sua ficha técnica:
   - Molho da Casa: 200ml  ← usa o PREPARO como insumo
   - Massa 200g
   - Embalagem 1 un

3. Cliente faz pedido do Espaguete

4. KDS mostra o pedido para a cozinha ← IGUAL A HOJE

5. [NOVO] KDS de Produção verifica:
   - Molho da Casa: estoque 300ml, consumo do pedido 200ml → OK
   - Se estoque < mínimo configurado → GERA OS automaticamente:
     "⚠️ OS #42 — Produzir Molho da Casa | Rende 1,5L | 3 pedidos aguardando"

6. Operador executa a OS → confirma quantidade de lotes → sistema
   debita insumos, credita o molho no estoque → OS fechada

7. O pedido segue normalmente: massa + molho retirado do estoque
   quando o status vai para ACEITO (baixa automática pela ficha técnica)
```

---

## Gaps de RLS para corrigir antes da seed

O trecho atual da migração está **incorreto**:
```sql
-- ❌ ERRADO: compara user_id (auth) com id da loja
USING (auth.uid() IN (SELECT id FROM public.lojas WHERE id = loja_id));

-- ✅ CORRETO: verificar se o user está em usuarios_loja
USING (fn_meu_acesso(loja_id));
```

---

## Plano de Execução

### 1. `chore(db/rls)` — Corrigir políticas de entregadores e rotas
- Migração nova: `20260714210000_fix_rls_logistics.sql`

### 2. `feat(admin/kds-producao)` — Tela de Ordem de Serviço
- Novo: `src/pages/admin/KDSProducao.tsx`
- Rota nova: `/admin/producao` (visível para admin e operador)
- AdminLayout: adicionar ícone de Fila de Produção no nav

### 3. `feat(db/seed)` — seed_lanchepaulista.sql
- Novo tenant completo sem tocar Natureba
- 8 produtos, 2 preparos, pedidos em todos os status

### 4. `feat(scripts)` — scripts/create-demo-users.js
- Script Node.js com @supabase/supabase-js (Admin API)
- Cria 4 usuários + vincula à loja + entregador

### 5. `fix(cardapio)` — preencher cliente_user_id ao criar pedido
- Se `user` logado → inclui `cliente_user_id: user.id` no INSERT do pedido

---

## Perguntas em Aberto

> [!IMPORTANT]
> **KDS de Produção:** A OS deve ser gerada **automaticamente quando o estoque cai abaixo do mínimo**, ou apenas **manualmente pelo admin/operador**? Para demo, recomendo automático ao aceitar pedido + botão manual.

> [!IMPORTANT]
> **Impressão de OS:** Usar `window.print()` com CSS de impressão térmica (58mm) é suficiente para a demo, ou já quer integrar com impressora física via ESC/POS? Para demo, `window.print()` resolve.

---

## Hierarquia de Documentos Impressos (Comandas)

O sistema emite **4 tipos de documentos**, cada um com audiência e gatilho diferentes.
**Nunca devem se confundir.** São processos independentes.

```
╔══════════════════════════════════════════════════════════════════╗
║              HIERARQUIA DE DOCUMENTOS — MiseOn                  ║
╠══════╦═══════════════════╦══════════════════╦════════════════════╣
║  #   ║    Documento      ║    Emitido em    ║    Para quem       ║
╠══════╬═══════════════════╬══════════════════╬════════════════════╣
║  1   ║ Comanda da        ║ Pedido → ACEITO  ║ Cozinha (KDS ou    ║
║      ║ Cozinha           ║                  ║ impressora térmica)║
╠══════╬═══════════════════╬══════════════════╬════════════════════╣
║  2   ║ OS de Produção    ║ Estoque de       ║ Cozinheiro         ║
║      ║ (Preparo Interno) ║ Preparo < mínimo ║ responsável pela   ║
║      ║                   ║ (auto ou manual) ║ receita base       ║
╠══════╬═══════════════════╬══════════════════╬════════════════════╣
║  3   ║ Via do Entregador ║ Pedido → PRONTO  ║ Motoboy / Entregador║
║      ║ (Romaneio)        ║                  ║ (endereço, troco,  ║
║      ║                   ║                  ║ itens resumidos)   ║
╠══════╬═══════════════════╬══════════════════╬════════════════════╣
║  4   ║ Cupom Fiscal /    ║ Pedido →         ║ Cliente final      ║
║      ║ Recibo do Cliente ║ FINALIZADO       ║ (resumo do pedido, ║
║      ║                   ║ (sob demanda)    ║ valor pago)        ║
╚══════╩═══════════════════╩══════════════════╩════════════════════╝
```

### Detalhamento por documento

#### 📋 1. Comanda da Cozinha
- **Gatilho:** Admin/Operador clica em "Aceitar" no KDS (status `NOVO → ACEITO`)
- **Conteúdo:** Número do pedido, itens com observações, hora, tipo (Delivery/Salão/Retirada)
- **NÃO contém:** Valor, forma de pagamento, endereço do cliente
- **Formato:** 80mm ou tela KDS — foco em legibilidade rápida

#### 🍳 2. OS de Produção (Ordem de Serviço Interna)
- **Gatilho:** Estoque de um Preparo cai abaixo do mínimo (automático), ou operador clica manualmente em "Gerar OS"
- **Conteúdo:** Nome do preparo, quantidade a produzir (em lotes), ingredientes necessários + quantidades, indicador de insumos OK ✅ ou insuficientes ❌
- **NÃO contém:** Nenhuma informação de pedido de cliente
- **Separação crítica:** Este documento nunca deve aparecer misturado com as comandas de cliente na cozinha
- **Formato:** Cabeçalho vermelho/laranja para diferenciar visualmente da Comanda

#### 🛵 3. Via do Entregador (Romaneio de Entrega)
- **Gatilho:** Pedido vai para `PRONTO` (pronto para despachar) — impresso antes de o motoboy sair
- **Conteúdo:** Nome/telefone do cliente, endereço completo + ponto de referência, itens resumidos, valor total, forma de pagamento e troco necessário
- **NÃO contém:** Custo interno, ficha técnica
- **Formato:** 58mm (cabe no bolso do motoboy)

#### 🧾 4. Recibo do Cliente
- **Gatilho:** Sob demanda pelo admin após `FINALIZADO` (opcional)
- **Conteúdo:** Logo da loja, pedido completo com preços, total, desconto, forma de pagamento, data/hora
- **Formato:** A4 ou 80mm — depende do tipo de estabelecimento

> [!NOTE]
> **Cliente multi-loja:** O `MeusPedidos` já existe e funciona com Google OAuth. Para o demo, o cliente que comprou na Natureba E no Lanche do Paulista precisa de uma conta Google real, ou prefere email/senha via Supabase Auth?
