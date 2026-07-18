// MiseOn — Edge Function: Assinatura SaaS Efí Bank
// Processa o pagamento recorrente (assinatura) da loja para a plataforma MiseOn.
// Usa a API de Cobranças da Efí (OAuth Basic).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_COB_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://cobrancas-h.api.efipay.com.br'
  : 'https://cobrancas.api.efipay.com.br';

const PLAN_NAME = 'MiseOn Profissional';
const PLAN_VALUE = 15000; // R$ 150,00 em centavos

// CORS: sem isto o navegador bloqueia a chamada do painel antes de chegar na Efí.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers ?? {}) },
  });

function envFirst(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error(`Secret ausente: informe um destes nomes -> ${names.join(', ')}`);
}

async function getToken(): Promise<string> {
  const clientId = envFirst('EFI_COBRANCAS_CLIENT_ID', 'EFI_CLIENT_ID');
  const clientSecret = envFirst('EFI_COBRANCAS_CLIENT_SECRET', 'EFI_CLIENT_SECRET');
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${EFI_COB_URL}/v1/authorize`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function getOrCreatePlan(token: string): Promise<number> {
  // Busca planos existentes (limite 100 para garantir)
  const res = await fetch(`${EFI_COB_URL}/v1/plans?limit=100&offset=0`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const plans = data.data || [];
  
  const existingPlan = plans.find((p: any) => p.name === PLAN_NAME && p.value === PLAN_VALUE);
  if (existingPlan) return existingPlan.plan_id;

  // Cria o plano se não existir
  const createRes = await fetch(`${EFI_COB_URL}/v1/plan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: PLAN_NAME,
      repeats: null, // Recorrência contínua até ser cancelada
      interval: 1    // Mensal
    }),
  });
  const createData = await createRes.json();
  if (!createData?.data?.plan_id) throw new Error(`Falha ao criar plano Efí: ${JSON.stringify(createData)}`);
  return createData.data.plan_id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { loja_id, payment_token, customer } = await req.json();
    if (!loja_id || !payment_token || !customer?.name || !customer?.cpf) {
      return json({ error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = await getToken();

    // 1. Obter o ID do plano (MiseOn Profissional - R$ 150)
    const planId = await getOrCreatePlan(token);

    // 2. Criar a assinatura para a Loja
    const subRes = await fetch(`${EFI_COB_URL}/v1/plan/${planId}/subscription`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          name: 'Mensalidade MiseOn Profissional',
          value: PLAN_VALUE,
          amount: 1
        }]
      })
    });
    const subData = await subRes.json();
    if (!subData?.data?.subscription_id) throw new Error(`Falha ao criar subscription: ${JSON.stringify(subData)}`);
    const subscriptionId = subData.data.subscription_id;

    // 3. Pagar a assinatura com o cartão de crédito
    const payRes = await fetch(`${EFI_COB_URL}/v1/subscription/${subscriptionId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment: {
          credit_card: {
            payment_token,
            customer: {
              name: customer.name,
              cpf: String(customer.cpf).replace(/\D/g, ''),
              phone_number: String(customer.phone ?? '').replace(/\D/g, '') || undefined,
            }
          }
        }
      })
    });
    const payData = await payRes.json();
    if (payData.code !== 200 || !['active', 'paid'].includes(String(payData?.data?.status))) {
      return json({ error: payData?.message ?? 'Cartão recusado', detail: payData }, { status: 402 });
    }

    // 4. Sucesso! Atualiza o banco de dados da loja
    const novoVencimento = new Date();
    novoVencimento.setMonth(novoVencimento.getMonth() + 1);

    const { error: updErr } = await supabase.from('lojas').update({
      status_assinatura: 'ativa',
      trial_termina_em: novoVencimento.toISOString(), // próximo vencimento da assinatura paga
    }).eq('id', loja_id);
    if (updErr) {
      console.error('Falha ao atualizar assinatura da loja', updErr);
      return json({ error: 'Pagamento aprovado, mas falha ao ativar a loja. Contate o suporte.', detail: updErr }, { status: 500 });
    }

    return json({
      success: true,
      subscription_id: subscriptionId,
      status: payData.data.status,
      vencimento: novoVencimento.toISOString()
    });

  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, { status: 500 });
  }
});
