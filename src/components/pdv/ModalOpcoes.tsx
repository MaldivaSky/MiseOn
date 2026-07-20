import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { fmt, type Produto, type Opcao } from '../../types';

export function ModalOpcoes({ produto, onConfirmar, onFechar }: {
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
