// MiseOn — Edge Function: webhook Pix do Efí Bank
//
// SEGURANÇA (auditoria 2026-07-18, achados 1 e 20):
// O endpoint não é autenticado (o Efí não manda Authorization). Por isso
// NÃO confiamos no corpo recebido: para cada txid, CONSULTAMOS a própria
// Efí (GET /v2/cob/{txid}) com o certificado mTLS da plataforma e só
// marcamos PAGO se a cobrança estiver CONCLUIDA e o valor pago cobrir o
// total do pedido. Um webhook forjado (txid calculado a partir do pedido)
// não passa, porque a Efí devolve "ATIVA"/inexistente para quem não pagou.
//
// Deploy: verify_jwt = false (o Efí não envia JWT).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br';

function envFirst(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error(`Secret ausente: informe um destes nomes -> ${names.join(', ')}`);
}

function credsPlataforma() {
  return {
    clientId: envFirst('EFI_PIX_CLIENT_ID', 'EFI_CLIENT_ID'),
    clientSecret: envFirst('EFI_PIX_CLIENT_SECRET', 'EFI_CLIENT_SECRET'),
    certPem: atob(envFirst('EFI_CERT_BASE64')),
  };
}

async function efiFetch(certPem: string, path: string, init: RequestInit, token?: string) {
  const client = Deno.createHttpClient({
    // @ts-ignore — API de mTLS do Deno
    cert: certPem,
    key: certPem,
  });
  return fetch(`${EFI_URL}${path}`, {
    ...init,
    // @ts-ignore
    client,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function getToken(creds: { clientId: string; clientSecret: string; certPem: string }): Promise<string> {
  const auth = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await efiFetch(creds.certPem, '/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

// Soma o que foi efetivamente pago na cobrança consultada.
function valorPagoDaCobranca(cob: any): number {
  const lista = Array.isArray(cob?.pix) ? cob.pix : [];
  const somaPix = lista.reduce((s: number, p: any) => s + Number(p?.valor ?? 0), 0);
  if (somaPix > 0) return somaPix;
  return Number(cob?.valor?.original ?? 0);
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const pixList: { txid?: string }[] = payload?.pix ?? [];
    if (!pixList.length) return Response.json({ ok: true }); // ping de configuração

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Credenciais/mTLS da plataforma para consultar a Efí. Se não houver,
    // não marcamos nada como pago (fail-closed) — melhor pedido pendente do
    // que confirmar sem verificação.
    let creds: { clientId: string; clientSecret: string; certPem: string };
    let token: string;
    try {
      creds = credsPlataforma();
      token = await getToken(creds);
    } catch (e) {
      console.error('Webhook Pix: sem credenciais Efí para verificar; ignorando.', String(e));
      return Response.json({ ok: true, verificado: false });
    }

    for (const pix of pixList) {
      if (!pix.txid) continue;

      // Só nos interessa um pagamento PENDENTE com esse txid.
      const { data: pgto } = await supabase
        .from('pagamentos')
        .select('pedido_id, status, pedidos(valor_total, status)')
        .eq('gateway_txid', pix.txid)
        .eq('status', 'PENDENTE')
        .maybeSingle();
      if (!pgto?.pedido_id) continue;

      // VERIFICAÇÃO na fonte: consulta a cobrança direto na Efí.
      const res = await efiFetch(creds.certPem, `/v2/cob/${pix.txid}`, { method: 'GET' }, token);
      const cob = await res.json().catch(() => ({}));
      if (String(cob?.status) !== 'CONCLUIDA') continue; // ainda não paga / inexistente

      const totalPedido = Number((pgto as any).pedidos?.valor_total ?? 0);
      const pago = valorPagoDaCobranca(cob);
      // tolerância de 1 centavo para arredondamento
      if (pago + 0.01 < totalPedido) {
        console.error(`Webhook Pix: pago (${pago}) < total (${totalPedido}) para txid ${pix.txid}; não confirma.`);
        continue;
      }

      const { data: pagoRow } = await supabase
        .from('pagamentos')
        .update({ status: 'PAGO', data_pagamento: new Date().toISOString() })
        .eq('gateway_txid', pix.txid)
        .eq('status', 'PENDENTE')
        .select('pedido_id')
        .maybeSingle();

      if (pagoRow?.pedido_id) {
        await supabase
          .from('pedidos')
          .update({ status: 'ACEITO' })
          .eq('id', pagoRow.pedido_id)
          .eq('status', 'NOVO');
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
