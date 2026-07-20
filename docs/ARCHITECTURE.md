# Arquitetura do Sistema: MiseOn SaaS 🏗️

Bem-vindo(a) à documentação arquitetural do MiseOn. O objetivo deste documento é permitir que novos desenvolvedores entendam a estrutura do sistema, o fluxo de dados e os princípios de segurança em poucos minutos.

---

## 1. Diagrama de Containers (Modelo C4 Simplificado)

O MiseOn é uma plataforma Cloud-Native *serverless*. Toda a complexidade de infraestrutura é abstraída por serviços gerenciados de alto desempenho, reduzindo custos e maximizando a escala.

```mermaid
C4Container
    title Arquitetura de Containers: MiseOn SaaS

    Person(lojista, "Lojista/Garçom", "Acessa o Painel e o PDV.")
    Person(cliente, "Cliente Final", "Acessa o Cardápio via QR Code na mesa ou Delivery.")

    System_Boundary(c1, "MiseOn Cloud") {
        Container(spa, "Single Page App (Vite + React)", "Hospedado no Vercel", "Interface rica. Gerencia estado com Zustand. Realiza as chamadas diretas (sem backend) via SDK do Supabase.")
        Container(supabase, "Supabase (Backend-as-a-Service)", "PostgreSQL, Auth, Realtime", "Coração dos dados e segurança (RLS). Mantém conexões WebSocket para atualizações em tempo real (Painel/KDS).")
        Container(edge, "Deno Edge Functions", "Supabase Edge", "Código seguro rodando próximo ao usuário. Usado exclusivamente para interações com APIs externas que exigem segredos corporativos.")
    }

    System_Ext(efi, "Efí Bank", "Gateway de Pagamentos Pix e Split.")

    Rel(lojista, spa, "Gerencia lojas e vendas via", "HTTPS")
    Rel(cliente, spa, "Navega e pede via", "HTTPS")
    
    Rel(spa, supabase, "Lê/Escreve dados autenticados via", "REST / WebSocket")
    Rel(spa, edge, "Invoca funções seguras via", "HTTP")
    
    Rel(edge, efi, "Gera cobrança e vincula split via", "mTLS (Certificado)")
    Rel(efi, edge, "Informa pagamentos via", "HTTP Webhook")
    Rel(edge, supabase, "Atualiza status do pagamento", "Service Role (Ignora RLS)")
```

---

## 2. Padrão de Multi-Tenancy e Segurança de Dados

O MiseOn é um sistema **B2B SaaS**, o que significa que atende centenas de clientes (Lojas) em um mesmo banco de dados compartilhado. A blindagem entre dados de lojas concorrentes é crítica.

**Como funciona o isolamento?**
- Todas as tabelas sensíveis no PostgreSQL (`produtos`, `pedidos`, `categorias`, `mesas`, `pagamentos`, etc.) possuem a coluna `loja_id`.
- A segurança **NÃO** depende do Frontend ou de lógicas de "filtragem" no código (`WHERE loja_id = X`).
- Utilizamos o poder do **Row Level Security (RLS)** do PostgreSQL. 

**Fluxo RLS na Prática:**
1. O usuário (dono da loja) faz login via *Supabase Auth*. Um token JWT é gerado.
2. Este usuário está cadastrado na tabela de permissões (`perfis_lojas`) com acesso ao seu respectivo `loja_id`.
3. As políticas SQL cadastradas no Supabase (RLS Policies) interceptam a query. Se o dono da *Loja A* tentar consultar a tabela de pedidos, o Postgres examinará o JWT dele e **automaticamente cortará** da resposta todos os pedidos da *Loja B*, mesmo que a query SQL do front-end fosse `SELECT * FROM pedidos`. 

---

## 3. Fluxo de Pagamento Pix (End-to-End)

Pagamentos financeiros exigem segurança, certificados TLS e confirmações assíncronas. Como não temos um backend Node.js tradicional, o fluxo intercala o Client e o Edge Computing.

```mermaid
sequenceDiagram
    participant C as Cliente (Frontend)
    participant S as Supabase (Banco)
    participant E as Edge Function (Criar Cobrança)
    participant F as Efí Bank (API Pix)
    participant W as Edge Function (Webhook)
    
    Note over C, S: Cliente no checkout escolhe pagar com Pix
    C->>S: 1. Cria Pedido (Status NOVO) e Pagamento (Status PENDENTE)
    C->>E: 2. Chama `pix-criar-cobranca` (Passa pedido_id)
    E->>S: 3. Lê Pedido e valida Valor com Função SQL p/ evitar spoofing
    E->>F: 4. Autentica com mTLS corporativo e envia Payload do Pix
    F-->>E: 5. Retorna `txid`, QR Code e Link Copia e Cola
    E->>S: 6. Salva o `txid` na tabela de Pagamentos
    E-->>C: 7. Devolve o QR Code para a tela
    
    Note over C, F: Cliente abre o app do banco e paga
    F->>W: 8. O Banco processa e chama o `pix-webhook` avisando o pagamento
    W->>F: 9. Webhook checa na Fonte (GET /cob/txid) para confirmar se foi pago de verdade (Segurança)
    W->>S: 10. Atualiza Pagamento p/ PAGO e Pedido p/ ACEITO
    S-->>C: 11. O canal WebSocket (Realtime) notifica a tela do cliente na hora, liberando-o!
```

---

## 4. Tecnologias Críticas e Padrões

Neste projeto adotamos tecnologias modernas e ferramentas otimizadas:

- **Frontend Core**: Vite + React 19 + TypeScript. Optamos por *Strict Mode* total para garantir que não haja vazamentos de tipagem em *runtime*.
- **Estilização**: TailwindCSS v4 + Componentes Radix UI adaptados (para Acessibilidade e Teclado). A arquitetura visual é modular (arquivos `<component>.tsx`).
- **Gerenciamento de Estado**: Embora usemos React Query (implícito) para cacheadas, usamos `Zustand` para estado global que não depende de servidor (ex: Carrinho de Compras, Modal de Configurações, Permissões de Usuário na sessão atual).
- **Tempo Real e Sincronização**: *Não gerenciamos WebSockets crus (Socket.io)*. Assinamos diretamente os canais do `Supabase Realtime`, permitindo que o Painel do Lojista (PDV e Pedidos) reaja instantaneamente a mudanças no banco (ex: um INSERT na tabela pedidos vira uma notificação visual em ms).
- **DevOps e Qualidade**: O repositório roda com proteção **Husky** + **Lint-Staged** no pre-commit. Nenhum código quebra regras do *ESLint (Flat Config)* ou violações do *TypeScript* chega à `main`. Testes de fluxos críticos de UI/Integração rodam em CI via **Cypress** com simulações (*mock* total do banco).
