/**
 * Grafo de Transformação de Insumos — visualização 3D da diluição de custos.
 *
 * Camadas:
 *  - types.ts            → modelo de dados + motor lógico (conservação de valor)
 *  - layout.ts           → distribuição espacial X/Y/Z (cone genealógico 3D)
 *  - CostGraphEngine.ts  → engine Three.js (InstancedMesh, bloom, raycaster)
 *  - CostGraph3D.tsx     → wrapper React (montagem, tooltip HTML, dispose)
 *  - dadosExemplo.ts     → dataset do caso clássico (tomate #452)
 *  - rastreio/           → Rastreio 3D: todos os itens por categoria, com a
 *                         cadeia compra → uso, custos reais e etapas humanas
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

// Rastreio 3D — prancha operacional de todos os itens, por categoria.
export { carregarRastreio, montarRastreio } from './rastreio/carregarRastreio';
export type {
  CategoriaRastreio,
  ItemRastreio,
  EstagioItem,
  EstadoItem,
  OrigemCusto,
} from './rastreio/carregarRastreio';
export { RastreioEngine, contagemVisual, ITENS_POR_PAGINA } from './rastreio/RastreioEngine';
export type { OpcoesRastreio, HoverRastreio } from './rastreio/RastreioEngine';
export { Rastreio3D } from './rastreio/Rastreio3D';
export { EstoqueRastreio3D } from './rastreio/EstoqueRastreio3D';
