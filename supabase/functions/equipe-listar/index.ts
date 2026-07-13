// MiseOn — Edge Function: lista a equipe (usuarios_loja + e-mail) da loja do chamador
// auth.users não é legível pelo client (nem com RLS) — por isso isso roda com service role.
// Mesmo check de permissão do equipe-convidar: só admin da própria loja.

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { loja_id } = await req.json();
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
    if (acesso?.papel !== 'admin') return Response.json({ error: 'Só o admin da loja pode ver a equipe' }, { status: 403 });

    const { data: vinculos } = await admin.from('usuarios_loja').select('user_id, papel').eq('loja_id', loja_id);
    const { data: usuarios } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    const equipe = (vinculos ?? []).map((v) => ({
      user_id: v.user_id,
      papel: v.papel,
      email: usuarios?.users.find((u) => u.id === v.user_id)?.email ?? '(desconhecido)',
    }));

    return Response.json({ equipe });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
