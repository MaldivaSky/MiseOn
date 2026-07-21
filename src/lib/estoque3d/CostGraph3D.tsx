/**
 * CostGraph3D — wrapper React da engine Three.js do Grafo de Transformação.
 *
 * Responsabilidades (a engine cuida do WebGL; o React cuida do DOM):
 *  - Monta/desmonta a `CostGraphEngine` no ciclo de vida do componente,
 *    garantindo o `dispose()` (sem memory leak) ao desmontar.
 *  - Recebe o grafo já construído OU as compras cruas (constrói aqui).
 *  - Renderiza a LABEL HTML sobreposta seguindo o mouse no hover, e um
 *    painel de detalhe fixo ao selecionar um nó (clique) — a "rota do custo".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CostGraphEngine, type InfoHover } from './CostGraphEngine';
import { construirGrafoCusto, descreverRotaCusto } from './types';
import type { CompraInput, GrafoCusto, NoCusto } from './types';
import './CostGraph3D.css';

interface PropsBase {
  /** Altura do canvas (o pai controla a largura). Default 520px. */
  altura?: number | string;
  corFundo?: number;
  onSelecionar?: (no: NoCusto) => void;
}

type Props =
  | (PropsBase & { grafo: GrafoCusto; compras?: never })
  | (PropsBase & { compras: CompraInput[]; grafo?: never });

const brl = (v: number, casas = 2) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: casas,
  });

const ROTULO_TIPO: Record<NoCusto['tipo'], string> = {
  compra: 'Compra',
  conversao: 'Conversão',
  producao: 'Produção',
};

export function CostGraph3D(props: Props) {
  const { altura = 520, corFundo, onSelecionar } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CostGraphEngine | null>(null);

  const [hover, setHover] = useState<InfoHover | null>(null);
  const [selecionado, setSelecionado] = useState<NoCusto | null>(null);

  // Constrói o grafo uma vez a partir das compras (ou usa o já pronto).
  // Envolto em try/catch: uma violação de conservação vira mensagem visível
  // em vez de derrubar a árvore de componentes.
  const { grafo, erro } = useMemo(() => {
    try {
      if ('grafo' in props && props.grafo) return { grafo: props.grafo, erro: null };
      return { grafo: construirGrafoCusto(props.compras!), erro: null };
    } catch (e) {
      return { grafo: null, erro: e instanceof Error ? e.message : String(e) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(props as { grafo?: GrafoCusto }).grafo, (props as { compras?: CompraInput[] }).compras]);

  // Monta a engine uma única vez (o container não muda de identidade).
  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new CostGraphEngine(containerRef.current, {
      corFundo,
      onHover: setHover,
      onSelect: (no) => {
        setSelecionado(no);
        onSelecionar?.(no);
      },
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Injeta/atualiza os dados sempre que o grafo mudar.
  useEffect(() => {
    if (grafo && engineRef.current) engineRef.current.setData(grafo);
  }, [grafo]);

  // Converte as coords de viewport (clientX/Y) da label para coords relativas
  // ao container — assim a label funciona mesmo com scroll/transform no pai.
  const posLabel = (() => {
    if (!hover || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return { left: hover.telaX - rect.left, top: hover.telaY - rect.top };
  })();

  if (erro) {
    return (
      <div className="mo-cg3d-erro" style={{ height: altura }}>
        <strong>Grafo bloqueado pela conservação de valor</strong>
        <span>{erro}</span>
      </div>
    );
  }

  return (
    <div className="mo-cg3d" style={{ height: altura }}>
      <div ref={containerRef} className="mo-cg3d-canvas" />

      {/* Label HTML sobreposta que segue o mouse no hover */}
      {hover && posLabel && (
        <div
          className="mo-cg3d-tooltip"
          style={{ left: posLabel.left, top: posLabel.top }}
          role="tooltip"
        >
          {descreverRotaCusto(hover.no)}
        </div>
      )}

      {/* Legenda da escala de calor */}
      <div className="mo-cg3d-legenda">
        <span>barato</span>
        <i className="mo-cg3d-gradiente" />
        <span>caro / un</span>
      </div>

      {/* Painel de detalhe da fração selecionada (clique) */}
      {selecionado && (
        <aside className="mo-cg3d-painel">
          <header>
            <span className="mo-cg3d-badge">{ROTULO_TIPO[selecionado.tipo]}</span>
            <button
              className="mo-cg3d-fechar"
              onClick={() => setSelecionado(null)}
              aria-label="Fechar"
            >
              ×
            </button>
          </header>
          <h4>{selecionado.rotulo}</h4>
          <dl>
            <div>
              <dt>Quantidade</dt>
              <dd>
                {selecionado.quantidade} {selecionado.unidade}
              </dd>
            </div>
            <div>
              <dt>Custo unitário</dt>
              <dd>
                {brl(selecionado.custoUnitario, 4)}/{selecionado.unidade}
              </dd>
            </div>
            <div>
              <dt>Custo alocado</dt>
              <dd>{brl(selecionado.custoAlocado)}</dd>
            </div>
            <div>
              <dt>Já fracionado</dt>
              <dd>{brl(selecionado.custoConsumidoPelosFilhos)}</dd>
            </div>
            <div>
              <dt>Origem</dt>
              <dd>Compra #{selecionado.compraOrigemId}</dd>
            </div>
          </dl>
        </aside>
      )}
    </div>
  );
}

export default CostGraph3D;
