import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CtxLoja } from './AdminLayout';

interface Membro { user_id: string; papel: string; email: string }

export default function Equipe() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState('operador');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await supabase.functions.invoke('equipe-listar', { body: { loja_id: lojaId } });
    if (!error && data?.equipe) setEquipe(data.equipe);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const convidar = async () => {
    if (!email.trim()) return;
    setEnviando(true); setMsg('');
    const { data, error } = await supabase.functions.invoke('equipe-convidar', {
      body: { loja_id: lojaId, email: email.trim(), papel },
    });
    setEnviando(false);
    if (error || data?.error) return setMsg('Erro: ' + (data?.error ?? error?.message));
    setMsg(`Convite enviado para ${email}.`);
    setEmail('');
    carregar();
  };

  const remover = async (m: Membro) => {
    if (!confirm(`Remover ${m.email} da equipe?`)) return;
    await supabase.functions.invoke('equipe-convidar', { body: { loja_id: lojaId, remover_user_id: m.user_id } });
    carregar();
  };

  return (
    <div className="p-4">
      <h2 className="mb-3 font-bold">Equipe</h2>

      {carregando ? (
        <p className="text-sm text-gray-400">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {equipe.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
              <div>
                <p className="text-sm font-medium">{m.email}</p>
                <p className="text-xs capitalize text-gray-400">{m.papel}</p>
              </div>
              <button onClick={() => remover(m)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
          {equipe.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Só você por enquanto.</p>}
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Mail size={15} /> Convidar por e-mail</p>
        <div className="flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com"
            className="flex-1 rounded-xl border p-2.5 text-sm" />
          <select value={papel} onChange={(e) => setPapel(e.target.value)} className="rounded-xl border p-2.5 text-sm">
            <option value="admin">Admin</option>
            <option value="operador">Balcão</option>
            <option value="entregador">Entregador</option>
          </select>
        </div>
        <button onClick={convidar} disabled={enviando}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--cor-primaria)] py-2.5 text-sm font-semibold text-white disabled:opacity-40">
          <Plus size={15} /> {enviando ? 'Enviando…' : 'Convidar'}
        </button>
        {msg && <p className="mt-2 text-xs font-medium text-gray-600">{msg}</p>}
        <p className="mt-2 text-[11px] text-gray-400">
          A pessoa recebe um e-mail para criar a senha (ou pode entrar com Google usando o mesmo e-mail).
        </p>
      </div>
    </div>
  );
}
