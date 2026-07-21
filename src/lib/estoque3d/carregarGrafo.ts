/**
 * Ponte entre o banco e o Grafo de Transformação 3D.
 *
 * O banco guarda o ESTADO FINAL (lote na unidade atômica) e o CAMINHO
 * (fatores_conversao). A visualização precisa da HISTÓRIA: a compra original,
 * a conversão para estoque atômico e as quebras seguintes.
 *
 * A reconstrução funciona porque o grafo de fatores é uma cadeia: existe uma
 * unidade de partida (a que nunca aparece como destino — a unidade de compra)
 * e daí um caminho único até a unidade base do insumo.
 *
 *   Tomate: base 'fatias', fatores kg→un ×8, un→fatias ×5
 *           ⇒ cadeia kg → un → fatias
 *           ⇒ 120 fatias = 24 un = 3 kg
 *
 * A conservação de valor cai de graça: o custo total do lote é o mesmo em
 * todos os níveis; o que muda é por quantas partes ele se divide.
 */

import { supabase } from '../supabase';
import { construirGrafoCusto, type CompraInput, type GrafoCusto, type TransformacaoInput } from './types';

interface LinhaFator {
  item_id: string | null;
  unidade_origem: string;
  unidade_destino: string;
  multiplicador: number;
}

interface LinhaLote {
  id: string;
  insumo_id: string;
  quantidade_inicial: number;
  quantidade_restante: number;
  custo_unitario: number;
  criado_em: string;
}

interface LinhaInsumo {
  id: string;
  nome: string;
  unidade_medida: string;
  categoria_insumo?: string | null;
}

/**
 * Ordena os fatores de um insumo numa cadeia da unidade de compra até a base.
 * Retorna [] quando não há fatores (o lote já nasce na unidade de compra).
 */
export function reconstruirCadeia(
  fatores: LinhaFator[],
  unidadeBase: string,
): Array<{ de: string; para: string; multiplicador: number }> {
  if (fatores.length === 0) return [];

  const porOrigem = new Map(fatores.map((f) => [f.unidade_origem, f]));
  const destinos = new Set(fatores.map((f) => f.unidade_destino));

  // A unidade de compra é a única que nunca é destino de ninguém.
  const partida = fatores.find((f) => !destinos.has(f.unidade_origem))?.unidade_origem;
  if (!partida) return []; // ciclo ou dado inconsistente: não arrisca

  const cadeia: Array<{ de: string; para: string; multiplicador: number }> = [];
  const visitados = new Set<string>();
  let atual = partida;

  while (porOrigem.has(atual) && !visitados.has(atual)) {
    visitados.add(atual);
    const f = porOrigem.get(atual)!;
    cadeia.push({ de: f.unidade_origem, para: f.unidade_destino, multiplicador: Number(f.multiplicador) });
    atual = f.unidade_destino;
    if (atual === unidadeBase) break;
  }
  return cadeia;
}

/**
 * Monta as compras (raízes da árvore) a partir dos lotes e das cadeias.
 * Exportada separadamente da consulta para permitir teste sem banco.
 */
export function montarCompras(
  insumos: LinhaInsumo[],
  lotes: LinhaLote[],
  fatores: LinhaFator[],
): CompraInput[] {
  const fatoresPorItem = new Map<string, LinhaFator[]>();
  for (const f of fatores) {
    if (!f.item_id) continue; // universais não descrevem a história de um item
    if (!fatoresPorItem.has(f.item_id)) fatoresPorItem.set(f.item_id, []);
    fatoresPorItem.get(f.item_id)!.push(f);
  }
  const insumoPorId = new Map(insumos.map((i) => [i.id, i]));
  const compras: CompraInput[] = [];

  for (const lote of lotes) {
    const insumo = insumoPorId.get(lote.insumo_id);
    if (!insumo) continue;

    const qtdBase = Number(lote.quantidade_inicial);
    const custoTotal = qtdBase * Number(lote.custo_unitario);
    if (!(qtdBase > 0) || !(custoTotal > 0)) continue; // sem custo não há o que diluir

    const cadeia = reconstruirCadeia(fatoresPorItem.get(lote.insumo_id) ?? [], insumo.unidade_medida);

    // Sem cadeia: o lote é a própria compra, sem ramificação.
    if (cadeia.length === 0) {
      compras.push({
        id: lote.id, produto: insumo.nome, unidade: insumo.unidade_medida,
        quantidade: qtdBase, custoTotal, data: lote.criado_em,
        categoria: insumo.categoria_insumo ?? 'Ingrediente',
        transformacoes: [],
      });
      continue;
    }

    // Desce a cadeia acumulando o multiplicador total, para descobrir quantas
    // unidades de COMPRA o lote representa: qtdCompra = qtdBase / Π(mult).
    const multTotal = cadeia.reduce((a, p) => a * p.multiplicador, 1);
    const qtdCompra = qtdBase / multTotal;
    if (!(qtdCompra > 0) || !Number.isFinite(qtdCompra)) continue;

    // Constrói as transformações aninhadas, de fora para dentro.
    let quantidadeNoNivel = qtdCompra;
    const niveis: TransformacaoInput[] = [];
    for (const passo of cadeia) {
      const produzida = quantidadeNoNivel * passo.multiplicador;
      niveis.push({
        id: `${lote.id}:${passo.de}->${passo.para}`,
        produto: `${insumo.nome} (${passo.para})`,
        unidade: passo.para,
        quantidadeConsumida: quantidadeNoNivel,
        quantidadeProduzida: produzida,
        data: lote.criado_em,
      });
      quantidadeNoNivel = produzida;
    }
    // Aninha: cada nível vira filho do anterior.
    for (let i = niveis.length - 1; i > 0; i--) niveis[i - 1].filhos = [niveis[i]];

    compras.push({
      id: lote.id,
      produto: insumo.nome,
      unidade: cadeia[0].de,
      quantidade: qtdCompra,
      custoTotal,
      data: lote.criado_em,
      categoria: insumo.categoria_insumo ?? 'Ingrediente',
      transformacoes: [niveis[0]],
    });
  }
  return compras;
}

/** Carrega o grafo real da loja. Lotes sem custo são ignorados. */
export async function carregarGrafoDaLoja(lojaId: string, limiteLotes = 300): Promise<GrafoCusto> {
  const [insumosRes, lotesRes, fatoresRes] = await Promise.all([
    supabase.from('insumos').select('id,nome,unidade_medida,categoria_insumo').eq('loja_id', lojaId),
    supabase
      .from('lotes_estoque')
      .select('id,insumo_id,quantidade_inicial,quantidade_restante,custo_unitario,criado_em')
      .eq('loja_id', lojaId)
      .order('criado_em', { ascending: false })
      .limit(limiteLotes),
    supabase
      .from('fatores_conversao')
      .select('item_id,unidade_origem,unidade_destino,multiplicador'),
  ]);

  const erro = insumosRes.error ?? lotesRes.error ?? fatoresRes.error;
  if (erro) throw new Error(`Falha ao carregar o grafo de custo: ${erro.message}`);

  const compras = montarCompras(
    (insumosRes.data ?? []) as LinhaInsumo[],
    (lotesRes.data ?? []) as LinhaLote[],
    (fatoresRes.data ?? []) as LinhaFator[],
  );
  return construirGrafoCusto(compras);
}
