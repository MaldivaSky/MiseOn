// whatsapp-conectar — configuração self-service da integração WhatsApp do lojista.
// Chamada autenticada a partir do painel admin (supabase.functions.invoke já manda o JWT).
// Só atende se o usuário tiver vínculo com a loja; ações destrutivas exigem papel 'admin'.
// RN-15: access_token e app_secret NUNCA voltam ao frontend — só máscara •••• + últimos 4.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const WEBHOOK_URL =
  "https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/whatsapp-webhook";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function erro(msg: string, status = 400) {
  return json({ error: msg }, { status });
}

// RN-15: nunca expor segredo — só máscara com os últimos 4 caracteres
function mascarar(segredo: string | null | undefined): string | null {
  if (!segredo) return null;
  return "••••" + segredo.slice(-4);
}

function gerarVerifyToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `miseon-wa-${hex}`;
}

// Extrai mensagem legível de um erro da Graph API
function msgGraph(data: any): string {
  return data?.error?.message ?? "Erro desconhecido na API da Meta";
}

// (a) Valida o token consultando o número na Graph API
async function validarToken(phoneNumberId: string, accessToken: string) {
  const res = await fetch(
    `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, detalhe: msgGraph(data) };
  }
  return {
    ok: true as const,
    displayPhone: data.display_phone_number ?? null,
    verifiedName: data.verified_name ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { acao, loja_id } = body;
    if (!loja_id) return erro("loja_id é obrigatório");
    if (!acao) return erro("acao é obrigatória");

    // ── Autenticação do lojista (JWT no header Authorization) ──────────────
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return erro("Não autenticado", 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: acesso } = await admin
      .from("usuarios_loja")
      .select("papel")
      .eq("user_id", caller.id)
      .eq("loja_id", loja_id)
      .maybeSingle();
    if (!acesso) return erro("Você não tem acesso a esta loja", 403);

    // ações que alteram a conexão exigem admin da loja
    if (["conectar", "desconectar", "testar"].includes(acao) && acesso.papel !== "admin") {
      return erro("Só o admin da loja pode gerenciar a conexão do WhatsApp", 403);
    }

    const buscarConexao = () =>
      admin.from("whatsapp_conexoes").select("*").eq("loja_id", loja_id).maybeSingle();

    // ── status ─────────────────────────────────────────────────────────────
    if (acao === "status") {
      const [{ data: conexao }, { data: loja }, { data: eventos }] = await Promise.all([
        buscarConexao(),
        admin
          .from("lojas")
          .select("whatsapp_ia_ativo, whatsapp_templates_ativo, whatsapp_saudacao")
          .eq("id", loja_id)
          .single(),
        admin
          .from("whatsapp_eventos")
          .select("status, erro, criado_em")
          .eq("loja_id", loja_id)
          .order("criado_em", { ascending: false })
          .limit(5),
      ]);

      return json({
        ok: true,
        conexao: conexao
          ? {
              status: conexao.status,
              display_phone: conexao.display_phone,
              verified_name: conexao.verified_name ?? null,
              phone_number_id: conexao.phone_number_id,
              waba_id: conexao.waba_id,
              conectado_em: conexao.conectado_em,
              ultimo_erro: conexao.ultimo_erro,
              access_token: mascarar(conexao.access_token), // RN-15
              app_secret: mascarar(conexao.app_secret), // RN-15
            }
          : null,
        loja: {
          whatsapp_ia_ativo: loja?.whatsapp_ia_ativo ?? false,
          whatsapp_templates_ativo: loja?.whatsapp_templates_ativo ?? false,
          whatsapp_saudacao: loja?.whatsapp_saudacao ?? "",
        },
        eventos: eventos ?? [],
      });
    }

    // ── conectar ───────────────────────────────────────────────────────────
    if (acao === "conectar") {
      const { app_id, phone_number_id, waba_id, access_token, app_secret } = body;
      if (!app_id || !phone_number_id || !waba_id || !access_token || !app_secret) {
        return erro("Preencha todos os campos: App ID, Phone Number ID, WABA ID, Access Token e App Secret.");
      }

      // (a) valida o token na Graph API antes de salvar qualquer coisa
      const validacao = await validarToken(String(phone_number_id), String(access_token));
      if (!validacao.ok) {
        console.warn("conectar: token inválido:", validacao.detalhe);
        return erro(
          "Token inválido ou sem acesso a este número. Gere um novo token em " +
          "App Dashboard → WhatsApp → Configuração da API e tente novamente. " +
          `(Detalhe da Meta: ${validacao.detalhe})`,
        );
      }

      // (b) o número não pode estar conectado a outra loja (RN: 1 número = 1 loja)
      const { data: emUso } = await admin
        .from("whatsapp_conexoes")
        .select("loja_id")
        .eq("phone_number_id", String(phone_number_id))
        .maybeSingle();
      if (emUso && emUso.loja_id !== loja_id) {
        return erro("Este número já está conectado a outra loja.");
      }

      // (c) verify_token aleatório por loja
      const verifyToken = gerarVerifyToken();

      // (d) UPSERT como PENDENTE ANTES de registrar o webhook na Meta —
      //     o handshake GET precisa encontrar o verify_token no banco.
      const { error: eUpsert } = await admin.from("whatsapp_conexoes").upsert({
        loja_id,
        phone_number_id: String(phone_number_id),
        waba_id: String(waba_id),
        display_phone: validacao.displayPhone,
        access_token: String(access_token),
        app_secret: String(app_secret),
        verify_token: verifyToken,
        status: "PENDENTE",
        ultimo_erro: null,
      });
      if (eUpsert) throw eUpsert;

      const marcarErro = async (msg: string) => {
        await admin
          .from("whatsapp_conexoes")
          .update({ status: "ERRO", ultimo_erro: msg })
          .eq("loja_id", loja_id);
      };

      // (e) registra o webhook no app do lojista (app access token = app_id|app_secret)
      const subRes = await fetch(`${GRAPH}/${app_id}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          object: "whatsapp_business_account",
          callback_url: WEBHOOK_URL,
          verify_token: verifyToken,
          fields: "messages",
          access_token: `${app_id}|${app_secret}`,
        }),
      });
      const subData = await subRes.json().catch(() => ({}));
      if (!subRes.ok || subData?.success !== true) {
        const detalhe = msgGraph(subData);
        console.error("conectar: falha ao registrar webhook:", detalhe);
        await marcarErro(`Falha ao registrar o webhook no app da Meta: ${detalhe}`);
        return erro(
          "Não consegui registrar o webhook no seu app da Meta. " +
          "Confira se o App ID e o App Secret estão corretos (Configurações do app → Básico) " +
          `e tente novamente. (Detalhe da Meta: ${detalhe})`,
        );
      }

      // (f) inscreve o app na WABA — OBRIGATÓRIO: sem isto a Meta não entrega mensagens
      const wabaRes = await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const wabaData = await wabaRes.json().catch(() => ({}));
      if (!wabaRes.ok || wabaData?.success !== true) {
        const detalhe = msgGraph(wabaData);
        console.error("conectar: falha ao inscrever app na WABA:", detalhe);
        await marcarErro(`Falha ao inscrever o app na WABA: ${detalhe}`);
        return erro(
          "Webhook registrado, mas não consegui inscrever o app na sua conta do WhatsApp Business (WABA). " +
          "Confira o WABA ID e se o token tem a permissão whatsapp_business_management. " +
          `(Detalhe da Meta: ${detalhe})`,
        );
      }

      // (g) tudo certo → CONECTADO
      await admin
        .from("whatsapp_conexoes")
        .update({ status: "CONECTADO", conectado_em: new Date().toISOString(), ultimo_erro: null })
        .eq("loja_id", loja_id);

      return json({
        ok: true,
        display_phone: validacao.displayPhone,
        verified_name: validacao.verifiedName,
      });
    }

    // ── testar ─────────────────────────────────────────────────────────────
    if (acao === "testar") {
      const { data: conexao } = await buscarConexao();
      if (!conexao) return erro("Nenhuma conexão configurada para esta loja.");

      const validacao = await validarToken(conexao.phone_number_id, conexao.access_token);
      if (validacao.ok) {
        await admin
          .from("whatsapp_conexoes")
          .update({ status: "CONECTADO", ultimo_erro: null, display_phone: validacao.displayPhone })
          .eq("loja_id", loja_id);
        return json({
          ok: true,
          mensagem: `Conexão OK — número ${validacao.displayPhone} (${validacao.verifiedName}) respondendo na Meta.`,
        });
      }

      await admin
        .from("whatsapp_conexoes")
        .update({ status: "ERRO", ultimo_erro: `Teste de conexão falhou: ${validacao.detalhe}` })
        .eq("loja_id", loja_id);
      return erro(
        "A conexão falhou no teste. O token pode ter expirado — gere um novo no painel da Meta " +
        `e reconecte. (Detalhe da Meta: ${validacao.detalhe})`,
      );
    }

    // ── desconectar ────────────────────────────────────────────────────────
    if (acao === "desconectar") {
      const { data: conexao } = await buscarConexao();
      if (!conexao) return json({ ok: true }); // já estava desconectado

      // melhor esforço: desinscreve o app da WABA antes de apagar
      try {
        await fetch(`${GRAPH}/${conexao.waba_id}/subscribed_apps`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${conexao.access_token}` },
        });
      } catch (e) {
        console.warn("desconectar: falha ao desinscrever da WABA (ignorado):", e);
      }

      const { error: eDel } = await admin
        .from("whatsapp_conexoes")
        .delete()
        .eq("loja_id", loja_id);
      if (eDel) throw eDel;

      return json({ ok: true });
    }

    return erro(`Ação desconhecida: ${acao}`);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
