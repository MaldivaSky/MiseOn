/**
 * Rastreio3D — wrapper React da RastreioEngine (a engine cuida do WebGL;
 * o React cuida do DOM: chips de categoria, busca, paginação, HUD, painel).
 *
 * Robustez: TODA chamada à engine (construção e setCategoria) é envolta em
 * try/catch que degrada para `.mo-r3d-falha` — um problema no WebGL nunca
 * derruba a árvore React da página de estoque.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, AlertTriangle } from 'lucide-react';
import {
  RastreioEngine,
  ITENS_POR_PAGINA,
  type HoverRastreio,
} from './RastreioEngine';
import type {
  CategoriaRastreio,
  EstadoItem,
  ItemRastreio,
  OrigemCusto,
} from './carregarRastreio';
import './Rastreio3D.css';

interface Props {
  categorias: CategoriaRastreio[];
  /** Altura do canvas (o pai controla a largura). Default 560px. */
  altura?: number | string;
}

const brl = (v: number, casas = 2) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: casas,
  });

const fmtQtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const ROTULO_ESTADO: Record<EstadoItem, string> = {
  ok: 'em dia',
  critico: 'crítico',
  sem_estoque: 'sem estoque',
  sem_custo: 'sem custo',
  alerta_desvio: 'desvio de custo',
};

const ROTULO_ORIGEM: Record<Exclude<OrigemCusto, null>, string> = {
  peps: 'PEPS (lote mais antigo)',
  medio: 'médio ponderado dos lotes',
  cadastro: 'cadastro (preço de embalagem)',
};

/** Busca pt-BR: ignora acentos e caixa ("acucar" acha "Açúcar"). */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function Rastreio3D({ categorias, altura = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RastreioEngine | null>(null);

  const [catIdx, setCatIdx] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<ItemRastreio | null>(null);
  const [hover, setHover] = useState<HoverRastreio | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const categoria = categorias[Math.min(catIdx, categorias.length - 1)];

  // Itens da categoria filtrados pela busca (a paginação opera sobre o filtro).
  const itensFiltrados = useMemo(() => {
    if (!categoria) return [];
    const q = normalizar(busca);
    if (!q) return categoria.itens;
    return categoria.itens.filter((i) => normalizar(i.nome).includes(q));
  }, [categoria, busca]);

  const totalPaginas = Math.max(1, Math.ceil(itensFiltrados.length / ITENS_POR_PAGINA));
  const paginaEfetiva = Math.min(pagina, totalPaginas - 1);
  const itensPagina = itensFiltrados.slice(
    paginaEfetiva * ITENS_POR_PAGINA,
    paginaEfetiva * ITENS_POR_PAGINA + ITENS_POR_PAGINA,
  );

  const movimentoReduzido = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    [],
  );

  // Monta a engine uma única vez (o container não muda de identidade).
  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const engine = new RastreioEngine(containerRef.current, {
        movimentoReduzido,
        onHover: setHover,
        onSelecionar: (item) => setSelecionado(item),
      });
      engineRef.current = engine;
      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    } catch (e) {
      setFalha(e instanceof Error ? e.message : String(e));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Empurra a página atual para a engine sempre que filtro/página mudarem.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !categoria) return;
    try {
      engine.setCategoria({ ...categoria, itens: itensFiltrados }, paginaEfetiva);
      // Seleção fora da página visível não sobrevive à troca de cena.
      if (selecionado && !itensPagina.some((i) => i.insumoId === selecionado.insumoId)) {
        setSelecionado(null);
      }
    } catch (e) {
      setFalha(e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, itensFiltrados, paginaEfetiva]);

  const trocarCategoria = (idx: number) => {
    setCatIdx(idx);
    setPagina(0);
    setBusca('');
    setSelecionado(null);
  };

  const selecionarNoCartao = (item: ItemRastreio | null) => {
    setSelecionado(item);
    try {
      engineRef.current?.selecionar(item?.insumoId ?? null);
    } catch {
      /* seleção visual é enfeite; nunca derruba a UI */
    }
  };

  // Converte coords de viewport do hover para coords relativas ao container.
  const posTooltip = (() => {
    if (!hover || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return { left: hover.telaX - rect.left, top: hover.telaY - rect.top };
  })();

  if (falha) {
    return (
      <div className="mo-r3d-falha" style={{ height: altura }} role="alert">
        <AlertTriangle size={22} />
        <strong>A visualização 3D não pôde ser iniciada</strong>
        <span>{falha}</span>
      </div>
    );
  }

  if (!categoria) return null;

  return (
    <div className="space-y-3">
      {/* Chips de categoria + busca */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar flex-1 min-w-0">
          {categorias.map((cat, idx) => (
            <button
              key={cat.nome}
              onClick={() => trocarCategoria(idx)}
              className={`shrink-0 px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                idx === catIdx
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {cat.nome} ({cat.itens.length})
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar item…"
            aria-label="Buscar item na categoria"
            className="w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 py-1.5 pl-8 pr-3 text-xs dark:text-gray-200 outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Palco 3D */}
      <div
        className="mo-r3d"
        style={{ height: altura }}
        role="application"
        aria-label={`Rastreio 3D da categoria ${categoria.nome}`}
      >
        <div ref={containerRef} className="mo-r3d-canvas" />

        {/* HUD superior: números da categoria inteira (não só da página) */}
        <div className="mo-r3d-hud">
          <div>
            <span className="mo-r3d-hud-rotulo">Investido na categoria</span>
            <strong>{brl(categoria.totalInvestido)}</strong>
          </div>
          <div>
            <span className="mo-r3d-hud-rotulo">Itens</span>
            <strong>
              {itensFiltrados.length}
              {busca && ` de ${categoria.itens.length}`}
            </strong>
          </div>
          <div>
            <span className="mo-r3d-hud-rotulo">Alertas</span>
            <strong className={categoria.alertas > 0 ? 'text-red-400' : undefined}>
              {categoria.alertas}
            </strong>
          </div>
        </div>

        {/* Legenda */}
        <div className="mo-r3d-legenda" aria-hidden="true">
          <span><i className="mo-r3d-ponto" style={{ background: '#3b82f6' }} /> etapa física ✓</span>
          <span><i className="mo-r3d-ponto" style={{ background: '#f59e0b' }} /> etapa humana ⚠ (rendimento declarado)</span>
          <span><i className="mo-r3d-ponto" style={{ background: '#ef4444' }} /> crítico</span>
          <span><i className="mo-r3d-ponto" style={{ background: '#64748b' }} /> sem estoque</span>
        </div>

        {/* Paginação (só quando a categoria/filtro estoura uma página) */}
        {totalPaginas > 1 && (
          <div className="mo-r3d-paginacao">
            <button
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              disabled={paginaEfetiva === 0}
              aria-label="Página anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <span>
              {paginaEfetiva + 1} / {totalPaginas}
            </span>
            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
              disabled={paginaEfetiva >= totalPaginas - 1}
              aria-label="Próxima página"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Tooltip de hover (linha ou marcador ⚠️) */}
        {hover && posTooltip && (
          <div className="mo-r3d-tooltip" style={{ left: posTooltip.left, top: posTooltip.top }} role="tooltip">
            {hover.tipo === 'etapa-humana'
              ? 'Etapa humana — rendimento declarado pelo lojista'
              : `${hover.item.nome} — ${fmtQtd(hover.item.quantidadeAtual)} ${hover.item.unidadeBase}${
                  hover.item.totalInvestido != null ? ` · ${brl(hover.item.totalInvestido)}` : ''
                }`}
          </div>
        )}

        {/* Painel de detalhe do item selecionado */}
        {selecionado && (
          <aside className="mo-r3d-painel" aria-label={`Detalhes de ${selecionado.nome}`}>
            <header>
              <span className={`mo-r3d-badge mo-r3d-badge-${selecionado.estado}`}>
                {ROTULO_ESTADO[selecionado.estado]}
              </span>
              <button className="mo-r3d-fechar" onClick={() => selecionarNoCartao(null)} aria-label="Fechar">
                ×
              </button>
            </header>
            <h4>{selecionado.nome}</h4>
            <p className="mo-r3d-painel-cat">{selecionado.categoria}</p>
            <dl>
              <div>
                <dt>Quantidade atual</dt>
                <dd className="text-blue-300">
                  {fmtQtd(selecionado.quantidadeAtual)} {selecionado.unidadeBase}
                </dd>
              </div>
              <div>
                <dt>Custo base</dt>
                <dd className="text-emerald-300">
                  {selecionado.custoBase != null ? `${brl(selecionado.custoBase, 4)}/${selecionado.unidadeBase}` : '—'}
                </dd>
              </div>
              {selecionado.origemCusto && (
                <div>
                  <dt>Origem do custo</dt>
                  <dd className="text-[11px] text-gray-300">{ROTULO_ORIGEM[selecionado.origemCusto]}</dd>
                </div>
              )}
              <div>
                <dt>Total investido</dt>
                <dd className="text-amber-300 font-black">
                  {selecionado.totalInvestido != null ? brl(selecionado.totalInvestido) : '—'}
                </dd>
              </div>
              <div>
                <dt>Lotes ativos</dt>
                <dd>{selecionado.lotesAtivos}</dd>
              </div>
              <div>
                <dt>Estoque mínimo</dt>
                <dd>
                  {fmtQtd(selecionado.estoqueMinimo)} {selecionado.unidadeBase}
                </dd>
              </div>
              {selecionado.desvioPct != null && (
                <div>
                  <dt>Desvio estimado × real</dt>
                  <dd className={selecionado.estado === 'alerta_desvio' ? 'text-red-400 font-bold' : ''}>
                    {selecionado.desvioPct > 0 ? '+' : ''}
                    {selecionado.desvioPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                  </dd>
                </div>
              )}
            </dl>
            <div className="mo-r3d-painel-estagios">
              {selecionado.estagios.map((e, i) => (
                <div key={i} className="mo-r3d-painel-estagio">
                  <span className="mo-r3d-painel-estagio-rotulo">
                    {e.rotulo} · {e.unidade}
                    {e.tipo === 'humana' ? ' ⚠️' : ' ✓'}
                  </span>
                  <span>
                    {fmtQtd(e.quantidade)} {e.unidade}
                    {e.custoUnitario != null ? ` — ${brl(e.custoUnitario, 4)}/${e.unidade}` : ' — sem custo'}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Cartões-resumo: a linha do fluxo em formato textual, clicável */}
      {itensPagina.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {itensPagina.map((item) => (
            <button
              key={item.insumoId}
              onClick={() => selecionarNoCartao(item)}
              className={`text-left rounded-xl border p-3 transition-all ${
                selecionado?.insumoId === item.insumoId
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/20 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm dark:text-gray-100 truncate">{item.nome}</span>
                <span className={`mo-r3d-badge mo-r3d-badge-${item.estado} shrink-0`}>
                  {ROTULO_ESTADO[item.estado]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {item.estagios.map((e, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-gray-400 text-xs">→</span>}
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                        e.tipo === 'humana'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}
                      title={e.tipo === 'humana' ? 'Etapa humana — rendimento declarado' : 'Etapa física'}
                    >
                      {fmtQtd(e.quantidade)} {e.unidade}
                      {e.custoUnitario != null && ` · ${brl(e.custoUnitario, 2)}`}
                      {e.tipo === 'humana' ? ' ⚠️' : ''}
                    </span>
                  </span>
                ))}
              </div>
              {item.totalInvestido != null && (
                <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Investido: <strong className="text-amber-600 dark:text-amber-400">{brl(item.totalInvestido)}</strong>
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {itensPagina.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
          Nenhum item de “{categoria.nome}” corresponde à busca “{busca}”.
        </p>
      )}

      <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
        Quantidades e custos são os valores reais do estoque (lotes PEPS + cadastro). Representação 3D
        simbólica: até 12 objetos por etapa — o excedente aparece como “+N”.
      </p>
    </div>
  );
}

export default Rastreio3D;
