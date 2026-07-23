import { Link } from 'react-router-dom';
import {
  QrCode, ClipboardList, ChefHat, Bike, Boxes, Wallet,
  MessageCircle, ShieldCheck, ArrowRight, Check, Sparkles,
  Store, Menu as MenuIcon, X,
} from 'lucide-react';
import { useState } from 'react';
import MiseOnLogo from '../components/MiseOnLogo';

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

/* ───────────────────────────── Página ───────────────────────────── */

export default function Home() {
  const [menuAberto, setMenuAberto] = useState(false);

  const links = [
    { href: '#recursos', rotulo: 'Recursos' },
    { href: '#como-funciona', rotulo: 'Como funciona' },
    { href: '#whatsapp-ia', rotulo: 'WhatsApp IA' },
    { href: '#planos', rotulo: 'Planos' },
  ];

  return (
    <div className="min-h-screen scroll-smooth bg-[#F4F7FA] font-sans text-gray-900 selection:bg-[#FC5B24] selection:text-white dark:bg-[#070C18] dark:text-[#EAF1FB]">

      {/* ══════════ 1. NAVBAR ══════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#070C18]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" aria-label="MiseOn — início" className="drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
            <MiseOnLogo size={132} />
          </Link>

          {/* Links âncora — desktop */}
          <div className="hidden items-center gap-7 md:flex">
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

          <div className="hidden items-center gap-3 md:flex">
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
            className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-white/10"
          >
            {menuAberto ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>

        {/* Menu mobile */}
        {menuAberto && (
          <div className="border-t border-gray-200/70 bg-white/95 px-4 pb-5 pt-3 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-[#070C18]/95">
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
      <section className="border-y border-white/10 bg-[#0B1120] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 sm:px-6 lg:flex-row lg:justify-between">
          <p className="max-w-md text-center font-['Sora'] text-sm font-bold uppercase tracking-widest text-slate-400 lg:text-left">
            Tudo que a sua operação precisa, em um só painel
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-200">
            <span className="flex items-center gap-2"><Check size={15} className="text-emerald-400" /> Cardápio digital</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-emerald-400" /> Pedidos</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-emerald-400" /> Cozinha KDS</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-emerald-400" /> Entregas</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-emerald-400" /> Estoque</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-emerald-400" /> Financeiro</span>
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

      {/* ══════════ 5. WHATSAPP IA (ESCURO, GLASS) ══════════ */}
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
                A integração usa a <b className="text-white">WhatsApp Business Platform oficial da Meta</b>,
                sem mensalidade de integração. E o controle continua seu: assumiu a conversa, a IA silencia na hora.
              </p>
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

      {/* ══════════ 6. COMO FUNCIONA ══════════ */}
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

      {/* ══════════ 7. PLANOS / CTA FINAL ══════════ */}
      <section id="planos" className="scroll-mt-24 pb-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#111a33] p-8 text-center shadow-2xl sm:p-14">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#FC5B24]/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#0A5CC4]/25 blur-3xl" />

            <div className="relative">
              <span className="text-xs font-black uppercase tracking-widest text-orange-300">Planos</span>
              <h2 className="mx-auto mt-4 max-w-xl font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Um valor justo, sem taxa por pedido
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300">
                Planos mensais pensados para o tamanho da sua operação — do delivery de bairro ao
                restaurante completo. Sem taxa por pedido, sem fidelidade forçada: cancele quando quiser,
                direto no painel.
              </p>

              <ul className="mx-auto mt-8 grid max-w-lg gap-3 text-left text-sm text-slate-200 sm:grid-cols-2">
                <li className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> Cardápio, pedidos, KDS e entregas inclusos</li>
                <li className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> WhatsApp com IA sem mensalidade de integração</li>
                <li className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> Pix direto na sua conta via Efí</li>
                <li className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /> Suporte humano por WhatsApp</li>
              </ul>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/cadastre-se"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-9 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105 hover:brightness-110 sm:w-auto"
                >
                  Cadastrar minha loja <Store size={18} />
                </Link>
                <a
                  href={zap('Olá! Quero conhecer os planos do MiseOn para o meu restaurante.')}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-9 py-4 font-['Sora'] text-base font-bold text-white backdrop-blur-md transition hover:bg-white/15 sm:w-auto"
                >
                  <MessageCircle size={18} /> Falar com o time
                </a>
              </div>

              <p className="mt-6 text-xs text-slate-400">
                Valores e condições são apresentados no cadastro, sem compromisso.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 8. FOOTER INSTITUCIONAL ══════════ */}
      <footer className="border-t border-white/10 bg-[#070C18]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 md:grid-cols-4">
            {/* Marca */}
            <div className="md:col-span-1">
              <MiseOnLogo size={140} />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
                O sistema de gestão que coloca o seu restaurante para vender no automático —
                do cardápio digital ao WhatsApp com IA.
              </p>
            </div>

            {/* Produto */}
            <div>
              <h4 className="font-['Sora'] text-sm font-bold uppercase tracking-widest text-slate-300">Produto</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><a href="#recursos" className="transition hover:text-white">Recursos</a></li>
                <li><a href="#como-funciona" className="transition hover:text-white">Como funciona</a></li>
                <li><a href="#whatsapp-ia" className="transition hover:text-white">WhatsApp com IA</a></li>
                <li><a href="#planos" className="transition hover:text-white">Planos</a></li>
                <li><Link to="/cadastre-se" className="transition hover:text-white">Cadastrar minha loja</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-['Sora'] text-sm font-bold uppercase tracking-widest text-slate-300">Legal</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><Link to="/termos" className="transition hover:text-white">Termos de Uso</Link></li>
                <li><Link to="/privacidade" className="transition hover:text-white">Política de Privacidade</Link></li>
              </ul>
            </div>

            {/* Contato */}
            <div>
              <h4 className="font-['Sora'] text-sm font-bold uppercase tracking-widest text-slate-300">Contato</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li>
                  <a
                    href="https://wa.me/5511919889233"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 transition hover:text-white"
                  >
                    <MessageCircle size={15} className="text-emerald-400" /> WhatsApp comercial
                  </a>
                </li>
                <li>
                  <a href="mailto:contato@miseon.app.br" className="transition hover:text-white">
                    contato@miseon.app.br
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-6 text-center">
            <p className="text-xs text-slate-500">
              © 2026 MiseOn · CNPJ 63.310.253/0001-81 · Manaus/AM, Brasil
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
