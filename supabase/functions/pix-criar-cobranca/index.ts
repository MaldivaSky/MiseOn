// MiseOn — Edge Function: cria cobrança Pix imediata no Efí Bank
// Porte do EfiPixService do MySuperStore (backend/apps/payments/services.py)
//
// Secrets necessários (supabase secrets set):
//   EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_PIX_KEY, EFI_CERT_BASE64 (P12/PEM), EFI_SANDBOX=true|false
//
// Fluxo: front cria o pedido -> chama esta function -> retorna txid + copia-e-cola
// A confirmação chega via pix-webhook.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br';

// mTLS: Deno.createHttpClient com o certificado do Efí
async function efiFetch(path: string, init: RequestInit, token?: string) {
  const certPem = atob(Deno.env.get('EFI_CERT_BASE64') ?? '');
  // Certificado convertido para PEM (cert + key). Ver README para converter o .p12:
  //   openssl pkcs12 -in cert.p12 -out cert.pem -nodes
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

async function getToken(): Promise<string> {
  const auth = btoa(`${Deno.env.get('EFI_CLIENT_ID')}:${Deno.env.get('EFI_CLIENT_SECRET')}`);
  const res = await efiFetch('/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const { pedido_id } = await req.json();
    if (!pedido_id) return Response.json({ error: 'pedido_id obrigatório' }, { status: 400 });

    // service role: roda no servidor, ignora RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, numero, valor_total, identificador_cliente, loja_id, lojas(nome)')
      .eq('id', pedido_id)
      .single();
    if (!pedido) return Response.json({ error: 'pedido não encontrado' }, { status: 404 });

    const token = await getToken();

    // txid: 26–35 chars alfanuméricos (regra Efí — mesmo padrão do MySuperStore)
    const txid = (pedido_id as string).replace(/-/g, '') + String(pedido.numero).padStart(3, '0');

    const body = {
      calendario: { expiracao: 3600 },
      valor: { original: Number(pedido.valor_total).toFixed(2) },
      chave: Deno.env.get('EFI_PIX_KEY'),
      solicitacaoPagador: `Pedido #${pedido.numero} — ${(pedido as any).lojas?.nome ?? 'MiseOn'}`.slice(0, 140),
    };

    const res = await efiFetch(`/v2/cob/${txid}`, { method: 'PUT', body: JSON.stringify(body) }, token);
    const charge = await res.json();
    if (!charge.txid) throw new Error(`Efí cobrança falhou: ${JSON.stringify(charge)}`);

    // QR Code (copia e cola vem direto; imagem via loc)
    let qrImagem: string | null = null;
    if (charge.loc?.id) {
      const qr = await efiFetch(`/v2/loc/${charge.loc.id}/qrcode`, { method: 'GET' }, token);
      const qrData = await qr.json();
      qrImagem = qrData.imagemQrcode ?? null;
    }

    await supabase
      .from('pagamentos')
      .update({ gateway_txid: charge.txid })
      .eq('pedido_id', pedido_id)
      .eq('metodo', 'PIX');

    return Response.json({
      txid: charge.txid,
      copia_e_cola: charge.pixCopiaECola ?? charge.location,
      qr_imagem: qrImagem,
      expiracao: 3600,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
