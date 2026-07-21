/**
 * Aba "Rastreio 3D" do Estoque: carrega o grafo real da loja, extrai as
 * cadeias rastreáveis e as entrega ao palco WebGL. Concentra aqui os estados
 * de carregando/erro/vazio para que o JogoTransformacao3D só precise renderizar
 * a linha de transformação.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Workflow } from 'lucide-react';
import { carregarGrafoDaLoja } from '../carregarGrafo';
import { extrairCadeias } from './cadeiaJogo';
import { JogoTransformacao3D } from './JogoTransformacao3D';
import type { GrafoCusto } from '../types';

export function EstoqueJogo3D({ lojaId }: { lojaId: string }) {
  const [grafo, setGrafo] = useState<GrafoCusto | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  const cadeias = useMemo(() => (grafo ? extrairCadeias(grafo) : []), [grafo]);
  // Cadeia rastreável = tem ao menos 1 porta (compra direta sem quebra não tem
  // jornada para contar — ela aparece na árvore de custo, não aqui).
  const aptas = useMemo(() => cadeias.filter((c) => c.portas.length > 0), [cadeias]);

  if (erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:bg-red-900/20 dark:border-red-900/50 flex items-start gap-3">
        <AlertTriangle className="text-red-500 shrink-0" size={20} />
        <div>
          <p className="font-bold text-red-800 dark:text-red-300">Não foi possível montar a linha de rastreio</p>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{erro}</p>
        </div>
      </div>
    );
  }

  if (!grafo) {
    return (
      <div className="h-[560px] rounded-2xl bg-gray-100 dark:bg-gray-800/40 animate-pulse flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Montando a linha de rastreio…</p>
      </div>
    );
  }

  if (aptas.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-10 text-center">
        <Workflow className="mx-auto text-gray-400 mb-3" size={32} />
        <p className="font-bold dark:text-gray-200">Nenhuma cadeia de custo para rastrear ainda</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          O rastreio aparece quando uma compra tem rendimento ou quebra registrados (ex.: caixa → kg →
          unidade → fatias). Cadastre o rendimento no insumo e registre uma entrada com custo em
          "+ Entrada" para acompanhar o valor se subdividir.
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
            <Workflow size={18} className="text-emerald-500" /> Rastreabilidade de custo em 3D
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Acompanhe como o valor da compra se subdivide até o item de uso. Etapas humanas ficam
            bloqueadas até o registro — como na operação real.
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

      <JogoTransformacao3D cadeias={aptas} altura={560} />
    </div>
  );
}

export default EstoqueJogo3D;
