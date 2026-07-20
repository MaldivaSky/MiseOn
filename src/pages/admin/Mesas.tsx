import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  LayoutGrid, Plus, QrCode, X, Users, Clock, Check, Banknote, CreditCard,
  Trash2, Printer, AlertTriangle, Loader2, Copy, Percent,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, type Mesa, type Comanda, type Pedido, type Loja, type MetodoPgto } from '../../types';
import { gerarQrDataUrl } from '../../lib/qr';
import { imprimir } from '../../lib/print';
import type { CtxLoja } from './AdminLayout';

/* ─────────────────────────────────────────────────────────────
   Mapa de Mesas — visão do salão para o garçom/gerente.
   Cada mesa "ocupada" tem uma comanda ABERTA que agrupa N
   pedidos (rodadas). Fechar a conta soma tudo, aplica a taxa
   de serviço e gera um pagamento por pedido (mesmo padrão do
   resto do sistema — sem mexer no schema de pagamentos).
   ───────────────────────────────────────────────────────────── */

const METODOS: { m: MetodoPgto; label: string; icon: typeof Banknote }[] = [
  { m: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
  { m: 'PIX', label: 'Pix (chave da loja)', icon: QrCode },
  { m: 'CREDITO', label: 'Crédito (maquininha)', icon: CreditCard },
  { m: 'DEBITO', label: 'Débito (maquininha)', icon: CreditCard },
];

const STATUS_EM_PREPARO: Pedido['status'][] = ['NOVO', 'ACEITO', 'PREPARANDO'];

interface MesaComComanda extends Mesa {
  comanda?: Comanda;
  totalParcial: number;
  qtdItens: number;
  temItemEmPreparo: boolean;
}

function minutosDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function Mesas() {
  const { lojaId, lojaSlug } = useOutletContext<CtxLoja>();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [mesas, setMesas] = useState<MesaComComanda[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalNovaMesa, setModalNovaMesa] = useState(false);
  const [novoNumero, setNovoNumero] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaCapacidade, setNovaCapacidade] = useState('');
  const [salvandoMesa, setSalvandoMesa] = useState(false);

  const [mesaQr, setMesaQr] = useState<Mesa | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const [mesaDetalhe, setMesaDetalhe] = useState<MesaComComanda | null>(null);
  const [pedidosComanda, setPedidosComanda] = useState<Pedido[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [taxaEditavel, setTaxaEditavel] = useState('0');
  const [fechando, setFechando] = useState<MetodoPgto | null>(null);
  const [valorRecebido, setValorRecebido] = useState('');
  const [erroFechamento, setErroFechamento] = useState('');
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  const carregar = async () => {
    const [{ data: mesasData }, { data: lj }, { data: comandas }] = await Promise.all([
      supabase.from('mesas').select('*').eq('loja_id', lojaId).eq('ativo', true).order('numero'),
      supabase.from('lojas').select('*').eq('id', lojaId).single(),
      supabase.from('comandas').select('*').eq('loja_id', lojaId).eq('status', 'ABERTA'),
    ]);
    setLoja((lj as Loja) ?? null);

    const comandaPorMesa = new Map((comandas as Comanda[] ?? []).map((c) => [c.mesa_id, c]));
    const comandaIds = (comandas ?? []).map((c: any) => c.id);

    const pedidosPorComanda = new Map<string, { total: number; qtd: number; emPreparo: boolean }>();
    if (comandaIds.length > 0) {
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('comanda_id, status, valor_total, itens_pedido(quantidade)')
        .in('comanda_id', comandaIds)
        .neq('status', 'CANCELADO');
      for (const p of (pedidos as any[]) ?? []) {
        const atual = pedidosPorComanda.get(p.comanda_id) ?? { total: 0, qtd: 0, emPreparo: false };
        atual.total += Number(p.valor_total);
        atual.qtd += (p.itens_pedido ?? []).reduce((s: number, i: any) => s + i.quantidade, 0);
        if (STATUS_EM_PREPARO.includes(p.status)) atual.emPreparo = true;
        pedidosPorComanda.set(p.comanda_id, atual);
      }
    }

    setMesas(((mesasData as Mesa[]) ?? []).map((m) => {
      const comanda = comandaPorMesa.get(m.id);
      const agregado = comanda ? pedidosPorComanda.get(comanda.id) : undefined;
      return {
        ...m,
        comanda,
        totalParcial: agregado?.total ?? 0,
        qtdItens: agregado?.qtd ?? 0,
        temItemEmPreparo: agregado?.emPreparo ?? false,
      };
    }));
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel(`mesas-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId]);

  const livres = mesas.filter((m) => !m.comanda);
  const ocupadas = mesas.filter((m) => !!m.comanda);

  /* ── criar mesa ── */
  const criarMesa = async () => {
    if (!novoNumero.trim()) return;
    setSalvandoMesa(true);
    const { error } = await supabase.from('mesas').insert({
      loja_id: lojaId,
      numero: Number(novoNumero),
      nome: novoNome.trim() || null,
      capacidade: novaCapacidade ? Number(novaCapacidade) : null,
    });
    setSalvandoMesa(false);
    if (error) { alert('Erro ao criar mesa: ' + (error.message.includes('duplicate') ? 'já existe uma mesa com esse número.' : error.message)); return; }
    setModalNovaMesa(false); setNovoNumero(''); setNovoNome(''); setNovaCapacidade('');
    carregar();
  };

  const excluirMesa = async (mesa: MesaComComanda) => {
    if (mesa.comanda) return alert('Essa mesa está com uma comanda aberta — feche a conta antes de excluir.');
    if (!confirm(`Remover a Mesa ${mesa.numero}?`)) return;
    await supabase.from('mesas').update({ ativo: false }).eq('id', mesa.id);
    carregar();
  };

  /* ── QR da mesa ── */
  const abrirQr = async (mesa: Mesa) => {
    setMesaQr(mesa);
    const url = `${window.location.origin}/${lojaSlug}?mesa=${mesa.numero}`;
    setQrDataUrl(await gerarQrDataUrl(url));
  };

  const imprimirQr = () => {
    if (!mesaQr || !qrDataUrl) return;
    const janela = window.open('', '_blank', 'width=420,height=560');
    if (!janela) return;
    janela.document.write(`
      <html><head><title>QR Mesa ${mesaQr.numero}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
        .card { border: 3px solid #111; border-radius: 20px; padding: 28px; text-align:center; width: 320px; }
        h1 { font-size: 42px; margin: 0 0 4px; }
        p { color:#444; font-size:13px; margin: 4px 0 18px; }
        img { width: 240px; height: 240px; }
        .rodape { margin-top: 16px; font-size: 11px; color:#888; letter-spacing: 2px; text-transform: uppercase; }
      </style></head>
      <body>
        <div class="card">
          <p style="text-transform:uppercase;font-weight:700;letter-spacing:2px;">Mesa</p>
          <h1>${mesaQr.numero}</h1>
          <p>Aponte a câmera do celular<br/>para ver o cardápio e pedir</p>
          <img src="${qrDataUrl}" />
          <div class="rodape">MiseOn</div>
        </div>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    janela.document.close();
  };

  /* ── detalhe da mesa / comanda ── */
  const abrirDetalhe = async (mesa: MesaComComanda) => {
    setMesaDetalhe(mesa);
    setErroFechamento(''); setFechando(null); setValorRecebido('');
    setTaxaEditavel(String(loja?.taxa_servico_padrao_pct ?? mesa.comanda?.taxa_servico_pct ?? 0));
    if (!mesa.comanda) { setPedidosComanda([]); return; }
    setCarregandoDetalhe(true);
    const { data } = await supabase
      .from('pedidos')
      .select('id, numero, status, valor_total, criado_em, itens_pedido(id, nome_produto, quantidade, preco_unitario, observacao, itens_pedido_opcoes(nome_opcao, preco_adicional))')
      .eq('comanda_id', mesa.comanda.id)
      .neq('status', 'CANCELADO')
      .order('criado_em');
    setPedidosComanda((data as unknown as Pedido[]) ?? []);
    setCarregandoDetalhe(false);
  };

  const subtotalComanda = useMemo(() => pedidosComanda.reduce((s, p) => s + Number(p.valor_total), 0), [pedidosComanda]);
  const valorServico = subtotalComanda * (Number(taxaEditavel || 0) / 100);
  const totalComanda = subtotalComanda + valorServico;
  const bloqueadoPorPreparo = pedidosComanda.some((p) => STATUS_EM_PREPARO.includes(p.status));
  const recebidoNum = Number(valorRecebido || 0);
  const trocoFechamento = fechando === 'DINHEIRO' ? Math.max(0, recebidoNum - totalComanda) : 0;

  const confirmarFechamento = async (metodo: MetodoPgto) => {
    if (!mesaDetalhe?.comanda || pedidosComanda.length === 0) return;
    if (bloqueadoPorPreparo) { setErroFechamento('Ainda tem item sendo preparado — aguarde ficar pronto antes de fechar.'); return; }
    if (metodo === 'DINHEIRO' && recebidoNum < totalComanda) { setErroFechamento('Valor recebido menor que o total.'); return; }
    setProcessandoFechamento(true); setErroFechamento('');
    try {
      const comanda = mesaDetalhe.comanda;
      const pedidoFechamento = [...pedidosComanda].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];

      if (valorServico > 0) {
        await supabase.from('pedidos').update({ valor_total: Number(pedidoFechamento.valor_total) + valorServico }).eq('id', pedidoFechamento.id);
      }

      for (const p of pedidosComanda) {
        const valorFinal = p.id === pedidoFechamento.id ? Number(p.valor_total) + valorServico : Number(p.valor_total);
        await supabase.from('pagamentos').insert({
          pedido_id: p.id, metodo, valor_pago: valorFinal, status: 'PAGO', data_pagamento: new Date().toISOString(),
        });
      }

      await supabase.from('pedidos').update({ status: 'FINALIZADO' })
        .eq('comanda_id', comanda.id).not('status', 'in', '(CANCELADO,FINALIZADO)');

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('comandas').update({
        status: 'FECHADA', fechada_em: new Date().toISOString(), fechada_por: user?.id ?? null,
        metodo_pagamento: metodo, valor_servico: valorServico, taxa_servico_pct: Number(taxaEditavel || 0),
      }).eq('id', comanda.id);

      imprimir({
        template: 'CONTA_MESA',
        lojaNome: loja?.nome || 'MiseOn',
        loja,
        contaMesa: {
          mesaNumero: mesaDetalhe.numero,
          numerosPedidos: pedidosComanda.map((p) => p.numero),
          itens: pedidosComanda.flatMap((p) => (p.itens_pedido ?? []).map((i) => ({
            nome_produto: i.nome_produto, quantidade: i.quantidade, preco_unitario: Number(i.preco_unitario),
            opcoes: i.itens_pedido_opcoes?.map((o) => ({ nome_opcao: o.nome_opcao, preco_adicional: Number(o.preco_adicional) })),
          }))),
          subtotal: subtotalComanda,
          taxaServicoPct: Number(taxaEditavel || 0),
          valorServico,
          total: totalComanda,
          metodoPagamento: METODOS.find((x) => x.m === metodo)?.label.split(' (')[0],
        },
      });

      setMesaDetalhe(null);
      carregar();
    } catch (e) {
      console.error(e);
      setErroFechamento('Erro ao fechar a conta: ' + String((e as Error)?.message ?? e));
    }
    setProcessandoFechamento(false);
  };

  const imprimirPreviaConta = () => {
    if (!mesaDetalhe || pedidosComanda.length === 0) return;
    imprimir({
      template: 'CONTA_MESA',
      lojaNome: loja?.nome || 'MiseOn',
      loja,
      contaMesa: {
        mesaNumero: mesaDetalhe.numero,
        numerosPedidos: pedidosComanda.map((p) => p.numero),
        itens: pedidosComanda.flatMap((p) => (p.itens_pedido ?? []).map((i) => ({
          nome_produto: i.nome_produto, quantidade: i.quantidade, preco_unitario: Number(i.preco_unitario),
          opcoes: i.itens_pedido_opcoes?.map((o) => ({ nome_opcao: o.nome_opcao, preco_adicional: Number(o.preco_adicional) })),
        }))),
        subtotal: subtotalComanda,
        taxaServicoPct: Number(taxaEditavel || 0),
        valorServico,
        total: totalComanda,
      },
    });
  };

  const inputCls = 'w-full rounded-xl border border-gray-300 p-2.5 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando o salão…</div>;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-12">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black dark:text-gray-100"><LayoutGrid size={20} className="text-[var(--cor-primaria)]" /> Mapa de Mesas</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{ocupadas.length} ocupada{ocupadas.length !== 1 ? 's' : ''} · {livres.length} livre{livres.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModalNovaMesa(true)} className="flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110">
          <Plus size={16} /> Nova mesa
        </button>
      </div>

      {mesas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
          <LayoutGrid size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">Nenhuma mesa cadastrada ainda.</p>
          <p className="mt-1 text-xs text-gray-400">Crie suas mesas e gere o QR Code para os clientes pedirem direto de onde estão sentados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {mesas.map((m) => {
            const ocupada = !!m.comanda;
            const min = m.comanda ? minutosDesde(m.comanda.aberta_em) : 0;
            return (
              <div key={m.id}
                className={`group relative overflow-hidden rounded-2xl border-2 p-4 shadow-sm transition ${ocupada ? 'border-orange-400 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-900/10' : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
                <button onClick={() => abrirDetalhe(m)} className="block w-full text-left">
                  <div className="flex items-start justify-between">
                    <span className="font-['Sora'] text-2xl font-black dark:text-gray-100">{m.numero}</span>
                    {ocupada
                      ? <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">OCUPADA</span>
                      : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">LIVRE</span>}
                  </div>
                  {m.nome && <p className="mt-0.5 truncate text-[11px] text-gray-400">{m.nome}</p>}
                  {m.capacidade && <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400"><Users size={11} /> {m.capacidade} lugares</p>}
                  {ocupada ? (
                    <div className="mt-3 border-t border-orange-200 pt-2 dark:border-orange-900/40">
                      <p className="text-lg font-black text-orange-600 dark:text-orange-400">{fmt(m.totalParcial)}</p>
                      <p className="flex items-center gap-1 text-[11px] text-gray-500"><Clock size={10} /> {min}min · {m.qtdItens} item(ns){m.temItemEmPreparo ? ' · preparando' : ''}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-gray-400">Toque para abrir a conta</p>
                  )}
                </button>
                <div className="mt-2 flex gap-1.5 border-t border-gray-100 pt-2 dark:border-gray-800">
                  <button onClick={() => abrirQr(m)} className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"><QrCode size={12} /> QR Code</button>
                  {!ocupada && (
                    <button onClick={() => excluirMesa(m)} className="rounded-lg px-2 py-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><Trash2 size={12} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: nova mesa ── */}
      {modalNovaMesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !salvandoMesa && setModalNovaMesa(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black dark:text-gray-100">Nova mesa</h3>
              <button onClick={() => setModalNovaMesa(false)} className="text-gray-400"><X size={20} /></button>
            </div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Número da mesa *</label>
            <input value={novoNumero} onChange={(e) => setNovoNumero(e.target.value.replace(/\D/g, ''))} placeholder="ex: 5" inputMode="numeric" autoFocus className={`${inputCls} mt-1 text-center text-xl font-black`} />
            <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">Nome (opcional)</label>
            <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="ex: Varanda" className={`${inputCls} mt-1`} />
            <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">Lugares (opcional)</label>
            <input value={novaCapacidade} onChange={(e) => setNovaCapacidade(e.target.value.replace(/\D/g, ''))} placeholder="ex: 4" inputMode="numeric" className={`${inputCls} mt-1`} />
            <button onClick={criarMesa} disabled={salvandoMesa || !novoNumero.trim()} className="mt-4 w-full rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-50">
              {salvandoMesa ? 'Criando…' : 'Criar mesa'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: QR da mesa ── */}
      {mesaQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setMesaQr(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black dark:text-gray-100">QR · Mesa {mesaQr.numero}</h3>
              <button onClick={() => setMesaQr(null)} className="text-gray-400"><X size={20} /></button>
            </div>
            {qrDataUrl
              ? <img src={qrDataUrl} alt={`QR Mesa ${mesaQr.numero}`} className="mx-auto w-56 rounded-2xl border border-gray-200 dark:border-gray-700" />
              : <div className="flex h-56 items-center justify-center"><Loader2 className="animate-spin text-gray-300" /></div>}
            <p className="mt-3 text-xs text-gray-500">O cliente aponta a câmera e cai direto no cardápio, já identificado como Mesa {mesaQr.numero} — sem precisar criar login.</p>
            <button onClick={imprimirQr} disabled={!qrDataUrl} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-50">
              <Printer size={16} /> Imprimir para a mesa
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: detalhe da mesa / fechar conta ── */}
      {mesaDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !processandoFechamento && setMesaDetalhe(null)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-lg font-black dark:text-gray-100">Mesa {mesaDetalhe.numero}</h3>
              <button onClick={() => setMesaDetalhe(null)} className="text-gray-400"><X size={20} /></button>
            </div>

            {!mesaDetalhe.comanda ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500">Essa mesa está livre — sem comanda aberta.</p>
                <p className="mt-1 text-xs text-gray-400">Gere o QR Code para o cliente pedir, ou use o PDV em modo mesa para lançar o primeiro pedido.</p>
              </div>
            ) : carregandoDetalhe ? (
              <div className="p-8 text-center text-sm text-gray-400">Carregando comanda…</div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5">
                  {bloqueadoPorPreparo && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">
                      <AlertTriangle size={14} /> Ainda tem item sendo preparado — a conta libera para fechar quando tudo estiver pronto.
                    </div>
                  )}
                  <div className="space-y-3">
                    {pedidosComanda.map((p) => (
                      <div key={p.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-gray-400">Pedido #{p.numero}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_EM_PREPARO.includes(p.status) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{p.status}</span>
                        </div>
                        {p.itens_pedido?.map((i) => (
                          <div key={i.id} className="flex justify-between text-[13px]">
                            <span className="text-gray-600 dark:text-gray-300">{i.quantidade}× {i.nome_produto}</span>
                            <span className="font-semibold dark:text-gray-200">{fmt(Number(i.preco_unitario) * i.quantidade)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 p-5 dark:border-gray-800">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300"><Percent size={12} /> Taxa de serviço</label>
                    <div className="flex items-center gap-1">
                      <input value={taxaEditavel} onChange={(e) => setTaxaEditavel(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} className="w-14 rounded-lg border border-gray-300 p-1.5 text-center text-xs font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                      <span className="text-xs font-bold text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-gray-500">
                    <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotalComanda)}</span></div>
                    {valorServico > 0 && <div className="flex justify-between"><span>Taxa de serviço</span><span>{fmt(valorServico)}</span></div>}
                    <div className="flex justify-between text-lg font-black dark:text-gray-100"><span>Total</span><span className="text-[var(--cor-primaria)]">{fmt(totalComanda)}</span></div>
                  </div>

                  <button onClick={imprimirPreviaConta} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5">
                    <Printer size={13} /> Imprimir conta (antes de cobrar)
                  </button>

                  {!fechando ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {METODOS.map((op) => (
                        <button key={op.m} onClick={() => { setFechando(op.m); setErroFechamento(''); }} disabled={bloqueadoPorPreparo}
                          className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-gray-200 p-3 text-xs font-bold text-gray-600 transition hover:border-[var(--cor-primaria)] hover:text-[var(--cor-primaria)] disabled:opacity-40 dark:border-gray-700 dark:text-gray-300">
                          <op.icon size={18} />{op.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-black dark:text-gray-100">{METODOS.find((m) => m.m === fechando)?.label}</p>
                        <button onClick={() => setFechando(null)} className="text-xs font-bold text-gray-400">trocar</button>
                      </div>
                      {fechando === 'DINHEIRO' && (
                        <>
                          <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Quanto o cliente entregou?</label>
                          <input value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder={fmt(totalComanda)} inputMode="decimal" autoFocus
                            className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-center text-xl font-black outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                          {recebidoNum >= totalComanda && recebidoNum > 0 && (
                            <p className="mt-2 text-center text-sm font-bold text-gray-600 dark:text-gray-300">Troco: <span className="text-lg font-black text-emerald-600">{fmt(trocoFechamento)}</span></p>
                          )}
                        </>
                      )}
                      {fechando === 'PIX' && (
                        <div className="text-center">
                          {loja?.pix_chave ? (
                            <>
                              <p className="text-xs text-gray-500">Peça para o cliente pagar {fmt(totalComanda)} nesta chave:</p>
                              <p className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 font-mono text-sm font-bold dark:bg-gray-950 dark:text-gray-100">
                                {loja.pix_chave} <Copy size={13} className="cursor-pointer text-gray-400" onClick={() => navigator.clipboard.writeText(loja.pix_chave!)} />
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-amber-600">Cadastre a chave Pix da loja em Configurações → Pagamentos para mostrar aqui.</p>
                          )}
                          <p className="mt-2 text-[11px] text-gray-400">Confirme abaixo assim que o Pix cair.</p>
                        </div>
                      )}
                      {(fechando === 'CREDITO' || fechando === 'DEBITO') && (
                        <p className="text-center text-xs text-gray-500">Passe {fmt(totalComanda)} na maquininha e confirme abaixo.</p>
                      )}

                      {erroFechamento && <p className="mt-2 text-center text-xs font-semibold text-red-500">{erroFechamento}</p>}

                      <button onClick={() => confirmarFechamento(fechando)} disabled={processandoFechamento || (fechando === 'DINHEIRO' && recebidoNum < totalComanda)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white disabled:opacity-40">
                        {processandoFechamento ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        {processandoFechamento ? 'Fechando…' : 'Confirmar e fechar conta'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
