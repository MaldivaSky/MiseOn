-- ============================================================
-- Migration: KDS Kanban Configurável (Estilo Trello) e Timestamps por Etapa
-- Permite que cada loja configure suas próprias etapas da cozinha (ex: Chapa, Forno, Montagem)
-- e registre o tempo exato decorrido em cada etapa para métricas de eficiência.
-- ============================================================

-- 1. Adiciona coluna kds_etapas na tabela lojas
alter table lojas add column if not exists kds_etapas jsonb default null;

comment on column lojas.kds_etapas is 'Configuração personalizada das etapas do pipeline KDS Kanban (ex: [{id, nome, cor, ordem}]).';

-- 2. Adiciona coluna etapa_kds_atual na tabela pedidos
alter table pedidos add column if not exists etapa_kds_atual text default null;

comment on column pedidos.etapa_kds_atual is 'Identificador da etapa atual do pedido no KDS Kanban customizado da loja.';

-- 3. Adiciona coluna timestamps_etapas_kds na tabela pedidos
alter table pedidos add column if not exists timestamps_etapas_kds jsonb default '{}'::jsonb;

comment on column pedidos.timestamps_etapas_kds is 'Dicionário JSON contendo a data/hora de entrada em cada etapa do KDS para métricas de tempo por processo.';

-- 4. Função auxiliar para registrar entrada em nova etapa do KDS com timestamp
create or replace function fn_registrar_etapa_kds(
  p_pedido_id uuid,
  p_etapa_id text
)
returns void
language plpgsql
security definer
as $function$
declare
  v_loja_id uuid;
  v_timestamps jsonb;
begin
  select loja_id, coalesce(timestamps_etapas_kds, '{}'::jsonb)
    into v_loja_id, v_timestamps
    from pedidos where id = p_pedido_id;

  if v_loja_id is null then
    raise exception 'Pedido não encontrado.';
  end if;

  if not exists (select 1 from usuarios_loja where user_id = auth.uid() and loja_id = v_loja_id) then
    raise exception 'Acesso negado.';
  end if;

  -- Adiciona timestamp da nova etapa
  v_timestamps := jsonb_set(v_timestamps, array[p_etapa_id], to_jsonb(now()::text));

  update pedidos
     set etapa_kds_atual = p_etapa_id,
         timestamps_etapas_kds = v_timestamps
   where id = p_pedido_id;
end;
$function$;

-- 5. Atualiza fn_valida_estacao_pedido para permitir a devolução do bastão (COZINHA -> BALCAO) ao concluir (PRONTO)
create or replace function fn_valida_estacao_pedido()
returns trigger
language plpgsql
security definer
as $function$
begin
  if OLD.estacao_atual = NEW.estacao_atual then
    return NEW;
  end if;

  if OLD.estacao_atual = 'BALCAO' and NEW.estacao_atual = 'COZINHA' then
    if OLD.status <> 'ACEITO' then
      raise exception 'Só é possível enviar para a cozinha um pedido ACEITO (pedido #%).', OLD.numero;
    end if;
    if not OLD.requer_cozinha then
      raise exception 'Pedido #% não tem item de preparo — não precisa ir para a cozinha.', OLD.numero;
    end if;
    NEW.enviado_cozinha_em := now();
    return NEW;
  end if;

  if OLD.estacao_atual = 'COZINHA' and NEW.estacao_atual = 'BALCAO' then
    if NEW.status not in ('PRONTO', 'EM_ROTA', 'FINALIZADO', 'CANCELADO') then
      raise exception 'Devolução ao balcão só é permitida ao concluir a preparação (pedido #%).', OLD.numero;
    end if;
    NEW.devolvido_balcao_em := coalesce(NEW.devolvido_balcao_em, now());
    return NEW;
  end if;

  raise exception 'Transição de bastão inválida: % → % (pedido #%).', OLD.estacao_atual, NEW.estacao_atual, OLD.numero;
end;
$function$;
