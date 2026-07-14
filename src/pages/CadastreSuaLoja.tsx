import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MiseOnLogo from '../components/MiseOnLogo';

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white dark:bg-gray-900 dark:border-gray-800 p-8 text-center">
        <CheckCircle2 size={40} className="text-green-600" />
        <h1 className="text-lg font-bold">Recebemos seu cadastro!</h1>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          Vamos entrar em contato pelo WhatsApp <b>{whatsapp}</b> pra colocar sua loja no ar.
        </p>
        <Link to="/" className="mt-3 text-sm font-semibold text-blue-800">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-10 bg-transparent">
      <div className="w-full max-w-md rounded-3xl border border-[rgba(10,92,196,0.2)] bg-[#0B1120]/80 backdrop-blur-xl p-8 shadow-[0_0_40px_rgba(10,92,196,0.15)] relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--cor-primaria)] opacity-10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[var(--cor-secundaria)] opacity-10 blur-3xl" />
        
        <div className="mb-8 flex flex-col items-center justify-center text-center relative z-10">
          <MiseOnLogo size={150} className="mb-4" />
          <h1 className="text-xl font-bold dark:text-white" style={{ fontFamily: "'Sora', sans-serif" }}>Cadastre sua loja</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Cardápio digital, pedidos, entrega e controle de estoque.
          </p>
        </div>
        
        <div className="space-y-3 relative z-10">
          <input value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} placeholder="Seu nome"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-3 text-sm dark:text-white" />
          <input value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} placeholder="Nome da sua loja"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-3 text-sm dark:text-white" />
          <select value={tipoNegocio} onChange={(e) => setTipoNegocio(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-3 text-sm text-gray-700 dark:text-gray-300">
            <option value="">Tipo de negócio</option>
            {TIPOS_NEGOCIO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-3 text-sm dark:text-white" />
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (11) 9…"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-3 text-sm dark:text-white" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional)"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-3 text-sm dark:text-white" />
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Conte um pouco do seu negócio (opcional)" rows={2}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-3 text-sm dark:text-white" />
        </div>
        
        {erro && <p className="mt-3 text-center text-sm font-medium text-red-500 relative z-10">{erro}</p>}
        
        <button onClick={enviar} disabled={enviando}
          className="mt-6 w-full rounded-xl bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria-hover)] transition-colors py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50 relative z-10">
          {enviando ? 'Enviando…' : 'Quero minha loja na MiseOn'}
        </button>
        
        <Link to="/" className="mt-4 block text-center text-xs text-gray-400 hover:text-white transition-colors relative z-10">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
