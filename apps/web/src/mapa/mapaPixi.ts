import {
  type AssetMeta,
  type Camada,
  type Cena,
  criarLimitador,
  encaixarNoGrid,
  limitarNaCena,
  type Medida,
  medirRegua,
  suavizar,
  type Token,
} from "@tabletop/shared";
import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";

/** Pixels do mundo por metro (zoom 1). O zoom é a escala do `mundo` sobre isso. */
export const PX_POR_M = 40;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
/** Constante de tempo da interpolação dos tokens movidos por outros (os envios chegam a cada 50 ms). */
const TAU_MS = 70;
const ACENTO = 0xe0a030;

export type Ferramenta = "selecionar" | "mao" | "regua";

export type OpcoesDoMapa = {
  ferramenta: Ferramenta;
  euMestre: boolean;
  camadaTrabalho: Camada;
  /** Encaixe ligado (preferência); segurar Alt enquanto arrasta inverte. */
  encaixe: boolean;
  selecionadoId: string | null;
  podeMover: (token: Token) => boolean;
};

/** O que o mapa precisa saber das imagens locais (o gerente de assets responde). */
export type ImagensDoMapa = {
  meta(hash: string): AssetMeta | undefined;
  /** O arquivo (ou, no mapa fatiado, todos os tiles) já está no cache local? */
  pronto(hash: string): boolean;
  blob(hash: string): Promise<Blob | null>;
};

export type MedicaoNaTela = { medida: Medida; x: number; y: number };

export type RetornosDoMapa = {
  mover: (id: string, x: number, y: number) => void;
  soltar: (id: string, x: number, y: number) => void;
  selecionar: (id: string | null) => void;
  zoom: (zoom: number) => void;
  medir: (medicao: MedicaoNaTela | null) => void;
};

type Ponto = { x: number; y: number };

type Visual = {
  token: Token;
  chave: string;
  container: Container;
  anel: Graphics;
  /** A imagem do token já apareceu (senão vale o círculo gerado). */
  temImagem: boolean;
  x: number;
  y: number;
  alvoX: number;
  alvoY: number;
};

type Gesto =
  | { tipo: "pan"; inicio: Ponto; vistaInicial: Ponto }
  | {
      tipo: "token";
      id: string;
      deslocamento: Ponto;
      origem: Ponto;
      moveu: boolean;
      ultimoEnviado: Ponto | null;
      limitador: ReturnType<typeof criarLimitador<Ponto>>;
    }
  | { tipo: "regua" };

function iniciaisDe(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length >= 2)
    return `${palavras[0]?.[0] ?? ""}${palavras[1]?.[0] ?? ""}`.toUpperCase();
  return (palavras[0] ?? "?").slice(0, 2).toUpperCase();
}

/**
 * O mapa em PixiJS (v8), imperativo: o React só cria o controlador e entrega dados e opções.
 * Coordenadas do mundo em metros; a tela em pixels CSS relativos ao elemento hospedeiro.
 */
export class MapaPixi {
  private readonly app = new Application();
  private pronto = false;
  private destruido = false;
  private readonly mundo = new Container();
  private readonly fundo = new Graphics();
  private readonly camadaMapa = new Container();
  private readonly grade = new Graphics();
  private readonly camadaTokens = new Container();
  private readonly camadaMestre = new Container();
  private readonly desenhoDaRegua = new Graphics();
  private readonly visuais = new Map<string, Visual>();
  private readonly spritesDoMapa = new Map<string, Sprite>();
  private readonly texturas = new Map<string, Texture>();
  private readonly carregando = new Set<string>();
  private imagens: ImagensDoMapa | null = null;
  private readonly ultimasPosicoes = new Map<string, Ponto>();
  private cena: Cena | null = null;
  private tokens: Token[] = [];
  private opcoes: OpcoesDoMapa;
  private vista = { zoom: 1, x: 0, y: 0 };
  private gesto: Gesto | null = null;
  private espaco = false;
  private reguaAtual: { a: Ponto; b: Ponto } | null = null;
  private jaCentralizou = false;
  private sujo = true;
  private quadro = 0;
  private ultimoQuadro = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly retornos: () => RetornosDoMapa,
    opcoes: OpcoesDoMapa,
  ) {
    this.opcoes = opcoes;
  }

  // --- ciclo de vida --------------------------------------------------------------------------

  async iniciar(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      background: "#0d1015",
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      preference: "webgl",
      autoStart: false, // o desenho é sob demanda (ver `laco`): várias abas abertas não fritam a CPU
    });
    if (this.destruido) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.host.append(this.app.canvas);
    this.mundo.addChild(
      this.fundo,
      this.camadaMapa,
      this.grade,
      this.camadaTokens,
      this.camadaMestre,
      this.desenhoDaRegua,
    );
    this.app.stage.addChild(this.mundo);
    this.ultimoQuadro = performance.now();
    this.quadro = requestAnimationFrame(this.laco);

    const c = this.app.canvas;
    c.addEventListener("pointerdown", this.aoApertar);
    c.addEventListener("pointermove", this.aoMover);
    c.addEventListener("pointerup", this.aoSoltar);
    c.addEventListener("pointercancel", this.aoSoltar);
    c.addEventListener("wheel", this.aoRolar, { passive: false });
    c.addEventListener("contextmenu", this.impedir);
    window.addEventListener("keydown", this.aoTeclaBaixo);
    window.addEventListener("keyup", this.aoTeclaCima);
    this.app.renderer.on("resize", this.aoRedimensionar);

    this.pronto = true;
    this.instalarGanchoDeTeste();
    this.desenharCena();
    this.atualizarMapa();
    this.sincronizarTokens();
    this.centralizar();
    this.atualizarCursor();
  }

  destruir(): void {
    this.destruido = true;
    if (!this.pronto) return;
    this.pronto = false;
    cancelAnimationFrame(this.quadro);
    const c = this.app.canvas;
    c.removeEventListener("pointerdown", this.aoApertar);
    c.removeEventListener("pointermove", this.aoMover);
    c.removeEventListener("pointerup", this.aoSoltar);
    c.removeEventListener("pointercancel", this.aoSoltar);
    c.removeEventListener("wheel", this.aoRolar);
    c.removeEventListener("contextmenu", this.impedir);
    window.removeEventListener("keydown", this.aoTeclaBaixo);
    window.removeEventListener("keyup", this.aoTeclaCima);
    if (this.gesto?.tipo === "token") this.gesto.limitador.cancelar();
    this.gesto = null;
    if (import.meta.env.MODE === "e2e") {
      (window as unknown as { __tabletop?: unknown }).__tabletop = undefined;
    }
    for (const t of this.texturas.values()) t.destroy(true);
    this.texturas.clear();
    this.app.destroy(true, { children: true });
  }

  // --- dados vindos do React ------------------------------------------------------------------

  definirCena(cena: Cena): void {
    const gridMudou = this.cena?.grid.quadradoM !== cena.grid.quadradoM;
    // Outra cena (o mestre foi ver a cena 2, ou o grupo foi levado): tokens e vista recomeçam.
    const outraCena = this.cena !== null && this.cena.id !== cena.id;
    const tamanhoMudou =
      this.cena !== null &&
      (this.cena.larguraM !== cena.larguraM || this.cena.alturaM !== cena.alturaM);
    this.cena = cena;
    if (!this.pronto) return;
    this.desenharCena();
    this.atualizarMapa();
    if (gridMudou || outraCena) this.recriarVisuais();
    // Mapa novo muda o tamanho da cena: enquadra de novo.
    if (!this.jaCentralizou || tamanhoMudou || outraCena) this.centralizar();
  }

  /** O gerente de assets (de onde vêm as imagens locais). */
  definirImagens(imagens: ImagensDoMapa): void {
    this.imagens = imagens;
    if (this.pronto) this.imagensMudaram();
  }

  /** Chegou ou mudou algo no cache de imagens: refaz o fundo e as imagens dos tokens. */
  imagensMudaram(): void {
    if (!this.pronto) return;
    this.atualizarMapa();
    this.sincronizarTokens();
  }

  private async carregarTextura(hash: string): Promise<Texture | null> {
    const pronta = this.texturas.get(hash);
    if (pronta) return pronta;
    const blob = await this.imagens?.blob(hash);
    if (!blob || this.destruido) return null;
    const textura = Texture.from(await createImageBitmap(blob));
    if (this.destruido) {
      textura.destroy(true);
      return null;
    }
    this.texturas.set(hash, textura);
    return textura;
  }

  /** Pede a textura em segundo plano (uma vez) e roda `depois` quando ela chegar. */
  private carregarEDepois(hash: string, depois: () => void): void {
    if (this.texturas.has(hash) || this.carregando.has(hash)) return;
    this.carregando.add(hash);
    this.carregarTextura(hash)
      .catch((e) => console.error("Falha ao carregar imagem", e))
      .finally(() => {
        this.carregando.delete(hash);
        if (this.pronto) depois();
      });
  }

  /** Fundo da cena: o mapa (sprites por tile), na escala px ÷ pxPorQuadrado × quadradoM. */
  private atualizarMapa(): void {
    this.sujo = true;
    const cena = this.cena;
    const mapa = cena?.mapa;
    const manter = new Set<string>();
    const meta = mapa && this.imagens ? this.imagens.meta(mapa.assetHash) : undefined;
    if (cena && mapa && meta) {
      const escala = (cena.grid.quadradoM / mapa.pxPorQuadrado) * PX_POR_M;
      const tiles = meta.tiles ?? [
        { hash: meta.hash, x: 0, y: 0, largura: meta.largura, altura: meta.altura },
      ];
      for (const t of tiles) {
        manter.add(t.hash);
        let sprite = this.spritesDoMapa.get(t.hash);
        if (!sprite) {
          const textura = this.texturas.get(t.hash);
          if (!textura) {
            if (this.imagens?.pronto(t.hash)) {
              this.carregarEDepois(t.hash, () => this.atualizarMapa());
            }
            continue;
          }
          sprite = new Sprite(textura);
          this.spritesDoMapa.set(t.hash, sprite);
          this.camadaMapa.addChild(sprite);
        }
        sprite.position.set(t.x * escala, t.y * escala);
        sprite.width = t.largura * escala;
        sprite.height = t.altura * escala;
      }
    }
    for (const [hash, sprite] of this.spritesDoMapa) {
      if (manter.has(hash)) continue;
      sprite.destroy();
      this.spritesDoMapa.delete(hash);
    }
  }

  definirTokens(tokens: Token[]): void {
    this.tokens = tokens;
    if (this.pronto) this.sincronizarTokens();
  }

  definirOpcoes(opcoes: OpcoesDoMapa): void {
    const trocouFerramenta = opcoes.ferramenta !== this.opcoes.ferramenta;
    this.opcoes = opcoes;
    if (!this.pronto) return;
    if (trocouFerramenta) this.limparRegua();
    this.atualizarEstilos();
    this.atualizarCursor();
  }

  /** A sala recusou algo: volta cada token para a posição que ela tem. */
  ressincronizar(): void {
    for (const [id, v] of this.visuais) {
      const p = this.ultimasPosicoes.get(id);
      if (p) {
        v.alvoX = p.x;
        v.alvoY = p.y;
      }
    }
  }

  /** `token.movendo` de outro usuário: o token interpola até a posição. */
  movendo(id: string, x: number, y: number): void {
    const v = this.visuais.get(id);
    if (!v || (this.gesto?.tipo === "token" && this.gesto.id === id)) return;
    v.alvoX = x;
    v.alvoY = y;
  }

  // --- zoom e vista ---------------------------------------------------------------------------

  get zoom(): number {
    return this.vista.zoom;
  }

  /** Zoom absoluto, centrado no meio da tela. */
  definirZoom(zoom: number): void {
    if (!this.pronto) return;
    this.zoomEm(zoom / this.vista.zoom, { x: this.largura() / 2, y: this.altura() / 2 });
  }

  zoomPorPassos(fator: number): void {
    if (!this.pronto) return;
    this.zoomEm(fator, { x: this.largura() / 2, y: this.altura() / 2 });
  }

  /** Cabe a cena inteira na tela e a centraliza. */
  centralizar(): void {
    if (!this.pronto || !this.cena) return;
    const w = this.cena.larguraM * PX_POR_M;
    const h = this.cena.alturaM * PX_POR_M;
    const zoom = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min((this.largura() - 120) / w, (this.altura() - 120) / h)),
    );
    this.vista = {
      zoom,
      x: (this.largura() - w * zoom) / 2,
      y: (this.altura() - h * zoom) / 2,
    };
    this.jaCentralizou = this.largura() > 0;
    this.aplicarVista();
  }

  /** Leva o ponto do mundo (em metros) para o centro da tela. */
  centrarEm(xM: number, yM: number): void {
    if (!this.pronto) return;
    this.vista.x = this.largura() / 2 - xM * PX_POR_M * this.vista.zoom;
    this.vista.y = this.altura() / 2 - yM * PX_POR_M * this.vista.zoom;
    this.aplicarVista();
  }

  /** Metros do mundo no centro da tela (para criar o token novo à vista). */
  centroDaTelaEmMetros(): Ponto {
    return this.paraMundo({ x: this.largura() / 2, y: this.altura() / 2 });
  }

  paraTela(xM: number, yM: number): Ponto {
    return {
      x: xM * PX_POR_M * this.vista.zoom + this.vista.x,
      y: yM * PX_POR_M * this.vista.zoom + this.vista.y,
    };
  }

  private paraMundo(p: Ponto): Ponto {
    return {
      x: (p.x - this.vista.x) / this.vista.zoom / PX_POR_M,
      y: (p.y - this.vista.y) / this.vista.zoom / PX_POR_M,
    };
  }

  private largura(): number {
    return this.host.clientWidth;
  }
  private altura(): number {
    return this.host.clientHeight;
  }

  private zoomEm(fator: number, centro: Ponto): void {
    const novo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.vista.zoom * fator));
    const razao = novo / this.vista.zoom;
    this.vista = {
      zoom: novo,
      x: centro.x - (centro.x - this.vista.x) * razao,
      y: centro.y - (centro.y - this.vista.y) * razao,
    };
    this.aplicarVista();
  }

  /** A cena precisa continuar parcialmente à vista: não deixa o mapa "fugir" da tela. */
  private limitarVista(): void {
    if (!this.cena) return;
    const w = this.cena.larguraM * PX_POR_M * this.vista.zoom;
    const h = this.cena.alturaM * PX_POR_M * this.vista.zoom;
    const margem = 120;
    this.vista.x = Math.min(this.largura() - margem, Math.max(margem - w, this.vista.x));
    this.vista.y = Math.min(this.altura() - margem, Math.max(margem - h, this.vista.y));
  }

  private aplicarVista(): void {
    this.sujo = true;
    this.limitarVista();
    this.mundo.position.set(this.vista.x, this.vista.y);
    this.mundo.scale.set(this.vista.zoom);
    this.retornos().zoom(this.vista.zoom);
    this.desenharRegua();
  }

  private readonly aoRedimensionar = () => {
    if (!this.jaCentralizou) this.centralizar();
    else this.aplicarVista();
  };

  // --- desenho --------------------------------------------------------------------------------

  private desenharCena(): void {
    this.sujo = true;
    const cena = this.cena;
    if (!cena) return;
    const w = cena.larguraM * PX_POR_M;
    const h = cena.alturaM * PX_POR_M;
    this.fundo.clear().rect(0, 0, w, h).fill(0x151a22).stroke({ width: 2, color: 0x2c3442 });
    this.grade.clear();
    if (!cena.grid.visivel) return;
    const passo = cena.grid.quadradoM * PX_POR_M;
    for (let x = passo; x < w; x += passo) this.grade.moveTo(x, 0).lineTo(x, h);
    for (let y = passo; y < h; y += passo) this.grade.moveTo(0, y).lineTo(w, y);
    this.grade.stroke({ width: 1, color: 0xffffff, alpha: 0.1, pixelLine: true });
  }

  private quadradoM(): number {
    return this.cena?.grid.quadradoM ?? 1.5;
  }

  private chaveDe(t: Token): string {
    const imagem = t.assetHash && this.texturas.has(t.assetHash) ? t.assetHash : "";
    return `${t.nome}|${t.cor}|${t.tamanhoQuadrados}|${t.oculto}|${t.camada}|${imagem}`;
  }

  private criarVisual(token: Token, x: number, y: number): Visual {
    const raio = (token.tamanhoQuadrados * this.quadradoM() * PX_POR_M) / 2 - 3;
    const container = new Container();
    // Com imagem local: recortada em círculo. Senão (ou enquanto não chega): círculo gerado com a
    // cor e as iniciais do nome.
    const textura = token.assetHash ? this.texturas.get(token.assetHash) : undefined;
    const corpo = new Graphics().circle(0, 0, raio);
    if (textura) corpo.fill(0x10141a);
    else corpo.fill(token.cor);
    corpo.stroke({ width: 3, color: 0x000000, alpha: 0.55 });
    const imagem = new Container();
    if (textura) {
      const figura = new Sprite(textura);
      figura.anchor.set(0.5);
      figura.scale.set((raio * 2) / Math.min(textura.width, textura.height));
      const mascara = new Graphics().circle(0, 0, raio).fill(0xffffff);
      figura.mask = mascara;
      imagem.addChild(mascara, figura);
    }
    const iniciais = new Text({
      text: iniciaisDe(token.nome),
      style: {
        fill: 0xffffff,
        fontSize: Math.max(12, raio * 0.8),
        fontWeight: "700",
        fontFamily: "system-ui, sans-serif",
        stroke: { color: 0x000000, width: 3 },
      },
    });
    iniciais.anchor.set(0.5);
    iniciais.visible = textura === undefined;
    const rotulo = new Text({
      text: token.nome,
      style: {
        fill: 0xe8eaed,
        fontSize: 13,
        fontFamily: "system-ui, sans-serif",
        stroke: { color: 0x000000, width: 3 },
      },
    });
    rotulo.anchor.set(0.5, 0);
    rotulo.position.set(0, raio + 4);
    const anel = new Graphics().circle(0, 0, raio + 5).stroke({ width: 3, color: ACENTO });
    anel.visible = false;
    container.addChild(anel, corpo, imagem, iniciais, rotulo);
    if (token.oculto) container.addChild(this.desenharOlhoCortado(raio));
    container.position.set(x * PX_POR_M, y * PX_POR_M);
    (token.camada === "mestre" ? this.camadaMestre : this.camadaTokens).addChild(container);
    return {
      token,
      chave: this.chaveDe(token),
      container,
      anel,
      temImagem: textura !== undefined,
      x,
      y,
      alvoX: x,
      alvoY: y,
    };
  }

  /** Ícone de olho cortado (token oculto, só o mestre vê) no canto do token. */
  private desenharOlhoCortado(raio: number): Graphics {
    const g = new Graphics();
    const cx = raio * 0.72;
    const cy = -raio * 0.72;
    g.circle(cx, cy, 11).fill({ color: 0x0d1015, alpha: 0.85 });
    g.ellipse(cx, cy, 7, 4.5).stroke({ width: 1.5, color: 0xffffff });
    g.circle(cx, cy, 1.8).fill(0xffffff);
    g.moveTo(cx - 8, cy + 7).lineTo(cx + 8, cy - 7);
    g.stroke({ width: 2, color: 0xff6b5a });
    return g;
  }

  private recriarVisuais(): void {
    this.sujo = true;
    for (const v of this.visuais.values()) v.container.destroy({ children: true });
    this.visuais.clear();
    this.sincronizarTokens();
  }

  private sincronizarTokens(): void {
    this.sujo = true;
    const cenaId = this.cena?.id;
    const ids = new Set<string>();
    for (const t of this.tokens) {
      if (cenaId !== undefined && t.cenaId !== cenaId) continue;
      ids.add(t.id);
      if (t.assetHash && this.imagens?.pronto(t.assetHash)) {
        this.carregarEDepois(t.assetHash, () => this.sincronizarTokens());
      }
      const antes = this.ultimasPosicoes.get(t.id);
      const mudouNoEstado = !antes || antes.x !== t.x || antes.y !== t.y;
      this.ultimasPosicoes.set(t.id, { x: t.x, y: t.y });
      let v = this.visuais.get(t.id);
      if (v && v.chave !== this.chaveDe(t)) {
        // Mudou nome, cor, tamanho, camada ou visibilidade: refaz a aparência na posição atual.
        const { x, y } = v;
        v.container.destroy({ children: true });
        v = this.criarVisual(t, x, y);
        this.visuais.set(t.id, v);
      } else if (!v) {
        v = this.criarVisual(t, t.x, t.y);
        this.visuais.set(t.id, v);
      }
      v.token = t;
      // Só reposiciona quando a posição gravada mudou: não atropela um movimento ao vivo em curso.
      if (mudouNoEstado) {
        const arrastando = this.gesto?.tipo === "token" && this.gesto.id === t.id;
        if (!arrastando) {
          v.alvoX = t.x;
          v.alvoY = t.y;
        }
      }
    }
    for (const [id, v] of this.visuais) {
      if (ids.has(id)) continue;
      // Sumiu no meio do meu arraste (o mestre escondeu ou apagou): o arraste acaba aqui, senão
      // eu continuaria mandando posições de um token que a sala diz não existir.
      if (this.gesto?.tipo === "token" && this.gesto.id === id) {
        this.gesto.limitador.cancelar();
        this.gesto = null;
        this.atualizarCursor();
      }
      v.container.destroy({ children: true });
      this.visuais.delete(id);
      this.ultimasPosicoes.delete(id);
    }
    this.atualizarEstilos();
  }

  private selecionavel(t: Token): boolean {
    return this.opcoes.euMestre ? t.camada === this.opcoes.camadaTrabalho : t.camada === "tokens";
  }

  private atualizarEstilos(): void {
    this.sujo = true;
    for (const v of this.visuais.values()) {
      const t = v.token;
      let alpha = 1;
      if (t.oculto) alpha = 0.5;
      else if (t.camada === "mestre" && this.opcoes.camadaTrabalho === "tokens") alpha = 0.45;
      v.container.alpha = alpha;
      v.anel.visible = this.opcoes.selecionadoId === t.id;
    }
  }

  /** Um quadro: anima os tokens e só redesenha se algo mudou. */
  private readonly laco = (agora: number) => {
    const dt = agora - this.ultimoQuadro;
    this.ultimoQuadro = agora;
    this.animar(dt);
    if (this.sujo) {
      this.sujo = false;
      this.app.render();
    }
    this.quadro = requestAnimationFrame(this.laco);
  };

  private animar(dtMs: number): void {
    const arrastando = this.gesto?.tipo === "token" ? this.gesto.id : null;
    for (const v of this.visuais.values()) {
      if (v.x === v.alvoX && v.y === v.alvoY) continue;
      if (v.token.id === arrastando) {
        v.x = v.alvoX;
        v.y = v.alvoY;
      } else {
        v.x = suavizar(v.x, v.alvoX, dtMs, TAU_MS);
        v.y = suavizar(v.y, v.alvoY, dtMs, TAU_MS);
      }
      v.container.position.set(v.x * PX_POR_M, v.y * PX_POR_M);
      this.sujo = true;
    }
  }

  // --- régua ----------------------------------------------------------------------------------

  private limparRegua(): void {
    this.sujo = true;
    this.reguaAtual = null;
    this.desenhoDaRegua.clear();
    this.retornos().medir(null);
  }

  private desenharRegua(): void {
    this.sujo = true;
    const r = this.reguaAtual;
    if (!r) return;
    const z = this.vista.zoom;
    const a = { x: r.a.x * PX_POR_M, y: r.a.y * PX_POR_M };
    const b = { x: r.b.x * PX_POR_M, y: r.b.y * PX_POR_M };
    this.desenhoDaRegua.clear();
    this.desenhoDaRegua
      .moveTo(a.x, a.y)
      .lineTo(b.x, b.y)
      .stroke({ width: 3 / z, color: ACENTO });
    this.desenhoDaRegua.circle(a.x, a.y, 5 / z).fill(ACENTO);
    this.desenhoDaRegua.circle(b.x, b.y, 5 / z).fill(ACENTO);
    const fim = this.paraTela(r.b.x, r.b.y);
    this.retornos().medir({ medida: medirRegua(r.a, r.b, this.quadradoM()), x: fim.x, y: fim.y });
  }

  // --- ponteiro e teclado ---------------------------------------------------------------------

  private posicaoNaTela(e: PointerEvent | WheelEvent): Ponto {
    const r = this.app.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private tokenEm(p: Ponto): Visual | null {
    const m = this.paraMundo(p);
    const minimo = 12 / (this.vista.zoom * PX_POR_M); // alvo mínimo de 12 px na tela
    let achado: Visual | null = null;
    // A camada do mestre fica por cima; dentro de cada camada vale o último desenhado.
    const ordem = [...this.visuais.values()].sort(
      (a, b) => Number(a.token.camada === "mestre") - Number(b.token.camada === "mestre"),
    );
    for (const v of ordem) {
      const raio = Math.max((v.token.tamanhoQuadrados * this.quadradoM()) / 2, minimo);
      if (Math.hypot(m.x - v.x, m.y - v.y) <= raio) achado = v;
    }
    return achado;
  }

  private encaixaAgora(alt: boolean): boolean {
    return alt ? !this.opcoes.encaixe : this.opcoes.encaixe;
  }

  private readonly aoApertar = (e: PointerEvent) => {
    const p = this.posicaoNaTela(e);
    const pan =
      e.button === 1 || (e.button === 0 && (this.espaco || this.opcoes.ferramenta === "mao"));
    if (pan) {
      e.preventDefault();
      this.gesto = { tipo: "pan", inicio: p, vistaInicial: { x: this.vista.x, y: this.vista.y } };
      this.app.canvas.setPointerCapture(e.pointerId);
      this.atualizarCursor();
      return;
    }
    if (e.button !== 0 || !this.cena) return;

    if (this.opcoes.ferramenta === "regua") {
      const a = this.pontoDaRegua(this.paraMundo(p), e.altKey);
      this.reguaAtual = { a, b: a };
      this.gesto = { tipo: "regua" };
      this.app.canvas.setPointerCapture(e.pointerId);
      this.desenharRegua();
      return;
    }

    const v = this.tokenEm(p);
    if (!v || !this.selecionavel(v.token)) {
      if (!v) this.retornos().selecionar(null);
      return;
    }
    if (this.opcoes.euMestre) this.retornos().selecionar(v.token.id);
    if (!this.opcoes.podeMover(v.token)) return;
    const m = this.paraMundo(p);
    const id = v.token.id;
    this.gesto = {
      tipo: "token",
      id,
      deslocamento: { x: v.x - m.x, y: v.y - m.y },
      origem: { x: v.x, y: v.y },
      moveu: false,
      ultimoEnviado: null,
      limitador: criarLimitador<Ponto>((pos) => this.retornos().mover(id, pos.x, pos.y), {
        agora: () => performance.now(),
        agendar: (fn, ms) => setTimeout(fn, ms),
        cancelar: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      }),
    };
    this.app.canvas.setPointerCapture(e.pointerId);
    this.atualizarCursor();
  };

  private pontoDaRegua(m: Ponto, alt: boolean): Ponto {
    return this.encaixaAgora(alt) ? encaixarNoGrid(m, 1, this.quadradoM()) : m;
  }

  private readonly aoMover = (e: PointerEvent) => {
    const g = this.gesto;
    const p = this.posicaoNaTela(e);
    if (!g) {
      this.atualizarCursor(this.tokenEm(p));
      return;
    }
    if (g.tipo === "pan") {
      this.vista.x = g.vistaInicial.x + (p.x - g.inicio.x);
      this.vista.y = g.vistaInicial.y + (p.y - g.inicio.y);
      this.aplicarVista();
      return;
    }
    if (g.tipo === "regua") {
      if (this.reguaAtual) {
        this.reguaAtual.b = this.pontoDaRegua(this.paraMundo(p), e.altKey);
        this.desenharRegua();
      }
      return;
    }
    const v = this.visuais.get(g.id);
    if (!v || !this.cena) return;
    const m = this.paraMundo(p);
    let alvo: Ponto = { x: m.x + g.deslocamento.x, y: m.y + g.deslocamento.y };
    if (this.encaixaAgora(e.altKey)) {
      alvo = encaixarNoGrid(alvo, v.token.tamanhoQuadrados, this.quadradoM());
    }
    alvo = limitarNaCena(alvo, this.cena);
    v.alvoX = alvo.x;
    v.alvoY = alvo.y;
    if (alvo.x !== g.origem.x || alvo.y !== g.origem.y) g.moveu = true;
    if (!g.ultimoEnviado || g.ultimoEnviado.x !== alvo.x || g.ultimoEnviado.y !== alvo.y) {
      g.ultimoEnviado = alvo;
      g.limitador.enviar(alvo);
    }
  };

  private readonly aoSoltar = (e: PointerEvent) => {
    const g = this.gesto;
    if (!g) return;
    this.gesto = null;
    if (this.app.canvas.hasPointerCapture(e.pointerId)) {
      this.app.canvas.releasePointerCapture(e.pointerId);
    }
    if (g.tipo === "token") {
      // O soltar sai na hora, fora do limitador; o movimento pendente deixa de importar.
      g.limitador.cancelar();
      const v = this.visuais.get(g.id);
      if (g.moveu && v) this.retornos().soltar(g.id, v.alvoX, v.alvoY);
    }
    this.atualizarCursor();
  };

  private readonly aoRolar = (e: WheelEvent) => {
    e.preventDefault();
    this.zoomEm(Math.exp(-e.deltaY * 0.0015), this.posicaoNaTela(e));
  };

  private readonly impedir = (e: Event) => e.preventDefault();

  private digitando(): boolean {
    const a = document.activeElement;
    return (
      a instanceof HTMLElement &&
      (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))
    );
  }

  private readonly aoTeclaBaixo = (e: KeyboardEvent) => {
    if (this.digitando()) return;
    if (e.code === "Space") {
      this.espaco = true;
      e.preventDefault();
      this.atualizarCursor();
    }
    if (e.key === "Escape") this.limparRegua();
  };

  private readonly aoTeclaCima = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.espaco = false;
      this.atualizarCursor();
    }
  };

  private atualizarCursor(sobre: Visual | null = null): void {
    if (!this.pronto) return;
    const g = this.gesto;
    let cursor = "default";
    if (g?.tipo === "pan") cursor = "grabbing";
    else if (this.espaco || this.opcoes.ferramenta === "mao") cursor = "grab";
    else if (this.opcoes.ferramenta === "regua") cursor = "crosshair";
    else if (g?.tipo === "token") cursor = "grabbing";
    else if (sobre && this.selecionavel(sobre.token)) {
      cursor = this.opcoes.podeMover(sobre.token) ? "grab" : "pointer";
    }
    this.app.canvas.style.cursor = cursor;
  }

  // --- gancho de teste (só no modo e2e) -------------------------------------------------------

  private instalarGanchoDeTeste(): void {
    if (import.meta.env.MODE !== "e2e") return;
    const w = window as unknown as { __tabletop?: unknown };
    w.__tabletop = {
      tokens: () =>
        [...this.visuais.values()].map((v) => ({
          id: v.token.id,
          nome: v.token.nome,
          x: v.x,
          y: v.y,
          tamanho: v.token.tamanhoQuadrados,
          oculto: v.token.oculto,
          camada: v.token.camada,
        })),
      /** Metros do mundo -> pixels CSS da página (para o `page.mouse`). */
      paraTela: (xM: number, yM: number) => {
        const r = this.app.canvas.getBoundingClientRect();
        const p = this.paraTela(xM, yM);
        return { x: r.left + p.x, y: r.top + p.y };
      },
      zoom: () => this.vista.zoom,
      definirZoom: (z: number) => this.definirZoom(z),
      centrarEm: (x: number, y: number) => this.centrarEm(x, y),
      quadradoM: () => this.quadradoM(),
      ferramenta: () => this.opcoes.ferramenta,
      /** O que o fundo e os tokens mostram de imagem local (para conferir sem olhar o canvas). */
      imagens: () => ({
        tiles: [...this.spritesDoMapa].map(([hash, s]) => ({
          hash,
          x: s.x,
          y: s.y,
          largura: s.width,
          altura: s.height,
        })),
        tokensComImagem: [...this.visuais.values()]
          .filter((v) => v.temImagem)
          .map((v) => v.token.id),
      }),
    };
  }
}
