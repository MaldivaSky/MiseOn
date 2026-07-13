// MiseOn — Edge Function: convida um funcionário para a equipe da loja
// Chamada autenticada a partir do painel admin (supabase.functions.invoke já manda o JWT do usuário).
// Só quem é 'admin' da loja pode convidar. Roda com service role pra:
//   1) achar/criar o usuário no Supabase Auth (Admin API)
//   2) vincular em usuarios_loja
//   3) registrar em auditoria

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { loja_id, email, papel, remover_user_id } = await req.json();
    if (!loja_id) return Response.json({ error: 'loja_id obrigatório' }, { status: 400 });

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: acesso } = await admin
      .from('usuarios_loja').select('papel').eq('user_id', caller.id).eq('loja_id', loja_id).maybeSingle();
    if (acesso?.papel !== 'admin') return Response.json({ error: 'Só o admin da loja pode gerenciar a equipe' }, { status: 403 });

    // remover um membro da equipe
    if (remover_user_id) {
      if (remover_user_id === caller.id) return Response.json({ error: 'Você não pode remover a si mesmo' }, { status: 400 });
      await admin.from('usuarios_loja').delete().eq('user_id', remover_user_id).eq('loja_id', loja_id);
      await admin.from('auditoria').insert({ loja_id, ator: caller.id, acao: 'equipe_remocao', detalhes: { remover_user_id } });
      return Response.json({ ok: true });
    }

    if (!email || !papel) return Response.json({ error: 'email e papel são obrigatórios' }, { status: 400 });
    if (!['admin', 'operador', 'entregador'].includes(papel)) {
      return Response.json({ error: 'papel inválido' }, { status: 400 });
    }

    // acha o usuário pelo e-mail; se não existir, convida (cria + manda e-mail de convite)
    let userId: string | undefined;
    const { data: existentes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = existentes?.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase())?.id;

    if (!userId) {
      const { data: convite, error: eConvite } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${Deno.env.get('SITE_URL') ?? ''}/admin`,
      });
      if (eConvite || !convite?.user) throw eConvite ?? new Error('Falha ao convidar usuário');
      userId = convite.user.id;
    }

    const { error: eVinculo } = await admin.from('usuarios_loja').upsert({ user_id: userId, loja_id, papel });
    if (eVinculo) throw eVinculo;

    await admin.from('auditoria').insert({
      loja_id, ator: caller.id, acao: 'equipe_convite', detalhes: { email, papel },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
