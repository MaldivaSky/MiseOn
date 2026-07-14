import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { User as UserIcon, Lock, Mail, Phone, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function MinhaConta() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Senha
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Perfil (Metadata)
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [msgPerfil, setMsgPerfil] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setNome(user?.user_metadata?.full_name || user?.user_metadata?.nome || '');
      setTelefone(user?.user_metadata?.phone || user?.user_metadata?.telefone || '');
      setLoading(false);
    });
  }, []);

  const alterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSenha(null);

    if (novaSenha.length < 6) {
      return setMsgSenha({ tipo: 'erro', texto: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }
    if (novaSenha !== confirmaSenha) {
      return setMsgSenha({ tipo: 'erro', texto: 'As senhas não coincidem.' });
    }

    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSalvandoSenha(false);

    if (error) {
      setMsgSenha({ tipo: 'erro', texto: 'Erro ao alterar senha. Tente sair e entrar novamente.' });
    } else {
      setMsgSenha({ tipo: 'sucesso', texto: 'Senha alterada com segurança!' });
      setNovaSenha('');
      setConfirmaSenha('');
      setTimeout(() => setMsgSenha(null), 4000);
    }
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgPerfil(null);
    setSalvandoPerfil(true);

    const { error } = await supabase.auth.updateUser({
      data: { full_name: nome, nome, telefone, phone: telefone }
    });

    setSalvandoPerfil(false);

    if (error) {
      setMsgPerfil({ tipo: 'erro', texto: 'Não foi possível atualizar os dados.' });
    } else {
      setMsgPerfil({ tipo: 'sucesso', texto: 'Dados pessoais atualizados!' });
      setTimeout(() => setMsgPerfil(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="font-black text-2xl dark:text-gray-100 flex items-center gap-2">
          <UserIcon size={24} className="text-[var(--cor-primaria)]" /> Minha Conta
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gerencie seus dados de acesso e segurança como parceiro MiseOn.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* COLUNA 1: DADOS PESSOAIS */}
        <div className="space-y-6">
          <form onSubmit={salvarPerfil} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <ShieldCheck size={18} className="text-blue-500" /> Dados Pessoais
            </h3>

            {msgPerfil && (
              <div className={`mb-4 rounded-xl p-3 flex items-center gap-2 text-sm font-semibold ${msgPerfil.tipo === 'sucesso' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {msgPerfil.tipo === 'sucesso' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {msgPerfil.texto}
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">E-mail de Acesso (Login)</span>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="email" 
                    value={user?.email || ''} 
                    disabled 
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 py-3 pl-10 pr-3 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed" 
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">O e-mail de acesso não pode ser alterado por aqui.</p>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Nome Completo</span>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white" 
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Telefone Pessoal</span>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="tel" 
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white" 
                  />
                </div>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={salvandoPerfil}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all"
            >
              {salvandoPerfil ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Salvar Perfil
            </button>
          </form>
        </div>

        {/* COLUNA 2: SEGURANÇA E SENHA */}
        <div className="space-y-6">
          <form onSubmit={alterarSenha} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <Lock size={18} className="text-orange-500" /> Segurança e Senha
            </h3>

            {msgSenha && (
              <div className={`mb-4 rounded-xl p-3 flex items-center gap-2 text-sm font-semibold ${msgSenha.tipo === 'sucesso' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {msgSenha.tipo === 'sucesso' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {msgSenha.texto}
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Nova Senha</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="password" 
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 dark:text-white" 
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Confirmar Nova Senha</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="password" 
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 dark:text-white" 
                  />
                </div>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={salvandoSenha || !novaSenha || !confirmaSenha}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] text-white py-3 text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-[var(--cor-primaria)]/20"
            >
              {salvandoSenha ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              Atualizar Senha
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
