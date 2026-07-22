-- ============================================================
-- MiseOn — Cleanup: numeração de pedidos
--
-- 1) Remove o mecanismo legado de sequência DIÁRIA de pedidos
--    (fn_numero_pedido + pedido_sequencia), órfão desde que
--    fn_trg_numero_pedido / fn_proximo_numero (sequência contínua
--    em loja_sequencias) assumiu a numeração.
--    Verificado em produção antes desta migration: nenhum trigger
--    anexado à função, nenhuma função/view/frontend/edge function
--    a referencia, tabela com 0 linhas, sem FKs, policies ou
--    triggers próprios.
--
-- 2) Trava contra duplicidade: índice único parcial em
--    (loja_id, numero) para pedidos criados a partir de 2026-07-22.
--    Por que parcial: o mecanismo diário legado zerava a sequência
--    a cada dia, então o histórico tem duplicatas legítimas de
--    número (ex.: 4 pedidos "nº 1" na mesma loja, um por dia).
--    Renumerar histórico de loja real reescere números que o
--    cliente já viu em comanda/tela/nota — decisão de negócio,
--    fica como opção futura. Para todo INSERT novo
--    (criado_em = now()), a unicidade passa a ser garantida pelo
--    próprio banco, além da atomicidade do fn_proximo_numero.
--    (Duplicatas no conjunto do índice verificadas: zero.)
-- ============================================================

drop function if exists public.fn_numero_pedido();
drop table if exists public.pedido_sequencia;

create unique index if not exists uq_pedidos_loja_numero
  on public.pedidos (loja_id, numero)
  where criado_em >= '2026-07-22'::timestamptz;
