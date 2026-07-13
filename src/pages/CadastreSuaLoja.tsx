import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TIPOS_NEGOCIO = ['Lanchonete', 'Restaurante', 'Pizzaria', 'Doceria/Confeitaria', 'Mercado/Conveniência', 'Outro'];

export default function CadastreSuaLoja() {
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [nomeLoja, setNomeLoja] = useState('');
  const [tipoNegocio, setTipoNegocio] = useState('');
  const [cidade, setCidade] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async () => {
    setErro('');
    if (!nomeResponsavel.trim() || !nomeLoja.trim() || !whatsapp.trim()) {
      return setErro('Preencha nome, nome da loja e WhatsApp.');
    }
    setEnviando(true);
    const { error } = await supabase.from('leads_cadastro').insert({
      nome_responsavel: nomeResponsavel.trim(),
      nome_loja: nomeLoja.trim(),
      tipo_negocio: tipoNegocio || null,
      cidade: cidade.trim() || null,
      whatsapp: whatsapp.trim(),
      email: email.trim() || null,
      observacao: observacao.trim() || null,
    });
    setEnviando(false);
    if (error) return setErro('Erro ao enviar: ' + error.message);
    setEnviado(true);
  };

  if (enviado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white p-8 text-center">
        <CheckCircle2 size={40} className="text-green-600" />
        <h1 className="text-lg font-bold">Recebemos seu cadastro!</h1>
        <p className="max-w-sm text-sm text-gray-500">
          Vamos entrar em contato pelo WhatsApp <b>{whatsapp}</b> pra colocar sua loja no ar.
        </p>
        <Link to="/" className="mt-3 text-sm font-semibold text-blue-800">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <Store size={22} className="text-blue-800" />
          <h1 className="text-lg font-bold">Cadastre sua loja</h1>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Cardápio digital, pedidos, entrega e controle de estoque — a gente configura pra você.
        </p>
        <div className="space-y-2">
          <input value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} placeholder="Seu nome"
            className="w-full rounded-xl border p-2.5 text-sm" />
          <input value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} placeholder="Nome da sua loja"
            className="w-full rounded-xl border p-2.5 text-sm" />
          <select value={tipoNegocio} onChange={(e) => setTipoNegocio(e.target.value)} className="w-full rounded-xl border p-2.5 text-sm text-gray-700">
            <option value="">Tipo de negócio</option>
            {TIPOS_NEGOCIO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade"
            className="w-full rounded-xl border p-2.5 text-sm" />
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (11) 9…"
            className="w-full rounded-xl border p-2.5 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional)"
            className="w-full rounded-xl border p-2.5 text-sm" />
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Conte um pouco do seu negócio (opcional)" rows={2}
            className="w-full rounded-xl border p-2.5 text-sm" />
        </div>
        {erro && <p className="mt-2 text-sm font-medium text-red-500">{erro}</p>}
        <button onClick={enviar} disabled={enviando}
          className="mt-4 w-full rounded-xl bg-blue-800 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {enviando ? 'Enviando…' : 'Quero minha loja na MiseOn'}
        </button>
        <Link to="/" className="mt-3 block text-center text-xs text-gray-400">Voltar</Link>
      </div>
    </div>
  );
}
