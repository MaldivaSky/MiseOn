import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting in-memory (best effort per isolate)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let state = rateLimitMap.get(ip);
  if (!state || now > state.resetAt) {
    state = { count: 0, resetAt: now + 10000 }; // 10 seconds window
  }
  state.count++;
  rateLimitMap.set(ip, state);
  return state.count <= 5; // Max 5 requests per 10 seconds per IP
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders });
  }

  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) throw new Error('conversation_id é obrigatório.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) throw new Error('Chave do Groq não configurada.');

    // 1. Busca a conversa e dados da loja
    const { data: convData, error: convError } = await supabase
      .from('chat_conversations')
      .select(`
        id, 
        loja_id, 
        ia_ativa,
        lojas ( nome, aberto_manual, chat_ia_ativo )
      `)
      .eq('id', conversation_id)
      .single();

    if (convError || !convData) throw new Error('Conversa não encontrada: ' + convError?.message);
    
    const lojaInfo = convData.lojas as any;
    if (!lojaInfo?.chat_ia_ativo) {
      console.log('IA desativada globalmente para esta loja.');
      return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders, status: 200 });
    }
    if (!convData.ia_ativa) {
      console.log('IA silenciada (handoff) para esta conversa.');
      return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders, status: 200 });
    }

    // 2. Verifica se a última mensagem é do cliente (não queremos a IA respondendo a si mesma ou à loja)
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('remetente_tipo, conteudo')
      .eq('conversation_id', conversation_id)
      .order('criado_em', { ascending: true })
      .limit(20);

    if (msgError || !messages || messages.length === 0) throw new Error('Erro ao buscar mensagens.');
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.remetente_tipo !== 'CLIENTE') {
      console.log('A última mensagem não é do cliente. Ignorando.');
      return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders, status: 200 });
    }

    // 3. Determina se a loja está aberta (Horário de Brasília)
    let lojaAberta = false;
    if (lojaInfo.aberto_manual !== null) {
      lojaAberta = lojaInfo.aberto_manual;
    } else {
      // Puxa horários
      const { data: horarios } = await supabase.from('horarios_funcionamento').select('*').eq('loja_id', convData.loja_id);
      
      const spTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const diaSemana = spTime.getDay(); // 0=Domingo
      const horaAtual = spTime.getHours().toString().padStart(2, '0') + ':' + spTime.getMinutes().toString().padStart(2, '0');
      
      if (horarios && horarios.length > 0) {
        const turnosHoje = horarios.filter((h: any) => h.dia_semana === diaSemana);
        for (const t of turnosHoje) {
          if (horaAtual >= t.abre.substring(0,5) && horaAtual <= t.fecha.substring(0,5)) {
            lojaAberta = true;
            break;
          }
        }
      }
    }

    // 4. Busca as taxas de entrega
    const { data: taxas } = await supabase
      .from('taxas_entrega')
      .select('bairro, valor')
      .eq('loja_id', convData.loja_id)
      .eq('ativo', true);

    let taxasContexto = 'Não há taxas de entrega cadastradas (consulte o balcão).';
    if (taxas && taxas.length > 0) {
      taxasContexto = taxas.map((t: any) => `- ${t.bairro}: R$ ${t.valor}`).join('\n');
    }

    // 5. Busca o cardápio e Ficha Técnica (Contexto sem custos)
    const { data: produtos } = await supabase
      .from('produtos')
      .select(`
        id, nome, preco, disponivel, descricao,
        fichas_tecnicas ( insumos ( nome ) )
      `)
      .eq('loja_id', convData.loja_id)
      .order('nome');

    let cardapioContexto = 'CARDÁPIO VAZIO / INDISPONÍVEL';
    if (produtos && produtos.length > 0) {
      cardapioContexto = produtos.map((p: any) => {
        // Extrai apenas os nomes dos ingredientes (sem custos)
        const ingredientesArray = (p.fichas_tecnicas || [])
          .map((ft: any) => ft.insumos?.nome)
          .filter(Boolean);
        const ingrTexto = ingredientesArray.length > 0 ? ` (Ingredientes/Alergênicos: ${ingredientesArray.join(', ')})` : '';
        const descTexto = p.descricao ? ` - Descrição: ${p.descricao}` : '';
        return `- ${p.nome}: R$ ${p.preco} (${p.disponivel ? 'EM ESTOQUE' : 'ESGOTADO'})${descTexto}${ingrTexto}`;
      }).join('\n');
    }

    // 6. Prepara o prompt para o Groq (Llama 3)
    const systemPrompt = `Você é a IA de atendimento inicial da loja "${lojaInfo.nome}" (${lojaInfo.segmento || 'alimentação'}).
STATUS DA LOJA: ${lojaAberta ? 'ABERTA' : 'FECHADA'}.

CARDÁPIO ATUAL E INGREDIENTES:
${cardapioContexto}

TAXAS DE ENTREGA:
${taxasContexto}

DIRETRIZES:
1. Seja educado, humano, rápido e responda em no máximo 2 parágrafos curtos.
2. Responda dúvidas sobre ingredientes consultando o cardápio acima para orientar sobre alérgicos ou restrições.
3. Se o cliente perguntar o que tem, recomende itens EM ESTOQUE baseados no cardápio acima. Fale o preço corretamente.
4. Se o cliente pedir algo ESGOTADO, avise educadamente que acabou.
5. Informe taxas de entrega APENAS com base na lista de taxas acima.
6. Se a loja estiver FECHADA, avise que a loja está fechada e não pode processar pedidos agora.
7. Se o cliente quiser falar com humano, avise que um atendente já foi notificado.
8. Nunca invente produtos, ingredientes, bairros ou preços que não estão no contexto.`;

    const chatHistory = messages.map((m: any) => ({
      role: m.remetente_tipo === 'CLIENTE' ? 'user' : 'assistant',
      content: m.conteudo
    }));

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: aiMessages,
        temperature: 0.3, // Temperatura baixa para não inventar preços
        max_tokens: 300
      })
    });

    const aiData = await groqResponse.json();
    if (aiData.error) throw new Error(`Erro do Groq: ${aiData.error.message}`);

    const respostaTexto = aiData.choices?.[0]?.message?.content?.trim();
    if (!respostaTexto) throw new Error('Resposta vazia gerada pela IA.');

    // Salva a resposta no banco (como SISTEMA para identificar que foi a IA)
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id,
        remetente_tipo: 'SISTEMA',
        conteudo: respostaTexto
      });

    if (insertError) throw new Error('Erro ao salvar resposta no banco.');

    // Notificação inteligente para o painel via Realtime Broadcast
    const channel = supabase.channel(`admin-alerts-${convData.loja_id}`);
    await channel.send({
      type: 'broadcast',
      event: 'chat_ia_answered',
      payload: { 
        conversation_id, 
        loja_id: convData.loja_id, 
        message: 'O Assistente IA atendeu um cliente.'
      }
    });
    supabase.removeChannel(channel);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Erro no Edge Function chat-ai-reception:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
