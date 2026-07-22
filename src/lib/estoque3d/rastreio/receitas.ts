/**
 * Checagem de receitas contra o rastreio — "dá para produzir? quantas porções?"
 *
 * É aqui que o Rastreio 3D vira ferramenta de trabalho diário: antes de
 * iniciar um preparo, o usuário seleciona a receita e vê, ingrediente a
 * ingrediente, o que tem e o que falta — e o gargalo exato ("rende 12
 * porções; limita: Tomate").
 *
 * Semântica dos dados (conferida no schema e em EstoquePreparos.tsx):
 *  - `fichas_tecnicas.quantidade_consumida`: por UNIDADE VENDIDA do produto,
 *    já na unidade base do insumo.
 *  - `fichas_preparos.quantidade`: por LOTE de produção do preparo; o lote
 *    rende `insumos.rendimento_porcoes` porções. Logo, por 1 unidade base do
 *    preparo, o componente entra com `quantidade / rendimento_porcoes`.
 *  - Disponível = `insumos.quantidade_atual` (cache mantido pelo ledger).
 *
 * Funções puras separadas das queries para teste sem banco.
 */

import { supabase } from '../../supabase';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface IngredienteCheck {
  insumoId: string;
  nome: string;
  unidadeBase: string;
  /** Quanto 1 porção/unidade da receita consome, na unidade base do insumo. */
  necessario: number;
  /** Estoque atual na unidade base. */
  disponivel: number;
  /** disponivel >= necessario (com tolerância de arredondamento). */
  cobre: boolean;
  /** Quantas porções ESTE ingrediente permite sozinho. */
  maxPorcoes: number;
  /** Quando o ingrediente entra via um preparo: nome do preparo ("via Molho"). */
  viaPreparo: string | null;
}

export interface ReceitaCheck {
  receitaId: string;
  nome: string;
  tipo: 'produto' | 'preparo';
  ingredientes: IngredienteCheck[];
  /** min dos maxPorcoes — o gargalo real da produção. */
  maxPorcoes: number;
  /** Todos os ingredientes cobrem ao menos 1 porção. */
  completa: boolean;
  /** Ingrediente que limita a produção (o primeiro do menor maxPorcoes). */
  gargalo: string | null;
}

export interface ReceitaResumo {
  id: string;
  nome: string;
  tipo: 'produto' | 'preparo';
}

// ---------------------------------------------------------------------------
// Linhas das queries
// ---------------------------------------------------------------------------

export interface LinhaFichaTecnica {
  produto_id: string;
  insumo_id: string;
  quantidade_consumida: number;
}

export interface LinhaFichaPreparo {
  preparo_id: string;
  insumo_id: string;
  quantidade: number;
}

export interface LinhaProduto {
  id: string;
  nome: string;
  controla_estoque: boolean;
}

export interface InsumoMinimo {
  id: string;
  nome: string;
  unidade_medida: string;
  quantidade_atual: number;
  is_preparo: boolean;
  rendimento_porcoes: number | null;
}

const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Núcleo puro
// ---------------------------------------------------------------------------

/**
 * Expande a ficha de uma receita em necessidades por insumo ATÔMICO.
 * Preparos entram como ingredientes expandidos ("via Molho X") — o que falta
 * é sempre o insumo de verdade (tomate, cebola), nunca o conceito abstrato.
 */
export function verificarReceita(
  receita: ReceitaResumo,
  fichasTecnicas: LinhaFichaTecnica[],
  fichasPreparos: LinhaFichaPreparo[],
  insumos: InsumoMinimo[],
): ReceitaCheck {
  const insumoPorId = new Map(insumos.map((i) => [i.id, i]));

  // Linhas brutas da receita: produto lê fichas_tecnicas; preparo lê a
  // própria ficha de produção (1 lote = rendimento_porcoes porções).
  const linhas: Array<{ insumoId: string; qtd: number; via: string | null }> = [];

  if (receita.tipo === 'produto') {
    for (const ft of fichasTecnicas) {
      if (ft.produto_id !== receita.id) continue;
      linhas.push({ insumoId: ft.insumo_id, qtd: Number(ft.quantidade_consumida), via: null });
    }
  } else {
    const prep = insumoPorId.get(receita.id);
    const rendimento = Number(prep?.rendimento_porcoes) || 1;
    for (const fp of fichasPreparos) {
      if (fp.preparo_id !== receita.id) continue;
      // Por porção do preparo (a receita "fazer molho" é medida em porções).
      linhas.push({ insumoId: fp.insumo_id, qtd: Number(fp.quantidade) / rendimento, via: null });
    }
  }

  // Expande preparos (1 nível — preparo dentro de preparo é caso raro e fica
  // como ingrediente direto, visível pelo nome, sem recursão escondida).
  const expandido = new Map<string, { qtd: number; via: string | null }>();
  const somar = (id: string, qtd: number, via: string | null) => {
    const atual = expandido.get(id) ?? { qtd: 0, via };
    expandido.set(id, { qtd: atual.qtd + qtd, via: atual.via ?? via });
  };

  for (const linha of linhas) {
    const insumo = insumoPorId.get(linha.insumoId);
    if (insumo?.is_preparo) {
      const rendimento = Number(insumo.rendimento_porcoes) || 1;
      for (const fp of fichasPreparos) {
        if (fp.preparo_id !== insumo.id) continue;
        somar(fp.insumo_id, (linha.qtd * Number(fp.quantidade)) / rendimento, insumo.nome);
      }
    } else {
      somar(linha.insumoId, linha.qtd, linha.via);
    }
  }

  const ingredientes: IngredienteCheck[] = [...expandido.entries()]
    .map(([insumoId, { qtd, via }]) => {
      const insumo = insumoPorId.get(insumoId);
      const disponivel = Number(insumo?.quantidade_atual ?? 0);
      const necessario = qtd;
      const maxPorcoes = necessario > EPS ? Math.floor((disponivel + EPS) / necessario) : Infinity;
      return {
        insumoId,
        nome: insumo?.nome ?? 'Insumo removido',
        unidadeBase: insumo?.unidade_medida ?? 'un',
        necessario,
        disponivel,
        cobre: necessario <= EPS || disponivel + EPS >= necessario,
        maxPorcoes,
        viaPreparo: via,
      };
    })
    // O que falta aparece primeiro — é o que exige ação do usuário.
    .sort((a, b) => a.maxPorcoes - b.maxPorcoes);

  const gargaloItem = ingredientes.find((i) => i.maxPorcoes !== Infinity)
    ? ingredientes.reduce((a, b) => (a.maxPorcoes <= b.maxPorcoes ? a : b))
    : null;

  return {
    receitaId: receita.id,
    nome: receita.nome,
    tipo: receita.tipo,
    ingredientes,
    maxPorcoes: ingredientes.length === 0 ? 0 : (gargaloItem?.maxPorcoes ?? 0),
    completa: ingredientes.length > 0 && ingredientes.every((i) => i.cobre),
    gargalo: gargaloItem && gargaloItem.maxPorcoes !== Infinity ? gargaloItem.nome : null,
  };
}

// ---------------------------------------------------------------------------
// Query real
// ---------------------------------------------------------------------------

export interface DadosReceitas {
  receitas: ReceitaResumo[];
  fichasTecnicas: LinhaFichaTecnica[];
  fichasPreparos: LinhaFichaPreparo[];
  insumos: InsumoMinimo[];
}

/** Produtos que baixam estoque + preparos ativos = as receitas checáveis. */
export async function carregarDadosReceitas(lojaId: string): Promise<DadosReceitas> {
  const [produtosRes, ftRes, fpRes, insumosRes] = await Promise.all([
    supabase.from('produtos').select('id,nome,controla_estoque').eq('loja_id', lojaId).eq('controla_estoque', true).order('nome'),
    supabase.from('fichas_tecnicas').select('produto_id,insumo_id,quantidade_consumida'),
    supabase.from('fichas_preparos').select('preparo_id,insumo_id,quantidade'),
    supabase.from('insumos').select('id,nome,unidade_medida,quantidade_atual,is_preparo,rendimento_porcoes').eq('loja_id', lojaId).eq('ativo', true),
  ]);

  const erro = produtosRes.error ?? ftRes.error ?? fpRes.error ?? insumosRes.error;
  if (erro) throw new Error(`Falha ao carregar receitas: ${erro.message}`);

  const insumos = (insumosRes.data ?? []) as InsumoMinimo[];
  const receitas: ReceitaResumo[] = [
    ...((produtosRes.data ?? []) as LinhaProduto[]).map((p) => ({ id: p.id, nome: p.nome, tipo: 'produto' as const })),
    ...insumos.filter((i) => i.is_preparo).map((i) => ({ id: i.id, nome: i.nome, tipo: 'preparo' as const })),
  ];

  return {
    receitas,
    fichasTecnicas: (ftRes.data ?? []) as LinhaFichaTecnica[],
    fichasPreparos: (fpRes.data ?? []) as LinhaFichaPreparo[],
    insumos,
  };
}
