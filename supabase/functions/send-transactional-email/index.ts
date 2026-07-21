import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import Handlebars from 'npm:handlebars';
import nodemailer from 'npm:nodemailer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configura o transportador SMTP para o Gmail (credenciais definidas via variáveis de ambiente)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: Deno.env.get('GMAIL_USER') || 'rafaelmaldivas@gmail.com',
    pass: Deno.env.get('GMAIL_APP_PASSWORD') || 'jorz hrkh wxrd coej'
  }
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Autenticação do Usuário logado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Cliente para auth validation
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // 2. Extração de Payload
    const { templateType, data: templateData } = await req.json();

    if (!['invoice', 'payment-confirmed'].includes(templateType)) {
      throw new Error('Template type is invalid');
    }

    // 3. Verificação de Preferências de Email (Opt-in / Opt-out)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: preferences } = await supabaseAdmin
      .from('email_preferences')
      .select('transactional_allowed')
      .eq('user_id', user.id)
      .single();

    if (preferences && preferences.transactional_allowed === false) {
      console.log(`Envio ignorado: Usuário ${user.email} desativou emails transacionais.`);
      return new Response(JSON.stringify({ success: false, message: 'Usuário desativou recebimento.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 4. Renderização do Template Handlebars
    // Lendo do file system (útil em Edge Functions Deno)
    const templatePath = new URL(`./templates/${templateType}.hbs`, import.meta.url);
    const templateSource = await Deno.readTextFile(templatePath);
    
    const compiledTemplate = Handlebars.compile(templateSource);
    const html = compiledTemplate(templateData);

    const emailSubject = templateType === 'invoice' 
      ? `MiseOn: Nota Fiscal do Pedido #${templateData.numero}`
      : `MiseOn: Pagamento Confirmado #${templateData.pedidoId}`;

    // 5. Envio do Email via Nodemailer (SMTP Gmail)
    const mailOptions = {
      from: '"MiseOn" <rafaelmaldivas@gmail.com>',
      to: user.email,
      subject: emailSubject,
      html: html,
      text: `Por favor, ative a visualização HTML para ler este email da MiseOn.`
    };

    const info = await transporter.sendMail(mailOptions);

    // 6. Log no Banco de Dados
    await supabaseAdmin.from('email_log').insert({
      user_id: user.id,
      template_type: templateType,
      recipient: user.email,
      status: 'sent',
      message_id: info.messageId,
      metadata: templateData,
    });

    console.log(`Email enviado com sucesso para ${user.email} (Template: ${templateType})`);
    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('Falha ao enviar email transacional:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
