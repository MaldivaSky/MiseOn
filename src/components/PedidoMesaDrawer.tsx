import { useState } from 'react';
import { X, Check, Loader2, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { obterOuCriarComandaAberta } from '../lib/comandas';
import { fmt, precoItem, type Loja, type Mesa, type ItemCarrinho } from '../types';

/* ─────────────────────────────────────────────────────────────
   Pedido da mesa — versão enxuta do checkout para quem escaneou
   o QR e está pedindo direto de onde está sentado.
   Sem login, sem endereço, sem pagamento (a conta fecha no final,
   com o garçom). Cada envio vira uma nova rodada na mesma comanda.
   ───────────────────────────────────────────────────────────── */

interface Props {
  loja: Loja;
  mesa: Mesa;
  carrinho: ItemCarrinho[];
  setCarrinho: (c: ItemCarrinho[]) => void;
  onClose: () => void;
  onSucesso: (numero: number) => void;
}

export default function PedidoMesaDrawer({ loja, mesa, carrinho, setCarrinho, onClose, onSucesso }: Props) {
  const chaveNome = `miseon_nome_mesa_${loja.slug}`;
  const [nome, setNome] = useState(() => localStorage.getItem(chaveNome) ?? '');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const subtotal = carrinho.reduce((s, i) => s + precoItem(i), 0);

  const enviar = async () => {
    if (carrinho.length === 0) return;
    setEnviando(true); setErro('');
    try {
      if (nome.trim()) localStorage.setItem(chaveNome, nome.trim());
      const comandaId = await obterOuCriarComandaAberta(loja.id, mesa.id);

      const { data: pedido, error: erroPedido } = await supabase.from('pedidos').insert({
        loja_id: loja.id,
        tipo_pedido: 'SALAO',
        origem: 'mesa',
        comanda_id: comandaId,
        mesa_numero: mesa.numero,
        identificador_cliente: nome.trim() || `Mesa ${mesa.numero}`,
        subtotal, valor_total: subtotal,
        observacao: observacao.trim() || null,
      }).select('id, numero').single();
      if (erroPedido || !pedido) throw erroPedido ?? new Error('Falha ao enviar o pedido');

      for (const item of carrinho) {
        const { data: it, error: erroItem } = await supabase.from('itens_pedido').insert({
          pedido_id: pedido.id,
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          preco_unitario: Number(item.produto.preco) + item.opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0),
          quantidade: item.quantidade,
          observacao: item.observacao ?? null,
        }).select('id').single();
        if (erroItem || !it) throw erroItem ?? new Error(`Falha ao registrar ${item.produto.nome}`);
        if (item.opcoesSelecionadas.length > 0) {
          const { error: erroOpcoes } = await supabase.from('itens_pedido_opcoes').insert(
            item.opcoesSelecionadas.map((o) => ({ item_id: it.id, opcao_id: o.id, nome_opcao: o.nome, preco_adicional: o.preco_adicional })),
          );
          if (erroOpcoes) throw erroOpcoes;
        }
      }

      setCarrinho([]);
      onSucesso(pedido.numero);
    } catch (e) {
      console.error(e);
      setErro('Não deu para enviar o pedido: ' + String((e as Error)?.message ?? e));
    }
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={() => !enviando && onClose()}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
        style={{ background: 'var(--cor-card)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 font-black" style={{ color: 'var(--cor-texto)' }}>
            <UtensilsCrossed size={18} style={{ color: 'var(--cor-primaria)' }} /> Enviar para a Mesa {mesa.numero}
          </p>
          <button onClick={onClose} style={{ color: 'var(--cor-texto-fraco)' }}><X size={20} /></button>
        </div>

        <div className="mb-4 space-y-1.5 rounded-2xl border p-3" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
          {carrinho.map((i, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span style={{ color: 'var(--cor-texto-suave)' }}>{i.quantidade}× {i.produto.nome}</span>
              <span className="font-bold" style={{ color: 'var(--cor-texto)' }}>{fmt(precoItem(i))}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1.5 text-sm font-black" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }}>
            <span>Total</span><span style={{ color: 'var(--cor-primaria)' }}>{fmt(subtotal)}</span>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--cor-texto-suave)' }}>Seu nome (opcional)</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: João"
            className="mt-1 w-full rounded-xl border p-2.5 text-sm outline-none"
            style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }} />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-semibold" style={{ color: 'var(--cor-texto-suave)' }}>Observação (opcional)</span>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="ex: sem cebola, ponto da carne…"
            className="mt-1 w-full rounded-xl border p-2.5 text-sm outline-none"
            style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }} />
        </label>

        <p className="mt-3 text-[11px]" style={{ color: 'var(--cor-texto-fraco)' }}>
          A conta é fechada pelo garçom no final — não é preciso pagar agora.
        </p>

        {erro && <p className="mt-2 text-sm font-semibold text-red-500">{erro}</p>}

        <button onClick={enviar} disabled={enviando || carrinho.length === 0}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50"
          style={{ background: 'var(--cor-primaria)' }}>
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {enviando ? 'Enviando…' : `Enviar pedido para a Mesa ${mesa.numero}`}
        </button>
      </div>
    </div>
  );
}
