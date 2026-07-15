import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ShoppingBag, Plus, Minus, X, MapPin, LogIn, Lock,
  Trash2, ChevronRight, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import EnderecoMixin, { EnderecoFormData } from './EnderecoMixin';
import {
  Loja, Cupom, TaxaEntrega, ItemCarrinho, Cliente, FaixaEntrega,
  MetodoPgto, fmt, precoItem,
} from '../types';
import { maskTelefone } from '../lib/mascaras';
import { calcularEntrega, ResultadoEntrega } from '../lib/geo';
import { enderecoParaLabel, salvarLocalizacaoCliente } from '../lib/localizacao-cliente';

const entrarComGoogle = (url: string) =>
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: url } });

const ROTULO_PGTO: Record<MetodoPgto, string> = {
  PIX: 'Pix', CREDITO: 'Crédito', DEBITO: 'Débito', DINHEIRO: 'Dinheiro',
};

const mensagemErroSupabase = (fallback: string, error?: { message?: string } | null) =>
  error?.message ? `${fallback} ${error.message}` : fallback;

interface Props {
  loja: Loja;
  aberta: boolean;
  carrinho: ItemCarrinho[];
  taxas: TaxaEntrega[];
  faixasDistancia: FaixaEntrega[];
  user: User | null;
  setCarrinho: (c: ItemCarrinho[]) => void;
  onClose: () => void;
  onSucesso: (numero: number, pedidoId: string, pix?: { copia_e_cola: string; qr_imagem?: string } | null) => void;
  onCartao?: (info: { pedidoId: string; numero: number; total: number }) => void;
  onAbrirAuth: () => void;
}

export default function CheckoutDrawer({
  loja, aberta, carrinho, taxas, faixasDistancia, user,
  setCarrinho, onClose, onSucesso, onCartao, onAbrirAuth,
}: Props) {
  const [tipo, setTipo] = useState<'DELIVERY' | 'RETIRADA_BALCAO'>('DELIVERY');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enderecoObj, setEnderecoObj] = useState<EnderecoFormData | null>(null);
  const [bairroManual, setBairroManual] = useState('');
  const [metodo, setMetodo] = useState<MetodoPgto>('PIX');
  const [trocoPara, setTrocoPara] = useState('');
  const [codCupom, setCodCupom] = useState('');
  const [cupom, setCupom] = useState<Cupom | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [entrega, setEntrega] = useState<ResultadoEntrega | null>(null);
  const [calcTaxa, setCalcTaxa] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  // Foco automatico no campo nome quando o perfil carrega
  useEffect(() => {
    if (perfilCarregado && user) {
      setTimeout(() => nomeRef.current?.focus(), 200);
    }
  }, [perfilCarregado, user]);

  // Carrega perfil do cliente logado
  useEffect(() => {
    if (!user) { setPerfilCarregado(true); return; }
    (async () => {
      const { data } = await supabase
        .from('clientes').select('*')
        .eq('loja_id', loja.id).eq('user_id', user.id).maybeSingle();
      const c = data as Cliente | null;
      if (c) {
        setNome(c.nome ?? '');
        setTelefone(c.telefone ?? '');
        supabase.from('enderecos_cliente').select('*')
          .eq('cliente_id', c.id).eq('padrao', true).maybeSingle()
          .then(({ data: end }) => {
            if (end) {
              setEnderecoObj({
                cep: end.cep, logradouro: end.logradouro,
                numero: end.numero || '', complemento: end.complemento || '',
                bairro: end.bairro, cidade: end.cidade, uf: end.uf,
                ponto_referencia: end.ponto_referencia || '',
                sem_numero: !end.numero || end.numero === 'SN',
              });
              setBairroManual(end.bairro);
            } else {
              setEnderecoObj(null);
              setBairroManual(c.bairro ?? '');
            }
          });
        if (c.forma_pagamento_preferida) setMetodo(c.forma_pagamento_preferida);
      } else if (user.user_metadata?.full_name || user.user_metadata?.name) {
        setNome(user.user_metadata.full_name ?? user.user_metadata.name);
      }
      setPerfilCarregado(true);
    })();
  }, [user, loja.id]);

  // --- Calculo da entrega (distancia -> bairro -> padrao), reativo e com debounce ---
  const bairroAtual = enderecoObj?.bairro || bairroManual;
  const enderecoQuery = enderecoObj
    ? [enderecoObj.logradouro, enderecoObj.numero, enderecoObj.bairro, enderecoObj.cidade, enderecoObj.uf, enderecoObj.cep, 'Brasil']
        .filter(Boolean).join(', ')
    : '';
  const prontoParaCalcular =
    tipo === 'DELIVERY' &&
    ((!!enderecoObj?.logradouro && !!enderecoObj?.numero) || bairroAtual.trim().length > 0);

  useEffect(() => {
    if (tipo !== 'DELIVERY') { setEntrega(null); return; }
    if (!prontoParaCalcular) { setEntrega(null); return; }
    let cancelado = false;
    setCalcTaxa(true);
    const id = setTimeout(async () => {
      const res = await calcularEntrega(loja, {
        enderecoQuery,
        bairro: bairroAtual,
        taxasBairro: taxas.map((t) => ({ bairro: t.bairro, valor: t.valor })),
        faixasDistancia,
      });
      if (!cancelado) {
        setEntrega(res);
        if (res.geo) {
          salvarLocalizacaoCliente({
            origem: 'endereco',
            lat: res.geo.lat,
            lng: res.geo.lng,
            label: enderecoParaLabel(enderecoObj ?? undefined) || bairroAtual,
          });
        }
        setCalcTaxa(false);
      }
    }, 700);
    return () => { cancelado = true; clearTimeout(id); setCalcTaxa(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo, enderecoQuery, bairroAtual, loja.id, faixasDistancia]);

  // --- Calculos financeiros ---
  const subtotal = carrinho.reduce((s, i) => s + precoItem(i), 0);
  const taxa = tipo === 'DELIVERY' ? (entrega?.taxa ?? 0) : 0;
  const foraDeArea = tipo === 'DELIVERY' && !!entrega?.foraDeArea;
  const desconto = cupom
    ? cupom.tipo === 'FIXO'
      ? Number(cupom.valor)
      : (subtotal * Number(cupom.valor)) / 100
    : 0;
  const total = Math.max(0, subtotal + taxa - desconto);

  // Formas de pagamento conforme as flags da loja
  const aceitaOnline = loja.aceita_online !== false;
  const aceitaEntrega = loja.aceita_entrega !== false;
  const cartaoOnlineConfigurado = !!loja.efi_payee_code?.trim();
  const metodosOnline: MetodoPgto[] = aceitaOnline
    ? ['PIX', ...(cartaoOnlineConfigurado ? (['CREDITO'] as MetodoPgto[]) : [])]
    : [];
  const metodosEntrega: MetodoPgto[] = aceitaEntrega ? ['DINHEIRO', 'DEBITO'] : [];
  const metodosDisponiveis = [...metodosOnline, ...metodosEntrega];
  useEffect(() => {
    if (metodosDisponiveis.length && !metodosDisponiveis.includes(metodo)) setMetodo(metodosDisponiveis[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aceitaOnline, aceitaEntrega]);

  const descartarPedidoIncompleto = async (pedidoId: string) => {
    await supabase.from('pedidos').delete().eq('id', pedidoId);
  };

  const cancelarPedidoPendente = async (pedidoId: string) => {
    await Promise.all([
      supabase.from('pagamentos').update({ status: 'CANCELADO' }).eq('pedido_id', pedidoId).eq('status', 'PENDENTE'),
      supabase.from('pedidos').update({ status: 'CANCELADO' }).eq('id', pedidoId).eq('status', 'NOVO'),
    ]);
  };

  const aplicarCupom = async () => {
    setErro('');
    const { data } = await supabase.from('cupons').select('*')
      .eq('loja_id', loja.id).eq('codigo', codCupom.trim().toUpperCase()).eq('ativo', true)
      .maybeSingle();
    if (!data) return setErro('Cupom nao encontrado.');
    if (subtotal < Number(data.pedido_minimo))
      return setErro(`Cupom exige pedido minimo de ${fmt(Number(data.pedido_minimo))}.`);
    if (data.metodo_exigido && data.metodo_exigido !== metodo)
      return setErro(`Cupom valido apenas no ${data.metodo_exigido}.`);
    setCupom(data);
  };

  const enviar = async () => {
    setErro('');
    if (!user) { onAbrirAuth(); return setErro('Faca login para finalizar.'); }
    if (!aberta) return setErro('A loja esta fechada no momento.');
    if (!nome.trim() || !telefone.trim()) return setErro('Preencha nome e telefone.');
    if (tipo === 'DELIVERY' && (!enderecoObj?.logradouro || !enderecoObj?.numero))
      return setErro('Preencha o endereco completo com numero.');
    if (foraDeArea)
      return setErro('Seu endereco esta fora da area de entrega desta loja.');
    if (subtotal < Number(loja.pedido_minimo))
      return setErro(`Pedido minimo: ${fmt(Number(loja.pedido_minimo))}.`);
    if (metodo === 'CREDITO' && (!cartaoOnlineConfigurado || !onCartao))
      return setErro('Cartão online ainda não está configurado para esta loja.');
    setEnviando(true);

    const ref = tipo === 'DELIVERY' ? (enderecoObj?.ponto_referencia || '').trim() : '';
    const enderecoFormatado = tipo === 'DELIVERY' && enderecoObj
      ? `${enderecoObj.logradouro}, ${enderecoObj.numero}${enderecoObj.complemento ? ` (${enderecoObj.complemento})` : ''}${ref ? ` - Ref: ${ref}` : ''}`
      : null;
    const bairroFormatado = tipo === 'DELIVERY' && enderecoObj ? enderecoObj.bairro : null;

    // Upsert cliente (perfil / lead que o lojista consulta depois)
    const { data: clienteRow, error: erroCliente } = await supabase.from('clientes').upsert({
      loja_id: loja.id, user_id: user.id, nome: nome.trim(),
      telefone, email: user.email ?? null,
      bairro: bairroFormatado ?? bairroManual,
      ...(metodo ? { forma_pagamento_preferida: metodo } : {}),
    }, { onConflict: 'loja_id,user_id' }).select('id').maybeSingle();

    if (erroCliente) {
      setEnviando(false);
      return setErro(mensagemErroSupabase('Erro ao salvar os dados do cliente.', erroCliente));
    }

    // Salvar endereco padrao (so cria se o cliente ainda nao tem nenhum)
    if (tipo === 'DELIVERY' && enderecoObj && clienteRow?.id) {
      const { count, error: erroCountEndereco } = await supabase.from('enderecos_cliente')
        .select('*', { count: 'exact', head: true }).eq('cliente_id', clienteRow.id);
      if (erroCountEndereco) {
        setEnviando(false);
        return setErro(mensagemErroSupabase('Erro ao verificar endereco padrao do cliente.', erroCountEndereco));
      }
      if (!count) {
        const { error: erroEndereco } = await supabase.from('enderecos_cliente').insert({
          cliente_id: clienteRow.id, cep: enderecoObj.cep,
          logradouro: enderecoObj.logradouro,
          numero: enderecoObj.sem_numero ? 'SN' : (enderecoObj.numero || null),
          complemento: enderecoObj.complemento || null,
          bairro: enderecoObj.bairro,
          cidade: enderecoObj.cidade,
          uf: (enderecoObj.uf || '').toUpperCase(),
          ponto_referencia: enderecoObj.ponto_referencia || null,
          padrao: true,
        });
        if (erroEndereco) {
          setEnviando(false);
          return setErro(mensagemErroSupabase('Erro ao salvar endereco padrao do cliente.', erroEndereco));
        }
      }
    }

    // Criar pedido (colunas REAIS da tabela pedidos)
    const { data: pedido, error: erroPedido } = await supabase.from('pedidos').insert({
      loja_id: loja.id,
      tipo_pedido: tipo,
      identificador_cliente: nome.trim(),
      telefone_contato: telefone,
      cliente_id: clienteRow?.id ?? null,
      cliente_user_id: user.id,
      endereco_entrega: enderecoFormatado,
      bairro: bairroFormatado,
      cep: enderecoObj?.cep ?? null,
      logradouro: enderecoObj?.logradouro ?? null,
      numero_endereco: enderecoObj?.numero ?? null,
      complemento: enderecoObj?.complemento ?? null,
      cidade: enderecoObj?.cidade ?? null,
      uf: enderecoObj?.uf ?? null,
      distancia_km: entrega?.distanciaKm ?? null,
      lat: entrega?.geo?.lat ?? null,
      lng: entrega?.geo?.lng ?? null,
      subtotal, taxa_entrega: taxa, desconto, valor_total: total,
      cupom_id: cupom?.id ?? null,
      troco_para: metodo === 'DINHEIRO' && trocoPara ? Number(trocoPara) : null,
    }).select('id, numero').single();

    if (erroPedido || !pedido) {
      setEnviando(false);
      return setErro(mensagemErroSupabase('Erro ao criar pedido.', erroPedido));
    }

    // Itens do pedido + opcoes (tabelas itens_pedido / itens_pedido_opcoes)
    for (const item of carrinho) {
      const { data: it, error: erroItem } = await supabase.from('itens_pedido').insert({
        pedido_id: pedido.id,
        produto_id: item.produto.id,
        nome_produto: item.produto.nome,
        preco_unitario: item.produto.preco,
        quantidade: item.quantidade,
        observacao: item.observacao ?? null,
      }).select('id').single();
      if (erroItem || !it) {
        await descartarPedidoIncompleto(pedido.id);
        setEnviando(false);
        return setErro(mensagemErroSupabase(`Erro ao salvar item do pedido (${item.produto.nome}).`, erroItem));
      }
      if (it && item.opcoesSelecionadas.length) {
        const { error: erroOpcoes } = await supabase.from('itens_pedido_opcoes').insert(
          item.opcoesSelecionadas.map((o) => ({
            item_id: it.id, opcao_id: o.id, nome_opcao: o.nome, preco_adicional: o.preco_adicional,
          })),
        );
        if (erroOpcoes) {
          await descartarPedidoIncompleto(pedido.id);
          setEnviando(false);
          return setErro(mensagemErroSupabase(`Erro ao salvar complementos do item ${item.produto.nome}.`, erroOpcoes));
        }
      }
    }

    // Pagamento
    const { error: erroPagamento } = await supabase.from('pagamentos').insert({ pedido_id: pedido.id, metodo, valor_pago: total });
    if (erroPagamento) {
      await descartarPedidoIncompleto(pedido.id);
      setEnviando(false);
      return setErro(mensagemErroSupabase('Erro ao registrar pagamento do pedido.', erroPagamento));
    }

    // Cartao de credito online (Efi — tokenizacao no proximo modal)
    if (metodo === 'CREDITO') {
      setEnviando(false);
      onCartao?.({ pedidoId: pedido.id, numero: pedido.numero, total });
      return;
    }

    let pixInfo: { copia_e_cola: string; qr_imagem?: string } | null = null;
    if (metodo === 'PIX') {
      const { data: cob, error: e2 } = await supabase.functions.invoke('pix-criar-cobranca', {
        body: { pedido_id: pedido.id },
      });
      if (e2 || cob?.error) {
        await cancelarPedidoPendente(pedido.id);
        setEnviando(false);
        return setErro(`Falha na plataforma de pagamento: ${e2?.message || cob?.error || 'Erro desconhecido ao gerar Pix'}`);
      }
      if (cob?.copia_e_cola) pixInfo = cob;
    }

    setEnviando(false);
    onSucesso(pedido.numero, pedido.id, pixInfo);
  };

  return (
    // Overlay com backdrop
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Gaveta lateral - clique nao fecha */}
      <div
        className="slide-left flex h-full w-full max-w-[440px] flex-col bg-white dark:bg-gray-950 shadow-2xl"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header fixo ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-[var(--cor-primaria)]" />
            <span className="text-base font-black dark:text-white">Finalizar Pedido</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Corpo scrollavel ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Lista de itens */}
          <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-4 space-y-3">
            {carrinho.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight dark:text-gray-100 truncate">
                    {item.produto.nome}
                  </p>
                  {item.opcoesSelecionadas?.length > 0 && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {item.opcoesSelecionadas.map((o) => o.nome).join(', ')}
                    </p>
                  )}
                  {item.observacao && (
                    <p className="text-[11px] italic text-gray-400 mt-0.5">"{item.observacao}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1">
                    <button
                      onClick={() => item.quantidade > 1
                        ? setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade - 1 } : x))
                        : setCarrinho(carrinho.filter((_, y) => y !== idx))}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-4 text-center text-xs font-bold dark:text-gray-200">{item.quantidade}</span>
                    <button
                      onClick={() => setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade + 1 } : x))}
                      className="text-gray-400 hover:text-[var(--cor-primaria)] transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <p className="text-sm font-bold dark:text-gray-100 w-16 text-right">{fmt(precoItem(item))}</p>
                  <button
                    onClick={() => setCarrinho(carrinho.filter((_, x) => x !== idx))}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Formulario */}
          <div className="px-5 py-4 space-y-5">

            {!user ? (
              /* Nao logado */
              <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
                <ShoppingBag size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-bold dark:text-gray-200">Faca login para finalizar</p>
                <p className="mt-1 text-xs text-gray-400">
                  Usamos sua conta Google para salvar seu endereco e historico de pedidos.
                </p>
                <button
                  onClick={() => entrarComGoogle(window.location.href)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white hover:brightness-110 transition-all"
                >
                  <LogIn size={16} /> Entrar com Google
                </button>
              </div>
            ) : !perfilCarregado ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando seus dados...</p>
            ) : (
              <>
                {/* Tipo de pedido */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    Tipo de pedido
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['DELIVERY', 'RETIRADA_BALCAO'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTipo(t)}
                        className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                          tipo === t
                            ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria)]'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                        }`}
                      >
                        <ChevronRight size={14} className={tipo === t ? 'opacity-100' : 'opacity-0'} />
                        {t === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dados pessoais */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    Seus dados
                  </p>
                  <div className="space-y-2">
                    <input
                      ref={nomeRef}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--cor-primaria)] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:bg-gray-800"
                    />
                    <input
                      value={telefone}
                      onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                      placeholder="WhatsApp (11) 90000-0000"
                      type="tel"
                      maxLength={15}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--cor-primaria)] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:bg-gray-800"
                    />
                  </div>
                </div>

                {/* Endereco (somente delivery) */}
                {tipo === 'DELIVERY' && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                      <MapPin size={11} /> Endereco de entrega
                    </p>
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 dark:bg-gray-900">
                      <EnderecoMixin
                        valorInicial={enderecoObj ?? undefined}
                        onMudanca={setEnderecoObj}
                      />
                    </div>

                    {/* Taxa de entrega: distancia (geocoding) -> bairro -> padrao */}
                    <div className={`mt-3 rounded-2xl border p-4 transition-all ${
                      foraDeArea
                        ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-700 dark:bg-gray-900'
                    }`}>
                      <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <MapPin size={11} /> Taxa de entrega
                      </p>

                      {calcTaxa ? (
                        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 size={14} className="animate-spin" /> Calculando pela distância…
                        </p>
                      ) : entrega?.origem === 'DISTANCIA' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold dark:text-gray-200">
                              ~{entrega.distanciaKm} km da loja{entrega.faixaNome ? ` · ${entrega.faixaNome}` : ''}
                            </span>
                            <span className={`text-sm font-black ${foraDeArea ? 'text-red-600 dark:text-red-400' : 'text-[var(--cor-primaria)]'}`}>
                              {foraDeArea ? 'Fora da área' : fmt(taxa)}
                            </span>
                          </div>
                          {!foraDeArea && entrega.faixaNome && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Faixa aplicada automaticamente conforme a distância do cliente.
                            </p>
                          )}
                          {foraDeArea && entrega.raioConsideradoKm != null && (
                            <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">
                              Fora do raio de {Number(entrega.raioConsideradoKm)} km desta loja.
                            </p>
                          )}
                        </>
                      ) : taxas.length > 0 ? (
                        <>
                          <select
                            value={bairroAtual}
                            onChange={(e) => {
                              setBairroManual(e.target.value);
                              if (enderecoObj) setEnderecoObj({ ...enderecoObj, bairro: e.target.value });
                            }}
                            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-semibold outline-none transition-colors focus:border-[var(--cor-primaria)] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="">Selecione seu bairro…</option>
                            {taxas.map((t) => (
                              <option key={t.id} value={t.bairro}>{t.bairro} — {fmt(Number(t.valor))}</option>
                            ))}
                          </select>
                          {entrega?.origem === 'PADRAO' && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Não localizamos seu endereço — taxa padrão de {fmt(taxa)}.</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-semibold dark:text-gray-200">
                          {taxa > 0 ? fmt(taxa) : 'Informe o endereço para calcular'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Cupom */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    Cupom de desconto
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={codCupom}
                      onChange={(e) => setCodCupom(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && aplicarCupom()}
                      placeholder="Codigo do cupom"
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm uppercase outline-none focus:border-[var(--cor-primaria)] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                    <button
                      onClick={aplicarCupom}
                      className="rounded-xl border border-gray-200 px-4 text-sm font-bold dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                  {cupom && (
                    <p className="mt-1.5 text-xs font-bold text-green-600">
                      Cupom {cupom.codigo} aplicado — desconto de {fmt(desconto)}
                    </p>
                  )}
                </div>

                {/* Metodo de pagamento (agrupado por antecipado x na entrega) */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    Forma de pagamento
                  </p>

                  {metodosDisponiveis.length === 0 && (
                    <p className="text-sm text-gray-400">A loja ainda não configurou formas de pagamento.</p>
                  )}

                  {metodosOnline.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Lock size={11} /> Pague agora (online)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {metodosOnline.map((m) => (
                          <button key={m} onClick={() => setMetodo(m)}
                            className={`rounded-xl border py-3 text-xs font-bold transition-all ${
                              metodo === m
                                ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria)]'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                            }`}>
                            {ROTULO_PGTO[m]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {metodosEntrega.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">Pague na entrega</p>
                      <div className="grid grid-cols-2 gap-2">
                        {metodosEntrega.map((m) => (
                          <button key={m} onClick={() => setMetodo(m)}
                            className={`rounded-xl border py-3 text-xs font-bold transition-all ${
                              metodo === m
                                ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria)]'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                            }`}>
                            {ROTULO_PGTO[m]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {metodo === 'DINHEIRO' && (
                    <input
                      value={trocoPara}
                      onChange={(e) => setTrocoPara(e.target.value)}
                      placeholder="Troco para quanto?"
                      type="number"
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  )}
                </div>

                {/* Resumo do pedido */}
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-200">{fmt(subtotal)}</span>
                  </div>
                  {tipo === 'DELIVERY' && (
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Taxa de entrega</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-200">
                        {calcTaxa ? '…' : taxa > 0 ? fmt(taxa) : '—'}
                      </span>
                    </div>
                  )}
                  {desconto > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-semibold">
                      <span>Desconto</span>
                      <span>-{fmt(desconto)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                    <span className="text-base font-black dark:text-white">Total</span>
                    <span className="text-base font-black" style={{ color: 'var(--cor-primaria)' }}>
                      {fmt(total)}
                    </span>
                  </div>
                </div>

                {/* Erro */}
                {erro && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
                    {erro}
                  </div>
                )}

                {/* Botao finalizar */}
                <button
                  onClick={enviar}
                  disabled={enviando || carrinho.length === 0 || foraDeArea}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-black text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    foraDeArea
                      ? 'bg-gray-400 dark:bg-gray-700'
                      : 'bg-[var(--cor-primaria)] shadow-lg shadow-[var(--cor-primaria)]/30 hover:brightness-110 active:scale-[0.98]'
                  }`}
                >
                  <Lock size={16} />
                  {enviando
                    ? 'Processando...'
                    : foraDeArea
                    ? 'Bairro nao atendido'
                    : `Finalizar Pedido - ${fmt(total)}`}
                </button>
                <p className="pb-4 text-center text-[10px] text-gray-400">
                  Ao finalizar voce concorda com os termos de uso.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
