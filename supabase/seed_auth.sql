-- ============================================================
-- seed_auth.sql — LOGINS DE TESTE com senha conhecida
-- Rodar DEPOIS de schema.sql, schema_v2.sql e seed_natureba.sql.
-- ⚠️  Cria senhas fixas conhecidas — troque/remova antes de ter
--     clientes reais usando a loja.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cria (ou atualiza a senha de) um usuário puro no Supabase Auth.
-- Não vincula a nenhuma loja nem à plataforma — isso é feito por quem chama.
CREATE OR REPLACE FUNCTION public._seed_auth_user(p_email text, p_senha text)
RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE v_uid uuid;
BEGIN
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
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
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

  RETURN v_uid;
END $fn$;

-- Cria o usuário e vincula a ele um papel NA LOJA NATUREBA (admin/operador/entregador).
CREATE OR REPLACE FUNCTION public._seed_user_loja(p_email text, p_senha text, p_papel text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_loja uuid;
  v_uid  uuid;
BEGIN
  SELECT id INTO v_loja FROM lojas WHERE slug = 'natureba';
  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Loja "natureba" não encontrada — rode seed_natureba.sql antes.';
  END IF;

  v_uid := public._seed_auth_user(p_email, p_senha);

  INSERT INTO usuarios_loja (user_id, loja_id, papel)
  VALUES (v_uid, v_loja, p_papel)
  ON CONFLICT (user_id, loja_id) DO UPDATE SET papel = EXCLUDED.papel;

  RAISE NOTICE 'Usuário de loja pronto: % (%)', p_email, p_papel;
END $fn$;

-- ── 3 papéis da loja natureba (contas separadas entre si) ──
SELECT public._seed_user_loja('admin@natureba.local',      'natureba123', 'admin');
SELECT public._seed_user_loja('operador@natureba.local',   'natureba123', 'operador');
SELECT public._seed_user_loja('entregador@natureba.local', 'natureba123', 'entregador');

-- ── SuperAdmin (dono da plataforma MiseOn) ──
-- Conta PRÓPRIA, sem nenhum vínculo em usuarios_loja — não é dono de loja nenhuma,
-- só enxerga a tabela `lojas`/`auditoria` via fn_sou_superadmin(). Requer schema_v2.sql.
DO $$
DECLARE v_uid uuid;
BEGIN
  v_uid := public._seed_auth_user('superadmin@miseon.local', 'miseon123');
  INSERT INTO plataforma_admins (user_id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  RAISE NOTICE 'SuperAdmin pronto: superadmin@miseon.local (sem vínculo com nenhuma loja)';
END $$;

DROP FUNCTION public._seed_user_loja(text, text, text);
DROP FUNCTION public._seed_auth_user(text, text);

-- Conferência
SELECT u.email, ul.papel
FROM auth.users u
JOIN usuarios_loja ul ON ul.user_id = u.id
ORDER BY ul.papel;

SELECT u.email AS superadmin
FROM auth.users u
JOIN plataforma_admins pa ON pa.user_id = u.id;
