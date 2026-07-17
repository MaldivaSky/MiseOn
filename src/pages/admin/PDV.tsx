import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ShoppingCart, Trash2, Plus, Minus, X, Banknote, QrCode, CreditCard,
  Check, Lock, Unlock, ArrowDownCircle, ArrowUpCircle, Loader2,
  ChefHat, Receipt, Search, PartyPopper, Store, UtensilsCrossed,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fmt, precoItem, type Produto, type Opcao, type ItemCarrinho, type Loja, type Mesa,
  type CaixaTurno, type CaixaMovimentacao, type MetodoPgto,
} from '../../types';
import { imprimir } from '../../lib/print';
import { obterOuCriarComandaAberta } from '../../lib/comandas';
import type { CtxLoja } from './AdminLayout';

/* ─────────────────────────────────────────────────────────────
   PDV — Frente de balcão touch-first.
   Venda em segundos: toca no produto → carrinho → cobrar.
   O pedido nasce origem='balcao', vira ACEITO na hora (baixa
   estoque via trigger) e cai no KDS da cozinha como os demais.

   Também funciona em "modo mesa" (garçom): o pedido vai pra
   comanda da mesa igual ao cliente que pede pelo QR — sem cobrar
   na hora, a conta fecha depois no Mapa de Mesas.
   ───────────────────────────────────────────────────────────── */

type EtapaVenda = 'CARRINHO' | 'PAGANDO' | 'PIX_AGUARDANDO' | 'SUCESSO';
type ModoPDV = 'BALCAO' | 'MESA';

interface VendaConcluida {
  pedidoId: string;
  numero: number;
  total: number;
  metodo: MetodoPgto;
  troco: number;
  itens: ItemCarrinho[];
}

const NOTAS_RAPIDAS = [5, 10, 20, 50, 100, 200];

export default function PDV() {
  const { lojaId } = useOutletContext<CtxLoja>();

  // catálogo
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [catAtiva, setCatAtiva] = useState<string | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');

  // modo mesa (garçom lança pedido pra comanda em vez de cobrar na hora)
  const [modo, setModo] = useState<ModoPDV>('BALCAO');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [enviandoMesa, setEnviandoMesa] = useState(false);
  const [pedidoMesaOk, setPedidoMesaOk] = useState<{ numero: number; mesaNumero: number } | null>(null);

  // caixa
  const [turno, setTurno] = useState<CaixaTurno | null | undefined>(undefined); // undefined = carregando
  const [movs, setMovs] = useState<CaixaMovimentacao[]>([]);
  const [dinheiroTurno, setDinheiroTurno] = useState(0); // vendas em dinheiro do turno
  const [modalCaixa, setModalCaixa] = useState<'ABRIR' | 'SANGRIA' | 'REFORCO' | 'FECHAR' | null>(null);

  // venda
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [desconto, setDesconto] = useState('');
  const [etapa, setEtapa] = useState<EtapaVenda>('CARRINHO');
  const [metodo, setMetodo] = useState<MetodoPgto | null>(null);
  const [valorRecebido, setValorRecebido] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [venda, setVenda] = useState<VendaConcluida | null>(null);
  const [pixInfo, setPixInfo] = useState<{ pedidoId: string; copiaECola?: string; qrImagem?: string | null } | null>(null);

  // modal de opções do produto
  const [escolhendo, setEscolhendo] = useState<Produto | null>(null);

  /* ── carregamento ── */
  const carregarCatalogo = async () => {
    const [{ data: prods }, { data: cats }, { data: lj }, { data: mesasData }] = await Promise.all([
      supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*))').eq('loja_id', lojaId).eq('disponivel', true).order('ordem'),
      supabase.from('categorias').select('id, nome').eq('loja_id', lojaId).eq('ativo', true).order('ordem'),
      supabase.from('lojas').select('*').eq('id', lojaId).single(),
      supabase.from('mesas').select('*').eq('loja_id', lojaId).eq('ativo', true).order('numero'),
    ]);
    setProdutos((prods as Produto[]) ?? []);
    setCategorias(cats ?? []);
    setLoja((lj as Loja) ?? null);
    setMesas((mesasData as Mesa[]) ?? []);
  };

  const carregarCaixa = async () => {
    const { data: t } = await supabase.from('caixa_turnos').select('*')
      .eq('loja_id', lojaId).eq('status', 'ABERTO').order('aberto_em', { ascending: false }).limit(1).maybeSingle();
    const turnoAtual = (t as CaixaTurno) ?? null;
    setTurno(turnoAtual);
    if (!turnoAtual) { setMovs([]); setDinheiroTurno(0); return; }

    const [{ data: m }, { data: vendasDinheiro }] = await Promise.all([
      supabase.from('caixa_movimentacoes').select('*').eq('turno_id', turnoAtual.id).order('criado_em'),
      // Dinheiro que passa por ESTA gaveta: balcão (retirada) e mesas fechadas em dinheiro.
      // Delivery em dinheiro fica com o entregador, não entra na gaveta do PDV.
      supabase.from('pedidos').select('valor_total, pagamentos(metodo, status)')
        .eq('loja_id', lojaId).in('tipo_pedido', ['RETIRADA_BALCAO', 'SALAO']).neq('status', 'CANCELADO')
        .gte('criado_em', turnoAtual.aberto_em),
    ]);
    setMovs((m as CaixaMovimentacao[]) ?? []);
    const soma = (vendasDinheiro ?? []).reduce((s, p: any) => {
      const pago = (p.pagamentos ?? []).some((pg: any) => pg.metodo === 'DINHEIRO' && pg.status === 'PAGO');
      return s + (pago ? Number(p.valor_total) : 0);
    }, 0);
    setDinheiroTurno(soma);
  };

  useEffect(() => { carregarCatalogo(); carregarCaixa(); }, [lojaId]);

  /* ── derivados ── */
  const produtosVisiveis = useMemo(() => {
    let lista = produtos;
    if (catAtiva !== 'TODAS') lista = lista.filter((p) => p.categoria_id === catAtiva);
    if (busca.trim()) lista = lista.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));
    return lista;
  }, [produtos, catAtiva, busca]);

  const subtotal = useMemo(() => carrinho.reduce((s, i) => s + precoItem(i), 0), [carrinho]);
  const descontoNum = Math.min(Number(desconto || 0), subtotal);
  const total = subtotal - descontoNum;
  const recebidoNum = Number(valorRecebido || 0);
  const troco = metodo === 'DINHEIRO' ? Math.max(0, recebidoNum - total) : 0;

  const reforcos = movs.filter((m) => m.tipo === 'REFORCO').reduce((s, m) => s + Number(m.valor), 0);
  const sangrias = movs.filter((m) => m.tipo === 'SANGRIA').reduce((s, m) => s + Number(m.valor), 0);
  const dinheiroGaveta = Number(turno?.fundo_troco ?? 0) + dinheiroTurno + reforcos - sangrias;

  /* ── carrinho ── */
  const adicionarProduto = (p: Produto, opcoes: Opcao[] = [], quantidade = 1, observacao = '') => {
    setCarrinho((c) => {
      // agrupa itens idênticos (mesmo produto, mesmas opções, mesma obs)
      const chave = (i: ItemCarrinho) => i.produto.id + '|' + i.opcoesSelecionadas.map((o) => o.id).sort().join(',') + '|' + (i.observacao ?? '');
      const nova = { produto: p, quantidade, opcoesSelecionadas: opcoes, observacao: observacao || undefined };
      const idx = c.findIndex((i) => chave(i) === chave(nova));
      if (idx >= 0) {
        const cp = [...c]; cp[idx] = { ...cp[idx], quantidade: cp[idx].quantidade + quantidade }; return cp;
      }
      return [...c, nova];
    });
  };

  const tocarProduto = (p: Produto) => {
    const temOpcoes = (p.grupos_opcoes ?? []).some((g) => (g.opcoes ?? []).filter((o) => o.disponivel).length > 0);
    if (temOpcoes) setEscolhendo(p);
    else adicionarProduto(p);
  };

  const mudarQtd = (idx: number, delta: number) => {
    setCarrinho((c) => c.map((i, x) => x === idx ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  };

  const limparVenda = () => {
    setCarrinho([]); setNomeCliente(''); setDesconto(''); setEtapa('CARRINHO');
    setMetodo(null); setValorRecebido(''); setErro(''); setVenda(null); setPixInfo(null);
  };

  /* ── fechamento da venda ── */
  const registrarVenda = async (met: MetodoPgto) => {
    if (carrinho.length === 0) return;
    if (met === 'DINHEIRO' && recebidoNum < total) { setErro('Valor recebido menor que o total.'); return; }
    setProcessando(true); setErro('');
    try {
      const { data: ped, error: e1 } = await supabase.from('pedidos').insert({
        loja_id: lojaId,
        tipo_pedido: 'RETIRADA_BALCAO',
        origem: 'balcao',
        identificador_cliente: nomeCliente.trim() || 'Balcão',
        subtotal,
        desconto: descontoNum,
        valor_total: total,
        troco_para: met === 'DINHEIRO' && recebidoNum > total ? recebidoNum : null,
      }).select('id, numero').single();
      if (e1 || !ped) throw e1 ?? new Error('Falha ao criar o pedido');

      for (const item of carrinho) {
        const { data: it, error: e2 } = await supabase.from('itens_pedido').insert({
          pedido_id: ped.id,
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          preco_unitario: Number(item.produto.preco) + item.opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0),
          quantidade: item.quantidade,
          observacao: item.observacao ?? null,
        }).select('id').single();
        if (e2 || !it) throw e2 ?? new Error('Falha ao registrar item');
        if (item.opcoesSelecionadas.length > 0) {
          const { error: e3 } = await supabase.from('itens_pedido_opcoes').insert(
            item.opcoesSelecionadas.map((o) => ({
              item_id: it.id, opcao_id: o.id, nome_opcao: o.nome, preco_adicional: Number(o.preco_adicional),
            })),
          );
          if (e3) throw e3;
        }
      }

      const pagoAgora = met !== 'PIX'; // dinheiro/maquininha recebem na hora; Pix espera o QR
      const { error: e4 } = await supabase.from('pagamentos').insert({
        pedido_id: ped.id, metodo: met, valor_pago: total,
        status: pagoAgora ? 'PAGO' : 'PENDENTE',
        data_pagamento: pagoAgora ? new Date().toISOString() : null,
      });
      if (e4) throw e4;

      if (met === 'PIX') {
        // gera a cobrança e mostra o QR na tela para o cliente apontar o celular
        const { data: pix, error: e5 } = await supabase.functions.invoke('pix-criar-cobranca', { body: { pedido_id: ped.id } });
        if (e5 || pix?.error) throw new Error(String(pix?.error ?? e5?.message ?? 'Falha ao gerar o Pix'));
        setPixInfo({ pedidoId: ped.id, copiaECola: pix.copia_e_cola, qrImagem: pix.qr_imagem });
        setVenda({ pedidoId: ped.id, numero: ped.numero, total, metodo: met, troco: 0, itens: carrinho });
        setEtapa('PIX_AGUARDANDO');
      } else {
        // ACEITO dispara a baixa de estoque e manda para a cozinha
        await supabase.from('pedidos').update({ status: 'ACEITO' }).eq('id', ped.id);
        setVenda({ pedidoId: ped.id, numero: ped.numero, total, metodo: met, troco, itens: carrinho });
        setEtapa('SUCESSO');
        carregarCaixa();
      }
    } catch (e) {
      console.error(e);
      setErro('Erro ao registrar a venda: ' + String((e as Error)?.message ?? e));
    }
    setProcessando(false);
  };

  /* ── modo mesa: envia a rodada pra comanda, sem cobrar agora ── */
  const enviarParaMesa = async () => {
    if (!mesaSelecionada || carrinho.length === 0) return;
    setEnviandoMesa(true); setErro('');
    try {
      const comandaId = await obterOuCriarComandaAberta(lojaId, mesaSelecionada.id);
      const { data: ped, error: e1 } = await supabase.from('pedidos').insert({
        loja_id: lojaId,
        tipo_pedido: 'SALAO',
        origem: 'garcom',
        comanda_id: comandaId,
        mesa_numero: mesaSelecionada.numero,
        identificador_cliente: nomeCliente.trim() || `Mesa ${mesaSelecionada.numero}`,
        subtotal, desconto: descontoNum, valor_total: total,
      }).select('id, numero').single();
      if (e1 || !ped) throw e1 ?? new Error('Falha ao enviar o pedido');

      for (const item of carrinho) {
        const { data: it, error: e2 } = await supabase.from('itens_pedido').insert({
          pedido_id: ped.id,
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          preco_unitario: Number(item.produto.preco) + item.opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0),
          quantidade: item.quantidade,
          observacao: item.observacao ?? null,
        }).select('id').single();
        if (e2 || !it) throw e2 ?? new Error(`Falha ao registrar ${item.produto.nome}`);
        if (item.opcoesSelecionadas.length > 0) {
          const { error: e3 } = await supabase.from('itens_pedido_opcoes').insert(
            item.opcoesSelecionadas.map((o) => ({ item_id: it.id, opcao_id: o.id, nome_opcao: o.nome, preco_adicional: Number(o.preco_adicional) })),
          );
          if (e3) throw e3;
        }
      }

      setPedidoMesaOk({ numero: ped.numero, mesaNumero: mesaSelecionada.numero });
      setCarrinho([]); setNomeCliente(''); setDesconto('');
    } catch (e) {
      console.error(e);
      setErro('Erro ao enviar para a mesa: ' + String((e as Error)?.message ?? e));
    }
    setEnviandoMesa(false);
  };

  useEffect(() => {
    if (!pedidoMesaOk) return;
    const t = setTimeout(() => setPedidoMesaOk(null), 5000);
    return () => clearTimeout(t);
  }, [pedidoMesaOk]);

  const confirmarPixRecebido = async () => {
    if (!pixInfo) return;
    setProcessando(true);
    await supabase.from('pagamentos').update({ status: 'PAGO', data_pagamento: new Date().toISOString() })
      .eq('pedido_id', pixInfo.pedidoId).eq('metodo', 'PIX');
    await supabase.from('pedidos').update({ status: 'ACEITO' }).eq('id', pixInfo.pedidoId);
    setEtapa('SUCESSO');
    setProcessando(false);
    carregarCaixa();
  };

  // Pix pago via webhook → confirma sozinho na tela
  useEffect(() => {
    if (etapa !== 'PIX_AGUARDANDO' || !pixInfo) return;
    const canal = supabase
      .channel(`pdv-pix-${pixInfo.pedidoId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagamentos', filter: `pedido_id=eq.${pixInfo.pedidoId}` }, async (payload) => {
        if ((payload.new as any)?.status === 'PAGO') {
          await supabase.from('pedidos').update({ status: 'ACEITO' }).eq('id', pixInfo.pedidoId);
          setEtapa('SUCESSO');
          carregarCaixa();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [etapa, pixInfo?.pedidoId]);

  const imprimirVenda = async (template: 'COMANDA_COZINHA' | 'RECIBO_CLIENTE') => {
    if (!venda) return;
    const { data: pedidoCompleto } = await supabase.from('pedidos')
      .select('*, itens_pedido(*, itens_pedido_opcoes(*))').eq('id', venda.pedidoId).single();
    if (pedidoCompleto) {
      imprimir({ template, lojaNome: loja?.nome || 'MiseOn', loja, pedido: pedidoCompleto, itens: pedidoCompleto.itens_pedido });
    }
  };

  /* ── caixa: abrir/mov/fechar ── */
  const [valorCaixa, setValorCaixa] = useState('');
  const [motivoCaixa, setMotivoCaixa] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');
  const [salvandoCaixa, setSalvandoCaixa] = useState(false);

  const abrirTurno = async () => {
    setSalvandoCaixa(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('caixa_turnos').insert({
      loja_id: lojaId,
      aberto_por: user?.id ?? null,
      aberto_por_nome: (user?.user_metadata?.nome as string) ?? user?.email ?? null,
      fundo_troco: Number(valorCaixa || 0),
    });
    setSalvandoCaixa(false);
    setModalCaixa(null); setValorCaixa('');
    carregarCaixa();
  };

  const registrarMov = async (tipo: 'SANGRIA' | 'REFORCO') => {
    if (!turno || Number(valorCaixa || 0) <= 0) return;
    setSalvandoCaixa(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('caixa_movimentacoes').insert({
      loja_id: lojaId, turno_id: turno.id, tipo,
      valor: Number(valorCaixa), motivo: motivoCaixa.trim() || null, user_id: user?.id ?? null,
    });
    setSalvandoCaixa(false);
    setModalCaixa(null); setValorCaixa(''); setMotivoCaixa('');
    carregarCaixa();
  };

  const fecharTurno = async () => {
    if (!turno) return;
    setSalvandoCaixa(true);
    const { data: { user } } = await supabase.auth.getUser();
    const contado = Number(valorCaixa || 0);
    await supabase.from('caixa_turnos').update({
      status: 'FECHADO',
      fechado_em: new Date().toISOString(),
      fechado_por: user?.id ?? null,
      valor_esperado: dinheiroGaveta,
      valor_contado: contado,
      diferenca: contado - dinheiroGaveta,
      observacao: obsFechamento.trim() || null,
    }).eq('id', turno.id);
    setSalvandoCaixa(false);
    setModalCaixa(null); setValorCaixa(''); setObsFechamento('');
    carregarCaixa();
  };

  /* ═════════════════════════ UI ═════════════════════════ */

  if (turno === undefined) return <div className="p-8 text-center text-gray-400">Abrindo o PDV…</div>;

  const inputCls = 'w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col lg:h-screen">
      {/* ── Barra do caixa ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-black dark:text-gray-100">PDV</h2>
          <div className="flex rounded-xl bg-gray-100 p-0.5 dark:bg-gray-800">
            <button onClick={() => setModo('BALCAO')} className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${modo === 'BALCAO' ? 'bg-white text-[var(--cor-primaria)] shadow-sm dark:bg-gray-900' : 'text-gray-500'}`}>
              <Store size={13} /> Balcão
            </button>
            <button onClick={() => setModo('MESA')} className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${modo === 'MESA' ? 'bg-white text-[var(--cor-primaria)] shadow-sm dark:bg-gray-900' : 'text-gray-500'}`}>
              <UtensilsCrossed size={13} /> Mesa
            </button>
          </div>
          {turno ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Unlock size={11} /> Caixa aberto · gaveta {fmt(dinheiroGaveta)}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <Lock size={11} /> Caixa fechado
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {turno ? (
            <>
              <button onClick={() => setModalCaixa('SANGRIA')} className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"><ArrowDownCircle size={13} /> Sangria</button>
              <button onClick={() => setModalCaixa('REFORCO')} className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"><ArrowUpCircle size={13} /> Reforço</button>
              <button onClick={() => { setValorCaixa(''); setModalCaixa('FECHAR'); }} className="flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-gray-700"><Lock size={13} /> Fechar caixa</button>
            </>
          ) : (
            <button onClick={() => setModalCaixa('ABRIR')} className="flex items-center gap-1 rounded-xl bg-[var(--cor-primaria)] px-4 py-1.5 text-xs font-bold text-white"><Unlock size={13} /> Abrir caixa</button>
          )}
        </div>
      </div>

      {pedidoMesaOk && (
        <div className="flex items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/15 dark:text-emerald-400">
          <span className="flex items-center gap-1.5"><Check size={13} /> Pedido #{pedidoMesaOk.numero} enviado para a Mesa {pedidoMesaOk.mesaNumero}!</span>
          <button onClick={() => setPedidoMesaOk(null)}><X size={13} /></button>
        </div>
      )}

      {modo === 'MESA' && (
        <div className="border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900">
          {mesas.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma mesa cadastrada ainda — crie mesas no Mapa de Mesas.</p>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-gray-400">Mesa:</span>
              {mesas.map((m) => (
                <button key={m.id} onClick={() => setMesaSelecionada(m)}
                  className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-xs font-black transition ${mesaSelecionada?.id === m.id ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)] text-white' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
                  {m.numero}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Catálogo ── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-[#0B1120]">
          <div className="flex items-center gap-2 p-3 pb-0">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto p-3 pb-2">
            <button onClick={() => setCatAtiva('TODAS')} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${catAtiva === 'TODAS' ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300'}`}>Todas</button>
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setCatAtiva(c.id)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${catAtiva === c.id ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300'}`}>{c.nome}</button>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3 pt-1 sm:grid-cols-3 xl:grid-cols-4">
            {produtosVisiveis.map((p) => (
              <button key={p.id} onClick={() => tocarProduto(p)}
                className="flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition active:scale-[0.97] dark:border-gray-800 dark:bg-gray-900">
                <span className="text-sm font-bold leading-tight dark:text-gray-100">{p.nome}</span>
                <span className="mt-2 text-sm font-black text-[var(--cor-primaria)]">{fmt(Number(p.preco))}</span>
              </button>
            ))}
            {produtosVisiveis.length === 0 && <p className="col-span-full py-10 text-center text-sm text-gray-400">Nenhum produto encontrado.</p>}
          </div>
        </div>

        {/* ── Carrinho ── */}
        <div className="flex w-[340px] shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="flex items-center gap-2 text-sm font-black dark:text-gray-100"><ShoppingCart size={16} /> Venda atual</p>
            {carrinho.length > 0 && <button onClick={limparVenda} className="text-xs font-bold text-red-500">Limpar</button>}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {carrinho.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Toque nos produtos<br />para adicionar.</p>}
            <div className="space-y-2">
              {carrinho.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-gray-100 p-2.5 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold leading-tight dark:text-gray-100">{item.produto.nome}</p>
                      {item.opcoesSelecionadas.map((o) => (
                        <p key={o.id} className="text-[11px] text-gray-400">+ {o.nome}</p>
                      ))}
                      {item.observacao && <p className="text-[11px] font-semibold text-red-500">⚠ {item.observacao}</p>}
                    </div>
                    <p className="shrink-0 text-[13px] font-black dark:text-gray-100">{fmt(precoItem(item))}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => mudarQtd(idx, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Minus size={13} /></button>
                    <span className="w-6 text-center text-sm font-black dark:text-gray-100">{item.quantidade}</span>
                    <button onClick={() => mudarQtd(idx, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Plus size={13} /></button>
                    <button onClick={() => setCarrinho((c) => c.filter((_, x) => x !== idx))} className="ml-auto rounded-lg p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 p-3 dark:border-gray-800">
            <div className="mb-2 grid grid-cols-2 gap-2">
              <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Cliente (opcional)"
                className="rounded-xl border border-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              <input value={desconto} onChange={(e) => setDesconto(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="Desconto R$"
                className="rounded-xl border border-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>
            <div className="mb-1 flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {descontoNum > 0 && <div className="mb-1 flex justify-between text-xs text-green-600"><span>Desconto</span><span>-{fmt(descontoNum)}</span></div>}
            <div className="mb-3 flex justify-between text-lg font-black dark:text-gray-100"><span>Total</span><span className="text-[var(--cor-primaria)]">{fmt(total)}</span></div>
            {erro && modo === 'MESA' && <p className="mb-2 text-center text-xs font-semibold text-red-500">{erro}</p>}
            {modo === 'BALCAO' ? (
              <button disabled={carrinho.length === 0 || !turno} onClick={() => { setEtapa('PAGANDO'); setMetodo(null); setErro(''); }}
                className="w-full rounded-2xl bg-[var(--cor-primaria)] py-4 text-base font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40">
                {turno ? `Cobrar ${fmt(total)}` : 'Abra o caixa para vender'}
              </button>
            ) : (
              <button disabled={carrinho.length === 0 || !mesaSelecionada || enviandoMesa} onClick={enviarParaMesa}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] py-4 text-base font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40">
                {enviandoMesa && <Loader2 size={16} className="animate-spin" />}
                {!mesaSelecionada ? 'Selecione uma mesa' : enviandoMesa ? 'Enviando…' : `Enviar para a Mesa ${mesaSelecionada.numero}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: opções do produto ── */}
      {escolhendo && (
        <ModalOpcoes produto={escolhendo} onFechar={() => setEscolhendo(null)}
          onConfirmar={(opcoes, qtd, obs) => { adicionarProduto(escolhendo, opcoes, qtd, obs); setEscolhendo(null); }} />
      )}

      {/* ── Modal: pagamento ── */}
      {etapa === 'PAGANDO' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !processando && setEtapa('CARRINHO')}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-black dark:text-gray-100">Receber {fmt(total)}</h3>
              <button onClick={() => setEtapa('CARRINHO')} className="text-gray-400"><X size={20} /></button>
            </div>
            <p className="mb-4 text-xs text-gray-500">Como o cliente vai pagar?</p>

            <div className="grid grid-cols-2 gap-2">
              {([
                { m: 'DINHEIRO' as MetodoPgto, label: 'Dinheiro', icon: <Banknote size={20} /> },
                { m: 'PIX' as MetodoPgto, label: 'Pix (QR na tela)', icon: <QrCode size={20} /> },
                { m: 'CREDITO' as MetodoPgto, label: 'Crédito (maquininha)', icon: <CreditCard size={20} /> },
                { m: 'DEBITO' as MetodoPgto, label: 'Débito (maquininha)', icon: <CreditCard size={20} /> },
              ]).map((op) => (
                <button key={op.m} onClick={() => { setMetodo(op.m); setErro(''); }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 text-sm font-bold transition ${metodo === op.m ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria)]' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
                  {op.icon}{op.label}
                </button>
              ))}
            </div>

            {metodo === 'DINHEIRO' && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Quanto o cliente entregou?</label>
                <input value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
                  placeholder="0,00" inputMode="decimal" autoFocus
                  className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-center text-2xl font-black outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button onClick={() => setValorRecebido(String(total))} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-bold text-gray-600 dark:border-gray-600 dark:text-gray-300">Valor exato</button>
                  {NOTAS_RAPIDAS.filter((n) => n >= total).slice(0, 3).map((n) => (
                    <button key={n} onClick={() => setValorRecebido(String(n))} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-bold text-gray-600 dark:border-gray-600 dark:text-gray-300">R$ {n}</button>
                  ))}
                </div>
                {recebidoNum >= total && (
                  <p className="mt-3 text-center text-sm font-bold text-gray-600 dark:text-gray-300">
                    Troco: <span className="text-xl font-black text-emerald-600">{fmt(troco)}</span>
                  </p>
                )}
              </div>
            )}

            {erro && <p className="mt-3 text-center text-sm font-semibold text-red-500">{erro}</p>}

            <button disabled={!metodo || processando || (metodo === 'DINHEIRO' && recebidoNum < total)}
              onClick={() => metodo && registrarVenda(metodo)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white shadow-lg disabled:opacity-40">
              {processando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {processando ? 'Registrando…' : metodo === 'PIX' ? 'Gerar QR Code Pix' : 'Confirmar recebimento'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Pix aguardando ── */}
      {etapa === 'PIX_AGUARDANDO' && pixInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
            <h3 className="text-lg font-black dark:text-gray-100">Pix de {fmt(total)}</h3>
            <p className="mt-1 text-xs text-gray-500">Peça para o cliente apontar a câmera para o QR Code.</p>
            {pixInfo.qrImagem
              ? <img src={pixInfo.qrImagem} alt="QR Code Pix" className="mx-auto mt-4 w-56 rounded-2xl border border-gray-200 dark:border-gray-700" />
              : <p className="mt-4 break-all rounded-xl bg-gray-100 p-3 font-mono text-[10px] dark:bg-gray-800 dark:text-gray-200">{pixInfo.copiaECola}</p>}
            <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-gray-500">
              <Loader2 size={13} className="animate-spin" /> Aguardando o pagamento cair… confirma sozinho.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={limparVenda} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-bold text-gray-500 dark:border-gray-700">Cancelar</button>
              <button onClick={confirmarPixRecebido} disabled={processando} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">Já caiu — confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: sucesso ── */}
      {etapa === 'SUCESSO' && venda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
              <PartyPopper size={28} />
            </div>
            <h3 className="mt-3 text-xl font-black dark:text-gray-100">Venda #{venda.numero} registrada!</h3>
            <p className="mt-1 text-sm text-gray-500">{fmt(venda.total)} · {venda.metodo === 'DINHEIRO' ? 'Dinheiro' : venda.metodo === 'PIX' ? 'Pix' : venda.metodo === 'CREDITO' ? 'Crédito' : 'Débito'} · já está na cozinha 🔥</p>
            {venda.troco > 0 && (
              <p className="mt-3 rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                Devolver troco: <span className="text-2xl font-black">{fmt(venda.troco)}</span>
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => imprimirVenda('COMANDA_COZINHA')} className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 py-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"><ChefHat size={14} /> Comanda cozinha</button>
              <button onClick={() => imprimirVenda('RECIBO_CLIENTE')} className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 py-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"><Receipt size={14} /> Nota cliente</button>
            </div>
            <button onClick={limparVenda} className="mt-3 w-full rounded-2xl bg-[var(--cor-primaria)] py-4 text-base font-black text-white shadow-lg">
              Nova venda
            </button>
          </div>
        </div>
      )}

      {/* ── Modais do caixa ── */}
      {modalCaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !salvandoCaixa && setModalCaixa(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            {modalCaixa === 'ABRIR' && (
              <>
                <h3 className="text-lg font-black dark:text-gray-100">Abrir o caixa</h3>
                <p className="mb-4 mt-1 text-xs text-gray-500">Conte o dinheiro que está na gaveta para começar o turno (fundo de troco).</p>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Fundo de troco (R$)</label>
                <input value={valorCaixa} onChange={(e) => setValorCaixa(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="0,00" inputMode="decimal" autoFocus className={`${inputCls} mt-1 text-center text-xl font-black`} />
                <button onClick={abrirTurno} disabled={salvandoCaixa} className="mt-4 w-full rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-50">
                  {salvandoCaixa ? 'Abrindo…' : 'Abrir caixa'}
                </button>
              </>
            )}
            {(modalCaixa === 'SANGRIA' || modalCaixa === 'REFORCO') && (
              <>
                <h3 className="text-lg font-black dark:text-gray-100">{modalCaixa === 'SANGRIA' ? 'Sangria (retirar dinheiro)' : 'Reforço (colocar troco)'}</h3>
                <p className="mb-4 mt-1 text-xs text-gray-500">{modalCaixa === 'SANGRIA' ? 'Retirada de dinheiro da gaveta (ex: levar para o cofre).' : 'Entrada de dinheiro na gaveta (ex: buscar mais troco).'}</p>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Valor (R$)</label>
                <input value={valorCaixa} onChange={(e) => setValorCaixa(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="0,00" inputMode="decimal" autoFocus className={`${inputCls} mt-1 text-center text-xl font-black`} />
                <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">Motivo</label>
                <input value={motivoCaixa} onChange={(e) => setMotivoCaixa(e.target.value)} placeholder={modalCaixa === 'SANGRIA' ? 'ex: depósito no cofre' : 'ex: troco do banco'} className={`${inputCls} mt-1`} />
                <button onClick={() => registrarMov(modalCaixa)} disabled={salvandoCaixa || Number(valorCaixa || 0) <= 0} className="mt-4 w-full rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-50">
                  {salvandoCaixa ? 'Registrando…' : 'Registrar'}
                </button>
              </>
            )}
            {modalCaixa === 'FECHAR' && turno && (
              <>
                <h3 className="text-lg font-black dark:text-gray-100">Fechar o caixa</h3>
                <div className="mt-3 space-y-1.5 rounded-2xl bg-gray-50 p-4 text-xs dark:bg-gray-800/50">
                  <div className="flex justify-between text-gray-500"><span>Fundo de troco</span><span>{fmt(Number(turno.fundo_troco))}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Vendas em dinheiro (balcão)</span><span>+{fmt(dinheiroTurno)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Reforços</span><span>+{fmt(reforcos)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Sangrias</span><span>-{fmt(sangrias)}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-1.5 text-sm font-black dark:border-gray-700 dark:text-gray-100"><span>Deve ter na gaveta</span><span>{fmt(dinheiroGaveta)}</span></div>
                </div>
                <label className="mt-4 block text-xs font-bold text-gray-600 dark:text-gray-300">Quanto você contou na gaveta? (R$)</label>
                <input value={valorCaixa} onChange={(e) => setValorCaixa(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="0,00" inputMode="decimal" autoFocus className={`${inputCls} mt-1 text-center text-xl font-black`} />
                {valorCaixa !== '' && (
                  <p className={`mt-2 text-center text-sm font-bold ${Math.abs(Number(valorCaixa || 0) - dinheiroGaveta) < 0.005 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Math.abs(Number(valorCaixa || 0) - dinheiroGaveta) < 0.005
                      ? '✓ Caixa bateu!'
                      : `Diferença: ${fmt(Number(valorCaixa || 0) - dinheiroGaveta)}`}
                  </p>
                )}
                <input value={obsFechamento} onChange={(e) => setObsFechamento(e.target.value)} placeholder="Observação (opcional)" className={`${inputCls} mt-3`} />
                <button onClick={fecharTurno} disabled={salvandoCaixa || valorCaixa === ''} className="mt-4 w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-black text-white disabled:opacity-50 dark:bg-gray-700">
                  {salvandoCaixa ? 'Fechando…' : 'Fechar turno'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Modal de opções (extras/adicionais) ── */
function ModalOpcoes({ produto, onConfirmar, onFechar }: {
  produto: Produto;
  onConfirmar: (opcoes: Opcao[], qtd: number, obs: string) => void;
  onFechar: () => void;
}) {
  const [selecionadas, setSelecionadas] = useState<Opcao[]>([]);
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');

  const grupos = (produto.grupos_opcoes ?? []).filter((g) => (g.opcoes ?? []).some((o) => o.disponivel));

  const alternar = (grupo: { id: string; max_escolhas: number }, opcao: Opcao) => {
    setSelecionadas((sel) => {
      const doGrupo = sel.filter((o) => o.grupo_id === grupo.id);
      const jaTem = sel.some((o) => o.id === opcao.id);
      if (jaTem) return sel.filter((o) => o.id !== opcao.id);
      if (grupo.max_escolhas === 1) return [...sel.filter((o) => o.grupo_id !== grupo.id), opcao];
      if (doGrupo.length >= grupo.max_escolhas) return sel; // limite do grupo
      return [...sel, opcao];
    });
  };

  const faltandoObrigatorio = grupos.some((g) =>
    g.min_escolhas > 0 && selecionadas.filter((o) => o.grupo_id === g.id).length < g.min_escolhas);

  const precoUnit = Number(produto.preco) + selecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-base font-black dark:text-gray-100">{produto.nome}</h3>
            <p className="text-xs text-gray-400">{fmt(Number(produto.preco))} base</p>
          </div>
          <button onClick={onFechar} className="text-gray-400"><X size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {grupos.map((g) => (
            <div key={g.id}>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {g.nome} {g.min_escolhas > 0 && <span className="text-red-500">*</span>}
                <span className="ml-1 font-semibold normal-case text-gray-400">
                  ({g.max_escolhas === 1 ? 'escolha 1' : `até ${g.max_escolhas}`})
                </span>
              </p>
              <div className="space-y-1.5">
                {(g.opcoes ?? []).filter((o) => o.disponivel).map((o) => {
                  const marcada = selecionadas.some((s) => s.id === o.id);
                  return (
                    <button key={o.id} onClick={() => alternar(g, o)}
                      className={`flex w-full items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ${marcada ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5' : 'border-gray-200 dark:border-gray-700'}`}>
                      <span className={`font-semibold ${marcada ? 'text-[var(--cor-primaria)]' : 'text-gray-700 dark:text-gray-200'}`}>{o.nome}</span>
                      <span className="text-xs font-bold text-gray-400">{Number(o.preco_adicional) > 0 ? `+${fmt(Number(o.preco_adicional))}` : 'grátis'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (ex: sem cebola)"
            className="w-full rounded-xl border border-gray-200 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button onClick={() => setQtd((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 font-black dark:bg-gray-800"><Minus size={14} /></button>
            <span className="w-6 text-center font-black dark:text-gray-100">{qtd}</span>
            <button onClick={() => setQtd((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 font-black dark:bg-gray-800"><Plus size={14} /></button>
          </div>
          <button onClick={() => onConfirmar(selecionadas, qtd, obs)} disabled={faltandoObrigatorio}
            className="flex-1 rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-40">
            Adicionar {fmt(precoUnit * qtd)}
          </button>
        </div>
      </div>
    </div>
  );
}
