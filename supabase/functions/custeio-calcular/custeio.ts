/**
 * Motor de custeio PEPS/Médio do MiseOn.
 *
 * CÓPIA AUTORIZADA para o runtime Deno da Edge Function.
 * Fonte de verdade: src/lib/custeio.ts
 *
 * Mantida em sincronia manual. Qualquer alteração em custeio.ts DEVE ser
 * refletida aqui. A Edge Function usa este módulo para garantir que a lógica
 * que grava custos no banco é EXATAMENTE a mesma que calcula na UI.
 */

import { converter, validarConversao, getUnidade } from './unidades.ts';

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

export interface FatorItem {
  de: string;
  para: string;
  multiplicador: number;
}

export interface Lote {
  id: string;
  data: string;
  quantidade: number;
  custoTotal: number;
}

export interface ItemEstoque {
  id: string;
  nome: string;
  unidadeBase: string;
  fatores: FatorItem[];
  lotes: Lote[];
}

export type MetodoCusteio = 'PEPS' | 'MEDIO';

export class ErroCusteio extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'ErroCusteio';
  }
}

// ---------------------------------------------------------------------------
// BFS de resolução de fator
// ---------------------------------------------------------------------------

export function resolverFator(item: ItemEstoque, de: string, para: string): number {
  if (de === para) return 1;

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

    const universal = converter(1, atual.unidade, para);
    if (universal != null) return atual.acumulado * universal;

    for (const aresta of adjacencia.get(atual.unidade) ?? []) {
      if (visitados.has(aresta.destino)) continue;
      const acumulado = atual.acumulado * aresta.fator;
      if (aresta.destino === para) return acumulado;
      visitados.add(aresta.destino);
      fila.push({ unidade: aresta.destino, acumulado });
    }

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

export function declararFator(item: ItemEstoque, fator: FatorItem): void {
  const v = validarConversao(fator.de, fator.para, 1, fator.multiplicador);
  if (!v.ok) throw new ErroCusteio(`${item.nome}: ${v.mensagem}`);
  item.fatores.push(fator);
}

// ---------------------------------------------------------------------------
// Custo na unidade atômica
// ---------------------------------------------------------------------------

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

export function custoDeUso(
  item: ItemEstoque,
  quantidade: number,
  unidade: string,
  metodo: MetodoCusteio = 'PEPS',
): number {
  const basePorUnidade = resolverFator(item, unidade, item.unidadeBase);
  return quantidade * basePorUnidade * custoUnitarioBase(item, metodo);
}

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
