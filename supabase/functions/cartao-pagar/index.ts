// MiseOn — Edge Function: pagamento com CARTÃO DE CRÉDITO via Efí Bank
// Porte do EfiCardService.create_one_step_charge do MySuperStore
// (backend/apps/payments/services.py)
//
// O cartão é tokenizado NO NAVEGADOR pela lib oficial `payment-token-efi`
// (PCI: o número do cartão nunca chega aqui — só o payment_token).
//
// Secrets: EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_SANDBOX
// (API de Cobranças usa OAuth Basic — não exige certificado mTLS como o Pix)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_COB_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://cobrancas-h.api.efipay.com.br'
  : 'https://cobrancas.api.efipay.com.br';

async function getToken(): Promise<string> {
  const auth = btoa(`${Deno.env.get('EFI_CLIENT_ID')}:${Deno.env.get('EFI_CLIENT_SECRET')}`);
  const res = await fetch(`${EFI_COB_URL}/v1/authorize`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth (cobranças) falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const { pedido_id, payment_token, installments = 1, customer } = await req.json();
    if (!pedido_id || !payment_token || !customer?.name || !customer?.cpf) {
      return Response.json({ error: 'pedido_id, payment_token e customer{name,cpf} são obrigatórios' }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, numero, valor_total, itens_pedido(nome_produto, preco_unitario, quantidade)')
      .eq('id', pedido_id)
      .single();
    if (!pedido) return Response.json({ error: 'pedido não encontrado' }, { status: 404 });

    const token = await getToken();

    // one-step: cria e paga a cobrança numa chamada só (padrão MySuperStore)
    const body = {
      items: (pedido.itens_pedido ?? []).map((i: any) => ({
        name: String(i.nome_produto).slice(0, 255),
        value: Math.round(Number(i.preco_unitario) * 100), // centavos
        amount: i.quantidade,
      })),
      payment: {
        credit_card: {
          payment_token,
          installments: Number(installments),
          customer: {
            name: customer.name,
            cpf: String(customer.cpf).replace(/\D/g, ''),
            email: customer.email ?? 'cliente@miseon.app',
            phone_number: String(customer.phone ?? '').replace(/\D/g, '') || undefined,
          },
        },
      },
    };

    const res = await fetch(`${EFI_COB_URL}/v1/charge/one-step`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const charge = await res.json();
    const data = charge?.data;
    if (!data?.charge_id) {
      return Response.json({ error: charge?.message ?? 'Cobrança recusada', detail: charge }, { status: 402 });
    }

    const aprovado = ['approved', 'paid'].includes(String(data.status));
    await supabase
      .from('pagamentos')
      .update({
        gateway_txid: String(data.charge_id),
        status: aprovado ? 'PAGO' : 'PENDENTE',
        data_pagamento: aprovado ? new Date().toISOString() : null,
      })
      .eq('pedido_id', pedido_id)
      .eq('metodo', 'CREDITO');

    if (aprovado) {
      await supabase.from('pedidos').update({ status: 'ACEITO' }).eq('id', pedido_id).eq('status', 'NOVO');
    }

    return Response.json({
      charge_id: data.charge_id,
      status: data.status,
      installments: Number(installments),
      total: data.total,
      aprovado,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
