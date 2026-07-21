import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { nome_produto, nome_categoria } = await req.json();
    if (!nome_produto) throw new Error('nome_produto é obrigatório.');

    // Autenticação Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Usuário não autenticado.');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Acesso negado.');

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) throw new Error('Chave do Groq não configurada.');

    const prompt = `Você é um copywriter especialista em gastronomia e food delivery.\n` +
      `Escreva uma descrição extremamente apetitosa, focada em vender e fazer o cliente "salivar", para um produto chamado "${nome_produto}". ` +
      (nome_categoria ? `O produto é da categoria: ${nome_categoria}. ` : '') +
      `A descrição deve ser curta (no máximo 3 linhas), direta, sem emojis exagerados, focando em texturas, sabores e desejo. Não use aspas na resposta.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const aiData = await groqResponse.json();
    if (aiData.error) throw new Error(`Erro do Groq: ${aiData.error.message}`);

    const respostaTexto = aiData.choices?.[0]?.message?.content?.trim();
    if (!respostaTexto) throw new Error('Não foi possível gerar a descrição.');

    return new Response(JSON.stringify({ texto: respostaTexto }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Erro na Edge Function ai-gerar-descricao:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
