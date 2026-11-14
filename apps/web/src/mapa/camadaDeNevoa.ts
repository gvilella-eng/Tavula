import { nevoaCobreAlgo, type TracoDaNevoa } from "@tabletop/shared";
import {
  CanvasSource,
  Container,
  Graphics,
  type Renderer,
  RenderTexture,
  Sprite,
  Texture,
  TilingSprite,
} from "pixi.js";

/** Pixels do mundo por metro (o mesmo do mapa; repetido aqui para não importar o mapa de volta). */
const PX_POR_M = 40;
/** Lado maior, em pixels, da textura da névoa (a borda não precisa de mais) e a escala máxima dela. */
const LADO_MAXIMO = 2048;
const ESCALA_MAXIMA = 0.5;
/** A cor da área coberta, para o jogador: escura e opaca (conteúdo do mapa, não da interface). */
const COR_DA_NEVOA = 0x07090d;
/** O véu do mestre: quanto da área coberta ele ainda enxerga (translúcida, com a hachura por cima). */
const ALPHA_DO_VEU_DO_MESTRE = 0.5;
const ALPHA_DA_HACHURA = 0.9;

function texturaDaHachura(): Texture {
  const lado = 14;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const c = canvas.getContext("2d");
  if (c) {
    c.strokeStyle = "rgba(255,255,255,1)";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-2, lado + 2);
    c.lineTo(lado + 2, -2);
    c.moveTo(-2, 2);
    c.lineTo(2, -2);
    c.moveTo(lado - 2, lado + 2);
    c.lineTo(lado + 2, lado - 2);
    c.stroke();
  }
  return new Texture({ source: new CanvasSource({ resource: canvas }) });
}

/**
 * A névoa pintada à mão (N4): compõe os traços da cena, na ordem, numa textura de baixa resolução (cobrir
 * pinta, revelar apaga) e a mostra como um sprite do tamanho da cena. Só refaz a textura quando os traços
 * mudam. Para o jogador a área coberta é escura e opaca; para o mestre é um véu translúcido e hachurado.
 */
export class CamadaDaNevoa {
  readonly container = new Container();
  private readonly sprite = new Sprite();
  /** A máscara da hachura: um sprite à parte, porque o objeto usado como máscara deixa de ser desenhado. */
  private readonly mascara = new Sprite();
  private readonly hachura: TilingSprite;
  private textura: RenderTexture | null = null;
  private chave = "";

  constructor(private readonly renderer: Renderer) {
    this.hachura = new TilingSprite({ texture: texturaDaHachura(), width: 1, height: 1 });
    this.hachura.alpha = ALPHA_DA_HACHURA;
    this.container.addChild(this.sprite, this.mascara, this.hachura);
    this.container.visible = false;
  }

  /** Quantos traços a textura atual compõe (gancho de teste). */
  get visivel(): boolean {
    return this.container.visible;
  }

  /** Refaz a camada. `veuDoMestre`: translúcida e hachurada em vez de opaca. Devolve se algo mudou. */
  atualizar(
    tracos: readonly TracoDaNevoa[],
    larguraM: number,
    alturaM: number,
    veuDoMestre: boolean,
  ): boolean {
    const cobreAlgo = nevoaCobreAlgo(tracos);
    if (!cobreAlgo) {
      const mudou = this.container.visible;
      this.container.visible = false;
      this.chave = "";
      return mudou;
    }
    const chave = `${larguraM}x${alturaM}|${veuDoMestre ? "m" : "j"}|${JSON.stringify(tracos)}`;
    if (chave === this.chave && this.container.visible) return false;
    this.chave = chave;

    const larguraPx = larguraM * PX_POR_M;
    const alturaPx = alturaM * PX_POR_M;
    const escala = Math.min(ESCALA_MAXIMA, LADO_MAXIMO / Math.max(larguraPx, alturaPx));
    const w = Math.max(1, Math.round(larguraPx * escala));
    const h = Math.max(1, Math.round(alturaPx * escala));
    if (!this.textura || this.textura.width !== w || this.textura.height !== h) {
      this.textura?.destroy(true);
      this.textura = RenderTexture.create({ width: w, height: h });
    }

    // Os traços em ordem; os seguidos do mesmo modo dividem um Graphics (o apagar é por objeto).
    const cena = new Container();
    cena.scale.set(escala);
    let grupo: Graphics | null = null;
    let modoDoGrupo: TracoDaNevoa["modo"] | null = null;
    for (const t of tracos) {
      if (!grupo || modoDoGrupo !== t.modo) {
        grupo = new Graphics();
        if (t.modo === "revelar") grupo.blendMode = "erase";
        cena.addChild(grupo);
        modoDoGrupo = t.modo;
      }
      this.desenharTraco(grupo, t, larguraPx, alturaPx);
    }
    this.renderer.render({
      container: cena,
      target: this.textura,
      clear: true,
      clearColor: [0, 0, 0, 0],
    });
    cena.destroy({ children: true });

    this.sprite.texture = this.textura;
    this.sprite.width = larguraPx;
    this.sprite.height = alturaPx;
    this.sprite.alpha = veuDoMestre ? ALPHA_DO_VEU_DO_MESTRE : 1;
    this.mascara.texture = this.textura;
    this.mascara.width = larguraPx;
    this.mascara.height = alturaPx;
    this.hachura.width = larguraPx;
    this.hachura.height = alturaPx;
    this.hachura.visible = veuDoMestre;
    this.hachura.setMask({ mask: this.mascara, inverse: false });
    this.container.visible = true;
    return true;
  }

  private desenharTraco(g: Graphics, t: TracoDaNevoa, larguraPx: number, alturaPx: number): void {
    const px = t.pontos.map((p) => ({ x: p.x * PX_POR_M, y: p.y * PX_POR_M }));
    const cor = t.modo === "cobrir" ? COR_DA_NEVOA : 0xffffff;
    switch (t.forma) {
      case "tudo":
        g.rect(0, 0, larguraPx, alturaPx).fill(cor);
        return;
      case "retangulo": {
        const [a, b] = px;
        if (!a || !b) return;
        g.rect(
          Math.min(a.x, b.x),
          Math.min(a.y, b.y),
          Math.abs(a.x - b.x),
          Math.abs(a.y - b.y),
        ).fill(cor);
        return;
      }
      case "poligono":
        if (px.length >= 3) g.poly(px.flatMap((p) => [p.x, p.y])).fill(cor);
        return;
      case "pincel": {
        const raio = (t.raio ?? 1) * PX_POR_M;
        const [primeiro] = px;
        if (!primeiro) return;
        if (px.length === 1) {
          g.circle(primeiro.x, primeiro.y, raio).fill(cor);
          return;
        }
        g.moveTo(primeiro.x, primeiro.y);
        for (const p of px.slice(1)) g.lineTo(p.x, p.y);
        g.stroke({ width: raio * 2, color: cor, cap: "round", join: "round" });
        return;
      }
    }
  }

  destruir(): void {
    this.hachura.setMask({ mask: null });
    this.textura?.destroy(true);
    this.textura = null;
    this.container.destroy({ children: true });
  }
}
