/**
 * Teorema do Fracionamento de Estoque — normalização para a unidade atômica.
 *
 * O erro clássico é cruzar unidades diretamente (Quilo → Fatia). Aqui, TODO
 * item tem uma Unidade Base (a menor unidade de controle: g, ml, un) e todo
 * custo é ancorado nela. Converter A → B é encontrar um CAMINHO no grafo de
 * conversão; o custo nunca é calculado por regra de três improvisada.
 *
 * Duas classes de aresta no grafo:
 *  - UNIVERSAIS  (kg↔g, L↔ml): físicas, imutáveis, vêm de `unidades.ts`.
 *  - POR ITEM    (1 kg de tomate ↔ 5 un): dinâmicas, porque tomate não tem
 *    peso padrão. Só existem no contexto daquele item — é exatamente o
 *    `item_id` da tabela Fatores_Conversao.
 *
 * Toda aresta por item passa por `validarConversao` na entrada, então o grafo
 * nunca contém uma multiplicação espontânea de massa.
 */

import { converter, validarConversao, getUnidade } from './unidades';

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

/** Aresta dinâmica: 1 `de` equivale a `multiplicador` `para`. */
export interface FatorItem {
  de: string;
  para: string;
  multiplicador: number;
}

/** Lote de compra — a origem do custo. Quantidade SEMPRE na unidade base. */
export interface Lote {
  id: string;
  data: string;
  /** Saldo ainda disponível, na unidade base do item. */
  quantidade: number;
  /** Custo total pago pelo saldo restante (R$). */
  custoTotal: number;
}

export interface ItemEstoque {
  id: string;
  nome: string;
  /** Unidade atômica de controle (g, ml, un...). Toda conta ancora aqui. */
  unidadeBase: string;
  fatores: FatorItem[];
  lotes: Lote[];
}

/** PEPS = primeiro a entrar, primeiro a sair. MEDIO = custo médio ponderado. */
export type MetodoCusteio = 'PEPS' | 'MEDIO';

export class ErroCusteio extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'ErroCusteio';
  }
}

// ---------------------------------------------------------------------------
// Resolução de fator: busca em largura no grafo de conversão
// ---------------------------------------------------------------------------

/**
 * Quantas unidades de `para` cabem em 1 unidade de `de`, para este item.
 *
 * BFS em vez de tabela direta porque as conversões se encadeiam: para ir de
 * `kg` a `fatias` no tomate o caminho é kg →(item, 5)→ un →(item, 3.5)→ fatias.
 * BFS garante o caminho mais curto, que é o de menor acúmulo de erro numérico.
 */
export function resolverFator(item: ItemEstoque, de: string, para: string): number {
  if (de === para) return 1;

  // Arestas por item, nos dois sentidos (a inversa é o recíproco).
  const adjacencia = new Map<string, Array<{ destino: string; fator: number }>>();
  const ligar = (a: string, b: string, f: number) => {
    if (!adjacencia.has(a)) adjacencia.set(a, []);
    adjacencia.get(a)!.push({ destino: b, fator: f });
  };
  for (const f of item.fatores) {
    if (!(f.multiplicador > 0) || !Number.isFinite(f.multiplicador)) {
      throw new ErroCusteio(`${item.nome}: fator ${f.de}→${f.para} inválido (${f.multiplicador}).`);
    }
    ligar(f.de, f.para, f.multiplicador);
    ligar(f.para, f.de, 1 / f.multiplicador);
  }

  const fila: Array<{ unidade: string; acumulado: number }> = [{ unidade: de, acumulado: 1 }];
  const visitados = new Set([de]);

  while (fila.length > 0) {
    const atual = fila.shift()!;

    // Aresta universal (mesma grandeza física) — sempre disponível, sem
    // depender de o lojista ter declarado nada.
    const universal = converter(1, atual.unidade, para);
    if (universal != null) return atual.acumulado * universal;

    for (const aresta of adjacencia.get(atual.unidade) ?? []) {
      if (visitados.has(aresta.destino)) continue;
      const acumulado = atual.acumulado * aresta.fator;
      if (aresta.destino === para) return acumulado;
      visitados.add(aresta.destino);
      fila.push({ unidade: aresta.destino, acumulado });
    }

    // Vizinhos alcançáveis por física (kg→g) mesmo sem aresta declarada.
    for (const vizinho of unidadesDaMesmaGrandeza(atual.unidade)) {
      if (visitados.has(vizinho)) continue;
      const f = converter(1, atual.unidade, vizinho);
      if (f == null) continue;
      visitados.add(vizinho);
      fila.push({ unidade: vizinho, acumulado: atual.acumulado * f });
    }
  }

  throw new ErroCusteio(
    `${item.nome}: não há caminho de conversão de "${de}" para "${para}". ` +
      `Declare o rendimento (ex.: 1 ${de} rende N ${para}).`,
  );
}

function unidadesDaMesmaGrandeza(codigo: string): string[] {
  const u = getUnidade(codigo);
  if (!u?.fatorBase) return [];
  return u.grandeza === 'massa' ? ['kg', 'g'] : u.grandeza === 'volume' ? ['L', 'ml'] : [];
}

/** Valida e registra uma aresta dinâmica, barrando multiplicação espontânea. */
export function declararFator(item: ItemEstoque, fator: FatorItem): void {
  const v = validarConversao(fator.de, fator.para, 1, fator.multiplicador);
  if (!v.ok) throw new ErroCusteio(`${item.nome}: ${v.mensagem}`);
  item.fatores.push(fator);
}

// ---------------------------------------------------------------------------
// Custo na unidade atômica
// ---------------------------------------------------------------------------

/**
 * Custo de 1 unidade BASE do item.
 *  - MEDIO: custo médio ponderado de todos os lotes com saldo.
 *  - PEPS : custo do lote mais antigo com saldo (o próximo a sair).
 */
export function custoUnitarioBase(item: ItemEstoque, metodo: MetodoCusteio = 'PEPS'): number {
  const comSaldo = item.lotes.filter((l) => l.quantidade > 0);
  if (comSaldo.length === 0) {
    throw new ErroCusteio(`${item.nome}: sem lotes em estoque — custo indefinido.`);
  }

  if (metodo === 'MEDIO') {
    const qtd = comSaldo.reduce((a, l) => a + l.quantidade, 0);
    const custo = comSaldo.reduce((a, l) => a + l.custoTotal, 0);
    return custo / qtd;
  }

  const maisAntigo = comSaldo.reduce((a, b) => (a.data <= b.data ? a : b));
  return maisAntigo.custoTotal / maisAntigo.quantidade;
}

/**
 * Custo de usar `quantidade` de `unidade` — a função recursiva do teorema:
 * converte para a base pelo grafo e multiplica pelo custo atômico.
 *
 * Ex.: 200 ml de detergente, base ml, custo 0,006/ml → R$ 1,20.
 */
export function custoDeUso(
  item: ItemEstoque,
  quantidade: number,
  unidade: string,
  metodo: MetodoCusteio = 'PEPS',
): number {
  // Quantas unidades base valem 1 `unidade` (ex.: 1 fatia = 1/3.5 un).
  const basePorUnidade = resolverFator(item, unidade, item.unidadeBase);
  return quantidade * basePorUnidade * custoUnitarioBase(item, metodo);
}

/**
 * Baixa PEPS: drena os lotes do mais antigo ao mais novo e devolve o custo
 * REAL da saída (que difere de `custoDeUso` quando a baixa cruza lotes de
 * preços diferentes). Muta os saldos — é o efeito de uma venda.
 */
export function baixarPEPS(
  item: ItemEstoque,
  quantidade: number,
  unidade: string,
): { custo: number; consumido: Array<{ loteId: string; quantidade: number; custo: number }> } {
  let restante = quantidade * resolverFator(item, unidade, item.unidadeBase);
  const disponivel = item.lotes
    .filter((l) => l.quantidade > 0)
    .sort((a, b) => a.data.localeCompare(b.data));

  const total = disponivel.reduce((a, l) => a + l.quantidade, 0);
  if (restante > total + 1e-9) {
    throw new ErroCusteio(
      `${item.nome}: baixa de ${restante.toFixed(4)} ${item.unidadeBase} ` +
        `excede o saldo de ${total.toFixed(4)}.`,
    );
  }

  const consumido: Array<{ loteId: string; quantidade: number; custo: number }> = [];
  let custo = 0;
  for (const lote of disponivel) {
    if (restante <= 1e-9) break;
    const unitario = lote.custoTotal / lote.quantidade;
    const tirar = Math.min(lote.quantidade, restante);
    const custoParcial = tirar * unitario;

    lote.quantidade -= tirar;
    lote.custoTotal -= custoParcial;
    restante -= tirar;
    custo += custoParcial;
    consumido.push({ loteId: lote.id, quantidade: tirar, custo: custoParcial });
  }
  return { custo, consumido };
}

// ---------------------------------------------------------------------------
// BOM — Bill of Materials
// ---------------------------------------------------------------------------

export interface LinhaBOM {
  itemId: string;
  quantidade: number;
  unidade: string;
}

export interface CustoBOM {
  total: number;
  linhas: Array<LinhaBOM & { nome: string; custo: number }>;
}

/**
 * Custo composto de uma receita. Ex. da salada:
 *   1 porção de alface  → R$ 0,714
 *   2 fatias de tomate  → 2 × R$ 0,3428 = R$ 0,6857
 *                                          ────────
 *                                          R$ 1,3996
 */
export function custoBOM(
  receita: LinhaBOM[],
  itens: Map<string, ItemEstoque>,
  metodo: MetodoCusteio = 'PEPS',
): CustoBOM {
  const linhas = receita.map((linha) => {
    const item = itens.get(linha.itemId);
    if (!item) throw new ErroCusteio(`Item "${linha.itemId}" não encontrado na receita.`);
    return {
      ...linha,
      nome: item.nome,
      custo: custoDeUso(item, linha.quantidade, linha.unidade, metodo),
    };
  });
  return { total: linhas.reduce((a, l) => a + l.custo, 0), linhas };
}
