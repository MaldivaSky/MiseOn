-- ============================================================
-- Usuários de LOGIN do tenant de provas "Lanche do Paulista"
-- Cria 4 contas (admin / operador / entregador / cliente) com e-mail e senha,
-- já vinculadas aos papéis corretos. Idempotente (recria se rodar de novo).
--
-- COMO RODAR: Supabase Dashboard → SQL Editor → cole tudo → Run.
-- (Cria contas de autenticação; por isso é você quem executa.)
--
-- Senha de todas: Paulista@2026
--   admin@lanchepaulista.com       → Admin (painel completo)
--   operador@lanchepaulista.com    → Operador/Cozinha (Pedidos, Produção, Entregas)
--   entregador@lanchepaulista.com  → Entregador (App em /entregador)  [= Carlos Motoboy]
--   cliente@lanchepaulista.com     → Cliente final (vitrine /lanchepaulista)
-- ============================================================

DO $$
DECLARE
  v_loja uuid;
  v_uid  uuid;
  rec    RECORD;
BEGIN
  SELECT id INTO v_loja FROM public.lojas WHERE slug = 'lanchepaulista';
  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Rode antes o seed_lanchepaulista.sql (loja não encontrada).';
  END IF;

  -- Limpa contas de teste anteriores (cascata remove identities e vínculos)
  DELETE FROM auth.users WHERE email IN (
    'admin@lanchepaulista.com','operador@lanchepaulista.com',
    'entregador@lanchepaulista.com','cliente@lanchepaulista.com'
  );

  FOR rec IN
    SELECT * FROM (VALUES
      ('admin@lanchepaulista.com','admin'),
      ('operador@lanchepaulista.com','operador'),
      ('entregador@lanchepaulista.com','entregador'),
      ('cliente@lanchepaulista.com','cliente')
    ) AS t(email, papel)
  LOOP
    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_super_admin, is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', rec.email,
      extensions.crypt('Paulista@2026', extensions.gen_salt('bf')), now(),
      now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', initcap(split_part(rec.email,'@',1))),
      '', '', '', '', false, false, false
    );

    -- auth.identities.email é coluna gerada (derivada de identity_data->>'email'); não incluir.
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', rec.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    -- Vínculos por papel
    IF rec.papel IN ('admin','operador') THEN
      INSERT INTO public.usuarios_loja (user_id, loja_id, papel)
      VALUES (v_uid, v_loja, rec.papel)
      ON CONFLICT (user_id, loja_id) DO UPDATE SET papel = EXCLUDED.papel;
    END IF;

    IF rec.papel = 'entregador' THEN
      -- Entregador loga no app /entregador (validação por entregadores.user_id)
      UPDATE public.entregadores SET user_id = v_uid, ativo = true
      WHERE loja_id = v_loja AND nome = 'Carlos Motoboy';
    END IF;

    -- 'cliente' não precisa de vínculo: loga na vitrine; pedidos ligam por cliente_user_id.
  END LOOP;

  RAISE NOTICE 'OK: 4 usuários criados (senha Paulista@2026).';
END $$;
