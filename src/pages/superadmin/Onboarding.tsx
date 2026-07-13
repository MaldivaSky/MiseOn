import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Onboarding() {
  const [slug, setSlug] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [emailDono, setEmailDono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const criar = async () => {
    setErro(''); setMsg('');
    if (!slug || !nome || !whatsapp || !emailDono) return setErro('Preencha todos os campos.');
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke('superadmin-criar-loja', {
      body: { slug, nome, whatsapp, email_dono: emailDono },
    });
    setEnviando(false);
    if (error || data?.error) return setErro(data?.error ?? error?.message ?? 'Erro ao criar loja.');
    setMsg(`Loja "${data.slug}" criada! Convite enviado para ${emailDono}.`);
    setSlug(''); setNome(''); setWhatsapp(''); setEmailDono('');
  };

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Onboarding de nova loja</h2>
      <div className="max-w-md space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da loja" className="w-full rounded-xl border p-2.5 text-sm" />
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (ex: burger-do-ze)" className="w-full rounded-xl border p-2.5 text-sm" />
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (5511999999999)" className="w-full rounded-xl border p-2.5 text-sm" />
        <input value={emailDono} onChange={(e) => setEmailDono(e.target.value)} placeholder="E-mail do dono da loja" className="w-full rounded-xl border p-2.5 text-sm" />
        {erro && <p className="text-sm font-medium text-red-500">{erro}</p>}
        {msg && <p className="text-sm font-medium text-green-600">{msg}</p>}
        <button onClick={criar} disabled={enviando}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white disabled:opacity-40">
          {enviando ? 'Criando…' : 'Criar loja e convidar dono'}
        </button>
      </div>
    </div>
  );
}
