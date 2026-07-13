# Como ativar o Pix e o cartão de crédito na sua loja (Efí Bank)

Este guia é para o **dono da loja** (não precisa entender de programação). Ele explica como criar
sua conta na Efí Bank — o banco que processa o Pix e o cartão de crédito *dentro* do seu cardápio
digital, sem precisar que o cliente saia do site pra pagar. Quando terminar, você me manda 4
informações (marcadas com 📋 abaixo) e eu ativo o pagamento na sua loja.

## O que é a Efí Bank e por que ela

A Efí (antiga Gerencianet) é uma instituição de pagamento homologada pelo Banco Central. Ela permite
que o pagamento com Pix seja confirmado **automaticamente** assim que o cliente paga — sem você
precisar ficar checando o extrato — e que o dinheiro do Pix e do cartão caia direto na sua conta.

## Passo 1 — Criar a conta

1. Acesse **[sejaefi.com.br](https://sejaefi.com.br)** e clique em **"Abrir conta"**.
2. Escolha entre **Pessoa Física** (CPF, se você é MEI ou autônomo) ou **Pessoa Jurídica** (CNPJ).
3. Preencha os dados pedidos e envie os documentos solicitados (RG/CNH, comprovante de endereço, e
   se for CNPJ, o cartão CNPJ e contrato social).
4. Aguarde a aprovação — normalmente leva de 1 a 3 dias úteis. Você recebe um e-mail quando a conta
   for liberada.

## Passo 2 — Criar sua chave Pix

1. Já dentro do painel da Efí, vá em **Pix → Minhas chaves**.
2. Clique em **"Nova chave"** e escolha o tipo (recomendo **e-mail** ou **chave aleatória**, são as
   mais simples de configurar).
3. 📋 **Anote essa chave** — é a primeira informação que preciso.

## Passo 3 — Criar uma aplicação (API) e pegar as credenciais

Isso é o que permite o sistema criar a cobrança Pix automaticamente, sem você precisar gerar o QR
Code manualmente a cada pedido.

1. No painel da Efí, vá em **Minha conta → Aplicações** (ou "API" no menu, dependendo da versão do
   painel).
2. Clique em **"Criar aplicação"**, dê um nome (ex: "MiseOn - minha loja") e marque a opção de
   escopo **Pix** (e **Cobranças/Cartão** também, se você quiser aceitar cartão de crédito).
3. Ao criar, a Efí mostra um **Client ID** e um **Client Secret**.
4. 📋 **Copie os dois** e guarde num lugar seguro (o Client Secret só aparece uma vez — se perder,
   você gera outro).

## Passo 4 — Gerar o certificado da API

O certificado é o que garante, tecnicamente, que só a sua loja pode criar cobranças na sua conta.

1. Ainda em **Minha conta → Aplicações**, na mesma aplicação que você criou, procure a opção
   **"Meus Certificados"** ou **"Gerar certificado"**.
2. Baixe o arquivo — ele vem no formato **`.p12`**.
3. 📋 **Guarde esse arquivo** — é a última coisa que preciso.

## Passo 5 — Sandbox ou Produção?

A Efí tem um ambiente de teste (**sandbox**), com dinheiro fictício, pra validar que tudo funciona
antes de ativar pra valer. Recomendo testarmos primeiro em sandbox e só depois trocar pra produção
(dinheiro real) — é só avisar qual dos dois você quer ativar primeiro.

## O que me enviar no final

Depois de fazer os 4 passos acima, me manda, de forma segura (não por e-mail aberto — prefira um
gerenciador de senhas compartilhado ou aplicativo de mensagem com criptografia):

| # | O que é | Onde pegou |
|---|---|---|
| 1 | Chave Pix | Passo 2 |
| 2 | Client ID | Passo 3 |
| 3 | Client Secret | Passo 3 |
| 4 | Arquivo `.p12` do certificado | Passo 4 |

Com isso eu configuro o pagamento na sua loja — leva poucos minutos depois de eu receber os dados.
Você não precisa mexer em nenhuma linha de código.

## Taxas

As taxas de Pix e de cartão (parcelamento, antecipação, etc.) são definidas pela Efí e podem mudar —
confira os valores atualizados diretamente em **sejaefi.com.br** ou com o time comercial deles antes
de abrir a conta, pra já saber quanto fica de custo por venda.
