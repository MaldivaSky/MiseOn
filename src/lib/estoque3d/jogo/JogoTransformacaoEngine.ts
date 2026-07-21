/**
 * JogoTransformacaoEngine — motor WebGL da "Rastreabilidade de custo em 3D".
 *
 * NÃO é um jogo: é uma ANALOGIA REAL da linha de transformação do estoque,
 * desenhada para comunicar três regras de negócio:
 *
 *   Compra ──física──▶ Armazenado ──humana ⚠️──▶ Quebra ──humana ⚠️──▶ Uso
 *
 *  1. CONSERVAÇÃO DE VALOR — o custo da compra nunca some, só se subdivide
 *     (R$ 20/cx → R$ 2,50/un → R$ 0,50/fatia). Ao concluir cada etapa, um
 *     sprite persistente "= R$ X ✓" mostra o MESMO total em todas as estações.
 *  2. FÍSICA × HUMANA — etapas físicas (conversão de dimensão) executam
 *     sozinhas; etapas humanas ficam TRAVADAS (cadeado desenhado em canvas,
 *     inconfundível) até o registro. Enquanto a porta humana anterior não é
 *     registrada, o conteúdo do estágio seguinte é FANTASMA (opacidade 0,10,
 *     sem sombra, sem emissive): no mundo real ele "não existe" para o sistema.
 *  3. ANALOGIA REAL — caixa de papelão que ABRE, prateleira metálica com o
 *     produto a granel, bandeja com unidades, tábua de corte com fatias.
 *     Zero esferas abstratas brilhantes, zero pontos/troféu/confete.
 *
 * Decisões de arquitetura (e o porquê):
 *
 *  - UMA COR DE CONTEÚDO (#c2543a, terracota de alimento) em TODOS os
 *    estágios: é a mesma matéria se subdividindo — a cor constante é a prova
 *    visual da conservação; as estruturas (prateleira/bandeja/tábua) ficam
 *    neutras (metal cinza, madeira) para não competir com o conteúdo.
 *  - Estágio 0 usa GRUPOS de meshes (caixa com 2 tampas pivotadas) em vez de
 *    InstancedMesh: tampas precisam de rotação própria e compras são poucas
 *    (1-3 caixas). Estágios ≥ 1 seguem em InstancedMesh (até 40 itens).
 *  - Marcadores 🔒/⚠️ são texturas de canvas DESENHADAS (não emoji de fonte):
 *    renderizam igual em qualquer device/headless, sem depender de fonte do SO.
 *  - SEM arco caricato na materialização: os itens condensam no lugar
 *    (escala 0,35→1 + fade 0,10→1, ~0,7 s com stagger rápido) — sóbrio.
 *  - Pool de partículas reduzido a POEIRA sutil na abertura da caixa
 *    (blending normal, cinza-papelão), único efeito restante.
 *  - Tweens caseiros (array no loop com delta do clock): zero dependência,
 *    dispose trivial, nenhum setTimeout vazando após desmontar.
 *  - prefers-reduced-motion: porta conclui no mesmo tick, sem pulso/poeira.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { CadeiaJogo, TipoPorta } from './cadeiaJogo';

// ---------------------------------------------------------------------------
// Contrato público
// ---------------------------------------------------------------------------

export type StatusPorta = 'bloqueada' | 'pendente' | 'executando' | 'concluida';

export interface EstadoPorta {
  indice: number;
  tipo: TipoPorta;
  status: StatusPorta;
}

/** Fotografia da linha emitida via onEstado sempre que algo muda. */
export interface EstadoJogo {
  etapasConcluidas: number;
  totalEtapas: number;
  /** true só quando a ÚLTIMA porta conclui (cadeia sem portas não "conclui"). */
  concluida: boolean;
  portas: EstadoPorta[];
}

export interface OpcoesJogo {
  onEstado?: (e: EstadoJogo) => void;
  corFundo?: number;
}

// ---------------------------------------------------------------------------
// Constantes da cena
// ---------------------------------------------------------------------------

/** Distância entre estações no eixo X. */
const ESPACO = 8;

const COR_FISICA = '#3b82f6'; // chip de conversão física (automática) 🔵
const COR_HUMANA = '#f59e0b'; // chip de registro humano ⚠️
const COR_PRONTO = '#22c55e'; // etapa registrada ✓

const COR_ALIMENTO = 0xc2543a; // conteúdo: a mesma "matéria" atravessando a linha
const COR_KRAFT = 0xa0793f; // papelão da caixa de compra
const COR_FITA = 0x5e4732; // fita adesiva escura
const COR_METAL = 0x454c56; // prateleira / bandeja / pés
const COR_MADEIRA = 0x8a6a42; // tábua de corte
const COR_SETA = 0x3d4a63; // seta de fluxo entre estações (neutra)

/** Poeira da abertura da caixa — único efeito de partículas restante. */
const MAX_PARTICULAS = 120;
const POEIRA_POR_CAIXA = 18;
const COR_POEIRA = 0xb9a88c;

/** Nomes de exibição por profundidade (espelha o fluxo desenhado pelo usuário). */
export function nomeDoEstagio(indice: number): string {
  if (indice <= 0) return 'Compra';
  if (indice === 1) return 'Armazenado';
  if (indice === 2) return 'Quebra';
  return 'Uso';
}

/** Fatias/porções/peças são cilindros achatados sobre tábua, não esferas. */
const RE_ACHATADO = /fatia|porç|peça|peca|pedaç|pedac|filé|file/i;

const brl = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const brl2 = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Multiplicador de portal: inteiro sem casas, senão até 2 (×8, ×3,5). */
export function formatarMultiplicador(m: number): string {
  return Number.isInteger(m)
    ? String(m)
    : m.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface Tween {
  dur: number;
  t: number;
  ease: (k: number) => number;
  /** Recebe (kEaseado, kBruto) — o stagger da materialização usa o bruto. */
  onUpdate: (kEase: number, kBruto: number) => void;
  onComplete?: () => void;
}

/** Uma caixa de papelão: corpo + fita + 2 tampas pivotadas na borda. */
interface CaixaCena {
  grupo: THREE.Group;
  tampaEsq: THREE.Group; // pivô na borda esquerda do topo
  tampaDir: THREE.Group; // pivô na borda direita do topo
  fita: THREE.Mesh;
}

interface EstagioCena {
  grupo: THREE.Group;
  /** Conteúdo instanciado (estágios ≥ 1); null no estágio 0 (caixas). */
  conteudo: THREE.InstancedMesh | null;
  /** Material próprio do conteúdo (anima opacidade fantasma → sólido). */
  matConteudo: THREE.MeshStandardMaterial | null;
  caixas: CaixaCena[];
  itens: number;
  /** Posições-alvo locais da grade, xyz intercalados — pré-computadas. */
  alvos: Float32Array | null;
  /** Marcador 🔒/⚠️ atual (material próprio; textura é compartilhada). */
  marcador: THREE.Sprite | null;
  /** "= R$ X ✓" — prova da conservação, aparece ao concluir a etapa. */
  spriteValor: THREE.Sprite | null;
  /** Sprites de texto do estágio (custo, nome, +N, valor) — para dispose. */
  labels: THREE.Sprite[];
  /** Altura local dos marcadores/valor (logo acima do conteúdo). */
  yTopo: number;
}

interface PortaCena {
  grupo: THREE.Group;
  /** Seta (corpo+ponta) e chip — alvos do raycast quando humana pendente. */
  clicaveis: THREE.Object3D[];
  chip: THREE.Sprite;
  rotulo: string; // "×8"
}

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const identidade = (k: number) => k;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class JogoTransformacaoEngine {
  private container: HTMLElement;
  private opcoes: OpcoesJogo;

  private renderer!: THREE.WebGLRenderer;
  private cena!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controles!: OrbitControls;

  // --- Geometrias compartilhadas (disposed só no dispose da engine) --------
  private geoCaixaCorpo = new THREE.BoxGeometry(1.3, 1.1, 1.3);
  private geoCaixaTampa = new THREE.BoxGeometry(0.66, 0.05, 1.32);
  private geoFita = new THREE.BoxGeometry(0.22, 0.035, 1.34);
  private geoPrancha = new THREE.BoxGeometry(3.6, 0.14, 2.6);
  private geoPe = new THREE.BoxGeometry(0.14, 1.5, 0.14);
  private geoPeBaixo = new THREE.BoxGeometry(0.12, 0.42, 0.12);
  private geoBandeja = new THREE.BoxGeometry(3.3, 0.12, 2.5);
  private geoTabua = new THREE.BoxGeometry(3.5, 0.12, 2.6);
  /** Conteúdo a granel do Armazenado: cilindro baixo (sóbrio, "tambor" de insumo). */
  private geoTub = new THREE.CylinderGeometry(0.62, 0.62, 0.85, 20);
  private geoEsfera = new THREE.SphereGeometry(0.55, 20, 14);
  private geoFatia = new THREE.CylinderGeometry(0.72, 0.72, 0.16, 24);
  private geoSetaCorpo = new THREE.BoxGeometry(ESPACO - 4.4, 0.07, 0.07);
  private geoSetaPonta = (() => {
    // Cone aponta +Y por padrão; gira a GEOMETRIA uma vez para apontar +X.
    const g = new THREE.ConeGeometry(0.16, 0.42, 12);
    g.rotateZ(-Math.PI / 2);
    return g;
  })();

  // --- Materiais compartilhados das estruturas (neutros, sobrios) ----------
  private matKraft = new THREE.MeshStandardMaterial({ color: COR_KRAFT, roughness: 0.92, metalness: 0.02 });
  private matFita = new THREE.MeshStandardMaterial({ color: COR_FITA, roughness: 0.85, metalness: 0.02 });
  private matMetal = new THREE.MeshStandardMaterial({ color: COR_METAL, roughness: 0.5, metalness: 0.6 });
  private matMadeira = new THREE.MeshStandardMaterial({ color: COR_MADEIRA, roughness: 0.82, metalness: 0.03 });
  private matSeta = new THREE.MeshStandardMaterial({
    color: COR_SETA, roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.9,
  });

  // --- Texturas de ícone desenhadas em canvas (compartilhadas) -------------
  private texCadeado!: THREE.CanvasTexture;
  private texAlerta!: THREE.CanvasTexture;

  private grupoJogo: THREE.Group | null = null;
  private cadeia: CadeiaJogo | null = null;
  private estagiosCena: EstagioCena[] = [];
  private portasCena: PortaCena[] = [];
  private statusPortas: StatusPorta[] = [];
  private concluida = false;

  /** Sprites ⚠️ que pulsam neste tick (reconstruído nas transições, não/frame). */
  private marcadoresPulso: THREE.Sprite[] = [];

  // Interação: alvos clicáveis atuais (reconstruído quando o estado muda).
  private alvosInteracao: THREE.Object3D[] = [];
  private portaHumanaPendente = -1; // índice no array de portas, ou -1
  private hoverPorta = -1;
  private downX = 0;
  private downY = 0;

  private tweens: Tween[] = [];
  private readonly reduzMovimento: boolean;

  // Pool de poeira: UM Points com buffers fixos; slot morto tem vida ≤ 0 e
  // posição jogada para baixo do mundo (barato de esconder, zero realocação).
  private pontos3d!: THREE.Points;
  private partPos!: Float32Array;
  private partVel!: Float32Array;
  private partVida!: Float32Array;
  private partSujo = false;

  private raycaster = new THREE.Raycaster();
  private ponteiro = new THREE.Vector2();
  private relogio = new THREE.Clock();
  private tempoTotal = 0;
  private idAnimacao = 0;
  private destruido = false;

  // Objetos temporários reutilizados no loop (zero alocação por frame).
  private matrizTmp = new THREE.Matrix4();
  private corTmp = new THREE.Color();

  private onPointerMove = (e: PointerEvent) => this.processarHover(e);
  private onPointerDown = (e: PointerEvent) => {
    this.downX = e.clientX;
    this.downY = e.clientY;
  };
  private onPointerUp = (e: PointerEvent) => this.processarSolta(e);
  private onResize = () => this.redimensionar();

  constructor(container: HTMLElement, opcoes: OpcoesJogo = {}) {
    this.container = container;
    this.opcoes = opcoes;
    this.reduzMovimento =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.texCadeado = this.desenharCadeado();
    this.texAlerta = this.desenharAlerta();

    this.inicializarCena(opcoes.corFundo ?? 0x0a0e17);
    this.inicializarLuzes();
    this.inicializarParticulas();

    container.addEventListener('pointermove', this.onPointerMove);
    container.addEventListener('pointerdown', this.onPointerDown);
    container.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);

    this.animar();
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private inicializarCena(corFundo: number): void {
    const { clientWidth: w, clientHeight: h } = this.container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color(corFundo);
    this.cena.fog = new THREE.Fog(corFundo, 40, 110);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 300);
    this.camera.position.set(0, 9, 16);

    this.controles = new OrbitControls(this.camera, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.06;
    // Mesma blindagem da CostGraphEngine: não deixa ir para debaixo do piso.
    this.controles.minPolarAngle = Math.PI * 0.15;
    this.controles.maxPolarAngle = Math.PI * 0.55;
    this.controles.minDistance = 6;
    this.controles.maxDistance = 70;
    this.controles.target.set(0, 1.4, 0);

    // Piso que recebe sombra + grade sutil para dar noção de espaço/escala.
    const piso = new THREE.Mesh(
      new THREE.CircleGeometry(90, 48),
      new THREE.MeshStandardMaterial({ color: 0x0d1320, roughness: 0.95, metalness: 0 }),
    );
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    piso.name = 'piso';
    this.cena.add(piso);

    const grade = new THREE.GridHelper(120, 60, 0x1c2a4a, 0x111a30);
    grade.position.y = 0.01;
    const matGrade = grade.material as THREE.Material;
    matGrade.transparent = true;
    matGrade.opacity = 0.5;
    this.cena.add(grade);
  }

  private inicializarLuzes(): void {
    // Iluminação "de galpão": ambiente neutra + uma principal quente de
    // trabalho. Sem holofotes coloridos de festa — a cena é uma operação.
    this.cena.add(new THREE.AmbientLight(0x9aa7bd, 0.5));

    const principal = new THREE.DirectionalLight(0xfff2e0, 2.0);
    principal.position.set(18, 26, 10);
    principal.castShadow = true;
    principal.shadow.mapSize.set(2048, 2048);
    principal.shadow.bias = -0.0004;
    const extensao = 34;
    principal.shadow.camera.left = -extensao;
    principal.shadow.camera.right = extensao;
    principal.shadow.camera.top = extensao;
    principal.shadow.camera.bottom = -extensao;
    this.cena.add(principal);

    // Preenchimento frio suave do lado oposto (levanta as sombras).
    const preench = new THREE.DirectionalLight(0xbdd0ff, 0.5);
    preench.position.set(-16, 12, -12);
    this.cena.add(preench);
  }

  private inicializarParticulas(): void {
    this.partPos = new Float32Array(MAX_PARTICULAS * 3);
    this.partVel = new Float32Array(MAX_PARTICULAS * 3);
    this.partVida = new Float32Array(MAX_PARTICULAS);
    for (let i = 0; i < MAX_PARTICULAS; i++) this.partPos[i * 3 + 1] = -1000;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.partPos, 3));
    const mat = new THREE.PointsMaterial({
      color: COR_POEIRA,
      size: 0.16,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      // Blending NORMAL (não aditivo): poeira de papelão não brilha.
    });
    this.pontos3d = new THREE.Points(geo, mat);
    this.pontos3d.frustumCulled = false; // partículas saem do volume original
    this.cena.add(this.pontos3d);
  }

  // -------------------------------------------------------------------------
  // Ícones desenhados em canvas (determinísticos — não dependem de fonte)
  // -------------------------------------------------------------------------

  /** Cadeado de latão com arco prateado — o "🔒" da regra de negócio. */
  private desenharCadeado(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Arco (shackle) prateado, atrás do corpo.
    ctx.strokeStyle = '#d7dee8';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(64, 58, 25, Math.PI, 0);
    ctx.stroke();

    // Corpo de latão com contorno escuro (leitura garantida no fundo escuro).
    this.tracarRoundRect(ctx, 30, 54, 68, 56, 11);
    ctx.fillStyle = '#f5b73f';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#8a5f0d';
    ctx.stroke();

    // Furo da chave.
    ctx.fillStyle = '#3a2a08';
    ctx.beginPath();
    ctx.arc(64, 78, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(60.5, 78, 7, 18);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Triângulo âmbar com "!" — o "⚠️ exige registro" da porta humana. */
  private desenharAlerta(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Triângulo arredondado via arcTo nos 3 vértices.
    ctx.beginPath();
    ctx.moveTo(64 + 0, 18 + 14); // ponto inicial após o arco do topo
    ctx.arcTo(64, 10, 118, 112, 14); // vértice superior
    ctx.arcTo(118, 112, 10, 112, 14); // vértice inferior direito
    ctx.arcTo(10, 112, 64, 10, 14); // vértice inferior esquerdo
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#7c4a03';
    ctx.stroke();

    // Exclamação.
    ctx.fillStyle = '#3a2503';
    this.tracarRoundRect(ctx, 59, 40, 10, 36, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 92, 6.5, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** roundRect próprio: não depende de CanvasRenderingContext2D.roundRect. */
  private tracarRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------------------------
  // Dados → cena
  // ---------------------------------------------------------------------------

  /** Substitui a cadeia e reconstrói a linha de estações do zero. */
  setCadeia(cadeia: CadeiaJogo): void {
    this.limparCadeia();
    this.cadeia = cadeia;
    this.concluida = false;

    this.grupoJogo = new THREE.Group();
    this.cena.add(this.grupoJogo);

    const n = cadeia.estagios.length;

    for (let i = 0; i < n; i++) {
      const est = cadeia.estagios[i];
      const x = (i - (n - 1) / 2) * ESPACO;
      const cena = this.construirEstagio(est, i, x);
      this.estagiosCena.push(cena);
    }

    // --- Setas de fluxo + chips "×n" entre estações -------------------------
    for (let p = 0; p < cadeia.portas.length; p++) {
      const porta = cadeia.portas[p];
      // Ponto médio entre a estação de origem e a de destino.
      const x = ((porta.indice - 1 - (n - 1) / 2) + (porta.indice - (n - 1) / 2)) * (ESPACO / 2);
      this.portasCena.push(this.construirPorta(porta, x));
    }

    // --- Estado inicial: 1ª porta pendente, demais bloqueadas ---------------
    this.statusPortas = cadeia.portas.map((_, p) => (p === 0 ? 'pendente' : 'bloqueada'));
    this.atualizarMarcadores();
    this.atualizarInterativos();
    this.enquadrarCamera(n);
    this.emitirEstado();

    // Porta física executa sozinha; humana espera o registro (clique/botão).
    if (cadeia.portas.length > 0 && cadeia.portas[0].tipo === 'fisica') {
      this.agendarExecucao(0);
    }
  }

  /** Monta a estação i: estrutura neutra + conteúdo (sólido ou fantasma). */
  private construirEstagio(
    est: CadeiaJogo['estagios'][number],
    i: number,
    x: number,
  ): EstagioCena {
    const grupo = new THREE.Group();
    grupo.position.set(x, 0, 0);
    this.grupoJogo!.add(grupo);

    const cena: EstagioCena = {
      grupo,
      conteudo: null,
      matConteudo: null,
      caixas: [],
      itens: 0,
      alvos: null,
      marcador: null,
      spriteValor: null,
      labels: [],
      yTopo: 2.4,
    };

    // Blindagem em profundidade: mesmo que o contrato da CadeiaJogo venha
    // quebrado (contagem fracionária), a GPU só recebe inteiro ≥ 1 — um
    // Float32Array truncado + loop fracionário foi a causa do crash
    // "isVector3" que derrubava a tela inteira.
    const nItens = Math.max(1, Math.floor(est.itensVisiveis));
    cena.itens = nItens;

    if (i === 0) {
      // COMPRA: caixas de papelão fechadas (a compra já aconteceu → sólidas).
      cena.yTopo = 2.05;
      const passo = 1.75;
      const cols = Math.ceil(Math.sqrt(nItens));
      const rows = Math.ceil(nItens / cols);
      for (let k = 0; k < nItens; k++) {
        const col = k % cols;
        const row = Math.floor(k / cols);
        const caixa = this.construirCaixa();
        caixa.grupo.position.set(
          (col - (cols - 1) / 2) * passo,
          0,
          (row - (rows - 1) / 2) * passo,
        );
        grupo.add(caixa.grupo);
        cena.caixas.push(caixa);
      }
      // A compra é a única etapa que nasce concluída: valor à vista desde já.
      cena.spriteValor = this.criarSpriteValor(est.no.custoAlocado);
      cena.spriteValor.position.set(0, cena.yTopo, 0);
      grupo.add(cena.spriteValor);
      cena.labels.push(cena.spriteValor);
    } else if (i === 1) {
      // ARMAZENADO: prateleira metálica + conteúdo a granel (cilindro baixo).
      cena.yTopo = 3.15;
      grupo.add(this.construirPrateleira());
      const yBase = 1.57 + 0.85 / 2; // topo da prancha alta + metade do tub
      this.construirConteudoInstanciado(cena, est, this.geoTub, yBase, 1.2);
    } else {
      // QUEBRA/USO: bandeja rasa (unidades) ou tábua de corte (fatias).
      const achatado = RE_ACHATADO.test(est.no.unidade);
      cena.yTopo = achatado ? 2.0 : 2.55;
      grupo.add(this.construirBancada(achatado));
      const yBase = achatado ? 0.54 + 0.16 / 2 : 0.54 + 0.55; // topo da bancada + metade do item
      const geo = achatado ? this.geoFatia : this.geoEsfera;
      this.construirConteudoInstanciado(cena, est, geo, yBase, achatado ? 0.95 : 1.0);
    }

    // --- Labels de negócio ---------------------------------------------------
    // Acima: custo unitário "R$ 2,50/un". Abaixo: "Quebra — 8 un" (REAL).
    const labelCusto = this.criarSpriteTexto(
      [{ texto: `${brl(est.no.custoUnitario)}/${est.no.unidade}`, cor: '#cbd5e1', px: 38 }],
      0.6,
      'rgba(10, 14, 23, 0.62)',
    );
    labelCusto.position.set(0, cena.yTopo + 0.85, 0);
    grupo.add(labelCusto);
    cena.labels.push(labelCusto);

    const qtd = est.no.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    const labelNome = this.criarSpriteTexto([
      { texto: nomeDoEstagio(i), cor: '#eaf1ff', px: 38 },
      { texto: `${qtd} ${est.no.unidade}`, cor: '#9fb2d4', px: 30 },
    ]);
    labelNome.position.set(0, -0.55, 0);
    grupo.add(labelNome);
    cena.labels.push(labelNome);

    // Excedente do cap visual: "+35" ao lado do grupo (a contagem real
    // continua nos cartões do HUD — aqui é só honestidade da representação).
    if (est.excedente > 0 && cena.alvos) {
      const cols = Math.ceil(Math.sqrt(nItens));
      const passo = i === 0 ? 1.75 : 1.0;
      const labelMais = this.criarSpriteTexto(
        [{ texto: `+${est.excedente.toLocaleString('pt-BR')}`, cor: '#f59e0b', px: 42 }],
        0.56,
        'rgba(10, 14, 23, 0.62)',
      );
      labelMais.position.set((cols * passo) / 2 + 1.1, 1.4, 0);
      grupo.add(labelMais);
      cena.labels.push(labelMais);
    }

    return cena;
  }

  /**
   * Conteúdo dos estágios ≥ 1: InstancedMesh que nasce FANTASMA (opacidade
   * 0,10, sem sombra, sem emissive) — a regra de negócio "não existe para o
   * sistema até o registro" — e materializa quando a porta anterior conclui.
   */
  private construirConteudoInstanciado(
    cena: EstagioCena,
    est: CadeiaJogo['estagios'][number],
    geo: THREE.BufferGeometry,
    yBase: number,
    passo: number,
  ): void {
    const nItens = Math.max(1, Math.floor(est.itensVisiveis)); // inteiro ≥ 1, sempre

    const material = new THREE.MeshStandardMaterial({
      color: COR_ALIMENTO,
      roughness: 0.72,
      metalness: 0.05,
      // Estado FANTASMA: visível o bastante para mostrar "o que vai existir",
      // transparente o bastante para dizer "ainda não existe".
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });

    const malha = new THREE.InstancedMesh(geo, material, nItens);
    malha.castShadow = false; // fantasma não projeta sombra
    malha.receiveShadow = false;

    const alvos = new Float32Array(nItens * 3);
    const cols = Math.ceil(Math.sqrt(nItens));
    const rows = Math.ceil(nItens / cols);
    for (let k = 0; k < nItens; k++) {
      const col = k % cols;
      const row = Math.floor(k / cols);
      alvos[k * 3] = (col - (cols - 1) / 2) * passo;
      alvos[k * 3 + 1] = yBase;
      alvos[k * 3 + 2] = (row - (rows - 1) / 2) * passo;
      // Nasce encolhido: a materialização "condensa" o item no lugar.
      this.gravarMatriz(malha, k, alvos[k * 3], alvos[k * 3 + 1], alvos[k * 3 + 2], 0.35);
    }
    malha.instanceMatrix.needsUpdate = true;
    cena.grupo.add(malha);
    cena.conteudo = malha;
    cena.matConteudo = material;
    cena.alvos = alvos;
  }

  /** Caixa de papelão: corpo kraft + fita escura + 2 tampas com pivô. */
  private construirCaixa(): CaixaCena {
    const grupo = new THREE.Group();

    const corpo = new THREE.Mesh(this.geoCaixaCorpo, this.matKraft);
    corpo.position.y = 0.55; // metade da altura 1.1
    corpo.castShadow = true;
    corpo.receiveShadow = true;
    grupo.add(corpo);

    // Fita adesiva no topo: "arrebenta" (some) quando a caixa abre.
    const fita = new THREE.Mesh(this.geoFita, this.matFita);
    fita.position.y = 1.11;
    grupo.add(fita);

    // Tampas com pivô na borda: o mesh filho é deslocado meio-tampa para
    // dentro, então girar o pivô levanta a borda livre — dobradiça real.
    const tampaEsq = new THREE.Group();
    tampaEsq.position.set(-0.65, 1.1, 0);
    const folhaEsq = new THREE.Mesh(this.geoCaixaTampa, this.matKraft);
    folhaEsq.position.x = 0.33;
    folhaEsq.castShadow = true;
    tampaEsq.add(folhaEsq);
    grupo.add(tampaEsq);

    const tampaDir = new THREE.Group();
    tampaDir.position.set(0.65, 1.1, 0);
    const folhaDir = new THREE.Mesh(this.geoCaixaTampa, this.matKraft);
    folhaDir.position.x = -0.33;
    folhaDir.castShadow = true;
    tampaDir.add(folhaDir);
    grupo.add(tampaDir);

    return { grupo, tampaEsq, tampaDir, fita };
  }

  /** Prateleira metálica simples: 2 pranchas + 4 pés, cinza-escuro. */
  private construirPrateleira(): THREE.Group {
    const g = new THREE.Group();

    const pranchaBaixa = new THREE.Mesh(this.geoPrancha, this.matMetal);
    pranchaBaixa.position.y = 0.75;
    pranchaBaixa.castShadow = true;
    pranchaBaixa.receiveShadow = true;
    g.add(pranchaBaixa);

    const pranchaAlta = new THREE.Mesh(this.geoPrancha, this.matMetal);
    pranchaAlta.position.y = 1.5;
    pranchaAlta.castShadow = true;
    pranchaAlta.receiveShadow = true;
    g.add(pranchaAlta);

    for (const sx of [-1.65, 1.65]) {
      for (const sz of [-1.15, 1.15]) {
        const pe = new THREE.Mesh(this.geoPe, this.matMetal);
        pe.position.set(sx, 0.75, sz);
        pe.castShadow = true;
        g.add(pe);
      }
    }
    return g;
  }

  /** Bancada baixa de preparo: bandeja rasa cinza ou tábua de madeira. */
  private construirBancada(tabua: boolean): THREE.Group {
    const g = new THREE.Group();

    const tampo = new THREE.Mesh(tabua ? this.geoTabua : this.geoBandeja, tabua ? this.matMadeira : this.matMetal);
    tampo.position.y = 0.48;
    tampo.castShadow = true;
    tampo.receiveShadow = true;
    g.add(tampo);

    const alcance = tabua ? 1.6 : 1.5;
    const fundo = tabua ? 1.15 : 1.1;
    for (const sx of [-alcance, alcance]) {
      for (const sz of [-fundo, fundo]) {
        const pe = new THREE.Mesh(this.geoPeBaixo, this.matMetal);
        pe.position.set(sx, 0.21, sz);
        pe.castShadow = true;
        g.add(pe);
      }
    }
    return g;
  }

  /** Seta fina + chip "×n" (azul física / âmbar humana) entre duas estações. */
  private construirPorta(porta: CadeiaJogo['portas'][number], x: number): PortaCena {
    const grupo = new THREE.Group();
    grupo.position.set(x, 0, 0);
    this.grupoJogo!.add(grupo);

    const clicaveis: THREE.Object3D[] = [];

    const corpo = new THREE.Mesh(this.geoSetaCorpo, this.matSeta);
    corpo.position.y = 1.55;
    corpo.userData.portaIndice = porta.indice;
    grupo.add(corpo);
    clicaveis.push(corpo);

    const ponta = new THREE.Mesh(this.geoSetaPonta, this.matSeta);
    ponta.position.set((ESPACO - 4.4) / 2 + 0.21, 1.55, 0);
    ponta.userData.portaIndice = porta.indice;
    grupo.add(ponta);
    clicaveis.push(ponta);

    const rotulo = `×${formatarMultiplicador(porta.multiplicador)}`;
    const cor = porta.tipo === 'humana' ? COR_HUMANA : COR_FISICA;
    const chip = this.criarSpriteChip(rotulo, cor);
    chip.position.set(0, 2.35, 0);
    chip.userData.portaIndice = porta.indice;
    grupo.add(chip);
    clicaveis.push(chip);

    return { grupo, clicaveis, chip, rotulo };
  }

  /** Refaz a cadeia atual do zero (volta tudo ao estado inicial). */
  reiniciar(): void {
    if (this.cadeia) this.setCadeia(this.cadeia);
  }

  /**
   * API pública de execução — SÓ age em porta humana pendente (idempotente).
   * Portas físicas são automáticas: chamá-las aqui não faz nada, para o HUD
   * nunca burlar a regra de negócio.
   */
  executarPorta(indice: number): void {
    if (!this.cadeia) return;
    const p = this.cadeia.portas.findIndex((pt) => pt.indice === indice);
    if (p === -1) return;
    if (this.cadeia.portas[p].tipo !== 'humana') return;
    if (this.statusPortas[p] !== 'pendente') return;
    this.executarPortaInterno(p);
  }

  // -------------------------------------------------------------------------
  // Máquina de estados
  // -------------------------------------------------------------------------

  /** Agenda a execução automática de uma porta FÍSICA (~900 ms de respiro). */
  private agendarExecucao(p: number): void {
    this.adicionarTween({
      dur: this.reduzMovimento ? 0.01 : 0.9,
      t: 0,
      ease: identidade,
      onUpdate: () => {},
      onComplete: () => {
        // Revalida: a cadeia pode ter sido trocada/reiniciada durante o delay.
        if (this.cadeia && this.statusPortas[p] === 'pendente') this.executarPortaInterno(p);
      },
    });
  }

  private executarPortaInterno(p: number): void {
    if (!this.cadeia || !this.grupoJogo) return;
    if (this.statusPortas[p] !== 'pendente') return;
    const porta = this.cadeia.portas[p];
    this.statusPortas[p] = 'executando';
    this.atualizarMarcadores();
    this.atualizarInterativos();
    this.emitirEstado();

    // A 1ª execução (física ou humana) é a primeira movimentação do conteúdo:
    // a caixa de compra ABRE — tampas giram, fita arrebenta, poeira sutil.
    if (p === 0) this.abrirCaixas();

    const alvo = this.estagiosCena[porta.indice];

    const concluir = () => {
      // Matrizes finais exatas (sem depender do último frame do tween).
      if (alvo.conteudo && alvo.alvos) {
        for (let k = 0; k < alvo.itens; k++) {
          this.gravarMatriz(alvo.conteudo, k, alvo.alvos[k * 3], alvo.alvos[k * 3 + 1], alvo.alvos[k * 3 + 2], 1);
        }
        alvo.conteudo.instanceMatrix.needsUpdate = true;
      }

      // Fantasma → SÓLIDO: opaco, com sombra — agora existe para o sistema.
      if (alvo.matConteudo) {
        alvo.matConteudo.transparent = false;
        alvo.matConteudo.opacity = 1;
        alvo.matConteudo.depthWrite = true;
        alvo.matConteudo.needsUpdate = true; // troca de `transparent` recompila
      }
      if (alvo.conteudo) {
        alvo.conteudo.castShadow = true;
        alvo.conteudo.receiveShadow = true;
      }

      this.statusPortas[p] = 'concluida';
      this.pintarChipConcluido(p);

      // Prova da conservação: "= R$ X ✓" — o MESMO total de todas as etapas.
      if (!alvo.spriteValor) {
        const no = this.cadeia!.estagios[porta.indice].no;
        alvo.spriteValor = this.criarSpriteValor(no.custoAlocado);
        alvo.spriteValor.position.set(0, alvo.yTopo, 0);
        alvo.grupo.add(alvo.spriteValor);
        alvo.labels.push(alvo.spriteValor);
      }

      const prox = p + 1;
      if (this.cadeia && prox < this.cadeia.portas.length) {
        this.statusPortas[prox] = 'pendente';
        if (this.cadeia.portas[prox].tipo === 'fisica') this.agendarExecucao(prox);
      } else {
        this.concluida = true;
      }
      this.atualizarMarcadores();
      this.atualizarInterativos();
      this.emitirEstado();
    };

    // Reduced motion: conclui no mesmo tick — sem delay, fade ou poeira.
    if (this.reduzMovimento) {
      concluir();
      return;
    }

    // Materialização sóbria: os itens CONDENSAM no lugar (escala 0,35→1 e
    // fade 0,10→1), stagger rápido (~0,7 s no total), sem arco de voo.
    if (!alvo.conteudo || !alvo.alvos || !alvo.matConteudo) {
      concluir();
      return;
    }
    const itens = alvo.itens;
    const mat = alvo.matConteudo;
    const durItem = 0.45;
    const stagger = itens > 1 ? Math.min(0.03, 0.25 / (itens - 1)) : 0;
    const durTotal = durItem + stagger * (itens - 1); // ≤ 0,7 s

    this.adicionarTween({
      dur: durTotal,
      t: 0,
      ease: identidade, // o easing é por item; o relógio global é linear
      onUpdate: (_kEase, kBruto) => {
        const tGlob = kBruto * durTotal;
        for (let j = 0; j < itens; j++) {
          const kj = Math.min(Math.max((tGlob - j * stagger) / durItem, 0), 1);
          const ke = easeOutCubic(kj);
          this.gravarMatriz(
            alvo.conteudo!,
            j,
            alvo.alvos![j * 3],
            alvo.alvos![j * 3 + 1],
            alvo.alvos![j * 3 + 2],
            0.35 + 0.65 * ke,
          );
        }
        alvo.conteudo!.instanceMatrix.needsUpdate = true;
        mat.opacity = 0.1 + 0.9 * easeOutCubic(Math.min(kBruto * 1.6, 1));
      },
      onComplete: concluir,
    });
  }

  /** Abre as tampas das caixas do estágio 0 + poeira sutil de papelão. */
  private abrirCaixas(): void {
    const est0 = this.estagiosCena[0];
    if (!est0 || est0.caixas.length === 0) return;

    if (this.reduzMovimento) {
      for (const cx of est0.caixas) {
        cx.tampaEsq.rotation.z = 1.9;
        cx.tampaDir.rotation.z = -1.9;
        cx.fita.visible = false;
      }
      return;
    }

    const grupo = est0.grupo;
    for (let c = 0; c < est0.caixas.length; c++) {
      const cx = est0.caixas[c];
      // Poeira só nas 3 primeiras caixas: efeito discreto, não carnaval.
      if (c < 3) {
        this.poeira(
          grupo.position.x + cx.grupo.position.x,
          1.2,
          cx.grupo.position.z,
        );
      }
      this.adicionarTween({
        dur: 0.7,
        t: 0,
        ease: easeOutCubic,
        onUpdate: (k) => {
          cx.tampaEsq.rotation.z = 1.9 * k;
          cx.tampaDir.rotation.z = -1.9 * k;
          // A fita "arrebenta" no primeiro quarto da abertura.
          const s = Math.max(1 - k * 4, 0.0001);
          cx.fita.scale.set(s, s, s);
          cx.fita.visible = k < 0.25;
        },
      });
    }
  }

  /** Chip do portal fica verde discreto ao concluir (textura recriada). */
  private pintarChipConcluido(p: number): void {
    const cena = this.portasCena[p];
    const velha = cena.chip.material.map;
    cena.chip.material.map = this.texturaChip(cena.rotulo, COR_PRONTO);
    velha?.dispose();
    cena.chip.material.needsUpdate = true;
  }

  /**
   * Marcador de cada estágio ≥ 1, derivado do status da porta que chega nele:
   *   bloqueada          → 🔒 cadeado (depende do registro anterior)
   *   pendente humana    → ⚠️ pulsando devagar (aguardando SEU registro)
   *   pendente física    → nenhum (executa sozinha em instantes)
   *   executando/concluída → nenhum (materializando ou já com "= R$ ✓")
   */
  private atualizarMarcadores(): void {
    this.marcadoresPulso.length = 0;
    if (!this.cadeia) return;

    for (let p = 0; p < this.cadeia.portas.length; p++) {
      const porta = this.cadeia.portas[p];
      const est = this.estagiosCena[porta.indice];
      if (!est) continue;
      const status = this.statusPortas[p];

      const quer: 'cadeado' | 'alerta' | null =
        status === 'bloqueada'
          ? 'cadeado'
          : status === 'pendente' && porta.tipo === 'humana'
            ? 'alerta'
            : null;

      // Remove o marcador atual se o tipo mudou (ou não deve mais existir).
      const tipoAtual =
        est.marcador == null
          ? null
          : est.marcador.userData.tipo === 'cadeado'
            ? 'cadeado'
            : 'alerta';
      if (tipoAtual !== quer && est.marcador) {
        est.grupo.remove(est.marcador);
        est.marcador.material.dispose(); // a TEXTURA é compartilhada — não dispose
        est.marcador = null;
      }
      if (quer && !est.marcador) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: quer === 'cadeado' ? this.texCadeado : this.texAlerta,
            transparent: true,
            depthWrite: false,
          }),
        );
        sprite.scale.set(0.85, 0.85, 1);
        sprite.position.set(0, est.yTopo, 0);
        sprite.userData.tipo = quer;
        est.grupo.add(sprite);
        est.marcador = sprite;
      }
      if (quer === 'alerta' && est.marcador) this.marcadoresPulso.push(est.marcador);
    }
  }

  // -------------------------------------------------------------------------
  // Tweens e poeira
  // -------------------------------------------------------------------------

  private adicionarTween(tw: Tween): void {
    this.tweens.push(tw);
  }

  /** Poeira de papelão: sobe devagar e cai — sóbria, blending normal. */
  private poeira(x: number, y: number, z: number): void {
    let ativadas = 0;
    for (let i = 0; i < MAX_PARTICULAS && ativadas < POEIRA_POR_CAIXA; i++) {
      if (this.partVida[i] > 0) continue;
      this.partVida[i] = 0.9 + Math.random() * 0.5;
      this.partPos[i * 3] = x + (Math.random() - 0.5) * 0.8;
      this.partPos[i * 3 + 1] = y;
      this.partPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
      const theta = Math.random() * Math.PI * 2;
      const forca = 0.35 + Math.random() * 0.75;
      this.partVel[i * 3] = Math.cos(theta) * forca;
      this.partVel[i * 3 + 1] = 0.5 + Math.random() * 0.9;
      this.partVel[i * 3 + 2] = Math.sin(theta) * forca;
      ativadas++;
    }
    this.partSujo = true;
  }

  // ---------------------------------------------------------------------------
  // Sprites de texto (CanvasTexture)
  // ---------------------------------------------------------------------------

  /**
   * Rótulo 2D preso ao mundo 3D. Canvas 256×128 ×dpr, depthWrite off para os
   * sprites não se morderem na sobreposição. `fundo` desenha um "pill" atrás
   * do texto (chips e etiquetas de valor).
   */
  private criarSpriteTexto(
    linhas: Array<{ texto: string; cor: string; px?: number }>,
    alturaMundo = 0.62,
    fundo?: string,
  ): THREE.Sprite {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = 256 * dpr;
    canvas.height = 128 * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (fundo) {
      this.tracarRoundRect(ctx, 10, 30, 236, 68, 20);
      ctx.fillStyle = fundo;
      ctx.fill();
    }

    linhas.forEach((l, i) => {
      let px = l.px ?? 40;
      // Encolhe a fonte até caber — texto longo não pode estourar o sprite.
      do {
        ctx.font = `700 ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
        if (ctx.measureText(l.texto).width <= 228) break;
        px -= 2;
      } while (px > 14);
      ctx.fillStyle = l.cor;
      ctx.fillText(l.texto, 128, 128 * ((i + 0.5) / linhas.length));
    });

    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: textura,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(alturaMundo * 2, alturaMundo, 1); // canvas é 2:1
    return sprite;
  }

  /** "= R$ 20,00 ✓" — a prova persistente da conservação de valor. */
  private criarSpriteValor(custoAlocado: number): THREE.Sprite {
    return this.criarSpriteTexto(
      [{ texto: `= ${brl2(custoAlocado)} ✓`, cor: '#4ade80', px: 36 }],
      0.55,
      'rgba(6, 20, 12, 0.78)',
    );
  }

  /** Chip "×n" do portal com pill colorido por tipo de etapa. */
  private criarSpriteChip(rotulo: string, corFundo: string): THREE.Sprite {
    const textura = this.texturaChip(rotulo, corFundo);
    const material = new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.5, 0.6, 1);
    return sprite;
  }

  /** Textura do chip: pill sólido com o multiplicador em branco. */
  private texturaChip(rotulo: string, corFundo: string): THREE.CanvasTexture {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = 256 * dpr;
    canvas.height = 102 * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    this.tracarRoundRect(ctx, 28, 14, 200, 74, 37);
    ctx.fillStyle = corFundo;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let px = 44;
    do {
      ctx.font = `800 ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
      if (ctx.measureText(rotulo).width <= 176) break;
      px -= 2;
    } while (px > 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rotulo, 128, 52);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---------------------------------------------------------------------------
  // Interatividade
  // ---------------------------------------------------------------------------

  /**
   * Reconstrói a lista de objetos clicáveis: a seta+chip da porta HUMANA
   * pendente + as instâncias do estágio que a alimenta (clicar no ingrediente
   * também registra a etapa — alvo generoso, como no fluxo real).
   */
  private atualizarInterativos(): void {
    this.alvosInteracao.length = 0;
    this.portaHumanaPendente = -1;
    if (!this.cadeia) return;
    for (let p = 0; p < this.cadeia.portas.length; p++) {
      if (this.cadeia.portas[p].tipo !== 'humana') continue;
      if (this.statusPortas[p] !== 'pendente') continue;
      this.alvosInteracao.push(...this.portasCena[p].clicaveis);
      if (this.portaHumanaPendente === -1) {
        this.portaHumanaPendente = p;
        const pai = this.estagiosCena[this.cadeia.portas[p].indice - 1];
        if (pai?.conteudo) this.alvosInteracao.push(pai.conteudo);
      }
    }
  }

  /** Retorna o índice da porta atingida pelo raio, ou null. */
  private intersectarInterativo(e: PointerEvent): number | null {
    if (this.alvosInteracao.length === 0 || !this.cadeia) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ponteiro.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ponteiro, this.camera);
    const hits = this.raycaster.intersectObjects(this.alvosInteracao, false);
    if (hits.length === 0) return null;
    const idx = hits[0].object.userData.portaIndice;
    if (typeof idx === 'number') return idx;
    // Clicou nos itens do estágio pai → a porta humana pendente da vez.
    if (this.portaHumanaPendente >= 0) return this.cadeia.portas[this.portaHumanaPendente].indice;
    return null;
  }

  private processarHover(e: PointerEvent): void {
    const indice = this.intersectarInterativo(e);
    const p = indice != null && this.cadeia
      ? this.cadeia.portas.findIndex((pt) => pt.indice === indice)
      : -1;
    if (p === this.hoverPorta) return;
    this.hoverPorta = p;
    this.renderer.domElement.style.cursor = p >= 0 ? 'pointer' : 'grab';
  }

  /** Clique ≠ drag: só conta se o ponteiro moveu < 6 px entre down e up. */
  private processarSolta(e: PointerEvent): void {
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (dx * dx + dy * dy >= 36) return;
    const indice = this.intersectarInterativo(e);
    if (indice != null) this.executarPorta(indice);
  }

  // -------------------------------------------------------------------------
  // Loop, resize, dispose
  // -------------------------------------------------------------------------

  private gravarMatriz(
    malha: THREE.InstancedMesh,
    indice: number,
    x: number,
    y: number,
    z: number,
    escala: number,
  ): void {
    this.matrizTmp.makeScale(escala, escala, escala);
    this.matrizTmp.setPosition(x, y, z);
    malha.setMatrixAt(indice, this.matrizTmp);
  }

  private animar = (): void => {
    if (this.destruido) return;
    this.idAnimacao = requestAnimationFrame(this.animar);

    // Delta com teto: aba inativa devolve dt gigante e explodiria os tweens.
    const dt = Math.min(this.relogio.getDelta(), 0.05);
    this.tempoTotal += dt;
    const t = this.tempoTotal;

    // --- Tweens (agendamentos, materialização, abertura das caixas) ---------
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(tw.t / tw.dur, 1);
      tw.onUpdate(tw.ease(k), k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.onComplete?.();
      }
    }

    // --- Pulso do ⚠️: 1 pulso a cada 2 s (sin(t·π) tem período 2 s) ---------
    if (!this.reduzMovimento) {
      const pulso = 1 + 0.1 * Math.sin(t * Math.PI);
      for (const sprite of this.marcadoresPulso) {
        sprite.scale.set(0.85 * pulso, 0.85 * pulso, 1);
      }
    }

    // --- Poeira (pool fixo, gravidade leve) ----------------------------------
    if (this.partSujo) {
      let algumaViva = false;
      for (let i = 0; i < MAX_PARTICULAS; i++) {
        if (this.partVida[i] <= 0) continue;
        algumaViva = true;
        this.partVida[i] -= dt;
        if (this.partVida[i] <= 0) {
          this.partPos[i * 3 + 1] = -1000; // morreu: some para baixo do mundo
          continue;
        }
        this.partVel[i * 3 + 1] -= 2.2 * dt;
        this.partPos[i * 3] += this.partVel[i * 3] * dt;
        this.partPos[i * 3 + 1] += this.partVel[i * 3 + 1] * dt;
        this.partPos[i * 3 + 2] += this.partVel[i * 3 + 2] * dt;
      }
      (this.pontos3d.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      this.partSujo = algumaViva;
    }

    this.controles.update(); // necessário por causa do damping
    this.renderer.render(this.cena, this.camera);
  };

  private enquadrarCamera(n: number): void {
    const largura = (n - 1) * ESPACO;
    const dist = Math.max(16, largura * 0.72 + 10);
    this.camera.position.set(0, dist * 0.5, dist);
    this.controles.target.set(0, 1.4, 0);
    this.controles.update();
  }

  private redimensionar(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private emitirEstado(): void {
    if (!this.opcoes.onEstado) return;
    const portas: EstadoPorta[] = this.cadeia
      ? this.cadeia.portas.map((pt, p) => ({
          indice: pt.indice,
          tipo: pt.tipo,
          status: this.statusPortas[p],
        }))
      : [];
    let feitas = 0;
    for (const s of this.statusPortas) if (s === 'concluida') feitas++;
    this.opcoes.onEstado({
      etapasConcluidas: feitas,
      totalEtapas: portas.length,
      concluida: this.concluida,
      portas,
    });
  }

  /**
   * Remove da cena e dispõe o que é por-cadeia. Cuidado cirúrgico: as
   * geometrias/materiais das ESTRUTURAS e as TEXTURAS de ícone são
   * compartilhados — só morrem no dispose() da engine, nunca aqui.
   */
  private limparCadeia(): void {
    this.tweens.length = 0; // cancela agendamentos/animações em voo
    this.hoverPorta = -1;
    this.portaHumanaPendente = -1;
    this.alvosInteracao.length = 0;
    this.marcadoresPulso.length = 0;
    this.statusPortas = [];
    this.concluida = false;

    // Mata a poeira viva para a próxima cadeia não herdar resíduo velho.
    if (this.partVida) {
      this.partVida.fill(0);
      for (let i = 0; i < MAX_PARTICULAS; i++) this.partPos[i * 3 + 1] = -1000;
      this.partSujo = true;
    }

    for (const est of this.estagiosCena) {
      // InstancedMesh do conteúdo: libera buffers de instância + material próprio.
      est.conteudo?.dispose();
      est.matConteudo?.dispose();
      // Marcador: material próprio; a textura (cadeado/alerta) é compartilhada.
      est.marcador?.material.dispose();
      // Labels e sprite de valor: textura única por sprite → map + material.
      for (const s of est.labels) {
        s.material.map?.dispose();
        s.material.dispose();
      }
    }
    for (const porta of this.portasCena) {
      porta.chip.material.map?.dispose();
      porta.chip.material.dispose();
    }

    if (this.grupoJogo) {
      this.cena.remove(this.grupoJogo);
      this.grupoJogo = null;
    }
    this.estagiosCena = [];
    this.portasCena = [];
  }

  /** Limpeza completa — chamar ao desmontar o componente React. */
  dispose(): void {
    this.destruido = true;
    cancelAnimationFrame(this.idAnimacao);

    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);

    this.limparCadeia();

    // Geometrias e materiais compartilhados das estruturas.
    this.geoCaixaCorpo.dispose();
    this.geoCaixaTampa.dispose();
    this.geoFita.dispose();
    this.geoPrancha.dispose();
    this.geoPe.dispose();
    this.geoPeBaixo.dispose();
    this.geoBandeja.dispose();
    this.geoTabua.dispose();
    this.geoTub.dispose();
    this.geoEsfera.dispose();
    this.geoFatia.dispose();
    this.geoSetaCorpo.dispose();
    this.geoSetaPonta.dispose();
    this.matKraft.dispose();
    this.matFita.dispose();
    this.matMetal.dispose();
    this.matMadeira.dispose();
    this.matSeta.dispose();

    // Texturas de ícone desenhadas em canvas.
    this.texCadeado.dispose();
    this.texAlerta.dispose();

    // Pool de poeira.
    this.pontos3d.geometry.dispose();
    (this.pontos3d.material as THREE.Material).dispose();

    this.controles.dispose();
    this.cena.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
