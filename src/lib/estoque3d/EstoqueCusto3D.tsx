/**
 * Aba "Custo 3D" do Estoque: carrega o grafo real da loja e o entrega ao
 * renderizador WebGL. Concentra aqui os estados de carregando/erro/vazio para
 * que o CostGraph3D só precise saber desenhar.
 *
 * Realtime: o grafo se reconstrói automaticamente sempre que houver
 * qualquer mudança em `insumos` ou `lotes_estoque` da loja — sem
 * necessidade de recarregar a página.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';
import { CostGraph3D } from './CostGraph3D';
import { carregarGrafoDaLoja } from './carregarGrafo';
import type { GrafoCusto, NoCusto } from './types';

/** Debounce em ms antes de remontar o grafo após um evento Realtime. */
const DEBOUNCE_REBUILD_MS = 800;

export function EstoqueCusto3D({ lojaId }: { lojaId: string }) {
  const [grafo, setGrafo]             = useState<GrafoCusto | null>(null);
  const [erro, setErro]               = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [selecionado, setSelecionado] = useState<NoCusto | null>(null);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Reconstrói o grafo a partir do banco.
   * `silencioso=true` preserva o grafo atual enquanto recalcula (sem piscar).
   */
  const rebuild = useCallback(
    async (silencioso = false) => {
      if (!silencioso) { setGrafo(null); setErro(null); }
      else setAtualizando(true);
      try {
        const g = await carregarGrafoDaLoja(lojaId);
        setGrafo(g);
        setErro(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        setAtualizando(false);
      }
    },
    [lojaId],
  );

  /** Agenda um rebuild com debounce — evita redraws em cascata. */
  const agendarRebuild = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => rebuild(true), DEBOUNCE_REBUILD_MS);
  }, [rebuild]);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    setGrafo(null);
    setErro(null);
    carregarGrafoDaLoja(lojaId)
      .then((g) => { if (vivo) setGrafo(g); })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [lojaId]);

  // ── Supabase Realtime: assina insumos + lotes da loja ────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`custo3d-loja-${lojaId}`)
      // Qualquer UPDATE em insumos desta loja (ex.: preço editado)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insumos', filter: `loja_id=eq.${lojaId}` },
        agendarRebuild,
      )
      // Qualquer INSERT/UPDATE em lotes desta loja (ex.: nova entrada de estoque)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lotes_estoque', filter: `loja_id=eq.${lojaId}` },
        agendarRebuild,
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [lojaId, agendarRebuild]);

  // ── Estados de erro / vazio ────────────────────────────────────────────────
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
          Registre uma entrada em &quot;+ Entrada&quot; para ver o custo se ramificar.
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
            {/* Indicador de atualização em tempo real */}
            {atualizando && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 animate-pulse">
                <RefreshCw size={11} className="animate-spin" /> atualizando…
              </span>
            )}
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

