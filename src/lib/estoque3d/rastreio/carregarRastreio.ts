/**
 * Camada de dados do Rastreio 3D — TODOS os itens do estoque, por setor.
 *
 * Diferença em relação ao carregarGrafo.ts (que serve à árvore de custo de
 * LOTES): aqui a unidade de rastreio é o INSUMO em si. Cada item vira uma
 * linha completa Compra → Armazenado → Quebra(s) → Uso, com:
 *
 *  - quantidade REAL em cada nível: a `quantidade_atual` (unidade base)
 *    convertida para cima pela cadeia de fatores (40 fatias → 8 un → 1 kg);
 *  - custo REAL por nível: o custo da unidade base na hierarquia que o
 *    próprio banco usa — `custo_peps_proximo` (lote que sai primeiro) →
 *    `custo_medio_ponderado` (lotes com saldo) → `custo_estimado`
 *    (`preco_embalagem/qtd_embalagem` do cadastro) — dividida pelo fator
 *    acumulado do nível;
 *  - tipo da etapa: FÍSICA quando o passo sai de um agrupador (abrir a
 *    caixa revela o conteúdo — fato automático) e HUMANA ⚠️ quando é
 *    rendimento declarado (quebra/uso — alguém precisa fazê-lo e registrá-lo);
 *  - estado de negócio: sem_estoque → crítico → sem_custo → alerta_desvio
 *    (desvio ≥ 15% entre cadastro e lotes, oficial da vw) → ok.
 *
 * Agrupamento por SETOR FÍSICO (geladeira/armário/dispensa — ver setores.ts);
 * a `categoria_insumo` do cadastro acompanha cada item no detalhe.
 *
 * Funções puras separadas das queries para teste sem banco.
 */

import { supabase } from '../../supabase';
import { reconstruirCadeia } from '../carregarGrafo';
import { getUnidade } from '../../unidades';
import { derivarSetor, validarSetor, SETORES, ORDEM_SETORES, type Setor, type SetorId } from './setores';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type EstadoItem = 'ok' | 'critico' | 'sem_estoque' | 'sem_custo' | 'alerta_desvio';

export interface EstagioItem {
  unidade: string;
  /** 0 'Compra', 1 'Armazenado', 2 'Quebra', ≥3 'Uso'. */
  rotulo: string;
  /** Quantidade REAL do estoque atual expressa nesta unidade. */
  quantidade: number;
  /** Custo por esta unidade (null quando não há custo conhecido). */
  custoUnitario: number | null;
  /** Etapa que CHEGA neste nível: física (automática) ou humana ⚠️. */
  tipo: 'fisica' | 'humana';
}

export interface ItemRastreio {
  insumoId: string;
  nome: string;
  /** categoria_insumo do cadastro (ou 'Preparo'). */
  categoria: string;
  setor: SetorId;
  unidadeBase: string;
  estagios: EstagioItem[];
  quantidadeAtual: number; // na unidade base
  custoBase: number | null; // por unidade base
  /** Origem do custoBase — exibida no painel ("de onde sai esse número"). */
  origemCusto: 'PEPS' | 'médio ponderado' | 'cadastro' | null;
  totalInvestido: number | null;
  estoqueMinimo: number;
  estado: EstadoItem;
  desvioPct: number | null;
  lotesAtivos: number;
  isPreparo: boolean;
}

export interface SetorRastreio {
  setor: Setor;
  itens: ItemRastreio[];
  totalInvestido: number;
  /** Itens em qualquer estado ≠ ok — o que merece atenção do usuário. */
  alertas: number;
}

// ---------------------------------------------------------------------------
// Linhas das queries (espelho das tabelas/views reais)
// ---------------------------------------------------------------------------

export interface LinhaInsumoRastreio {
  id: string;
  nome: string;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number;
  preco_embalagem: number;
  qtd_embalagem: number;
  categoria_insumo: string | null;
  is_preparo: boolean;
  /** Setor físico do cadastro (null/ausente = derivação automática). */
  setor?: string | null;
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

const ROTULOS_ESTAGIO = ['Compra', 'Armazenado', 'Quebra'];

function rotuloEstagio(indice: number): string {
  return ROTULOS_ESTAGIO[indice] ?? 'Uso';
}

/**
 * Tipo da etapa que CHEGA no nível i:
 *  - nível 0 (Compra) é sempre físico;
 *  - sair de um agrupador (abrir a caixa: cx→kg) é físico — o conteúdo veio
 *    dentro da embalagem, é fato da compra;
 *  - conversão dimensional DENTRO da mesma grandeza (kg→g, L→ml) é física —
 *    o fator é imutável por definição, não rendimento declarado;
 *  - todo o resto (kg→un, un→fatias) é rendimento HUMANO ⚠️ — alguém precisa
 *    fracionar/porcionar e registrar.
 */
function tipoEtapa(unidades: string[], i: number): 'fisica' | 'humana' {
  if (i === 0) return 'fisica';
  const anterior = getUnidade(unidades[i - 1])?.grandeza;
  if (anterior === 'agrupador') return 'fisica';
  const atual = getUnidade(unidades[i])?.grandeza;
  if (
    anterior != null &&
    anterior === atual &&
    (anterior === 'massa' || anterior === 'volume')
  ) {
    return 'fisica';
  }
  return 'humana';
}

/** Severidade para ordenação: problema primeiro, depois o valor investido. */
const PESO_ESTADO: Record<EstadoItem, number> = {
  sem_estoque: 0,
  critico: 1,
  sem_custo: 2,
  alerta_desvio: 3,
  ok: 4,
};

// ---------------------------------------------------------------------------
// Montagem pura (testável sem banco)
// ---------------------------------------------------------------------------

export function montarRastreio(
  insumos: LinhaInsumoRastreio[],
  custosView: LinhaCustoView[],
  fatores: LinhaFatorRastreio[],
): SetorRastreio[] {
  const custoPorItem = new Map(custosView.map((c) => [c.insumo_id, c]));
  const fatoresPorItem = new Map<string, LinhaFatorRastreio[]>();
  for (const f of fatores) {
    if (!f.item_id) continue; // universais (kg→g) não descrevem a cadeia do item
    if (!fatoresPorItem.has(f.item_id)) fatoresPorItem.set(f.item_id, []);
    fatoresPorItem.get(f.item_id)!.push(f);
  }

  const porSetor = new Map<SetorId, ItemRastreio[]>();

  for (const insumo of insumos) {
    const view = custoPorItem.get(insumo.id);
    const quantidadeAtual = Number(insumo.quantidade_atual) || 0;
    const estoqueMinimo = Number(insumo.estoque_minimo) || 0;

    // Hierarquia oficial de custo: o lote que o PEPS consome primeiro, depois
    // a média dos lotes, por fim o cadastro — mesma ordem do fallback do banco.
    const custoBase =
      view?.custo_peps_proximo != null ? Number(view.custo_peps_proximo)
      : view?.custo_medio_ponderado != null ? Number(view.custo_medio_ponderado)
      : view?.custo_estimado != null ? Number(view.custo_estimado)
      : insumo.qtd_embalagem > 0 && insumo.preco_embalagem > 0
        ? insumo.preco_embalagem / insumo.qtd_embalagem
        : null;
    const origemCusto: ItemRastreio['origemCusto'] =
      view?.custo_peps_proximo != null ? 'PEPS'
      : view?.custo_medio_ponderado != null ? 'médio ponderado'
      : (view?.custo_estimado != null || (insumo.qtd_embalagem > 0 && insumo.preco_embalagem > 0))
        ? 'cadastro'
        : null;

    // Cadeia compra → base (reusa reconstruirCadeia, a mesma do grafo de custo).
    const cadeia = reconstruirCadeia(fatoresPorItem.get(insumo.id) ?? [], insumo.unidade_medida);
    const unidades: string[] =
      cadeia.length === 0
        ? [insumo.unidade_medida]
        : [cadeia[0].de, ...cadeia.map((p) => p.para)];

    // Fator acumulado de cada nível até a base (base = 1): quantas unidades
    // BASE cabem em 1 unidade deste nível (1 cx = 320 fatias).
    const fatorAteBase: number[] = new Array(unidades.length).fill(1);
    for (let i = unidades.length - 2; i >= 0; i--) {
      fatorAteBase[i] = fatorAteBase[i + 1] * cadeia[i].multiplicador;
    }

    const estagios: EstagioItem[] = unidades.map((unidade, i) => ({
      unidade,
      rotulo: rotuloEstagio(i),
      // Quantidade: divide (40 fatias = 0,125 cx). Custo: MULTIPLICA (1 cx
      // custa 320 × R$ 0,50 = R$ 160) — conserva quantidade × custoUnitario.
      quantidade: quantidadeAtual / fatorAteBase[i],
      custoUnitario: custoBase != null ? custoBase * fatorAteBase[i] : null,
      tipo: tipoEtapa(unidades, i),
    }));

    const desvioPct = view?.desvio_pct != null ? Number(view.desvio_pct) : null;
    const estado: EstadoItem =
      quantidadeAtual <= 0 ? 'sem_estoque'
      : quantidadeAtual <= estoqueMinimo ? 'critico'
      : custoBase == null ? 'sem_custo'
      : view?.alerta_desvio ? 'alerta_desvio'
      : 'ok';

    const item: ItemRastreio = {
      insumoId: insumo.id,
      nome: insumo.nome,
      categoria: insumo.is_preparo ? 'Preparo' : (insumo.categoria_insumo ?? 'Ingrediente'),
      // Setor oficial do cadastro manda; null = derivação automática.
      setor: validarSetor(insumo.setor) ?? derivarSetor(insumo.nome, insumo.categoria_insumo),
      unidadeBase: insumo.unidade_medida,
      estagios,
      quantidadeAtual,
      custoBase,
      origemCusto,
      totalInvestido: custoBase != null ? quantidadeAtual * custoBase : null,
      estoqueMinimo,
      estado,
      desvioPct,
      lotesAtivos: Number(view?.qtd_lotes_ativos ?? 0),
      isPreparo: Boolean(insumo.is_preparo),
    };

    if (!porSetor.has(item.setor)) porSetor.set(item.setor, []);
    porSetor.get(item.setor)!.push(item);
  }

  // Ordena: problemas primeiro (o usuário precisa vê-los), depois por valor.
  const setores: SetorRastreio[] = [];
  for (const id of ORDEM_SETORES) {
    const itens = (porSetor.get(id) ?? []).sort((a, b) => {
      const p = PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado];
      if (p !== 0) return p;
      return (b.totalInvestido ?? 0) - (a.totalInvestido ?? 0);
    });
    if (itens.length === 0) continue;
    setores.push({
      setor: SETORES[id],
      itens,
      totalInvestido: itens.reduce((acc, i) => acc + (i.totalInvestido ?? 0), 0),
      alertas: itens.filter((i) => i.estado !== 'ok').length,
    });
  }
  return setores;
}

// ---------------------------------------------------------------------------
// Query real (Supabase)
// ---------------------------------------------------------------------------

/** Carrega todos os insumos ativos da loja com custo e cadeia, por setor. */
export async function carregarRastreio(lojaId: string): Promise<SetorRastreio[]> {
  const [insumosRes, custosRes, fatoresRes] = await Promise.all([
    carregarInsumosRastreio(lojaId),
    supabase
      .from('vw_custo_real_estoque')
      .select('insumo_id,saldo_total,qtd_lotes_ativos,custo_medio_ponderado,custo_estimado,desvio_pct,alerta_desvio,custo_peps_proximo')
      .eq('loja_id', lojaId),
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

const SELECT_INSUMOS =
  'id,nome,unidade_medida,quantidade_atual,estoque_minimo,preco_embalagem,qtd_embalagem,categoria_insumo,is_preparo';

/**
 * Tenta ler com a coluna `setor` (oficial, da migração). Se a coluna ainda
 * não existir no banco (erro 42703), degrada para a derivação automática em
 * vez de derrubar o rastreio — o campo de cadastro é um refinamento, não um
 * pré-requisito.
 */
async function carregarInsumosRastreio(lojaId: string) {
  const comSetor = await supabase
    .from('insumos')
    .select(`${SELECT_INSUMOS},setor`)
    .eq('loja_id', lojaId)
    .eq('ativo', true)
    .order('nome');
  if ((comSetor.error as { code?: string } | null)?.code === '42703') {
    return supabase
      .from('insumos')
      .select(SELECT_INSUMOS)
      .eq('loja_id', lojaId)
      .eq('ativo', true)
      .order('nome');
  }
  return comSetor;
}
