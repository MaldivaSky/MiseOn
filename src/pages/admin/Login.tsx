import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Login() {
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
    if (error) return setErro('E-mail ou senha inválidos.');
    nav('/admin/pedidos');
  };

  const entrarComGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
        <img src="/logo.png" alt="MiseOn" className="mx-auto mb-2 w-52" />
        <p className="mb-4 text-center text-sm text-gray-500">Entre para gerenciar sua loja</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="E-mail"
          className="mb-2 w-full rounded-xl border p-2.5 text-sm"
        />
        <input
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          type="password"
          placeholder="Senha"
          className="mb-3 w-full rounded-xl border p-2.5 text-sm"
        />
        {erro && <p className="mb-2 text-sm text-red-500">{erro}</p>}
        <button
          disabled={carregando}
          className="w-full rounded-xl bg-blue-800 py-3 font-semibold text-white disabled:opacity-50"
        >
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="my-3 flex items-center gap-2 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" /> ou <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={entrarComGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold text-gray-700"
        >
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4c-7.5 0-13.9 4.3-17.7 10.7z" /><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.9 39.6 16.4 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.7l6.6 5.6C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" /></svg>
          Entrar com Google
        </button>
      </form>
    </div>
  );
}
