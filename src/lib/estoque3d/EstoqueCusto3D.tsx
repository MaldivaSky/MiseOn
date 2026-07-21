/**
 * Aba "Custo 3D" do Estoque: carrega o grafo real da loja e o entrega ao
 * renderizador WebGL. Concentra aqui os estados de carregando/erro/vazio para
 * que o CostGraph3D só precise saber desenhar.
 */

import { useEffect, useState } from 'react';
import { Boxes, AlertTriangle } from 'lucide-react';
import { CostGraph3D } from './CostGraph3D';
import { carregarGrafoDaLoja } from './carregarGrafo';
import type { GrafoCusto, NoCusto } from './types';

export function EstoqueCusto3D({ lojaId }: { lojaId: string }) {
  const [grafo, setGrafo] = useState<GrafoCusto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<NoCusto | null>(null);

  useEffect(() => {
    let vivo = true;
    setGrafo(null);
    setErro(null);
    carregarGrafoDaLoja(lojaId)
      .then((g) => vivo && setGrafo(g))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [lojaId]);

  if (erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:bg-red-900/20 dark:border-red-900/50 flex items-start gap-3">
        <AlertTriangle className="text-red-500 shrink-0" size={20} />
        <div>
          <p className="font-bold text-red-800 dark:text-red-300">Não foi possível montar o grafo</p>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{erro}</p>
        </div>
      </div>
    );
  }

  if (!grafo) {
    return (
      <div className="h-[520px] rounded-2xl bg-gray-100 dark:bg-gray-800/40 animate-pulse flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Montando a árvore de custos…</p>
      </div>
    );
  }

  if (grafo.nos.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-10 text-center">
        <Boxes className="mx-auto text-gray-400 mb-3" size={32} />
        <p className="font-bold dark:text-gray-200">Nenhum lote com custo ainda</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          A árvore aparece quando houver entradas de estoque com preço informado.
          Registre uma entrada em "+ Entrada" para ver o custo se ramificar.
        </p>
      </div>
    );
  }

  const totalInvestido = grafo.raizes.reduce((a, r) => a + r.custoAlocado, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold dark:text-gray-100 flex items-center gap-2">
            <Boxes size={18} className="text-blue-500" /> Árvore de custo dos insumos
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Cada esfera é um lote ou uma fração dele. O tamanho é a quantidade; a cor, o custo por
            unidade. Passe o mouse para ver a rota do custo.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400">
            Investido em estoque
          </p>
          <p className="text-lg font-black text-green-700 dark:text-green-400">
            {totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      <CostGraph3D grafo={grafo} altura={520} onSelecionar={setSelecionado} />

      {selecionado && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Selecionado: <b>{selecionado.rotulo}</b> — {selecionado.quantidade} {selecionado.unidade} a{' '}
          {selecionado.custoUnitario.toLocaleString('pt-BR', {
            style: 'currency', currency: 'BRL', maximumFractionDigits: 4,
          })}
          /{selecionado.unidade}
        </p>
      )}
    </div>
  );
}

export default EstoqueCusto3D;
