/**
 * Grafo de Transformação de Insumos — visualização 3D da diluição de custos.
 *
 * Camadas:
 *  - types.ts            → modelo de dados + motor lógico (conservação de valor)
 *  - layout.ts           → distribuição espacial X/Y/Z (cone genealógico 3D)
 *  - CostGraphEngine.ts  → engine Three.js (InstancedMesh, bloom, raycaster)
 *  - CostGraph3D.tsx     → wrapper React (montagem, tooltip HTML, dispose)
 *  - dadosExemplo.ts     → dataset do caso clássico (tomate #452)
 */

export { CostGraph3D, default } from './CostGraph3D';
export { CostGraphEngine } from './CostGraphEngine';
export type { InfoHover, OpcoesEngine } from './CostGraphEngine';
export { calcularLayout } from './layout';
export type { NoPosicionado, LayoutResultado } from './layout';
export {
  construirGrafoCusto,
  auditarConservacao,
  descreverRotaCusto,
  ErroConservacao,
} from './types';
export type {
  CompraInput,
  TransformacaoInput,
  NoCusto,
  GrafoCusto,
  TipoNo,
} from './types';
export { COMPRAS_EXEMPLO } from './dadosExemplo';

// Jogo 3D — a mesma conservação de valor, em versão linha de montagem jogável.
export { extrairCadeias, CAP_ITENS } from './jogo/cadeiaJogo';
export type { CadeiaJogo, EstagioJogo, PortaJogo, TipoPorta } from './jogo/cadeiaJogo';
export { JogoTransformacaoEngine } from './jogo/JogoTransformacaoEngine';
export type { EstadoJogo, EstadoPorta, StatusPorta } from './jogo/JogoTransformacaoEngine';
export { JogoTransformacao3D } from './jogo/JogoTransformacao3D';
export { EstoqueJogo3D } from './jogo/EstoqueJogo3D';
