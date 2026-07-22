import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function SuperAdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      console.error('Erro no signIn:', error);
      return setErro(error.message); // Mostra o erro real na tela
    }
    nav('/superadmin/tenants');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">MiseOn</p>
        <h1 className="mb-4 text-center text-lg font-bold">Painel SuperAdmin</h1>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail"
          className="mb-2 w-full rounded-xl border p-2.5 text-sm" />
        <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" placeholder="Senha"
          className="mb-3 w-full rounded-xl border p-2.5 text-sm" />
        {erro && <p className="mb-2 text-sm text-red-500">{erro}</p>}
        <button disabled={carregando} className="w-full rounded-xl bg-gray-900 py-3 font-semibold text-white disabled:opacity-50">
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
