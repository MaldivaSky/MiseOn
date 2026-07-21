/**
 * Layout espacial do Grafo de Transformação de Insumos.
 *
 * Geometria escolhida: "cone genealógico invertido" (sunburst 3D).
 *
 *  - Cada compra raiz recebe um setor angular do círculo completo,
 *    proporcional à sua fatia do custo total (quem pesa mais no caixa
 *    ocupa mais espaço visual).
 *  - Cada nível de profundidade desce um degrau em Y e afasta-se do eixo
 *    central em raio crescente — a árvore cresce para baixo e para fora,
 *    como raízes, deixando a ramificação das quebras visualmente óbvia.
 *  - Dentro do setor do pai, cada filho recebe um subsetor proporcional ao
 *    seu custo alocado. Isso é a conservação de valor desenhada no espaço:
 *    os ângulos dos filhos somam exatamente o ângulo do pai, assim como os
 *    custos dos filhos somam (no máximo) o custo do pai.
 *
 * Escala (tamanho do nó): raio ∝ ∛quantidade, porque o volume de uma esfera
 * cresce com r³ — assim o volume renderizado fica linear na quantidade
 * física, que é a intuição correta. Como unidades não são comparáveis
 * (kg vs un vs fatia), a normalização é feita por unidade de medida.
 *
 * Cor (escala de calor): custoUnitario normalizado em escala logarítmica
 * (custos unitários variam por ordens de grandeza entre níveis) mapeado em
 * matiz HSL de azul-frio (barato) para vermelho-quente (caro por unidade).
 */

import type { GrafoCusto, NoCusto } from './types';

export interface NoPosicionado {
  no: NoCusto;
  indice: number;
  x: number;
  y: number;
  z: number;
  /** Raio da esfera (já em unidades de mundo). */
  raio: number;
  /** Componentes RGB em [0,1] da escala de calor (sem boost de brilho). */
  cor: [number, number, number];
}

export interface LayoutResultado {
  posicionados: NoPosicionado[];
  /** Raio máximo atingido — útil para enquadrar a câmera. */
  raioMaximo: number;
  profundidadeMaxima: number;
}

// Parâmetros da geometria do cone (unidades de mundo).
const RAIO_BASE = 6; // raio do anel das compras (profundidade 0)
const PASSO_RADIAL = 4.2; // quanto cada nível se afasta do eixo
const PASSO_VERTICAL = 2.6; // quanto cada nível desce
const RAIO_NO_MAX = 1.1; // tamanho máximo de um nó
const FOLGA_ANGULAR = 0.06; // respiro entre subsetores (radianos)

export function calcularLayout(grafo: GrafoCusto): LayoutResultado {
  const { nos } = grafo;
  if (nos.length === 0) {
    return { posicionados: [], raioMaximo: RAIO_BASE, profundidadeMaxima: 0 };
  }

  // --- Normalizações globais ------------------------------------------------
  // Escala de calor em log: mapeia [log(minCusto), log(maxCusto)] → t ∈ [0,1].
  let minCusto = Infinity;
  let maxCusto = -Infinity;
  // Maior quantidade por unidade (para o volume ser comparável só dentro da
  // mesma unidade — 50 "un" não devem esmagar 10 "kg" por acidente de escala).
  const maxQtdPorUnidade = new Map<string, number>();

  for (const no of nos) {
    if (no.custoUnitario < minCusto) minCusto = no.custoUnitario;
    if (no.custoUnitario > maxCusto) maxCusto = no.custoUnitario;
    const atual = maxQtdPorUnidade.get(no.unidade) ?? 0;
    if (no.quantidade > atual) maxQtdPorUnidade.set(no.unidade, no.quantidade);
  }
  const logMin = Math.log(minCusto);
  const logMax = Math.log(maxCusto);
  const amplitudeLog = Math.max(logMax - logMin, 1e-9);

  // --- Atribuição de setores angulares --------------------------------------
  // Cada raiz recebe um arco de 2π proporcional ao seu custo total.
  const custoTotalGeral = grafo.raizes.reduce((acc, r) => acc + r.custoAlocado, 0);

  const posicionados: NoPosicionado[] = new Array(nos.length);
  const indicePorId = new Map(nos.map((no, i) => [no.id, i]));

  let anguloCursor = 0;
  let profundidadeMaxima = 0;

  const posicionar = (
    no: NoCusto,
    setorInicio: number,
    setorFim: number,
  ): void => {
    const angulo = (setorInicio + setorFim) / 2;
    const raioAnel = RAIO_BASE + no.profundidade * PASSO_RADIAL;
    const x = Math.cos(angulo) * raioAnel;
    const z = Math.sin(angulo) * raioAnel;
    const y = -no.profundidade * PASSO_VERTICAL;

    // Volume ∝ quantidade → raio ∝ ∛(q / qMax da unidade), com piso mínimo
    // para que frações minúsculas continuem clicáveis.
    const qMax = maxQtdPorUnidade.get(no.unidade) ?? no.quantidade;
    const proporcao = Math.cbrt(no.quantidade / qMax);
    const raio = Math.max(0.28, proporcao * RAIO_NO_MAX);

    // Escala de calor: matiz 0.66 (azul) → 0.0 (vermelho).
    const t = (Math.log(no.custoUnitario) - logMin) / amplitudeLog;
    const cor = hslParaRgb(0.66 * (1 - t), 0.85, 0.55);

    const indice = indicePorId.get(no.id)!;
    posicionados[indice] = { no, indice, x, y, z, raio, cor };
    if (no.profundidade > profundidadeMaxima) profundidadeMaxima = no.profundidade;

    // Subdivide o setor do pai entre os filhos, ponderado pelo custo alocado.
    // O que sobrou de custo no pai (residual não transformado) vira folga
    // angular — espaço vazio que "guarda" o estoque ainda não fracionado.
    const custoFilhos = no.filhos.reduce((acc, f) => acc + f.custoAlocado, 0);
    if (no.filhos.length > 0 && custoFilhos > 0) {
      const largura = setorFim - setorInicio;
      let cursor = setorInicio;
      for (const filho of no.filhos) {
        const fatia = (filho.custoAlocado / custoFilhos) * largura;
        const folga = Math.min(FOLGA_ANGULAR, fatia * 0.15);
        posicionar(filho, cursor + folga / 2, cursor + fatia - folga / 2);
        cursor += fatia;
      }
    }
  };

  for (const raiz of grafo.raizes) {
    const arco = (raiz.custoAlocado / custoTotalGeral) * Math.PI * 2;
    posicionar(raiz, anguloCursor, anguloCursor + arco);
    anguloCursor += arco;
  }

  const raioMaximo = RAIO_BASE + profundidadeMaxima * PASSO_RADIAL + RAIO_NO_MAX;
  return { posicionados, raioMaximo, profundidadeMaxima };
}

/** Converte HSL (h, s, l ∈ [0,1]) para RGB ∈ [0,1] — sem depender de THREE. */
function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const canal = (n: number): number => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [canal(0), canal(8), canal(4)];
}
