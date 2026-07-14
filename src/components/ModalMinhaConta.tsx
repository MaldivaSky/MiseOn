import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, User, MapPin, Phone, History, LogOut, Loader2, Save } from 'lucide-react';

export default function ModalMinhaConta({
  isOpen,
  onClose,
  lojaId,
  userId,
  userEmail
}: {
  isOpen: boolean;
  onClose: () => void;
  lojaId: string;
  userId: string;
  userEmail?: string;
}) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setCarregando(true);
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setNome(data.nome ?? '');
        setTelefone(data.telefone ?? '');
        setEndereco(data.endereco ?? '');
        setBairro(data.bairro ?? '');
      }
      setCarregando(false);
    })();
  }, [isOpen, lojaId, userId]);

  if (!isOpen) return null;

  const salvarDados = async () => {
    setSalvando(true);
    setMensagem('');
    const { error } = await supabase.from('clientes').upsert({
      loja_id: lojaId,
      user_id: userId,
      nome,
      telefone,
      endereco,
      bairro,
      email: userEmail ?? null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setMensagem('Erro ao salvar os dados.');
    } else {
      setMensagem('Dados atualizados com sucesso!');
      setTimeout(() => setMensagem(''), 3000);
    }
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
      <div className="h-full w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow-2xl transition-transform dark:bg-gray-900 sm:w-96">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Minha Conta</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {carregando ? (
          <div className="mt-20 flex justify-center text-blue-500">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Email logado: <strong className="text-gray-800 dark:text-gray-200">{userEmail}</strong></p>
            </div>

            <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-5 dark:border-gray-800">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">Meus Dados</h3>
              
              <div className="relative">
                <User className="absolute left-3 top-3.5 text-gray-400" size={16} />
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-3.5 text-gray-400" size={16} />
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Telefone (WhatsApp)"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-5 dark:border-gray-800">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">Endereço de Entrega Padrão</h3>
              
              <div className="relative">
                <MapPin className="absolute left-3 top-3.5 text-gray-400" size={16} />
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, complemento"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
              </div>

              <div className="relative">
                <MapPin className="absolute left-3 top-3.5 text-gray-400" size={16} />
                <input
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Bairro"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
              </div>
            </div>

            {mensagem && (
              <div className={`rounded-lg p-3 text-sm ${mensagem.includes('Erro') ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'}`}>
                {mensagem}
              </div>
            )}

            <button
              onClick={salvarDados}
              disabled={salvando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                onClose();
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              <LogOut size={16} /> Sair da conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
