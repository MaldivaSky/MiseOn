-- Migration: cliente_acoes_pedido
-- Permite que o próprio cliente (visualizando pelo link público com UUID)
-- informe que recebeu o pedido.

create or replace function fn_cliente_confirmar_recebimento(p_pedido_id uuid)
returns void
language plpgsql
security definer
as $function$
declare
  v_status text;
  v_tipo text;
begin
  select status, tipo_pedido into v_status, v_tipo from pedidos where id = p_pedido_id;
  
  if v_status is null then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_status in ('FINALIZADO', 'CANCELADO') then
    raise exception 'O pedido já está finalizado ou cancelado.';
  end if;

  if (v_tipo = 'DELIVERY' and v_status <> 'EM_ROTA') then
    raise exception 'Você só pode confirmar o recebimento de um delivery se ele já saiu para entrega (EM ROTA).';
  end if;

  if (v_tipo in ('SALAO', 'RETIRADA_BALCAO') and v_status <> 'PRONTO') then
    raise exception 'Você só pode confirmar o recebimento se o pedido estiver PRONTO.';
  end if;

  -- Atualiza o status para FINALIZADO
  update pedidos set status = 'FINALIZADO' where id = p_pedido_id;
end;
$function$;

grant execute on function fn_cliente_confirmar_recebimento(uuid) to anon, authenticated;
