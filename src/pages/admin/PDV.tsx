import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, X, Plus, Minus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fmt, precoItem, type Produto, type Opcao, type ItemCarrinho, type Loja, type Mesa,
  type CaixaTurno, type CaixaMovimentacao, type MetodoPgto,
} from '../../types';
import { imprimir } from '../../lib/print';
import { obterOuCriarComandaAberta } from '../../lib/comandas';
import type { CtxLoja } from './AdminLayout';

import { HeaderBar } from '../../components/pdv/HeaderBar';
import { ProductGrid } from '../../components/pdv/ProductGrid';
import { CartSidebar } from '../../components/pdv/CartSidebar';
import { PaymentModal } from '../../components/pdv/PaymentModal';
import { OrderSuccessModal } from '../../components/pdv/OrderSuccessModal';
import { CaixaModal } from '../../components/pdv/CaixaModal';
import { ModalOpcoes } from '../../components/pdv/ModalOpcoes';

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
        requer_cozinha: false, // trigger promove p/ true se algum item for COZINHA
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
        // ACEITO dispara a baixa de estoque (fluxo passa-bastão: só vai pra
        // cozinha quando o balcão enviar explicitamente, se requer_cozinha)
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
        requer_cozinha: false, // trigger promove p/ true se algum item for COZINHA
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

    // Timeout de 5 minutos (300.000 ms) para liberar o PDV se não for pago
    const timeoutLimpeza = setTimeout(() => {
      limparVenda();
      setErro('Tempo limite de 5 minutos excedido para o pagamento do Pix.');
    }, 5 * 60 * 1000);

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
    return () => { 
      clearTimeout(timeoutLimpeza);
      supabase.removeChannel(canal); 
    };
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

  const propsCaixaModal = {
    modalCaixa, setModalCaixa, salvandoCaixa: processando, valorCaixa, setValorCaixa,
    motivoCaixa: valorRecebido, setMotivoCaixa: setValorRecebido, // reaproveitamos state
    obsFechamento: erro, setObsFechamento: setErro, // reaproveitando state
    turno, dinheiroTurno, reforcos, sangrias, dinheiroGaveta,
    abrirTurno, registrarMov, fecharTurno
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col lg:h-screen">
      <HeaderBar
        modo={modo}
        setModo={setModo}
        turno={turno}
        dinheiroGaveta={dinheiroGaveta}
        setModalCaixa={setModalCaixa}
        setValorCaixa={setValorCaixa}
      />

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
        <ProductGrid
          busca={busca}
          setBusca={setBusca}
          categorias={categorias}
          catAtiva={catAtiva}
          setCatAtiva={setCatAtiva}
          produtosVisiveis={produtosVisiveis}
          tocarProduto={tocarProduto}
        />

        <CartSidebar
          carrinho={carrinho}
          limparVenda={limparVenda}
          mudarQtd={mudarQtd}
          removerItem={(idx) => setCarrinho((c) => c.filter((_, x) => x !== idx))}
          nomeCliente={nomeCliente}
          setNomeCliente={setNomeCliente}
          desconto={desconto}
          setDesconto={setDesconto}
          subtotal={subtotal}
          descontoNum={descontoNum}
          total={total}
          erro={erro}
          modo={modo}
          turno={turno}
          mesaSelecionada={mesaSelecionada}
          enviandoMesa={enviandoMesa}
          setEtapa={setEtapa}
          setMetodo={setMetodo}
          setErro={setErro}
          enviarParaMesa={enviarParaMesa}
        />
      </div>

      {/* ── Modal: opções do produto ── */}
      {escolhendo && (
        <ModalOpcoes produto={escolhendo} onFechar={() => setEscolhendo(null)}
          onConfirmar={(opcoes, qtd, obs) => { adicionarProduto(escolhendo, opcoes, qtd, obs); setEscolhendo(null); }} />
      )}

      {/* ── Modal: pagamento ── */}
      {etapa === 'PAGANDO' && (
        <PaymentModal
          total={total}
          metodo={metodo}
          setMetodo={setMetodo}
          setErro={setErro}
          valorRecebido={valorRecebido}
          setValorRecebido={setValorRecebido}
          recebidoNum={recebidoNum}
          troco={troco}
          erro={erro}
          processando={processando}
          registrarVenda={registrarVenda}
          setEtapa={setEtapa}
        />
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
              Aguardando o pagamento cair… confirma sozinho.
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
        <OrderSuccessModal
          venda={venda}
          imprimirVenda={imprimirVenda}
          limparVenda={limparVenda}
        />
      )}

      {/* ── Modais do caixa ── */}
      {modalCaixa && (
        <CaixaModal {...propsCaixaModal} />
      )}
    </div>
  );
}


