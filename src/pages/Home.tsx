import { Link } from 'react-router-dom';
import {
  QrCode, ClipboardList, ChefHat, Bike, Boxes, Wallet,
  MessageCircle, ShieldCheck, ArrowRight, Check, Sparkles,
  Menu as MenuIcon, X, UtensilsCrossed, Megaphone, ShoppingBag,
  Mail, ChevronDown, Headset, BarChart3, Star, Quote, BadgeCheck,
} from 'lucide-react';
import { useState } from 'react';
import MiseOnLogo from '../components/MiseOnLogo';
import SEO from '../components/SEO';
import FooterSEO from '../components/FooterSEO';

const WHATSAPP_CONTATO = '5511919889233';
const zap = (msg: string) => `https://wa.me/${WHATSAPP_CONTATO}?text=${encodeURIComponent(msg)}`;

/* ───────────────────────────── Dados ───────────────────────────── */

const RECURSOS = [
  {
    icone: QrCode,
    titulo: 'Cardápio digital com QR Code',
    texto: 'Sua loja no ar com link próprio e QR Code para mesas e balcão. Fotos, adicionais e preços sempre atualizados — sem imprimir nada.',
    cor: 'text-orange-500',
    fundo: 'bg-orange-500/10',
  },
  {
    icone: ClipboardList,
    titulo: 'Pedidos em tempo real',
    texto: 'Cada pedido cai no painel no mesmo segundo, com aviso sonoro. Aceite, produza e entregue sem perder nada no caminho.',
    cor: 'text-blue-500',
    fundo: 'bg-blue-500/10',
  },
  {
    icone: ChefHat,
    titulo: 'Cozinha (KDS)',
    texto: 'Tela de produção sem papel: a cozinha vê a fila, marca o preparo e o balcão acompanha tudo em tempo real.',
    cor: 'text-red-500',
    fundo: 'bg-red-500/10',
  },
  {
    icone: Bike,
    titulo: 'Gestão de entregas',
    texto: 'Rotas, entregadores e status de cada entrega em um só lugar. O cliente acompanha o pedido sem precisar ligar.',
    cor: 'text-emerald-500',
    fundo: 'bg-emerald-500/10',
  },
  {
    icone: UtensilsCrossed,
    titulo: 'PDV, mesas e comandas',
    texto: 'Balcão e salão no mesmo sistema: comanda por mesa, pedido direto na tela da cozinha e fechamento de conta sem confusão.',
    cor: 'text-amber-500',
    fundo: 'bg-amber-500/10',
  },
  {
    icone: Boxes,
    titulo: 'Estoque com ficha técnica e CMV',
    texto: 'Cada venda baixa os ingredientes automaticamente. Você sabe o custo real de cada prato e nunca vende o que acabou.',
    cor: 'text-purple-500',
    fundo: 'bg-purple-500/10',
  },
  {
    icone: Wallet,
    titulo: 'Financeiro com Pix (Efí)',
    texto: 'Pix cai direto na sua conta, com conciliação automática e taxas transparentes. O MiseOn não segura o seu dinheiro.',
    cor: 'text-teal-500',
    fundo: 'bg-teal-500/10',
  },
  {
    icone: Megaphone,
    titulo: 'Marketing e fidelização',
    texto: 'Cupons, promoções e e-mails automáticos de pedido, entrega e carrinho abandonado. O cliente volta sem você empurrar.',
    cor: 'text-pink-500',
    fundo: 'bg-pink-500/10',
  },
  {
    icone: ShoppingBag,
    titulo: 'Integração com iFood',
    texto: 'Os pedidos do iFood caem no mesmo painel dos pedidos do seu site. Uma fila só, uma cozinha só, um estoque só.',
    cor: 'text-rose-500',
    fundo: 'bg-rose-500/10',
  },
];

const PLATAFORMA = [
  {
    grupo: 'Vender',
    itens: [
      'Cardápio digital com link próprio e QR Code',
      'PDV de balcão e comandas por mesa',
      'Pedidos em tempo real, com aviso sonoro',
      'Integração com iFood no mesmo painel',
      'Pagamento Pix e cartão via Efí',
    ],
  },
  {
    grupo: 'Operar',
    itens: [
      'Cozinha KDS sem papel, com fila de preparo',
      'Gestão de entregas e entregadores',
      'Status do pedido que o cliente acompanha',
      'Impressão de pedido para produção',
      'Equipe com papéis e permissões',
    ],
  },
  {
    grupo: 'Gerir',
    itens: [
      'Estoque com baixa automática por venda',
      'Ficha técnica, alergênicos e CMV por prato',
      'Compras e controle de fornecedores',
      'Financeiro com conciliação automática',
      'Relatórios e histórico de vendas',
    ],
  },
  {
    grupo: 'Fidelizar',
    itens: [
      'Cupons e promoções por campanha',
      'E-mails automáticos de pedido e entrega',
      'Recuperação de carrinho abandonado',
      'Chat com IA no site da sua loja',
      'WhatsApp atendido por IA (oficial Meta)',
    ],
  },
];

const PASSOS = [
  {
    n: 1,
    titulo: 'Cadastre sua loja',
    texto: 'Nome, endereço, horários e formas de pagamento. Em poucos minutos sua operação está dentro do MiseOn.',
  },
  {
    n: 2,
    titulo: 'Monte o cardápio',
    texto: 'Cadastre produtos com foto, adicionais e ficha técnica. O estoque e o custo de cada prato já nascem conectados.',
  },
  {
    n: 3,
    titulo: 'Compartilhe e receba pedidos',
    texto: 'Divulgue o link e o QR Code. Os pedidos caem no painel em tempo real — no balcão, na cozinha e na entrega.',
  },
];

const DEPOIMENTOS = [
  {
    nome: 'Carlos M.',
    negocio: 'Hamburgueria',
    texto: 'Antes eu pagava 3 sistemas diferentes que não se conversavam e custavam uma fortuna. Com o MiseOn, centralizei PDV, entregas e a IA do WhatsApp. Economizei R$ 400/mês e a operação voa.',
    perfil: 'Tinha sistema caro e complexo',
  },
  {
    nome: 'Juliana T.',
    negocio: 'Pizzaria Delivery',
    texto: 'Eu usava caderninho e WhatsApp manual. Perdia pedido toda sexta-feira. Agora a IA atende e envia o cardápio, os pedidos caem direto na tela. Nunca mais perdi venda.',
    perfil: 'Não tinha sistema',
  },
  {
    nome: 'Roberto S.',
    negocio: 'Restaurante e Bar',
    texto: 'O sistema antigo não tinha tela na cozinha (KDS) nem ficha técnica decente. O MiseOn resolveu isso. Cada venda na mesa já dá baixa no estoque. Controle total, sem gambiarra.',
    perfil: 'Tinha sistema incompleto',
  },
];

const SUPORTE_CANAIS = [
  {
    icone: MessageCircle,
    titulo: 'WhatsApp',
    descricao: 'Atendimento humano para dúvidas da operação, planos e implantação.',
    acao: 'Chamar no WhatsApp',
    href: zap('Olá! Preciso de ajuda com o MiseOn.'),
    externo: true,
    destaque: true,
  },
  {
    icone: Headset,
    titulo: 'Suporte técnico',
    descricao: 'Problemas com o sistema, integrações, pagamentos ou acessos.',
    acao: 'suporte@miseon.app.br',
    href: 'mailto:suporte@miseon.app.br?subject=Suporte%20MiseOn',
    externo: false,
    destaque: false,
  },
  {
    icone: Mail,
    titulo: 'Comercial e geral',
    descricao: 'Planos, parcerias, imprensa e qualquer outro assunto.',
    acao: 'contato@miseon.app.br',
    href: 'mailto:contato@miseon.app.br?subject=Contato%20MiseOn',
    externo: false,
    destaque: false,
  },
];

const FAQ = [
  {
    pergunta: 'Preciso comprar ou instalar algum equipamento?',
    resposta:
      'Não. O MiseOn roda no navegador, no computador e no celular que você já tem. A cozinha usa uma tela comum como KDS e o cardápio digital dispensa impressão.',
  },
  {
    pergunta: 'Como eu recebo o dinheiro das vendas?',
    resposta:
      'Os pagamentos são processados pela Efí (Gerencianet) e caem direto na conta da sua loja, com conciliação automática no painel. O MiseOn não retém o seu faturamento em nenhuma etapa.',
  },
  {
    pergunta: 'O atendimento por IA no WhatsApp é oficial?',
    resposta:
      'Sim. Usamos a WhatsApp Business Platform oficial da Meta — não é gambiarra com número pessoal nem risco de banimento. Nossa equipe conduz a configuração com você, sem mensalidade de integração.',
  },
  {
    pergunta: 'A IA fecha pedidos sozinha no WhatsApp?',
    resposta:
      'Não — e isso é de propósito. Ela tira dúvidas com os dados reais da sua loja (preços, cardápio, horários) e envia o link do cardápio digital. O pedido é montado pelo cliente na plataforma e cai no seu painel para você aceitar. A decisão final é sempre sua.',
  },
  {
    pergunta: 'O MiseOn integra com o iFood?',
    resposta:
      'Sim. Os pedidos do iFood entram na mesma fila dos pedidos do seu site, com baixa de estoque unificada. Você opera uma cozinha só, sem alternar entre telas.',
  },
  {
    pergunta: 'Posso cancelar quando quiser?',
    resposta:
      'Pode. Não há fidelidade nem multa: o cancelamento é feito direto no painel e seus dados continuam disponíveis para exportação conforme os Termos de Uso.',
  },
];

/* ─────────────────────── Componentes locais ─────────────────────── */

function FaqItem({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
      >
        <span className="font-['Sora'] text-sm font-bold text-gray-900 sm:text-base dark:text-white">
          {pergunta}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[var(--cor-primaria)] transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`}
        />
      </button>
      {aberto && (
        <p className="border-t border-gray-100 px-5 py-4 text-sm leading-relaxed text-gray-600 dark:border-white/10 dark:text-slate-300">
          {resposta}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────── Página ───────────────────────────── */

export default function Home() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [planoAnual, setPlanoAnual] = useState(true);

  const links = [
    { href: '#nichos', rotulo: 'Nichos' },
    { href: '#recursos', rotulo: 'Recursos' },
    { href: '#plataforma', rotulo: 'Plataforma' },
    { href: '#como-funciona', rotulo: 'Como funciona' },
    { href: '#whatsapp-ia', rotulo: 'WhatsApp IA' },
    { href: '#planos', rotulo: 'Planos' },
    { href: '#suporte', rotulo: 'Suporte' },
  ];

  return (
    <div className="min-h-screen scroll-smooth bg-[#F4F7FA] font-sans text-gray-900 selection:bg-[#FC5B24] selection:text-white dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO
        title="MiseOn | Sistema de Gestão para Restaurantes, Hamburguerias e Deliveries"
        description="O MiseOn veio para organizar e simplificar a gestão de restaurantes, hamburguerias, pizzarias e lanchonetes. Cardápio digital, KDS, iFood, WhatsApp IA e Pix."
        keywords="sistema para restaurante, sistema para hamburgueria, sistema para pizzaria, cardapio digital qr code, integracao ifood, whatsapp ia restaurante"
        canonicalUrl="https://miseon.app.br/"
        schemaJson={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          'name': 'MiseOn — Sistema de Gestão para Restaurantes e Deliveries',
          'operatingSystem': 'Web, Android, iOS, Windows, macOS',
          'applicationCategory': 'BusinessApplication',
          'aggregateRating': {
            '@type': 'AggregateRating',
            'ratingValue': '4.9',
            'reviewCount': '128',
          },
          'offers': {
            '@type': 'Offer',
            'price': '99.90',
            'priceCurrency': 'BRL',
            'priceValidUntil': '2027-12-31',
          },
          'author': {
            '@type': 'Organization',
            'name': 'MiseOn / Maldivas Tech Solutions',
            'url': 'https://rafael-maldivas.vercel.app/',
          },
        }}
      />

      {/* ══════════ 1. NAVBAR ══════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#070C18]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" aria-label="MiseOn — início" className="drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
            <MiseOnLogo size={132} />
          </Link>

          {/* Links âncora — desktop */}
          <div className="hidden items-center gap-6 lg:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-semibold text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                {l.rotulo}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/acesso"
              className="rounded-full px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
            >
              Entrar
            </Link>
            <Link
              to="/cadastre-se"
              className="rounded-full bg-[var(--cor-primaria)] px-5 py-2.5 font-['Sora'] text-sm font-bold text-white shadow-lg shadow-[#FC5B24]/25 transition hover:scale-105 hover:brightness-110"
            >
              Cadastrar minha loja
            </Link>
          </div>

          {/* Toggle mobile */}
          <button
            onClick={() => setMenuAberto((a) => !a)}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 lg:hidden dark:text-gray-300 dark:hover:bg-white/10"
          >
            {menuAberto ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>

        {/* Menu mobile */}
        {menuAberto && (
          <div className="border-t border-gray-200/70 bg-white/95 px-4 pb-5 pt-3 backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[#070C18]/95">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuAberto(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  {l.rotulo}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to="/acesso"
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm font-bold text-gray-700 dark:border-white/15 dark:text-gray-100"
                >
                  Entrar
                </Link>
                <Link
                  to="/cadastre-se"
                  className="rounded-xl bg-[var(--cor-primaria)] px-4 py-2.5 text-center font-['Sora'] text-sm font-bold text-white shadow-lg"
                >
                  Cadastrar minha loja
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════ 2. HERO ESCURO GLASSMORPHISM ══════════ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] pb-20 pt-32 sm:pb-28 sm:pt-40">
        {/* brilhos decorativos */}
        <div className="pointer-events-none absolute -top-24 right-[-8%] h-96 w-96 rounded-full bg-[#0A5CC4]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10%] left-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/20 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-200 backdrop-blur-md">
            <Sparkles size={13} className="text-orange-400" />
            Plataforma completa para restaurantes
          </span>

          <h1 className="mx-auto mt-6 max-w-4xl font-['Sora'] text-4xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Seu restaurante vendendo no automático —{' '}
            <span className="bg-gradient-to-r from-[#FF8A5C] via-[#FC5B24] to-[#6B9EFF] bg-clip-text text-transparent">
              do cardápio ao WhatsApp
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            O MiseOn é o sistema de gestão que coloca o seu cardápio digital, os pedidos,
            a cozinha, as entregas, o estoque e o financeiro no mesmo painel — com uma
            inteligência artificial que atende seus clientes no WhatsApp usando os dados reais da sua loja.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/cadastre-se"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105 hover:brightness-110 sm:w-auto"
            >
              Cadastrar minha loja <ArrowRight size={18} />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 py-4 font-['Sora'] text-base font-bold text-white backdrop-blur-md transition hover:bg-white/15 sm:w-auto"
            >
              Ver como funciona
            </a>
          </div>

          {/* Mini-cards de prova */}
          <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
              <ClipboardList size={22} className="mt-0.5 shrink-0 text-blue-300" />
              <div>
                <p className="text-sm font-bold text-white">Pedidos em tempo real</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                  Do site, do balcão ou do WhatsApp: tudo cai no mesmo painel, com aviso na hora.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
              <MessageCircle size={22} className="mt-0.5 shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-bold text-white">IA que responde no WhatsApp</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                  Preço, cardápio e horário lidos do seu cadastro — sem resposta inventada.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
              <Wallet size={22} className="mt-0.5 shrink-0 text-orange-300" />
              <div>
                <p className="text-sm font-bold text-white">Pix direto na sua conta</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                  Recebimento via Efí com split automático. O dinheiro da venda é seu, na hora.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════ 3. FAIXA DE CREDIBILIDADE ══════════ */}
      <section className="border-y border-white/10 bg-[#0B1120] py-8 relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0B1120]/0 to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:px-6">
          <p className="text-center font-['Sora'] text-xs font-bold uppercase tracking-widest text-slate-500">
            Tudo o que a sua operação precisa, em um só painel
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-semibold text-slate-300">
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Cardápio & QR Code</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> WhatsApp com IA</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Integração iFood</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> PDV & Comandas</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Cozinha KDS</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Rotas & Entregas</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Estoque & Ficha Técnica</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Pix Automático</span>
          </div>
        </div>
      </section>

      {/* ══════════ 3.5 SEÇÃO VISUAL DE NICHOS E FUNCIONALIDADES ══════════ */}
      <section id="nichos" className="scroll-mt-24 bg-slate-900/40 py-20 backdrop-blur-sm border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-orange-400">
              <Sparkles size={13} /> Soluções Sob Medida
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Feito sob medida para o ritmo real da sua cozinha
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Cada segmento tem suas próprias dores. Clique no seu tipo de negócio e descubra como o MiseOn resolve sua operação:
            </p>
          </div>

          {/* Cards de Nicho */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* 1. Hamburguerias */}
            <Link
              to="/sistema-para-hamburgueria"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-orange-500/10"
            >
              <div>
                <div className="inline-flex rounded-2xl bg-orange-500/20 p-3 text-orange-400">
                  <ChefHat size={28} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-xl font-bold text-white group-hover:text-orange-400 transition-colors">
                  Hamburguerias
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Ponto da carne, adicionais/combos, KDS na chapa, baixa de insumos (blends/pães) e iFood unificado.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-orange-400 group-hover:translate-x-1 transition-transform">
                Ver solução para Hamburgueria <ArrowRight size={14} />
              </div>
            </Link>

            {/* 2. Lanchonetes */}
            <Link
              to="/sistema-para-lanchonete"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-blue-500/10"
            >
              <div>
                <div className="inline-flex rounded-2xl bg-blue-500/20 p-3 text-blue-400">
                  <UtensilsCrossed size={28} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                  Lanchonetes
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  PDV express de balcão, comandas de salgado/bebida, controle de caixa por turno e impressões ultrarrápidas.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                Ver solução para Lanchonete <ArrowRight size={14} />
              </div>
            </Link>

            {/* 3. Pizzarias */}
            <Link
              to="/sistema-para-pizzaria"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-emerald-500/10"
            >
              <div>
                <div className="inline-flex rounded-2xl bg-emerald-500/20 p-3 text-emerald-400">
                  <Boxes size={28} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Pizzarias
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Acompanhamento no KDS de forno, gestão de entregadores/motoboys, ficha técnica de insumos e iFood unificado.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                Ver solução para Pizzaria <ArrowRight size={14} />
              </div>
            </Link>

            {/* 4. Restaurantes */}
            <Link
              to="/sistema-para-restaurantes"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-amber-500/10"
            >
              <div>
                <div className="inline-flex rounded-2xl bg-amber-500/20 p-3 text-amber-400">
                  <BarChart3 size={28} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                  Restaurantes
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Comanda no celular do garçom, mapa de mesas com divisão de conta, DRE financeiro e NFC-e.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                Ver solução para Restaurante <ArrowRight size={14} />
              </div>
            </Link>

          </div>

          {/* Faixa de Funcionalidades Chave */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Principais Integrações:
              </span>
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <Link to="/integracao-ifood" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-rose-500 hover:text-rose-400">
                  🛵 Integração iFood
                </Link>
                <Link to="/cardapio-qr-code" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-orange-500 hover:text-orange-400">
                  📱 Cardápio QR Code
                </Link>
                <Link to="/api-whatsapp-restaurantes" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-emerald-500 hover:text-emerald-400">
                  🤖 WhatsApp IA Oficial
                </Link>
                <Link to="/gestao-fiscal-nfe" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-blue-500 hover:text-blue-400">
                  🧾 Emissão Fiscal NFC-e
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 4. RECURSOS ══════════ */}
      <section id="recursos" className="scroll-mt-24 bg-white py-20 sm:py-24 dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Recursos</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Um sistema inteiro, não um cardápio bonito
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              O MiseOn nasceu para a rotina real do food service: cada módulo conversa com o
              outro, do pedido à baixa de estoque, sem retrabalho e sem planilha paralela.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <div
                key={r.titulo}
                className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md"
              >
                <div className={`inline-flex rounded-2xl p-3 ${r.fundo} ${r.cor}`}>
                  <r.icone size={24} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-lg font-bold text-gray-900 dark:text-white">{r.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 5. PLATAFORMA COMPLETA (ESCURO, GLASS) ══════════ */}
      <section id="plataforma" className="relative scroll-mt-24 overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0D1830] to-[#070C18] py-20 sm:py-24">
        <div className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-[#0A5CC4]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/15 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-200 backdrop-blur-md">
              <BarChart3 size={13} className="text-orange-400" /> Plataforma completa
            </span>
            <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Tudo incluso. Sem módulo escondido, sem surpresa na fatura
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Do primeiro clique do cliente ao relatório de fechamento do mês —
              é isto que entra na sua conta quando você assina o MiseOn.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLATAFORMA.map((g) => (
              <div
                key={g.grupo}
                className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-md transition-colors hover:bg-white/15"
              >
                <h3 className="font-['Sora'] text-base font-extrabold uppercase tracking-widest text-orange-300">
                  {g.grupo}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {g.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-snug text-slate-200">
                      <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 6. WHATSAPP IA (ESCURO, GLASS) ══════════ */}
      <section id="whatsapp-ia" className="relative scroll-mt-24 overflow-hidden bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#052e16] py-20 sm:py-24">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-teal-300/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-200 backdrop-blur-md">
                <MessageCircle size={13} /> WhatsApp Business Platform · Meta
              </span>
              <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Seu WhatsApp atendendo sozinho — de verdade
              </h2>
              <p className="mt-5 text-base leading-relaxed text-emerald-100/85">
                A IA do MiseOn responde seus clientes usando os dados <b className="text-white">reais</b> da
                sua loja — cardápio, preços, estoque e horário. Quando o cliente quer pedir, ela envia o link
                do seu cardápio digital e o pedido cai direto no seu painel, com selo de origem.
              </p>
              <p className="mt-4 text-base leading-relaxed text-emerald-100/85">
                A integração não tem mensalidade oculta. E o controle continua totalmente seu: assumiu a conversa, a IA silencia na hora.
              </p>

              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#1877F2]/20 bg-[#1877F2]/10 px-3 py-1.5 shadow-[0_0_15px_rgba(24,119,242,0.15)] backdrop-blur-sm">
                <BadgeCheck size={18} fill="#1877F2" stroke="white" strokeWidth={1.5} />
                <span className="font-['Sora'] text-[13px] font-extrabold text-white">Meta Verified</span>
                <span className="text-[11px] font-medium text-emerald-100/60 ml-1">— Parceiro Oficial</span>
              </div>
              <div className="mt-8">
                <Link
                  to="/cadastre-se"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-['Sora'] text-sm font-bold text-emerald-950 shadow-xl transition hover:scale-105 hover:bg-emerald-50"
                >
                  Quero isso na minha loja <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <MessageCircle size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">Responde com dados reais</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    Preço, ingredientes, taxa de entrega e horário vêm do seu cadastro. Nunca inventa valor nem desconto.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <QrCode size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">Manda o link do cardápio</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    Na hora de pedir, o cliente monta o carrinho no seu site com preço real — a IA não fecha pedido sozinha.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <ClipboardList size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">Pedido cai no painel</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    Chega como "Novo", com selo WhatsApp. Você aceita como qualquer pedido — decisão sempre sua.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">Seguro por desenho</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    Assunto de saúde, como alergias, chama você na hora. E você pode desligar a IA quando quiser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 7. COMO FUNCIONA ══════════ */}
      <section id="como-funciona" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Como funciona</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Do cadastro ao primeiro pedido em 3 passos
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              Sem instalação, sem equipamento especial. Funciona no navegador, no computador e no celular.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PASSOS.map((p) => (
              <div
                key={p.n}
                className="relative rounded-3xl border border-gray-200 bg-white p-7 pt-9 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md"
              >
                <div className="absolute -top-5 left-7 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FC5B24] to-[#E34A1B] font-['Sora'] text-lg font-black text-white shadow-lg shadow-[#FC5B24]/30">
                  {p.n}
                </div>
                <h3 className="font-['Sora'] text-lg font-bold text-gray-900 dark:text-white">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 8. DEPOIMENTOS ══════════ */}
      <section className="bg-white py-20 sm:py-24 dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Histórias reais</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              De quem já tentou de tudo, ou estava apenas começando
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              Não importa se você usa um sistema caro, um sistema incompleto ou se ainda está no papel.
              O MiseOn se adapta à sua realidade e transforma sua gestão.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {DEPOIMENTOS.map((d, i) => (
              <div key={i} className="relative flex flex-col justify-between rounded-3xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
                <Quote className="absolute right-6 top-6 text-gray-100 dark:text-white/5" size={60} />
                <div className="relative">
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star size={16} fill="currentColor" />
                    <Star size={16} fill="currentColor" />
                    <Star size={16} fill="currentColor" />
                    <Star size={16} fill="currentColor" />
                    <Star size={16} fill="currentColor" />
                  </div>
                  <p className="mt-5 text-sm leading-relaxed text-gray-700 dark:text-slate-300 italic">
                    "{d.texto}"
                  </p>
                </div>
                <div className="relative mt-8 flex items-center justify-between border-t border-gray-100 pt-5 dark:border-white/10">
                  <div>
                    <p className="font-['Sora'] text-sm font-bold text-gray-900 dark:text-white">{d.nome}</p>
                    <p className="text-xs font-medium text-[var(--cor-primaria)]">{d.negocio}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-white/10 dark:text-gray-400 max-w-[120px] text-right">
                    {d.perfil}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 9. PLANOS / CTA FINAL ══════════ */}
      <section id="planos" className="scroll-mt-24 pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Planos</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Um valor justo, sem taxa por pedido
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              Escolha a melhor opção para o seu momento. Todos os recursos liberados em ambos os planos,
              sem fidelidade forçada: cancele quando quiser, direto no painel.
            </p>
          </div>

          <div className="mx-auto mt-8 flex max-w-sm items-center justify-center rounded-full border border-gray-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
            <button
              onClick={() => setPlanoAnual(false)}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-all ${
                !planoAnual
                  ? 'bg-gray-100 text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setPlanoAnual(true)}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-all ${
                planoAnual
                  ? 'bg-[var(--cor-primaria)] text-white shadow-lg shadow-[var(--cor-primaria)]/30'
                  : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Anual (2 meses grátis)
            </button>
          </div>

          <div className="mx-auto mt-10 max-w-5xl">
            <div className="flex flex-col lg:flex-row rounded-3xl border border-orange-500/30 bg-[#0B1120] shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-orange-500/10">
              
              {/* Esquerda: Preço e CTA */}
              <div className="relative flex flex-col justify-between p-8 lg:w-[42%] lg:p-10 bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#111a33] border-b border-white/10 lg:border-b-0 lg:border-r">
                {planoAnual && (
                  <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#FC5B24]/20 blur-3xl pointer-events-none transition-opacity duration-500" />
                )}
                
                <div>
                  {planoAnual && (
                    <div className="inline-flex rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg mb-6">
                      Mais Popular
                    </div>
                  )}
                  <h3 className="font-['Sora'] text-3xl font-extrabold text-white">Plano Único</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {planoAnual ? 'A escolha inteligente: economia garantida e previsibilidade total para a sua operação.' : 'Flexibilidade absoluta: acesso total ao sistema e cancele a qualquer momento.'}
                  </p>
                </div>

                <div className="mt-8 flex flex-col">
                  {planoAnual ? (
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-slate-500 line-through">De R$ 129,90</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">2 meses grátis</span>
                    </div>
                  ) : (
                    <div className="h-5" /> 
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold tracking-tight text-white transition-all">
                      R$ {planoAnual ? '99,90' : '129,90'}
                    </span>
                    <span className="text-base font-medium text-slate-400">/mês</span>
                  </div>
                  <span className="mt-2 text-xs text-orange-300/80 font-medium h-4 transition-all">
                    {planoAnual ? '*Faturado R$ 1.198,80 anualmente' : 'Sem fidelidade contratual'}
                  </span>
                </div>

                <div className="mt-10">
                  <Link
                    to="/cadastre-se"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-6 py-4 font-['Sora'] text-base font-bold text-white shadow-lg shadow-[#FC5B24]/30 transition hover:scale-105 hover:brightness-110"
                  >
                    Começar Agora <ArrowRight size={18} />
                  </Link>
                  <p className="mt-4 text-center text-[11px] font-medium text-slate-500">
                    <strong className="text-slate-300">Zero taxas de setup.</strong> Suporte e implantação VIP grátis.
                  </p>
                </div>
              </div>

              {/* Direita: Features Detalhadas */}
              <div className="p-8 lg:w-[58%] lg:p-10 bg-[#060a14]">
                <h4 className="font-['Sora'] text-base font-bold text-white mb-8 flex items-center gap-2">
                  <Sparkles size={18} className="text-orange-400" />
                  O sistema completo, sem surpresas:
                </h4>
                
                <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
                  {/* Categoria 1 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <ChefHat size={16} className="text-emerald-400" /> Operação e Vendas
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">PDV Frente de Caixa</strong> inteligente</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">Cardápio QR Code</strong> p/ mesas</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">Integração iFood</strong> nativa</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">Gestão de Comandas</strong> na palma</span></li>
                    </ul>
                  </div>

                  {/* Categoria 2 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <MessageCircle size={16} className="text-blue-400" /> IA e Delivery
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Robô WhatsApp</strong> (API Oficial Meta)</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Cardápio Online</strong> livre de taxas</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Impressão Automática</strong> de pedidos</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Cozinha KDS</strong> em telas</span></li>
                    </ul>
                  </div>

                  {/* Categoria 3 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <Boxes size={16} className="text-orange-400" /> Estoque e Precisão
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">Ficha Técnica</strong> avançada (CMV)</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">Baixa automática</strong> por venda</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">Controle de Lotes</strong> e PEPs</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">Visualização 3D</strong> do espaço</span></li>
                    </ul>
                  </div>

                  {/* Categoria 4 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <Wallet size={16} className="text-indigo-400" /> Controle e Equipe
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Pix Automático (Efí)</strong> direto na conta</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Caixa e Relatórios</strong> analíticos</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Usuários Ilimitados</strong> com permissões</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Atendimento Humano</strong> prioritário</span></li>
                    </ul>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
          
          <div className="mt-12 flex justify-center">
            <a
              href={zap('Olá! Quero conhecer os planos do MiseOn para o meu restaurante.')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 transition hover:text-[var(--cor-primaria)] dark:text-slate-400 dark:hover:text-orange-400"
            >
              <MessageCircle size={18} /> Ainda com dúvidas? Fale com nosso time
            </a>
          </div>
        </div>
      </section>

      {/* ══════════ 9. SUPORTE + FAQ ══════════ */}
      <section id="suporte" className="scroll-mt-24 border-t border-gray-200/70 bg-white py-20 sm:py-24 dark:border-white/10 dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Suporte</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Gente de verdade do outro lado
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              Nada de ticket perdido em fila infinita. Você fala com o time que constrói
              o MiseOn — no WhatsApp ou por e-mail, no canal que preferir.
            </p>
          </div>

          {/* Canais de atendimento */}
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {SUPORTE_CANAIS.map((c) => (
              <div
                key={c.titulo}
                className={`flex flex-col rounded-3xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${
                  c.destaque
                    ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white'
                    : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md'
                }`}
              >
                <div
                  className={`inline-flex w-fit rounded-2xl p-3 ${
                    c.destaque ? 'bg-white/15 text-white' : 'bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]'
                  }`}
                >
                  <c.icone size={24} />
                </div>
                <h3 className={`mt-4 font-['Sora'] text-lg font-bold ${c.destaque ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {c.titulo}
                </h3>
                <p className={`mt-2 flex-1 text-sm leading-relaxed ${c.destaque ? 'text-emerald-100/90' : 'text-gray-600 dark:text-slate-300'}`}>
                  {c.descricao}
                </p>
                <a
                  href={c.href}
                  {...(c.externo ? { target: '_blank', rel: 'noreferrer' } : {})}
                  className={`mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition hover:scale-[1.02] ${
                    c.destaque
                      ? 'bg-white text-emerald-900 shadow-lg hover:bg-emerald-50'
                      : 'border border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10'
                  }`}
                >
                  {c.acao} <ArrowRight size={15} />
                </a>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="mx-auto mt-16 max-w-3xl">
            <h3 className="text-center font-['Sora'] text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Perguntas frequentes
            </h3>
            <div className="mt-8 grid gap-3">
              {FAQ.map((f) => (
                <FaqItem key={f.pergunta} pergunta={f.pergunta} resposta={f.resposta} />
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-gray-500 dark:text-slate-400">
              Não achou a sua dúvida?{' '}
              <a
                href={zap('Olá! Tenho uma dúvida sobre o MiseOn.')}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[var(--cor-primaria)] underline-offset-2 transition hover:underline"
              >
                Chama no WhatsApp
              </a>{' '}
              ou escreva para{' '}
              <a
                href="mailto:suporte@miseon.app.br?subject=D%C3%BAvida%20MiseOn"
                className="font-bold text-[var(--cor-primaria)] underline-offset-2 transition hover:underline"
              >
                suporte@miseon.app.br
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ══════════ 10. FOOTER SEO — LINKAGEM INTERNA ══════════ */}
      <FooterSEO />
    </div>
  );
}
