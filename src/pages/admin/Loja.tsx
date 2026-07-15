import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Store, Save, Check, Palette, Type as TypeIcon, Copy, ExternalLink, Share2, Clock, Plus, Trash2, MapPin, ArrowRight, Shield, Monitor } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PALETA_CORES, PALETA_FUNDO, FONTES, isLightColor, fonteFamilia } from '../../lib/personalizacao';
import ColorSwatchPicker from '../../components/ColorSwatchPicker';
import FontPicker from '../../components/FontPicker';
import ImageUpload from '../../components/ImageUpload';
import type { CtxLoja } from './AdminLayout';
import type { HorarioFuncionamento } from '../../types';
import { maskCPFouCNPJ, maskTelefone, validarCPFouCNPJ } from '../../lib/mascaras';

/**
 * Minha Loja — identidade white-label editável pelo lojista.
 * Preview ao vivo do cabeçalho da vitrine + paleta de cores/fontes curadas
 * (em vez de campos soltos) e upload real de imagem pro Supabase Storage.
 */
interface FormLoja {
  nome: string;
  descricao: string;
  logo_url: string;
  banner_url: string;
  cor_primaria: string;
  cor_secundaria: string;
  fonte: string;
  cor_texto: string;
  whatsapp: string;
  telefone: string;
  endereco: string;
  cnpj: string;
  razao_social: string;
  pedido_minimo: string;
  pix_chave: string;
  efi_payee_code: string;
  aceita_online: boolean;
  aceita_entrega: boolean;
}

const vazio: FormLoja = {
  nome: '', descricao: '', logo_url: '', banner_url: '',
  cor_primaria: PALETA_CORES[5], cor_secundaria: PALETA_CORES[1],
  fonte: 'Inter', cor_texto: PALETA_FUNDO[0],
  whatsapp: '', telefone: '', endereco: '', cnpj: '', razao_social: '', pedido_minimo: '0', pix_chave: '', efi_payee_code: '',
  aceita_online: true, aceita_entrega: true,
};

type Aba = 'aparencia' | 'identidade' | 'horarios' | 'pagamentos';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Loja() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [aba, setAba] = useState<Aba>('aparencia');
  const [form, setForm] = useState<FormLoja>(vazio);
  const [horarios, setHorarios] = useState<Partial<HorarioFuncionamento>[]>([]);
  const [slug, setSlug] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('lojas').select('*').eq('id', lojaId).single();
      if (data) {
        setSlug(data.slug ?? '');
        setForm({
          nome: data.nome ?? '', descricao: data.descricao ?? '',
          logo_url: data.logo_url ?? '', banner_url: data.banner_url ?? '',
          cor_primaria: data.cor_primaria ?? vazio.cor_primaria,
          cor_secundaria: data.cor_secundaria ?? vazio.cor_secundaria,
          fonte: data.fonte ?? 'Inter',
          cor_texto: data.cor_texto ?? vazio.cor_texto,
          whatsapp: data.whatsapp ?? '', telefone: data.telefone ?? '', endereco: data.endereco ?? '',
          cnpj: data.cnpj ?? '', razao_social: data.razao_social ?? '',
          pedido_minimo: String(data.pedido_minimo ?? 0), pix_chave: data.pix_chave ?? '',
          efi_payee_code: data.efi_payee_code ?? '',
          aceita_online: data.aceita_online ?? true,
          aceita_entrega: data.aceita_entrega ?? true,
        });
      }
      const { data: hor } = await supabase.from('horarios_funcionamento').select('*').eq('loja_id', lojaId).order('dia_semana').order('abre');
      if (hor) setHorarios(hor);
      setCarregando(false);
    })();
  }, [lojaId]);

  const set = (k: keyof FormLoja) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let val = e.target.value;
    if (k === 'whatsapp' || k === 'telefone') val = maskTelefone(val);
    if (k === 'cnpj') val = maskCPFouCNPJ(val);
    if (k === 'efi_payee_code') val = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    setForm((f) => ({ ...f, [k]: val }));
  };
  const setValor = (k: keyof FormLoja, valor: string) => setForm((f) => ({ ...f, [k]: valor }));

  const handleImageUpload = async (campo: 'logo_url' | 'banner_url', url: string) => {
    setValor(campo, url);
    // Auto-salva a imagem direto no banco, pois o processo de upload dá a sensação ao usuário
    // de que a foto já está salva, e ele frequentemente esquece de clicar em "Salvar Alterações".
    await supabase.from('lojas').update({ [campo]: url || null }).eq('id', lojaId);
  };

  const salvar = async () => {
    setErro(''); setOk(false); setSalvando(true);

    if (form.cnpj) {
      if (!validarCPFouCNPJ(form.cnpj)) {
        setErro('Documento inválido. Digite um CPF ou CNPJ real e ativo.');
        setSalvando(false);
        setAba('identidade');
        return;
      }
    }

    if (form.efi_payee_code) {
      const code = form.efi_payee_code.trim();
      const isHex = /^[0-9a-fA-F]{32}$/.test(code);
      if (!isHex) {
        setErro('Identificador Efí inválido. Ele deve ter exatamente 32 caracteres (letras e números), sem espaços. Verifique no painel do Efí Bank.');
        setSalvando(false);
        setAba('pagamentos'); // Força a aba de pagamentos para o lojista ver o erro
        return;
      }
    }

    const { error } = await supabase.from('lojas').update({
      nome: form.nome,
      descricao: form.descricao || null,
      logo_url: form.logo_url || null,
      banner_url: form.banner_url || null,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      fonte: form.fonte,
      cor_texto: form.cor_texto,
      whatsapp: form.whatsapp,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      cnpj: form.cnpj || null,
      razao_social: form.razao_social || null,
      pedido_minimo: Number(form.pedido_minimo || 0),
      pix_chave: form.pix_chave || null,
      efi_payee_code: form.efi_payee_code || null,
      aceita_online: form.aceita_online,
      aceita_entrega: form.aceita_entrega,
    }).eq('id', lojaId);

    // Salvar horários
    await supabase.from('horarios_funcionamento').delete().eq('loja_id', lojaId);
    if (horarios.length > 0) {
      const novos = horarios.map(h => ({
        loja_id: lojaId,
        dia_semana: h.dia_semana,
        abre: h.abre?.substring(0, 5) + ':00', // forçar formato HH:MM:00 pro Postgres
        fecha: h.fecha?.substring(0, 5) + ':00'
      }));
      await supabase.from('horarios_funcionamento').insert(novos);
    }

    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    document.documentElement.style.setProperty('--cor-primaria', form.cor_primaria);
    document.documentElement.style.setProperty('--cor-secundaria', form.cor_secundaria);
    setOk(true); setTimeout(() => setOk(false), 2500);
  };

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  const linkPublico = `${window.location.origin}/${slug}`;
  const copiarLink = () => {
    navigator.clipboard.writeText(linkPublico);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  const compartilharWhatsapp = () => {
    const msg = `Peça pelo nosso cardápio online: ${linkPublico}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  type CampoTexto = { [K in keyof FormLoja]: FormLoja[K] extends string ? K : never }[keyof FormLoja];
  const renderCampo = (label: string, k: CampoTexto, placeholder?: string, textarea?: boolean) => (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      {textarea ? (
        <textarea value={form[k]} onChange={set(k)} placeholder={placeholder} rows={2}
          className="mt-1 w-full rounded-xl border p-2.5 text-sm" />
      ) : (
        <input value={form[k]} onChange={set(k)} placeholder={placeholder}
          className="mt-1 w-full rounded-xl border p-2.5 text-sm" />
      )}
    </label>
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Store size={20} className="text-[var(--cor-primaria)]" />
        <h2 className="text-lg font-bold">Configurar Loja</h2>
      </div>

      {/* Link público — o cliente acessa por aqui, sem login */}
      <div className="mb-5 rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
        <p className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Link público da sua loja</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-gray-700">{linkPublico}</code>
          <button onClick={copiarLink} title="Copiar link" className="shrink-0 rounded-lg border p-2 text-gray-500 dark:text-gray-400">
            {copiado ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          </button>
          <a href={linkPublico} target="_blank" rel="noreferrer" title="Abrir" className="shrink-0 rounded-lg border p-2 text-gray-500 dark:text-gray-400">
            <ExternalLink size={15} />
          </a>
          <button onClick={compartilharWhatsapp} title="Compartilhar no WhatsApp" className="shrink-0 rounded-lg border p-2 text-green-600">
            <Share2 size={15} />
          </button>
        </div>
        {copiado && <p className="mt-1 text-[11px] font-medium text-green-600">Link copiado!</p>}
      </div>

      {/* Preview ao vivo da identidade — reflete cada escolha na hora */}
      <div className="mb-5 overflow-hidden rounded-2xl border shadow-sm" style={{ fontFamily: fonteFamilia(form.fonte) }}>
        <div className="w-full aspect-[21/9] bg-gray-100" style={{
          backgroundImage: form.banner_url ? `url(${form.banner_url})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div className="flex items-center gap-3 p-3" style={{ background: form.cor_texto || '#ffffff' }}>
          {form.logo_url
            ? <img src={form.logo_url} alt="" className="h-14 w-14 rounded-full border object-cover" />
            : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: form.cor_primaria }}>
                {form.nome.trim() ? form.nome.trim()[0].toUpperCase() : '?'}
              </div>
            )}
          <div className="min-w-0">
            <p className="truncate font-bold" style={{ color: isLightColor(form.cor_texto) ? '#111827' : '#ffffff' }}>{form.nome || 'Nome da loja'}</p>
            <p className="truncate text-xs" style={{ color: isLightColor(form.cor_texto) ? '#111827' : '#ffffff', opacity: 0.65 }}>{form.descricao || 'Descrição da loja'}</p>
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: form.cor_primaria, color: isLightColor(form.cor_primaria) ? '#000000' : '#ffffff' }}>
              Aberto agora
            </span>
          </div>
        </div>
        <div className="flex gap-2 px-3 pb-3" style={{ background: form.cor_texto || '#ffffff' }}>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: form.cor_primaria, color: isLightColor(form.cor_primaria) ? '#000000' : '#ffffff' }}>Categoria</span>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: form.cor_secundaria, color: isLightColor(form.cor_secundaria) ? '#000000' : '#ffffff' }}>Destaque</span>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(['aparencia', 'identidade', 'horarios', 'pagamentos'] as Aba[]).map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${aba === a ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm'}`}>
            {a === 'aparencia' ? 'Aparência' : a === 'identidade' ? 'Identidade' : a === 'horarios' ? 'Horários' : 'Pagamentos e Integrações'}
          </button>
        ))}
      </div>

      {aba === 'aparencia' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <ImageUpload lojaId={lojaId} pasta="logos" aspecto="aspect-square" label="Logo" value={form.logo_url} onChange={(url) => handleImageUpload('logo_url', url)} />
            <ImageUpload lojaId={lojaId} pasta="banners" aspecto="aspect-[21/9]" label="Banner" value={form.banner_url} onChange={(url) => handleImageUpload('banner_url', url)} />
          </div>

          <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
            <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold"><Palette size={15} /> Identidade Visual</p>
            
            <div className="mb-4">
              <ColorSwatchPicker label="Cor Primária" value={form.cor_primaria} onChange={(c) => setValor('cor_primaria', c)} />
              <p className="mt-1 text-[11px] text-gray-500">Principal cor de ação. Usada nos botões grandes (ex: Finalizar Pedido) e menus principais.</p>
            </div>
            
            <div className="mb-4">
              <ColorSwatchPicker label="Cor Secundária" value={form.cor_secundaria} onChange={(c) => setValor('cor_secundaria', c)} />
              <p className="mt-1 text-[11px] text-gray-500">Cor de apoio. Usada apenas em selos menores (ex: "Promoção", "Destaque") para não conflitar com os botões.</p>
            </div>
            
            <div className="mb-1">
              <ColorSwatchPicker label="Cor de Fundo (Tema)" value={form.cor_texto} onChange={(c) => setValor('cor_texto', c)} paleta={PALETA_FUNDO} />
              <p className="mt-1 text-[11px] text-gray-500">Define o fundo da sua loja. O texto se ajusta automaticamente para nunca ficar invisível.</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><TypeIcon size={15} /> Fonte</p>
            <FontPicker value={form.fonte} onChange={(f) => setValor('fonte', f)} />
          </div>
        </div>
      )}

      {aba === 'identidade' && (
        <div className="space-y-3">
          {renderCampo('Nome da loja', 'nome', '"N" de Natureba')}
          {renderCampo('Descrição', 'descricao', 'Baguetes artesanais, saladas e doces.', true)}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
             <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><MapPin size={15} /> Localização</p>
             {renderCampo('Endereço completo', 'endereco', 'Rua das Flores, 123 - Centro, São Paulo - SP', true)}
          </div>
          {renderCampo('Celular 1 / WhatsApp Principal', 'whatsapp', '(11) 99999-9999')}
          {renderCampo('Celular 2 / WhatsApp Secundário (Opcional)', 'telefone', '(11) 99999-9999')}
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Dados no cupom do cliente (opcional)</p>
            <div className="space-y-3">
              {renderCampo('Razão social / Nome', 'razao_social', 'Lanche do Paulista Ltda')}
              {renderCampo('CPF / CNPJ', 'cnpj', '000.000.000-00 ou 00.000.000/0001-00')}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">Aparecem no cabeçalho da Nota do Cliente. Deixe em branco se não quiser exibir.</p>
          </div>
          {renderCampo('Pedido mínimo (R$)', 'pedido_minimo', '15')}
        </div>
      )}

      {aba === 'horarios' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Clock size={15} /> Grade de Horários</h3>
              <button onClick={() => setHorarios([...horarios, { dia_semana: 1, abre: '18:00', fecha: '23:00' }])}
                className="flex items-center gap-1 rounded-lg bg-[var(--cor-primaria)]/10 px-3 py-1.5 text-xs font-bold text-[var(--cor-primaria)] transition hover:bg-[var(--cor-primaria)]/20">
                <Plus size={14} /> Novo Turno
              </button>
            </div>
            
            {horarios.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Nenhum horário cadastrado. A loja aparecerá como fechada.</p>
            ) : (
              <div className="space-y-2">
                {horarios.map((h, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <select 
                      value={h.dia_semana} 
                      onChange={(e) => { const n = [...horarios]; n[i].dia_semana = Number(e.target.value); setHorarios(n); }}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm font-semibold flex-1"
                    >
                      {DIAS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                    </select>
                    
                    <div className="flex items-center gap-2">
                      <input type="time" value={h.abre?.substring(0, 5) || ''} onChange={(e) => { const n = [...horarios]; n[i].abre = e.target.value; setHorarios(n); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm" />
                      <span className="text-gray-400 font-medium text-xs">até</span>
                      <input type="time" value={h.fecha?.substring(0, 5) || ''} onChange={(e) => { const n = [...horarios]; n[i].fecha = e.target.value; setHorarios(n); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm" />
                    </div>
                    
                    <button onClick={() => setHorarios(horarios.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-gray-500 leading-relaxed">
              Dica: Você pode adicionar múltiplos turnos no mesmo dia (Ex: Sexta 11:00 às 14:00 e Sexta 18:00 às 23:59). <br/>
              <b>Se passar da meia noite</b>, cadastre o dia atual até 23:59 e o dia seguinte de 00:00 até o horário final.
            </p>
          </div>
        </div>
      )}

      {aba === 'pagamentos' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h3 className="text-sm font-bold dark:text-gray-100">Formas de pagamento aceitas</h3>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold dark:text-gray-200">Pagamento antecipado (online)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pix e crédito via Efí — o cliente paga na hora do pedido.</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, aceita_online: !f.aceita_online }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.aceita_online ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.aceita_online ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
              <div>
                <p className="text-sm font-semibold dark:text-gray-200">Pagamento na entrega</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Dinheiro e maquininha (débito) — o cliente paga ao receber.</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, aceita_entrega: !f.aceita_entrega }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.aceita_entrega ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.aceita_entrega ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 p-4">
            <h3 className="mb-1 text-sm font-bold text-[var(--cor-primaria)]">Recebimentos Automáticos (Efí Payee Code)</h3>
            <p className="mb-4 text-xs text-gray-600 dark:text-gray-300">
              O Payee Code <b>NÃO é o número da sua conta corrente nem agência</b>. Ele é um "Token de Segurança" que permite que o MiseOn envie o dinheiro dos pedidos diretamente para sua conta sem intermediários.
            </p>
            {renderCampo('Código Payee Code (32 caracteres)', 'efi_payee_code', 'Ex: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d')}
            
            <div className="mt-6 rounded-xl bg-gray-900 p-5 shadow-sm border border-gray-800 text-white">
              <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Monitor size={16} className="text-[var(--cor-primaria)]" /> 
                Onde encontro isso na Efí Bank? (Pelo Computador)
              </h4>
              
              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                {/* Passo 1 */}
                <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 p-4 relative">
                  <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-[var(--cor-primaria)] text-white flex items-center justify-center font-bold text-xs">1</div>
                  <p className="text-xs text-gray-300 mb-3">No menu lateral esquerdo, desça e clique em <b className="text-white">API</b>.</p>
                  <div className="rounded border border-gray-700 bg-[#1e1e1e] p-2 flex flex-col gap-2 opacity-80">
                    <div className="h-2 w-12 bg-gray-600 rounded"></div>
                    <div className="h-2 w-16 bg-gray-600 rounded"></div>
                    <div className="flex items-center gap-2 bg-gray-700/50 p-1.5 rounded">
                      <div className="h-3 w-3 rounded-sm border border-gray-500"></div>
                      <span className="text-[10px] font-mono text-gray-200">API</span>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex items-center justify-center text-gray-600"><ArrowRight size={20} /></div>

                {/* Passo 2 */}
                <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 p-4 relative">
                  <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-[var(--cor-primaria)] text-white flex items-center justify-center font-bold text-xs">2</div>
                  <p className="text-xs text-gray-300 mb-3">Lá em cima, no canto superior direito, clique em <b className="text-white">Identificador de conta</b>.</p>
                  <div className="rounded border border-gray-700 bg-[#1e1e1e] p-2 flex justify-end opacity-80">
                    <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                      <Shield size={12} /> Identificador de conta
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex items-center justify-center text-gray-600"><ArrowRight size={20} /></div>

                {/* Passo 3 */}
                <div className="flex-1 rounded-lg border border-gray-700 bg-gray-800/50 p-4 relative">
                  <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-[var(--cor-primaria)] text-white flex items-center justify-center font-bold text-xs">3</div>
                  <p className="text-xs text-gray-300 mb-3">Copie o código <b className="text-white">payee_code</b> e cole aqui em cima!</p>
                  <div className="rounded border border-gray-600 bg-[#252525] p-3 shadow-lg">
                    <p className="text-[10px] font-bold text-white mb-2">Identificador de conta</p>
                    <div className="flex items-center justify-between border-b border-gray-600 pb-1">
                      <span className="text-[9px] text-gray-400">payee_code</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-white">f03566adf9b0...</span>
                        <Copy size={10} className="text-cyan-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {erro && <p className="mt-3 text-sm font-medium text-red-500">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 font-semibold text-white disabled:opacity-40">
        {ok ? <><Check size={18} /> Salvo!</> : <><Save size={18} /> {salvando ? 'Salvando…' : 'Salvar alterações'}</>}
      </button>
    </div>
  );
}
