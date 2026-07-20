import { ShieldCheck } from 'lucide-react';

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070C18] dark:text-[#EAF1FB] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[var(--cor-secundaria)] px-8 py-10 text-white text-center">
          <ShieldCheck size={48} className="mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl font-extrabold font-sora">Política de Privacidade</h1>
          <p className="mt-2 text-white/80">Conformidade com a LGPD (Lei nº 13.709/2018)</p>
        </div>
        
        <div className="p-8 sm:p-12 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">1. Compromisso com a Privacidade</h2>
            <p>
              A sua privacidade é fundamental para o <strong>MiseOn</strong>. Esta Política de Privacidade explica como coletamos, usamos e protegemos os seus dados pessoais e os dados dos clientes finais do seu restaurante.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">2. Dados que Coletamos</h2>
            <p className="mb-2"><strong>Dos Lojistas (Restaurantes):</strong></p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>Nome, E-mail, Telefone/WhatsApp, CPF/CNPJ.</li>
              <li>Dados bancários para processamento de Split de Pagamentos.</li>
              <li>Informações de uso da plataforma (logs, metadados).</li>
            </ul>

            <p className="mb-2"><strong>Dos Clientes Finais (Consumidores):</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome e Telefone (WhatsApp) para autenticação.</li>
              <li>Endereço completo para entrega de pedidos.</li>
              <li>Histórico de compras e hábitos de consumo (Business Intelligence).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">3. Uso dos Dados</h2>
            <p>
              Os dados dos clientes finais pertencem <strong>exclusivamente ao Lojista (Tenant)</strong> ao qual o pedido foi direcionado. 
              O MiseOn age apenas como Operador de Dados, processando as informações para viabilizar a entrega, o pagamento e as métricas do painel CRM.
              Nós nunca venderemos ou compartilharemos o mailing dos seus clientes com restaurantes concorrentes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">4. Proteção e Segurança (Supabase)</h2>
            <p>
              Todo o armazenamento é protegido com criptografia <em>Row Level Security (RLS)</em> no banco de dados. 
              Garantimos o isolamento das informações (Multi-Tenancy), de forma que o Lojista A nunca tenha acesso ao banco de dados do Lojista B.
              As senhas são protegidas com hash <em>Bcrypt</em> robusto e os dados sensíveis nunca são expostos em texto puro.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">5. Seus Direitos (Titular dos Dados)</h2>
            <p>
              Você e os seus clientes têm o direito de solicitar o acesso, correção, anonimização ou exclusão dos dados pessoais a qualquer momento, conforme o Art. 18 da LGPD. Para solicitações de deleção profunda (Right to be Forgotten), basta acionar o suporte do sistema.
            </p>
          </section>

          <div className="mt-10 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">DPO / Encarregado de Dados</p>
            <p>Para assuntos relacionados à privacidade e proteção de dados, fale com nosso encarregado: <a href="mailto:dpo@miseon.com.br" className="text-[var(--cor-secundaria)] hover:underline">dpo@miseon.com.br</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
