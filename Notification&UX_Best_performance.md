
  **Análise e Proposta de Melhorias – Sistema de Pedidos, Notificações e Feedback Visual (MiseOn)**

  Após examinar o código‑base, entendo o cenário atual e proponho um conjunto de melhorias que atendem aos seus pedidos: unificação
  lógica de pedidos (balcão/mesa), sistema de notificações em tempo real e feedback visual mais rico no PDV/caixa/balcão. Tudo isso
  mantendo a arquitetura existente (Supabase, React, ToastProvider) e evitando retrabalho.

  ---

  1. Situação Atual (Resumo)

  Área                 | O que já existe                                      | O que falta / pode melhorar
  **Fluxo de pedidos** | • PDV possui dois fluxos separados:                  | • Duplicação de lógica de inserção de pedido/itens
                       | `registrarVenda()` (balcão) e `enviarParaMesa()`     | entre os dois fluxos do PDV. <br>• Nenhuma
                       | (mesa). <br>• Checkout do cliente (frontend) cria    | notificação em tempo real para o PDV quando um novo
                       | pedidos com `tipo_pedido` definido, mas sem          | pedido chega via QR (mesa) ou delivery. <br>•
                       | `origem` preenchido. <br>• PainelPedidos (admin) já  | Nenhuma notificação específica quando o pedido fica
                       | escuta `INSERT` em `pedidos` e toca som + mostra     | **PRONTO** (cozinha) para o garçom/caixa. <br>•
                       | notificação do navegador.                            | Mensagens de chat (`mensagens_pedido`) só atualizam
                       |                                                      | a lista localmente (sem toast/som).
  **Notificações**     | • `ToastProvider` e `tocarSom()` disponíveis         | • ToastProvider não está envolvido na árvore raiz
                       | globalmente. <br>• PainelPedidos usa ambos para      | (main.tsx) – portanto, `useToast()` só funciona onde
                       | novos pedidos.                                       | o provider está presente (atualmente nenhum). <br>•
                       |                                                      | Nenhum uso sistemático de toast/som para eventos de
                       |                                                      | cozinha, chat ou pagamento.
  **Feedback visual**  | • Transições básicas (loading, disabled states).     | • Falta feedback imediato (toast, som, animação) ao
                       | <br>• Modal de sucesso de pagamento                  | adicionar item ao carrinho, finalizar venda, etc.
                       | (`OrderSuccessModal`).                               | <br>• Nenhuma celebração (confetti) em pagamentos
                       |                                                      | aprovados.

  ---

  1. Proposta de Melhorias

  ✅ 2.1. Unificação da Lógica de Criação de Pedido (PDV)
  **Objetivo:** Eliminar duplicação entre registrarVenda() (balcão) e enviarParaMesa() (mesa) centralizando a criação do pedido
  e seus itens em uma função reutilizável.

  **Como fazer:**

  1. Criar uma função createPedidoPedido dentro de PDV.tsx (ou em um utils) que receba um objeto com os campos variáveis
  (tipo_pedido, origem, comanda_id, mesa_numero, identificador_cliente, requer_cozinha, etc.) e os arrays de carrinho.
  2. Essa função fará:
     - insert na tabela pedidos (com os campos comuns).
     - Loop para inserir itens_pedido e itens_pedido_opcoes.
     - Retorno do pedido.id e pedido.numero.
  3. Refatorar registrarVenda() e enviarParaMesa() para chamarem essa função com seus parâmetros específicos, tratando depois as
  etapas de pagamento/mensagem de sucesso.

  **Benefício:**

- Código mais fácil de manter.
- Garante que futuras alterações (ex.: adicionar novos campos) sejam feitas em um único lugar.
- Facilita a adição de novos canais de pedido (ex.: WhatsApp) no futuro.

  ✅ 2.2. Sistema de Notificações em Tempo Real (Toast + Som)
  **Objetivo:** Usar o existente ToastProvider e tocarSom() para avisar os usuários relevantes sobre eventos críticos,
  independentemente da tela onde estejam.

  **Passos necessários:**

  1. **Habilitar o ToastProvider globalmente** – envolver a aplicação em src/main.tsx com <ToastProvider>.
  2. **Criar um hook customizado (ex.: useRealtimeNotifications)** que se inscreve em canais Supabase relevantes e dispõe
  toasts/sons conforme o papel do usuário (loja, entregador, garcom, etc.) e a rota atual.
     - **Eventos a escutar:**
       - INSERT na tabela pedidos → novo pedido.
         - Para **PDV (modo mesa)**: toast “Nova mensagem de mesa!”, som.
         - Para **PainelPedidos (já existe)**: mantemos o atual.
         - Para **KDS**: talvez apenas som (pois a tela já recarrega).
       - UPDATE na tabela pedidos onde status = 'PRONTO' → pedido pronto.
         - Para **PDV (garçom/caixa)**: toast “Pedido #N pronto para retirada/entrega!”, som.
         - Para **Entregador Rota**: toast semelhante.
       - INSERT na tabela mensagens_pedido → nova mensagem de chat.
         - Para **quem está visualizando o chat desse pedido**: apenas atualizar a lista (já faz).

- Para **outros participantes** (ex.: loja recebe mensagem do cliente/entregador): toast “Nova mensagem no pedido #N”, som.

  1. **Integrar o hook nos pontos de uso:**
     - PDV.tsx (para ouvir novos pedidos mesa e prontos).
     - Entregas.tsx / Rota.tsx (para ouvir pedidos prontos para entrega).
     - Entregas.tsx (chat de admin) e Rota.tsx (chat de entregador) para mensagens.
     - Opcional: PainelPedidos pode continuar como está ou migrar para o novo hook.

  **Benefício:**

- Usuários ficam imediatamente cientes de eventos importantes sem precisar recarregar a tela.
- Consistência: mesmo som/toast usado em toda a aplicação (padronização via tocarSom() e useToast()).
- Escalabilidade: fácil acrescentar novos eventos (ex.: pagamento aprovado, baixo estoque).

  ✅ 2.3. Feedback Visual e Sonoro Aprimorado
  **Objetivo:** Tornar a interação no PDV mais agradável e informativa, usando toasts, sons e animações leves.

  **Ações específicas:**

- **Ao adicionar item ao carrinho:** toast curto “Item adicionado” (opcional, pode ser apenas som suave).
- **Ao finalizar venda com sucesso (balcão ou mesa):**
  - Toast “Venda concluída! Pedido #N”.
  - Tocar som de sucesso (já existe tocarSom()).
  - Exibir confetti leve (bibliotecas como canvas-confetti podem ser adicionadas facilmente).
- **Ao pagar Pix e aguardar:** toast “Aguardando pagamento Pix…” + som de tick a cada 10s (opcional).
- **Ao erro:** toast de erro existente já é bom; podemos padronizar o tempo de exibição (ex.: 4s).
- **No PDV, ao mudar de modo (balcão ↔ mesa):** toast sutil confirmando a mudança.

  **Benefício:**

- Feedback imediato reduz incerteza do operador (caixa/garçom).
- Sensação de profissionalismo e modernidade.

  ---

  1. Plano de Execução (Próximos Passos)

  Para avançar, preciso da sua confirmação para realizar as seguintes alterações (todas dentro do diretório src/ e respeitando as
  convenções do projeto):

  Etapa | O que será feito                                            | Onde                       | Aprovação necessária?
  1     | Envolver a aplicação em `<ToastProvider>` em `main.tsx`.    | `src/main.tsx`             | Sim (alteração de raiz).
  2     | Criar função unificada `createPedidoPedido` em `PDV.tsx`    | `src/pages/admin/PDV.tsx`  | Não (refatoração interna).
        | (ou novo utils).                                            |                            |
  3     | Refatorar `registrarVenda()` e `enviarParaMesa()` para      | `src/pages/admin/PDV.tsx`  | Não.
        | usar a função acima.                                        |                            |
  4     | Criar hook `useRealtimeNotifications.ts` com a lógica de    | `src/lib/` ou `src/hooks/` | Sim (novo arquivo).
        | inscrição e despacho de toasts/sons.                        |                            |
  5     | Integrar o hook nos componentes relevantes: `PDV.tsx`,      | Conforme acima             | Sim (para cada arquivo).
        | `Entregas.tsx`, `Rota.tsx`, eventualmente                   |                            |
        | `PainelPedidos.tsx` (opcional).                             |                            |
  6     | Adicionar toasts/sons de sucesso e confetti nos pontos de   | `src/pages/admin/PDV.tsx`  | Sim (pequenas inserções).
        | conclusão de venda no PDV.                                  |                            |
  7     | (Opcional) Adicionar dependência `canvas-confetti` via      | `package.json`             | Sim (se optarmos pelo confetti).
        | `npm install` se quisermos usar confetti.                   |                            |

  **Observação:** Todas as mudanças serão feitas de forma incremental, preservando o comportamento atual caso algo dê errado (por
  exemplo, mantendo o antigo código comentado até validar o novo).

  ---

  1. Riscos e Considerações

- **Performance de inscrições em tempo real:** Devemos garantir que cada componente não crie múltiplas inscrições duplicadas. O
  hook deve cuidar de limpar inscrições ao desmontar (via return () => { supabase.removeChannel(canal); }).
- **Segurança:** As mensagens de toast não devem expor dados sensíveis (ex.: valor total, dados do cliente). Usaremos apenas
  informações genéricas (“Novo pedido”, “Pedido #123 pronto”).
- **Experiência do usuário:** Evitar excesso de toasts/som; definir regras claras (ex.: só toast de novo pedido se o usuário
  estiver no PDV e modo mesa).
- **Teste:** Após cada alteração, recomendo testar em ambiente de desenvolvimento com dois logins diferentes (caixa e garçom) para
  verificar se as notificações chegam corretamente.
