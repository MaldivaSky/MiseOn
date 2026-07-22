/**
 * RastreioEngine — cena 3D do rastreio de estoque: UMA LINHA POR ITEM.
 *
 * Não é jogo: sem pontos, placar ou confete. É uma prancha de observabilidade
 * onde cada linha é um insumo e cada coluna é um estágio da cadeia de
 * conversão (Compra → Armazenado → Quebra → Uso), com as quantidades REAIS
 * convertidas por nível e o custo unitário correspondente.
 *
 * Decisões de arquitetura (e o porquê):
 *
 *  - SEM pós-processamento (composer/bloom): a cena é informação, não
 *    vitrine. `antialias: true` nativo + ACES bastam, e eliminar o composer
 *    corta uma classe inteira de custo e de falhas.
 *  - ALINHAMENTO PELA ESQUERDA: a coluna do estágio é o seu ÍNDICE na cadeia
 *    (Compra sempre em x=-12, etc.), não a distância até a base. Ler a cena
 *    como tabela ("todas as compras alinhadas") é mais útil que alinhar pela
 *    unidade final, que mudaria de coluna conforme o tamanho da cadeia.
 *  - InstancedMesh por linha-estágio: geometria e material COMPARTILHADOS
 *    entre todas as linhas; só o buffer de instâncias é por linha-estágio.
 *    As setas de fluxo são UM ÚNICO InstancedMesh para a cena inteira, com a
 *    cor por instância (azul = física, âmbar = humana).
 *  - BLINDAGEM ANTI-CRASH (regressão do "isVector3"): quantidades reais são
 *    fracionárias (2,5 kg; 7,33 un) e um Float32Array truncado por contagem
 *    fracionária derrubava a tela inteira. TODA contagem de instâncias passa
 *    por `contagemVisual` — inteiro ≥ 1, finito, com cap. Símbolo nunca some,
 *    buffer nunca estoura.
 *  - Sprites CanvasTexture para textos (padrão do módulo): nomes, quantidades,
 *    custos, chips "×n" e o ⚠️ das etapas humanas. O marcador ⚠️ é INFO
 *    permanente (rendimento declarado pelo lojista), não mecânica de clique.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { getUnidade, type Grandeza } from '../../unidades';
import type { CategoriaRastreio, EstadoItem, ItemRastreio } from './carregarRastreio';

// ---------------------------------------------------------------------------
// Contrato público
// ---------------------------------------------------------------------------

export type HoverRastreio =
  | { tipo: 'linha'; item: ItemRastreio; telaX: number; telaY: number }
  | { tipo: 'etapa-humana'; telaX: number; telaY: number };

export interface OpcoesRastreio {
  onSelecionar?: (item: ItemRastreio) => void;
  onHover?: (info: HoverRastreio | null) => void;
  /** prefers-reduced-motion: desliga flutuação dos marcadores e o foco suave. */
  movimentoReduzido?: boolean;
}

/** Itens por página de categoria — o wrapper usa a mesma constante. */
export const ITENS_POR_PAGINA = 12;

/** Máximo de objetos 3D por estágio (cap visual — os números sempre mostram o real). */
export const CAP_OBJETOS_ESTAGIO = 12;

/**
 * Converte uma quantidade REAL (possivelmente fracionária/infinita) numa
 * contagem de instâncias SEGURA: inteira, ≥ 1, finita e limitada ao cap.
 * Exportada para teste de regressão do crash de contagem fracionária.
 */
export function contagemVisual(
  quantidade: number,
  cap: number = CAP_OBJETOS_ESTAGIO,
): { n: number; excedente: number } {
  const finita = Number.isFinite(quantidade) ? quantidade : 0;
  const inteira = Math.max(1, Math.round(finita));
  return { n: Math.min(inteira, cap), excedente: Math.max(0, inteira - cap) };
}

// ---------------------------------------------------------------------------
// Constantes visuais
// ---------------------------------------------------------------------------

const COR_FUNDO = 0x0a0e17;
/** Colunas fixas dos estágios pelo índice (Compra, Armazenado, Quebra, Uso). */
const COL_X = [-12, -4, 4, 12];
const ESPACO_COLUNA = 8;
const ESPACO_LINHA = 7;
const X_NOME = COL_X[0] - 7.2; // label do item à esquerda da 1ª coluna

const COR_KRAFT = 0xa0793f;
const COR_FITA = 0x5e4732;
const COR_BLOCO = 0x7f8ca3;   // saco/bloco sóbrio (massa/volume)
const COR_ITEM = 0xd9b06a;    // peças arredondadas (contagem)
const COR_FATIA = 0xc97b4a;   // fatias/porções (semântico)
const COR_TABUA = 0x8a6a42;   // tábua sob fatias
const COR_SETA_FISICA = 0x3b82f6;
const COR_SETA_HUMANA = 0xf59e0b;

const COR_ESTADO: Record<EstadoItem, string> = {
  ok: '#34d399',
  critico: '#ef4444',
  sem_estoque: '#64748b',
  sem_custo: '#f59e0b',
  alerta_desvio: '#fb923c',
};

const ROTULO_ESTADO: Record<EstadoItem, string> = {
  ok: '',
  critico: 'crítico',
  sem_estoque: 'sem estoque',
  sem_custo: 'sem custo registrado',
  alerta_desvio: 'desvio de custo',
};

const brl = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const fmtQtd = (v: number) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface LinhaCena {
  item: ItemRastreio;
  grupo: THREE.Group;
  /** Elevação atual e alvo (hover/seleção sobem a linha suavemente). */
  y: number;
  alvoY: number;
  /** Faixa de seleção sob a linha. */
  faixa: THREE.Mesh;
  marcadores: THREE.Sprite[];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class RastreioEngine {
  private container: HTMLElement;
  private opcoes: OpcoesRastreio;

  private renderer!: THREE.WebGLRenderer;
  private cena!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controles!: OrbitControls;

  // Geometrias e materiais COMPARTILHADOS (criados uma vez, dispostos no fim).
  private geoCaixa!: THREE.BufferGeometry;
  private geoBloco!: THREE.BufferGeometry;
  private geoItem!: THREE.BufferGeometry;
  private geoFatia!: THREE.BufferGeometry;
  private geoTabua!: THREE.BufferGeometry;
  private geoSeta!: THREE.BufferGeometry;
  private matCaixa!: THREE.MeshStandardMaterial;
  private matBloco!: THREE.MeshStandardMaterial;
  private matItem!: THREE.MeshStandardMaterial;
  private matFatia!: THREE.MeshStandardMaterial;
  private matTabua!: THREE.MeshStandardMaterial;
  private matSeta!: THREE.MeshStandardMaterial;
  private texAlerta!: THREE.CanvasTexture;

  /** Raiz da página atual; tudo dentro dele é descartado a cada setCategoria. */
  private grupoPagina: THREE.Group | null = null;
  private linhas: LinhaCena[] = [];
  private paginaAtual = 0;
  private categoriaAtual: CategoriaRastreio | null = null;
  private indiceSelecionado: number | null = null;

  /** Objetos raycastáveis (meshes de linha + marcadores ⚠️). */
  private interativos: THREE.Object3D[] = [];

  private raycaster = new THREE.Raycaster();
  private ponteiro = new THREE.Vector2();
  private indiceHover: number | null = null;
  private hoverMarcador = false;

  private relogio = new THREE.Clock();
  private idAnimacao = 0;
  private destruido = false;

  // Objetos temporários reutilizados no loop (zero alocação por frame).
  private matrizTmp = new THREE.Matrix4();
  private quatTmp = new THREE.Quaternion();
  private escalaTmp = new THREE.Vector3(1, 1, 1);
  private posTmp = new THREE.Vector3();
  private corTmp = new THREE.Color();

  private onPointerMove = (e: PointerEvent) => this.processarHover(e);
  private onClick = (e: PointerEvent) => this.processarClique(e);
  private onResize = () => this.redimensionar();

  constructor(container: HTMLElement, opcoes: OpcoesRastreio = {}) {
    this.container = container;
    this.opcoes = opcoes;

    this.inicializarCena();
    this.inicializarLuzes();
    this.inicializarRecursosCompartilhados();

    container.addEventListener('pointermove', this.onPointerMove);
    container.addEventListener('pointerdown', this.onClick);
    window.addEventListener('resize', this.onResize);

    this.animar();
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private inicializarCena(): void {
    const { clientWidth: w, clientHeight: h } = this.container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color(COR_FUNDO);
    this.cena.fog = new THREE.Fog(COR_FUNDO, 55, 130);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 400);
    this.camera.position.set(0, 18, 26);

    this.controles = new OrbitControls(this.camera, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.06;
    // Limita o ângulo polar: nem por baixo do piso, nem zenital — a prancha
    // de linhas deve continuar legível como tabela.
    this.controles.minPolarAngle = Math.PI * 0.14;
    this.controles.maxPolarAngle = Math.PI * 0.52;
    this.controles.minDistance = 8;
    this.controles.maxDistance = 80;
    this.controles.target.set(-3, 0, 0);

    // Piso que recebe sombra + grid sutil para ancorar as linhas no espaço.
    const piso = new THREE.Mesh(
      new THREE.CircleGeometry(120, 64),
      new THREE.MeshStandardMaterial({ color: 0x0d1320, roughness: 0.95, metalness: 0 }),
    );
    piso.rotation.x = -Math.PI / 2;
    piso.position.y = -0.02;
    piso.receiveShadow = true;
    piso.name = 'piso';
    this.cena.add(piso);

    const grid = new THREE.GridHelper(200, 100, 0x22314f, 0x141d31);
    grid.position.y = 0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    grid.name = 'grid';
    this.cena.add(grid);
  }

  private inicializarLuzes(): void {
    this.cena.add(new THREE.AmbientLight(0x8899bb, 0.55));

    const principal = new THREE.DirectionalLight(0xffffff, 2.0);
    principal.position.set(20, 32, 14);
    principal.castShadow = true;
    principal.shadow.mapSize.set(2048, 2048);
    principal.shadow.bias = -0.0004;
    const ext = 48;
    principal.shadow.camera.left = -ext;
    principal.shadow.camera.right = ext;
    principal.shadow.camera.top = ext;
    principal.shadow.camera.bottom = -ext;
    principal.shadow.camera.far = 120;
    this.cena.add(principal);

    // Preenchimentos frio/quente discretos — modelam o volume dos objetos
    // sem o ar "vitrine neon" (a cena é operacional, não decorativa).
    const frio = new THREE.PointLight(0x3366ff, 36, 90, 1.8);
    frio.position.set(-22, 8, -16);
    this.cena.add(frio);

    const quente = new THREE.PointLight(0xff8a3d, 26, 90, 1.8);
    quente.position.set(18, 6, 22);
    this.cena.add(quente);
  }

  /**
   * Geometrias/materiais únicos da cena inteira. Criar uma vez e compartilhar
   * é o que mantém o custo de memória plano quando a página troca.
   */
  private inicializarRecursosCompartilhados(): void {
    // Caixa de papelão com fita: corpo + tira de fita MESCLADOS numa geometria
    // só com vertex colors — 1 draw call por linha-estágio, não 2 por caixa.
    const corpo = new THREE.BoxGeometry(1.3, 1.05, 1.3);
    corpo.translate(0, 0.525, 0);
    pintarGeometria(corpo, COR_KRAFT);
    const fita = new THREE.BoxGeometry(1.34, 0.1, 0.42);
    fita.translate(0, 1.08, 0);
    pintarGeometria(fita, COR_FITA);
    this.geoCaixa = mergeGeometries([corpo, fita])!;
    corpo.dispose();
    fita.dispose();

    // Saco/bloco para massa e volume: cápsula baixa e sóbria.
    this.geoBloco = new THREE.CapsuleGeometry(0.58, 0.75, 6, 18);
    this.geoBloco.translate(0, 0.96, 0);
    pintarGeometria(this.geoBloco, COR_BLOCO);

    // Unidades de contagem: peças arredondadas.
    this.geoItem = new THREE.SphereGeometry(0.62, 20, 16);
    this.geoItem.translate(0, 0.62, 0);
    pintarGeometria(this.geoItem, COR_ITEM);

    // Semânticos (fatias/porções/peças): cilindros achatados sobre tábua.
    this.geoFatia = new THREE.CylinderGeometry(0.55, 0.55, 0.16, 20);
    this.geoFatia.translate(0, 0.2, 0);
    pintarGeometria(this.geoFatia, COR_FATIA);

    this.geoTabua = new THREE.BoxGeometry(5.4, 0.12, 4.2);
    this.geoTabua.translate(0, 0.06, 0);
    pintarGeometria(this.geoTabua, COR_TABUA);

    // Seta de fluxo: haste + ponta mescladas, apontando para +X.
    const haste = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 10);
    haste.rotateZ(-Math.PI / 2);
    haste.translate(-0.4, 0, 0);
    const ponta = new THREE.ConeGeometry(0.24, 0.8, 12);
    ponta.rotateZ(-Math.PI / 2);
    ponta.translate(1.2, 0, 0);
    this.geoSeta = mergeGeometries([haste, ponta])!;
    haste.dispose();
    ponta.dispose();

    const padrao = { vertexColors: true, roughness: 0.85, metalness: 0.05 } as const;
    this.matCaixa = new THREE.MeshStandardMaterial({ ...padrao, roughness: 0.92 });
    this.matBloco = new THREE.MeshStandardMaterial(padrao);
    this.matItem = new THREE.MeshStandardMaterial({ ...padrao, roughness: 0.7 });
    this.matFatia = new THREE.MeshStandardMaterial({ ...padrao, roughness: 0.75 });
    this.matTabua = new THREE.MeshStandardMaterial({ ...padrao, roughness: 0.9 });
    // Setas: branco base × cor por instância (azul física / âmbar humana).
    this.matSeta = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });

    this.texAlerta = this.desenharAlerta();
  }

  // -------------------------------------------------------------------------
  // Ícones desenhados em canvas (determinísticos — não dependem de fonte)
  // -------------------------------------------------------------------------

  /** Triângulo âmbar com "!" — marcador permanente da etapa humana. */
  private desenharAlerta(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    ctx.moveTo(64, 32);
    ctx.arcTo(64, 10, 118, 112, 14);
    ctx.arcTo(118, 112, 10, 112, 14);
    ctx.arcTo(10, 112, 64, 10, 14);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#7c4a03';
    ctx.stroke();

    ctx.fillStyle = '#3a2503';
    tracarRoundRect(ctx, 59, 40, 10, 36, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 92, 6.5, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---------------------------------------------------------------------------
  // Sprites de texto (CanvasTexture)
  // ---------------------------------------------------------------------------

  /**
   * Rótulo preso ao mundo 3D. `proporcao` define o canvas (2 = 256×128,
   * 3 = 384×128). depthWrite off para sprites não se morderem na sobreposição.
   */
  private criarSpriteTexto(
    linhas: Array<{ texto: string; cor: string; px?: number; peso?: number }>,
    alturaMundo: number,
    proporcao: 2 | 3 = 2,
    fundo?: string,
  ): THREE.Sprite {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 128 * proporcao;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = 128 * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (fundo) {
      tracarRoundRect(ctx, 8, 30, W - 16, 68, 20);
      ctx.fillStyle = fundo;
      ctx.fill();
    }

    linhas.forEach((l, i) => {
      let px = l.px ?? 40;
      const peso = l.peso ?? 700;
      // Encolhe a fonte até caber — nome longo não pode estourar o sprite.
      do {
        ctx.font = `${peso} ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
        if (ctx.measureText(l.texto).width <= W - 24) break;
        px -= 2;
      } while (px > 12);
      ctx.fillStyle = l.cor;
      ctx.fillText(l.texto, W / 2, 128 * ((i + 0.5) / linhas.length));
    });

    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(alturaMundo * proporcao, alturaMundo, 1);
    return sprite;
  }

  /** Label de início de linha: ponto de estado + nome + categoria/badge. */
  private criarSpriteNome(item: ItemRastreio): THREE.Sprite {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 384;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = 128 * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const corEstado = COR_ESTADO[item.estado];
    // Ponto de estado (o "semaforinho" da linha).
    ctx.beginPath();
    ctx.arc(26, 44, 12, 0, Math.PI * 2);
    ctx.fillStyle = corEstado;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10, 14, 23, 0.9)';
    ctx.stroke();

    // Nome (encolhe até caber nos ~330px após o ponto).
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let px = 40;
    do {
      ctx.font = `700 ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
      if (ctx.measureText(item.nome).width <= 322) break;
      px -= 2;
    } while (px > 14);
    ctx.fillStyle = '#eaf1ff';
    ctx.fillText(item.nome, 48, 44);

    // Linha 2: categoria; quando há alerta, o estado toma o lugar (é o que
    // importa) em vez da categoria — ela já aparece no chip da aba.
    const badge =
      item.estado === 'alerta_desvio'
        ? `desvio ${Math.abs(Math.round(item.desvioPct ?? 0))}%`
        : ROTULO_ESTADO[item.estado];
    const linha2 = badge ? `${item.categoria} · ${badge}` : item.categoria;
    ctx.font = `600 26px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    ctx.fillStyle = badge ? corEstado : '#9fb2d4';
    ctx.fillText(linha2, 48, 92);

    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(5.4, 1.8, 1);
    return sprite;
  }

  /** Chip "×n" entre estágios: azul (física ✓) ou âmbar (humana ⚠). */
  private criarChip(multiplicador: number, tipo: 'fisica' | 'humana'): THREE.Sprite {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 176;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = 88 * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    tracarRoundRect(ctx, 6, 8, W - 12, 72, 26);
    ctx.fillStyle = tipo === 'fisica' ? 'rgba(30, 64, 140, 0.92)' : 'rgba(120, 72, 8, 0.94)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = tipo === 'fisica' ? '#60a5fa' : '#fbbf24';
    ctx.stroke();

    const mult = Number.isFinite(multiplicador)
      ? multiplicador.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
      : '?';
    const texto = tipo === 'fisica' ? `×${mult} ✓` : `×${mult} ⚠`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let px = 38;
    do {
      ctx.font = `700 ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
      if (ctx.measureText(texto).width <= W - 28) break;
      px -= 2;
    } while (px > 14);
    ctx.fillStyle = tipo === 'fisica' ? '#bfdbfe' : '#fde68a';
    ctx.fillText(texto, W / 2, 46);

    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.2, 1.1, 1);
    return sprite;
  }

  // -------------------------------------------------------------------------
  // Dados → cena
  // -------------------------------------------------------------------------

  /**
   * Substitui a página exibida: fatia os itens da categoria e reconstrói as
   * linhas. Geometrias/materiais compartilhados NÃO são recriados aqui.
   */
  setCategoria(categoria: CategoriaRastreio, pagina: number): void {
    this.categoriaAtual = categoria;
    this.paginaAtual = pagina;
    this.indiceSelecionado = null;
    this.indiceHover = null;
    this.limparPagina();

    const inicio = pagina * ITENS_POR_PAGINA;
    const itens = categoria.itens.slice(inicio, inicio + ITENS_POR_PAGINA);
    if (itens.length === 0) return;

    this.grupoPagina = new THREE.Group();
    this.cena.add(this.grupoPagina);

    // --- Setas de TODA a página num único InstancedMesh ----------------------
    const totalSetas = itens.reduce((acc, i) => acc + Math.max(0, i.estagios.length - 1), 0);
    const setas = new THREE.InstancedMesh(this.geoSeta, this.matSeta, Math.max(1, totalSetas));
    setas.count = totalSetas;
    let idxSeta = 0;

    itens.forEach((item, idxLinha) => {
      const z = (idxLinha - (itens.length - 1) / 2) * ESPACO_LINHA;
      const linha = this.construirLinha(item, idxLinha, z);
      this.linhas.push(linha);

      // Setas + chips entre os estágios desta linha.
      for (let s = 1; s < item.estagios.length; s++) {
        const xA = this.colunaX(s - 1);
        const xB = this.colunaX(s);
        const meio = (xA + xB) / 2;

        this.matrizTmp.compose(
          this.posTmp.set(meio, 1.15, z),
          this.quatTmp.identity(),
          this.escalaTmp.set(1, 1, 1),
        );
        setas.setMatrixAt(idxSeta, this.matrizTmp);
        const tipo = item.estagios[s].tipo;
        this.corTmp.set(tipo === 'fisica' ? COR_SETA_FISICA : COR_SETA_HUMANA);
        setas.setColorAt(idxSeta, this.corTmp);
        idxSeta++;

        const consumida = item.estagios[s - 1].quantidade;
        const mult = consumida > 0 ? item.estagios[s].quantidade / consumida : NaN;
        const chip = this.criarChip(mult, tipo);
        chip.position.set(meio, 2.35, z);
        linha.grupo.add(chip);
      }
    });

    if (totalSetas > 0) {
      setas.instanceMatrix.needsUpdate = true;
      if (setas.instanceColor) setas.instanceColor.needsUpdate = true;
      this.grupoPagina.add(setas);
    } else {
      setas.dispose();
    }

    this.enquadrarCamera(itens.length);
  }

  /** X da coluna do estágio pelo índice (alinhamento pela esquerda). */
  private colunaX(indiceEstagio: number): number {
    return indiceEstagio < COL_X.length
      ? COL_X[indiceEstagio]
      : COL_X[COL_X.length - 1] + (indiceEstagio - COL_X.length + 1) * ESPACO_COLUNA;
  }

  /** Monta uma linha: faixa de seleção, nome, estágios, labels e marcadores. */
  private construirLinha(item: ItemRastreio, idxLinha: number, z: number): LinhaCena {
    const grupo = new THREE.Group();
    grupo.position.set(0, 0, z);
    this.grupoPagina!.add(grupo);

    const marcadores: THREE.Sprite[] = [];

    // Faixa de seleção sob a linha inteira (apagada até hover/seleção).
    const ultimaCol = this.colunaX(item.estagios.length - 1);
    const faixaGeo = new THREE.PlaneGeometry(ultimaCol - X_NOME + 8, 4.6);
    const faixaMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const faixa = new THREE.Mesh(faixaGeo, faixaMat);
    faixa.rotation.x = -Math.PI / 2;
    faixa.position.set((X_NOME - 4 + ultimaCol + 4) / 2, 0.02, 0);
    faixa.userData.linhaIdx = idxLinha;
    grupo.add(faixa);
    this.interativos.push(faixa);

    // Label do item no início da linha (nome + categoria/estado).
    const nome = this.criarSpriteNome(item);
    nome.position.set(X_NOME, 1.5, 0);
    grupo.add(nome);

    // --- Estágios -------------------------------------------------------------
    item.estagios.forEach((estagio, s) => {
      const x = this.colunaX(s);
      const grandeza = getUnidade(estagio.unidade)?.grandeza;
      const semEstoque = item.estado === 'sem_estoque' || estagio.quantidade <= 0;

      // Tábua sob itens semânticos (fatias/porções/peças).
      if (grandeza === 'semantico') {
        const tabua = new THREE.Mesh(this.geoTabua, this.matTabua);
        tabua.position.set(x, 0, 0);
        tabua.receiveShadow = true;
        tabua.userData.linhaIdx = idxLinha;
        grupo.add(tabua);
        this.interativos.push(tabua);
      }

      // Conteúdo simbólico: contagem SEMPRE inteira via contagemVisual.
      const { n, excedente } = contagemVisual(estagio.quantidade);
      const geo = this.geometriaPorGrandeza(grandeza);
      const mat = this.materialPorGrandeza(grandeza);

      const malha = new THREE.InstancedMesh(geo, mat, n);
      malha.castShadow = !semEstoque;
      malha.receiveShadow = true;
      malha.userData.linhaIdx = idxLinha;

      const passo = 1.55;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const yBase = grandeza === 'semantico' ? 0.12 : 0; // sobre a tábua
      for (let k = 0; k < n; k++) {
        const col = k % cols;
        const row = Math.floor(k / cols);
        this.matrizTmp.compose(
          this.posTmp.set(
            x + (col - (cols - 1) / 2) * passo,
            yBase,
            (row - (rows - 1) / 2) * passo,
          ),
          this.quatTmp.identity(),
          this.escalaTmp.set(1, 1, 1),
        );
        malha.setMatrixAt(k, this.matrizTmp);
      }
      malha.instanceMatrix.needsUpdate = true;

      // Item sem estoque: o símbolo vira fantasma (opacidade por instância não
      // existe; usa-se cor escurecida por instância em vez de material novo).
      if (semEstoque) {
        this.corTmp.set(0x2a3648);
        for (let k = 0; k < n; k++) malha.setColorAt(k, this.corTmp);
        if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
      }

      grupo.add(malha);
      this.interativos.push(malha);

      // Label do estágio: "R$ X/un" (ou aviso) + "8 un" — quantidade REAL.
      const linhaCusto =
        estagio.custoUnitario != null
          ? { texto: `${brl(estagio.custoUnitario)}/${estagio.unidade}`, cor: '#cbd5e1', px: 34 }
          : { texto: 'sem custo registrado', cor: '#f59e0b', px: 30 };
      const textoQtd = `${fmtQtd(estagio.quantidade)} ${estagio.unidade}`;
      const label = this.criarSpriteTexto(
        [linhaCusto, { texto: textoQtd, cor: '#9fb2d4', px: 28, peso: 600 }],
        1.15,
        2,
        'rgba(10, 14, 23, 0.60)',
      );
      label.position.set(x, 3.35, 0);
      grupo.add(label);

      // Excedente do cap visual: "+N" honesto ao lado do grupo de objetos.
      if (excedente > 0) {
        const mais = this.criarSpriteTexto(
          [{ texto: `+${excedente.toLocaleString('pt-BR')}`, cor: '#f59e0b', px: 40 }],
          0.62,
          2,
          'rgba(10, 14, 23, 0.62)',
        );
        mais.position.set(x + (cols * passo) / 2 + 1.2, 1.5, 0);
        grupo.add(mais);
      }

      // Marcador ⚠️ permanente da etapa humana (rendimento declarado).
      if (estagio.tipo === 'humana') {
        const marcador = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: this.texAlerta, transparent: true, depthWrite: false }),
        );
        marcador.scale.set(0.95, 0.95, 1);
        marcador.position.set(x + 1.9, 4.15, 0);
        marcador.userData.marcadorHumano = true;
        marcador.userData.baseY = 4.15;
        grupo.add(marcador);
        marcadores.push(marcador);
        this.interativos.push(marcador);
      }
    });

    return { item, grupo, y: 0, alvoY: 0, faixa, marcadores };
  }

  private geometriaPorGrandeza(grandeza: Grandeza | undefined): THREE.BufferGeometry {
    switch (grandeza) {
      case 'agrupador': return this.geoCaixa;
      case 'massa':
      case 'volume': return this.geoBloco;
      case 'semantico': return this.geoFatia;
      case 'contagem':
      default: return this.geoItem; // unidade desconhecida ⇒ peça neutra
    }
  }

  private materialPorGrandeza(grandeza: Grandeza | undefined): THREE.MeshStandardMaterial {
    switch (grandeza) {
      case 'agrupador': return this.matCaixa;
      case 'massa':
      case 'volume': return this.matBloco;
      case 'semantico': return this.matFatia;
      case 'contagem':
      default: return this.matItem;
    }
  }

  // -------------------------------------------------------------------------
  // Seleção e hover
  // -------------------------------------------------------------------------

  /** Seleciona uma linha pelo insumoId (clique no cartão-resumo, por ex.). */
  selecionar(insumoId: string | null): void {
    this.indiceSelecionado =
      insumoId == null ? null : this.linhas.findIndex((l) => l.item.insumoId === insumoId);
    if (this.indiceSelecionado === -1) this.indiceSelecionado = null;
    this.atualizarAlvos();
  }

  private atualizarAlvos(): void {
    const reduzido = this.opcoes.movimentoReduzido === true;
    this.linhas.forEach((linha, i) => {
      const alvo =
        i === this.indiceSelecionado ? 0.55 : i === this.indiceHover ? 0.3 : 0;
      linha.alvoY = alvo;
      if (reduzido) linha.y = alvo; // sem animação: salta direto
      const mat = linha.faixa.material as THREE.MeshBasicMaterial;
      mat.opacity = i === this.indiceSelecionado ? 0.16 : i === this.indiceHover ? 0.08 : 0;
    });
  }

  private intersectar(e: PointerEvent): { linha: number | null; marcador: boolean } {
    if (this.interativos.length === 0) return { linha: null, marcador: false };
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ponteiro.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ponteiro, this.camera);
    const hits = this.raycaster.intersectObjects(this.interativos, false);
    if (hits.length === 0) return { linha: null, marcador: false };
    const obj = hits[0].object;
    if (obj.userData.marcadorHumano) {
      return { linha: null, marcador: true };
    }
    const idx = typeof obj.userData.linhaIdx === 'number' ? obj.userData.linhaIdx : null;
    return { linha: idx, marcador: false };
  }

  private processarHover(e: PointerEvent): void {
    const { linha, marcador } = this.intersectar(e);

    if (linha !== this.indiceHover || marcador !== this.hoverMarcador) {
      this.indiceHover = linha;
      this.hoverMarcador = marcador;
      this.atualizarAlvos();
    }

    this.renderer.domElement.style.cursor = linha != null || marcador ? 'pointer' : 'grab';

    if (!this.opcoes.onHover) return;
    if (marcador) {
      this.opcoes.onHover({ tipo: 'etapa-humana', telaX: e.clientX, telaY: e.clientY });
    } else if (linha != null && this.linhas[linha]) {
      this.opcoes.onHover({ tipo: 'linha', item: this.linhas[linha].item, telaX: e.clientX, telaY: e.clientY });
    } else {
      this.opcoes.onHover(null);
    }
  }

  private processarClique(e: PointerEvent): void {
    const { linha, marcador } = this.intersectar(e);
    if (marcador || linha == null || !this.linhas[linha]) return;
    this.indiceSelecionado = linha;
    this.atualizarAlvos();
    this.opcoes.onSelecionar?.(this.linhas[linha].item);
  }

  // -------------------------------------------------------------------------
  // Câmera, loop, resize, dispose
  // -------------------------------------------------------------------------

  /** Enquadra a prancha inteira: largura das colunas + altura das linhas. */
  private enquadrarCamera(nLinhas: number): void {
    const ultimaCol = this.categoriaAtual
      ? this.colunaX(
          Math.max(
            1,
            ...this.categoriaAtual.itens
              .slice(this.paginaAtual * ITENS_POR_PAGINA, this.paginaAtual * ITENS_POR_PAGINA + ITENS_POR_PAGINA)
              .map((i) => i.estagios.length),
          ) - 1,
        )
      : COL_X[COL_X.length - 1];
    const minX = X_NOME - 4;
    const maxX = ultimaCol + 4;
    const centroX = (minX + maxX) / 2;
    const largura = maxX - minX;
    const zSpan = Math.max(1, nLinhas - 1) * ESPACO_LINHA;

    const dist = THREE.MathUtils.clamp(
      Math.max(largura * 0.78, zSpan * 1.35, 20),
      20,
      64,
    );
    this.camera.position.set(centroX + dist * 0.16, dist * 0.62, dist * 0.72);
    this.controles.target.set(centroX, 0, 0);
    this.controles.update();
  }

  private animar = (): void => {
    if (this.destruido) return;
    this.idAnimacao = requestAnimationFrame(this.animar);

    const t = this.relogio.getElapsedTime();
    const reduzido = this.opcoes.movimentoReduzido === true;

    // Elevação suave das linhas (hover/seleção) — lerp sobre o Y do grupo.
    for (const linha of this.linhas) {
      if (Math.abs(linha.y - linha.alvoY) > 0.001) {
        linha.y += (linha.alvoY - linha.y) * 0.16;
        linha.grupo.position.y = linha.y;
      }
      // Flutuação calma dos marcadores ⚠️ (desligada com reduced-motion).
      if (!reduzido) {
        for (const m of linha.marcadores) {
          m.position.y = (m.userData.baseY as number) + Math.sin(t * 1.6 + m.position.x) * 0.12;
        }
      }
    }

    this.controles.update(); // necessário por causa do damping
    this.renderer.render(this.cena, this.camera);
  };

  private redimensionar(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Descarta tudo o que é por-página (sprites, faixas, instâncias, listeners visuais). */
  private limparPagina(): void {
    if (this.grupoPagina) {
      this.cena.remove(this.grupoPagina);
      this.grupoPagina.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          // A textura ⚠️ é compartilhada — não dispose; as demais são por-sprite.
          if (obj.material.map && obj.material.map !== this.texAlerta) obj.material.map.dispose();
          obj.material.dispose();
        } else if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          // Geometrias/materiais com sufixo geo*/mat* da engine são compartilhados;
          // só faixas têm geometria/material próprios por linha.
          const ehCompartilhada =
            obj.geometry === this.geoCaixa || obj.geometry === this.geoBloco ||
            obj.geometry === this.geoItem || obj.geometry === this.geoFatia ||
            obj.geometry === this.geoTabua || obj.geometry === this.geoSeta;
          if (!ehCompartilhada) obj.geometry.dispose();
          const mat = obj.material as THREE.Material | THREE.Material[];
          const mats = Array.isArray(mat) ? mat : [mat];
          for (const m of mats) {
            const ehCompartilhado =
              m === this.matCaixa || m === this.matBloco || m === this.matItem ||
              m === this.matFatia || m === this.matTabua || m === this.matSeta;
            if (!ehCompartilhado) m.dispose();
          }
          if (obj instanceof THREE.InstancedMesh) obj.dispose();
        }
      });
      this.grupoPagina = null;
    }
    this.linhas = [];
    this.interativos = [];
  }

  /** Limpeza completa — chamar ao desmontar o componente React. */
  dispose(): void {
    this.destruido = true;
    cancelAnimationFrame(this.idAnimacao);

    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerdown', this.onClick);
    window.removeEventListener('resize', this.onResize);

    this.limparPagina();

    this.cena.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !(obj instanceof THREE.InstancedMesh)) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });

    this.geoCaixa.dispose();
    this.geoBloco.dispose();
    this.geoItem.dispose();
    this.geoFatia.dispose();
    this.geoTabua.dispose();
    this.geoSeta.dispose();
    this.matCaixa.dispose();
    this.matBloco.dispose();
    this.matItem.dispose();
    this.matFatia.dispose();
    this.matTabua.dispose();
    this.matSeta.dispose();
    this.texAlerta.dispose();

    this.controles.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// ---------------------------------------------------------------------------
// Utilitários de canvas/geometria (puros)
// ---------------------------------------------------------------------------

/** roundRect próprio: não depende de CanvasRenderingContext2D.roundRect. */
function tracarRoundRect(
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

/** Preenche o atributo `color` da geometria inteira com uma cor (vertex colors). */
function pintarGeometria(geo: THREE.BufferGeometry, cor: number): void {
  const c = new THREE.Color(cor);
  const n = geo.attributes.position.count;
  const cores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    cores[i * 3] = c.r;
    cores[i * 3 + 1] = c.g;
    cores[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
}
