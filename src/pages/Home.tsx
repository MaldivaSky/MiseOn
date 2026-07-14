import { ShoppingBag, Bike, Boxes, MessageCircle, QrCode, LineChart, Check, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

const WHATSAPP_VENDAS = '5511919889233'; 
const zap = (msg: string) => `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

const RECURSOS = [
  { icon: <ShoppingBag size={24} />, titulo: 'Cardápio Digital KDS', texto: 'Seu cliente pede pelo celular e o pedido cai direto na sua tela KDS na cozinha. Sem intermediários, sem atrasos.' },
  { icon: <Boxes size={24} />, titulo: 'Estoque Inteligente', texto: 'Cada venda dá baixa automática nos ingredientes pela Ficha Técnica. Saiba exatamente o que comprar.' },
  { icon: <QrCode size={24} />, titulo: 'Split Efí Bank', texto: 'O dinheiro do Pix e Cartão cai direto na sua conta bancária oficial. Nós não tocamos no seu dinheiro.' },
  { icon: <Bike size={24} />, titulo: 'Logística de Entrega', texto: 'Sistema integrado de rotas para o seu motoboy, com acompanhamento de entrega em tempo real para o cliente.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 selection:bg-orange-500 selection:text-white dark:bg-[#0a0a0a] dark:text-gray-100">
      
      {/* Navbar Minimalista */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/50 bg-white/80 backdrop-blur-lg dark:border-white/5 dark:bg-[#0a0a0a]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img src="/logo.png" alt="MiseOn" className="h-8 dark:brightness-0 dark:invert" />
          <div className="flex gap-4">
            <a href="/admin/login" className="flex items-center text-sm font-semibold text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              Login Lojista
            </a>
            <a href="/cadastre-se" className="hidden rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 sm:block">
              Criar minha loja
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section Premium */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-blue-500/20 blur-[120px] dark:bg-blue-600/20"></div>
        
        <div className="mx-auto max-w-5xl px-6 text-center relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400">
            <Zap size={14} className="fill-orange-500" /> A revolução da sua cozinha chegou
          </div>
          
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl lg:leading-[1.1]">
            O sistema de pedidos que a sua cozinha <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-blue-600">sempre sonhou.</span>
          </h1>
          
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
            Abandone as planilhas e as taxas abusivas. Cardápio digital, comanda KDS, baixa automática de estoque por ficha técnica e pagamento direto na sua conta.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="/cadastre-se" className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700 hover:scale-105 sm:w-auto">
              Teste Grátis Agora <ArrowRight size={20} />
            </a>
            <a href="/natureba" className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-orange-500 bg-white px-8 py-4 text-lg font-bold text-orange-600 transition hover:bg-orange-50 dark:border-orange-500/50 dark:bg-gray-900 dark:text-orange-400 dark:hover:bg-gray-800 sm:w-auto">
              Visitar loja de exemplo
            </a>
            <a href={zap('Olá! Quero ver o MiseOn funcionando')} className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-gray-200 bg-white px-8 py-4 text-lg font-bold text-gray-800 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 sm:w-auto">
              Falar com Consultor
            </a>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-500">Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </section>

      {/* Grid de Recursos (Features) */}
      <section className="border-t border-gray-100 bg-white py-24 dark:border-white/5 dark:bg-[#0a0a0a]">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Nível Enterprise, preço de padaria.</h2>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Tudo que as grandes redes usam, agora disponível para o seu delivery.</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2">
            {RECURSOS.map((r, i) => (
              <div key={i} className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 p-8 transition hover:border-blue-500/50 dark:border-gray-800 dark:bg-gray-900/50">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-gray-800 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  {r.icon}
                </div>
                <h3 className="mb-3 text-2xl font-bold">{r.titulo}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - Plano Único */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-5xl">Pare de dar seu lucro<br/>para aplicativos.</h2>
          
          <div className="mx-auto mt-14 max-w-lg overflow-hidden rounded-3xl border border-orange-500/30 bg-white shadow-2xl dark:border-orange-500/20 dark:bg-gray-900 relative">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-blue-600"></div>
            <div className="p-8 sm:p-10">
              <h3 className="text-xl font-bold text-orange-500 uppercase tracking-wider">Plano Completo</h3>
              <div className="mt-4 flex items-center justify-center text-6xl font-extrabold tracking-tight">
                <span className="text-2xl mr-2 text-gray-400">R$</span>150<span className="text-xl font-medium text-gray-500 dark:text-gray-400">/mês</span>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-500">Valor fixo. Sem pegadinhas, sem taxas extras.</p>
              
              <ul className="mt-8 space-y-4 text-left">
                {['Cardápio digital PWA', 'Painel KDS para Cozinha', 'Estoque Automático (Ficha Técnica)', 'Split Efí Bank (Pix e Cartão) direto na sua conta', 'Suporte VIP via WhatsApp'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                    <Check size={20} className="shrink-0 text-green-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              
              <a href="/cadastre-se" className="mt-10 block w-full rounded-2xl bg-orange-500 py-4 text-lg font-bold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 hover:scale-[1.02]">
                Criar minha loja agora
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 text-center dark:border-white/5 bg-white dark:bg-[#0a0a0a]">
        <div className="flex items-center justify-center gap-2 text-gray-900 dark:text-white font-bold mb-4">
          <img src="/icon-192.png" className="w-6 h-6 rounded" alt=""/> MiseOn
        </div>
        <p className="text-sm text-gray-500">Contato: rafaelmaldivas@gmail.com</p>
        <p className="mt-2 text-sm text-gray-500">Desenvolvido por Mald1vas.T4ch © 2026</p>
      </footer>
    </div>
  );
}
