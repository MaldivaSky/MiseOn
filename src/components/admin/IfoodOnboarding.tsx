import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle2, Store } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface IfoodOnboardingProps {
  lojaId: string;
  ifoodMerchantId?: string | null;
  onSuccess: () => void;
}

export function IfoodOnboarding({ lojaId, ifoodMerchantId, onSuccess }: IfoodOnboardingProps) {
  const [userCode, setUserCode] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const toast = useToast();

  const vincular = async () => {
    if (!userCode.trim() || userCode.length < 6) {
      setErro('Digite um código de autorização válido.');
      return;
    }
    setProcessando(true);
    setErro('');

    try {
      const { data, error } = await supabase.functions.invoke('ifood-auth', {
        body: { lojaId, authorizationCode: userCode.trim() }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast('iFood vinculado com sucesso!', 'sucesso');
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setErro(e.message || 'Falha ao vincular com o iFood. Verifique o código.');
    } finally {
      setProcessando(false);
    }
  };

  const desvincular = async () => {
    if (!confirm('Tem certeza que deseja desvincular o iFood? Você deixará de receber pedidos novos.')) return;
    setProcessando(true);
    try {
      const { error } = await supabase.from('lojas').update({
        ifood_merchant_id: null,
        ifood_authorization_code: null,
        ifood_refresh_token: null
      }).eq('id', lojaId);
      if (error) throw error;
      toast('iFood desvinculado.', 'info');
      onSuccess();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-gray-100">Integração iFood</h2>
          <p className="mt-1 text-sm text-gray-500">Receba pedidos do iFood direto no PDV.</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-900/20">
          <Store size={24} />
        </div>
      </div>

      {ifoodMerchantId ? (
        <div className="rounded-2xl border-2 border-emerald-500/20 bg-emerald-50 p-6 text-center dark:bg-emerald-900/10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="mt-4 text-lg font-black text-emerald-800 dark:text-emerald-400">Conta Vinculada!</h3>
          <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-500">
            ID da Loja no iFood: <span className="font-mono text-emerald-900 dark:text-emerald-300">{ifoodMerchantId}</span>
          </p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500/80">
            Os pedidos do iFood cairão automaticamente no seu PDV.
          </p>
          
          <button onClick={desvincular} disabled={processando} className="mt-6 rounded-xl border-2 border-red-200 px-6 py-2 text-sm font-bold text-red-500 transition hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20">
            Desvincular Conta
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <h4 className="font-bold text-gray-700 dark:text-gray-200">Como vincular:</h4>
            <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
              <li>Acesse o <strong>Portal do Parceiro iFood</strong>.</li>
              <li>Vá em <strong>Aplicativos {'>'} Meus Aplicativos</strong>.</li>
              <li>Procure por <strong>MiseOn</strong> e clique em Autorizar.</li>
              <li>Copie o <strong>Código de Autorização</strong> (User Code) gerado e cole abaixo.</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                Código de Autorização (User Code)
              </label>
              <input
                value={userCode}
                onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                placeholder="Ex: ABCD-1234"
                className="w-full rounded-xl border border-gray-300 p-3.5 font-mono text-lg font-black uppercase tracking-widest outline-none transition focus:border-red-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            {erro && <p className="text-sm font-medium text-red-500">{erro}</p>}
            <button
              onClick={vincular}
              disabled={processando || !userCode.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-3.5 text-base font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
            >
              {processando ? <Loader2 size={20} className="animate-spin" /> : <Store size={20} />}
              {processando ? 'Validando código...' : 'Vincular Restaurante'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
