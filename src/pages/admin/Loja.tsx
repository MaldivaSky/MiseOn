import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Store, Save, Check, Palette, Type as TypeIcon, Copy, ExternalLink, Share2, Clock, Plus, Trash2, MapPin, ArrowRight, Shield, Monitor, Sun, Moon, Bike, LocateFixed } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PALETA_CORES, PALETA_FUNDO_POR_TEMA, FONTES, isLightColor, fonteFamilia, obterFundoLojaPorTema, obterTokensLoja, resolverTemaLoja, type TemaLoja } from '../../lib/personalizacao';
import ColorSwatchPicker from '../../components/ColorSwatchPicker';
import FontPicker from '../../components/FontPicker';
import ImageUpload from '../../components/ImageUpload';
import type { CtxLoja } from './AdminLayout';
import type { EntregaModo, FaixaEntrega, HorarioFuncionamento } from '../../types';
import { maskCPFouCNPJ, maskTelefone, validarCPFouCNPJ } from '../../lib/mascaras';
import { geocode } from '../../lib/geo';

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
  cor_fundo_claro: string;
  cor_fundo_escuro: string;
  tema_cardapio: TemaLoja;
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
  lat: string;
  lng: string;
  entrega_modo: EntregaModo;
  entrega_raio_km: string;
  entrega_taxa_base: string;
  entrega_taxa_km: string;
  entrega_taxa_padrao: string;
}

interface FaixaEntregaForm {
  id?: string;
  nome: string;
  km_ate: string;
  taxa_fixa: string;
  taxa_por_km: string;
  pedido_minimo: string;
  ordem: number;
  ativo: boolean;
}

const vazio: FormLoja = {
  nome: '', descricao: '', logo_url: '', banner_url: '',
  cor_primaria: PALETA_CORES[5], cor_secundaria: PALETA_CORES[1],
  fonte: 'Inter', cor_texto: PALETA_CORES[13], cor_fundo_claro: PALETA_FUNDO_POR_TEMA.claro[0], cor_fundo_escuro: PALETA_FUNDO_POR_TEMA.escuro[0], tema_cardapio: 'claro',
  whatsapp: '', telefone: '', endereco: '', cnpj: '', razao_social: '', pedido_minimo: '0', pix_chave: '', efi_payee_code: '',
  aceita_online: true, aceita_entrega: true,
  lat: '', lng: '', entrega_modo: 'HIBRIDO', entrega_raio_km: '8', entrega_taxa_base: '0', entrega_taxa_km: '1.5', entrega_taxa_padrao: '0',
};

type Aba = 'aparencia' | 'identidade' | 'logistica' | 'horarios' | 'pagamentos';

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
  const [temaPreview, setTemaPreview] = useState<TemaLoja>('claro');
  const [faixasEntrega, setFaixasEntrega] = useState<FaixaEntregaForm[]>([]);

  // Credenciais Efí da própria loja (tabela separada e protegida por RLS — NÃO fica em `lojas`,
  // que é pública). client_id/pix_key são carregados; secret/cert ficam em branco por segurança
  // (só sobrescrevem se o lojista digitar algo novo).
  const [efiCred, setEfiCred] = useState({ clientId: '', pixKey: '', clientSecret: '', certBase64: '' });
  const [efiTemSecret, setEfiTemSecret] = useState(false);
  const [efiTemCert, setEfiTemCert] = useState(false);

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
          cor_fundo_claro: data.cor_fundo_claro ?? (isLightColor(data.cor_texto) ? data.cor_texto : vazio.cor_fundo_claro),
          cor_fundo_escuro: data.cor_fundo_escuro ?? (!isLightColor(data.cor_texto) ? data.cor_texto : vazio.cor_fundo_escuro),
          tema_cardapio: resolverTemaLoja(data.tema_cardapio, data.cor_fundo_claro ?? data.cor_texto ?? vazio.cor_fundo_claro),
          whatsapp: data.whatsapp ?? '', telefone: data.telefone ?? '', endereco: data.endereco ?? '',
          cnpj: data.cnpj ?? '', razao_social: data.razao_social ?? '',
          pedido_minimo: String(data.pedido_minimo ?? 0), pix_chave: data.pix_chave ?? '',
          efi_payee_code: data.efi_payee_code ?? '',
          aceita_online: data.aceita_online ?? true,
          aceita_entrega: data.aceita_entrega ?? true,
          lat: data.lat != null ? String(data.lat) : '',
          lng: data.lng != null ? String(data.lng) : '',
          entrega_modo: (data.entrega_modo ?? 'HIBRIDO') as EntregaModo,
          entrega_raio_km: data.entrega_raio_km != null ? String(data.entrega_raio_km) : '8',
          entrega_taxa_base: data.entrega_taxa_base != null ? String(data.entrega_taxa_base) : '0',
          entrega_taxa_km: data.entrega_taxa_km != null ? String(data.entrega_taxa_km) : '1.5',
          entrega_taxa_padrao: data.entrega_taxa_padrao != null ? String(data.entrega_taxa_padrao) : '0',
        });
        setTemaPreview(resolverTemaLoja(data.tema_cardapio, data.cor_texto ?? vazio.cor_fundo_claro));
      }
      const { data: hor } = await supabase.from('horarios_funcionamento').select('*').eq('loja_id', lojaId).order('dia_semana').order('abre');
      if (hor) setHorarios(hor);
      const { data: faixas } = await supabase.from('faixas_entrega').select('*').eq('loja_id', lojaId).order('ordem').order('km_ate');
      if (faixas) {
        setFaixasEntrega((faixas as FaixaEntrega[]).map((faixa, index) => ({
          id: faixa.id,
          nome: faixa.nome ?? '',
          km_ate: String(faixa.km_ate ?? ''),
          taxa_fixa: faixa.taxa_fixa != null ? String(faixa.taxa_fixa) : '',
          taxa_por_km: faixa.taxa_por_km != null ? String(faixa.taxa_por_km) : '',
          pedido_minimo: faixa.pedido_minimo != null ? String(faixa.pedido_minimo) : '0',
          ordem: Number(faixa.ordem ?? index + 1),
          ativo: faixa.ativo !== false,
        })));
      }

      // Credenciais Efí (tabela protegida). Só o client_id e a chave Pix são exibidos;
      // secret/cert nunca voltam pro navegador — mostramos só se já estão configurados.
      const { data: cred } = await supabase.from('loja_efi_credenciais')
        .select('efi_client_id, efi_pix_key, efi_client_secret, efi_cert_base64').eq('loja_id', lojaId).maybeSingle();
      if (cred) {
        setEfiCred((c) => ({ ...c, clientId: cred.efi_client_id ?? '', pixKey: cred.efi_pix_key ?? '' }));
        setEfiTemSecret(!!cred.efi_client_secret);
        setEfiTemCert(!!cred.efi_cert_base64);
      }
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
    const { error } = await supabase.from('lojas').update({ [campo]: url || null }).eq('id', lojaId);
    if (error) setErro(`Erro ao salvar imagem da loja. ${error.message}`);
  };

  const salvar = async () => {
    setErro(''); setOk(false); setSalvando(true);
    const fundoClaroGerado = obterFundoLojaPorTema('claro', form);
    const fundoEscuroGerado = obterFundoLojaPorTema('escuro', form);
    const usaEntregaPorDistancia = form.aceita_entrega && (form.entrega_modo === 'DISTANCIA' || form.entrega_modo === 'HIBRIDO');

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

    // Credenciais Efí da loja (conta própria): client_id + chave Pix são obrigatórios juntos
    // para ativar os recebimentos na conta do próprio lojista.
    if ((efiCred.clientId.trim() && !efiCred.pixKey.trim()) || (efiCred.pixKey.trim() && !efiCred.clientId.trim())) {
      setErro('Para receber na sua conta Efí, preencha pelo menos o Client ID e a Chave Pix.');
      setSalvando(false);
      setAba('pagamentos');
      return;
    }

    const geoLoja = form.endereco.trim() ? await geocode(form.endereco.trim()) : null;
    const latFinal = geoLoja?.lat ?? (form.lat ? Number(form.lat) : null);
    const lngFinal = geoLoja?.lng ?? (form.lng ? Number(form.lng) : null);

    if (usaEntregaPorDistancia && (latFinal == null || lngFinal == null)) {
      setErro('Não consegui localizar o endereço da loja para calcular entrega por raio. Revise o endereço completo ou informe coordenadas válidas.');
      setSalvando(false);
      setAba('logistica');
      return;
    }

    if (usaEntregaPorDistancia && !form.entrega_raio_km) {
      setErro('Defina o raio máximo de atendimento para a entrega.');
      setSalvando(false);
      setAba('logistica');
      return;
    }

    const faixasNormalizadas = faixasEntrega
      .filter((faixa) => faixa.ativo && faixa.km_ate)
      .map((faixa, index) => ({
        id: faixa.id,
        loja_id: lojaId,
        nome: faixa.nome.trim() || null,
        km_ate: Number(faixa.km_ate),
        taxa_fixa: faixa.taxa_fixa ? Number(faixa.taxa_fixa) : null,
        taxa_por_km: faixa.taxa_por_km ? Number(faixa.taxa_por_km) : null,
        pedido_minimo: Number(faixa.pedido_minimo || 0),
        ordem: index + 1,
        ativo: faixa.ativo,
      }));

    if (form.entrega_modo === 'HIBRIDO' && usaEntregaPorDistancia && faixasNormalizadas.length === 0) {
      setErro('No modo híbrido, cadastre pelo menos uma faixa de entrega por distância.');
      setSalvando(false);
      setAba('logistica');
      return;
    }

    const { error: erroLoja } = await supabase.from('lojas').update({
      nome: form.nome,
      descricao: form.descricao || null,
      logo_url: form.logo_url || null,
      banner_url: form.banner_url || null,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      fonte: form.fonte,
      cor_texto: form.cor_texto,
      cor_fundo_claro: fundoClaroGerado,
      cor_fundo_escuro: fundoEscuroGerado,
      tema_cardapio: form.tema_cardapio,
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
      lat: latFinal,
      lng: lngFinal,
      entrega_modo: form.entrega_modo,
      entrega_raio_km: Number(form.entrega_raio_km || 0),
      entrega_taxa_base: Number(form.entrega_taxa_base || 0),
      entrega_taxa_km: Number(form.entrega_taxa_km || 0),
      entrega_taxa_padrao: Number(form.entrega_taxa_padrao || 0),
    }).eq('id', lojaId);

    if (erroLoja) {
      setSalvando(false);
      setErro('Erro ao salvar: ' + erroLoja.message);
      return;
    }

    // Salvar horários
    const { error: erroLimparHorarios } = await supabase.from('horarios_funcionamento').delete().eq('loja_id', lojaId);
    if (erroLimparHorarios) {
      setSalvando(false);
      setErro('Erro ao atualizar horários da loja: ' + erroLimparHorarios.message);
      return;
    }
    if (horarios.length > 0) {
      const novos = horarios.map(h => ({
        loja_id: lojaId,
        dia_semana: h.dia_semana,
        abre: h.abre?.substring(0, 5) + ':00', // forçar formato HH:MM:00 pro Postgres
        fecha: h.fecha?.substring(0, 5) + ':00'
      }));
      const { error: erroInserirHorarios } = await supabase.from('horarios_funcionamento').insert(novos);
      if (erroInserirHorarios) {
        setSalvando(false);
        setErro('Erro ao salvar horários da loja: ' + erroInserirHorarios.message);
        return;
      }
    }

    const { error: erroLimparFaixas } = await supabase.from('faixas_entrega').delete().eq('loja_id', lojaId);
    if (erroLimparFaixas) {
      setSalvando(false);
      setErro('Erro ao atualizar faixas de entrega: ' + erroLimparFaixas.message);
      return;
    }
    if (faixasNormalizadas.length > 0) {
      const { error: erroInserirFaixas } = await supabase.from('faixas_entrega').insert(faixasNormalizadas.map(({ id, ...faixa }) => faixa));
      if (erroInserirFaixas) {
        setSalvando(false);
        setErro('Erro ao salvar faixas de entrega: ' + erroInserirFaixas.message);
        return;
      }
    }

    // Credenciais Efí (tabela protegida por RLS). secret/cert só sobrescrevem se digitados.
    let erroCred: string | null = null;
    if (efiCred.clientId.trim() || efiCred.pixKey.trim() || efiCred.clientSecret.trim() || efiCred.certBase64.trim()) {
      const payload: Record<string, string | null> = {
        loja_id: lojaId,
        efi_client_id: efiCred.clientId.trim() || null,
        efi_pix_key: efiCred.pixKey.trim() || null,
        atualizado_em: new Date().toISOString(),
      };
      if (efiCred.clientSecret.trim()) payload.efi_client_secret = efiCred.clientSecret.trim();
      if (efiCred.certBase64.trim()) payload.efi_cert_base64 = efiCred.certBase64.replace(/\s/g, '');
      const { error: ec } = await supabase.from('loja_efi_credenciais').upsert(payload, { onConflict: 'loja_id' });
      if (ec) erroCred = ec.message;
      else {
        if (efiCred.clientSecret.trim()) setEfiTemSecret(true);
        if (efiCred.certBase64.trim()) setEfiTemCert(true);
        setEfiCred((c) => ({ ...c, clientSecret: '', certBase64: '' })); // não mantém segredo em memória
      }
    }

    setSalvando(false);
    if (erroCred) { setErro('Erro ao salvar: ' + erroCred); return; }
    document.documentElement.style.setProperty('--cor-primaria', form.cor_primaria);
    document.documentElement.style.setProperty('--cor-secundaria', form.cor_secundaria);
    setOk(true); setTimeout(() => setOk(false), 2500);
  };

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  const linkPublico = `${window.location.origin}/${slug}`;
  const fundoPreview = obterFundoLojaPorTema(temaPreview, form);
  const tokensPreview = obterTokensLoja(fundoPreview, temaPreview, form.cor_texto || form.cor_primaria || '#FC5B24');
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
      <div
        className="mb-5 overflow-hidden rounded-2xl border shadow-sm"
        style={{
          fontFamily: fonteFamilia(form.fonte),
          background: tokensPreview.fundo,
          borderColor: tokensPreview.border,
        }}
      >
        <div className="w-full aspect-[21/9] bg-gray-100" style={{
          backgroundImage: form.banner_url ? `url(${form.banner_url})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div className="flex items-center gap-3 p-3" style={{ background: tokensPreview.surface }}>
          {form.logo_url
            ? <img src={form.logo_url} alt="" className="h-14 w-14 rounded-full border object-cover" />
            : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: form.cor_primaria }}>
                {form.nome.trim() ? form.nome.trim()[0].toUpperCase() : '?'}
              </div>
            )}
          <div className="min-w-0">
            <p className="truncate font-bold" style={{ color: tokensPreview.texto }}>{form.nome || 'Nome da loja'}</p>
            <p className="truncate text-xs" style={{ color: tokensPreview.textoSuave }}>{form.descricao || 'Descrição da loja'}</p>
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: form.cor_primaria, color: isLightColor(form.cor_primaria) ? '#000000' : '#ffffff' }}>
              Aberto agora
            </span>
          </div>
        </div>
        <div className="flex gap-2 px-3 pb-3" style={{ background: tokensPreview.surface }}>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: form.cor_primaria, color: isLightColor(form.cor_primaria) ? '#000000' : '#ffffff' }}>Categoria</span>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: form.cor_secundaria, color: isLightColor(form.cor_secundaria) ? '#000000' : '#ffffff' }}>Destaque</span>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(['aparencia', 'identidade', 'logistica', 'horarios', 'pagamentos'] as Aba[]).map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${aba === a ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm'}`}>
            {a === 'aparencia' ? 'Aparência' : a === 'identidade' ? 'Identidade' : a === 'logistica' ? 'Entrega e Cobertura' : a === 'horarios' ? 'Horários' : 'Pagamentos e Integrações'}
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

            <div className="mb-4 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tema padrão da vitrine</p>
                  <p className="mt-1 text-sm font-semibold dark:text-gray-100">
                    {form.tema_cardapio === 'escuro' ? 'Escuro' : 'Claro'}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Define o tema inicial para quem entrar pela primeira vez. Depois disso, o cliente final pode alternar o tema na vitrine pública.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Sun size={16} className={form.tema_cardapio === 'claro' ? 'text-amber-500' : 'text-gray-400'} />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.tema_cardapio === 'escuro'}
                    aria-label="Alternar tema padrão claro ou escuro da vitrine"
                    onClick={() => setForm((f) => {
                      const proximoTema: TemaLoja = f.tema_cardapio === 'escuro' ? 'claro' : 'escuro';
                      return {
                        ...f,
                        tema_cardapio: proximoTema,
                      };
                    })}
                    className={`relative h-7 w-14 rounded-full transition-colors ${form.tema_cardapio === 'escuro' ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span
                      className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-all ${form.tema_cardapio === 'escuro' ? 'left-[30px]' : 'left-0.5'}`}
                    >
                      {form.tema_cardapio === 'escuro' ? <Moon size={13} className="text-gray-700" /> : <Sun size={13} className="text-amber-500" />}
                    </span>
                  </button>
                  <Moon size={16} className={form.tema_cardapio === 'escuro' ? 'text-[var(--cor-primaria)]' : 'text-gray-400'} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                <div className={`rounded-xl border p-3 ${form.tema_cardapio === 'claro' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <p className="mb-1 flex items-center gap-1 font-semibold dark:text-gray-100"><Sun size={13} /> Claro</p>
                  <p className="text-gray-500 dark:text-gray-400">Visual leve, limpo e luminoso.</p>
                </div>
                <div className={`rounded-xl border p-3 ${form.tema_cardapio === 'escuro' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <p className="mb-1 flex items-center gap-1 font-semibold dark:text-gray-100"><Moon size={13} /> Escuro</p>
                  <p className="text-gray-500 dark:text-gray-400">Visual premium, noturno e contrastado.</p>
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Pré-visualização</p>
                  <p className="mt-1 text-sm font-semibold dark:text-gray-100">
                    Veja como a identidade reage em cada tema
                  </p>
                </div>
                <div className="inline-flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setTemaPreview('claro')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${temaPreview === 'claro' ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Claro
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemaPreview('escuro')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${temaPreview === 'escuro' ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Escuro
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                O cliente final pode escolher entre claro e escuro na vitrine pública. Aqui você garante que os dois modos fiquem bonitos e legíveis.
              </p>
            </div>
            
            <div className="mb-4">
              <ColorSwatchPicker label="Cor Primária" value={form.cor_primaria} onChange={(c) => setValor('cor_primaria', c)} />
              <p className="mt-1 text-[11px] text-gray-500">Principal cor de ação. Usada nos botões grandes (ex: Finalizar Pedido) e menus principais.</p>
            </div>

            <div className="mb-4">
              <ColorSwatchPicker label="Cor base da identidade" value={form.cor_texto} onChange={(c) => setValor('cor_texto', c)} />
              <p className="mt-1 text-[11px] text-gray-500">Essa cor é a origem dos dois temas. O claro vira uma leitura suave dessa cor e o escuro vira uma leitura profunda da mesma família cromática.</p>
            </div>
            
            <div className="mb-4">
              <ColorSwatchPicker label="Cor Secundária" value={form.cor_secundaria} onChange={(c) => setValor('cor_secundaria', c)} />
              <p className="mt-1 text-[11px] text-gray-500">Cor de apoio. Usada apenas em selos menores (ex: "Promoção", "Destaque") para não conflitar com os botões.</p>
            </div>
            
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Leitura cromática automática</p>
              <p className="mt-1 text-sm font-semibold dark:text-gray-100">
                A cor primária da loja gera os dois temas com a mesma identidade visual
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Exemplo: azul vira azul claro no tema claro e azul profundo no tema escuro. Vermelho vira vermelho claro e vermelho profundo. O sistema recalcula contraste, superfícies e bordas sem deixar texto sumir.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(['claro', 'escuro'] as TemaLoja[]).map((tema) => {
                  const fundoTema = obterFundoLojaPorTema(tema, form);
                  const tokensTema = obterTokensLoja(fundoTema, tema, form.cor_texto || form.cor_primaria || '#FC5B24');
                  return (
                    <div
                      key={tema}
                      className="rounded-2xl border p-4"
                      style={{ background: tokensTema.fundo, borderColor: tokensTema.border }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: tokensTema.textoFraco }}>
                            Tema {tema}
                          </p>
                          <p className="text-sm font-bold" style={{ color: tokensTema.texto }}>
                            {tema === 'claro' ? 'Variação clara da marca' : 'Variação escura da marca'}
                          </p>
                        </div>
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: tokensTema.destaque, color: tokensTema.texto }}>
                          {tema === 'claro' ? 'Claro' : 'Escuro'}
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl border p-3" style={{ background: tokensTema.surface, borderColor: tokensTema.border }}>
                        <p className="text-sm font-semibold" style={{ color: tokensTema.texto }}>Lanche do Paulista</p>
                        <p className="mt-1 text-xs" style={{ color: tokensTema.textoSuave }}>
                          A paleta se adapta automaticamente a partir da cor primária.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: form.cor_primaria, color: isLightColor(form.cor_primaria) ? '#111827' : '#FFFFFF' }}>
                            Primária
                          </span>
                          <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: form.cor_secundaria, color: isLightColor(form.cor_secundaria) ? '#111827' : '#FFFFFF' }}>
                            Secundária
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {aba === 'logistica' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Bike size={15} /> Motor de entrega</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Configure a cobertura do tenant como operação real: raio máximo, cálculo por km e faixas comerciais por distância.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, aceita_entrega: !f.aceita_entrega }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.aceita_entrega ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.aceita_entrega ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Modo de cobrança da entrega</span>
                <select value={form.entrega_modo} onChange={(e) => setValor('entrega_modo', e.target.value as EntregaModo)}
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  <option value="HIBRIDO">Híbrido inteligente</option>
                  <option value="DISTANCIA">Base + valor por km</option>
                  <option value="BAIRRO">Somente por bairros</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Raio máximo de atendimento (km)</span>
                <input value={form.entrega_raio_km} onChange={set('entrega_raio_km')} type="number" step="0.1"
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Taxa base</span>
                <input value={form.entrega_taxa_base} onChange={set('entrega_taxa_base')} type="number" step="0.01"
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Valor por km (fallback)</span>
                <input value={form.entrega_taxa_km} onChange={set('entrega_taxa_km')} type="number" step="0.01"
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Taxa padrão de contingência</span>
                <input value={form.entrega_taxa_padrao} onChange={set('entrega_taxa_padrao')} type="number" step="0.01"
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold dark:text-gray-100">Georreferência da loja</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Usamos o endereço da loja para localizar automaticamente a origem das entregas ao salvar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const geo = form.endereco.trim() ? await geocode(form.endereco.trim()) : null;
                    if (!geo) return setErro('Não consegui localizar esse endereço da loja. Revise a rua, número, cidade e UF.');
                    setForm((f) => ({ ...f, lat: String(geo.lat), lng: String(geo.lng) }));
                    setOk(true);
                    setTimeout(() => setOk(false), 1800);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-[var(--cor-primaria)]"
                >
                  <LocateFixed size={14} /> Localizar loja
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Latitude</span>
                  <input value={form.lat} onChange={set('lat')} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Longitude</span>
                  <input value={form.lng} onChange={set('lng')} className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold dark:text-gray-100">Faixas de entrega por distância</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Exemplo profissional: até 3 km cobra fixo; até 5 km cobra outra faixa; acima disso aplica valor por km.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFaixasEntrega((atual) => [...atual, { nome: '', km_ate: '', taxa_fixa: '', taxa_por_km: '', pedido_minimo: '0', ordem: atual.length + 1, ativo: true }])}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--cor-primaria)]/10 px-3 py-2 text-xs font-bold text-[var(--cor-primaria)]"
              >
                <Plus size={14} /> Nova faixa
              </button>
            </div>

            <div className="space-y-3">
              {faixasEntrega.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Nenhuma faixa cadastrada ainda. No modo híbrido, cadastre pelo menos uma faixa ativa.
                </div>
              )}

              {faixasEntrega.map((faixa, index) => (
                <div key={faixa.id ?? index} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                  <div className="grid gap-3 md:grid-cols-6">
                    <label className="block md:col-span-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nome comercial</span>
                      <input
                        value={faixa.nome}
                        onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, nome: e.target.value } : item))}
                        placeholder="Até 3 km"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Até km</span>
                      <input value={faixa.km_ate} onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, km_ate: e.target.value } : item))} type="number" step="0.1"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Taxa fixa</span>
                      <input value={faixa.taxa_fixa} onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, taxa_fixa: e.target.value } : item))} type="number" step="0.01"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">R$/km</span>
                      <input value={faixa.taxa_por_km} onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, taxa_por_km: e.target.value } : item))} type="number" step="0.01"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Pedido mínimo</span>
                      <input value={faixa.pedido_minimo} onChange={(e) => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, pedido_minimo: e.target.value } : item))} type="number" step="0.01"
                        className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setFaixasEntrega((atual) => atual.map((item, i) => i === index ? { ...item, ativo: !item.ativo } : item))}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${faixa.ativo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {faixa.ativo ? 'Faixa ativa' : 'Faixa inativa'}
                    </button>
                    <button type="button" onClick={() => setFaixasEntrega((atual) => atual.filter((_, i) => i !== index))}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-500">
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              As taxas por bairro continuam disponíveis na aba <Link to="/admin/marketing" className="font-bold underline">Marketing</Link> e entram como contingência operacional quando necessário.
            </div>
          </div>
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

          {/* Repasse do Pix — precisa de dado diferente do cartão */}
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <Shield size={14} /> Recebimentos na sua própria conta Efí
            </h3>
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-300">
              Preenchendo as credenciais da API da <b>sua conta Efí</b>, os pagamentos (Pix e cartão) caem
              <b> direto na sua conta</b> e o cliente vê o <b>nome da sua loja</b> na hora de pagar — a MiseOn não
              segura nada. Pegue estes dados no painel Efí em <b>API → Minhas Aplicações</b> (crie uma aplicação com os
              escopos de <b>Pix</b> e <b>Cobranças</b>) e em <b>API → Meus Certificados</b>.
            </p>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Client ID</span>
                <input value={efiCred.clientId} onChange={(e) => setEfiCred((c) => ({ ...c, clientId: e.target.value.trim() }))}
                  placeholder="Client_Id_..." className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Client Secret {efiTemSecret && <span className="ml-1 text-emerald-600">• já configurado</span>}
                </span>
                <input type="password" value={efiCred.clientSecret} onChange={(e) => setEfiCred((c) => ({ ...c, clientSecret: e.target.value.trim() }))}
                  placeholder={efiTemSecret ? 'deixe em branco para manter o atual' : 'Client_Secret_...'}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Chave Pix da conta (recebedora)</span>
                <input value={efiCred.pixKey} onChange={(e) => setEfiCred((c) => ({ ...c, pixKey: e.target.value.trim() }))}
                  placeholder="CNPJ, e-mail, telefone ou chave aleatória"
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Certificado (.pem em base64) {efiTemCert && <span className="ml-1 text-emerald-600">• já configurado</span>}
                </span>
                <textarea value={efiCred.certBase64} onChange={(e) => setEfiCred((c) => ({ ...c, certBase64: e.target.value }))}
                  rows={3} placeholder={efiTemCert ? 'deixe em branco para manter o atual' : 'cole aqui o conteúdo do certificado em base64'}
                  className="mt-1 w-full rounded-xl border p-2.5 font-mono text-[11px] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                <span className="mt-1 block text-[10px] text-gray-400">
                  Converta o <b>.p12</b> baixado da Efí em .pem e depois em base64. O certificado só é usado para o Pix e nunca é exibido de volta.
                </span>
              </label>
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
