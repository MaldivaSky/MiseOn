import { ShieldCheck, FileText, Lock } from 'lucide-react';

export default function Termos() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070C18] dark:text-[#EAF1FB] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[var(--cor-primaria)] px-8 py-10 text-white text-center">
          <FileText size={48} className="mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl font-extrabold font-sora">Termos de Uso e Serviço</h1>
          <p className="mt-2 text-white/80">Última atualização: Julho de 2026</p>
        </div>
        
        <div className="p-8 sm:p-12 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar o <strong>MiseOn</strong>, você concorda com estes Termos de Uso e Serviço. Caso não concorde com qualquer parte destes termos, você não deverá utilizar nossa plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">2. Descrição do Serviço</h2>
            <p>
              O MiseOn é uma plataforma SaaS (Software as a Service) voltada para o mercado de Food Service, que oferece ferramentas como Cardápio Digital (PWA), Sistema de Tela para Cozinha (KDS), controle de estoque automatizado via ficha técnica, e inteligência artificial para otimização de vendas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">3. Responsabilidades do Lojista (Tenant)</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Manter a veracidade das informações dos produtos e preços.</li>
              <li>Honrar com as ofertas, cupons e políticas de entrega cadastradas na plataforma.</li>
              <li>Não utilizar o sistema para a venda de produtos ilícitos.</li>
              <li>Assumir total responsabilidade civil, fiscal e criminal pelos produtos vendidos através do sistema.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">4. Gateway de Pagamento e Split</h2>
            <p>
              O MiseOn utiliza integração com gateways de pagamento parceiros (como Efí Bank). Não nos responsabilizamos por falhas na aprovação de crédito pelas operadoras, estornos de cartão ou fraudes bancárias (chargebacks). 
              Taxas de processamento podem ser retidas diretamente na fonte através da funcionalidade de Split de Pagamentos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">5. Limitação de Responsabilidade</h2>
            <p>
              Nós nos esforçamos para manter a plataforma no ar 24/7 com alta disponibilidade, porém não garantimos que o acesso será ininterrupto, livre de erros ou totalmente seguro a todo instante. 
              O MiseOn não se responsabiliza por eventuais perdas financeiras advindas de instabilidades sistêmicas ou quedas de internet do restaurante.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">6. Rescisão</h2>
            <p>
              Você pode cancelar a sua assinatura a qualquer momento através do seu painel administrativo. Não exigimos fidelidade, mas não realizamos reembolsos retroativos de meses parciais não utilizados após o fechamento da fatura.
            </p>
          </section>

          <div className="mt-10 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Contato Jurídico</p>
            <p>Dúvidas sobre este termo? Envie um email para: <a href="mailto:legal@miseon.com.br" className="text-[var(--cor-secundaria)] hover:underline">legal@miseon.com.br</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
