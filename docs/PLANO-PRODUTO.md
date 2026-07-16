# MiseOn — Plano de Produto e Implementação
**Referência competitiva:** Anota AI Premium (R$ 99,99/mês) · **MiseOn:** R$ 150/mês
**Data:** julho/2026 · Baseado em auditoria do código real (src/ + supabase/)

---

## 1. Onde estamos — paridade com o Anota AI Premium

| Recurso do concorrente | Status MiseOn | Detalhe real do código |
|---|---|---|
| Cardápio Digital | ✅ **Melhor** | White-label por loja (tema, fontes, cores, banners, link próprio) — Anota AI não personaliza assim |
| QR Code para mesas | ❌ Falta | Enum `SALAO` existe no schema, zero UI |
| Pedidos em Balcão (PDV) | ❌ Falta | `origem: 'balcao'` previsto no schema, sem tela |
| Frente de Caixa | ❌ Falta | Sem controle de caixa/sangria/fechamento |
| App Garçom / Comanda Digital | ❌ Falta | Não existe papel "garçom" nem comanda |
| Pagamento Online | ✅ **Melhor** | Pix + crédito com split direto na conta do lojista (Efí), antecipação configurável por loja. Anota AI intermedia; nós não seguramos dinheiro. ⚠️ cartão pendente de validação com venda real |
| Cupons | ✅ Tem | Marketing → cupons (percentual/fixo, primeira compra, método exigido, validade, limite) |
| Cashback | ❌ Falta | Nada no schema |
| Recuperador de Vendas | ❌ Falta | Nada (nem registro de carrinho abandonado) |
| Agendamento de Pedidos | 🟡 Meio pronto | `agendado_para` + `aceita_agendamento` no schema; checkout não expõe |
| Cadastro de Entregadores | ✅ **Melhor** | App próprio do entregador com rota, live tracking no mapa para o cliente |
| KDS (Display de cozinha) | 🟡 Parcial | PainelPedidos é cozinha+despacho juntos; KDSProducao é produção de preparos. Falta visão "só cozinha" agregada por item |
| Gestor de Estoque | ✅ **Melhor** | Ficha técnica com baixa automática, preparos com validade/lote, rendimento multi-etapa |
| Registro de Compras | ✅ Tem | Central de Compras com sugestão automática por estoque mínimo + entrada de estoque |
| Gestão Financeira | ✅ Tem | Extrato ao vivo, KPIs, vendas por método, margem real por produto, custos fixos rateados |
| NF Automatizada (IA) | ❌ Falta | Nada fiscal no sistema |
| Integração com anúncios | ❌ Falta | Sem Pixel Meta / GA4 / catálogo |
| Suporte todos os dias | 🟡 Operacional | Central de Ajuda criada; suporte é processo, não código |

**Leitura honesta:** somos mais fortes em *operação de cozinha/custo/entrega/pagamento* (nosso diferencial de venda) e mais fracos em *salão e balcão* (PDV, mesas, garçom) e em *growth do lojista* (cashback, recuperador, anúncios). Como cobramos R$ 150 contra R$ 99,99, a paridade de salão + os diferenciais precisam ficar explícitos na proposta de valor.

---

## 2. Personas e suas dores (o plano é orientado por elas)

- **Dono** — quer saber "quanto vendi, quanto sobrou, o que falta comprar" sem planilha. Hoje: Financeiro e Compras atendem, mas o admin abre direto em Pedidos — falta um **Dashboard inicial** com o dia em uma tela.
- **Balcão/Caixa** — pessoa com fila na frente. Precisa lançar pedido em ≤ 30 segundos, receber em dinheiro/Pix/cartão, imprimir. Hoje **não tem tela para isso** (o gap mais grave).
- **Cozinha** — precisa ver "o que fazer agora", agregado ("4 X-Burger, 2 sem cebola"), com tempo e atraso gritando em cor. Hoje o PainelPedidos serve, mas mistura despacho, impressão e cancelamento.
- **Garçom** (restaurantes de salão) — abrir mesa, lançar item, fechar conta. Não existe.
- **Entregador** — já bem servido (app próprio, rota, tracking).
- **Cliente final** — já bem servido (cardápio bonito, acompanhamento em tempo real, PWA).

---

## 3. Roadmap por fases

### Fase 0 — Fechar o que está aberto (1 semana) 🔴 antes de tudo
| Item | Por quê | Esforço |
|---|---|---|
| Validar cartão com venda real de R$ 1 (tenant com conta Efí real) | É a única ponta de pagamentos sem prova ao vivo | S |
| Ativar modalidade antecipada (2ª conta Efí + 3 envs) e confirmar com suporte Efí o prazo do repasse no split | Promessa já exposta na UI | S |
| **Dashboard inicial do admin** (`/admin` → resumo do dia: vendas, pedidos abertos, alertas de estoque baixo e lote vencendo, atalho para tudo) | O dono abre o sistema e vê o negócio, não uma lista de cards | M |
| **Onboarding checklist do lojista** (banner no dashboard: cardápio ✓ pagamentos ✓ horários ✓ equipe ✓ primeira venda ✓) | Ativação do trial de 14 dias — reduz churn na entrada | S |

### Fase 1 — Balcão & PDV (2–3 semanas) 🔴 maior gap de paridade
| Item | Descrição | Esforço |
|---|---|---|
| **PDV `/admin/pdv`** | Tela touch-first: grade de produtos por categoria, carrinho lateral, cliente opcional ("Balcão"), desconto, pagamento (dinheiro com troco, Pix na tela via QR Efí, maquininha), imprime comanda + nota. Pedido nasce `origem='balcao'` e cai no fluxo normal (estoque, KDS, financeiro) | L |
| **Frente de caixa** | Abertura/fechamento de caixa por turno: fundo de troco, sangria, reforço, conferência (esperado × contado) e relatório do turno no Financeiro | M |
| **KDS puro `/admin/kds`** | Tela fullscreen para a cozinha: colunas Fila → Preparando → Pronto, itens agregados, cronômetro por pedido, cor por atraso, toque para avançar. PainelPedidos vira a visão "gerência/despacho" | M |

### Fase 2 — Salão: mesas e garçom (2–3 semanas) 🟠 paridade
| Item | Descrição | Esforço |
|---|---|---|
| **Mesas + QR por mesa** | Cadastro de mesas, QR `/loja/:slug?mesa=N`; cliente pede da mesa (`tipo_pedido='SALAO'`, sem endereço/entrega); mapa de mesas no admin (livre/ocupada/conta pedida) | M |
| **Comanda por mesa** | Vários pedidos agrupados na mesa, conta parcial, fechar conta (junto ou separado), taxa de serviço opcional | M |
| **Modo garçom** | Novo papel `garcom` (Equipe já suporta papéis): no celular, vê mapa de mesas e lança pedidos como o PDV. É um modo do PDV, não outro app | M |

### Fase 3 — Growth do lojista (2–3 semanas) 🟠 retenção/receita
| Item | Descrição | Esforço |
|---|---|---|
| **Agendamento de pedidos** | Schema pronto (`agendado_para`) — expor no checkout (janelas pelo horário de funcionamento) + seção "Agendados" no painel + lembrete | S |
| **Recuperador de vendas** | Registrar carrinho abandonado e Pix não pago; lista "Vendas para recuperar" no Marketing com botão WhatsApp (mensagem pronta + cupom opcional). Fase 2 do item: automação | M |
| **Cashback** | % configurável por loja; saldo por cliente (tabela `cashback_clientes`); crédito no pedido FINALIZADO, uso no checkout como desconto; extrato para o cliente em Meus Pedidos | M |
| **Pixel & anúncios** | Campos Meta Pixel ID / GA4 na Loja; eventos ViewContent/AddToCart/Purchase no cardápio; guia na Central de Ajuda ("anuncie seu cardápio") | S |

### Fase 4 — Fiscal (3–4 semanas, pode correr em paralelo) 🟡
| Item | Descrição | Esforço |
|---|---|---|
| **NFC-e automatizada** | Integrar emissor via API (Focus NFe / PlugNotas / NFE.io — avaliar custo por nota ~R$ 0,10–0,20): certificado A1 do lojista, CFOP/NCM padrão alimentício com revisão assistida ("IA" do concorrente é isso), emitir na finalização, PDF/XML no pedido. Começar por 1 UF piloto (SP) | L |

### Contínuo — Qualidade & UX (toda semana, junto das fases)
- **Consistência visual**: hoje há 3 linguagens (admin claro Tailwind, PainelPedidos dark custom, KDS custom). Definir tokens únicos e padronizar botões/cards/inputs (component kit pequeno: `Botao`, `Card`, `Campo`, `Badge`).
- **Mobile do admin**: dono opera do celular — auditar cada tela em 375px (Financeiro e Loja têm tabelas/grids apertados).
- **Estados vazios que ensinam**: toda tela vazia com "o que é isso + botão do primeiro passo" (padrão já usado na Equipe).
- **Impressão térmica**: revisar templates 58/80mm com lojista real.
- **Sons/notificações configuráveis** no painel (volume, repetição para pedido não aceito).
- **Performance**: bundle único de 2,5 MB — code-split por rota (`React.lazy`) na Fase 1.

---

## 4. Ordem executiva resumida

1. **Fase 0** — fecha pendências de pagamento + dashboard/onboarding (1 semana)
2. **Fase 1** — PDV + caixa + KDS puro (o gap que trava venda para restaurante físico)
3. **Fase 2** — Mesas/QR/garçom (fecha a paridade de salão)
4. **Fase 3** — Agendamento (quick win), recuperador, cashback, pixel
5. **Fase 4** — NFC-e (paralelizável; depende de contratação do emissor)

**Total estimado: 10–13 semanas** para paridade total + diferenciais. A cada fase: testar com o Lanche do Paulista (tenant de provas), demo no Natureba só com autorização.

## 5. Posicionamento (para o comercial)
Contra o Anota AI Premium, o MiseOn vende o que eles não têm: **dinheiro direto na conta do lojista (split), custo real por ficha técnica (margem por produto), app de entregador com tracking, marca própria por loja e multi-loja**. As Fases 1–2 eliminam o argumento "mas ele tem PDV/mesa/garçom"; a Fase 3 elimina "tem cashback/recuperador"; a 4, "emite nota".
