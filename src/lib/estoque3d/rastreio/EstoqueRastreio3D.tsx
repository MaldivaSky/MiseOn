/**
 * Aba "Rastreio 3D" do Estoque: todos os itens ativos da loja, por categoria.
 *
 * Concentra aqui os estados de carregando/erro/vazio para que o Rastreio3D
 * só precise renderizar a prancha. Espelha o EstoqueCusto3D de propósito:
 * ele mostra a árvore por LOTE; este mostra a posição ATUAL por ITEM.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ScanLine, Boxes } from 'lucide-react';
import { carregarRastreio, type CategoriaRastreio } from './carregarRastreio';
import { Rastreio3D } from './Rastreio3D';

export function EstoqueRastreio3D({ lojaId }: { lojaId: string }) {
  const [categorias, setCategorias] = useState<CategoriaRastreio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCategorias(null);
    setErro(null);
    carregarRastreio(lojaId)
      .then((c) => vivo && setCategorias(c))
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
          <p className="font-bold text-red-800 dark:text-red-300">Não foi possível montar o rastreio 3D</p>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{erro}</p>
        </div>
      </div>
    );
  }

  if (!categorias) {
    return (
      <div className="h-[560px] rounded-2xl bg-gray-100 dark:bg-gray-800/40 animate-pulse flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Rastreando o valor do estoque…</p>
      </div>
    );
  }

  const totalItens = categorias.reduce((acc, c) => acc + c.itens.length, 0);

  if (totalItens === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-10 text-center">
        <Boxes className="mx-auto text-gray-400 mb-3" size={32} />
        <p className="font-bold dark:text-gray-200">Nenhum insumo ativo para rastrear</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          O rastreio 3D aparece quando há itens cadastrados no estoque. Cadastre o primeiro insumo em
          &quot;Matérias-Primas&quot; para ver o valor da compra se subdividir até a unidade de uso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-bold dark:text-gray-100 flex items-center gap-2">
          <ScanLine size={18} className="text-emerald-500" /> Rastreio 3D do estoque
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
          Todos os itens por categoria: o valor da compra subdividido até a unidade de uso. ⚠️ marca
          etapas humanas (rendimento declarado); itens em vermelho estão críticos ou com desvio de
          custo ≥ 15%.
        </p>
      </div>

      <Rastreio3D categorias={categorias} altura={560} />
    </div>
  );
}

export default EstoqueRastreio3D;
