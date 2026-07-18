# Auditoria de Segurança & Regras de Negócio — MiseOn

**Data:** 2026-07-18 · **Escopo:** RLS/policies, edge functions, fluxos de dinheiro (pedidos, Pix, cartão, cashback, assinatura, comandas) · **Resultado:** 25 achados (6 críticos, 9 altos, 10 médios)

> **Leitura executiva:** os 3 fios mais curtos de exploração hoje — achados 1, 2 e 3 — são independentes entre si e **qualquer um deles zera o custo de um pedido real** (comida de graça, remotamente, sem invadir nada: é só chamar a API). Prioridade absoluta antes de qualquer venda nova.

---

## CRÍTICOS

**1. Webhook Pix sem nenhuma autenticação — pedido marcado PAGO sem pagar.**
`supabase/functions/pix-webhook/index.ts:13-42` — endpoint `--no-verify-jwt`, aceita qualquer JSON `{pix:[{txid}]}`; sem secret, sem mTLS, sem consulta de confirmação à Efí. O `txid` é determinístico derivado do `pedido_id` (`pix-criar-cobranca/index.ts:109-111`) e os pedidos são legíveis publicamente (achado 6) → qualquer pessoa calcula o txid do próprio pedido e chama o webhook → `pagamentos.PAGO` → pedido `ACEITO` → KDS + baixa de estoque. **Comida grátis remota.**
*Correção:* validar o pagamento consultando `/v2/cob/{txid}` na Efí antes de marcar PAGO (ou secret na URL + conferência de valor).

**2. Totais calculados 100% no browser e gravados via INSERT público; a cobrança Pix confia nesse valor.**
`src/components/CheckoutDrawer.tsx:158-169,338` + `supabase/schema.sql:444-447` (`WITH CHECK (true)`) + `pix-criar-cobranca/index.ts:96,123` (cobra `pedidos.valor_total` sem recalcular itens, cupom ou taxa). Cliente insere `valor_total: 0.01` e paga R$ 0,01. Idem `preco_unitario` em `itens_pedido`.
*Correção:* recalcular server-side na function e restringir o `WITH CHECK` do INSERT público.

**3. Cliente grava `pagamentos.status = 'PAGO'` direto pela API.**
`supabase/schema.sql:447` — insert público sem restrição de `status`; o painel lê `pagamentos(status)` → operador aceita/entrega pedido "pago" que nunca passou por gateway.
*Correção:* `WITH CHECK (status = 'PENDENTE')`; transição para PAGO só via service role.

**4. `fn_usar_cashback` (SECURITY DEFINER) não verifica o dono do saldo.**
`supabase/migrations/20260717150000:69-84` — recebe `p_cliente_id` arbitrário e debita qualquer `cashback_saldos`; qualquer autenticado (ou anônimo, pelo grant default) drena o cashback de outro cliente.
*Correção:* validar que `p_cliente_id` pertence a `auth.uid()` (e o pedido ao mesmo cliente).

**5. `enderecos_cliente` e `favoritos_cliente` com CRUD público irrestrito (PII cross-tenant).**
`supabase/migrations/20260714181000_add_enderecos.sql:19-22,35-37` — qualquer anon lê/altera/apaga endereços de clientes de todas as lojas.
*Correção:* policies limitando ao `cliente_id` do `auth.uid()`.

**6. Todos os pedidos de todos os tenants legíveis publicamente.**
`supabase/schema.sql:449-451` — vaza nome, telefone, endereço, valores e hábitos de todos os clientes; viabiliza os achados 1 e 4 (enumeração de ids).
*Correção:* leitura pública só `cliente_user_id = auth.uid()` + painel da loja.

## ALTOS

**7. Credenciais de repasse (split) editáveis por qualquer papel e lidas publicamente.**
`schema.sql:454` (`adm_lojas FOR ALL` sem checar papel — garçom/entregador troca CPF/conta Efí e desvia 100% dos repasses) + `schema.sql:433` (`pub_lojas` expõe `efi_*` a qualquer visitante, pois o cardápio faz `select('*')` — `src/pages/Cardapio.tsx:148`).
*Correção:* escrita em `lojas` só admin; view pública sem dados de repasse.

**8. Cobrança de cartão ignora taxa de entrega, desconto e cashback.**
`cartao-pagar/index.ts:119-124` — cobra só Σ itens; cliente paga A MAIS que o total do checkout → disputa/chargeback.
*Correção:* cobrar `valor_total` recalculado server-side.

**9. `cartao-pagar` sem idempotência — retry cobra 2×.**
`cartao-pagar/index.ts:143-148` — cada chamada cria nova charge; timeout ou duplo clique = cobrança dupla.
*Correção:* abortar se já existe pagamento PAGO/charge em andamento.

**10. Cancelamento não estorna dinheiro nem cashback.**
`PainelPedidos.tsx:270-273` — (a) sem refund na Efí; (b) cashback creditado no FINALIZADO não é revertido ao cancelar depois (**fraude: finaliza, credita, cancela**); (c) `cashback_usado` não é devolvido.
*Correção:* estorno de gateway + movimentos compensatórios na transição para CANCELADO.

**11. Limpeza de falha do checkout bloqueada pela RLS — pedidos fantasmas + cashback perdido.**
`CheckoutDrawer.tsx:229-238` — DELETE/UPDATE de compensação rodam como cliente sem policy → falham silenciosamente; saldo debitado some e pedido vazio fica no painel.
*Correção:* criar pedido via RPC `security definer` transacional (pedido+itens+pagamento+cashback num commit).

**12. Assinatura: dupla cobrança em retry e vencimento que nunca renova.**
`saas-assinar/index.ts:93-106` — nova subscription Efí a cada chamada (retry = 2 mensalidades); sem webhook de recorrência, `vencimento_assinatura` nunca é prorrogado → **loja pagante cai no lockdown após 30 dias**; não existe fluxo de cancelamento.
*Correção:* subscription única por loja + webhook de recorrência atualizando vencimento.

**13. Aba Pix da assinatura chama function inexistente.**
`src/pages/admin/Assinatura.tsx:110` invoca `saas-pix`, que não existe — Pix de assinatura sempre falha em produção.
*Correção:* implementar `saas-pix` ou remover a aba.

**14. Loja bloqueada/vencida continua vendendo normalmente.**
Lockdown é só UI do admin; o cardápio público não checa assinatura (`Cardapio.tsx:148`) e nenhuma RLS/RPC bloqueia pedido de loja inadimplente — loja vencida segue vendendo e recebendo Pix com split.
*Correção:* gate server-side no INSERT de pedidos + aviso na vitrine.

**15. `itens_pedido_opcoes` totalmente aberto (cross-tenant).**
`schema.sql:470` — `FOR ALL USING (true)`.
*Correção:* policy por loja via join `itens_pedido → pedidos`.

## MÉDIOS

**16. Papel existe só na UI — RLS não distingue admin de entregador.** `schema.sql:428-430` (`fn_meu_acesso` só checa vínculo). Menus escondidos são cosméticos. *Correção:* `fn_meu_papel(loja)` + policies por papel.

**17. Cupons: validade, limite de usos e "primeira compra" nunca aplicados; `usos` nunca incrementado.** `CheckoutDrawer.tsx:240-251`. Cupom vencido funciona para sempre. *Correção:* validar server-side + incrementar `usos`.

**18. Estorno de estoque em duplicidade.** `20260717150000:97-105` — CANCELADO→ACEITO→CANCELADO devolve 2× (nunca zera `estoque_baixado`). *Correção:* `NEW.estoque_baixado := false` no estorno.

**19. Cashback creditado em dobro ao re-finalizar.** `20260717150000:107-109` — sem unicidade de CREDITO por pedido. *Correção:* unique parcial em `cashback_movimentos(pedido_id) WHERE tipo='CREDITO'`.

**20. Webhook Pix sobrescreve qualquer status e não confere valor.** `pix-webhook/index.ts:26-41` — ressuscita CANCELADO; Pix parcial marca PAGO integral; cobrança expirada nunca tratada. *Correção:* filtrar `status='PENDENTE'`, validar valor, tratar expiração.

**21. `pix-criar-cobranca` sem autenticação.** `pix-criar-cobranca/index.ts:85-99` — qualquer um gera cobranças reais para qualquer pedido. *Correção:* JWT do dono + status NOVO.

**22. Race no número sequencial do pedido + fuso errado.** `schema.sql:278-288` — `MAX+1` sem lock/unique (números duplicados); `now()::date` UTC reinicia a numeração às 21h BRT. *Correção:* unique `(loja_id, dia, numero)` + contador com lock, data no fuso da loja.

**23. Vocabulário de status de assinatura inconsistente + trial ignorado.** `types.ts:54` (TESTE/ATRASADO) vs `Churn.tsx:24-27` ('trial'/'atrasada' minúsculos — nunca casam); `AdminLayout.tsx:41,49` ignora `trial_termina_em` e só honra ATIVO/VITALICIO; `Assinatura.tsx:168-179` trata VITALICIO como inadimplente. *Correção:* enum único + função SQL única de "loja em dia".

**24. Schema drift recorrente: `clientes.user_id`** usado no checkout e nas policies de cashback, ausente de migrations (mesmo padrão do incidente do login). *Correção:* migration formal com índice único `(loja_id, user_id)`.

**25. Fechamento de comanda não-atômico e sem idempotência.** `Mesas.tsx:210-228` — dois garçons fechando a mesma comanda inserem pagamentos em duplicidade. *Correção:* RPC transacional com guarda `status='ABERTA'`.

---

**Verificado sem achado:** `equipe-convidar` e `superadmin-criar-loja` validam papel corretamente; arredondamento `numeric(10,2)` correto; atomicidade interna de `fn_usar_cashback` correta (o problema é só a falta de checagem de dono).
