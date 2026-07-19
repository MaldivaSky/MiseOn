# MiseOn — Fluxo de Pedidos "Passa-Bastão" (Balcão ⇄ Cozinha)
**Papel deste doc:** plano de execução para agentes implementadores. Regras de negócio levantadas do código real (julho/2026).
**Owner:** CTO/PO · **Tenants de teste:** Lanche do Paulista (provas) · Natureba (demo — NÃO mexer sem autorização)

**Status (2026-07-19): E1 CONCLUÍDA.** Migrations aplicadas no Supabase via Management API
(`supabase/migrations/20260720100000_fluxo_passa_bastao.sql` +
`20260720100100_fluxo_passa_bastao_hardening.sql`): colunas novas
(`produtos.estacao_preparo`, `pedidos.estacao_atual/requer_cozinha/enviado_cozinha_em/
devolvido_balcao_em/conferido_em`, `historico_pedidos.operador_user_id`,
`lojas.meta_preparo_min`), trigger `fn_valida_transicao_pedido` (valida toda transição
de status incl. atalho de revenda e caso especial de fechamento de comanda SALAO),
trigger `fn_valida_estacao_pedido` (ação "enviar para a cozinha"), trigger
`fn_trg_promove_requer_cozinha` (calcula requer_cozinha a partir dos itens), RPCs
`fn_avancar_status_pedido`/`fn_enviar_pedido_cozinha`/`fn_metricas_cozinha`. Testado
E2E via SQL direto no Lanche do Paulista: pedido misto (balcão bloqueado de pular a
cozinha, bastão devolvido automaticamente em PRONTO, cancelamento pós-cozinha exige
admin), pedido só-revenda (nunca entra na cozinha), promoção de requer_cozinha por
item, RPC de métricas com checagem de acesso. Advisors do Supabase revisados e
hardened (search_path fixo, RPCs staff-only revogadas de `anon`). `tsc --noEmit`
limpo com os tipos novos em `src/types.ts` (`EstacaoPreparo`, `EstacaoAtual`,
campos em `Produto`/`Pedido`/`Loja`).

**E2 CONCLUÍDA.** [Cardapio.tsx](../src/pages/admin/Cardapio.tsx) (admin) ganhou toggle
"Preparo na cozinha / Revenda direta" no modal de produto, badge "REVENDA" na listagem
e ação em massa por categoria. Checkouts (`CheckoutDrawer.tsx`, `PedidoMesaDrawer.tsx`,
`PDV.tsx` nos dois fluxos) passam a inserir `requer_cozinha: false` explicitamente —
a trigger `fn_trg_promove_requer_cozinha` promove pra `true` assim que um item
COZINHA é inserido.

**E3 CONCLUÍDA.** [PainelPedidos.tsx](../src/pages/admin/PainelPedidos.tsx) reescrito
como a tela do balcão no passa-bastão: botão "🔥 Enviar para a cozinha" (RPC
`fn_enviar_pedido_cozinha`) quando ACEITO+requer_cozinha; atalho "Separar e entregar"
pro só-revenda; card "Na cozinha" vira somente-leitura (sem botão de avanço) enquanto
o bastão está com a cozinha; PRONTO com bastão no balcão vira tela de conferência
(checklist item a item, inclusive os de revenda do pedido misto, com barra de
progresso — botão de destino só habilita com tudo marcado); cancelamento pós-cozinha
exige `papel==='admin'` (ícone de cadeado). Toda mudança de status passa pela RPC
`fn_avancar_status_pedido`, que expõe o erro em PT vindo da trigger (banner no topo,
auto-limpa em 6s). Filtros novos: "Na cozinha" e "Conferir".

**E4 CONCLUÍDA.** [KDS.tsx](../src/pages/admin/KDS.tsx) filtra só `requer_cozinha=true`
e bastão em COZINHA (ou PRONTO recente, como confirmação); "NOVO" não aparece mais
(aceitar é ato do balcão); itens de revenda do pedido misto aparecem apagados
("no balcão: 2× Coca"); seletor de operador (chips de `usuarios_loja`, persistido em
`localStorage` por dispositivo) grava `operador_user_id` via `fn_avancar_status_pedido`;
barra de meta (`fn_metricas_cozinha`, refresh 60s) com cor por status; celebração não-
bloqueante ao entrar na meta do dia.

**E5 (parcial) CONCLUÍDA.** [Dashboard.tsx](../src/pages/admin/Dashboard.tsx) ganhou
card "Cozinha hoje" (média vs meta, streak client-side, top operador, link pro KDS).
[Pedido.tsx](../src/pages/Pedido.tsx) (stepper do cliente) pula a etapa "Preparando"
quando `requer_cozinha=false`. `fn_acompanhar_pedido` já expõe os campos novos
automaticamente (`to_jsonb(p)` sobre a tabela toda, sem migration extra). `npm run
build` (tsc -b + vite) verde de ponta a ponta.

**Pendente (não bloqueante):** verificação visual no browser das telas admin (Cardápio,
Painel, KDS, Dashboard) — não há credencial de teste disponível nesta sessão para logar
no admin; toda a lógica foi validada via SQL direto no banco (Lanche do Paulista) e
`tsc`/`vite build` limpos. Recomendo um passe visual real antes de considerar encerrado.

---

## 1. Diagnóstico — o que está errado hoje (evidências no código)

O status do pedido é uma cadeia única em `pedidos.status`:
`NOVO → ACEITO → PREPARANDO → PRONTO → EM_ROTA → FINALIZADO` (`src/types.ts:4`).

**Problema 1 — não existe dono do pedido (bastão).** Tanto o Painel de Pedidos
(`src/pages/admin/PainelPedidos.tsx:270` — `mudarStatus`) quanto o KDS
(`src/pages/admin/KDS.tsx:79` — `avancar`) fazem `update pedidos set status` sem
nenhuma restrição de etapa ou papel. O balcão consegue marcar FINALIZADO um pedido
que a cozinha ainda está preparando → **erro humano garantido em hora de pico**.
Não há validação de transição nem no client nem no banco (qualquer UPDATE de status
passa; a RLS só garante tenant).

**Problema 2 — tudo passa pela cozinha.** Um pedido de 2 Cocas e 1 bombom
(revenda direta, sem ficha de preparo) entra no KDS igual a um X-Bacon, congestionando
a fila da cozinha com o que não é dela. `Produto` (`src/types.ts:138`) não tem nenhum
campo que diferencie "preparo na cozinha" de "revenda direta".

**Problema 3 — cozinha sem métricas nem devolução formal.** `historico_pedidos` já
loga cada mudança de status (trigger SECURITY DEFINER, ver
`supabase/migrations/20260718141000_seguranca_fase_a_rls_faltante.sql`), mas nada é
medido, e "PRONTO" não devolve o pedido formalmente ao balcão para conferência.

---

## 2. Fluxo-alvo (visão do PO)

```
                         ┌────────────────────────────────────────────┐
 Pedido chega (NOVO)     │  BALCÃO é sempre a porta de entrada e saída │
        │                └────────────────────────────────────────────┘
        ▼
  Balcão ACEITA
        │
        ├─ SÓ revenda direta ──────────────► ACEITO ─► PRONTO (bastão fica no BALCÃO,
        │                                     nunca aparece no KDS)
        │
        └─ tem item de preparo ─► "Enviar p/ cozinha" (bastão → COZINHA)
                                        │
                          KDS: ACEITO ─► PREPARANDO ─► PRONTO
                          (balcão NÃO consegue avançar/finalizar nesse trecho)
                                        │
                          PRONTO devolve o bastão ao BALCÃO
                                        │
                     Balcão CONFERE itens (checklist: itens de preparo
                     + itens de revenda do mesmo pedido) e destina:
                        ├─ DELIVERY  → EM_ROTA → FINALIZADO
                        ├─ RETIRADA  → FINALIZADO (cliente pegou)
                        └─ MESA      → aguarda fechar conta (fluxo de comanda atual)
```

**Princípios inegociáveis:**
1. **Um dono por vez** (`estacao_atual`): só a estação dona avança o pedido. Ponto.
2. **Cozinha só vê o que é da cozinha**: pedidos com item de preparo, e no card só
   os itens de preparo (os de revenda aparecem apagados como contexto, sem ação).
3. **Conferência é etapa real**, não cortesia: é ela que junta os itens de revenda
   do pedido misto antes de entregar/despachar (a Coca esquecida é o erro nº 1).
4. **Enforcement no banco, não só na UI** — trigger valida transição + estação.
   UI esconde botão; banco rejeita o bypass.

---

## 3. Regras de negócio (RN)

| # | Regra |
|---|---|
| RN-01 | Todo produto tem `estacao_preparo`: `'COZINHA'` (default) ou `'DIRETO'` (revenda). Extensível no futuro (`'BAR'`, `'CHAPA'`) — por isso text+check, não boolean. |
| RN-02 | Pedido nasce com `requer_cozinha` calculado no banco (trigger no INSERT de `itens_pedido`... na prática: trigger AFTER INSERT statement-level em `pedidos` não vê itens; calcular via trigger em `itens_pedido` que atualiza o pai, OU RPC de criação. Ver §5.2). `requer_cozinha = existe item cujo produto é COZINHA`. Item avulso sem produto vinculado (PDV livre) conta como COZINHA por segurança. |
| RN-03 | Pedido nasce com `estacao_atual='BALCAO'`. NOVO→ACEITO é ato do balcão (ou automático no PDV, que já cria ACEITO — `src/pages/admin/PDV.tsx:221`). |
| RN-04 | Se `requer_cozinha`: ACEITO com bastão BALCAO exibe **"Enviar para a cozinha"**; a ação seta `estacao_atual='COZINHA'` e `enviado_cozinha_em=now()`. A partir daí o Painel perde os botões de avanço desse pedido (card vira "🔥 Na cozinha", somente leitura + imprimir). |
| RN-05 | Se NÃO `requer_cozinha`: balcão avança ACEITO→PRONTO direto (sem PREPARANDO). O pedido **nunca** aparece no KDS. |
| RN-06 | Com bastão COZINHA, só o KDS avança: ACEITO→PREPARANDO→PRONTO. Ao marcar PRONTO, o banco seta `estacao_atual='BALCAO'` e `devolvido_balcao_em=now()` (devolução automática do bastão — a cozinha não precisa de gesto extra). |
| RN-07 | PRONTO com bastão BALCAO = **conferência**: o card do Painel mostra checklist de TODOS os itens (preparo + revenda). Botão de destino só habilita com todos os itens marcados. Estado do checklist é local (UI), não persiste — o que persiste é `conferido_em` ao concluir. |
| RN-08 | Destinos pós-conferência (mantém a semântica atual): DELIVERY → EM_ROTA→FINALIZADO; RETIRADA_BALCAO → FINALIZADO; SALAO → permanece PRONTO até fechar conta no fluxo de mesas (comportamento atual de `PainelPedidos.tsx:42` preservado). |
| RN-09 | Cancelamento: NOVO/ACEITO com bastão BALCAO → livre (como hoje). Com bastão COZINHA ou status PREPARANDO+ → só papel `admin`, com confirmação ("a cozinha já começou"). Trigger valida. |
| RN-10 | Pedido misto no KDS: card mostra só itens COZINHA em destaque; itens DIRETO em linha apagada "no balcão: 2× Coca-Cola" (contexto, sem ação). |
| RN-11 | Métricas de cozinha (de `historico_pedidos`): fila = ACEITO→PREPARANDO, preparo = PREPARANDO→PRONTO, total cozinha = ACEITO→PRONTO. Só de pedidos `requer_cozinha=true` (senão revenda direta polui a média para baixo). |
| RN-12 | Operador da cozinha: o KDS ganha seletor "quem está na cozinha" (membros da equipe com papel `operador`/`admin`). O operador ativo é gravado em `historico_pedidos.operador_id` a cada avanço. Sem operador selecionado, avança mesmo assim com NULL (não travar a operação é mais importante que o ranking). |
| RN-13 | Compatibilidade: pedidos existentes recebem `estacao_atual='BALCAO'`, `requer_cozinha=true` (comportamento antigo). Produtos existentes ficam COZINHA (default conservador) — lojista marca revenda no Cardápio admin (com ação em massa por categoria, ex.: "Bebidas → revenda direta"). |
| RN-14 | Cliente final (`src/pages/Pedido.tsx` stepper): pedido só-revenda pula o passo "Preparando" (Recebido→Aceito→Pronto→...). Nada mais muda para o cliente. |

---

## 4. Modelo de dados (migration `20260720XXXXXX_fluxo_passa_bastao.sql`)

```sql
-- 4.1 Produto: estação de preparo
alter table produtos add column if not exists estacao_preparo text not null default 'COZINHA'
  check (estacao_preparo in ('COZINHA','DIRETO'));

-- 4.2 Pedido: bastão + carimbos do fluxo
alter table pedidos add column if not exists estacao_atual text not null default 'BALCAO'
  check (estacao_atual in ('BALCAO','COZINHA'));
alter table pedidos add column if not exists requer_cozinha boolean not null default true;
alter table pedidos add column if not exists enviado_cozinha_em timestamptz;
alter table pedidos add column if not exists devolvido_balcao_em timestamptz;
alter table pedidos add column if not exists conferido_em timestamptz;

-- 4.3 Ranking: quem avançou (historico_pedidos já existe e é escrito por trigger)
alter table historico_pedidos add column if not exists operador_id uuid references equipe(id);
```

Sem tabela nova. `agendado_para`, comandas e caixa não são tocados.

---

## 5. Backend rígido (o coração do plano)

### 5.1 Trigger de validação de transição — `fn_valida_transicao_pedido`
`BEFORE UPDATE OF status ON pedidos`. Rejeita com `raise exception` (mensagem em PT
para a UI mostrar):

| De → Para | Permitido quando |
|---|---|
| NOVO→ACEITO | sempre (balcão/PDV) |
| ACEITO→PREPARANDO | `estacao_atual='COZINHA'` (só cozinha) |
| ACEITO→PRONTO | `requer_cozinha=false` (atalho revenda) |
| PREPARANDO→PRONTO | `estacao_atual='COZINHA'`; o próprio trigger seta `estacao_atual='BALCAO'`, `devolvido_balcao_em=now()` |
| PRONTO→EM_ROTA / PRONTO→FINALIZADO | `estacao_atual='BALCAO'` e `tipo_pedido` compatível (RN-08); seta `conferido_em=coalesce(conferido_em, now())` |
| EM_ROTA→FINALIZADO | sempre (entregador — fluxo atual intocado) |
| *→CANCELADO | NOVO/ACEITO com bastão BALCAO: livre; senão exige claim de admin (validar via `auth.uid()` ∈ equipe admin da loja) |
| Qualquer outra | `raise exception` |

A ação "Enviar para a cozinha" é um UPDATE de `estacao_atual` (status continua
ACEITO) — validar num trigger próprio `BEFORE UPDATE OF estacao_atual`: BALCAO→COZINHA
só se ACEITO e `requer_cozinha`; COZINHA→BALCAO só via caminho do PRONTO (ou admin).

### 5.2 `requer_cozinha` calculado — trigger em `itens_pedido`
`AFTER INSERT ON itens_pedido`: se o produto do item (join por `produto_id`; itens
sem produto contam como COZINHA, RN-02) é COZINHA → `update pedidos set requer_cozinha=true`.
Na criação do pedido, `requer_cozinha` nasce `false` **apenas se** vier de RPC/insert
que já saiba; caminho simples e robusto: default `false` no INSERT do pedido feito
pelos checkouts novos + trigger promove a `true` no primeiro item COZINHA.
⚠️ Atenção do implementador: hoje o checkout insere `pedidos` primeiro e `itens_pedido`
depois (`CheckoutDrawer.tsx`, `PDV.tsx:172-199`) — o trigger cobre essa ordem. O default
da COLUNA fica `true` (RN-13, pedidos legados); os INSERTs novos passam `requer_cozinha:false`
explicitamente e deixam o trigger promover.

### 5.3 Métricas — `fn_metricas_cozinha(p_loja_id uuid, p_de date, p_ate date)`
RPC `security definer` (validar membro da loja, padrão das RPCs da Fase A) retornando:

- por dia: pedidos concluídos pela cozinha, tempo médio/mediano ACEITO→PRONTO e
  PREPARANDO→PRONTO, % dentro da meta;
- por operador (`historico_pedidos.operador_id`): pedidos avançados, tempo médio, posição;
- streak atual: dias consecutivos com média ≤ meta.

Meta: `lojas.meta_preparo_min int default 20` (nova coluna na mesma migration).
Fonte: pares de linhas de `historico_pedidos` do mesmo pedido (window `lag()` por
pedido ordenado por `criado_em`).

---

## 6. UX por tela (o diferencial — tratar como produto, não como CRUD)

### 6.1 Admin Cardápio (`src/pages/admin/Cardapio.tsx`)
- Toggle por produto: 🔥 "Preparo na cozinha" / 🏪 "Revenda direta (vai direto do balcão)"
  com uma linha explicando a consequência ("não entra na fila do KDS").
- Ação em massa no cabeçalho da categoria: "marcar categoria como revenda direta".
- Badge discreto no card do produto na listagem.

### 6.2 Painel de Pedidos (`src/pages/admin/PainelPedidos.tsx`) — vira a tela do BALCÃO
- **ACEITO + requer_cozinha + bastão BALCAO** → botão primário "🔥 Enviar para a cozinha".
- **Bastão COZINHA** → card em modo acompanhamento: badge pulsante "Na cozinha · 12min",
  itens visíveis, imprimir ok, **nenhum botão de status**. Cancelar só admin (RN-09).
- **PRONTO + bastão BALCAO** → modo conferência: checklist item a item (tap para marcar),
  itens de revenda destacados com "🏪 separar no balcão"; ao completar, botão de destino
  ("Saiu p/ entrega" / "Entregar ao cliente" / mesa segue comanda). Barra de progresso
  do checklist (`ProgressBar` de `components/ui`).
- **Só-revenda** → ACEITO mostra "Separar e entregar" (ACEITO→PRONTO), e cai direto na conferência.
- Filtros ganham "Na cozinha" (estacao=COZINHA) e "Conferir" (PRONTO+BALCAO).

### 6.3 KDS (`src/pages/admin/KDS.tsx`) — só cozinha, com meta e celebração
- Query filtra `requer_cozinha=true` e (para ação) `estacao_atual='COZINHA'`; a coluna
  "Pronto" mostra os devolvidos recentes como confirmação visual (somente leitura, como hoje).
- Card: itens COZINHA grandes; itens DIRETO apagados "no balcão: 2× Coca" (RN-10).
- **Barra de meta no topo**: "média de hoje 14min · meta 20min" (verde/âmbar/vermelho),
  via `fn_metricas_cozinha` (refresh 60s).
- **Seletor de operador** (chips com nome, persistir em `localStorage` por dispositivo);
  avanços gravam `operador_id` (RN-12).
- **Celebração**: recorde do dia batido ou streak mantida → `SuccessCelebration`
  (existe em `components/ui`) + som curto. Nada bloqueante — cozinha tem pressa.

### 6.4 Dashboard (`src/pages/admin/Dashboard.tsx`) — card "Cozinha hoje"
Tempo médio do dia vs meta, gráfico 7 dias, ranking top-3 operadores (🥇🥈🥉), streak
("🔥 5 dias dentro da meta"). Link "ver KDS".

### 6.5 Cliente (`src/pages/Pedido.tsx`)
Só o RN-14 (pular "Preparando" quando só-revenda). Nenhuma outra mudança.

---

## 7. Fases de execução (cada uma = 1 agente, com critério de aceite)

### E1 — Banco e enforcement (bloqueia as demais)
Migration §4 completa + triggers §5.1/§5.2 + `fn_metricas_cozinha` §5.3 + RLS check
(colunas novas herdam as policies de `pedidos`/`produtos`; `historico_pedidos.operador_id`
já coberto pela policy `adm_historico`).
**Aceite:** suíte SQL de transições (cada linha da tabela §5.1 com caso permitido e
caso rejeitado); pedido misto criado via INSERTs na ordem do checkout termina com
`requer_cozinha=true`; só-revenda termina `false`. Aplicar via Management API
(memória: `miseon-supabase-apply-sql`), testar no Lanche do Paulista.

### E2 — Cardápio admin + types
`estacao_preparo` em `Produto` (`types.ts`), toggle + ação em massa (§6.1), checkouts
(CheckoutDrawer, PDV, PedidoMesaDrawer) passam `requer_cozinha:false` no INSERT (§5.2).
**Aceite:** marcar "Bebidas" como revenda em massa; criar pedido só-bebidas → `requer_cozinha=false`.

### E3 — Painel (balcão) passa-bastão
§6.2 completo. Realtime já reage a UPDATE de `pedidos` (canal existente cobre `estacao_atual`).
**Aceite:** pedido misto: enviar → botões somem; KDS marca pronto → card vira conferência;
checklist completo → destino habilita. Tentativa de burlar via console (update direto)
→ erro do trigger exibido em toast.

### E4 — KDS: filtro, operador, meta, celebração
§6.3 completo.
**Aceite:** pedido só-revenda não aparece; misto mostra revenda apagada; avanço grava
`operador_id`; barra de meta reflete `fn_metricas_cozinha`.

### E5 — Dashboard + cliente + polimento
§6.4, RN-14, textos/sons, `npm run build` limpo, teste E2E manual dos 3 cenários
(só-revenda, só-preparo, misto) nos 3 tipos (delivery, retirada, mesa) no Lanche do Paulista.

Dependências: E1 → (E2 ∥ E3 ∥ E4) → E5. Nunca rodar E2–E4 antes do E1 aplicado.

---

## 8. Riscos e decisões tomadas (não reabrir sem o PO)

| Risco | Mitigação/decisão |
|---|---|
| Enum novo em `StatusPedido` quebraria cliente/entregador/webhooks | **Decisão: NÃO criar status novos.** O bastão (`estacao_atual`) modela o fluxo sobre a cadeia existente. |
| Baixa de estoque por ficha técnica dispara em status — verificar em qual gatilho está antes do E1 (não pode disparar 2× nem deixar de disparar no atalho ACEITO→PRONTO) | Tarefa explícita do agente E1: localizar o trigger de baixa e cobrir o atalho com teste. |
| Loja pequena (1 pessoa faz tudo) pode achar o passa-bastão burocrático | O fluxo só muda se `requer_cozinha`; e o PDV segue criando ACEITO. Se houver reclamação: flag `lojas.fluxo_conferencia boolean` (fora do escopo inicial). |
| Ranking induzir competição tóxica / meta irreal | Meta configurável pela loja; ranking mostra top-3, nunca "pior"; celebração só positiva. |
| Pedidos em andamento no deploy | Migration seta legados como BALCAO+requer_cozinha=true → seguem operáveis no fluxo antigo pelo balcão. |

**Fora de escopo desta entrega:** múltiplas estações (BAR/CHAPA — o modelo já suporta),
impressão automática na cozinha ao receber bastão, app garçom, SLA por item.
