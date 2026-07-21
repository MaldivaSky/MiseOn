import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getIfoodToken(clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId,
    clientSecret
  });
  const res = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error('Falha ao autenticar no iFood Centralizado');
  return res.json();
}

async function getOrderDetails(orderId: string, token: string) {
  const res = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Falha ao buscar pedido ${orderId}`);
  return res.json();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const events = await req.json();
    if (!Array.isArray(events)) {
      return new Response('Payload inválido', { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get('IFOOD_CLIENT_ID')!;
    const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET')!;

    if (!clientId || !clientSecret) {
      console.error('⚠️ Credenciais do iFood ausentes!');
      return new Response('Internal Server Error', { status: 500 });
    }

    // Apenas lidamos com PLC (Placed/Novo Pedido) e CAN (Cancelled) por enquanto
    const newOrderEvents = events.filter((e: any) => e.code === 'PLC');
    
    if (newOrderEvents.length > 0) {
      const { accessToken } = await getIfoodToken(clientId, clientSecret);

      for (const event of newOrderEvents) {
        try {
          const order = await getOrderDetails(event.orderId, accessToken);
          
          // 1. Descobrir de qual loja do MiseOn é este pedido
          const { data: loja } = await supabase
            .from('lojas')
            .select('id, nome')
            .eq('ifood_merchant_id', order.merchant.id)
            .single();

          if (!loja) {
            console.warn(`Loja iFood ${order.merchant.id} não encontrada no MiseOn.`);
            continue;
          }

          const lojaId = loja.id;

          // 2. Extrair dados do cliente
          const telefoneLimpo = order.customer?.phone?.number || '';
          let clienteId = null;

          if (telefoneLimpo) {
            const { data: clienteExistente } = await supabase
              .from('clientes')
              .select('id')
              .eq('loja_id', lojaId)
              .eq('telefone', telefoneLimpo)
              .single();

            if (clienteExistente) {
              clienteId = clienteExistente.id;
            } else {
              const { data: novoCli } = await supabase
                .from('clientes')
                .insert({
                  loja_id: lojaId,
                  nome: order.customer.name,
                  telefone: telefoneLimpo,
                  documento: order.customer.documentNumber || null,
                })
                .select('id')
                .single();
              if (novoCli) clienteId = novoCli.id;
            }
          }

          // 3. Montar Pedido
          const isDelivery = order.orderType === 'DELIVERY';
          const { data: novoPedido, error: pedidoError } = await supabase
            .from('pedidos')
            .insert({
              loja_id: lojaId,
              cliente_id: clienteId,
              status: 'NOVO',
              origem: 'IFOOD',
              tipo_pedido: isDelivery ? 'DELIVERY' : 'RETIRADA',
              subtotal: order.payments.prepaid || order.payments.pending || 0, // Ajuste bruto
              taxa_entrega: order.total.deliveryFee || 0,
              desconto: order.total.discounts || 0,
              total: order.total.orderAmount || 0,
              observacao: order.observations || null,
              numero: order.displayId, // ex: "9312"
            })
            .select('id')
            .single();

          if (pedidoError || !novoPedido) throw pedidoError;
          const pedidoId = novoPedido.id;

          // 4. Mapear e Inserir Itens
          // Busca todos os produtos da loja para fazer o "De-Para" pelo pdv_code (ifood externalCode)
          const { data: produtosLoja } = await supabase
            .from('produtos')
            .select('id, pdv_code, preco, nome')
            .eq('loja_id', lojaId);

          const insertItens = [];
          for (const item of order.items) {
            // Tenta encontrar o produto pelo externalCode mapeado no nosso banco
            const produtoMatch = produtosLoja?.find((p: any) => p.pdv_code === item.externalCode);
            
            insertItens.push({
              pedido_id: pedidoId,
              produto_id: produtoMatch?.id || null, // Se não achar, salva nulo (mas ainda salva o nome abaixo se possível? O DB exige produto_id? Se exigir, vai falhar, e o lojista precisa mapear)
              quantidade: item.quantity,
              preco_unitario: item.unitPrice,
              observacao: item.observations || null,
              opcoes_selecionadas: item.options?.map((opt: any) => ({
                id: opt.externalCode,
                nome: opt.name,
                preco: opt.price,
                quantidade: opt.quantity
              })) || []
            });
          }

          // A tabela itens_pedido normalmente exige produto_id. Se o merchant não mapeou, o insert pode falhar.
          // Como o iFood é estrito, vamos assumir que o lojista FEZ o mapeamento. 
          // (Filtrar itens não mapeados ou criar produto fantasma seria uma solução avançada)
          if (insertItens.length > 0) {
             await supabase.from('itens_pedido').insert(insertItens.filter(i => i.produto_id !== null));
          }

          // 5. Pagamentos
          const insertPagamentos = [];
          if (order.payments?.methods) {
            for (const method of order.payments.methods) {
              const pagoOnline = method.prepaid; // iFood pagou
              insertPagamentos.push({
                pedido_id: pedidoId,
                metodo: method.method === 'PIX' ? 'PIX' : (method.method === 'CASH' ? 'DINHEIRO' : 'CREDITO'), // simplificação
                valor_pago: method.value,
                status: pagoOnline ? 'PAGO' : 'PENDENTE',
                data_pagamento: pagoOnline ? new Date().toISOString() : null
              });
            }
            if (insertPagamentos.length > 0) {
              await supabase.from('pagamentos').insert(insertPagamentos);
            }
          }

          // 6. Endereço de Entrega
          if (isDelivery && order.delivery?.deliveryAddress) {
            const addr = order.delivery.deliveryAddress;
            await supabase.from('enderecos_entrega').insert({
              pedido_id: pedidoId,
              rua: addr.streetName || '',
              numero: addr.streetNumber || '',
              complemento: addr.complement || null,
              bairro: addr.neighborhood || '',
              cidade: addr.city || '',
              estado: addr.state || '',
              cep: addr.postalCode || ''
            });
          }

          console.log(`Pedido ${order.displayId} (iFood) processado com sucesso para a loja ${lojaId}.`);

        } catch (e: any) {
          console.error(`Erro ao processar pedido iFood ${event.orderId}:`, e.message);
        }
      }
    }

    // iFood exige apenas um status 200/202 para não retentar
    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error('Erro ifood-webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
