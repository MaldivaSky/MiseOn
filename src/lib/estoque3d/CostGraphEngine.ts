/**
 * CostGraphEngine — motor de renderização 3D do Grafo de Transformação de Insumos.
 *
 * Decisões de arquitetura:
 *
 *  - UM ÚNICO InstancedMesh para todos os nós (1 draw call). Milhares de
 *    frações custam o mesmo para a GPU: as matrizes de transformação vivem
 *    num único buffer de instâncias atualizado via setMatrixAt, e as cores
 *    num InstancedBufferAttribute via setColorAt.
 *  - As arestas (linhas pai → filho) são um único LineSegments com a
 *    geometria pré-montada — segundo e último draw call da cena.
 *  - Bloom SELETIVO por threshold: em vez de rodar dois composers com
 *    layers (caro), multiplicamos a cor das instâncias "recém-fracionadas"
 *    por GLOW_BOOST, empurrando a luminância delas acima do threshold do
 *    UnrealBloomPass. Só elas florescem; o resto da cena fica abaixo do
 *    limiar. THREE.Color aceita componentes > 1 sem clipping.
 *  - O Raycaster nativo do three resolve interseção com InstancedMesh e
 *    devolve `instanceId`, que é exatamente o índice no nosso array de nós
 *    achatado — o cruzamento 3D → regra de negócio é O(1).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import type { GrafoCusto, NoCusto } from './types';
import { calcularLayout } from './layout';

export interface InfoHover {
  no: NoCusto;
  /** Coordenadas de tela (px) para posicionar a label HTML sobreposta. */
  telaX: number;
  telaY: number;
}

export interface OpcoesEngine {
  onHover?: (info: InfoHover | null) => void;
  onSelect?: (no: NoCusto) => void;
  /** Cor de fundo da cena. */
  corFundo?: number;
}

/** Fator que empurra nós recém-fracionados acima do threshold do bloom. */
const GLOW_BOOST = 2.6;
const BLOOM_THRESHOLD = 0.85;

export class CostGraphEngine {
  private container: HTMLElement;
  private opcoes: OpcoesEngine;

  private renderer!: THREE.WebGLRenderer;
  private cena!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controles!: OrbitControls;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private fxaaPass!: ShaderPass;

  private malhaNos: THREE.InstancedMesh | null = null;
  private linhasArestas: THREE.LineSegments | null = null;
  private grafo: GrafoCusto | null = null;

  // Cores de calor "cruas" (sem boost/pulsação), r,g,b intercalados por índice.
  // Servem de base estável para reaplicar a pulsação sem acumular erro por frame.
  private coresBase: Float32Array | null = null;
  // Índices dos nós recém-fracionados — só eles pulsam (evita varrer tudo/frame).
  private indicesDestaque: number[] = [];

  private raycaster = new THREE.Raycaster();
  private ponteiro = new THREE.Vector2();
  private indiceHover: number | null = null;

  private relogio = new THREE.Clock();
  private idAnimacao = 0;
  private destruido = false;

  // Objetos temporários reutilizados no loop (zero alocação por frame).
  private matrizTmp = new THREE.Matrix4();
  private posTmp = new THREE.Vector3();
  private corTmp = new THREE.Color();

  private onPointerMove = (e: PointerEvent) => this.processarHover(e);
  private onClick = (e: PointerEvent) => this.processarClique(e);
  private onResize = () => this.redimensionar();

  constructor(container: HTMLElement, opcoes: OpcoesEngine = {}) {
    this.container = container;
    this.opcoes = opcoes;

    this.inicializarCena(opcoes.corFundo ?? 0x0a0e17);
    this.inicializarLuzes();
    this.inicializarPosProcessamento();

    container.addEventListener('pointermove', this.onPointerMove);
    container.addEventListener('pointerdown', this.onClick);
    window.addEventListener('resize', this.onResize);

    this.animar();
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private inicializarCena(corFundo: number): void {
    const { clientWidth: w, clientHeight: h } = this.container;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft shadows
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color(corFundo);
    this.cena.fog = new THREE.Fog(corFundo, 30, 90);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 300);
    this.camera.position.set(14, 12, 14);

    this.controles = new OrbitControls(this.camera, this.renderer.domElement);
    this.controles.enableDamping = true; // inércia
    this.controles.dampingFactor = 0.06;
    // Limita o ângulo polar para o usuário não ir "para debaixo do piso"
    // nem ficar exatamente em cima — mantém o foco na árvore.
    this.controles.minPolarAngle = Math.PI * 0.15;
    this.controles.maxPolarAngle = Math.PI * 0.55;
    this.controles.minDistance = 6;
    this.controles.maxDistance = 60;

    // Piso sutil que recebe as sombras e ancora a cena no espaço.
    const piso = new THREE.Mesh(
      new THREE.CircleGeometry(80, 64),
      new THREE.MeshStandardMaterial({ color: 0x0d1320, roughness: 0.95, metalness: 0 }),
    );
    piso.rotation.x = -Math.PI / 2;
    piso.position.y = -12;
    piso.receiveShadow = true;
    piso.name = 'piso';
    this.cena.add(piso);
  }

  private inicializarLuzes(): void {
    // Ambiente suave para nenhuma face ficar preta pura.
    this.cena.add(new THREE.AmbientLight(0x8899bb, 0.45));

    // Luz principal dramática, com sombras mapeadas em alta resolução.
    const principal = new THREE.DirectionalLight(0xffffff, 2.2);
    principal.position.set(18, 26, 10);
    principal.castShadow = true;
    principal.shadow.mapSize.set(2048, 2048);
    principal.shadow.bias = -0.0004;
    const extensao = 40;
    principal.shadow.camera.left = -extensao;
    principal.shadow.camera.right = extensao;
    principal.shadow.camera.top = extensao;
    principal.shadow.camera.bottom = -extensao;
    this.cena.add(principal);

    // Luzes de preenchimento coloridas — o contraste quente/frio revela a
    // volumetria das esferas (visual "cyber-físico" corporativo).
    const preenchimentoFrio = new THREE.PointLight(0x3366ff, 60, 80, 1.8);
    preenchimentoFrio.position.set(-20, 6, -14);
    this.cena.add(preenchimentoFrio);

    const preenchimentoQuente = new THREE.PointLight(0xff7733, 40, 70, 1.8);
    preenchimentoQuente.position.set(16, -4, 18);
    this.cena.add(preenchimentoQuente);
  }

  private inicializarPosProcessamento(): void {
    const { clientWidth: w, clientHeight: h } = this.container;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.cena, this.camera));

    // Bloom seletivo por threshold: só o que tem luminância > 0.85 floresce
    // (os nós com GLOW_BOOST). Força e raio moderados para não lavar a cena.
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.9, 0.55, BLOOM_THRESHOLD);
    this.composer.addPass(this.bloomPass);

    this.composer.addPass(new OutputPass());

    // FXAA por último, sobre a imagem já tonemapped — anti-aliasing barato
    // e impecável sem MSAA (que não funciona com render targets do composer).
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaaPass);
    this.atualizarFxaa();
  }

  private atualizarFxaa(): void {
    const pixelRatio = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms.resolution.value.set(
      1 / (this.container.clientWidth * pixelRatio),
      1 / (this.container.clientHeight * pixelRatio),
    );
  }

  // -------------------------------------------------------------------------
  // Dados → GPU
  // -------------------------------------------------------------------------

  /** Substitui o dataset e reconstrói os buffers de instâncias. */
  setData(grafo: GrafoCusto): void {
    this.descartarMalhas();
    this.grafo = grafo;

    const layout = calcularLayout(grafo);
    const quantidade = layout.posicionados.length;
    if (quantidade === 0) return;

    // Geometria unitária: a escala real de cada nó entra na matriz da
    // instância — assim uma única geometria serve a todos.
    const geometria = new THREE.SphereGeometry(1, 32, 24);
    const material = new THREE.MeshPhysicalMaterial({
      roughness: 0.28,
      metalness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35,
    });

    const malha = new THREE.InstancedMesh(geometria, material, quantidade);
    malha.castShadow = true;
    malha.receiveShadow = true;

    // Guarda as cores cruas para a pulsação reaplicar sobre uma base estável.
    this.coresBase = new Float32Array(quantidade * 3);
    this.indicesDestaque = [];

    for (const p of layout.posicionados) {
      // Matriz: translação para a posição do layout + escala uniforme = raio.
      this.matrizTmp.makeScale(p.raio, p.raio, p.raio);
      this.matrizTmp.setPosition(p.x, p.y, p.z);
      malha.setMatrixAt(p.indice, this.matrizTmp);

      // Base crua (sem boost) preservada para o loop de pulsação.
      this.coresBase[p.indice * 3] = p.cor[0];
      this.coresBase[p.indice * 3 + 1] = p.cor[1];
      this.coresBase[p.indice * 3 + 2] = p.cor[2];

      // Cor de calor; nós recém-fracionados recebem boost para furar o
      // threshold do bloom (glow seletivo sem segundo composer).
      this.corTmp.setRGB(p.cor[0], p.cor[1], p.cor[2]);
      if (p.no.destacar) {
        this.corTmp.multiplyScalar(GLOW_BOOST);
        this.indicesDestaque.push(p.indice);
      }
      malha.setColorAt(p.indice, this.corTmp);
    }
    malha.instanceMatrix.needsUpdate = true;
    if (malha.instanceColor) malha.instanceColor.needsUpdate = true;

    this.malhaNos = malha;
    this.cena.add(malha);

    // Arestas: um único LineSegments com todos os segmentos pai → filho.
    const posicoes = new Float32Array(grafo.arestas.length * 6);
    grafo.arestas.forEach(([a, b], i) => {
      const pa = layout.posicionados[a];
      const pb = layout.posicionados[b];
      posicoes.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
    });
    const geoArestas = new THREE.BufferGeometry();
    geoArestas.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
    this.linhasArestas = new THREE.LineSegments(
      geoArestas,
      new THREE.LineBasicMaterial({ color: 0x3d5a80, transparent: true, opacity: 0.45 }),
    );
    this.cena.add(this.linhasArestas);

    // Enquadra a câmera no conjunto.
    const alvo = Math.max(layout.raioMaximo * 1.6, 10);
    this.camera.position.set(alvo, alvo * 0.8, alvo);
    this.controles.target.set(0, -layout.profundidadeMaxima * 1.2, 0);
    this.controles.update();
  }

  // -------------------------------------------------------------------------
  // Interatividade — o cruzamento entre o espaço 3D e a regra de negócio
  // -------------------------------------------------------------------------

  private intersectar(e: PointerEvent): number | null {
    if (!this.malhaNos) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ponteiro.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ponteiro, this.camera);
    const hits = this.raycaster.intersectObject(this.malhaNos);
    // instanceId é o índice do nó no array achatado do grafo: custo O(1)
    // para chegar do pixel clicado à rota matemática do custo fracionado.
    return hits.length > 0 && hits[0].instanceId != null ? hits[0].instanceId : null;
  }

  private processarHover(e: PointerEvent): void {
    const indice = this.intersectar(e);
    if (indice === this.indiceHover) return;
    this.indiceHover = indice;

    this.renderer.domElement.style.cursor = indice != null ? 'pointer' : 'grab';

    if (!this.opcoes.onHover) return;
    if (indice == null || !this.grafo) {
      this.opcoes.onHover(null);
    } else {
      this.opcoes.onHover({ no: this.grafo.nos[indice], telaX: e.clientX, telaY: e.clientY });
    }
  }

  private processarClique(e: PointerEvent): void {
    const indice = this.intersectar(e);
    if (indice != null && this.grafo && this.opcoes.onSelect) {
      this.opcoes.onSelect(this.grafo.nos[indice]);
    }
  }

  // -------------------------------------------------------------------------
  // Loop, resize, dispose
  // -------------------------------------------------------------------------

  private animar = (): void => {
    if (this.destruido) return;
    this.idAnimacao = requestAnimationFrame(this.animar);

    // Respiração suave dos nós destacados: pulsa o boost de cor no tempo,
    // reforçando quais frações acabaram de nascer sem custar draw calls.
    // A cada frame reescreve cor = base × (GLOW_BOOST × pulsação) a partir da
    // base crua — nunca lê a cor anterior, então o erro não acumula.
    const t = this.relogio.getElapsedTime();
    if (this.malhaNos && this.coresBase && this.indicesDestaque.length > 0) {
      const fator = GLOW_BOOST * (1 + 0.25 * Math.sin(t * 2.4));
      for (const i of this.indicesDestaque) {
        this.corTmp.setRGB(
          this.coresBase[i * 3] * fator,
          this.coresBase[i * 3 + 1] * fator,
          this.coresBase[i * 3 + 2] * fator,
        );
        this.malhaNos.setColorAt(i, this.corTmp);
      }
      if (this.malhaNos.instanceColor) this.malhaNos.instanceColor.needsUpdate = true;
    }

    this.controles.update(); // necessário por causa do damping
    this.composer.render();
  };

  private redimensionar(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.atualizarFxaa();
  }

  private descartarMalhas(): void {
    if (this.malhaNos) {
      this.cena.remove(this.malhaNos);
      this.malhaNos.geometry.dispose();
      (this.malhaNos.material as THREE.Material).dispose();
      this.malhaNos.dispose();
      this.malhaNos = null;
    }
    if (this.linhasArestas) {
      this.cena.remove(this.linhasArestas);
      this.linhasArestas.geometry.dispose();
      (this.linhasArestas.material as THREE.Material).dispose();
      this.linhasArestas = null;
    }
    this.coresBase = null;
    this.indicesDestaque = [];
  }

  /** Limpeza completa — chamar ao desmontar o componente React. */
  dispose(): void {
    this.destruido = true;
    cancelAnimationFrame(this.idAnimacao);

    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerdown', this.onClick);
    window.removeEventListener('resize', this.onResize);

    this.descartarMalhas();
    this.controles.dispose();
    this.composer.dispose();
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
