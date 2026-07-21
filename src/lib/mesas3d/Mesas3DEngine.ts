/**
 * Mesas3DEngine — Motor de renderização 3D interativo do Salão de Mesas.
 *
 * Recursos e arquitetura:
 *  - Geometrias procedurais PBR (Madeira, Metal, Couro e Anéis LED Neon de status).
 *  - Efeito Bloom seletivo com UnrealBloomPass para destacar mesas que exigem atenção.
 *  - Raycasting de altíssima precisão: detecta clique no tampo da mesa OU na cadeira/assento específico.
 *  - Modo de Edição interativo (drag & drop no plano XZ do salão).
 *  - Gestos mobile aperfeiçoados via OrbitControls (damping de inércia e limites de segurança).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import type { Mesa3DPosicionada, OpcoesEngineMesas, PosicaoTelaMesa } from './types';
import { COR_STATUS_3D } from './types';
import { obterDimensoesTampo } from './layoutMesas';

const BLOOM_THRESHOLD = 0.82;

export class Mesas3DEngine {
  private container: HTMLElement;
  private opcoes: OpcoesEngineMesas;

  private renderer!: THREE.WebGLRenderer;
  private cena!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controles!: OrbitControls;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private fxaaPass!: ShaderPass;

  private grupoMesas = new THREE.Group();
  private pisoMesh!: THREE.Mesh;
  private gradeHelper!: THREE.GridHelper;

  private mesas3D: Mesa3DPosicionada[] = [];
  private objetosParaRaycast: THREE.Object3D[] = [];

  private raycaster = new THREE.Raycaster();
  private ponteiro = new THREE.Vector2();

  private mesaHoverId: string | null = null;
  private assentoHoverNum: number | null = null;

  // Estado de Arraste (Modo Edição)
  private mesaArrastando: THREE.Group | null = null;
  private planoArrasto = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pontoArrasto = new THREE.Vector3();

  private relogio = new THREE.Clock();
  private idAnimacao = 0;
  private destruido = false;

  private onPointerMoveBound = (e: PointerEvent) => this.processarPointerMove(e);
  private onPointerDownBound = (e: PointerEvent) => this.processarPointerDown(e);
  private onPointerUpBound = (e: PointerEvent) => this.processarPointerUp(e);
  private onResizeBound = () => this.redimensionar();

  constructor(container: HTMLElement, opcoes: OpcoesEngineMesas = {}) {
    this.container = container;
    this.opcoes = opcoes;

    this.inicializarCena(opcoes.corFundo ?? 0x0b0f19);
    this.inicializarLuzes();
    this.inicializarPosProcessamento();

    container.addEventListener('pointermove', this.onPointerMoveBound);
    container.addEventListener('pointerdown', this.onPointerDownBound);
    container.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('resize', this.onResizeBound);

    this.animar();
  }

  // -------------------------------------------------------------------------
  // Setup Gráfico
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
    this.cena.fog = new THREE.FogExp2(corFundo, 0.012);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.5, 300);
    this.camera.position.set(0, 22, 26);

    this.controles = new OrbitControls(this.camera, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;
    this.controles.minPolarAngle = Math.PI * 0.1;
    this.controles.maxPolarAngle = Math.PI * 0.45; // Evita visão rasteira
    this.controles.minDistance = 6;
    this.controles.maxDistance = 70;
    this.controles.target.set(0, 0, 0);

    // Piso do Salão (Textura Efeito Madeira Escura / Pedra Elegante)
    const geoPiso = new THREE.PlaneGeometry(120, 120);
    const matPiso = new THREE.MeshStandardMaterial({
      color: 0x111625,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.pisoMesh = new THREE.Mesh(geoPiso, matPiso);
    this.pisoMesh.rotation.x = -Math.PI / 2;
    this.pisoMesh.position.y = -0.01;
    this.pisoMesh.receiveShadow = true;
    this.cena.add(this.pisoMesh);

    // Grade sutil do piso
    this.gradeHelper = new THREE.GridHelper(120, 40, 0x223355, 0x182238);
    this.gradeHelper.position.y = 0.001;
    this.cena.add(this.gradeHelper);

    this.cena.add(this.grupoMesas);
  }

  private inicializarLuzes(): void {
    this.cena.add(new THREE.AmbientLight(0x90a4ae, 0.55));

    const luzSol = new THREE.DirectionalLight(0xffffff, 2.0);
    luzSol.position.set(20, 35, 15);
    luzSol.castShadow = true;
    luzSol.shadow.mapSize.set(2048, 2048);
    luzSol.shadow.bias = -0.0003;
    const d = 40;
    luzSol.shadow.camera.left = -d;
    luzSol.shadow.camera.right = d;
    luzSol.shadow.camera.top = d;
    luzSol.shadow.camera.bottom = -d;
    this.cena.add(luzSol);

    // Luz de preenchimento azulada e quente
    const luzPreenchimento = new THREE.PointLight(0x38bdf8, 30, 90);
    luzPreenchimento.position.set(-25, 15, -20);
    this.cena.add(luzPreenchimento);
  }

  private inicializarPosProcessamento(): void {
    const { clientWidth: w, clientHeight: h } = this.container;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.cena, this.camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.8, 0.45, BLOOM_THRESHOLD);
    this.composer.addPass(this.bloomPass);

    this.composer.addPass(new OutputPass());

    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaaPass);
    this.atualizarFxaa();
  }

  private atualizarFxaa(): void {
    const pixelRatio = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms.resolution.value.set(
      1 / (this.container.clientWidth * pixelRatio),
      1 / (this.container.clientHeight * pixelRatio)
    );
  }

  // -------------------------------------------------------------------------
  // Renderização Procedural de Mesas & Assentos
  // -------------------------------------------------------------------------

  setData(mesas: Mesa3DPosicionada[]): void {
    this.limparGrupoMesas();
    this.mesas3D = mesas;
    this.objetosParaRaycast = [];

    if (mesas.length === 0) return;

    for (const m of mesas) {
      const gMesa = this.criarMeshMesa(m);
      this.grupoMesas.add(gMesa);
    }

    this.enquadrarCamera();
  }

  private criarMeshMesa(m: Mesa3DPosicionada): THREE.Group {
    const grupo = new THREE.Group();
    grupo.name = `MESA_${m.mesa.id}`;
    grupo.userData = { mesaId: m.mesa.id, mesa3d: m };
    grupo.position.set(m.x, 0, m.z);
    grupo.rotation.y = THREE.MathUtils.degToRad(m.rotacao || 0);

    const infoTampo = obterDimensoesTampo(m.formato, m.capacidade);
    const corConfig = COR_STATUS_3D[m.status3D];

    // 1. Base LED de Alerta / Status na Base do Piso (Anel Neon Glowing)
    const geoRing = new THREE.RingGeometry(infoTampo.raioAssentos * 0.7, infoTampo.raioAssentos * 0.82, 32);
    const matRing = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(
        corConfig.rgb[0] * corConfig.glow,
        corConfig.rgb[1] * corConfig.glow,
        corConfig.rgb[2] * corConfig.glow
      ),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(geoRing, matRing);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    grupo.add(ringMesh);

    // 2. Tampo da Mesa (Madeira Nobre Polida)
    let geoTampo: THREE.BufferGeometry;
    if (m.formato === 'REDONDA') {
      geoTampo = new THREE.CylinderGeometry(infoTampo.largura / 2, infoTampo.largura / 2, 0.12, 32);
    } else {
      geoTampo = new THREE.BoxGeometry(infoTampo.largura, 0.12, infoTampo.profundidade);
    }

    const matTampo = new THREE.MeshStandardMaterial({
      color: 0x2b1e17, // Tom amadeirado escuro e acolhedor
      roughness: 0.35,
      metalness: 0.1,
    });
    const tampoMesh = new THREE.Mesh(geoTampo, matTampo);
    tampoMesh.position.y = 1.3;
    tampoMesh.castShadow = true;
    tampoMesh.receiveShadow = true;
    tampoMesh.userData = { tipo: 'TAMPO', mesaId: m.mesa.id };
    grupo.add(tampoMesh);
    this.objetosParaRaycast.push(tampoMesh);

    // Borda Luminosa do Tampo (Indicador direto do Status)
    const matBordaTampo = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(
        corConfig.rgb[0] * (corConfig.glow * 1.5),
        corConfig.rgb[1] * (corConfig.glow * 1.5),
        corConfig.rgb[2] * (corConfig.glow * 1.5)
      ),
      emissive: corConfig.hex,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    let meshBorda: THREE.Mesh;
    if (m.formato === 'REDONDA') {
      meshBorda = new THREE.Mesh(
        new THREE.TorusGeometry(infoTampo.largura / 2, 0.03, 16, 32),
        matBordaTampo
      );
      meshBorda.rotation.x = Math.PI / 2;
    } else {
      meshBorda = new THREE.Mesh(
        new THREE.BoxGeometry(infoTampo.largura + 0.04, 0.04, infoTampo.profundidade + 0.04),
        matBordaTampo
      );
    }
    meshBorda.position.y = 1.34;
    grupo.add(meshBorda);

    // 3. Pé Central da Mesa (Metal Escovado)
    const geoPe = new THREE.CylinderGeometry(0.12, 0.25, 1.25, 16);
    const matPe = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
    const peMesh = new THREE.Mesh(geoPe, matPe);
    peMesh.position.y = 0.625;
    peMesh.castShadow = true;
    grupo.add(peMesh);

    // 4. Assentos / Cadeiras Procedurais
    for (const assento of m.assentos) {
      const gCadeira = this.criarMeshCadeira(assento);
      grupo.add(gCadeira);
    }

    return grupo;
  }

  private criarMeshCadeira(assento: { numero: number; xRelativo: number; zRelativo: number; ocupado: boolean; valorConsumido: number }): THREE.Group {
    const gCad = new THREE.Group();
    gCad.name = `CADEIRA_${assento.numero}`;
    gCad.position.set(assento.xRelativo, 0, assento.zRelativo);

    // Aponta a cadeira na direção do centro da mesa
    const anguloCentro = Math.atan2(-assento.zRelativo, -assento.xRelativo);
    gCad.rotation.y = anguloCentro - Math.PI / 2;

    const corAssento = assento.ocupado ? 0x38bdf8 : 0x475569; // Azul ativo vs cinza inativo
    const matAssento = new THREE.MeshStandardMaterial({
      color: corAssento,
      roughness: 0.4,
      metalness: 0.2,
    });

    // Assento / Almofada
    const geoAlmofada = new THREE.BoxGeometry(0.48, 0.08, 0.48);
    const meshAlmofada = new THREE.Mesh(geoAlmofada, matAssento);
    meshAlmofada.position.y = 0.6;
    meshAlmofada.castShadow = true;
    meshAlmofada.userData = { tipo: 'ASSENTO', numeroAssento: assento.numero };
    gCad.add(meshAlmofada);
    this.objetosParaRaycast.push(meshAlmofada);

    // Encosto da Cadeira
    const geoEncosto = new THREE.BoxGeometry(0.48, 0.45, 0.06);
    const meshEncosto = new THREE.Mesh(geoEncosto, matAssento);
    meshEncosto.position.set(0, 0.85, -0.21);
    meshEncosto.castShadow = true;
    meshEncosto.userData = { tipo: 'ASSENTO', numeroAssento: assento.numero };
    gCad.add(meshEncosto);

    // Pernas da Cadeira (4 pernas)
    const matPernas = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const offsets = [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ];
    for (const [ox, oz] of offsets) {
      const perna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.58, 8), matPernas);
      perna.position.set(ox, 0.29, oz);
      perna.castShadow = true;
      gCad.add(perna);
    }

    return gCad;
  }

  // -------------------------------------------------------------------------
  // Interatividade (Raycasting & Eventos)
  // -------------------------------------------------------------------------

  private intersectar(e: PointerEvent): { mesa3d: Mesa3DPosicionada; assentoNum?: number | null } | null {
    if (this.objetosParaRaycast.length === 0) return null;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ponteiro.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(this.ponteiro, this.camera);
    const hits = this.raycaster.intersectObjects(this.objetosParaRaycast, false);

    if (hits.length === 0) return null;

    const hit = hits[0].object;
    // Sobe na hierarquia para encontrar o grupo da mesa
    let obj: THREE.Object3D | null = hit;
    while (obj && !obj.name.startsWith('MESA_')) {
      obj = obj.parent;
    }

    if (!obj || !obj.userData.mesa3d) return null;

    const mesa3d = obj.userData.mesa3d as Mesa3DPosicionada;
    const isAssento = hit.userData?.tipo === 'ASSENTO';
    const assentoNum = isAssento ? (hit.userData.numeroAssento as number) : null;

    return { mesa3d, assentoNum };
  }

  private processarPointerMove(e: PointerEvent): void {
    if (this.opcoes.modoEdicao && this.mesaArrastando) {
      // Arraste da mesa no plano XZ
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.ponteiro.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(this.ponteiro, this.camera);
      if (this.raycaster.ray.intersectPlane(this.planoArrasto, this.pontoArrasto)) {
        this.mesaArrastando.position.x = Math.round(this.pontoArrasto.x * 2) / 2; // Snap a 0.5m
        this.mesaArrastando.position.z = Math.round(this.pontoArrasto.z * 2) / 2;
      }
      return;
    }

    const hit = this.intersectar(e);
    if (!hit) {
      if (this.mesaHoverId !== null) {
        this.mesaHoverId = null;
        this.assentoHoverNum = null;
        this.renderer.domElement.style.cursor = 'grab';
        this.opcoes.onHover?.(null);
      }
      return;
    }

    this.renderer.domElement.style.cursor = 'pointer';
    this.mesaHoverId = hit.mesa3d.mesa.id;
    this.assentoHoverNum = hit.assentoNum ?? null;

    this.opcoes.onHover?.({
      mesa3d: hit.mesa3d,
      assentoHover: hit.assentoNum,
      telaX: e.clientX,
      telaY: e.clientY,
    });
  }

  private processarPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // Apenas botão esquerdo / toque

    if (this.opcoes.modoEdicao) {
      const hit = this.intersectar(e);
      if (hit) {
        const obj: THREE.Object3D | null = this.grupoMesas.getObjectByName(`MESA_${hit.mesa3d.mesa.id}`) ?? null;
        if (obj) {
          this.mesaArrastando = obj as THREE.Group;
          this.controles.enabled = false; // Bloqueia rotação da câmera durante arraste
          return;
        }
      }
    }
  }

  private processarPointerUp(e: PointerEvent): void {
    if (this.opcoes.modoEdicao && this.mesaArrastando) {
      const mesaId = this.mesaArrastando.userData.mesaId;
      this.opcoes.onLayoutChange?.(mesaId, {
        x: this.mesaArrastando.position.x,
        z: this.mesaArrastando.position.z,
        rotacao: THREE.MathUtils.radToDeg(this.mesaArrastando.rotation.y),
      });
      this.mesaArrastando = null;
      this.controles.enabled = true;
      return;
    }

    // Clique comum para selecionar a mesa / assento
    const hit = this.intersectar(e);
    if (hit && this.opcoes.onSelectMesa) {
      this.opcoes.onSelectMesa(hit.mesa3d, hit.assentoNum);
    }
  }

  /** Retorna coordenadas de tela 2D de todas as mesas para renderizar o HUD sobreposto */
  obterPosicoesTelaMesas(): PosicaoTelaMesa[] {
    const { clientWidth: w, clientHeight: h } = this.container;
    const resultado: PosicaoTelaMesa[] = [];
    const tempVec = new THREE.Vector3();

    for (const m of this.mesas3D) {
      tempVec.set(m.x, 1.8, m.z); // Posição acima da mesa
      tempVec.project(this.camera);

      const visivel = tempVec.z < 1.0;
      const telaX = (tempVec.x * 0.5 + 0.5) * w;
      const telaY = (-tempVec.y * 0.5 + 0.5) * h;

      resultado.push({
        mesaId: m.mesa.id,
        numero: m.mesa.numero,
        telaX,
        telaY,
        visivel,
        status3D: m.status3D,
      });
    }

    return resultado;
  }

  /** Ajusta a posição e o foco da câmera para conter o salão inteiro */
  private enquadrarCamera(): void {
    if (this.mesas3D.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const m of this.mesas3D) {
      minX = Math.min(minX, m.x);
      maxX = Math.max(maxX, m.x);
      minZ = Math.min(minZ, m.z);
      maxZ = Math.max(maxZ, m.z);
    }
    const centroX = (minX + maxX) / 2;
    const centroZ = (minZ + maxZ) / 2;
    const tamanho = Math.max(maxX - minX, maxZ - minZ, 12);

    this.controles.target.set(centroX, 0, centroZ);
    this.camera.position.set(centroX, tamanho * 1.4 + 10, centroZ + tamanho * 1.2 + 12);
    this.controles.update();
  }

  setModoEdicao(ativo: boolean): void {
    this.opcoes.modoEdicao = ativo;
    this.gradeHelper.visible = ativo;
  }

  // -------------------------------------------------------------------------
  // Loop de Animação e Descarte
  // -------------------------------------------------------------------------

  private animar = (): void => {
    if (this.destruido) return;
    this.idAnimacao = requestAnimationFrame(this.animar);

    // Efeito suave de vibração/respiração das luzes e pulsação das mesas em preparo
    const delta = this.relogio.getElapsedTime();
    for (const child of this.grupoMesas.children) {
      const m = child.userData.mesa3d as Mesa3DPosicionada;
      if (m && m.status3D === 'EM_PREPARO') {
        const ring = child.children[0] as THREE.Mesh;
        if (ring && ring.material) {
          const mat = ring.material as THREE.MeshBasicMaterial;
          const boost = 1 + 0.3 * Math.sin(delta * 4);
          mat.opacity = Math.min(1.0, 0.6 * boost);
        }
      }
    }

    this.controles.update();
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

  private limparGrupoMesas(): void {
    while (this.grupoMesas.children.length > 0) {
      const obj = this.grupoMesas.children[0];
      this.grupoMesas.remove(obj);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
    }
  }

  dispose(): void {
    this.destruido = true;
    cancelAnimationFrame(this.idAnimacao);

    this.container.removeEventListener('pointermove', this.onPointerMoveBound);
    this.container.removeEventListener('pointerdown', this.onPointerDownBound);
    this.container.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('resize', this.onResizeBound);

    this.limparGrupoMesas();
    this.controles.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
