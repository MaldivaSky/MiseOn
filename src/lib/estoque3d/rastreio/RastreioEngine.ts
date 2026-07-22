/**
 * RastreioEngine — cena 3D do Rastreio de Estoque (todos os itens, por setor).
 *
 * Metáfora visual: um CORREDOR DE ARMAZENAMENTO visto de cima. Cada item do
 * setor é uma LINHA (Compra → Armazenado → Quebra → Uso, esquerda → direita);
 * a faixa colorida sob a linha é a cor do setor — o usuário lê o mapa de
 * armazenamento de relance, como leria as prateleiras da cozinha.
 *
 * Decisões:
 *  - InstancedMesh por estágio (contagem SEMPRE inteira — regressão do crash
 *    "isVector3": quantidade real fracionária truncava o buffer e derrubava
 *    a tela; aqui toda contagem passa por Math.max(1, Math.round(q))).
 *  - Geometria por grandeza da unidade: agrupador = caixa kraft; massa/volume
 *    = cápsula na cor do setor; contagem = esfera coral; semântico = fatia
 *    dourada sobre tábua. Cores vibrantes e DISTINTAS por papel — o olho
 *    separa "o que é caixa" de "o que é porção" sem ler nada.
 *  - Estados de negócio viram sinais visuais: crítico = anel vermelho
 *    pulsando; sem estoque = linha fantasma (35%); sem custo = etiqueta
 *    âmbar; desvio ≥15% = badge laranja.
 *  - Modo RECEITA: destacarIngredientes(ids) apaga as linhas não usadas
 *    (15%) e acende as que compõem a receita, com marcador ✅/❌ no fim da
 *    linha — a resposta "tenho o que preciso?" se lê na cena.
 *  - Sem composer/bloom (performance); sprites de texto via CanvasTexture;
 *    zero alocação por frame; dispose completo.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { ItemRastreio, SetorRastreio } from './carregarRastreio';
import { getUnidade } from '../../unidades';

export interface OpcoesRastreio {
  onSelecionar?: (item: ItemRastreio | null) => void;
  corFundo?: number;
}

const PITCH_LINHA = 4.6;         // distância entre linhas (Z)
const SLOTS_X = [-13.5, -4.5, 4.5, 13.5]; // colunas dos estágios (X)
const CAP_ITENS = 10;            // objetos 3D por estágio (+sprite "+N")
const ROTULO_LARGURA = 21;       // onde começa a linha (rótulo do item)

const COR_KRAFT = 0xc98f4e;      // caixas de compra
const COR_CORAL = 0xf0655a;      // itens de contagem (quebra)
const COR_OURO = 0xf5c04e;       // fatias/porções (uso)
const COR_TABUA = 0x8a6a42;
const COR_VERMELHO = 0xef4444;
const COR_AMBAR = 0xf59e0b;
const COR_CIANO = 0x22d3ee;

/**
 * Contagem visual de um estágio — SEMPRE inteira ≥ 1 e limitada ao cap.
 * Regressão do crash "isVector3": quantidade real fracionária (ex.: 7,33)
 * truncava o buffer do InstancedMesh, uma instância ficava undefined e o
 * Matrix4.setPosition derrubava a cena inteira. Toda contagem passa por aqui.
 */
export function contagemVisual(
  quantidade: number,
  cap: number = CAP_ITENS,
): { n: number; excedente: number } {
  const qtd = Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1;
  const arredondada = Math.round(qtd);
  return {
    n: Math.max(1, Math.min(arredondada, cap)),
    excedente: Math.max(0, arredondada - cap),
  };
}

export class RastreioEngine {
  private container: HTMLElement;
  private opcoes: OpcoesRastreio;

  private renderer!: THREE.WebGLRenderer;
  private cena!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controles!: OrbitControls;

  private geoCaixa = new THREE.BoxGeometry(1.7, 1.5, 1.4);
  private geoCapsula = new THREE.CapsuleGeometry(0.7, 1.0, 6, 14);
  private geoEsfera = new THREE.SphereGeometry(0.72, 20, 14);
  private geoFatia = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 20);
  private geoTabua = new THREE.BoxGeometry(2.1, 0.12, 1.5);
  private geoAnel = new THREE.TorusGeometry(2.4, 0.1, 8, 40);
  private geoFaixa = new THREE.PlaneGeometry(46, PITCH_LINHA * 0.82);
  private geoHit = new THREE.PlaneGeometry(46, PITCH_LINHA * 0.9);

  private grupoSetor: THREE.Group | null = null;
  private linhasCena: Array<{
    item: ItemRastreio;
    grupo: THREE.Group;
    faixa: THREE.Mesh;
    hit: THREE.Mesh;
    anel?: THREE.Mesh;
    marcador?: THREE.Sprite;
    materiais: THREE.Material[]; // para dim/highlight do modo receita
  }> = [];

  private raycaster = new THREE.Raycaster();
  private ponteiro = new THREE.Vector2();
  private downX = 0;
  private downY = 0;
  private relogio = new THREE.Clock();
  private idAnimacao = 0;
  private destruido = false;
  private reduzMovimento: boolean;

  private onPointerMove = (e: PointerEvent) => this.processarHover(e);
  private onPointerDown = (e: PointerEvent) => { this.downX = e.clientX; this.downY = e.clientY; };
  private onPointerUp = (e: PointerEvent) => this.processarSolta(e);
  private onResize = () => this.redimensionar();

  constructor(container: HTMLElement, opcoes: OpcoesRastreio = {}) {
    this.container = container;
    this.opcoes = opcoes;
    this.reduzMovimento =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.inicializarCena(opcoes.corFundo ?? 0x0b1020);
    this.inicializarLuzes();

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

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 400);
    this.camera.position.set(0, 12, 20);

    this.controles = new OrbitControls(this.camera, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.06;
    this.controles.minPolarAngle = Math.PI * 0.12;
    this.controles.maxPolarAngle = Math.PI * 0.52;
    this.controles.minDistance = 8;
    this.controles.maxDistance = 90;
    this.controles.target.set(0, 0.8, 0);

    const piso = new THREE.Mesh(
      new THREE.CircleGeometry(120, 48),
      new THREE.MeshStandardMaterial({ color: 0x0d1326, roughness: 0.95, metalness: 0 }),
    );
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    this.cena.add(piso);

    const grade = new THREE.GridHelper(160, 80, 0x223055, 0x141d38);
    grade.position.y = 0.01;
    (grade.material as THREE.Material).transparent = true;
    (grade.material as THREE.Material).opacity = 0.45;
    this.cena.add(grade);
  }

  private inicializarLuzes(): void {
    this.cena.add(new THREE.AmbientLight(0x99aacc, 0.55));

    const principal = new THREE.DirectionalLight(0xffffff, 2.0);
    principal.position.set(16, 30, 12);
    principal.castShadow = true;
    principal.shadow.mapSize.set(2048, 2048);
    principal.shadow.bias = -0.0004;
    const ext = 45;
    principal.shadow.camera.left = -ext;
    principal.shadow.camera.right = ext;
    principal.shadow.camera.top = ext;
    principal.shadow.camera.bottom = -ext;
    this.cena.add(principal);

    // Preenchimentos vibrantes — ciano e magenta dão vida à paleta sem poluir.
    const ciano = new THREE.PointLight(COR_CIANO, 50, 90, 1.9);
    ciano.position.set(-24, 7, -12);
    this.cena.add(ciano);

    const magenta = new THREE.PointLight(0xd946ef, 34, 80, 1.9);
    magenta.position.set(20, -2, 20);
    this.cena.add(magenta);
  }

  // -------------------------------------------------------------------------
  // Dados → cena
  // -------------------------------------------------------------------------

  /** Reconstrói a cena para o setor (já paginado pelo wrapper). */
  setSetor(setor: SetorRastreio | null, itens: ItemRastreio[]): void {
    this.limparSetor();
    if (!setor || itens.length === 0) return;

    this.grupoSetor = new THREE.Group();
    this.cena.add(this.grupoSetor);
    const zMeio = ((itens.length - 1) / 2) * PITCH_LINHA;

    itens.forEach((item, linha) => {
      const z = linha * PITCH_LINHA - zMeio;
      const grupo = new THREE.Group();
      grupo.position.z = z;
      const materiais: THREE.Material[] = [];

      // Faixa do setor sob a linha — a "prateleira colorida" do mapa.
      const matFaixa = new THREE.MeshBasicMaterial({
        color: setor.setor.corHex,
        transparent: true,
        opacity: item.estado === 'sem_estoque' ? 0.05 : 0.12,
        depthWrite: false,
      });
      const faixa = new THREE.Mesh(this.geoFaixa, matFaixa);
      faixa.rotation.x = -Math.PI / 2;
      faixa.position.set(0, 0.02, 0);
      grupo.add(faixa);

      // Plano invisível de clique generoso (a linha inteira é alvo).
      const hit = new THREE.Mesh(this.geoHit, new THREE.MeshBasicMaterial({ visible: false }));
      hit.rotation.x = -Math.PI / 2;
      hit.position.set(0, 1, 0);
      hit.userData.linha = linha;
      grupo.add(hit);

      // Rótulo do item: nome + categoria (chip na cor do setor).
      const rotulo = this.criarSpriteTexto([
        { texto: item.nome, cor: '#ffffff', px: 40 },
        { texto: `${item.categoria} · ${fmtQtd(item.quantidadeAtual)} ${item.unidadeBase}`, cor: setor.setor.cor, px: 28 },
      ], 1.05, 3.2);
      rotulo.position.set(-ROTULO_LARGURA, 1.5, 0);
      grupo.add(rotulo);

      // Estágios da cadeia do item.
      item.estagios.forEach((est, i) => {
        const x = SLOTS_X[Math.min(i, SLOTS_X.length - 1)];
        this.montarEstagio(grupo, materiais, item, est, i, x, setor.setor.corHex);
      });

      // Estado de negócio → sinal visual.
      let anel: THREE.Mesh | undefined;
      if (item.estado === 'critico') {
        const matAnel = new THREE.MeshBasicMaterial({ color: COR_VERMELHO, transparent: true, opacity: 0.85 });
        anel = new THREE.Mesh(this.geoAnel, matAnel);
        anel.rotation.x = -Math.PI / 2;
        anel.position.set(SLOTS_X[0], 0.06, 0);
        grupo.add(anel);
      }
      if (item.estado === 'alerta_desvio' && item.desvioPct != null) {
        const badge = this.criarSpriteTexto([
          { texto: `desvio ${item.desvioPct > 0 ? '+' : ''}${fmtQtd(item.desvioPct)}%`, cor: '#fb923c', px: 34 },
        ], 0.5, 2.2);
        badge.position.set(-ROTULO_LARGURA + 1, 2.9, 0);
        grupo.add(badge);
      }
      if (item.estado === 'sem_estoque') {
        grupo.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj !== hit && obj !== faixa) {
            const m = obj.material as THREE.MeshStandardMaterial;
            if (m.transparent !== undefined) { m.transparent = true; m.opacity = 0.35; }
          }
        });
      }

      this.grupoSetor!.add(grupo);
      this.linhasCena.push({ item, grupo, faixa, hit, anel, materiais });
    });

    this.enquadrarCamera(itens.length);
  }

  private montarEstagio(
    grupo: THREE.Group,
    materiais: THREE.Material[],
    item: ItemRastreio,
    est: ItemRastreio['estagios'][number],
    indice: number,
    x: number,
    corSetor: number,
  ): void {
    const grandeza = getUnidade(est.unidade)?.grandeza;
    const geo =
      grandeza === 'agrupador' ? this.geoCaixa
      : grandeza === 'semantico' ? this.geoFatia
      : grandeza === 'contagem' ? this.geoEsfera
      : this.geoCapsula;
    const cor =
      grandeza === 'agrupador' ? COR_KRAFT
      : grandeza === 'semantico' ? COR_OURO
      : grandeza === 'contagem' ? COR_CORAL
      : corSetor;

    // Blindagem anti-crash: contagem de instâncias SEMPRE inteira ≥ 1.
    const { n: nItens, excedente } = contagemVisual(est.quantidade);

    const material = new THREE.MeshStandardMaterial({
      color: cor, roughness: 0.42, metalness: 0.12,
      emissive: cor, emissiveIntensity: 0.16,
    });
    materiais.push(material);

    // Tábua sob fatias/porções — o "contexto de cozinha" da etapa de uso.
    if (grandeza === 'semantico') {
      const matTabua = new THREE.MeshStandardMaterial({ color: COR_TABUA, roughness: 0.8 });
      const tabua = new THREE.Mesh(this.geoTabua, matTabua);
      tabua.position.set(x, 0.09, 0);
      tabua.receiveShadow = true;
      grupo.add(tabua);
      materiais.push(matTabua);
    }

    const malha = new THREE.InstancedMesh(geo, material, nItens);
    malha.castShadow = true;
    malha.receiveShadow = true;
    const matriz = new THREE.Matrix4();
    const cols = Math.ceil(Math.sqrt(nItens));
    const rows = Math.ceil(nItens / cols);
    const passo = grandeza === 'agrupador' ? 2.0 : 1.5;
    const yBase = grandeza === 'agrupador' ? 0.85 : grandeza === 'semantico' ? 0.26 : 0.95;
    for (let k = 0; k < nItens; k++) {
      const col = k % cols;
      const row = Math.floor(k / cols);
      matriz.makeScale(1, 1, 1);
      matriz.setPosition(x + (col - (cols - 1) / 2) * passo, yBase, (row - (rows - 1) / 2) * passo);
      malha.setMatrixAt(k, matriz);
    }
    malha.instanceMatrix.needsUpdate = true;
    grupo.add(malha);

    // Etiquetas: custo unitário acima; quantidade real abaixo.
    const labelCusto = this.criarSpriteTexto([
      est.custoUnitario != null
        ? { texto: `${brl(est.custoUnitario)}/${est.unidade}`, cor: '#9fc0ff', px: 36 }
        : { texto: 'sem custo', cor: '#f59e0b', px: 36 },
    ], 0.5, 2.4);
    labelCusto.position.set(x, 3.1, 0);
    grupo.add(labelCusto);

    const labelQtd = this.criarSpriteTexto([
      { texto: est.rotulo, cor: '#eaf1ff', px: 32 },
      { texto: `${fmtQtd(est.quantidade)} ${est.unidade}${excedente > 0 ? ` (+${excedente})` : ''}`, cor: '#9fb2d4', px: 26 },
    ], 0.72, 2.6);
    labelQtd.position.set(x, -0.72, 0);
    grupo.add(labelQtd);

    // Portal entre este estágio e o próximo: seta + chip do multiplicador.
    if (indice < item.estagios.length - 1) {
      const prox = item.estagios[indice + 1];
      const mult = prox.quantidade > 0 && est.quantidade > 0 ? prox.quantidade / est.quantidade : null;
      const corPortal = prox.tipo === 'humana' ? COR_AMBAR : COR_CIANO;
      const xProx = SLOTS_X[Math.min(indice + 1, SLOTS_X.length - 1)];
      const xMeio = (x + xProx) / 2;

      const matSeta = new THREE.MeshBasicMaterial({ color: corPortal, transparent: true, opacity: 0.7 });
      const seta = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 12), matSeta);
      seta.rotation.z = -Math.PI / 2;
      seta.position.set(xMeio, 1.6, 0);
      grupo.add(seta);
      materiais.push(matSeta);

      const chip = this.criarSpriteTexto([
        { texto: `${prox.tipo === 'humana' ? '⚠️ ' : ''}×${mult != null ? fmtQtd(mult) : '?'}`, cor: prox.tipo === 'humana' ? '#fbbf24' : '#67e8f9', px: 38 },
      ], 0.55, 2.0);
      chip.position.set(xMeio, 2.6, 0);
      grupo.add(chip);
    }
  }

  // -------------------------------------------------------------------------
  // Modo receita: destaca ingredientes, apaga o resto
  // -------------------------------------------------------------------------

  /**
   * `checks` = ingredientes da receita com status; null limpa o modo.
   * Linhas fora da receita caem para 15% de opacidade; as da receita ganham
   * faixa acesa e marcador ✅/❌ no fim da linha.
   */
  destacarIngredientes(checks: Array<{ insumoId: string; cobre: boolean }> | null): void {
    for (const linha of this.linhasCena) {
      // Limpa marcador anterior.
      if (linha.marcador) {
        linha.grupo.remove(linha.marcador);
        linha.marcador.material.map?.dispose();
        linha.marcador.material.dispose();
        linha.marcador = undefined;
      }
      const faixaMat = linha.faixa.material as THREE.MeshBasicMaterial;

      if (!checks) {
        faixaMat.opacity = linha.item.estado === 'sem_estoque' ? 0.05 : 0.12;
        this.aplicarOpacidade(linha, 1);
        continue;
      }

      const check = checks.find((c) => c.insumoId === linha.item.insumoId);
      if (!check) {
        faixaMat.opacity = 0.03;
        this.aplicarOpacidade(linha, 0.15);
        continue;
      }

      faixaMat.opacity = 0.3;
      this.aplicarOpacidade(linha, 1);
      const marcador = this.criarSpriteTexto([
        { texto: check.cobre ? '✅' : '❌', cor: '#ffffff', px: 52 },
      ], 0.9, 1.2);
      marcador.position.set(SLOTS_X[SLOTS_X.length - 1] + 3.4, 1.6, 0);
      linha.grupo.add(marcador);
      linha.marcador = marcador;
    }
  }

  private aplicarOpacidade(linha: { materiais: THREE.Material[] }, opacidade: number): void {
    for (const m of linha.materiais) {
      const ms = m as THREE.MeshStandardMaterial;
      if (opacidade >= 1) {
        if (ms.userData.__dim) { ms.transparent = false; ms.opacity = 1; ms.userData.__dim = false; }
      } else {
        ms.transparent = true;
        ms.opacity = opacidade;
        ms.userData.__dim = true;
      }
      ms.needsUpdate = false; // evita recompilar shader por frame
    }
  }

  // -------------------------------------------------------------------------
  // Interação
  // -------------------------------------------------------------------------

  private intersectarLinha(e: PointerEvent): number | null {
    if (this.linhasCena.length === 0) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ponteiro.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ponteiro, this.camera);
    const hits = this.raycaster.intersectObjects(this.linhasCena.map((l) => l.hit), false);
    return hits.length > 0 ? (hits[0].object.userData.linha as number) : null;
  }

  private processarHover(e: PointerEvent): void {
    const linha = this.intersectarLinha(e);
    this.renderer.domElement.style.cursor = linha != null ? 'pointer' : 'grab';
  }

  private processarSolta(e: PointerEvent): void {
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (dx * dx + dy * dy >= 36) return; // drag, não clique
    const linha = this.intersectarLinha(e);
    this.opcoes.onSelecionar?.(linha != null ? this.linhasCena[linha].item : null);
  }

  // -------------------------------------------------------------------------
  // Sprites de texto
  // -------------------------------------------------------------------------

  private criarSpriteTexto(
    linhas: Array<{ texto: string; cor: string; px?: number }>,
    alturaMundo: number,
    larguraMundo: number,
  ): THREE.Sprite {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = 320 * dpr;
    canvas.height = 160 * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    linhas.forEach((l, i) => {
      let px = l.px ?? 36;
      do {
        ctx.font = `700 ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
        if (ctx.measureText(l.texto).width <= 300) break;
        px -= 2;
      } while (px > 12);
      ctx.fillStyle = l.cor;
      ctx.fillText(l.texto, 160, 160 * ((i + 0.5) / linhas.length));
    });

    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(larguraMundo, alturaMundo, 1);
    return sprite;
  }

  // -------------------------------------------------------------------------
  // Loop, câmera, resize, dispose
  // -------------------------------------------------------------------------

  private animar = (): void => {
    if (this.destruido) return;
    this.idAnimacao = requestAnimationFrame(this.animar);
    const t = this.relogio.getElapsedTime();

    // Anéis de crítico pulsam — o único movimento contínuo da cena (barato).
    if (!this.reduzMovimento) {
      const pulso = 0.75 + 0.25 * Math.sin(t * 3.2);
      for (const linha of this.linhasCena) {
        if (linha.anel) (linha.anel.material as THREE.MeshBasicMaterial).opacity = pulso;
      }
    }

    this.controles.update();
    this.renderer.render(this.cena, this.camera);
  };

  private enquadrarCamera(nLinhas: number): void {
    const profundidade = nLinhas * PITCH_LINHA;
    const dist = Math.max(20, profundidade * 0.85 + 14);
    this.camera.position.set(0, dist * 0.62, dist * 0.78);
    this.controles.target.set(-2, 0.6, 0);
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

  private limparSetor(): void {
    if (this.grupoSetor) {
      this.cena.remove(this.grupoSetor);
      this.grupoSetor.traverse((obj) => {
        if (obj instanceof THREE.InstancedMesh) {
          (obj.material as THREE.Material).dispose();
          obj.dispose();
        } else if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        } else if (obj instanceof THREE.Mesh) {
          (obj.material as THREE.Material).dispose();
        }
      });
      this.grupoSetor = null;
    }
    this.linhasCena = [];
  }

  /** Limpeza completa — chamar ao desmontar o componente React. */
  dispose(): void {
    this.destruido = true;
    cancelAnimationFrame(this.idAnimacao);
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);

    this.limparSetor();
    for (const g of [this.geoCaixa, this.geoCapsula, this.geoEsfera, this.geoFatia, this.geoTabua, this.geoAnel, this.geoFaixa, this.geoHit]) {
      g.dispose();
    }
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

// ---------------------------------------------------------------------------
// Formatação (pt-BR)
// ---------------------------------------------------------------------------

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });

const fmtQtd = (q: number) => q.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
