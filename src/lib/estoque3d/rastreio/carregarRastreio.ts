/**
 * Camada de dados do Rastreio 3D — TODOS os itens ativos da loja, por categoria.
 *
 * Diferença para o Grafo de Custo (carregarGrafo.ts): o grafo reconstrói a
 * história dos LOTES (uma árvore por compra); o rastreio responde outra
 * pergunta — "onde está parado o dinheiro do estoque AGORA, item por item".
 * Por isso ele ancora em `insumos.quantidade_atual` (a posição atual) e na
 * view oficial `vw_custo_real_estoque` (o custo que o próprio banco calcula),
 * em vez de re-derivar custos dos lotes.
 *
 * Regras de negócio honradas aqui (não reinventar na engine):
 *
 *  - CADEIA = a mesma do grafo: `reconstruirCadeia` sobre os fatores por item,
 *    da unidade de compra (a que nunca é destino) até a unidade base. Item sem
 *    fatores tem 1 estágio — a compra já nasce na unidade de uso.
 *  - CONSERVAÇÃO: em cada nível vale quantidade × custoUnitário = constante
 *    (= quantidadeAtual × custoBase). Descer a cadeia subdivide a mesma
 *    riqueza em mais partes — nunca cria nem destrói valor.
 *  - ETAPA FÍSICA vs HUMANA: classificada pela GRANDEZA das unidades
 *    (unidades.ts), não pela origem da linha no banco. kg→g e L→ml são
 *    físicas (a dimensão define o rendimento); kg→un, un→fatias, cx→kg são
 *    humanas (o lojista é a autoridade sobre o rendimento — a "etapa ⚠️").
 *  - CUSTO BASE: a hierarquia que o banco usa — PEPS (custo do lote mais
 *    antigo com saldo) → médio ponderado dos saldos → estimado de cadastro
 *    (preco_embalagem / qtd_embalagem). A origem é exposta para o painel
 *    dizer de onde veio o número.
 *  - ESTADO: sem_estoque > sem_custo > crítico > alerta_desvio > ok. Um item
 *    zerado não é "crítico" — ele acabou; e custo desconhecido esconde qualquer
 *    crítico, porque sem custo não dá nem para precificar o risco.
 */

import { supabase } from '../../supabase';
import { reconstruirCadeia } from '../carregarGrafo';
import { getUnidade, ehDimensional } from '../../unidades';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type EstadoItem = 'ok' | 'critico' | 'sem_estoque' | 'sem_custo' | 'alerta_desvio';

/** De onde veio o custo base (hierarquia do banco). null = sem custo algum. */
export type OrigemCusto = 'peps' | 'medio' | 'cadastro' | null;

export interface EstagioItem {
  unidade: string;
  /** 0 'Compra', 1 'Armazenado', 2 'Quebra', ≥3 'Uso'. */
  rotulo: string;
  /** Quantidade REAL convertida para esta unidade (a partir de quantidade_atual). */
  quantidade: number;
  /** Custo por ESTA unidade (custo base × fator acumulado). null = sem custo. */
  custoUnitario: number | null;
  /**
   * Estágio 0 (Compra) é sempre 'fisica' — a compra é fato, não conversão.
   * Estágio i ≥ 1 herda o tipo do passo que o produziu: físico quando a
   * dimensão define o rendimento (kg→g), humano quando o lojista declarou.
   */
  tipo: 'fisica' | 'humana';
}

export interface ItemRastreio {
  insumoId: string;
  nome: string;
  categoria: string;
  unidadeBase: string;
  /** [compra?…, base] — sem fatores: exatamente 1 estágio. */
  estagios: EstagioItem[];
  /** Posição atual na unidade base (insumos.quantidade_atual). */
  quantidadeAtual: number;
  /** Custo por unidade base: PEPS → médio ponderado → cadastro. */
  custoBase: number | null;
  origemCusto: OrigemCusto;
  /** saldo_total (view) × custoBase. null quando não há custo conhecido. */
  totalInvestido: number | null;
  estoqueMinimo: number;
  estado: EstadoItem;
  /** desvio_pct da view (estimado vs real), quando houver. */
  desvioPct: number | null;
  lotesAtivos: number;
}

export interface CategoriaRastreio {
  nome: string;
  itens: ItemRastreio[];
  totalInvestido: number;
  /** Itens em estado 'critico' ou 'alerta_desvio'. */
  alertas: number;
}

// ---------------------------------------------------------------------------
// Linhas do banco (formato exato — ver migrações 20260721*/20260722*)
// ---------------------------------------------------------------------------

export interface LinhaInsumoRastreio {
  id: string;
  nome: string;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number | null;
  preco_embalagem: number | null;
  qtd_embalagem: number | null;
  categoria_insumo: string | null;
  is_preparo: boolean | null;
}

export interface LinhaCustoView {
  insumo_id: string;
  saldo_total: number | null;
  qtd_lotes_ativos: number | null;
  custo_medio_ponderado: number | null;
  custo_estimado: number | null;
  desvio_pct: number | null;
  alerta_desvio: boolean | null;
  custo_peps_proximo: number | null;
}

export interface LinhaFatorRastreio {
  item_id: string | null;
  unidade_origem: string;
  unidade_destino: string;
  multiplicador: number;
}

// ---------------------------------------------------------------------------
// Montagem pura (testável sem banco)
// ---------------------------------------------------------------------------

const ROTULOS_ESTAGIO = ['Compra', 'Armazenado', 'Quebra', 'Uso'] as const;

/**
 * Um passo de conversão é FÍSICO quando ambas as unidades são dimensionais da
 * mesma grandeza (a física fixa o rendimento: kg→g = ×1000, L→ml = ×1000).
 * Todo o resto — agrupador→massa, massa→contagem, contagem→semântico — é
 * rendimento declarado pelo lojista: etapa HUMANA (⚠️).
 * Unidade fora do registro canônico ⇒ desconhecida ⇒ humana por prudência.
 */
function tipoDoPasso(de: string, para: string): 'fisica' | 'humana' {
  const uDe = getUnidade(de);
  const uPara = getUnidade(para);
  if (!uDe || !uPara) return 'humana';
  if (ehDimensional(uDe) && ehDimensional(uPara) && uDe.grandeza === uPara.grandeza) {
    return 'fisica';
  }
  return 'humana';
}

/** Número finito ou null — o banco manda numeric que o PostgREST pode zerar. */
function numOuNull(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Monta o rastreio a partir das três fontes. Função pura: separada da query
 * para ser testada sem banco.
 */
export function montarRastreio(
  insumos: LinhaInsumoRastreio[],
  custosView: LinhaCustoView[],
  fatores: LinhaFatorRastreio[],
): CategoriaRastreio[] {
  const custoPorInsumo = new Map(custosView.map((c) => [c.insumo_id, c]));
  const fatoresPorItem = new Map<string, LinhaFatorRastreio[]>();
  for (const f of fatores) {
    if (!f.item_id) continue; // universais (kg→g) são fallback SQL, não história do item
    if (!fatoresPorItem.has(f.item_id)) fatoresPorItem.set(f.item_id, []);
    fatoresPorItem.get(f.item_id)!.push(f);
  }

  const porCategoria = new Map<string, ItemRastreio[]>();

  for (const insumo of insumos) {
    const base = insumo.unidade_medida;
    const quantidadeAtual = numOuNull(insumo.quantidade_atual) ?? 0;
    const view = custoPorInsumo.get(insumo.id);

    // --- Custo base na hierarquia do banco --------------------------------
    const peps = numOuNull(view?.custo_peps_proximo);
    const medio = numOuNull(view?.custo_medio_ponderado);
    const estimado = numOuNull(view?.custo_estimado);
    let custoBase: number | null = null;
    let origemCusto: OrigemCusto = null;
    if (peps != null && peps > 0) { custoBase = peps; origemCusto = 'peps'; }
    else if (medio != null && medio > 0) { custoBase = medio; origemCusto = 'medio'; }
    else if (estimado != null && estimado > 0) { custoBase = estimado; origemCusto = 'cadastro'; }

    // --- Estágios: da unidade de compra até a base --------------------------
    const cadeia = reconstruirCadeia(fatoresPorItem.get(insumo.id) ?? [], base);
    const unidades = cadeia.length === 0 ? [base] : [cadeia[0].de, ...cadeia.map((p) => p.para)];

    // Fator acumulado de cada nível ATÉ a base (produto dos multiplicadores a
    // jusante). Conservação: quantidade × custoUnitario é constante por nível.
    const n = unidades.length;
    const fatorAcum = new Array<number>(n).fill(1);
    for (let i = n - 2; i >= 0; i--) {
      const mult = Number(cadeia[i].multiplicador);
      // Multiplicador torto do banco não pode zerar/explodir a cadeia visual.
      fatorAcum[i] = fatorAcum[i + 1] * (Number.isFinite(mult) && mult > 0 ? mult : 1);
    }

    const estagios: EstagioItem[] = unidades.map((unidade, i) => {
      const quantidade = quantidadeAtual / fatorAcum[i];
      return {
        unidade,
        rotulo: ROTULOS_ESTAGIO[Math.min(i, ROTULOS_ESTAGIO.length - 1)],
        quantidade: Number.isFinite(quantidade) ? quantidade : 0,
        custoUnitario: custoBase != null ? custoBase * fatorAcum[i] : null,
        tipo: i === 0 ? 'fisica' : tipoDoPasso(cadeia[i - 1].de, cadeia[i - 1].para),
      };
    });

    // --- Estado e total investido -------------------------------------------
    const estoqueMinimo = numOuNull(insumo.estoque_minimo) ?? 0;
    const alertaDesvio = view?.alerta_desvio === true;
    let estado: EstadoItem = 'ok';
    if (quantidadeAtual <= 0) estado = 'sem_estoque';
    else if (custoBase == null) estado = 'sem_custo';
    else if (quantidadeAtual <= estoqueMinimo) estado = 'critico';
    else if (alertaDesvio) estado = 'alerta_desvio';

    // Saldo rastreado: o da view (lotes com saldo) quando existir linha; sem
    // linha na view, cai na posição atual do cadastro.
    const saldo = numOuNull(view?.saldo_total) ?? quantidadeAtual;
    const totalInvestido = custoBase != null ? saldo * custoBase : null;

    const item: ItemRastreio = {
      insumoId: insumo.id,
      nome: insumo.nome,
      categoria: insumo.categoria_insumo ?? 'Ingrediente',
      unidadeBase: base,
      estagios,
      quantidadeAtual,
      custoBase,
      origemCusto,
      totalInvestido,
      estoqueMinimo,
      estado,
      desvioPct: numOuNull(view?.desvio_pct),
      lotesAtivos: numOuNull(view?.qtd_lotes_ativos) ?? 0,
    };

    if (!porCategoria.has(item.categoria)) porCategoria.set(item.categoria, []);
    porCategoria.get(item.categoria)!.push(item);
  }

  // --- Ordenação: o dinheiro manda. Categoria mais cara primeiro; dentro
  // dela, item mais caro primeiro. Nome desempata (ordem estável).
  const investidoDesc = (a: number | null, b: number | null) => (b ?? 0) - (a ?? 0);

  const categorias: CategoriaRastreio[] = [];
  for (const [nome, itens] of porCategoria) {
    itens.sort((a, b) => investidoDesc(a.totalInvestido, b.totalInvestido) || a.nome.localeCompare(b.nome, 'pt-BR'));
    categorias.push({
      nome,
      itens,
      totalInvestido: itens.reduce((acc, i) => acc + (i.totalInvestido ?? 0), 0),
      alertas: itens.filter((i) => i.estado === 'critico' || i.estado === 'alerta_desvio').length,
    });
  }
  categorias.sort((a, b) => b.totalInvestido - a.totalInvestido || a.nome.localeCompare(b.nome, 'pt-BR'));

  return categorias;
}

// ---------------------------------------------------------------------------
// Query (Supabase)
// ---------------------------------------------------------------------------

/**
 * Carrega o rastreio completo da loja: insumos ativos + custos da view
 * oficial + fatores por item, em paralelo.
 */
export async function carregarRastreio(lojaId: string): Promise<CategoriaRastreio[]> {
  const [insumosRes, custosRes, fatoresRes] = await Promise.all([
    supabase
      .from('insumos')
      .select('id,nome,unidade_medida,quantidade_atual,estoque_minimo,preco_embalagem,qtd_embalagem,categoria_insumo,is_preparo')
      .eq('loja_id', lojaId)
      .eq('ativo', true),
    supabase.from('vw_custo_real_estoque').select('*').eq('loja_id', lojaId),
    supabase
      .from('fatores_conversao')
      .select('item_id,unidade_origem,unidade_destino,multiplicador')
      .not('item_id', 'is', null),
  ]);

  const erro = insumosRes.error ?? custosRes.error ?? fatoresRes.error;
  if (erro) throw new Error(`Falha ao carregar o rastreio: ${erro.message}`);

  return montarRastreio(
    (insumosRes.data ?? []) as LinhaInsumoRastreio[],
    (custosRes.data ?? []) as LinhaCustoView[],
    (fatoresRes.data ?? []) as LinhaFatorRastreio[],
  );
}
