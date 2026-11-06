import {
  type AssetMeta,
  bloqueiaVisao,
  type Cena,
  chegadaDaCena,
  criarLimitador,
  encaixarNoGrid,
  limitarNaCena,
  type Medida,
  medirRegua,
  meioDaParede,
  type Parede,
  poligonoDeVisibilidade,
  pontoNaUniao,
  suavizar,
  type TipoDeParede,
  type Token,
  trajetoBloqueado,
} from "@tabletop/shared";
import { Application, Container, Graphics, RenderTexture, Sprite, Text, Texture } from "pixi.js";
import type { CamadaDeTrabalho } from "../camadas";

/** Pixels do mundo por metro (zoom 1). O zoom é a escala do `mundo` sobre isso. */
export const PX_POR_M = 40;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
/** Constante de tempo da interpolação dos tokens movidos por outros (os envios chegam a cada 50 ms). */
const TAU_MS = 70;
const ACENTO = 0xe0a030;

export type Ferramenta = "selecionar" | "mao" | "regua" | "paredes";

/** Quem enxerga (o token e o alcance; `null` = sem limite). A posição vem do próprio mapa. */
export type FonteDeVisao = { tokenId: string; alcanceM: number | null };

/**
 * Como a tela mostra a visão (só de tela, nunca vai para a sala):
 * - `jogador`: fora da união da visão das fontes é escuro e os tokens de lá não são desenhados;
 * - `noturna` (mestre): o que as fontes veem fica normal e o resto, apagado;
 * - `claro`: tudo claro.
 */
export type ConfigDeVisao = {
  modo: "jogador" | "noturna" | "claro";
  fontes: FonteDeVisao[];
};

/** Tamanho (em pixels da tela) dos ícones das portas e das alças das pontas. */
const RAIO_DO_ICONE = 11;
const RAIO_DA_ALCA = 6;
/** Resolução máxima (lado maior, em pixels) da textura do véu da visão. */
const LADO_MAXIMO_DO_VEU = 3000;

export type OpcoesDoMapa = {
  ferramenta: Ferramenta;
  euMestre: boolean;
  camadaTrabalho: CamadaDeTrabalho;
  /** Token de personagem de jogador (o grupo): o zoom inicial centra neles. */
  ehDoGrupo: (token: Token) => boolean;
  /** Encaixe ligado (preferência); segurar Alt enquanto arrasta inverte. */
  encaixe: boolean;
  selecionadoId: string | null;
  podeMover: (token: Token) => boolean;
  /** O mestre vendo como mestre (não "como o jogador X"): vê todas as paredes e as portas secretas. */
  modoMestre: boolean;
  paredeSelecionadaId: string | null;
  /** Tipo das paredes que a ferramenta de paredes desenha. */
  tipoDaNovaParede: TipoDeParede;
  visao: ConfigDeVisao;
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
  /** O mestre arrastou a bandeira do ponto de chegada (da cena que ele está vendo). */
  chegada: (cenaId: string, x: number, y: number) => void;
  selecionar: (id: string | null) => void;
  zoom: (zoom: number) => void;
  medir: (medicao: MedicaoNaTela | null) => void;
  /** Uma sequência desenhada vira paredes (numa mensagem só). */
  criarParedes: (cenaId: string, segmentos: { a: Ponto; b: Ponto }[], tipo: TipoDeParede) => void;
  /** Arrastou uma ponta da parede. */
  moverPonta: (id: string, ponta: "a" | "b", ponto: Ponto) => void;
  selecionarParede: (id: string | null) => void;
  apagarParede: (id: string) => void;
  /** Clique no ícone da porta. */
  alternarPorta: (id: string) => void;
  /** Clique direito no ícone da porta (só o mestre): tranca ou destranca. */
  trancarPorta: (id: string) => void;
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
  | { tipo: "bandeira"; deslocamento: Ponto }
  | { tipo: "ponta"; id: string; ponta: "a" | "b" }
  | { tipo: "regua" };

/** Cor e espessura (px na tela) de cada tipo de parede quando a ferramenta de paredes está ativa. */
const ESTILO_DA_PAREDE: Record<TipoDeParede, { cor: number; largura: number }> = {
  parede: { cor: 0xf1f3f5, largura: 4 },
  porta: { cor: 0xe0a030, largura: 5 },
  janela: { cor: 0x4fc3f7, largura: 4 },
  secreta: { cor: 0xb388ff, largura: 4 },
  invisivel: { cor: 0x8a94a3, largura: 2 },
};

function distanciaAoSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c2 = dx * dx + dy * dy;
  const t = c2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / c2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

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
  /** Objetos de cenário (camada `mapa`): acima da imagem do mapa e abaixo dos tokens. */
  private readonly camadaCenario = new Container();
  private readonly camadaTokens = new Container();
  private readonly camadaMestre = new Container();
  /** Véu da visão (RenderTexture): escuro onde ninguém vê. Acima dos tokens, abaixo das paredes do mestre. */
  private readonly veu = new Sprite();
  private readonly veuFonte = new Container();
  private readonly veuFundo = new Graphics();
  private readonly veuBuracos = new Graphics();
  private veuTextura: RenderTexture | null = null;
  private veuTamanho = { w: 0, h: 0 };
  /** Portas que o jogador vê: abaixo do véu (só aparecem onde ele enxerga). */
  private readonly paredesAbaixo = new Graphics();
  /** Paredes, portas e a ferramenta do mestre: acima do véu. */
  private readonly paredesAcima = new Graphics();
  private paredes: Parede[] = [];
  private poligonos: Ponto[][] = [];
  private visaoSuja = true;
  private visibilidadeSuja = true;
  private chaveDaVisao = "";
  /** Pontos já clicados da sequência de paredes em desenho. */
  private desenhando: Ponto[] | null = null;
  private cursorDaParede: Ponto | null = null;
  private pontaArrastada: { id: string; ponta: "a" | "b"; pos: Ponto } | null = null;
  private readonly desenhoDaRegua = new Graphics();
  /** Bandeira do ponto de chegada do grupo (só o mestre a vê e arrasta). */
  private readonly bandeira = new Container();
  private posicaoDaBandeira: Ponto | null = null;
  private focoPendente = false;
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
      this.camadaCenario,
      this.camadaTokens,
      this.camadaMestre,
      this.veu,
      this.paredesAbaixo,
      this.paredesAcima,
      this.bandeira,
      this.desenhoDaRegua,
    );
    this.veuFundo.blendMode = "normal";
    this.veuBuracos.blendMode = "erase";
    this.veuFonte.addChild(this.veuFundo, this.veuBuracos);
    this.veu.visible = false;
    this.desenharBandeira();
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
    c.addEventListener("dblclick", this.aoDuploClique);
    window.addEventListener("keydown", this.aoTeclaBaixo);
    window.addEventListener("keyup", this.aoTeclaCima);
    this.app.renderer.on("resize", this.aoRedimensionar);

    this.pronto = true;
    this.chaveDaVisao = this.chaveDe_visao();
    this.instalarGanchoDeTeste();
    this.desenharCena();
    this.atualizarMapa();
    this.sincronizarTokens();
    this.vistaInicial();
    this.atualizarBandeira();
    this.atualizarCursor();
    this.desenharParedes();
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
    c.removeEventListener("dblclick", this.aoDuploClique);
    window.removeEventListener("keydown", this.aoTeclaBaixo);
    window.removeEventListener("keyup", this.aoTeclaCima);
    if (this.gesto?.tipo === "token") this.gesto.limitador.cancelar();
    this.gesto = null;
    if (import.meta.env.MODE === "e2e") {
      (window as unknown as { __tabletop?: unknown }).__tabletop = undefined;
    }
    for (const t of this.texturas.values()) t.destroy(true);
    this.texturas.clear();
    this.veuTextura?.destroy(true);
    this.veuTextura = null;
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
    this.visaoSuja = true;
    this.desenharParedes();
    this.desenharCena();
    this.atualizarMapa();
    if (gridMudou || outraCena) this.recriarVisuais();
    // Outra cena ou mapa novo (tamanho novo): volta a abrir em 100%, no grupo ou no centro da cena.
    if (!this.jaCentralizou || tamanhoMudou || outraCena) {
      this.vistaInicial();
      // Os tokens da cena nova podem chegar logo depois, no mesmo ciclo do React: refaz o foco uma vez.
      this.focoPendente = true;
      queueMicrotask(() => {
        this.focoPendente = false;
      });
    }
    this.atualizarBandeira();
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
    if (!this.pronto) return;
    this.sincronizarTokens();
    if (this.focoPendente) this.vistaInicial();
  }

  definirOpcoes(opcoes: OpcoesDoMapa): void {
    const trocouFerramenta = opcoes.ferramenta !== this.opcoes.ferramenta;
    this.opcoes = opcoes;
    if (!this.pronto) return;
    if (trocouFerramenta) {
      this.limparRegua();
      this.desenhando = null;
      this.cursorDaParede = null;
    }
    const chave = this.chaveDe_visao();
    if (chave !== this.chaveDaVisao) {
      this.chaveDaVisao = chave;
      this.visaoSuja = true;
    }
    this.atualizarEstilos();
    this.atualizarBandeira();
    this.atualizarCursor();
    this.desenharParedes();
  }

  private chaveDe_visao(): string {
    return `${this.opcoes.visao.modo}|${JSON.stringify(this.opcoes.visao.fontes)}`;
  }

  /** Paredes da cena (o que a sala mandou para quem está olhando). */
  definirParedes(paredes: Parede[]): void {
    this.paredes = paredes;
    if (!this.pronto) return;
    this.visaoSuja = true;
    this.desenharParedes();
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

  /**
   * Vista inicial legível: 100% de zoom, centrada no grupo (média dos tokens de jogadores da cena)
   * ou, sem grupo, no centro da cena. "Centralizar" (botão do zoom) continua enquadrando a cena.
   */
  vistaInicial(): void {
    if (!this.pronto || !this.cena) return;
    const grupo = this.tokens.filter((t) => t.cenaId === this.cena?.id && this.opcoes.ehDoGrupo(t));
    const foco =
      grupo.length > 0
        ? {
            x: grupo.reduce((soma, t) => soma + t.x, 0) / grupo.length,
            y: grupo.reduce((soma, t) => soma + t.y, 0) / grupo.length,
          }
        : { x: this.cena.larguraM / 2, y: this.cena.alturaM / 2 };
    this.vista = {
      zoom: 1,
      x: this.largura() / 2 - foco.x * PX_POR_M,
      y: this.altura() / 2 - foco.y * PX_POR_M,
    };
    this.jaCentralizou = this.largura() > 0;
    this.aplicarVista();
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

  /** Ponto da página (clientX/clientY) em metros do mundo (para soltar um item das Fichas no mapa). */
  pontoDaPaginaEmMetros(clientX: number, clientY: number): Ponto {
    const r = this.app.canvas.getBoundingClientRect();
    return this.paraMundo({ x: clientX - r.left, y: clientY - r.top });
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
    this.escalarBandeira();
    this.desenharParedes();
  }

  private readonly aoRedimensionar = () => {
    if (!this.jaCentralizou) this.vistaInicial();
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

  quadradoM(): number {
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
    this.camadaDe(token).addChild(container);
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

  private camadaDe(token: Token): Container {
    if (token.camada === "mestre") return this.camadaMestre;
    return token.camada === "mapa" ? this.camadaCenario : this.camadaTokens;
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
        this.visibilidadeSuja = true;
      } else if (!v) {
        v = this.criarVisual(t, t.x, t.y);
        this.visuais.set(t.id, v);
        this.visaoSuja = true;
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
      this.visaoSuja = true;
    }
    this.visibilidadeSuja = true;
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
      const trabalho = this.opcoes.camadaTrabalho;
      if (t.oculto) alpha = 0.5;
      else if (t.camada === "mestre" && trabalho === "tokens") alpha = 0.45;
      else if (this.opcoes.euMestre && trabalho === "mapa" && t.camada !== "mapa") alpha = 0.6;
      v.container.alpha = alpha;
      v.anel.visible = this.opcoes.selecionadoId === t.id;
    }
  }

  /** Um quadro: anima os tokens e só redesenha se algo mudou. */
  private readonly laco = (agora: number) => {
    const dt = agora - this.ultimoQuadro;
    this.ultimoQuadro = agora;
    this.animar(dt);
    if (this.visaoSuja) this.recalcularVisao();
    else if (this.visibilidadeSuja) this.atualizarVisibilidadeDosTokens();
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
      // Quem enxerga andou: o polígono muda. Quem não enxerga andou: só a visibilidade dele.
      if (this.opcoes.visao.fontes.some((f) => f.tokenId === v.token.id)) this.visaoSuja = true;
      else this.visibilidadeSuja = true;
    }
  }

  // --- visão (só de tela) -----------------------------------------------------------------------

  /** Os polígonos de visão das fontes (a posição é a mostrada na tela) e o véu escuro. */
  private recalcularVisao(): void {
    this.visaoSuja = false;
    this.sujo = true;
    const cena = this.cena;
    const { modo, fontes } = this.opcoes.visao;
    this.poligonos = [];
    if (!cena || modo === "claro") {
      this.veu.visible = false;
      this.atualizarVisibilidadeDosTokens();
      return;
    }
    const segmentos = this.paredes
      .filter((p) => p.cenaId === cena.id && bloqueiaVisao(p))
      .map((p) => ({ a: p.a, b: p.b }));
    for (const f of fontes) {
      const v = this.visuais.get(f.tokenId);
      if (!v) continue;
      this.poligonos.push(poligonoDeVisibilidade({ x: v.x, y: v.y }, segmentos, cena, f.alcanceM));
    }
    this.desenharVeu(cena, modo);
    this.atualizarVisibilidadeDosTokens();
  }

  /** Desenha o véu na RenderTexture: cor cheia com um buraco (apagado) por polígono de visão. */
  private desenharVeu(cena: Cena, modo: "jogador" | "noturna"): void {
    const w = Math.ceil(cena.larguraM * PX_POR_M);
    const h = Math.ceil(cena.alturaM * PX_POR_M);
    if (!this.veuTextura || this.veuTamanho.w !== w || this.veuTamanho.h !== h) {
      this.veuTextura?.destroy(true);
      this.veuTextura = RenderTexture.create({
        width: w,
        height: h,
        resolution: Math.min(1, LADO_MAXIMO_DO_VEU / Math.max(w, h)),
        antialias: true,
      });
      this.veuTamanho = { w, h };
      this.veu.texture = this.veuTextura;
    }
    this.veu.position.set(0, 0);
    this.veu.width = w;
    this.veu.height = h;
    this.veuFundo
      .clear()
      .rect(0, 0, w, h)
      .fill(modo === "jogador" ? { color: 0x0d1015, alpha: 1 } : { color: 0x000000, alpha: 0.55 });
    this.veuBuracos.clear();
    for (const poligono of this.poligonos) {
      if (poligono.length < 3) continue;
      this.veuBuracos
        .poly(poligono.flatMap((q) => [q.x * PX_POR_M, q.y * PX_POR_M]))
        .fill(0xffffff);
    }
    this.app.renderer.render({ container: this.veuFonte, target: this.veuTextura, clear: true });
    this.veu.visible = true;
  }

  /** Para o jogador, token fora da união da visão não é desenhado (as fontes sempre aparecem). */
  private atualizarVisibilidadeDosTokens(): void {
    this.visibilidadeSuja = false;
    this.sujo = true;
    const { modo, fontes } = this.opcoes.visao;
    for (const v of this.visuais.values()) {
      const ehFonte = fontes.some((f) => f.tokenId === v.token.id);
      v.container.visible =
        modo !== "jogador" ||
        v.token.camada === "mapa" ||
        ehFonte ||
        pontoNaUniao({ x: v.x, y: v.y }, this.poligonos);
    }
  }

  // --- paredes e portas -------------------------------------------------------------------------

  private ferramentaDeParedes(): boolean {
    return this.opcoes.ferramenta === "paredes" && this.opcoes.modoMestre;
  }

  /** A parede com a ponta em arrasto aplicada (a visão local da edição, antes de a sala confirmar). */
  private comPontaArrastada(p: Parede): Parede {
    const a = this.pontaArrastada;
    if (!a || a.id !== p.id) return p;
    return a.ponta === "a" ? { ...p, a: a.pos } : { ...p, b: a.pos };
  }

  /** Ícone no meio da porta: sempre do mesmo tamanho na tela. Fechada, aberta ou trancada. */
  private desenharIcone(g: Graphics, parede: Parede, z: number): void {
    const meio = meioDaParede(parede);
    const cx = meio.x * PX_POR_M;
    const cy = meio.y * PX_POR_M;
    const r = RAIO_DO_ICONE / z;
    const estado = parede.estado ?? "fechada";
    const cor =
      parede.tipo === "secreta"
        ? 0xb388ff
        : estado === "trancada"
          ? 0xff6b5a
          : estado === "aberta"
            ? 0x6fcf97
            : 0xe0a030;
    g.circle(cx, cy, r)
      .fill({ color: 0x10141a, alpha: 0.92 })
      .stroke({ width: 2 / z, color: cor });
    const l = r * 0.42;
    if (estado === "aberta") {
      // porta aberta: só o contorno
      g.rect(cx - l, cy - l * 1.3, l * 2, l * 2.6).stroke({ width: 1.6 / z, color: cor });
    } else {
      g.rect(cx - l, cy - l * 1.3, l * 2, l * 2.6).fill(cor);
      if (estado === "trancada") g.circle(cx, cy, l * 0.35).fill(0x10141a);
    }
  }

  /**
   * Redesenha tudo o que é parede: as linhas (só o mestre), os ícones das portas (todos; o da secreta
   * só o mestre), a seleção com as alças e a sequência em desenho. Os tamanhos são em pixels da tela.
   */
  private desenharParedes(): void {
    this.sujo = true;
    const abaixo = this.paredesAbaixo.clear();
    const acima = this.paredesAcima.clear();
    const cena = this.cena;
    if (!cena) return;
    const z = this.vista.zoom;
    const mestre = this.opcoes.modoMestre;
    const ferramenta = this.ferramentaDeParedes();
    const g = mestre ? acima : abaixo;
    for (const original of this.paredes) {
      if (original.cenaId !== cena.id) continue;
      const parede = this.comPontaArrastada(original);
      const ehPorta = parede.tipo === "porta" || (mestre && parede.tipo === "secreta");
      const a = { x: parede.a.x * PX_POR_M, y: parede.a.y * PX_POR_M };
      const b = { x: parede.b.x * PX_POR_M, y: parede.b.y * PX_POR_M };
      if (mestre) {
        const estilo = ESTILO_DA_PAREDE[parede.tipo];
        if (ferramenta) {
          g.moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ width: estilo.largura / z, color: estilo.cor });
        } else {
          g.moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ width: 2 / z, color: 0xc9d1dc, alpha: 0.4 });
        }
      } else if (parede.tipo === "porta") {
        const cor = parede.estado === "aberta" ? 0x6fcf97 : 0xe0a030;
        g.moveTo(a.x, a.y)
          .lineTo(b.x, b.y)
          .stroke({ width: (parede.estado === "aberta" ? 2 : 4) / z, color: cor, alpha: 0.85 });
      }
      if (ehPorta) this.desenharIcone(g, parede, z);
    }
    if (!ferramenta) return;
    const sel = this.paredes.find((x) => x.id === this.opcoes.paredeSelecionadaId);
    if (sel && sel.cenaId === cena.id) {
      const parede = this.comPontaArrastada(sel);
      const a = { x: parede.a.x * PX_POR_M, y: parede.a.y * PX_POR_M };
      const b = { x: parede.b.x * PX_POR_M, y: parede.b.y * PX_POR_M };
      acima
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ width: 9 / z, color: ACENTO, alpha: 0.35 });
      for (const q of [a, b]) {
        acima
          .circle(q.x, q.y, RAIO_DA_ALCA / z)
          .fill(0xffffff)
          .stroke({ width: 2 / z, color: ACENTO });
      }
    }
    const pontos = this.desenhando;
    if (pontos && pontos.length > 0) {
      const cor = ESTILO_DA_PAREDE[this.opcoes.tipoDaNovaParede].cor;
      const todos = this.cursorDaParede ? [...pontos, this.cursorDaParede] : pontos;
      const [primeiro, ...resto] = todos;
      if (primeiro) {
        acima.moveTo(primeiro.x * PX_POR_M, primeiro.y * PX_POR_M);
        for (const q of resto) acima.lineTo(q.x * PX_POR_M, q.y * PX_POR_M);
        acima.stroke({ width: 4 / z, color: cor, alpha: 0.85 });
      }
      for (const q of pontos) acima.circle(q.x * PX_POR_M, q.y * PX_POR_M, 4 / z).fill(cor);
    }
  }

  /**
   * O jogador só vê (e só clica) a porta que está na sua visão. O meio da porta fica na borda do
   * polígono, então vale olhar um pouco para cada lado dela.
   */
  private portaVisivel(parede: Parede): boolean {
    if (this.opcoes.visao.modo !== "jogador") return true;
    const meio = meioDaParede(parede);
    const dx = parede.b.x - parede.a.x;
    const dy = parede.b.y - parede.a.y;
    const n = Math.hypot(dx, dy) || 1;
    const nx = (-dy / n) * 0.15;
    const ny = (dx / n) * 0.15;
    return (
      pontoNaUniao({ x: meio.x + nx, y: meio.y + ny }, this.poligonos) ||
      pontoNaUniao({ x: meio.x - nx, y: meio.y - ny }, this.poligonos)
    );
  }

  /** A porta (ou, para o mestre, a secreta) cujo ícone está sob o ponto da tela. */
  private portaEm(p: Ponto): Parede | null {
    const cena = this.cena;
    if (!cena) return null;
    let achada: Parede | null = null;
    let melhor = RAIO_DO_ICONE + 3;
    for (const parede of this.paredes) {
      if (parede.cenaId !== cena.id) continue;
      if (parede.tipo !== "porta" && !(this.opcoes.modoMestre && parede.tipo === "secreta"))
        continue;
      if (!this.portaVisivel(parede)) continue;
      const meio = meioDaParede(parede);
      const t = this.paraTela(meio.x, meio.y);
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d <= melhor) {
        melhor = d;
        achada = parede;
      }
    }
    return achada;
  }

  /** A parede cujo corpo está sob o ponto da tela (as pontas ficam livres para começar outra). */
  private paredeEm(p: Ponto): Parede | null {
    const cena = this.cena;
    if (!cena) return null;
    let achada: Parede | null = null;
    let melhor = 8;
    for (const parede of this.paredes) {
      if (parede.cenaId !== cena.id) continue;
      const a = this.paraTela(parede.a.x, parede.a.y);
      const b = this.paraTela(parede.b.x, parede.b.y);
      if (Math.hypot(p.x - a.x, p.y - a.y) < 10 || Math.hypot(p.x - b.x, p.y - b.y) < 10) continue;
      const d = distanciaAoSegmento(p, a, b);
      if (d <= melhor) {
        melhor = d;
        achada = parede;
      }
    }
    return achada;
  }

  /** Ponto do mundo para a parede: encaixa nos cantos do grid (Alt solta). */
  private pontoDaParede(m: Ponto, alt: boolean): Ponto {
    const ponto = this.encaixaAgora(alt) ? encaixarNoGrid(m, 2, this.quadradoM()) : m;
    return this.cena ? limitarNaCena(ponto, this.cena) : ponto;
  }

  /** Clique com a ferramenta de paredes: continua a sequência, arrasta uma ponta, seleciona ou começa. */
  private apertarComParedes(p: Ponto, e: PointerEvent): void {
    const ponto = this.pontoDaParede(this.paraMundo(p), e.altKey);
    if (this.desenhando) {
      const ultimo = this.desenhando[this.desenhando.length - 1];
      if (!ultimo || Math.hypot(ultimo.x - ponto.x, ultimo.y - ponto.y) > 0.05) {
        this.desenhando.push(ponto);
      }
      this.cursorDaParede = ponto;
      this.desenharParedes();
      return;
    }
    const sel = this.paredes.find((x) => x.id === this.opcoes.paredeSelecionadaId);
    if (sel) {
      for (const ponta of ["a", "b"] as const) {
        const t = this.paraTela(sel[ponta].x, sel[ponta].y);
        if (Math.hypot(p.x - t.x, p.y - t.y) <= RAIO_DA_ALCA + 5) {
          this.gesto = { tipo: "ponta", id: sel.id, ponta };
          this.pontaArrastada = { id: sel.id, ponta, pos: sel[ponta] };
          this.app.canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    }
    const alvo = this.paredeEm(p);
    if (alvo) {
      this.retornos().selecionarParede(alvo.id);
      return;
    }
    this.retornos().selecionarParede(null);
    this.desenhando = [ponto];
    this.cursorDaParede = ponto;
    this.desenharParedes();
  }

  /** Esc ou duplo clique: a sequência vira paredes (com menos de dois pontos não vira nada). */
  private encerrarDesenho(): void {
    const pontos = this.desenhando;
    this.desenhando = null;
    this.cursorDaParede = null;
    if (pontos && pontos.length >= 2 && this.cena) {
      const segmentos = pontos.slice(1).map((b, i) => ({ a: pontos[i] as Ponto, b }));
      this.retornos().criarParedes(this.cena.id, segmentos, this.opcoes.tipoDaNovaParede);
    }
    this.desenharParedes();
  }

  private readonly aoDuploClique = () => {
    if (this.desenhando) this.encerrarDesenho();
  };

  // --- bandeira do ponto de chegada -------------------------------------------------------------

  private desenharBandeira(): void {
    const g = new Graphics();
    g.moveTo(0, 0).lineTo(0, -30).stroke({ width: 3, color: 0xffffff });
    g.poly([0, -30, 22, -23, 0, -16]).fill(ACENTO).stroke({ width: 1.5, color: 0x1a1204 });
    g.circle(0, 0, 3.5).fill(0xffffff);
    this.bandeira.addChild(g);
    this.bandeira.visible = false;
  }

  /** O ponto de chegada da cena que o mestre vê (só ele vê a bandeira). */
  private atualizarBandeira(posicao?: Ponto): void {
    this.sujo = true;
    const cena = this.cena;
    const visivel = cena !== null && this.opcoes.euMestre;
    this.bandeira.visible = visivel;
    if (!cena || !visivel) {
      this.posicaoDaBandeira = null;
      return;
    }
    if (posicao === undefined && this.gesto?.tipo === "bandeira") return;
    const p = posicao ?? chegadaDaCena(cena);
    this.posicaoDaBandeira = p;
    this.bandeira.position.set(p.x * PX_POR_M, p.y * PX_POR_M);
    this.escalarBandeira();
  }

  /** A bandeira tem sempre o mesmo tamanho na tela, qualquer que seja o zoom. */
  private escalarBandeira(): void {
    this.sujo = true;
    this.bandeira.scale.set(1 / this.vista.zoom);
  }

  private sobreABandeira(p: Ponto): boolean {
    const b = this.posicaoDaBandeira;
    if (!b || !this.opcoes.euMestre || this.opcoes.ferramenta !== "selecionar") return false;
    const t = this.paraTela(b.x, b.y);
    return p.x >= t.x - 10 && p.x <= t.x + 28 && p.y >= t.y - 36 && p.y <= t.y + 8;
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

  /** O token (selecionável) sob o ponto. Cenário e camadas que não são minhas ficam transparentes ao clique. */
  private tokenEm(p: Ponto): Visual | null {
    const m = this.paraMundo(p);
    const minimo = 12 / (this.vista.zoom * PX_POR_M); // alvo mínimo de 12 px na tela
    let achado: Visual | null = null;
    // De baixo para cima: mapa, tokens, mestre; dentro de cada camada vale o último desenhado.
    const peso = (v: Visual) =>
      v.token.camada === "mestre" ? 2 : v.token.camada === "mapa" ? 0 : 1;
    const ordem = [...this.visuais.values()]
      .filter((v) => v.container.visible && this.selecionavel(v.token))
      .sort((a, b) => peso(a) - peso(b));
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
    if (e.button === 2) {
      // Clique direito no ícone da porta (mestre): tranca ou destranca.
      const porta = this.opcoes.modoMestre ? this.portaEm(p) : null;
      if (porta) this.retornos().trancarPorta(porta.id);
      return;
    }
    if (e.button !== 0 || !this.cena) return;

    if (this.ferramentaDeParedes()) {
      const porta = this.desenhando ? null : this.portaEm(p);
      if (porta) this.retornos().selecionarParede(porta.id);
      else this.apertarComParedes(p, e);
      return;
    }

    if (this.opcoes.ferramenta === "regua") {
      const a = this.pontoDaRegua(this.paraMundo(p), e.altKey);
      this.reguaAtual = { a, b: a };
      this.gesto = { tipo: "regua" };
      this.app.canvas.setPointerCapture(e.pointerId);
      this.desenharRegua();
      return;
    }

    const porta = this.portaEm(p);
    if (porta) {
      this.retornos().alternarPorta(porta.id);
      return;
    }

    if (this.sobreABandeira(p) && this.cena) {
      const m = this.paraMundo(p);
      const b = this.posicaoDaBandeira as Ponto;
      this.gesto = { tipo: "bandeira", deslocamento: { x: b.x - m.x, y: b.y - m.y } };
      this.app.canvas.setPointerCapture(e.pointerId);
      this.atualizarCursor();
      return;
    }

    const v = this.tokenEm(p);
    if (!v) {
      this.retornos().selecionar(null);
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
      if (this.ferramentaDeParedes() && this.desenhando) {
        this.cursorDaParede = this.pontoDaParede(this.paraMundo(p), e.altKey);
        this.desenharParedes();
      }
      this.atualizarCursor(this.tokenEm(p), this.sobreABandeira(p));
      return;
    }
    if (g.tipo === "ponta") {
      const sel = this.pontaArrastada;
      if (sel) {
        sel.pos = this.pontoDaParede(this.paraMundo(p), e.altKey);
        this.desenharParedes();
      }
      return;
    }
    if (g.tipo === "pan") {
      this.vista.x = g.vistaInicial.x + (p.x - g.inicio.x);
      this.vista.y = g.vistaInicial.y + (p.y - g.inicio.y);
      this.aplicarVista();
      return;
    }
    if (g.tipo === "bandeira") {
      if (!this.cena) return;
      const m = this.paraMundo(p);
      const q = this.quadradoM();
      const alvo = limitarNaCena(
        this.encaixaAgora(e.altKey)
          ? encaixarNoGrid({ x: m.x + g.deslocamento.x, y: m.y + g.deslocamento.y }, 1, q)
          : { x: m.x + g.deslocamento.x, y: m.y + g.deslocamento.y },
        this.cena,
      );
      this.posicaoDaBandeira = alvo;
      this.atualizarBandeira(alvo);
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
    // O jogador não atravessa parede, porta fechada, janela nem parede invisível: o token fica onde
    // ainda podia estar (a sala confere de novo ao soltar; o mestre ignora).
    if (
      !this.opcoes.euMestre &&
      trajetoBloqueado(
        g.origem,
        alvo,
        this.paredes.filter((q) => q.cenaId === this.cena?.id),
      )
    ) {
      return;
    }
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
    if (g.tipo === "bandeira") {
      const b = this.posicaoDaBandeira;
      if (b && this.cena) this.retornos().chegada(this.cena.id, b.x, b.y);
    }
    if (g.tipo === "ponta") {
      const arrasto = this.pontaArrastada;
      if (arrasto) this.retornos().moverPonta(arrasto.id, arrasto.ponta, arrasto.pos);
      // A ponta fica onde foi solta até a sala confirmar (o evento chega em seguida).
      return this.liberarPonta();
    }
    if (g.tipo === "token") {
      // O soltar sai na hora, fora do limitador; o movimento pendente deixa de importar.
      g.limitador.cancelar();
      const v = this.visuais.get(g.id);
      if (g.moveu && v) this.retornos().soltar(g.id, v.alvoX, v.alvoY);
    }
    this.atualizarCursor();
  };

  /** A sala confirma a edição pelo estado; um instante depois a ponta passa a vir de lá. */
  private liberarPonta(): void {
    setTimeout(() => {
      this.pontaArrastada = null;
      if (this.pronto) this.desenharParedes();
    }, 400);
    this.atualizarCursor();
  }

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
    if (e.key === "Escape") {
      this.limparRegua();
      if (this.desenhando) this.encerrarDesenho();
      else if (this.ferramentaDeParedes() && this.opcoes.paredeSelecionadaId) {
        this.retornos().selecionarParede(null);
      }
    }
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      this.ferramentaDeParedes() &&
      this.opcoes.paredeSelecionadaId
    ) {
      e.preventDefault();
      this.retornos().apagarParede(this.opcoes.paredeSelecionadaId);
    }
  };

  private readonly aoTeclaCima = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.espaco = false;
      this.atualizarCursor();
    }
  };

  private atualizarCursor(sobre: Visual | null = null, sobreBandeira = false): void {
    if (!this.pronto) return;
    const g = this.gesto;
    let cursor = "default";
    if (g?.tipo === "pan" || g?.tipo === "bandeira") cursor = "grabbing";
    else if (this.espaco || this.opcoes.ferramenta === "mao") cursor = "grab";
    else if (sobreBandeira && this.opcoes.ferramenta === "selecionar") cursor = "grab";
    else if (this.opcoes.ferramenta === "regua" || this.ferramentaDeParedes()) cursor = "crosshair";
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
          /** Está sendo desenhado (o jogador não desenha o que está fora da visão). */
          desenhado: v.container.visible,
        })),
      /** As portas que a tela mostra (ícone), com o meio em metros. */
      portas: () =>
        this.paredes
          .filter(
            (q) =>
              q.cenaId === this.cena?.id &&
              (q.tipo === "porta" || (this.opcoes.modoMestre && q.tipo === "secreta")),
          )
          .map((q) => ({ id: q.id, tipo: q.tipo, estado: q.estado, meio: meioDaParede(q) })),
      /** Quantas paredes a tela tem (o que a sala mandou para quem olha). */
      paredes: () => this.paredes.map((q) => ({ id: q.id, tipo: q.tipo, estado: q.estado })),
      /** A visão: modo, fontes e quantos polígonos; e se um ponto (metros) está dentro da união. */
      visao: () => ({ modo: this.opcoes.visao.modo, poligonos: this.poligonos.length }),
      veNoPonto: (x: number, y: number) =>
        this.opcoes.visao.modo === "claro" || pontoNaUniao({ x, y }, this.poligonos),
      veuVisivel: () => this.veu.visible,
      /** Pontos da sequência de paredes em desenho. */
      desenhando: () => this.desenhando?.length ?? 0,
      /** Metros do mundo -> pixels CSS da página (para o `page.mouse`). */
      paraTela: (xM: number, yM: number) => {
        const r = this.app.canvas.getBoundingClientRect();
        const p = this.paraTela(xM, yM);
        return { x: r.left + p.x, y: r.top + p.y };
      },
      zoom: () => this.vista.zoom,
      /** Ponto de chegada mostrado pela bandeira (só no mestre). */
      bandeira: () => this.posicaoDaBandeira,
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
