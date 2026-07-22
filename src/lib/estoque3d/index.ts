/**
 * Grafo de Transformação de Insumos — visualização 3D da diluição de custos.
 *
 * Camadas:
 *  - types.ts            → modelo de dados + motor lógico (conservação de valor)
 *  - layout.ts           → distribuição espacial X/Y/Z (cone genealógico 3D)
 *  - CostGraphEngine.ts  → engine Three.js (InstancedMesh, bloom, raycaster)
 *  - CostGraph3D.tsx     → wrapper React (montagem, tooltip HTML, dispose)
 *  - dadosExemplo.ts     → dataset do caso clássico (tomate #452)
 *  - rastreio/           → Rastreio 3D: TODOS os itens por setor físico
 *                         (geladeira/armário/dispensa), com a cadeia
 *                         compra → uso, custos reais (PEPS → médio → cadastro),
 *                         etapas humanas ⚠️ e checagem de receitas na cena
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

// ── Rastreio 3D — corredor operacional de todos os itens, por setor ────────
export { carregarRastreio, montarRastreio } from './rastreio/carregarRastreio';
export type {
  SetorRastreio,
  ItemRastreio,
  EstagioItem,
  EstadoItem,
  LinhaInsumoRastreio,
  LinhaCustoView,
  LinhaFatorRastreio,
} from './rastreio/carregarRastreio';
export {
  SETORES,
  ORDEM_SETORES,
  OPCOES_SETOR,
  derivarSetor,
  validarSetor,
} from './rastreio/setores';
export type { Setor, SetorId } from './rastreio/setores';
export { verificarReceita, carregarDadosReceitas } from './rastreio/receitas';
export type {
  DadosReceitas,
  ReceitaCheck,
  ReceitaResumo,
  IngredienteCheck,
} from './rastreio/receitas';
export { RastreioEngine, contagemVisual } from './rastreio/RastreioEngine';
export type { OpcoesRastreio } from './rastreio/RastreioEngine';
export { Rastreio3D } from './rastreio/Rastreio3D';
export { EstoqueRastreio3D } from './rastreio/EstoqueRastreio3D';
