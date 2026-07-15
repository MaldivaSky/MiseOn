# Credenciais e acessos do MiseOn — lista completa

Todo acesso que o sistema usa, pra onde vai, e o status de cada um. Nenhuma credencial fica
guardada neste repositório (procure e não vai achar nada aqui — é assim que tem que ser).

## 1. Supabase (banco de dados + auth + storage + funções)

| Item | Pra que serve | Onde pegar | Onde usa | Status |
|---|---|---|---|---|
| Login da conta Supabase | Acessar o painel, rodar SQL, configurar tudo abaixo | supabase.com (você já tem) | Você loga direto no site | ✅ você tem |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Frontend conversar com o banco (chave pública, segura de expor) | Supabase → Project Settings → API | `.env.local` (local) e nas env vars do Vercel (produção) | ✅ já configurado |
| **Service Role Key** | Rodar `supabase` CLI (deploy de Edge Functions) e scripts administrativos | Supabase → Project Settings → API → "service_role" (secreta!) | Só no seu terminal, nunca no código/frontend | ⚠️ você precisa pegar quando for deployar as Edge Functions |
| Personal Access Token | `supabase login` no terminal | Supabase → Account → Access Tokens | Terminal, uma vez | ⚠️ pendente — precisa pra deployar as 7 Edge Functions novas |

## 2. Google OAuth (login do cliente e do lojista)

| Item | Pra que serve | Onde pegar | Onde usa | Status |
|---|---|---|---|---|
| Client ID | Identifica o app pro Google | Google Cloud Console → Credenciais | Supabase → Authentication → Providers → Google | ✅ criado |
| Client Secret | Autoriza o Supabase a completar o login | Mesma tela, ao lado do Client ID | Mesmo lugar | ✅ você já colou (recomendo trocar por um novo, já que passou pelo chat) |
| Authorized redirect URI | Sem isso o Google recusa o login | Você mesmo cadastra | `https://zzuxklwhaoisuuvndtfw.supabase.co/auth/v1/callback` | ⚠️ confirme que está cadastrado |
| Tela de consentimento OAuth | Define quem pode logar | Google Cloud Console → APIs e Serviços | — | ⚠️ está em "Testando" — troque pra "Em produção" pra clientes reais conseguirem logar |

## 3. Efí Bank (Pix e cartão de crédito)

Guia completo pro lojista em **[EFI-SETUP.md](EFI-SETUP.md)**. Resumo do que precisa:

| Item | Onde usa |
|---|---|
| Chave Pix | Supabase secret `EFI_PIX_KEY` |
| Client ID / Client Secret do Pix | Supabase secrets `EFI_PIX_CLIENT_ID` / `EFI_PIX_CLIENT_SECRET` ou fallback `EFI_CLIENT_ID` / `EFI_CLIENT_SECRET` |
| Client ID / Client Secret de Cobranças | Supabase secrets `EFI_COBRANCAS_CLIENT_ID` / `EFI_COBRANCAS_CLIENT_SECRET` ou fallback `EFI_CLIENT_ID` / `EFI_CLIENT_SECRET` |
| Certificado `.p12` (convertido pra base64) | Supabase secret `EFI_CERT_BASE64` |

Comando pra aplicar (depois de ter os 4 itens):
```bash
supabase secrets set EFI_CLIENT_ID=... EFI_CLIENT_SECRET=... EFI_COBRANCAS_CLIENT_ID=... EFI_COBRANCAS_CLIENT_SECRET=... EFI_PIX_KEY=... EFI_CERT_BASE64="$(cat efi_base64.txt)" EFI_SANDBOX=false
```
Status: ⚠️ pendente — depende de você (ou o lojista) terminar o cadastro na Efí.

## 4. Vercel (hospedagem do site)

| Item | Onde pegar | Status |
|---|---|---|
| Login Vercel | vercel.com (você já tem, o site já está no ar) | ✅ |
| Env vars `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no projeto Vercel | Painel do projeto → Settings → Environment Variables | ⚠️ confirme que estão lá — sem isso o site builda mas não conecta no banco |

## 5. GitHub (opcional — só se quiser deploy automático a cada push)

O repo já tem um workflow pronto (`.github/workflows/ci.yml`). Só funciona se você:
1. Criar o repositório no GitHub e der `git push`.
2. Cadastrar em Settings → Secrets do repo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

Status: ⚠️ não configurado ainda — hoje o deploy é manual (`npx vercel --prod`).

## 6. Superadmin (o painel que você usa pra administrar TODAS as lojas)

| Item | Onde | Status |
|---|---|---|
| Sua conta em `plataforma_admins` | Inserida via SQL manual — veja `supabase/seed_auth.sql` (cria `superadmin@miseon.local`) ou insira seu e-mail real | ⚠️ confirme que rodou |

---

## O que EU nunca vou pedir nem guardar

Eu não guardo nenhuma dessas credenciais depois que esta conversa acaba, não tenho como logar em
nenhum desses painéis por você, e nunca vou colar um secret dentro do código ou de um arquivo do
repositório. Toda vez que uma credencial nova for necessária, minha resposta vai ser "cola isso
você mesmo em tal lugar" — é assim mesmo que tem que funcionar.
