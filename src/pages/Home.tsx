import { ShoppingBag, Bike, Boxes, MessageCircle, QrCode, LineChart, Check } from 'lucide-react';

/**
 * Landing page comercial do MiseOn — "traga sua cozinha para o MiseOn".
 * Rota "/" — é a vitrine do PRÓPRIO sistema para captar novas lojas.
 */

// TODO: troque pelo seu WhatsApp comercial
const WHATSAPP_VENDAS = '5511900000000';
const zap = (msg: string) =>
  `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

const RECURSOS = [
  { icon: <ShoppingBag size={22} />, titulo: 'Cardápio digital com link próprio', texto: 'Seu cliente pede pelo celular, sem baixar nada e sem cadastro. Cupons, combos e adicionais inclusos.' },
  { icon: <MessageCircle size={22} />, titulo: 'Pedidos em tempo real', texto: 'Painel no seu celular com som de campainha, comanda para impressora térmica e integração com WhatsApp.' },
  { icon: <QrCode size={22} />, titulo: 'Pix e cartão na plataforma', texto: 'QR Code Pix com confirmação automática e crédito parcelado — o dinheiro cai direto na sua conta Efí.' },
  { icon: <Boxes size={22} />, titulo: 'Estoque que se controla sozinho', texto: 'Cada venda baixa os ingredientes pela ficha técnica e avisa quando precisa comprar. Chega de planilha.' },
  { icon: <LineChart size={22} />, titulo: 'Lucro na palma da mão', texto: 'Custo real e margem de cada item do cardápio, calculados automaticamente.' },
  { icon: <Bike size={22} />, titulo: 'Modo entregador', texto: 'Seu motoboy recebe a fila de entregas com rota pronta no Google Maps.' },
];

const COMPARATIVO = [
  'Tudo que você já usa: cardápio, pedido, comanda, cupom e entrega',
  'O que você não tem hoje: estoque com baixa automática por ficha técnica',
  'Custo e lucro por produto — saiba quanto sobra em cada venda',
  'Sem taxa por pedido, sem comissão, sem fidelidade forçada',
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* Hero */}
      <header className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-12 pt-14 text-center">
        <img src="/logo.png" alt="MiseOn — Sistema Inteligente para sua Cozinha" className="w-80 max-w-full" />
        <h1 className="mt-8 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">
          Venha você também.{' '}
          <span className="text-orange-500">Traga sua cozinha</span>{' '}
          <span className="text-blue-800">para o MiseOn.</span>
        </h1>
        <p className="mt-4 max-w-xl text-gray-500">
          Cardápio digital, pedidos em tempo real, pagamento online, entrega e controle de
          estoque com ficha técnica — tudo em um só sistema, por menos do que você paga hoje.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/cadastre-se"
            className="rounded-2xl bg-blue-800 px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-blue-900"
          >
            Anuncie e cadastre sua loja
          </a>
          <a
            href="/lojas"
            className="rounded-2xl border-2 border-orange-500 px-8 py-4 font-semibold text-orange-500 transition hover:bg-orange-50"
          >
            Veja as lojas →
          </a>
        </div>
        <p className="mt-3 text-xs text-gray-400">Primeiro mês grátis · sem fidelidade · sem taxa por pedido</p>
        <a href="/admin/login" className="mt-4 text-xs font-medium text-gray-400 underline">Já tem loja? Acessar o painel</a>
      </header>

      {/* Recursos */}
      <section className="bg-gray-50 py-14">
        <div className="mx-auto grid max-w-5xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                {r.icon}
              </div>
              <h3 className="mt-3 font-bold">{r.titulo}</h3>
              <p className="mt-1 text-sm text-gray-500">{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Por que trocar */}
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h2 className="text-center text-2xl font-extrabold">
          Paga R$ 200+ por mês em sistema de pedidos?
        </h2>
        <p className="mt-2 text-center text-gray-500">
          No MiseOn você tem tudo isso por <b className="text-blue-800">R$ 150/mês</b>:
        </p>
        <ul className="mt-6 space-y-3">
          {COMPARATIVO.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-xl bg-green-50 p-3 text-sm">
              <Check size={18} className="mt-0.5 shrink-0 text-green-600" /> {item}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA final */}
      <section className="bg-blue-900 py-14 text-center text-white">
        <img src="/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl bg-white p-1" />
        <h2 className="mt-4 text-2xl font-extrabold">Sua cozinha, inteligente. Hoje.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-blue-200">
          Montamos seu cardápio, configuramos tudo e você começa a vender no mesmo dia.
        </p>
        <a
          href={zap('Olá! Quero uma demonstração do MiseOn 👨‍🍳')}
          className="mt-6 inline-block rounded-2xl bg-orange-500 px-10 py-4 font-semibold text-white shadow-lg transition hover:bg-orange-600"
        >
          Falar com a gente no WhatsApp
        </a>
      </section>

      <footer className="py-6 text-center text-xs text-gray-400">
        MiseOn © 2026 — Sistema Inteligente para sua Cozinha · Desenvolvido por Mald1vas.T4ch
      </footer>
    </div>
  );
}
