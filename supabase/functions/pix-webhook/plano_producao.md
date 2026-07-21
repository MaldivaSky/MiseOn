  **Linting & Formatting**    | - Ativar **ESLint** (com plugin                   | - Arquivos `.eslintrc.js`, `.prettierrc`.<br>-
                              | `@typescript-eslint`) e **Prettier** como etapas  | Log de husky mostrando 0 erros.
                              | obrigatórias no `pre‑commit` (husky). <br>-       |
                              | Corrigir todas as violações existentes.           |
  **TypeScript Strictness**   | - Habilitar `strict`, `noImplicitAny`,            | - `tsconfig.json` atualizado.<br>- Build sem
                              | `@typescript-eslint`) e **Prettier** como etapas  | Log de husky mostrando 0 erros.
                              | obrigatórias no `pre‑commit` (husky). <br>-       |
  **Linting & Formatting**    | - Ativar **ESLint** (com plugin                   | - Arquivos `.eslintrc.js`, `.prettierrc`.<br>-
                              | `@typescript-eslint`) e **Prettier** como etapas  | Log de husky mostrando 0 erros.
                              | obrigatórias no `pre‑commit` (husky). <br>-       |
                              | Corrigir todas as violações existentes.           |
  **TypeScript Strictness**   | - Habilitar `strict`, `noImplicitAny`,            | - `tsconfig.json` atualizado.<br>- Build sem
                              | `exactOptionalPropertyTypes`,                     | erros de TS.
                              | `forceConsistentCaseInFileNames` no               |
                              | `tsconfig.json`. <br>- Corrigir quaisquer erros   |
                              | `@typescript-eslint`) e **Prettier** como etapas  | Log de husky mostrando 0 erros.
                              | obrigatórias no `pre‑commit` (husky). <br>-       |
                              | obrigatórias no `pre‑commit` (husky). <br>-       |
                              | Corrigir todas as violações existentes.           |
  **TypeScript Strictness**   | - Habilitar `strict`, `noImplicitAny`,            | - `tsconfig.json` atualizado.<br>- Build sem
                              | `exactOptionalPropertyTypes`,                     | erros de TS.
                              | `forceConsistentCaseInFileNames` no               |
                              | Corrigir todas as violações existentes.           |
  **TypeScript Strictness**   | - Habilitar `strict`, `noImplicitAny`,            | - `tsconfig.json` atualizado.<br>- Build sem
                              | `exactOptionalPropertyTypes`,                     | erros de TS.
                              | `forceConsistentCaseInFileNames` no               |
                              | `tsconfig.json`. <br>- Corrigir quaisquer erros   |
                              | de tipo que apareçam.                             |
  **Dependency Hygiene**      | - Executar `npm audit` e `npm outdated`           | - Relatório de auditoria.<br>- PRs de
                              | semanalmente. <br>- Atualizar pacotes críticos    | atualização automática.
                              | (ex.: `@supabase/supabase-js`, `crypto`,          |
  **TypeScript Strictness**   | - Habilitar `strict`, `noImplicitAny`,            | - `tsconfig.json` atualizado.<br>- Build sem
                              | `exactOptionalPropertyTypes`,                     | erros de TS.
                              | `forceConsistentCaseInFileNames` no               |
                              | `tsconfig.json`. <br>- Corrigir quaisquer erros   |
                              | `exactOptionalPropertyTypes`,                     | erros de TS.
                              | `forceConsistentCaseInFileNames` no               |
                              | `tsconfig.json`. <br>- Corrigir quaisquer erros   |
                              | de tipo que apareçam.                             |
  **Dependency Hygiene**      | - Executar `npm audit` e `npm outdated`           | - Relatório de auditoria.<br>- PRs de
                              | semanalmente. <br>- Atualizar pacotes críticos    | atualização automática.
                              | (ex.: `@supabase/supabase-js`, `crypto`,          |
                              | `lucide-react`). <br>- Utilizar `renovate` ou     |
                              | `forceConsistentCaseInFileNames` no               |
                              | `tsconfig.json`. <br>- Corrigir quaisquer erros   |
                              | de tipo que apareçam.                             |
  **Dependency Hygiene**      | - Executar `npm audit` e `npm outdated`           | - Relatório de auditoria.<br>- PRs de
                              | `tsconfig.json`. <br>- Corrigir quaisquer erros   |
                              | de tipo que apareçam.                             |
  **Dependency Hygiene**      | - Executar `npm audit` e `npm outdated`           | - Relatório de auditoria.<br>- PRs de
                              | semanalmente. <br>- Atualizar pacotes críticos    | atualização automática.
                              | de tipo que apareçam.                             |
  **Dependency Hygiene**      | - Executar `npm audit` e `npm outdated`           | - Relatório de auditoria.<br>- PRs de
                              | semanalmente. <br>- Atualizar pacotes críticos    | atualização automática.
                              | (ex.: `@supabase/supabase-js`, `crypto`,          |
  **Dependency Hygiene**      | - Executar `npm audit` e `npm outdated`           | - Relatório de auditoria.<br>- PRs de
                              | semanalmente. <br>- Atualizar pacotes críticos    | atualização automática.
                              | (ex.: `@supabase/supabase-js`, `crypto`,          |
                              | `lucide-react`). <br>- Utilizar `renovate` ou     |
                              | semanalmente. <br>- Atualizar pacotes críticos    | atualização automática.
                              | (ex.: `@supabase/supabase-js`, `crypto`,          |
                              | `lucide-react`). <br>- Utilizar `renovate` ou     |
                              | `dependabot` para PRs automáticos.                |
                              | `dependabot` para PRs automáticos.                |
  **Documentação de Código**  | - Adicionar **JSDoc**/TDoc em todas as funções    | - Arquivos `.ts` com comentários.<br>- Site de
                              | exportadas, especialmente aquelas com lógica de   | docs gerado.
                              | negócio (ex.: `fn_baixar_estoque`,                |
  **Documentação de Código**  | - Adicionar **JSDoc**/TDoc em todas as funções    | - Arquivos `.ts` com comentários.<br>- Site de
                              | exportadas, especialmente aquelas com lógica de   | docs gerado.
                              | negócio (ex.: `fn_baixar_estoque`,                |
                              | `fn_numero_pedido`, `validarHmacSha256`). <br>-   |
                              | exportadas, especialmente aquelas com lógica de   | docs gerado.
                              | negócio (ex.: `fn_baixar_estoque`,                |
                              | `fn_numero_pedido`, `validarHmacSha256`). <br>-   |
                              | Gerar docs com `typedoc` e publicar no            |
                              | negócio (ex.: `fn_baixar_estoque`,                |
                              | `fn_numero_pedido`, `validarHmacSha256`). <br>-   |
                              | Gerar docs com `typedoc` e publicar no            |
                              | repositório wiki.                                 |
                              | `fn_numero_pedido`, `validarHmacSha256`). <br>-   |
                              | Gerar docs com `typedoc` e publicar no            |
                              | repositório wiki.                                 |

                              | Gerar docs com `typedoc` e publicar no            |
                              | repositório wiki.                                 |

  ---
                              | repositório wiki.                                 |

  ---


  ---

  3. Infraestrutura & Operações
  ---

  3. Infraestrutura & Operações


  3. Infraestrutura & Operações

  Área                           | Ação                                            | Artefato esperado
  3. Infraestrutura & Operações

  Área                           | Ação                                            | Artefato esperado
  **CI/CD**                      | - Garantir que o pipeline GitHub Actions:       | - Arquivo `.github/workflows/ci.yml`.<br>-

  Área                           | Ação                                            | Artefato esperado
  **CI/CD**                      | - Garantir que o pipeline GitHub Actions:       | - Arquivo `.github/workflows/ci.yml`.<br>-
                                 | <br>1️⃣ `lint` → 2️⃣ `typecheck` → 3️⃣ `unit          | Badge de status no README.                     Área                           | Ação                                            | Artefato esperado
  **CI/CD**                      | - Garantir que o pipeline GitHub Actions:       | - Arquivo `.github/workflows/ci.yml`.<br>-
                                 | <br>1️⃣ `lint` → 2️⃣ `typecheck` → 3️⃣ `unit          | Badge de status no README.                                                    | (supabase‑test‑db)` → 5️⃣ `build` → 6️⃣�preview`    |
  **CI/CD**                      | - Garantir que o pipeline GitHub Actions:       | - Arquivo `.github/workflows/ci.yml`.<br>-
                                 | <br>1️⃣ `lint` → 2️⃣ `typecheck` → 3️⃣ `unit          | Badge de status no README.                                                    | (supabase‑test‑db)` → 5️⃣ `build` → 6️⃣�preview`    |
                                 | tests` → 4️⃣ `integration tests                   |                                                                                 | <br>1️⃣ `lint` → 2️⃣ `typecheck` → 3️⃣ `unit          | Badge de status no README.                                                    | (supabase‑test‑db)` → 5️⃣ `build` → 6️⃣�preview`    |
                                 | tests` → 4️⃣ `integration tests                   |                                                                                 | (Vercel deploy → 7️⃣ `supabase functions          |
                                 | tests` → 4️⃣ `integration tests                   |                                                                                 | deploy` (com `--no‑verify‑jwt` apenas em        |
                                 | (supabase‑test‑db)` → 5️⃣ `build` → 6️⃣�preview`    |                                                                                | (supabase‑test‑db)` → 5️⃣ `build` → 6️⃣�preview`    |                                                                                | (Vercel deploy → 7️⃣ `supabase functions          |
                                 | (Vercel deploy → 7️⃣ `supabase functions          |                                                
  **Prompt detalhado – O que ainda falta para deixar o MiseOn robusto, profissional e seguro**

  > **Objetivo:** Transformar o código‑base atual em um produto de nível enterprise, pronto para produção em escala, com garantias
  de integridade de dados, segurança de ponta‑a‑ponta e operação monitorável.
  > **Formato:** Lista de tarefas acionáveis, ordenadas por prioridade de risco/impacto, com artefatos esperados (testes,
  documentos, configurações).

  ---

  1. Segurança de Aplicação

  Área                           | Ação                           | Artefato esperado               | Comentário
  **Autenticação & Autorização** | - Revisar todas as chamadas    | - Lista de funções/endpoints    | Evita elevação de privilégio e
                                 | Supabase (client‑side) para    | que ainda não validam           | vazamento de dados entre
                                 | garantir que utilizem a        | JWT.<br>- Testes unitários de   | tenants.
                                 | **anon‑key** apenas em         | autorização (jest/vitest).      |
                                 | leituras públicas; todas as    |                                 |
                                 | mutações devem passar por      |                                 |
                                 | **service‑role** ou **JWT de   |                                 |
                                 | usuário** com RLS. <br>-       |                                 |
                                 | Avalia: `rls` são necessários  |                                 |
                                 | middlewares que validem        |                                 |
                                 | `Authorization: Bearer <jwt>`  |                                 |
                                 | nas Edge Functions que ainda   |                                 |
                                 | são públicas (ex.: endpoints   |                                 |
                                 | de webhook que não exigem      |                                 |
                                 | JWT).                          |                                 |
  **Validação de Entrada**       | - Criar um **schema de         | - Arquivo `src/validation/schem | Elimina risco de injeção,
                                 | validação centralizado** (zod  | as.ts`.<br>- Testes de falha    | overflow e dados
                                 | ou yup) para todos os          | (entradas malformadas, XSS,     | inconsistentes.
                                 | payloads recebidos (webhooks,  | SQLi).                          |
                                 | formulários, APIs internas).   |                                 |
                                 | <br>- Aplicar em:              |                                 |
                                 | `pix‑webhook`, `cartao‑pagar`, |                                 |
                                 | `ifood‑webhook`, endpoints de  |                                 |
                                 | admin, etc.                    |                                 |
  **Sanitização de Saída**       | - Escapar HTML em qualquer     | - Diretiva ou wrapper           | Previne ataques refletidos.
                                 | texto que seja renderizado no  | `safeRender.tsx`.<br>- Testes   |
                                 | cliente (mensagens de erro,    | de XSS.                         |
                                 | tooltips, labels). <br>- Usar  |                                 |
                                 | DOMPurify ou equivalente       |                                 |
                                 | antes de inserir no DOM.       |                                 |
  **Headers de Segurança HTTP**  | - Configurar o servidor        | - Arquivo `vercel.json` ou      | Reduz surface de ataque.
                                 | (Vercel/Node) para incluir:    | `middleware.ts`.                |
                                 | `Content‑Security‑Policy`,     |                                 |
                                 | `X‑Content‑Type‑Options:       |                                 |
                                 | nosniff`, `X‑Frame‑Options:    |                                 |
                                 | DENY`, `Referrer‑Policy:       |                                 |
                                 | strict‑origin‑when‑cross‑origi |                                 |
                                 | n`, `Strict‑Transport‑Security |                                 |
                                 | ` (se HTTPS).                  |                                 |
  **Proteção contra Brute Force  | - Implementar **token          | - Módulo `src/rateLimiter.ts`.< | Evita DoS e abusos de API.
  / Rate Limiting**              | bucket** ou **fixed‑window**   | br>- Logs de bloqueio.          |
                                 | em todas as Edge Functions     |                                 |
                                 | expostas (webhooks, endpoints  |                                 |
                                 | de pagamento, autenticação).   |                                 |
                                 | <br>- Limites conservadores    |                                 |
                                 | (ex.: 10 req/s por IP, 100     |                                 |
                                 | req/min por loja).             |                                 |
  **Secrets Management**         | - Garantir que **nenhum        | - Relatório de scan de          | Evita vazamento de credenciais.
                                 | secret** apareça no            | secrets.<br>- Workflow de       |
                                 | repositório (verificar         | rotação.                        |
                                 | `.gitignore`, `git-secrets`    |                                 |
                                 | scan). <br>- Rotacionar        |                                 |
                                 | chaves de serviço a cada       |                                 |
                                 | 90 dias (automático via        |                                 |
                                 | GitHub Actions).               |                                 |
  **Criptografia em Repouso**    | - Habilitar **Supabase PGP col | - Script de migração para       | Protege caso o banco seja
                                 | umn‑level encryption** para    | colunas criptografadas.<br>-    | comprometido.
                                 | campos sensíveis (ex.:         | Testes de leitura/escrita.      |
                                 | `ifood_config.client_secret`,  |                                 |
                                 | `efi_cert_base64`). <br>- Ou   |                                 |
                                 | usar `pgcrypto` com chave      |                                 |
                                 | gerenciada pelo Supabase.      |                                 |
  **Auditoria de Acesso**        | - Ativar **Supabase pg_audit** | - Extensão instalada.<br>-      | Facilidade de investigação
                                 | (ou extension equivalente)     | View `audit_log`.<br>- Alerta   | forense.
                                 | para registrar todas as DML    | no Slack/email.                 |
                                 | em tabelas críticas            |                                 |
                                 | (`pedidos`, `lancamentos_finan |                                 |
                                 | ceiros`, `ifood_config`).      |                                 |
                                 | <br>- Criar view de auditoria  |                                 |
                                 | e alertas para acessos fora    |                                 |
                                 | do horário comercial.          |                                 |

  ---

  2. Qualidade de Código & Testes

  Área                        | Ação                                              | Artefato esperado
  **Cobertura de Testes**     | - Alcançar **≥ 80 %** de cobertura de linhas em   | - Relatório `coverage/lcov.info`.<br>- Testes de
                              | unit/integration tests (jest/vitest + cypress).   | falha em `__tests__/failure/`.
                              | <br>- Criar testes de **cenários de falha**       |
                              | (estoque insuficiente, número de pedido           |
                              | duplicado, webhook HMAC inválido, entrada         |
                              | monetária malformada).                            |
  **Teste de Contrato (API)** | - Definir OpenAPI/Swagger para todos os           | - Arquivo `openapi.yaml`.<br>- Pipeline de
                              | endpoints internos (ex.:                          | contrato no CI.
                              | `/api/payments/pix-webhook`). <br>- Usar `dredd`  |
                              | ou `pact` para garantir que a implementação       |
                              | respeita o contrato.                              |
  **Linting & Formatting**    | - Ativar **ESLint** (com plugin                   | - Arquivos `.eslintrc.js`, `.prettierrc`.<br>-
                              | `@typescript-eslint`) e **Prettier** como etapas  | Log de husky mostrando 0 erros.
                              | obrigatórias no `pre‑commit` (husky). <br>-       |
                              | Corrigir todas as violações existentes.           |
  **TypeScript Strictness**   | - Habilitar `strict`, `noImplicitAny`,            | - `tsconfig.json` atualizado.<br>- Build sem
                              | `exactOptionalPropertyTypes`,                     | erros de TS.
                              | `forceConsistentCaseInFileNames` no               |
                              | `tsconfig.json`. <br>- Corrigir quaisquer erros   |
                              | de tipo que apareçam.                             |
  **Dependency Hygiene**      | - Executar `npm audit` e `npm outdated`           | - Relatório de auditoria.<br>- PRs de
                              | semanalmente. <br>- Atualizar pacotes críticos    | atualização automática.
                              | (ex.: `@supabase/supabase-js`, `crypto`,          |
                              | `lucide-react`). <br>- Utilizar `renovate` ou     |
                              | `dependabot` para PRs automáticos.                |
  **Documentação de Código**  | - Adicionar **JSDoc**/TDoc em todas as funções    | - Arquivos `.ts` com comentários.<br>- Site de
                              | exportadas, especialmente aquelas com lógica de   | docs gerado.
                              | negócio (ex.: `fn_baixar_estoque`,                |
                              | `fn_numero_pedido`, `validarHmacSha256`). <br>-   |
                              | Gerar docs com `typedoc` e publicar no            |
                              | repositório wiki.                                 |

  ---

  3. Infraestrutura & Operações

  Área                           | Ação                                            | Artefato esperado
  **CI/CD**                      | - Garantir que o pipeline GitHub Actions:       | - Arquivo `.github/workflows/ci.yml`.<br>-
                                 | <br>1️⃣ `lint` → 2️⃣ `typecheck` → 3️⃣ `unit          | Badge de status no README.                   
                                 | tests` → 4️⃣ `integration tests                   |                                                
                                 | (supabase‑test‑db)` → 5️⃣ `build` → 6️⃣�preview`    |                                               
                                 | (Vercel deploy → 7️⃣ `supabase functions          |                                                
                                 | deploy` (com `--no‑verify‑jwt` apenas em        |
                                 | staging). <br>- Bloquear merge se qualquer      |
                                 | etapa falhar.                                   |
  **Environments**               | - Manter **três** ambientes isolados: `dev`,    | - Documentação de criação de ambientes.<br>-
                                 | `staging`, `prod`. <br>- Cada ambiente com seu  | Script `scripts/setup-env.sh`.
                                 | próprio projeto Supabase (ou namespace) e       |
                                 | conjunto de secrets. <br>- Utilizar             |
                                 | `vercel.json` + `env.*` para variáveis de       |
                                 | ambiente.                                       |
  **Backup & Disaster Recovery** | - Configurar **Supabase Point‑in‑Time Recovery  | - Política de backup documentada.<br>- Log de
                                 | (PITR)** habilitado. <br>- Agendar backup       | testes de restore.
                                 | manual semanal do bucket de storage (imagens,   |
                                 | vídeos). <br>- Testar restore em ambiente de    |
                                 | staging a cada mês.                             |
  **Logging Estruturado**        | - Substituir `console.log` por um logger        | - Módulo `src/logger.ts`.<br>- Exemplos de uso
                                 | estruturado (ex.: `pino` or `winston`) com      | em funções e Edge Functions.<br>- Dashboard de
                                 | níveis (`info`, `warn`, `error`). <br>-         | logs.
                                 | Incluir campos: `requestId`, `tenantId`,        |
                                 | `timestamp`, `level`, `message`. <br>- Enviar   |
                                 | logs para um serviço de agregação (Datadog,     |
                                 | Loki, ou Supabase log‑drawer).                  |
  **Métricas & Observabilidade** | - Exportar métricas Prometheus a partir do      | - Arquivo `src/metrics.ts`.<br>- Dashboard
                                 | Node (se houver servidor próprio) ou usar       | Grafana ou equivalente.<br>- Regras de alerta.
                                 | **Supabase Metrics** + **Vercel Analytics**.    |
                                 | <br>- Métricas críticas: <br> • Latência média  |
                                 | de webhook <br> • Taxa de erros 5xx <br> •      |
                                 | Número de lançamentos financeiros por loja/dia  |
                                 | <br> • Estoque negativo bloqueado (contagem de  |
                                 | exceções). <br>- Criar alertas (ex.: > 5        |
                                 | erros/min → PagerDuty/Slack).                   |
  **Teste de Carga**             | - Executar k6 ou artillery contra os endpoints  | - Script `k6/test.js`.<br>- Relatório de
                                 | críticos (webhook Pix, criação de pedido,       | desempenho.<br>- Limite de aceitação definido.
                                 | baixa de estoque) com cenários de pico (ex.:    |
                                 | 200 req/s por 5 min). <br>- Validar que         |
                                 | latência < 800 ms e taxa de erro < 0,1 %.       |
                                 | <br>- Incluir teste de **race condition**       |
                                 | (número de pedido) e **estoque insuficiente**.  |
  **Dependency Scanning**        | - Integrar `npm audit` e `snyk test` no CI      | - Etapa no CI.
                                 | para falhar build caso haja vulnerabilidades    |
                                 | críticas.                                       |
  **Documentação Operacional**   | - Criar **Runbook** com: <br> • Como            | - Arquivo `docs/OPERATIONS.md`.<br>- Checklist
                                 | rotacionar secrets <br> • Como restaurar        | de lançamento.
                                 | backup <br> • Como verificar saúde do ledger    |
                                 | (consulta `SELECT COUNT(*) FROM                 |
                                 | lancamentos_financeiros WHERE …`) <br> • Como   |
                                 | acionar failover do Supabase (se houver).       |

  ---

  4. Funcionalidades de Negócio (Melhorias de Valor)

  Feature                                   | Descrição                                  | Artefato esperado
  **Ledger Financeiro Completo**            | - Expandir a tabela `lancamentos_financeir | - Modelo ER atualizado.<br>- Procedures
                                            | os` com colunas de taxa (ex.:              | SQL.<br>- Views `vw_dre_mensal`,
                                            | `taxa_ifood_retida`), cashback, estornos.  | `vw_caixa_extrato`.
                                            | <br>- Criar procedures para gerar          |
                                            | lançamentos automáticos a partir de        |
                                            | eventos de pagamento, estorno, ajuste de   |
                                            | estoque, cashback. <br>- Views de          |
                                            | demonstração de resultado (DRE) por loja   |
                                            | e por período.                             |
  **Integração iFood – Tratamento de        | - Implementar fila de retry com backoff    | - Módulo `src/ifood/retryQueue.ts`.<br>-
  Exceções**                                | exponencial (1s,2s,4s,8s,16s) para         | Teste de falha e recuperação.
                                            | webhooks iFood que falhem por timeout ou   |
                                            | 5xx. <br>- Dead‑letter queue para          |
                                            | inspeção manual após 5 tentativas.         |
  **Painel de Controle de Estoque**         | - Tela administrativa que exibe: estoque   | - Component React `src/pages/admin/Estoque
                                            | atual, reservas pendentes, alertas de      | Detalhe.tsx`.<br>- Testes e2e.
                                            | baixo estoque, histórico de lançamentos    |
                                            | (entrada/saída). <br>- Permite             |
                                            | lançamentos manuais de ajuste com          |
                                            | justificativa (gerando lançamento          |
                                            | financeiro de tipo `AJUSTE`).              |
  **Relatório de Lucro Real por Produto**   | - Utilizar a view `vw_lucro_real_produto`  | - Script `src/reports/lucroProduto.ts`.<br
                                            | para gerar relatórios exportáveis          | >- Template de e‑mail.
                                            | (CSV/PDF) com margem, custo real, receita  |
                                            | real. <br>- Agendar envio automático por   |
                                            | e‑mail todo segunda‑feira.                 |
  **Notificação em Tempo Real para o        | - Criar canal Realtime `ledger-alerts`     | - Subscription em `src/hooks/useLedgerAler
  Lojista**                                 | que dispara quando: <br> • Uma tentativa   | ts.ts`.<br>- UI de toast existente
                                            | de baixa de estoque falha por falta de     | reutilizada.
                                            | estoque. <br> • Um webhook retorna         |
                                            | assinatura inválida. <br> • O número de    |
                                            | lançamentos financeiros por minuto excede  |
                                            | um limiar. <br>- Exibir toast/notificação  |
                                            | no painel.                                 |
  **Teste de Aceitação (UAT)**              | - Elaborar cenários de teste baseados nas  | - Pasta `cypress/integration/uat/`.<br>-
                                            | histórias de usuário (ex.: “Como lojista,  | Relatório de execução.
                                            | quero ver o lucro real de cada produto     |
                                            | para decidir promoções”). <br>-            |
                                            | Automatizar com Cypress.                   |

  ---

  5. Plano de Entrega (Roadmap de 4 semanas)

  Semana | Foco                                      | Principais entregáveis
  **1**  | Segurança básica & qualidade de código    | - JWT middleware em todas as EFs mutáveis.<br>- Esquemas de validação Zod
         |                                           | aplicados.<br>- Lint/TypeScript strict 0 erros.<br>- CI com etapas de
         |                                           | segurança (secret scan, dependency audit).
  **2**  | Logging, métricas e observabilidade       | - Logger estruturado em todo o código.<br>- Métricas Prometheus + Grafana
         |                                           | dashboard (latência, taxa de erro, lançamentos).<br>- Alertas de webhook
         |                                           | falho e estoque insuficiente.
  **3**  | Ledger financeiro & testes de carga       | - Aplicar o diff do ledger (já fornecido).<br>- Testes unitários de
         |                                           | lançamentos (pedido, pagamento, estorno).<br>- Suite k6 com cenários de pico
         |                                           | e validação de SLA.
  **4**  | Funcionalidades de negócio & documentação | - Painel de estoque em tempo real.<br>- Relatórios de lucro real (view +
         |                                           | export).<br>- Runbook operacional e documentação de API.<br>- Demo final para
         |                                           | stakeholders.

  ---

  ✅ Checklist de “Pronto para Produção”

  - [ ] Todas as chamadas de mutação usam JWT/Service Role + RLS.
  - [ ] Nenhum secreto está versionado; rotacionado a cada 90 dias.
  - [ ] Validação de entrada (Zod) em todos os pontos de entrada externos.
  - [ ] Sanitização de saída aplicada a todo texto renderizado.
  - [ ] Headers de segurança HTTP configurados.
  - [ ] Rate limiting em todas as Edge Functions públicas.
  - [ ] Testes unitários ≥ 80 % de cobertura, incluindo cenários de falha.
  - [ ] Lint/TypeScript strict sem erros.
  - [ ] Pipeline CI/CD bloqueia merge em caso de falha.
  - [ ] Backup PITR ativo e teste de restore mensal concluído.
  - [ ] Logging estruturado enviado a sistema de agregação.
  - [ ] Métricas e alertas configurados (latência, erros, lançamentos, estoque).
  - [ ] Ledger de dupla entrada funcionando e view de lucro real validada.
  - [ ] Documentação operacional e runbook atualizados.

  Se cada item acima estiver marcado, o sistema terá atingido um nível de robustez, profissionalismo e segurança compatível com
  exigências de produção em escala.

  ---

  **Próximos passos sugeridos:**

  1. **Copie a lista acima** para um quadro de Kanban (Jira, Trello, GitHub Projects).
  2. **Atribua responsáveis** e **defina datas** com base no roadmap de 4 semanas.
  3. **Inicie a Semana 1** hoje – comece pelo secret scan e pela implementação do JWT middleware.
  4. **Ao final de cada semana**, revise o checklist e mova os itens concluídos para “Done”.

  Com esse plano, o MiseOn sairá de um protótipo funcional para uma plataforma de nível enterprise, pronta para atender às demandas
  de lojistas, investidores e reguladores. Boa implementação!