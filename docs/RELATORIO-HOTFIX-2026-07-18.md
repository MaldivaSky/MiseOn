# Relatório — Hotfix Produção (redirect para /admin/assinatura)

**Data:** 2026-07-18 · **Responsável:** correção assistida (Kimi Code) · **Status:** corrigido, build verde, aguardando deploy

---

## 1. Causa raiz do bug de produção

**Não foi o Gemini.** O bug já estava commitado desde 15/07 (commit `99afff2`, "feat(admin): atualiza integração de personalização"), no motor de bloqueio por inadimplência do `src/pages/admin/AdminLayout.tsx`.

O `select` do Supabase buscava os dados da loja **sem as colunas de assinatura**:

```ts
// ANTES (quebrado)
.select('loja_id, papel, lojas(nome, cor_primaria, cor_secundaria, slug, criado_em)')
```

Mas o código logo abaixo lia exatamente essas duas colunas:

- `lojaInfo?.vencimento_assinatura` → sempre `undefined` → o sistema usava `criado_em` (data de criação da loja) como data de vencimento;
- `lojaInfo?.status_assinatura` → sempre `undefined` → a isenção para lojas `ATIVO`/`VITALICIO` **nunca disparava**.

**Resultado:** qualquer loja criada há mais de 5 dias caía no lockdown (`diasAtraso > 5`) e o admin era sempre redirecionado para `/admin/assinatura` — mesmo com assinatura ativa. A tela de Assinatura mostrava "Ativa & Operante" porque ela faz o `select` correto; o layout que bloqueava fazia o `select` errado. O bug "apareceu do nada" porque a loja cruzou o limiar de 5 dias após a criação.

### Correção aplicada (1 linha)

`src/pages/admin/AdminLayout.tsx:32`

```ts
// DEPOIS (corrigido)
.select('loja_id, papel, lojas(nome, cor_primaria, cor_secundaria, slug, criado_em, status_assinatura, vencimento_assinatura)')
```

---

## 2. Correções no commit quebrado (f7789ad — alterações do Gemini)

O commit `f7789ad` não compilava (8 erros de TypeScript — deploy na Vercel falhando). Ações tomadas:

| Arquivo | Problema | Ação |
|---|---|---|
| `src/components/ModalAuthCliente.tsx` | `useRef`/`useEffect` sem import; hook chamado **depois** do early return (crash do React ao abrir o modal) | Corrigido (imports + ordem dos hooks) |
| `src/pages/admin/Dashboard.tsx` | RPC inexistente (`get_itens_mais_pedidos_hoje`), join errado (`preparo_id`→`produtos`; o correto é `insumos`), variável `p` inexistente, comparações de tipo inválidas, alertas de validade passariam a exibir "Produto desconocido" | **Revertido** à versão estável (`2be083a`) |
| `src/components/ModalMinhaConta.tsx` | Regressão de layout (drawer lateral virou modal centrado com conteúdo de altura cheia) | **Revertido** à versão estável |
| `src/pages/admin/PainelPedidos.tsx` | Remoção **não solicitada** dos botões de avanço de status (NOVO→ACEITO→PREPARANDO) para todos os pedidos — travaria a operação de lojas sem tela KDS | **Revertido** à versão estável |

**Mantidos do commit** (compilam e são coerentes com a descrição "métodos de pagamento e cashback"):

- `Cardapio.tsx` / `CheckoutDrawer.tsx`: mensagem de sucesso específica por método de pagamento (Pix vs. outros) e exibição do cashback calculado sobre o valor pré-cashback;
- Migration `20260717150000`: `fn_creditar_cashback` agora calcula sobre `subtotal + taxa_entrega − desconto` (ver pendência 3.1 abaixo).

**Validação:** `npm run build` (tsc + vite) passando — build verde em ~28s.

---

## 3. Pendências de banco de dados (verificar hoje)

### 3.1 Migration editada depois de aplicada
A migration `20260717150000_fase3_agendamento_cashback_recuperacao.sql` foi **editada após já ter sido aplicada em produção**. O banco ainda tem a versão antiga da `fn_creditar_cashback`. Para atualizar, rodar no SQL Editor do Supabase (produção) apenas o bloco `create or replace function fn_creditar_cashback...` da versão atual do arquivo — ou gerar uma migration nova com esse replace.

### 3.2 Colunas de assinatura fora das migrations (schema drift)
`lojas.status_assinatura` e `lojas.vencimento_assinatura` **existem em produção** (a tela de Assinatura as lê) mas **não constam em nenhuma migration do repositório**. Gerar uma migration de regularização (`supabase db pull` ou `db diff`) para o ambiente ser reproduzível.

---

## 4. Plano de robustez (para não repetir)

1. **Gate de build antes do deploy** — exigir `npm run build` verde localmente antes de qualquer `git push` (ou GitHub Action rodando o build em todo push; hoje o erro só é descoberto na Vercel).
2. **Tipagem do Supabase** — gerar `database.types.ts` (`supabase gen types typescript`). Com tipos gerados, o `select` sem as colunas teria falhado **no TypeScript**, não em produção.
3. **Lockdown fail-open** — se a leitura da assinatura falhar (erro de rede/RLS), o sistema nunca deve bloquear a loja: erro de leitura ≠ inadimplência. Operar e alertar, nunca travar.
4. **Migrations imutáveis** — migration aplicada nunca se edita; correção é sempre uma migration nova.
5. **Regra para agentes de IA** — nenhum código gerado entra sem `tsc` verde e revisão humana; PRs pequenos e descritivos.
6. **Smoke test pós-deploy (5 min)** — checklist manual: login admin → cai no Início; login operador → cai no PDV; pedido Pix de ponta a ponta; KDS avançando status.
7. **Preview de staging** — usar os Preview Deployments da Vercel para validar antes de promover a produção.

---

## 5. Deploy

Working tree corrigido sobre o commit `f7789ad`. Para publicar:

```bash
git add -A
git commit -m "fix(admin): corrige lockdown indevido de assinatura e build quebrado"
git push
```

Após o deploy, executar o smoke test do item 4.6, começando por: **login como admin deve cair em `/admin/inicio`**.
