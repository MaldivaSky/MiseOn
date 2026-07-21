/**
 * Cadeia linear de transformação — o modelo de dados do Jogo 3D.
 *
 * O grafo de custo é uma ÁRVORE (uma compra pode se ramificar em várias
 * quebras), mas o jogo precisa de uma LINHA: Compra → Armazenado → Quebra →
 * Uso, como no fluxo desenhado pelo usuário. Este módulo "achata" cada raiz
 * do grafo na sua cadeia principal.
 *
 * Decisões e o "porquê" de cada uma:
 *
 *  - CADEIA PRINCIPAL = sempre o filho de MAIOR custoAlocado. É o caminho por
 *    onde o dinheiro fluiu com mais força — o ramo mais relevante para contar
 *    a história do custo. Desempate: o primeiro registrado (ordem estável).
 *  - UMA PORTA ENTRE DOIS ESTÁGIOS. O tipo nasce do tipo do nó destino:
 *    'conversao' → portal FÍSICO (cx→kg, kg→un: a física/dimensão executa
 *    sozinha, o humano só conferiu); 'producao' → portal HUMANO ⚠️ (quebrar
 *    em fatias, montar a porção: alguém precisa REGISTRAR a quebra — é o
 *    momento de fricção real da operação, e é ele que o jogo gamifica).
 *  - CAP_VISUAL (CAP_ITENS): a cena desenha no máximo 40 objetos por estágio.
 *    Acima disso a GPU aguenta, mas o olho não distingue — então o excedente
 *    vira um contador "+N" ao lado do grupo. Os NÚMEROS (HUD/cartões) sempre
 *    mostram a quantidade real; o cap é só da representação simbólica.
 */

import type { GrafoCusto, NoCusto } from '../types';

export type TipoPorta = 'fisica' | 'humana';

export interface EstagioJogo {
  /** Nó do grafo neste estágio (índice 0 = a compra, raiz da cadeia). */
  no: NoCusto;
  /** Objetos 3D a desenhar: min(round(quantidade), CAP_ITENS) — SEMPRE inteiro ≥ 1. */
  itensVisiveis: number;
  /** round(quantidade) - CAP_ITENS, quando estoura o cap visual (senão 0). */
  excedente: number;
}

export interface PortaJogo {
  /** Portal ANTES do estágio i (1..n-1): conecta estagios[i-1] → estagios[i]. */
  indice: number;
  /** 'fisica' quando o destino é uma conversão; 'humana' quando é produção. */
  tipo: TipoPorta;
  /** quantidadeProduzida / quantidadeConsumida (arredondar só na exibição). */
  multiplicador: number;
  /** Quantidade REAL produzida nesta etapa — também é o placar da porta. */
  quantidadeProduzida: number;
}

export interface CadeiaJogo {
  raiz: NoCusto;
  /** [compra, ...cadeia principal] — sempre ≥ 1 estágio. */
  estagios: EstagioJogo[];
  /** length = estagios.length - 1 (cadeia sem transformação não tem portas). */
  portas: PortaJogo[];
  /** true quando algum nó da cadeia tem > 1 filho (a árvore sai da linha). */
  temRamificacao: boolean;
}

/**
 * Teto de objetos 3D por estágio. 40 = grade 7×6: ainda dá para "contar de
 * olho", sem pagar o custo visual de centenas de instâncias idênticas.
 */
export const CAP_ITENS = 40;

/**
 * Extrai uma CadeiaJogo por raiz do grafo, seguindo o ramo de maior
 * custoAlocado em cada bifurcação.
 *
 * A quantidade consumida de cada elo é derivada por conservação de valor:
 * `filho.custoAlocado / pai.custoUnitario` — exata por construção do grafo,
 * então o multiplicador exibido bate com o que foi registrado no estoque.
 *
 * Ordenação: cadeias por raiz.custoAlocado desc — a compra mais cara (a que
 * mais merece atenção do lojista) aparece primeiro no seletor.
 */
export function extrairCadeias(grafo: GrafoCusto): CadeiaJogo[] {
  const cadeias: CadeiaJogo[] = [];

  for (const raiz of grafo.raizes) {
    // Caminha da raiz até a folha, sempre pelo filho mais "caro".
    const linha: NoCusto[] = [raiz];
    let temRamificacao = raiz.filhos.length > 1;
    let atual = raiz;
    while (atual.filhos.length > 0) {
      let melhor = atual.filhos[0];
      for (const filho of atual.filhos) {
        if (filho.custoAlocado > melhor.custoAlocado) melhor = filho;
      }
      linha.push(melhor);
      atual = melhor;
      if (atual.filhos.length > 1) temRamificacao = true;
    }

    const estagios: EstagioJogo[] = linha.map((no) => {
      // BLINDAGEM (causa raiz do crash "isVector3"): a cena só entende contagem
      // INTEIRA de instâncias, mas dados reais trazem frações (2,5 kg, 7,33 un
      // — nascem de divisões como qtdBase / multiplicadorTotal). Uma contagem
      // fracionária trunca o Float32Array de posições e o loop lê além do fim
      // → undefined → Matrix4.setPosition(undefined) → tela azul. Arredonda
      // aqui, no contrato, com piso de 1: símbolo nunca some nem quebra a GPU.
      const inteira = Math.max(1, Math.round(no.quantidade));
      return {
        no,
        itensVisiveis: Math.min(inteira, CAP_ITENS),
        excedente: Math.max(0, inteira - CAP_ITENS),
      };
    });

    const portas: PortaJogo[] = [];
    for (let i = 1; i < linha.length; i++) {
      const pai = linha[i - 1];
      const filho = linha[i];
      // Conservação de valor: o filho herdou custoUnitarioPai × consumido.
      const consumida = filho.custoAlocado / pai.custoUnitario;
      portas.push({
        indice: i,
        tipo: filho.tipo === 'conversao' ? 'fisica' : 'humana',
        multiplicador: filho.quantidade / consumida,
        quantidadeProduzida: filho.quantidade,
      });
    }

    cadeias.push({ raiz, estagios, portas, temRamificacao });
  }

  cadeias.sort((a, b) => b.raiz.custoAlocado - a.raiz.custoAlocado);
  return cadeias;
}
