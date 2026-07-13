-- ============================================================
-- seed_auth.sql — LOGINS DE TESTE com senha conhecida
-- Rodar DEPOIS de schema.sql e seed_natureba.sql.
-- ⚠️  APENAS EM AMBIENTE LOCAL. Nunca rode em produção:
--     cria senhas fixas conhecidas só para testar os papéis.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cria (ou atualiza) um usuário do Supabase Auth e vincula à loja natureba
CREATE OR REPLACE FUNCTION public._seed_user(p_email text, p_senha text, p_papel text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_loja uuid;
  v_uid  uuid;
BEGIN
  SELECT id INTO v_loja FROM lojas WHERE slug = 'natureba';
  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Loja "natureba" não encontrada — rode seed_natureba.sql antes.';
  END IF;

  SELECT id INTO v_uid FROM auth.users WHERE email = p_email;

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      p_email, crypt(p_senha, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('papel', p_papel)
    );
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', p_email),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt(p_senha, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now())
     WHERE id = v_uid;
  END IF;

  INSERT INTO usuarios_loja (user_id, loja_id, papel)
  VALUES (v_uid, v_loja, p_papel)
  ON CONFLICT (user_id, loja_id) DO UPDATE SET papel = EXCLUDED.papel;

  RAISE NOTICE 'Usuário pronto: % (%)', p_email, p_papel;
END $fn$;

SELECT public._seed_user('admin@natureba.local',      'natureba123', 'admin');
SELECT public._seed_user('operador@natureba.local',   'natureba123', 'operador');
SELECT public._seed_user('entregador@natureba.local', 'natureba123', 'entregador');

DROP FUNCTION public._seed_user(text, text, text);

-- ── SuperAdmin de teste (dono da plataforma MiseOn) ──
-- Requer schema_v2.sql já aplicado (tabela plataforma_admins).
-- Reaproveita o mesmo usuário admin@natureba.local como dono do SaaS só para teste local.
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'admin@natureba.local';
  IF v_uid IS NOT NULL THEN
    INSERT INTO plataforma_admins (user_id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Conferência
SELECT u.email, ul.papel
FROM auth.users u
JOIN usuarios_loja ul ON ul.user_id = u.id
ORDER BY ul.papel;

SELECT u.email AS superadmin
FROM auth.users u
JOIN plataforma_admins pa ON pa.user_id = u.id;
