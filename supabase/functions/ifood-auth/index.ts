import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { lojaId, authorizationCode } = await req.json();

    if (!lojaId || !authorizationCode) {
      throw new Error('Loja ID e Authorization Code são obrigatórios');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get('IFOOD_CLIENT_ID');
    const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais da Integração iFood ausentes no servidor (SaaS).');
    }

    // 1. Trocar o User Code pelo Token de Acesso na API do iFood
    const body = new URLSearchParams({
      grantType: 'authorization_code',
      clientId: clientId,
      clientSecret: clientSecret,
      authorizationCode: authorizationCode,
      authorizationCodeVerifier: 'miseon-integradora-master' // Prevenção de falha no Oauth2 PKCE
    });

    let tokenResponse = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/userCode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    let tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      // Tentar endpoint alternativo caso a API rechace o /userCode
      tokenResponse = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error('Falha iFood Auth:', tokenData);
        throw new Error(tokenData.error?.message || 'Código inválido ou expirado.');
      }
    }

    const { accessToken, refreshToken } = tokenData;

    // 2. Descobrir qual o merchantId deste lojista usando o token
    // O iFood tem um endpoint /merchant/v1.0/merchants que lista os restaurantes atrelados ao token atual
    const merchantResponse = await fetch('https://merchant-api.ifood.com.br/merchant/v1.0/merchants', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!merchantResponse.ok) {
      const errData = await merchantResponse.json();
      throw new Error(errData.message || 'Falha ao buscar dados do restaurante no iFood.');
    }
    
    const merchants = await merchantResponse.json();
    if (!merchants || merchants.length === 0) {
      throw new Error('Nenhum restaurante encontrado para este código no iFood.');
    }
    
    const merchantId = merchants[0].id; // Assumimos o primeiro (geralmente há 1)

    // 3. Salvar no banco (lojas)
    const { error: dbError } = await supabase.from('lojas').update({
      ifood_merchant_id: merchantId,
      ifood_authorization_code: authorizationCode, // Apenas para auditoria
      ifood_refresh_token: refreshToken
    }).eq('id', lojaId);

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, merchantId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro ifood-auth:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
