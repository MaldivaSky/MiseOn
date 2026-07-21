import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  ...init
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { cnpj, inscricao_estadual, razao_social, regime_tributario, certificado_base64, senha_certificado, csc, id_csc, ambiente } = await req.json();
    
    // Auth
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Não autorizado' }, { status: 401 });

    const { data: { loja_id } } = await supabase.from('perfis').select('loja_id').eq('id', user.id).single();
    if (!loja_id) return json({ error: 'Loja não encontrada' }, { status: 404 });

    const { data: loja } = await supabase.from('lojas').select('nome, endereco, cidade, uf, bairro, cep').eq('id', loja_id).single();

    // Determina token Master
    const isProd = ambiente === 'producao';
    const baseUrl = isProd ? 'https://api.focusnfe.com.br/v2/empresas' : 'https://homologacao.focusnfe.com.br/v2/empresas';
    const tokenMaster = isProd ? Deno.env.get('FOCUS_NFE_PROD') : Deno.env.get('FOCUS_NFE_HOMOLOG');

    if (!tokenMaster) {
      return json({ error: 'Token master não configurado no servidor' }, { status: 500 });
    }

    // Monta payload para Focus NFe
    const focusPayload = {
      cnpj: cnpj.replace(/\D/g, ''),
      inscricao_estadual: inscricao_estadual.replace(/\D/g, ''),
      razao_social: razao_social,
      nome_fantasia: loja.nome,
      regime_tributario: regime_tributario, // 'Simples Nacional', 'Regime Normal'
      logradouro: loja.endereco ? loja.endereco.split(',')[0] : 'Não Informado',
      numero: 'S/N', // Ideal seria separar, mas Focus aceita fallback
      bairro: loja.bairro || 'Centro',
      municipio: loja.cidade || 'São Paulo',
      uf: loja.uf || 'SP',
      cep: (loja.cep || '00000000').replace(/\D/g, ''),
      telefone: '11999999999',
      arquivo_certificado_base64: certificado_base64.replace(/^data:application\/x-pkcs12;base64,/, ''), // limpa cabeçalho base64 se houver
      senha_certificado: senha_certificado,
      habilita_nfce: true,
      id_token_nfce: id_csc,
      token_nfce: csc,
      enviar_email_destinatario: false
    };

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(tokenMaster + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(focusPayload)
    });

    const focusData = await res.json();
    if (!res.ok || focusData.erros) {
      console.error("Erro Focus NFe:", focusData);
      return json({ error: focusData.mensagem || focusData.erros?.[0]?.mensagem || 'Erro ao habilitar empresa na Focus NFe' }, { status: 400 });
    }

    // Sucesso! Atualiza o banco do MiseOn sem salvar o PFX/Senha
    const { error: dbErr } = await supabase.from('lojas').update({
      nfe_habilitado: true,
      nfe_ambiente: ambiente,
      nfe_regime_tributario: regime_tributario,
      nfe_inscricao_estadual: inscricao_estadual.replace(/\D/g, ''),
      nfe_id_csc: id_csc,
      nfe_csc: csc
    }).eq('id', loja_id);

    if (dbErr) throw dbErr;

    return json({ success: true, message: 'Onboarding fiscal concluído com sucesso.' });
  } catch (err: any) {
    console.error('Crash no onboarding:', err);
    return json({ error: err.message }, { status: 500 });
  }
});
