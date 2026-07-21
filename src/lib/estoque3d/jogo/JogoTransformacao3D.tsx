/**
 * JogoTransformacao3D — wrapper React da "Rastreabilidade de custo em 3D".
 *
 * Divisão de trabalho (espelha CostGraph3D): a engine cuida do WebGL; o React
 * cuida do DOM — seletor de cadeia, HUD de progresso, cartões de etapa (a
 * versão ACESSÍVEL da linha: quem não consegue clicar no 3D registra pelos
 * botões "Registrar quebra/uso") e o painel de conclusão sóbrio.
 *
 * Linguagem de NEGÓCIO, não de jogo: Registrado ✅ / Pendente de registro ⚠️ /
 * Bloqueado 🔒. Zero pontos, troféu, confete ou "Jogar de novo".
 *
 * Anti-tela-azul: a criação da engine e o setCadeia rodam em try/catch — uma
 * falha de WebGL (device fraco, driver bloqueado, contexto perdido) vira um
 * painel de fallback legível em vez de derrubar a árvore React inteira.
 */

import { useEffect, useRef, useState } from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import {
  JogoTransformacaoEngine,
  formatarMultiplicador,
  nomeDoEstagio,
  type EstadoJogo,
} from './JogoTransformacaoEngine';
import type { CadeiaJogo } from './cadeiaJogo';
import './JogoTransformacao3D.css';

interface Props {
  cadeias: CadeiaJogo[];
  /** Altura do palco 3D (o pai controla a largura). Default 560px. */
  altura?: number | string;
}

const brl = (v: number, casas = 2) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: casas,
  });

const fmtQtd = (q: number) => q.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Status de cartão no HUD — espelha a linguagem da operação. */
type StatusCartao = 'registrado' | 'pendente' | 'processando' | 'bloqueado';

const STATUS_ROTULO: Record<StatusCartao, string> = {
  registrado: 'Registrado ✅',
  pendente: 'Pendente de registro ⚠️',
  processando: 'Registrando…',
  bloqueado: 'Bloqueado 🔒',
};

export function JogoTransformacao3D({ cadeias, altura = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<JogoTransformacaoEngine | null>(null);

  const [indiceCadeia, setIndiceCadeia] = useState(0);
  const [estado, setEstado] = useState<EstadoJogo | null>(null);
  /** Falha de WebGL/engine → painel de fallback, nunca derruba a árvore. */
  const [erroEngine, setErroEngine] = useState<string | null>(null);

  const cadeia = cadeias[Math.min(indiceCadeia, cadeias.length - 1)];

  // Monta a engine uma única vez (o container não muda de identidade).
  // try/catch: WebGL pode falhar por driver/device — vira fallback visível.
  useEffect(() => {
    if (!containerRef.current) return;
    let engine: JogoTransformacaoEngine;
    try {
      engine = new JogoTransformacaoEngine(containerRef.current, {
        onEstado: setEstado,
      });
    } catch (e) {
      setErroEngine(e instanceof Error ? e.message : String(e));
      return;
    }
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Troca de cadeia → reconstrói a linha (a engine emite o estado inicial,
  // então o HUD se atualiza sozinho). Também blindado contra dado inesperado.
  useEffect(() => {
    if (!cadeia || !engineRef.current || erroEngine) return;
    try {
      engineRef.current.setCadeia(cadeia);
    } catch (e) {
      setErroEngine(e instanceof Error ? e.message : String(e));
    }
  }, [cadeia, erroEngine]);

  if (!cadeia) return null;

  // Fallback anti-tela-azul: a página inteira continua utilizável.
  if (erroEngine) {
    return (
      <div className="mo-jg3d-falha" style={{ height: altura }} role="alert">
        <p className="mo-jg3d-falha-titulo">O módulo 3D não pôde ser exibido neste dispositivo</p>
        <p className="mo-jg3d-falha-msg">{erroEngine}</p>
        <p className="mo-jg3d-falha-dica">
          Os números da operação continuam disponíveis na aba "Custo 3D" e nos relatórios de estoque.
        </p>
      </div>
    );
  }

  const ultimo = cadeia.estagios[cadeia.estagios.length - 1];
  const progresso = estado && estado.totalEtapas > 0
    ? estado.etapasConcluidas / estado.totalEtapas
    : 0;

  // Status de cada cartão de etapa: deriva do estado da porta que CHEGA nele.
  const statusDoEstagio = (i: number): StatusCartao => {
    if (i === 0) return 'registrado'; // a compra é fato consumado
    const porta = estado?.portas.find((pt) => pt.indice === i);
    if (!porta) return 'bloqueado';
    if (porta.status === 'concluida') return 'registrado';
    if (porta.status === 'pendente') return porta.tipo === 'humana' ? 'pendente' : 'processando';
    if (porta.status === 'executando') return 'processando';
    return 'bloqueado';
  };

  return (
    <div className="mo-jg3d" style={{ height: altura }}>
      <div
        ref={containerRef}
        className="mo-jg3d-canvas"
        role="application"
        aria-label="Rastreabilidade de custo em 3D: toque nos marcadores âmbar (ou use os botões dos cartões) para registrar cada etapa humana"
      />

      {/* Seletor de cadeia (só quando há mais de uma compra na linha) */}
      {cadeias.length > 1 && (
        <div className="mo-jg3d-chips" role="tablist" aria-label="Escolher cadeia de custo">
          {cadeias.map((c, i) => (
            <button
              key={c.raiz.id}
              role="tab"
              aria-selected={i === indiceCadeia}
              className={`mo-jg3d-chip ${i === indiceCadeia ? 'ativo' : ''}`}
              onClick={() => setIndiceCadeia(i)}
            >
              {c.raiz.rotulo} — {brl(c.raiz.custoAlocado)}
            </button>
          ))}
        </div>
      )}

      {/* HUD superior: progresso de registro + legenda física/humana */}
      <div className="mo-jg3d-hud-topo">
        <div className="mo-jg3d-placar">
          <span className="mo-jg3d-etapas" aria-live="polite">
            Etapas registradas: {estado?.etapasConcluidas ?? 0} de {estado?.totalEtapas ?? 0}
          </span>
        </div>
        {estado && estado.totalEtapas > 0 && (
          <div
            className="mo-jg3d-progresso"
            role="progressbar"
            aria-valuenow={estado.etapasConcluidas}
            aria-valuemin={0}
            aria-valuemax={estado.totalEtapas}
            aria-label="Etapas registradas da cadeia"
          >
            <div className="mo-jg3d-progresso-fill" style={{ width: `${progresso * 100}%` }} />
          </div>
        )}
        <div className="mo-jg3d-legenda">
          <span><i className="mo-jg3d-dot azul" /> etapa física — automática</span>
          <span><i className="mo-jg3d-dot ambar" /> etapa humana — exige registro</span>
        </div>
      </div>

      <button
        className="mo-jg3d-recomecar"
        onClick={() => engineRef.current?.reiniciar()}
        aria-label="Reiniciar a demonstração da cadeia do zero"
      >
        <RotateCcw size={13} aria-hidden /> Reiniciar
      </button>

      {/* HUD inferior: cartões de etapa (espelha o fluxo Compra→…→Uso) */}
      <div className="mo-jg3d-cartoes">
        {cadeia.estagios.map((est, i) => {
          const status = statusDoEstagio(i);
          // Dados estáticos (multiplicador/tipo) vêm da cadeia; o status vem do estado.
          const portaJogo = i > 0 ? cadeia.portas.find((pt) => pt.indice === i) : undefined;
          const portaEstado = estado?.portas.find((pt) => pt.indice === i);
          const aguardandoHumana = status === 'pendente' && portaJogo?.tipo === 'humana';
          // A última quebra da linha é o "uso" no prato; as anteriores são quebras.
          const rotuloBotao = i === cadeia.estagios.length - 1 ? 'Registrar uso' : 'Registrar quebra';
          return (
            <div key={est.no.id} className="mo-jg3d-cartao-grupo">
              {i > 0 && portaJogo && (
                <span
                  className={`mo-jg3d-chip-portal ${portaJogo.tipo} ${portaEstado?.status ?? 'bloqueada'}`}
                  title={
                    portaJogo.tipo === 'fisica'
                      ? `Etapa física — acontece sozinha: cada unidade vira ${formatarMultiplicador(portaJogo.multiplicador)} da seguinte`
                      : `Etapa humana — exige registro: cada unidade vira ${formatarMultiplicador(portaJogo.multiplicador)} da seguinte`
                  }
                >
                  ×{formatarMultiplicador(portaJogo.multiplicador)} {portaJogo.tipo === 'fisica' ? '🔵' : '⚠️'}
                </span>
              )}
              <div
                className={`mo-jg3d-cartao ${status}`}
                title={status === 'bloqueado' ? 'Depende do registro da etapa anterior' : undefined}
              >
                <p className="mo-jg3d-cartao-nome">{nomeDoEstagio(i)}</p>
                <p className="mo-jg3d-cartao-qtd">
                  {fmtQtd(est.no.quantidade)} {est.no.unidade}
                </p>
                <p className="mo-jg3d-cartao-custo">
                  {brl(est.no.custoUnitario, 4)}/{est.no.unidade}
                </p>
                <p className={`mo-jg3d-cartao-status ${status}`}>
                  {status === 'bloqueado' && <Lock size={11} aria-hidden className="mo-jg3d-cadeado" />}
                  {STATUS_ROTULO[status]}
                </p>
                {aguardandoHumana && (
                  <button
                    className="mo-jg3d-registrar"
                    onClick={() => engineRef.current?.executarPorta(portaJogo.indice)}
                    aria-label={`${rotuloBotao}: ${est.no.rotulo}`}
                  >
                    {rotuloBotao}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Honestidade da representação: símbolos 3D × números reais */}
      <p className="mo-jg3d-nota">
        Representação simbólica: cada objeto corresponde a 1 unidade real (máx. 40 por etapa).
        Os valores exibidos são os números reais do estoque.
      </p>

      {/* Painel de conclusão — discreto, no canto (não tapa a cena) */}
      {estado?.concluida && (
        <aside className="mo-jg3d-conclusao" role="status">
          <p className="mo-jg3d-conclusao-titulo">Rastreabilidade completa ✅</p>
          <p className="mo-jg3d-conclusao-linha">
            Investido: <strong>{brl(cadeia.raiz.custoAlocado)}</strong>
          </p>
          <p className="mo-jg3d-conclusao-linha">
            Custo final: <strong>{brl(ultimo.no.custoUnitario, 4)}/{ultimo.no.unidade}</strong>
          </p>
          <p className="mo-jg3d-conclusao-texto">
            O custo está rastreado da compra ao uso — base pronta para precificação.
          </p>
          <button
            className="mo-jg3d-reiniciar-demo"
            onClick={() => engineRef.current?.reiniciar()}
          >
            Reiniciar demonstração
          </button>
        </aside>
      )}
    </div>
  );
}

export default JogoTransformacao3D;
