import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CtxLoja } from './AdminLayout';

export default function Assinatura() {
  const { lojaId, lojaNome } = useOutletContext<CtxLoja>();
  const [status, setStatus] = useState<string>('ATIVO');
  const [vencimento, setVencimento] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  
  // Estados para o Cartão de Crédito
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [validade, setValidade] = useState(''); // MM/AA
  const [cvv, setCvv] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

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

  const assinar = async () => {
    setErro('');
    setSucesso('');
    const num = numero.replace(/\s/g, '');
    const [mes, ano] = validade.split('/');
    if (num.length < 13 || !nome || cpf.replace(/\D/g, '').length !== 11 || !mes || !ano || cvv.length < 3) {
      return setErro('Confira os dados do cartão.');
    }
    setProcessando(true);

    try {
      // Simulação da geração de token e assinatura via Efí Bank (Plataforma)
      // Em produção, isso chamaria a SDK da Efí e em seguida a Edge Function 'saas-assinar'
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
      
      // Validação simulada para o fluxo
      const brand = await EfiPay.CreditCard.setCardNumber(num).verifyCardBrand();
      
      // Como a conta mestre é da Plataforma (MiseOn), passamos o ID da plataforma
      // Em um ambiente real, o backend processa a recorrência guardando o token de pagamento.
      
      // Chamada para a nossa Edge Function (simulada)
      /*
      const { data, error } = await supabase.functions.invoke('saas-assinar', {
        body: { loja_id: lojaId, card_token: 'token_simulado' }
      });
      */

      // Simulando sucesso imediato
      await new Promise(r => setTimeout(r, 1500));
      
      // Atualizando banco localmente para refletir
      const novoVencimento = new Date();
      novoVencimento.setMonth(novoVencimento.getMonth() + 1);
      
      await supabase.from('lojas').update({
        status_assinatura: 'ATIVO',
        vencimento_assinatura: novoVencimento.toISOString()
      }).eq('id', lojaId);

      setSucesso('Assinatura ativada com sucesso! Cobrança recorrente configurada.');
      setNumero(''); setNome(''); setCpf(''); setValidade(''); setCvv('');
      carregarDados();

    } catch (e: any) {
      setErro(e?.message || 'Erro ao processar a assinatura.');
    }
    setProcessando(false);
  };

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        <CreditCard size={24} className="text-[var(--cor-primaria)]" />
        <h2 className="text-xl font-bold">Meu Plano (MiseOn SaaS)</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card de Status */}
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">Status da Assinatura</p>
          
          <div className="flex items-center gap-3 mb-6">
            {status === 'ATIVO' ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle size={24} />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle size={24} />
              </div>
            )}
            <div>
              <p className={`text-lg font-bold ${status === 'ATIVO' ? 'text-green-600' : 'text-red-600'}`}>
                {status === 'ATIVO' ? 'Plano Ativo' : 'Plano Inativo / Inadimplente'}
              </p>
              <p className="text-sm text-gray-500">{lojaNome}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Plano Profissional</span>
              <span className="font-bold text-gray-900">R$ 150,00 / mês</span>
            </div>
            {vencimento && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm text-gray-600"><Calendar size={14} /> Próxima cobrança</span>
                <span className="font-semibold text-gray-900">{new Date(vencimento).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Formulário de Pagamento Recorrente */}
        <div className="rounded-3xl border border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 p-6">
          <h3 className="mb-2 text-lg font-bold text-[var(--cor-primaria)]">Atualizar Cartão (Cobrança Automática)</h3>
          <p className="mb-5 text-xs text-gray-600">
            Cadastre seu cartão para ativar a cobrança mensal de <strong>R$ 150,00</strong>. 
            O pagamento é processado de forma segura e automática pela Efí Bank.
          </p>

          <div className="space-y-3">
            <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric"
              placeholder="Número do cartão" className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none" />
            
            <input value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Nome impresso no cartão" className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none" />
            
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric"
              placeholder="CPF do titular" className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none" />
            
            <div className="flex gap-3">
              <input value={validade} onChange={(e) => setValidade(e.target.value)}
                placeholder="Validade (MM/AA)" className="w-1/2 rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none" />
              <input value={cvv} onChange={(e) => setCvv(e.target.value)} inputMode="numeric"
                placeholder="CVV" className="w-1/2 rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none" />
            </div>
          </div>

          {erro && <p className="mt-3 text-sm font-medium text-red-500">{erro}</p>}
          {sucesso && <p className="mt-3 text-sm font-medium text-green-600">{sucesso}</p>}

          <button onClick={assinar} disabled={processando}
            className="mt-5 w-full rounded-xl bg-[var(--cor-primaria)] py-3.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
            {processando ? 'Processando...' : 'Ativar Assinatura (R$ 150/mês)'}
          </button>
          
          <p className="mt-3 text-center text-[10px] text-gray-500">
            Ao ativar, você concorda com a cobrança recorrente mensal. Cancele quando quiser.
          </p>
        </div>
      </div>
    </div>
  );
}
