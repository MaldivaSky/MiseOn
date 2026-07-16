// MiseOn — Edge Function: pagamento com CARTÃO DE CRÉDITO via Efí Bank
// Porte do EfiCardService.create_one_step_charge do MySuperStore
// (backend/apps/payments/services.py)
//
// O cartão é tokenizado NO NAVEGADOR pela lib oficial `payment-token-efi`
// (PCI: o número do cartão nunca chega aqui — só o payment_token).
//
// Secrets:
//   EFI_COBRANCAS_CLIENT_ID/EFI_COBRANCAS_CLIENT_SECRET
//   ou EFI_CLIENT_ID/EFI_CLIENT_SECRET
//   + EFI_SANDBOX
// (API de Cobranças usa OAuth Basic — não exige certificado mTLS como o Pix)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_COB_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://cobrancas-h.api.efipay.com.br'
  : 'https://cobrancas.api.efipay.com.br';

// CORS: sem isto o navegador bloqueia a chamada do checkout antes de chegar na Efí.
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

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const auth = btoa(`${clientId}:${clientSecret}`);
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { pedido_id, payment_token, installments = 1, customer } = await req.json();
    if (!pedido_id || !payment_token || !customer?.name || !customer?.cpf) {
      return json({ error: 'pedido_id, payment_token e customer{name,cpf} são obrigatórios' }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, numero, valor_total, loja_id, telefone_contato, cep, logradouro, numero_endereco, complemento, bairro, cidade, uf, lojas(efi_payee_code, antecipacao_cartao), itens_pedido(nome_produto, preco_unitario, quantidade)')
      .eq('id', pedido_id)
      .single();
    if (!pedido) return json({ error: 'pedido não encontrado' }, { status: 404 });

    // Modelo split: a cobrança é sempre processada pela conta da plataforma (MiseOn)
    // e o valor é repassado 100% ao lojista via payee_code. O lojista só precisa do
    // "Identificador de conta" da Efí — nenhuma credencial de API.
    //
    // Prazo de recebimento do CARTÃO (regra Efí): segue a configuração da conta que
    // processa a cobrança (Configurações de cobranças → Cartão de crédito → 30 dias
    // ou 2 dias úteis). Para o prazo ser escolhido POR LOJA, a plataforma mantém duas
    // modalidades: a conta padrão (~30d, taxa menor) e uma conta/config antecipada
    // (~2 dias úteis, taxa maior). `lojas.antecipacao_cartao` decide qual processa.
    const querAntecipado = !!(pedido as any).lojas?.antecipacao_cartao;
    const antecipadoDisponivel = !!(Deno.env.get('EFI_ANTECIPADO_CLIENT_ID') && Deno.env.get('EFI_ANTECIPADO_CLIENT_SECRET'));
    const usarAntecipado = querAntecipado && antecipadoDisponivel;

    const token = usarAntecipado
      ? await getToken(Deno.env.get('EFI_ANTECIPADO_CLIENT_ID')!.trim(), Deno.env.get('EFI_ANTECIPADO_CLIENT_SECRET')!.trim())
      : await getToken(
          envFirst('EFI_COBRANCAS_CLIENT_ID', 'EFI_CLIENT_ID'),
          envFirst('EFI_COBRANCAS_CLIENT_SECRET', 'EFI_CLIENT_SECRET'),
        );

    // Split de cartão (API Cobranças): repassa 100% para a conta do lojista via payee_code
    // (percentage 10000 = 100,00%). Só quando o payee_code é DIFERENTE do da conta que
    // está processando — splitar "pra si mesmo" faz a Efí recusar com 402 antes do emissor.
    const payeeCode = (pedido as any).lojas?.efi_payee_code?.trim();
    const payeePlataforma = (usarAntecipado
      ? Deno.env.get('EFI_ANTECIPADO_PAYEE_CODE')
      : Deno.env.get('EFI_PLATFORM_PAYEE_CODE'))?.trim();
    const usarSplit = !!payeeCode && payeeCode.length > 5 && payeeCode !== payeePlataforma;
    const marketplace = usarSplit
      ? { marketplace: { repasses: [{ payee_code: payeeCode, percentage: 10000 }] } }
      : {};

    // billing_address é OBRIGATÓRIO no one-step de cartão da Efí. Usa o endereço do pedido
    // (delivery) e cai em valores válidos por formato quando o pedido é retirada/sem endereço.
    const p = pedido as any;
    const billing_address = {
      street: String(p.logradouro || 'Nao informado').slice(0, 255),
      number: String(p.numero_endereco || 'SN').slice(0, 30),
      neighborhood: String(p.bairro || 'Centro').slice(0, 255),
      zipcode: (String(p.cep || '').replace(/\D/g, '') || '01001000').slice(0, 8),
      city: String(p.cidade || 'Sao Paulo').slice(0, 255),
      state: String(p.uf || 'SP').slice(0, 2).toUpperCase(),
      complement: p.complemento ? String(p.complemento).slice(0, 80) : undefined,
    };

    // one-step: cria e paga a cobrança numa chamada só (padrão MySuperStore)
    const body = {
      items: (pedido.itens_pedido ?? []).map((i: any) => ({
        name: String(i.nome_produto).slice(0, 255),
        value: Math.round(Number(i.preco_unitario) * 100), // centavos
        amount: i.quantidade,
        ...marketplace,
      })),
      payment: {
        credit_card: {
          payment_token,
          installments: Number(installments),
          billing_address,
          customer: {
            name: customer.name,
            cpf: String(customer.cpf).replace(/\D/g, ''),
            email: customer.email ?? 'cliente@miseon.app',
            // phone_number é OBRIGATÓRIO. Usa o do cartão ou, na falta, o telefone do pedido.
            phone_number: (String(customer.phone ?? '').replace(/\D/g, '') || String(p.telefone_contato ?? '').replace(/\D/g, '')),
            // birth (nascimento) — a Efí exige no perfil estrito de antifraude. Formato AAAA-MM-DD.
            ...(customer.birth ? { birth: String(customer.birth) } : {}),
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
      // Loga o motivo real da Efí (aparece nos logs da função) e devolve pro front.
      console.error('Efí recusou o cartão:', JSON.stringify(charge));
      // error_description pode ser string OU objeto { property, message }. Normaliza p/ texto.
      const ed = charge?.error_description;
      let motivo = typeof ed === 'string'
        ? ed
        : (ed?.message ?? charge?.message ?? (Array.isArray(charge?.errors) ? charge.errors[0]?.message : null) ?? 'Cobrança não autorizada');
      if (ed && typeof ed === 'object' && ed.property) motivo = `${motivo} (${ed.property})`;
      return json({ aprovado: false, error: String(motivo), detail: charge }, { status: 200 });
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

    return json({
      charge_id: data.charge_id,
      status: data.status,
      installments: Number(installments),
      total: data.total,
      aprovado,
      modalidade: usarAntecipado ? 'antecipado' : 'padrao',
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, { status: 500 });
  }
});
