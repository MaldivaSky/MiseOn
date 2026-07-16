import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  LifeBuoy, ChevronDown, Landmark, QrCode, CreditCard, Timer, Check,
  ExternalLink, MessageCircle, ShieldCheck, Wallet, HelpCircle, ArrowRight,
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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
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
    <div className="relative rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--cor-primaria)] font-black text-white shadow-md">{n}</div>
      <h4 className="mb-2 pl-3 text-sm font-black dark:text-gray-100">{titulo}</h4>
      <div className="space-y-2 pl-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{children}</div>
    </div>
  );
}

export default function Ajuda() {
  return (
    <div className="mx-auto max-w-3xl p-4 pb-16">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-2xl bg-[var(--cor-primaria)]/10 p-3 text-[var(--cor-primaria)]"><LifeBuoy size={24} /></div>
        <div>
          <h2 className="text-xl font-black dark:text-gray-100">Central de Ajuda</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Tudo explicado sem tecniquês — do zero até o dinheiro na sua conta.</p>
        </div>
      </div>

      {/* ── Visão geral ── */}
      <div className="mb-8 rounded-2xl border border-[var(--cor-primaria)]/30 bg-[var(--cor-primaria)]/5 p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-[var(--cor-primaria)]"><Wallet size={16} /> Como o dinheiro chega até você</h3>
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          Quando seu cliente paga <b>online</b> (Pix ou cartão), quem processa o pagamento é o <b>Efí Bank</b> —
          um banco digital brasileiro, autorizado pelo Banco Central. O valor da venda é <b>repassado
          automaticamente para a SUA conta Efí</b>: o MiseOn não segura o seu dinheiro. Para isso funcionar,
          você só precisa de <b>uma conta Efí gratuita</b> e de preencher <b>3 informações simples</b> aqui no
          painel. O guia abaixo mostra o caminho completo.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-xl bg-white/60 p-3 dark:bg-black/20">
            <QrCode size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-xs text-gray-600 dark:text-gray-300"><b>Pix:</b> cai na sua conta <b>na hora</b> em que o cliente paga.</p>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-white/60 p-3 dark:bg-black/20">
            <CreditCard size={16} className="mt-0.5 shrink-0 text-blue-600" />
            <p className="text-xs text-gray-600 dark:text-gray-300"><b>Cartão de crédito:</b> cai no prazo que <b>você escolhe</b> (padrão ou antecipado).</p>
          </div>
        </div>
      </div>

      {/* ── Guia passo a passo ── */}
      <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
        <Landmark size={18} className="text-[var(--cor-primaria)]" /> Guia: configurando seus recebimentos
      </h3>
      <div className="space-y-5">
        <Passo n={1} titulo="Abra sua conta no Efí Bank (é grátis)">
          <p>
            A conta Efí é <b>sua</b> — como qualquer conta de banco digital — e não tem mensalidade.
            É nela que o dinheiro das suas vendas vai cair.
          </p>
          <p className="font-semibold text-gray-700 dark:text-gray-200">O que você vai precisar:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>CNPJ ativo</b> na Receita Federal (MEI serve!) e os dados do sócio responsável;</li>
            <li>Documento com foto do responsável (RG ou CNH);</li>
            <li>Contrato social ou certificado MEI (para MEI, geralmente basta o CNPJ).</li>
          </ul>
          <p className="font-semibold text-gray-700 dark:text-gray-200">Como abrir:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Baixe o aplicativo <b>Efí Bank</b> na loja do seu celular (ou acesse o site);</li>
            <li>Toque em <b>"Abrir conta"</b> e escolha <b>Efí Empresas</b> (conta PJ);</li>
            <li>Preencha os dados, fotografe os documentos e envie;</li>
            <li>Aguarde a análise — costuma sair <b>no mesmo dia</b>, tudo pelo celular.</li>
          </ol>
          <a href={EFI_LINKS.abrirConta} target="_blank" rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-4 py-2 text-xs font-bold text-white transition hover:brightness-110">
            Abrir minha conta Efí <ExternalLink size={13} />
          </a>
        </Passo>

        <Passo n={2} titulo="Copie o Identificador de conta (para receber o cartão)">
          <p>
            É um código de 32 letras e números que funciona como um <b>"endereço de recebimento"</b> — ele é
            público e seguro: <b>só serve para receber</b>, ninguém movimenta nada com ele.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Entre no painel da Efí <b>pelo computador</b> (sejaefi.com.br → Entrar);</li>
            <li>No menu lateral, clique em <b>API</b>;</li>
            <li>No canto superior direito, clique em <b>Identificador de conta</b> e copie o código;</li>
            <li>Cole aqui no painel, em <b>Configurações da Loja → Pagamentos e Integrações</b>.</li>
          </ol>
        </Passo>

        <Passo n={3} titulo="Informe os dados do Pix (para receber na hora)">
          <p>
            Para o Pix cair direto na sua conta, a Efí pede <b>dois dados do titular</b> — atenção: não é a
            chave Pix, é o <b>número da conta</b>:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>CPF ou CNPJ</b> do titular da conta Efí;</li>
            <li><b>Número da conta Efí</b> — você encontra no app, em <b>Perfil → Dados da conta</b>.</li>
          </ul>
          <p>Preencha os dois em <b>Configurações da Loja → Pagamentos e Integrações</b>.</p>
        </Passo>

        <Passo n={4} titulo="Escolha quando quer receber o cartão de crédito">
          <p>Na mesma tela de Pagamentos, você escolhe entre duas modalidades:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-xs font-black dark:text-gray-100">Prazo padrão</p>
              <p className="mt-1 text-xs">Recebe <b>uma parcela a cada ~31 dias</b>. Taxa menor.</p>
            </div>
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
              <p className="text-xs font-black dark:text-gray-100">Antecipado ⚡</p>
              <p className="mt-1 text-xs">Recebe o <b>valor total em ~2 dias úteis</b>, mesmo parcelado. Taxa maior.</p>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Timer size={13} /> Você pode trocar quando quiser — vale para as próximas vendas.
          </p>
          <Link to="/admin/loja" className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--cor-primaria)] underline">
            Ir para Configurações da Loja <ArrowRight size={13} />
          </Link>
        </Passo>
      </div>

      {/* ── Tabela de taxas ── */}
      <h3 className="mb-3 mt-10 flex items-center gap-2 text-base font-black dark:text-gray-100">
        <Wallet size={18} className="text-[var(--cor-primaria)]" /> Taxas do Efí Bank (por venda recebida)
      </h3>
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        {[
          { forma: 'Pix', detalhe: 'cai na hora', taxa: EFI_TARIFAS.pix },
          { forma: 'Crédito à vista', detalhe: 'prazo padrão ou antecipado', taxa: EFI_TARIFAS.creditoAVista },
          { forma: 'Crédito parcelado 2–6x', detalhe: 'prazo padrão (1 parcela / ~31 dias)', taxa: EFI_TARIFAS.creditoParcelado2a6 },
          { forma: 'Crédito parcelado 7–12x', detalhe: 'prazo padrão (1 parcela / ~31 dias)', taxa: EFI_TARIFAS.creditoParcelado7a12 },
          { forma: 'Antecipação ⚡', detalhe: 'recebe tudo em ~2 dias úteis', taxa: `${EFI_TARIFAS.creditoAVista} + ${EFI_TARIFAS.antecipacaoPorParcela}/parcela` },
          { forma: 'Dinheiro / maquininha na entrega', detalhe: 'fora do sistema', taxa: 'sem taxa MiseOn' },
        ].map((linha, i) => (
          <div key={linha.forma} className={`flex items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-gray-900 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}>
            <div>
              <p className="text-sm font-semibold dark:text-gray-100">{linha.forma}</p>
              <p className="text-[11px] text-gray-400">{linha.detalhe}</p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700 dark:bg-gray-800 dark:text-gray-200">{linha.taxa}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Quem cobra essas taxas é o <b>Efí Bank</b> (não o MiseOn) — tabela pública de {EFI_TARIFAS.referencia}, negociável
        por volume e sujeita a alteração pelo banco. Confira sempre em{' '}
        <a href={EFI_LINKS.tarifas} target="_blank" rel="noreferrer" className="font-semibold underline">sejaefi.com.br/tarifas</a>.
        A mensalidade do MiseOn é fixa: não cobramos comissão sobre as suas vendas.
      </p>

      {/* ── Perguntas frequentes ── */}
      <h3 className="mb-3 mt-10 flex items-center gap-2 text-base font-black dark:text-gray-100">
        <HelpCircle size={18} className="text-[var(--cor-primaria)]" /> Perguntas frequentes
      </h3>
      <div className="space-y-2">
        <Expansivel titulo="O MiseOn segura o meu dinheiro?" icone={<ShieldCheck size={15} className="text-emerald-600" />} aberto_inicial>
          <p>
            <b>Não.</b> O repasse é feito pelo próprio Efí Bank, automaticamente, direto para a sua conta —
            é o chamado "split de pagamento". No Pix o valor cai na hora; no cartão, no prazo da modalidade
            que você escolheu. O MiseOn cobra só a mensalidade fixa, sem comissão por venda.
          </p>
        </Expansivel>
        <Expansivel titulo="Preciso entender de tecnologia para configurar?">
          <p>
            Não. São só <b>3 informações</b>, todas copiadas do app/painel da Efí: o Identificador de conta
            (um código que você copia e cola), o CPF/CNPJ do titular e o número da conta. Nada de senhas,
            códigos de programador ou certificados — se alguém pedir isso, desconfie.
          </p>
        </Expansivel>
        <Expansivel titulo="E se eu ainda não configurar a conta Efí?">
          <p>
            Suas vendas <b>não travam</b>. Os pagamentos online continuam funcionando e o valor fica com a
            plataforma para repasse manual — mas o automático é mais rápido e seguro, então recomendamos
            configurar logo. Se preferir, você também pode <b>desligar o pagamento online</b> em
            Configurações da Loja → Pagamentos e aceitar só dinheiro/maquininha na entrega.
          </p>
        </Expansivel>
        <Expansivel titulo="Débito e dinheiro passam pelo sistema?">
          <p>
            O pagamento <b>na entrega</b> (dinheiro ou maquininha de débito/crédito do entregador) é
            combinado direto entre você e o cliente — o sistema registra o pedido e o método, mas o valor
            não passa pela Efí e <b>não tem taxa nenhuma do MiseOn</b>.
          </p>
        </Expansivel>
        <Expansivel titulo="Meus dados bancários ficam seguros?">
          <p>
            Sim. O Identificador de conta é um código <b>só de recebimento</b> (público por natureza — como
            uma chave Pix). O número do cartão dos seus clientes <b>nunca passa pelos nossos servidores</b>:
            ele é protegido pela tecnologia oficial da Efí direto no celular do cliente, no padrão
            internacional de segurança de cartões (PCI).
          </p>
        </Expansivel>
        <Expansivel titulo="Quem define as taxas? Dá para negociar?">
          <p>
            As taxas são do <b>Efí Bank</b> e seguem a tabela pública deles. Conforme o seu volume de vendas
            cresce, dá para negociar taxas melhores diretamente com a Efí — a conta é sua, a negociação
            também.
          </p>
        </Expansivel>
      </div>

      {/* ── Suporte ── */}
      <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
        <MessageCircle size={24} className="text-[var(--cor-primaria)]" />
        <p className="text-sm font-bold dark:text-gray-100">Ficou com dúvida em qualquer passo?</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Nosso time te acompanha na abertura da conta e na configuração — sem custo.</p>
        <a href={zapSuporte('Olá! Preciso de ajuda para configurar meus recebimentos no MiseOn.')} target="_blank" rel="noreferrer"
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-[var(--cor-primaria)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110">
          <MessageCircle size={15} /> Chamar no WhatsApp
        </a>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-gray-400">
        <Check size={12} className="text-emerald-500" /> Guia atualizado em {EFI_TARIFAS.referencia}
      </div>
    </div>
  );
}
