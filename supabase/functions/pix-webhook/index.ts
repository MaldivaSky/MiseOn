// MiseOn — Edge Function: webhook Pix do Efí Bank
// Porte do efi_webhook do MySuperStore (backend/apps/payments/views.py)
//
// Registrar no Efí (uma vez, com token):
//   PUT /v2/webhook/{EFI_PIX_KEY}  body: { webhookUrl: "https://SEU-PROJETO.supabase.co/functions/v1/pix-webhook?ignorar=" }
// O Efí acrescenta /pix ao final — o "?ignorar=" preserva a rota (mesmo truque do MySuperStore).
//
// Deploy sem verificação de JWT (o Efí não manda Authorization):
//   supabase functions deploy pix-webhook --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const pixList: { txid?: string; valor?: string; endToEndId?: string }[] = payload?.pix ?? [];
    if (!pixList.length) return Response.json({ ok: true }); // ping de configuração

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    for (const pix of pixList) {
      if (!pix.txid) continue;
      const { data: pgto } = await supabase
        .from('pagamentos')
        .update({ status: 'PAGO', data_pagamento: new Date().toISOString() })
        .eq('gateway_txid', pix.txid)
        .select('pedido_id')
        .maybeSingle();

      // pagamento confirmado → aceita o pedido automaticamente
      // (o trigger trg_status_pedido faz a baixa de estoque)
      if (pgto?.pedido_id) {
        await supabase
          .from('pedidos')
          .update({ status: 'ACEITO' })
          .eq('id', pgto.pedido_id)
          .eq('status', 'NOVO');
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
