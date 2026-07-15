import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, Calendar, Lock, ShieldCheck, QrCode, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CtxLoja } from './AdminLayout';

export default function Assinatura() {
  const { lojaId, lojaNome } = useOutletContext<CtxLoja>();
  const [status, setStatus] = useState<string>('ATIVO');
  const [vencimento, setVencimento] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [metodo, setMetodo] = useState<'cartao' | 'pix'>('cartao');
  
  // Estados para o Cartão de Crédito
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [validade, setValidade] = useState(''); // MM/AA
  const [cvv, setCvv] = useState('');
  const [celular, setCelular] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Estados para o Pix
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copiaCola, setCopiaCola] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    carregarDados();
  }, [lojaId]);

  const carregarDados = async () => {
    setCarregando(true);
    const { data } = await supabase.from('lojas').select('status_assinatura, vencimento_assinatura').eq('id', lojaId).single();
    if (data) {
      setStatus(data.status_assinatura || 'INATIVO');
      setVencimento(data.vencimento_assinatura);
    }
    setCarregando(false);
  };

  const assinarCartao = async () => {
    setErro(''); setSucesso('');
    const num = numero.replace(/\s/g, '');
    const [mes, ano] = validade.split('/');
    if (num.length < 13 || !nome || cpf.replace(/\D/g, '').length !== 11 || !mes || !ano || cvv.length < 3) {
      return setErro('Confira os dados do cartão.');
    }
    setProcessando(true);

    try {
      if (!(window as any).EfiPay) {
        await new Promise<void>((ok, err) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/payment-token-efi/dist/payment-token-efi-umd.min.js';
          s.onload = () => ok();
          s.onerror = () => err(new Error('Falha ao carregar SDK Efí'));
          document.head.appendChild(s);
        });
      }
      const EfiPay = (window as any).EfiPay;
      
      const payeeCode = import.meta.env.VITE_MISEON_EFI_PAYEE_CODE;
      if (!payeeCode) throw new Error('Payee Code da Plataforma não configurado.');

      const ambiente = import.meta.env.VITE_SUPABASE_URL?.includes('localhost') ? 'sandbox' : 'production';
      
      let payment_token = '';
      try {
        const result = await EfiPay.CreditCard
          .setAccount(payeeCode)
          .setEnvironment(ambiente)
          .setCreditCardData({
            brand: await EfiPay.CreditCard.setCardNumber(num).verifyCardBrand(),
            number: num,
            cvv: cvv,
            expirationMonth: mes,
            expirationYear: ano.length === 2 ? `20${ano}` : ano,
            holderName: nome,
            holderDocument: cpf.replace(/\D/g, ''),
            reuse: false
          })
          .getPaymentToken();
          
        payment_token = result.payment_token;
      } catch (tokenErr: any) {
        throw new Error(tokenErr?.error_description || 'Falha ao validar o cartão junto ao banco.');
      }
      
      const { data, error } = await supabase.functions.invoke('saas-assinar', {
        body: { loja_id: lojaId, payment_token, customer: { name: nome, cpf, phone: celular } }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || 'Pagamento recusado pelo banco.');
      
      setSucesso('Transação Aprovada! Assinatura ativada com sucesso.');
      setNumero(''); setNome(''); setCpf(''); setValidade(''); setCvv(''); setCelular('');
      carregarDados();
    } catch (e: any) {
      setErro(e?.message || 'Erro crítico ao processar o pagamento.');
    }
    setProcessando(false);
  };

  const gerarPix = async () => {
    setErro(''); setSucesso(''); setProcessando(true);
    try {
      const { data, error } = await supabase.functions.invoke('saas-pix', {
        body: { loja_id: lojaId }
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Falha ao gerar Pix.');
      
      if (data.qr_imagem && data.copia_e_cola) {
         setQrCode(data.qr_imagem);
         setCopiaCola(data.copia_e_cola);
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao comunicar com a Efí Bank.');
    }
    setProcessando(false);
  };

  const copiarPix = () => {
    navigator.clipboard.writeText(copiaCola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (carregando) return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--cor-primaria)]"></div>
         <p className="text-sm font-semibold text-gray-400">Autenticando ambiente seguro...</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)] rounded-2xl">
            <CreditCard size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black dark:text-gray-100">Meu Plano (SaaS)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Lock size={12} /> Checkout blindado pela Efí Bank
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-500 rounded-xl border border-green-200 dark:border-green-800/50">
          <ShieldCheck size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Ambiente Seguro</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Lado Esquerdo: Resumo do Plano */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`rounded-3xl border p-6 shadow-sm transition-colors ${status === 'ATIVO' ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'}`}>
            <p className="mb-6 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Resumo da Assinatura</p>
            
            <div className="flex items-center gap-4 mb-8">
              {status === 'ATIVO' ? (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 shadow-inner">
                  <CheckCircle size={28} />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-inner animate-pulse">
                  <AlertCircle size={28} />
                </div>
              )}
              <div>
                <p className={`text-xl font-black ${status === 'ATIVO' ? 'text-green-600' : 'text-red-600'}`}>
                  {status === 'ATIVO' ? 'Ativa & Operante' : 'Inadimplente / Bloqueada'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mt-0.5">{lojaNome}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 dark:bg-gray-950 p-5 border border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">MiseOn Profissional</span>
                <span className="font-black text-lg text-gray-900 dark:text-gray-100">R$ 150,00 <span className="text-xs text-gray-400 font-medium">/mês</span></span>
              </div>
              
              <div className="h-px bg-gray-200 dark:bg-gray-800 w-full"></div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400"><Calendar size={16} /> Próximo Vencimento</span>
                <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${status === 'ATIVO' ? 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300' : 'bg-red-100 text-red-700'}`}>
                  {vencimento ? new Date(vencimento).toLocaleDateString('pt-BR') : 'Sem data'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4 opacity-50 grayscale">
            <img src="https://logospng.org/download/pix/logo-pix-icone-1024.png" className="h-5 object-contain" alt="Pix" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Mastercard_2019_logo.svg/800px-Mastercard_2019_logo.svg.png" className="h-5 object-contain" alt="Mastercard" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png" className="h-4 object-contain" alt="Visa" />
          </div>
        </div>

        {/* Lado Direito: Checkout Híbrido */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 sm:p-2 shadow-xl shadow-gray-200/50 dark:shadow-none">
            
            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 dark:bg-gray-950 rounded-2xl mb-6">
              <button onClick={() => setMetodo('cartao')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${metodo === 'cartao' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <CreditCard size={18} /> Cartão de Crédito
              </button>
              <button onClick={() => setMetodo('pix')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${metodo === 'pix' ? 'bg-white dark:bg-gray-900 shadow-sm text-teal-600 dark:text-teal-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <QrCode size={18} /> Pix
              </button>
            </div>

            <div className="p-4 sm:p-6 pt-0">
              {erro && (
                <div className="mb-6 animate-in fade-in flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 text-sm font-semibold text-red-700 dark:text-red-400">
                  <AlertCircle size={20} className="shrink-0" /> <p>{erro}</p>
                </div>
              )}
              {sucesso && (
                <div className="mb-6 animate-in fade-in flex items-center gap-3 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-4 text-sm font-semibold text-green-700 dark:text-green-400">
                  <CheckCircle size={20} className="shrink-0" /> <p>{sucesso}</p>
                </div>
              )}

              {metodo === 'cartao' ? (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Cobrança recorrente mensal. Cancele quando quiser.</p>
                  
                  <label className="block">
                     <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Número do Cartão</span>
                     <div className="relative mt-1">
                        <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric" placeholder="0000 0000 0000 0000" 
                          className="w-full rounded-xl border border-gray-300 p-3.5 pl-10 text-sm font-medium focus:border-[var(--cor-primaria)] focus:ring-4 focus:ring-[var(--cor-primaria)]/10 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 transition-all" />
                        <CreditCard size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                     </div>
                  </label>
                  
                  <label className="block">
                     <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Nome impresso no cartão</span>
                     <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="JOAO S SILVA" 
                       className="mt-1 w-full rounded-xl border border-gray-300 p-3.5 text-sm font-medium uppercase focus:border-[var(--cor-primaria)] focus:ring-4 focus:ring-[var(--cor-primaria)]/10 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 transition-all" />
                  </label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                       <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Validade</span>
                       <input value={validade} onChange={(e) => setValidade(e.target.value)} placeholder="MM/AA" 
                         className="mt-1 w-full rounded-xl border border-gray-300 p-3.5 text-sm font-medium focus:border-[var(--cor-primaria)] focus:ring-4 focus:ring-[var(--cor-primaria)]/10 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 transition-all" />
                    </label>
                    <label className="block">
                       <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">CVV</span>
                       <input value={cvv} onChange={(e) => setCvv(e.target.value)} inputMode="numeric" placeholder="123" type="password" maxLength={4}
                         className="mt-1 w-full rounded-xl border border-gray-300 p-3.5 text-sm font-medium focus:border-[var(--cor-primaria)] focus:ring-4 focus:ring-[var(--cor-primaria)]/10 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 transition-all" />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                       <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">CPF do Titular</span>
                       <input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00" 
                         className="mt-1 w-full rounded-xl border border-gray-300 p-3.5 text-sm font-medium focus:border-[var(--cor-primaria)] focus:ring-4 focus:ring-[var(--cor-primaria)]/10 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 transition-all" />
                    </label>
                    <label className="block">
                       <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Celular</span>
                       <input value={celular} onChange={(e) => setCelular(e.target.value)} inputMode="numeric" placeholder="(11) 90000-0000" 
                         className="mt-1 w-full rounded-xl border border-gray-300 p-3.5 text-sm font-medium focus:border-[var(--cor-primaria)] focus:ring-4 focus:ring-[var(--cor-primaria)]/10 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 transition-all" />
                    </label>
                  </div>

                  <button onClick={assinarCartao} disabled={processando}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-100 py-4 font-bold text-white dark:text-gray-900 transition-transform hover:scale-[1.01] active:scale-95 disabled:pointer-events-none disabled:opacity-50">
                    {processando ? (
                      <><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-white dark:border-t-gray-900"></div> Autenticando no Banco...</>
                    ) : (
                      <><Lock size={18} /> Pagar Assinatura (R$ 150,00)</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-left-4 flex flex-col items-center">
                  <div className="text-center mt-2">
                     <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Pagamento instantâneo via Pix.</p>
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Acesso liberado no exato segundo que você pagar.</p>
                  </div>

                  {!qrCode ? (
                     <button onClick={gerarPix} disabled={processando}
                       className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-teal-600 py-4 font-bold text-white transition-transform hover:scale-[1.01] active:scale-95 disabled:pointer-events-none disabled:opacity-50">
                       {processando ? (
                         <><div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-800 border-t-white"></div> Gerando código seguro...</>
                       ) : (
                         <><QrCode size={20} /> Gerar Pix de R$ 150,00</>
                       )}
                     </button>
                  ) : (
                     <div className="flex flex-col items-center w-full max-w-sm animate-in zoom-in-95">
                        <div className="p-4 bg-white rounded-2xl border-2 border-teal-500 shadow-xl shadow-teal-500/20 mb-6">
                           <img src={qrCode} alt="QR Code Pix" className="w-56 h-56" />
                        </div>
                        
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Pix Copia e Cola</p>
                        <div className="flex w-full items-center gap-2">
                           <input readOnly value={copiaCola} className="w-full rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-3 text-xs text-gray-600 dark:text-gray-400 font-mono truncate" />
                           <button onClick={copiarPix} className={`shrink-0 flex items-center justify-center p-3 rounded-xl transition-colors ${copiado ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300'}`}>
                             {copiado ? <CheckCircle size={18} /> : <Copy size={18} />}
                           </button>
                        </div>
                        <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold mt-4 flex items-center gap-1">
                           <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div> Aguardando confirmação do banco...
                        </p>
                     </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-xs font-semibold text-gray-400 flex items-center justify-center gap-1.5">
            <Lock size={12} /> Criptografia end-to-end. Nossos servidores não armazenam dados do seu cartão.
          </p>
        </div>

      </div>
    </div>
  );
}
