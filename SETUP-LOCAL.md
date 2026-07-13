# 🧪 Rodar o MiseOn localmente (sem tocar em produção)

Ambiente 100% local com Supabase em Docker. Você vê as implementações, testa os 4 fluxos
(cliente, admin, operador, entregador) com login funcionando, e só commita quando estiver certo.

## Pré-requisitos
- **Docker Desktop** rodando
- **Supabase CLI** → `npm i -g supabase` (ou `brew install supabase/tap/supabase`)
- **Node 22+**

## Passo a passo

```bash
cd MiseOn
npm install

# 1. Inicializa o Supabase local (só na 1ª vez — cria supabase/config.toml)
supabase init          # se perguntar algo, aceite os padrões

# 2. Sobe o stack local (Postgres + Auth + Studio) em Docker
supabase start
#   Ao terminar ele imprime:
#     API URL: http://127.0.0.1:54321
#     Studio URL: http://127.0.0.1:54323
#     anon key: eyJhbGciOi...   <-- copie esta chave
```

### 3. Cria o banco e os dados (na ordem)
Rode os três SQLs no Postgres local. Pelo terminal:

```bash
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
psql "$DB" -f supabase/schema.sql          # tabelas + RLS + triggers + views
psql "$DB" -f supabase/schema_v2.sql       # rastreio de entrega + painel SuperAdmin
psql "$DB" -f supabase/schema_v3.sql       # personalização (fonte/cor) + bucket de upload
psql "$DB" -f supabase/seed_natureba.sql   # loja piloto Natureba + cardápio real (com imagens)
psql "$DB" -f supabase/seed_auth.sql        # >>> LOGINS DE TESTE (+ superadmin) <<<
```

> Sem `psql`? Abra o **Studio** em http://127.0.0.1:54323 → SQL Editor e cole o
> conteúdo de cada arquivo, nessa ordem.

### 4. Aponta o front pro Supabase local
```bash
cp .env.local.example .env.local
# cole a anon key do passo 2 em VITE_SUPABASE_ANON_KEY (se for diferente do padrão)
```

### 5. Sobe o front
```bash
npm run dev
```

## 🔑 Credenciais de teste (criadas pelo seed_auth.sql)

| Papel        | E-mail                        | Senha         | Cai em            |
|--------------|-------------------------------|---------------|-------------------|
| Admin (dono) | `admin@natureba.local`        | `natureba123` | Painel de pedidos |
| Operador     | `operador@natureba.local`     | `natureba123` | Painel de pedidos |
| Entregador   | `entregador@natureba.local`   | `natureba123` | Fila de entregas  |
| SuperAdmin (dono do SaaS) | `admin@natureba.local` (mesmo usuário) | `natureba123` | `/superadmin` |

Cliente (público) não precisa de login.

## 🗺️ O que abrir para testar cada papel

| Fluxo             | URL                                   |
|-------------------|---------------------------------------|
| Landing comercial | http://localhost:5173/                |
| Vitrine (cliente) | http://localhost:5173/natureba        |
| Painel (admin)    | http://localhost:5173/admin           |

**Roteiro de teste ponta-a-ponta:**
1. Abra `/natureba`, monte um carrinho e finalize um pedido.
2. Entre em `/admin` como **admin** → o pedido aparece no painel em tempo real; avance o status.
3. Deixe o pedido "pronto/em rota" e entre como **entregador** → ele aparece na fila de entregas com rota no Google Maps.

## ♻️ Resetar o banco local
```bash
supabase db reset      # apaga e recria; depois rode os 3 SQLs de novo
# ou pare tudo:
supabase stop
```

## ⚠️ Importante
- `seed_auth.sql` é **só para local** — cria senhas fixas conhecidas. **Nunca rode em produção.**
- `.env.local` está no `.gitignore` — não vai pro repositório.
- Quando validar local, commit normal → o CI/CD leva pra produção.
