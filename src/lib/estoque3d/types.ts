/**
 * Modelo de dados e motor lógico do Grafo de Transformação de Insumos.
 *
 * Princípio fundamental: CONSERVAÇÃO DE VALOR.
 * O custo de uma compra nunca se perde — ele se ramifica. Cada transformação
 * (conversão de unidade, quebra, produção) consome uma quantidade do nó pai e
 * produz uma quantidade do nó filho; o custo alocado ao filho é exatamente
 * `custoUnitarioPai × quantidadeConsumida`. A soma dos custos alocados aos
 * filhos + o custo residual do pai é sempre igual ao custo original.
 */

import { validarConversao } from '../unidades';

// ---------------------------------------------------------------------------
// Entrada (vem do backend / Supabase)
// ---------------------------------------------------------------------------

/** Uma transformação de estoque: consome X do pai, produz Y do filho. */
export interface TransformacaoInput {
  id: string;
  /** Nome do produto resultante (ex.: "Tomate unidade", "Fatia de tomate"). */
  produto: string;
  /** Unidade do produto resultante (ex.: "un", "fatia"). */
  unidade: string;
  /** Quantidade consumida do nó pai, na unidade do pai (ex.: 10 kg, 2 un). */
  quantidadeConsumida: number;
  /** Quantidade produzida do filho, na unidade do filho (ex.: 50 un, 7 fatias). */
  quantidadeProduzida: number;
  /** Data da transformação (ISO) — usada para destacar nós recém-fracionados. */
  data?: string;
  /** Transformações seguintes (a quebra da quebra). */
  filhos?: TransformacaoInput[];
}

/** A compra original: a raiz da árvore genealógica do custo. */
export interface CompraInput {
  id: string;
  produto: string;
  unidade: string;
  quantidade: number;
  custoTotal: number;
  data: string;
  transformacoes: TransformacaoInput[];
}

// ---------------------------------------------------------------------------
// Saída (grafo pronto para o layout 3D)
// ---------------------------------------------------------------------------

export type TipoNo = 'compra' | 'conversao' | 'producao';

export interface NoCusto {
  id: string;
  paiId: string | null;
  tipo: TipoNo;
  rotulo: string;
  unidade: string;
  /** Quantidade física deste lote/fração (na unidade do nó). */
  quantidade: number;
  /** Custo herdado do pai (R$). Para a compra, é o custoTotal. */
  custoAlocado: number;
  /** custoAlocado / quantidade — alimenta a escala de calor da cor. */
  custoUnitario: number;
  /** Profundidade na árvore (0 = compra original). */
  profundidade: number;
  /** Id da compra raiz — usado no tooltip ("Origem: Compra #452"). */
  compraOrigemId: string;
  /** Custos já drenados pelos filhos (para auditoria de conservação). */
  custoConsumidoPelosFilhos: number;
  /** true quando a transformação é recente → brilho seletivo (bloom). */
  destacar: boolean;
  filhos: NoCusto[];
}

export interface GrafoCusto {
  raizes: NoCusto[];
  /** Lista achatada, na mesma ordem dos índices do InstancedMesh. */
  nos: NoCusto[];
  /** Arestas pai → filho como pares de índices em `nos`. */
  arestas: Array<[number, number]>;
}

export class ErroConservacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroConservacao';
  }
}

const EPSILON = 1e-6;

/** Janela (ms) em que uma transformação é considerada "recém-fracionada". */
const JANELA_DESTAQUE_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

/**
 * Constrói o grafo de custo a partir das compras, aplicando a matemática da
 * diluição e as blindagens de conservação (valor e dimensional).
 *
 * Exemplo clássico:
 *   Compra: 10 kg por R$ 60  → custoUnitario = 60/10 = R$ 6,00/kg
 *   Conversão: consome 10 kg, produz 50 un → custoAlocado = 6×10 = R$ 60
 *              → custoUnitario = 60/50 = R$ 1,20/un
 *   Produção: consome 2 un (R$ 2,40), produz 7 fatias
 *              → custoUnitario = 2,40/7 ≈ R$ 0,34/fatia
 */
export function construirGrafoCusto(
  compras: CompraInput[],
  agora: number = Date.now(),
): GrafoCusto {
  const nos: NoCusto[] = [];
  const arestas: Array<[number, number]> = [];
  const raizes: NoCusto[] = [];

  for (const compra of compras) {
    validarPositivo(compra.quantidade, `Compra ${compra.id}: quantidade`);
    validarPositivo(compra.custoTotal, `Compra ${compra.id}: custoTotal`);

    const raiz: NoCusto = {
      id: compra.id,
      paiId: null,
      tipo: 'compra',
      rotulo: `${compra.produto} (${compra.quantidade} ${compra.unidade})`,
      unidade: compra.unidade,
      quantidade: compra.quantidade,
      custoAlocado: compra.custoTotal,
      custoUnitario: compra.custoTotal / compra.quantidade,
      profundidade: 0,
      compraOrigemId: compra.id,
      custoConsumidoPelosFilhos: 0,
      destacar: false,
      filhos: [],
    };
    raizes.push(raiz);
    const indiceRaiz = nos.push(raiz) - 1;

    // Estoque disponível do pai para drenar (em unidades do pai).
    let estoqueRestantePai = compra.quantidade;
    expandir(
      raiz,
      compra.transformacoes ?? [],
      estoqueRestantePai,
      nos,
      arestas,
      indiceRaiz,
      agora,
    );
    estoqueRestantePai = raiz.quantidade - raiz.filhos.reduce(
      (acc, f) => acc + consumoDoFilho(f),
      0,
    );
  }

  return { raizes, nos, arestas };
}

// Consumo original registrado na aresta (guardado no próprio nó filho via closure).
const consumoPorNo = new WeakMap<NoCusto, number>();
function consumoDoFilho(no: NoCusto): number {
  return consumoPorNo.get(no) ?? 0;
}

function expandir(
  pai: NoCusto,
  transformacoes: TransformacaoInput[],
  estoqueDisponivelPai: number,
  nos: NoCusto[],
  arestas: Array<[number, number]>,
  indicePai: number,
  agora: number,
): void {
  let consumidoAcumulado = 0;

  for (const t of transformacoes) {
    validarPositivo(t.quantidadeConsumida, `${t.produto}: quantidadeConsumida`);
    validarPositivo(t.quantidadeProduzida, `${t.produto}: quantidadeProduzida`);

    // --- Blindagem 1: estoque não pode ficar negativo ---------------------
    if (consumidoAcumulado + t.quantidadeConsumida > estoqueDisponivelPai + EPSILON) {
      throw new ErroConservacao(
        `${t.produto}: tentativa de consumir ${t.quantidadeConsumida} ${pai.unidade} ` +
          `de "${pai.rotulo}", mas só restam ${estoqueDisponivelPai - consumidoAcumulado}.`,
      );
    }

    // --- Blindagem 2: conservação dimensional (1 kg nunca vira 10 kg) -----
    // OBRIGATÓRIA, não opcional: delega ao registro canônico de unidades, que
    // conhece a grandeza de cada código e aplica Q_d·F_d ≤ Q_o·F_o. Se o dado
    // veio torto do banco, ele para aqui — não vira pixel na tela.
    const conversao = validarConversao(
      pai.unidade,
      t.unidade,
      t.quantidadeConsumida,
      t.quantidadeProduzida,
    );
    if (!conversao.ok) {
      throw new ErroConservacao(`${t.produto}: ${conversao.mensagem}`);
    }

    // --- A matemática da diluição (conservação de valor) -------------------
    const custoAlocado = pai.custoUnitario * t.quantidadeConsumida;
    const filho: NoCusto = {
      id: t.id,
      paiId: pai.id,
      tipo: pai.tipo === 'compra' ? 'conversao' : 'producao',
      rotulo: t.produto,
      unidade: t.unidade,
      quantidade: t.quantidadeProduzida,
      custoAlocado,
      custoUnitario: custoAlocado / t.quantidadeProduzida,
      profundidade: pai.profundidade + 1,
      compraOrigemId: pai.compraOrigemId,
      custoConsumidoPelosFilhos: 0,
      destacar: t.data != null && agora - new Date(t.data).getTime() < JANELA_DESTAQUE_MS,
      filhos: [],
    };
    consumoPorNo.set(filho, t.quantidadeConsumida);

    pai.filhos.push(filho);
    pai.custoConsumidoPelosFilhos += custoAlocado;
    consumidoAcumulado += t.quantidadeConsumida;

    const indiceFilho = nos.push(filho) - 1;
    arestas.push([indicePai, indiceFilho]);

    // Recursão: o filho drena no máximo o que ele próprio produziu.
    expandir(
      filho,
      t.filhos ?? [],
      t.quantidadeProduzida,
      nos,
      arestas,
      indiceFilho,
      agora,
    );
  }
}

function validarPositivo(valor: number, campo: string): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErroConservacao(`${campo} deve ser um número finito e positivo (recebido: ${valor}).`);
  }
}

/**
 * Auditoria de conservação: para cada nó, custoAlocado ≈ custoConsumidoPelosFilhos
 * + custo residual. Retorna o desvio máximo absoluto (deve ser ~0).
 */
export function auditarConservacao(grafo: GrafoCusto): number {
  let desvioMax = 0;
  const visitar = (no: NoCusto): number => {
    const drenado = no.filhos.reduce((acc, f) => acc + visitar(f), 0);
    const residual = no.custoAlocado - drenado;
    if (residual < -EPSILON) {
      desvioMax = Math.max(desvioMax, Math.abs(residual));
    }
    return no.custoAlocado;
  };
  grafo.raizes.forEach(visitar);
  return desvioMax;
}

/** Formata a rota matemática do custo para o tooltip HTML. */
export function descreverRotaCusto(no: NoCusto): string {
  const custo = no.custoUnitario.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  return `${no.rotulo}: ${custo}/${no.unidade} — Origem: Compra #${no.compraOrigemId}`;
}
