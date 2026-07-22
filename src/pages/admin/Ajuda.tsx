import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  LifeBuoy, ChevronDown, Landmark, QrCode, CreditCard, Check,
  ExternalLink, MessageCircle, ShieldCheck, Wallet, HelpCircle, ClipboardList,
  Settings, BarChart3, Users, PhoneCall, PlayCircle, MonitorSmartphone, LayoutDashboard
} from 'lucide-react';
import { EFI_TARIFAS, EFI_LINKS } from '../../lib/efiInfo';

const WHATSAPP_SUPORTE = '5511919889233';
const zapSuporte = (msg: string) => `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(msg)}`;

/* ── Bloco expansível (acordeão) ── */
function Expansivel({ titulo, icone, aberto_inicial = false, children }: {
  titulo: string; icone?: ReactNode; aberto_inicial?: boolean; children: ReactNode;
}) {
  const [aberto, setAberto] = useState(aberto_inicial);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm transition-all hover:shadow-md">
      <button onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50 dark:hover:bg-white/5">
        <span className="flex items-center gap-2.5 text-sm font-bold dark:text-gray-100">
          {icone}{titulo}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="border-t border-gray-100 px-4 py-4 text-sm leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Passo numerado do guia ── */
function Passo({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 shadow-sm">
      <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--cor-primaria)] font-black text-white shadow-md">{n}</div>
      <h4 className="mb-2 pl-3 text-sm font-black dark:text-gray-100">{titulo}</h4>
      <div className="space-y-2 pl-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{children}</div>
    </div>
  );
}

export default function Ajuda() {
  const [tabAtiva, setTabAtiva] = useState<'sistema' | 'integracoes' | 'financeiro' | 'indicadores' | 'especialista'>('sistema');

  return (
    <div className="mx-auto max-w-4xl p-4 pb-16">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-[var(--cor-primaria)]/10 p-3 text-[var(--cor-primaria)] shadow-inner">
            <LifeBuoy size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight dark:text-gray-100">Central de Ajuda</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tudo explicado sem tecniquês para você dominar o MiseOn.</p>
          </div>
        </div>
        <a href={zapSuporte('Olá! Preciso de uma ajuda com o sistema.')} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 text-sm font-bold text-green-600 transition hover:bg-green-500/20 dark:text-green-400">
          <MessageCircle size={16} /> Suporte Rápido
        </a>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="mb-8 flex overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm dark:bg-gray-900 border border-gray-100 dark:border-gray-800 scrollbar-hide">
        <button onClick={() => setTabAtiva('sistema')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'sistema' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <Settings size={18} /> Como Funciona
        </button>
        <button onClick={() => setTabAtiva('integracoes')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'integracoes' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <MessageCircle size={18} /> Integrações
        </button>
        <button onClick={() => setTabAtiva('financeiro')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'financeiro' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <Wallet size={18} /> Pagamentos Efí
        </button>
        <button onClick={() => setTabAtiva('indicadores')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'indicadores' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <BarChart3 size={18} /> Indicadores
        </button>
        <button onClick={() => setTabAtiva('especialista')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'especialista' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <Users size={18} /> Especialista
        </button>
      </div>

      {/* ── TAB: SISTEMA ── */}
      {tabAtiva === 'sistema' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-indigo-50/30 p-6 dark:border-blue-900/30 dark:from-blue-900/10 dark:to-indigo-900/10">
             <div className="flex items-start gap-4">
               <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                  <PlayCircle size={24} className="text-blue-600 dark:text-blue-400" />
               </div>
               <div>
                  <h3 className="mb-2 text-lg font-black text-blue-900 dark:text-blue-100">Bem-vindo ao MiseOn!</h3>
                  <p className="text-sm leading-relaxed text-blue-800/80 dark:text-blue-200/80">
                    O sistema foi desenhado para ser rápido e à prova de falhas. Aqui você entende a lógica por trás de cada tela e como aproveitar ao máximo a operação do seu restaurante.
                  </p>
               </div>
             </div>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <ClipboardList size={18} className="text-[var(--cor-primaria)]" /> O caminho de um pedido (e por que ele existe)
          </h3>
          <div className="space-y-3 mb-10">
            <Expansivel titulo="As 5 etapas de um pedido" icone={<MonitorSmartphone size={16} className="text-purple-500"/>} aberto_inicial>
              <p>Todo pedido passa por uma fila organizada. Cada etapa tem um dono — assim nada se perde:</p>
              <ol className="list-decimal space-y-2 pl-5 mt-2">
                <li><b>Novo:</b> o pedido acabou de chegar (site, iFood ou PDV) e toca um aviso no painel;</li>
                <li><b>Aceito:</b> alguém do balcão confirmou o pedido — <b>aqui o estoque é baixado automaticamente</b>;</li>
                <li><b>Na cozinha:</b> o pedido foi enviado para o preparo e aparece na tela <b>Cozinha (KDS)</b>;</li>
                <li><b>Pronto:</b> a cozinha terminou. O pedido volta para o balcão conferir e entregar;</li>
                <li><b>Finalizado:</b> entregue ao cliente. A venda entra no seu Financeiro.</li>
              </ol>
              <div className="mt-4 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/10">
                <p className="text-xs text-purple-800 dark:text-purple-300">
                  💡 O sistema <b>bloqueia pulos de etapa</b> de propósito: é a garantia de que nenhum pedido sai
                  sem passar pelo preparo ou sem baixar o estoque corretamente.
                </p>
              </div>
            </Expansivel>
            <Expansivel titulo="Por que não consigo confirmar/finalizar um pedido?">
              <p>Os motivos mais comuns — todos com solução rápida:</p>
              <ul className="list-disc space-y-2 pl-5 mt-2">
                <li><b>Estoque insuficiente:</b> algum ingrediente da ficha técnica está zerado. Corrija em <Link to="/admin/estoque" className="font-semibold text-[var(--cor-primaria)] hover:underline">Estoque</Link> e confirme de novo;</li>
                <li><b>Falta enviar para a cozinha:</b> pedido com itens de preparo precisa ir para a cozinha antes de ficar pronto;</li>
                <li><b>Pedido de entrega:</b> precisa sair para rota (tela <Link to="/admin/entregas" className="font-semibold text-[var(--cor-primaria)] hover:underline">Entregas</Link>) antes de finalizar.</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Quando algo bloqueia, o aviso vermelho na tela já mostra o motivo e o botão para resolver.
              </p>
            </Expansivel>
            <Expansivel titulo="Como funciona a integração com o iFood">
              <p>Depois de vinculada em <Link to="/admin/ifood" className="font-semibold text-[var(--cor-primaria)] hover:underline">Integração iFood</Link>, o processo é mágico:</p>
              <ol className="list-decimal space-y-1.5 pl-5 mt-2">
                <li>O cliente pede no app do iFood e o pedido <b>cai sozinho</b> no seu Painel de Pedidos, com selo vermelho "iFood";</li>
                <li>Você confirma e produz normalmente — o fluxo é o mesmo dos outros pedidos;</li>
                <li>No Financeiro, a <b>taxa do iFood já vem descontada</b>: você vê o bruto, a taxa retida e o líquido real.</li>
              </ol>
              <div className="mt-3 border-l-2 border-red-500 pl-3">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Para os itens baterem certinho e baixar estoque:</p>
                <p className="text-sm mt-1">
                  Cada produto seu precisa do <b>Código iFood (PDV)</b> preenchido — o mesmo código que está no
                  Portal do Parceiro. Faça isso na aba <b>De-Para de Produtos</b>. Itens sem código entram no pedido, mas não baixam estoque automaticamente.
                </p>
              </div>
            </Expansivel>
            <Expansivel titulo="Gestão de Estoque e Fichas Técnicas">
              <p>
                O coração do MiseOn é a ficha técnica. Ao invés de baixar apenas o "Hambúrguer", o sistema baixa "150g de carne", "1 Pão", "2 fatias de queijo".
              </p>
              <ul className="list-disc space-y-1.5 pl-5 mt-2">
                <li><b>Insumos:</b> Cadastre os ingredientes brutos (ex: Saco de Batata de 2kg).</li>
                <li><b>Produtos Finais:</b> O que você vende (ex: Porção de Batata de 300g).</li>
                <li><b>Ficha Técnica:</b> É onde você liga um ao outro. Adicione os insumos e as quantidades usadas dentro de cada Produto.</li>
              </ul>
              <p className="mt-2 text-xs text-gray-500">Isso garante que você saiba exatamente o seu custo real (CMV) e nunca venda algo que não tem na despensa.</p>
            </Expansivel>
          </div>
        </div>
      )}

      {/* ── TAB: INTEGRAÇÕES ── */}
      {tabAtiva === 'integracoes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 rounded-3xl border border-green-200/60 bg-gradient-to-br from-green-50 to-emerald-50/30 p-6 dark:border-green-900/30 dark:from-green-900/10 dark:to-emerald-900/10">
             <div className="flex items-start gap-4">
               <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                  <MessageCircle size={24} className="text-green-600 dark:text-green-400" />
               </div>
               <div>
                  <h3 className="mb-2 text-lg font-black text-green-900 dark:text-green-100">Seu WhatsApp atendendo sozinho — de verdade</h3>
                  <p className="text-sm leading-relaxed text-green-800/80 dark:text-green-200/80">
                    A IA do MiseOn responde seus clientes no WhatsApp usando os dados <b>reais</b> da sua loja — cardápio, preços, estoque e horário.
                    Quando o cliente quer pedir, ele finaliza no seu cardápio digital e o pedido cai direto no seu painel, com selo verde.
                  </p>
               </div>
             </div>
             <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-black/20 backdrop-blur">
                  <MessageCircle size={20} className="mt-0.5 shrink-0 text-green-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Responde dúvidas</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Preço, ingredientes, taxa de entrega, horário — tudo lido do seu cadastro.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-black/20 backdrop-blur">
                  <QrCode size={20} className="mt-0.5 shrink-0 text-green-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Manda o cardápio</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Na hora de pedir, o cliente recebe o link e monta o carrinho com preço real.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-black/20 backdrop-blur">
                  <ClipboardList size={20} className="mt-0.5 shrink-0 text-green-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Pedido no painel</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Cai como "Novo" com selo WhatsApp. Você aceita como qualquer pedido.</p>
                  </div>
                </div>
              </div>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <MessageCircle size={18} className="text-[var(--cor-primaria)]" /> WhatsApp com IA — como funciona
          </h3>
          <div className="space-y-3 mb-10">
            <Expansivel titulo="O que a IA faz (e o que ela NUNCA faz)" aberto_inicial>
              <p><b>Ela responde, você vende.</b> A IA é uma recepcionista: tira dúvidas e apresenta o cardápio. Quem fecha o pedido é o cliente, no seu site.</p>
              <ul className="list-disc space-y-1.5 pl-5 mt-2">
                <li><b>Responde com dados reais:</b> preço, ingredientes, ficha técnica, taxa de entrega e horário vêm direto do seu cadastro — se está esgotado no estoque, ela avisa;</li>
                <li><b>Nunca inventa preço nem desconto:</b> valores só aparecem se existirem no sistema. Isso protege você de ter que honrar uma "promoção" que não existe;</li>
                <li><b>Não fecha pedido sozinha:</b> o cliente recebe o link do cardápio e finaliza no site. O pedido chega no painel para <b>você aceitar</b>, como sempre;</li>
                <li><b>Alergia é com você:</b> se o cliente mencionar alergia ou intolerância, a IA coloca um aviso de segurança e <b>te chama na hora</b> — assunto de saúde nunca é automatizado;</li>
                <li><b>Áudio e imagem:</b> por enquanto ela avisa que não entende e te chama para assumir.</li>
              </ul>
            </Expansivel>
            <Expansivel titulo="Você continua no controle da conversa">
              <p>Todas as conversas — WhatsApp e chat do site — chegam na mesma caixa de entrada, em <b>Conversas</b>:</p>
              <ul className="list-disc space-y-1.5 pl-5 mt-2">
                <li>Cada conversa tem <b>selo de origem</b> (🟢 WhatsApp ou 🌐 Site), nome e telefone do cliente;</li>
                <li><b>Assumiu, a IA cala:</b> basta você responder que a IA silencia naquela conversa na hora;</li>
                <li>Quer a IA de volta? Um clique devolve a conversa para ela;</li>
                <li><b>Botão de emergência:</b> desligar a IA não desliga o recebimento — as mensagens continuam chegando para você atender manualmente.</li>
              </ul>
            </Expansivel>
            <Expansivel titulo="O que você precisa para conectar">
              <p><b>Opção A — disponível hoje: número dedicado.</b> Você usa um chip novo só para o atendimento automático (qualquer pré-pago serve). O assistente de conexão te guia em 4 passos, com imagem de cada tela, e valida tudo sozinho.</p>
              <p className="mt-2"><b>Opção B — em breve: manter seu número atual.</b> Conexão com Facebook em poucos cliques, mantendo o WhatsApp que você já usa no celular. Estamos finalizando a homologação com a Meta para liberar essa opção.</p>
              <div className="mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/10">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ <b>Importante:</b> na Opção A, o número escolhido sai do WhatsApp comum e passa a ser só do atendimento automático.
                  Por isso recomendamos um chip dedicado — nunca o número que você já usa para falar com clientes.
                </p>
              </div>
            </Expansivel>
            <Expansivel titulo="Quanto custa">
              <ul className="list-disc space-y-1.5 pl-5">
                <li><b>Sem mensalidade de integração</b> — está incluído no seu plano MiseOn;</li>
                <li><b>Cliente mandou mensagem primeiro?</b> Você tem 24h para responder livremente, sem custo por conversa*;</li>
                <li><b>Fora da janela de 24h</b> (ex.: avisar um cliente do dia anterior) só é possível com mensagens-modelo pagas — <b>desligadas por padrão</b>. Se um dia você quiser ligar, o custo estimado aparece na tela antes de confirmar;</li>
                <li>Você pode desligar tudo quando quiser, sem multa e sem burocracia.</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                *A Meta (dona do WhatsApp) anunciou que passará a cobrar alguns centavos por mensagem a partir de outubro/2026.
                Avisaremos com antecedência — e a decisão de manter ligado será sempre sua.
              </p>
            </Expansivel>
            <Expansivel titulo="Como acompanhar se está funcionando">
              <ul className="list-disc space-y-1.5 pl-5">
                <li><b>Saúde da conexão:</b> a tela de integração mostra o semáforo (conectado/pendente/erro) e o motivo em português claro se algo falhar;</li>
                <li><b>Pedidos com selo 🟢:</b> todo pedido vindo do WhatsApp aparece marcado no Painel de Pedidos, com link para ver a conversa;</li>
                <li><b>Resultado no Dashboard:</b> conversas atendidas, % resolvidas sem você intervir e pedidos gerados — a prova do retorno.</li>
              </ul>
            </Expansivel>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <MonitorSmartphone size={18} className="text-[var(--cor-primaria)]" /> Outras integrações
          </h3>
          <div className="space-y-3 mb-10">
            <Expansivel titulo="iFood">
              <p>
                A integração com o iFood já está disponível e explicada na aba <b>Como Funciona</b> —
                pedidos caindo sozinhos no painel e taxas descontadas no Financeiro.
                Configure em <Link to="/admin/ifood" className="font-semibold text-[var(--cor-primaria)] hover:underline">Integração iFood</Link>.
              </p>
            </Expansivel>
          </div>
        </div>
      )}

      {/* ── TAB: FINANCEIRO (EFI) ── */}
      {tabAtiva === 'financeiro' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/30 p-6 dark:border-emerald-900/30 dark:from-emerald-900/10 dark:to-teal-900/10">
             <div className="flex items-start gap-4">
               <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
                  <Wallet size={24} className="text-emerald-600 dark:text-emerald-400" />
               </div>
               <div>
                  <h3 className="mb-2 text-lg font-black text-emerald-900 dark:text-emerald-100">Como o dinheiro chega até você</h3>
                  <p className="text-sm leading-relaxed text-emerald-800/80 dark:text-emerald-200/80">
                    Quando seu cliente paga <b>online</b>, o valor vai <b>direto para sua conta Efí</b>. O MiseOn não segura o seu dinheiro. Configure em 3 passos simples.
                  </p>
               </div>
             </div>
             <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-black/20 backdrop-blur">
                  <QrCode size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Pix Inteligente</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Cai na sua conta na mesma hora. Conciliação automática.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-black/20 backdrop-blur">
                  <CreditCard size={20} className="mt-0.5 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Cartões</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Escolha receber no prazo padrão (~31 dias) ou antecipado (2 dias).</p>
                  </div>
                </div>
              </div>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <Landmark size={18} className="text-[var(--cor-primaria)]" /> Guia: configurando seus recebimentos
          </h3>
          <div className="space-y-4 mb-10">
            <Passo n={1} titulo="Abra sua conta no Efí Bank (é grátis)">
              <p>A conta Efí é <b>sua</b> e não tem mensalidade. É nela que o dinheiro das vendas cai.</p>
              <ul className="list-disc space-y-1 pl-5 mt-2">
                <li><b>CNPJ ativo</b> (MEI serve!) e documento com foto;</li>
                <li>Baixe o app <b>Efí Bank</b>, vá em "Abrir conta" → "Efí Empresas";</li>
                <li>Aprovação costuma sair no mesmo dia.</li>
              </ul>
              <a href={EFI_LINKS.abrirConta} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-4 py-2 text-xs font-bold text-white transition hover:brightness-110">
                Abrir minha conta Efí <ExternalLink size={13} />
              </a>
            </Passo>

            <Passo n={2} titulo="Copie o Identificador de conta">
              <p>É um código seguro que só serve para depositar dinheiro na sua conta.</p>
              <ol className="list-decimal space-y-1 pl-5 mt-2">
                <li>Acesse o painel Efí no computador;</li>
                <li>No menu lateral, clique em <b>API</b> → <b>Identificador de conta</b> (topo direito);</li>
                <li>Copie e cole aqui em <b>Configurações da Loja → Pagamentos</b>.</li>
              </ol>
            </Passo>

            <Passo n={3} titulo="Informe CPF/CNPJ e Conta para o Pix">
              <p>Para o Pix cair direto (Split), preencha em <b>Configurações da Loja → Pagamentos</b>:</p>
              <ul className="list-disc space-y-1 pl-5 mt-2">
                <li><b>CPF ou CNPJ</b> do titular da conta Efí;</li>
                <li><b>Número da conta Efí</b> (veja no app em Perfil → Dados da conta).</li>
              </ul>
            </Passo>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <Wallet size={18} className="text-[var(--cor-primaria)]" /> Taxas do Efí Bank (por venda)
          </h3>
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 mb-2">
            {[
              { forma: 'Pix', detalhe: 'cai na hora', taxa: EFI_TARIFAS.pix },
              { forma: 'Crédito à vista', detalhe: 'prazo padrão ou antecipado', taxa: EFI_TARIFAS.creditoAVista },
              { forma: 'Crédito parcelado 2–6x', detalhe: 'prazo padrão (1 parcela / ~31 dias)', taxa: EFI_TARIFAS.creditoParcelado2a6 },
              { forma: 'Crédito parcelado 7–12x', detalhe: 'prazo padrão (1 parcela / ~31 dias)', taxa: EFI_TARIFAS.creditoParcelado7a12 },
              { forma: 'Antecipação ⚡', detalhe: 'recebe tudo em ~2 dias úteis', taxa: `${EFI_TARIFAS.creditoAVista} + ${EFI_TARIFAS.antecipacaoPorParcela}/parcela` },
              { forma: 'Dinheiro / maquininha na entrega', detalhe: 'fora do sistema', taxa: 'sem taxa MiseOn' },
            ].map((linha, i) => (
              <div key={linha.forma} className={`flex items-center justify-between gap-3 bg-white px-4 py-3.5 dark:bg-gray-900 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}>
                <div>
                  <p className="text-sm font-semibold dark:text-gray-100">{linha.forma}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{linha.detalhe}</p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-black text-gray-700 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{linha.taxa}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mb-8">
            Taxas públicas do Efí Bank (base {EFI_TARIFAS.referencia}). Sujeito a alteração. <a href={EFI_LINKS.tarifas} target="_blank" rel="noreferrer" className="underline">Confira no site oficial</a>.
          </p>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <HelpCircle size={18} className="text-[var(--cor-primaria)]" /> Dúvidas Frequentes (Financeiro)
          </h3>
          <div className="space-y-3 mb-10">
             <Expansivel titulo="O MiseOn segura meu dinheiro?" icone={<ShieldCheck size={16} className="text-emerald-500" />}>
                <p><b>Não.</b> O repasse é automático pelo Efí Bank, direto para sua conta (split de pagamento). O MiseOn cobra apenas a mensalidade fixa.</p>
             </Expansivel>
             <Expansivel titulo="Débito e dinheiro passam pelo sistema?">
                <p>Pagamentos na entrega (dinheiro/maquininha do motoboy) não passam pela Efí. O sistema apenas registra, mas <b>não há taxa do MiseOn nem da Efí</b>.</p>
             </Expansivel>
             <Expansivel titulo="E se eu não configurar a Efí agora?">
                <p>Suas vendas <b>não travam</b>, mas você precisará aceitar apenas dinheiro/maquininha, ou os valores online ficam pendentes de repasse manual da plataforma. É altamente recomendado configurar logo.</p>
             </Expansivel>
          </div>
        </div>
      )}

      {/* ── TAB: INDICADORES ── */}
      {tabAtiva === 'indicadores' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-50 to-amber-50/30 p-6 dark:border-orange-900/30 dark:from-orange-900/10 dark:to-amber-900/10">
             <div className="flex items-start gap-4">
               <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900/30">
                  <LayoutDashboard size={24} className="text-orange-600 dark:text-orange-400" />
               </div>
               <div>
                  <h3 className="mb-2 text-lg font-black text-orange-900 dark:text-orange-100">Lendo seus resultados</h3>
                  <p className="text-sm leading-relaxed text-orange-800/80 dark:text-orange-200/80">
                    O Dashboard do MiseOn foi feito para você tomar decisões. Aprenda a interpretar os gráficos e métricas para maximizar seu lucro.
                  </p>
               </div>
             </div>
          </div>

          <div className="space-y-3 mb-10">
            <Expansivel titulo="Ticket Médio: O que é e como melhorar?" aberto_inicial>
              <p>O <b>Ticket Médio</b> é o valor médio que cada cliente gasta em um pedido (Faturamento Total / Nº de Pedidos).</p>
              <div className="mt-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                <h5 className="font-bold text-sm mb-2">Como aumentar:</h5>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Ofereça adicionais (bacon, extra queijo) bem visíveis nos produtos.</li>
                  <li>Crie "Combos" (Lanche + Bebida + Frita) com desconto atrativo.</li>
                  <li>Treine o atendente do balcão para sempre sugerir uma bebida ou sobremesa.</li>
                </ul>
              </div>
            </Expansivel>
            <Expansivel titulo="Taxa de Cancelamento e Rejeição">
              <p>A <b>Taxa de Cancelamento</b> mostra quantos pedidos não foram concluídos. Se estiver acima de 5%, é um sinal de alerta.</p>
              <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                <li><b>Cancelado pelo restaurante:</b> Geralmente por falta de estoque ou tempo de espera alto. Ajuste suas fichas técnicas!</li>
                <li><b>Cancelado pelo cliente:</b> Pode indicar demora na aceitação. Aceite pedidos o mais rápido possível no Painel.</li>
              </ul>
            </Expansivel>
            <Expansivel titulo="Horários de Pico (Mapa de Calor)">
              <p>No Dashboard, você verá quais horários e dias da semana concentram mais vendas.</p>
              <p className="mt-2 text-sm">
                <b>Dica de Ouro:</b> Se terça-feira às 19h é o seu horário mais fraco, crie uma <i>Promoção Relâmpago</i> específica para esse dia para atrair demanda. Se sexta às 21h é o pico, reforce a equipe da cozinha e entregadores.
              </p>
            </Expansivel>
            <Expansivel titulo="Produtos Mais Vendidos vs. Mais Lucrativos">
              <p>Muitas vezes o seu produto mais vendido não é o que dá mais lucro. O MiseOn cruza as vendas com o CMV (Custo da Mercadoria Vendida) definido na Ficha Técnica.</p>
              <p className="mt-2 text-sm">
                Sempre coloque os produtos <b>mais lucrativos</b> em destaque no seu cardápio digital, e não apenas os que saem mais.
              </p>
            </Expansivel>
          </div>
        </div>
      )}

      {/* ── TAB: ESPECIALISTA ── */}
      {tabAtiva === 'especialista' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="relative mb-6">
                 <div className="absolute -inset-1 animate-pulse rounded-full bg-[var(--cor-primaria)]/20 blur-xl"></div>
                 <img 
                   src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop" 
                   alt="Especialista" 
                   className="relative h-28 w-28 rounded-full border-4 border-white object-cover shadow-xl dark:border-gray-800"
                 />
                 <div className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-green-500 p-2 shadow-sm dark:border-gray-800">
                    <PhoneCall size={14} className="text-white" />
                 </div>
              </div>
              
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Fale com um Especialista</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Nós sabemos que a operação de um restaurante é complexa. Não perca tempo batendo cabeça: nosso time de sucesso do cliente está pronto para te ajudar a configurar seu cardápio, estoque e finanças.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                 <a href={zapSuporte('Olá! Gostaria de falar com um especialista sobre o MiseOn.')} target="_blank" rel="noreferrer"
                   className="flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-8 py-4 font-bold text-white shadow-lg shadow-green-500/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/40">
                   <MessageCircle size={20} />
                   Chamar no WhatsApp agora
                 </a>
                 <button className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-8 py-4 font-bold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                   Agendar Consultoria (Vídeo)
                 </button>
              </div>

              <div className="mt-12 grid max-w-3xl gap-4 sm:grid-cols-3 text-left">
                 <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50 border border-transparent hover:border-[var(--cor-primaria)]/30 transition-colors">
                    <Settings size={20} className="mb-3 text-[var(--cor-primaria)]" />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Configuração Inicial</h4>
                    <p className="mt-1 text-xs text-gray-500">Ajuda com cardápio, fichas técnicas e taxas de entrega.</p>
                 </div>
                 <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50 border border-transparent hover:border-[var(--cor-primaria)]/30 transition-colors">
                    <BarChart3 size={20} className="mb-3 text-[var(--cor-primaria)]" />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Análise de Vendas</h4>
                    <p className="mt-1 text-xs text-gray-500">Como ler os relatórios e melhorar a margem de lucro.</p>
                 </div>
                 <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50 border border-transparent hover:border-[var(--cor-primaria)]/30 transition-colors">
                    <LifeBuoy size={20} className="mb-3 text-[var(--cor-primaria)]" />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Dúvidas Gerais</h4>
                    <p className="mt-1 text-xs text-gray-500">Treinamento para equipe de balcão e entregadores.</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-gray-400 opacity-60">
        <Check size={12} className="text-emerald-500" /> Base de conhecimento atualizada
      </div>
    </div>
  );
}
