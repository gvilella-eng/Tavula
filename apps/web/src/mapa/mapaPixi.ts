import {
  type AssetMeta,
  areaDaBandeira,
  arredondarPonto,
  bloqueiaVisao,
  CacheDeLuz,
  CELULA_DA_MEMORIA_M,
  type Cena,
  calcularModelo,
  chegadaDaCena,
  contarLembradas,
  corEmCanais,
  criarGrade,
  criarLimitador,
  type Desenho,
  type DesenhoEmAndamento,
  type DesenhoNovo,
  dentroDoAlcance,
  desenhoTocadoEm,
  deslocamentoNaCena,
  encaixarMeiaCelula,
  encaixarNoGrid,
  esquecerAlemDoAlcance,
  esquecerTudo,
  type FonteDeLuz,
  formatarRestante,
  type GradeDeMemoria,
  gradeServe,
  type IconeDeCondicao,
  iconesDoToken,
  imagemDaMemoria,
  lembraDoPonto,
  limitarNaCena,
  luzAmbienteDa,
  type Medida,
  type ModeloDeLuz,
  marcarVisto,
  medirRegua,
  meioDaParede,
  meioDoArcoTangente,
  nivelDeLuz,
  opacidadeNoPonto,
  type Parede,
  type PontoDeLuz,
  pontosDaParede,
  prepararTraco,
  resolverLuzes,
  SEGURAR_PADRAO_S,
  segmentosDaParede,
  suavizar,
  type TipoDeParede,
  type Token,
  tangenteNoFim,
  trajetoBloqueado,
  veNoPonto,
  visaoNoPonto,
} from "@tabletop/shared";
import "pixi.js/advanced-blend-modes";
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import type { CamadaDeTrabalho } from "../camadas";
import { corDoTextoSobre, haloDoTexto } from "../contrasteDeCor";
import type { ConfigDoPincel } from "../pincel";
import { CamadaDeDesenho, type DesenhoNaTela } from "./camadaDeDesenho";
import { CamadaDeLuz } from "./camadaDeLuz";
import {
  ArmazemDeMemoria,
  chaveAntigaDaMemoria,
  chaveDaMemoria,
  type RegistroDeMemoria,
} from "./memoriaLocal";

/** Pixels do mundo por metro (zoom 1). O zoom é a escala do `mundo` sobre isso. */
export const PX_POR_M = 40;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
/** Constante de tempo da interpolação dos tokens movidos por outros (os envios chegam a cada 50 ms). */
const TAU_MS = 70;
const ACENTO = 0xe0a030;
/** Anel do token da vez (ordem de turno): verde, bem diferente do dourado da seleção. */
const COR_DA_VEZ = 0x4cd97b;

export type Ferramenta = "selecionar" | "mao" | "regua" | "paredes" | "luz" | "ponto" | "pincel";

/** A alça de uma tocha sendo arrastada: onde está (metros) e, sobre um inflamável, a contagem. */
type AlcaArrastada = {
  luzId: string;
  pos: Ponto;
  segurando: { pontoId: string; desde: number; fimEnviado: boolean } | null;
};

/** O que está sob a tocha arrastada. */
type AlvoDaAlca =
  | { tipo: "token"; tokenId: string }
  | { tipo: "suporte" | "inflamavel"; ponto: PontoDeLuz };

/** A alça (ou o ícone no ponto) de um objeto de luz: um pequeno desenho do mesmo tamanho na tela. */
type AlcaVisual = {
  luzId: string;
  container: Container;
  corpo: Graphics;
  rotulo: Text;
  chave: string;
};

/**
 * Quem enxerga: o token, o alcance de visão (`null` = sem limite), a visão no escuro e até onde ele se
 * lembra do mapa (m). A posição vem do próprio mapa.
 */
export type FonteDeVisao = {
  tokenId: string;
  alcanceM: number | null;
  visaoNoEscuroM: number;
  memoriaM: number;
};

/**
 * Como a tela mostra a visão e a luz (só de tela, nunca vai para a sala):
 * - `jogador`: só aparece o que a luz alcança dentro da visão dos tokens dele (ou da visão no escuro);
 *   o resto é a memória do mapa ou preto; os tokens de lá não são desenhados;
 * - `noturna` (mestre): o que algum jogador vê fica normal e o resto, apagado;
 * - `claro`: tudo claro.
 */
export type ConfigDeVisao = {
  modo: "jogador" | "noturna" | "claro";
  fontes: FonteDeVisao[];
  /** Memória do mapa (jogador): ligada, o tom, de quem é e o último "esquecer" do mestre. */
  memoria: {
    ligada: boolean;
    tom: string;
    usuarioId: string;
    esquecimento: number;
    /** A mesa a que a memória pertence (entra na chave) e se é a legada (herda a chave de antes do C2). */
    mesaId: string;
    legada: boolean;
  };
};

/** Tamanho (em pixels da tela) dos ícones das portas e das alças das pontas. */
const RAIO_DO_ICONE = 11;
const RAIO_DA_ALCA = 6;
/** Intervalo mínimo (ms) entre duas marcações da memória do mapa (a conta é por célula). */
const INTERVALO_DA_MEMORIA_MS = 120;
/** Intervalo (ms) em que a luz que tremula é redesenhada. */
const INTERVALO_DA_TREMULA_MS = 90;
/** Quanto a memória espera, parada, antes de gravar no IndexedDB. */
const ATRASO_DA_GRAVACAO_MS = 500;
const COR_DA_LUZ = 0xffd27a;

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
  /** O jogador seleciona (só na tela dele) os tokens que controla (V2); o mestre seleciona qualquer um. */
  controla: (token: Token) => boolean;
  /** O mestre vendo como mestre (não "como o jogador X"): vê todas as paredes e as portas secretas. */
  modoMestre: boolean;
  paredeSelecionadaId: string | null;
  /** Tipo das paredes que a ferramenta de paredes desenha. */
  tipoDaNovaParede: TipoDeParede;
  /**
   * V5: desenha os contornos de parede, janela e porta (e os ícones das portas) fora da ferramenta de
   * paredes: o mestre com a "Visão do mestre" ligada, ou o jogador numa cena com a opção. Só desenho: a
   * visão, a luz e o bloqueio não dependem disso.
   */
  contornos: boolean;
  visao: ConfigDeVisao;
  /** O painel das fontes de luz está aberto: o mestre vê, arrasta e seleciona as luzes no mapa. */
  mostrarLuzes: boolean;
  /**
   * A bandeira do ponto de chegada: o mestre a vê com a faixa de Cenas aberta (V10); o jogador (V10b), quando não
   * tem token dele na cena e pode pôr o próprio. Só o mestre a arrasta.
   */
  mostrarBandeira: boolean;
  /** V10b: a ficha de um personagem está sendo arrastada pelo jogador: a área da bandeira se acende. */
  acenderAreaDaBandeira: boolean;
  luzSelecionadaId: string | null;
  /** O ponto que o mestre está editando e o tipo que a ferramenta "ponto" cria. */
  pontoSelecionadoId: string | null;
  tipoDoNovoPonto: "suporte" | "inflamavel";
  /** Alcance de interação (m): só para mostrar o círculo do ponto; quem confere é a sala. */
  alcanceInteracaoM: number;
  /** Tempo restante (ms) do objeto, já animado entre os envios; `undefined` quando este usuário não o vê. */
  restanteDe: (luzId: string) => number | undefined;
  /** Pode arrastar, apagar e guardar esta tocha (dono do personagem ou mestre)? */
  podeMexerNaTocha: (luz: FonteDeLuz) => boolean;
  /** Token da entrada que está na vez (anel destacado, para todos que veem o token). */
  tokenDaVezId: string | null;
  /** O pincel (Lote 13): o que ele faz agora, quem sou eu, se posso desenhar e o desenho selecionado. */
  pincel: ConfigDoPincel;
  podeDesenhar: boolean;
  usuarioId: string;
  desenhoSelecionadoId: string | null;
  /**
   * Modo "clique no mapa para pôr o token" (R5a): o token que vai nascer (nome, cor e tamanho). Com ele,
   * uma prévia segue o cursor e o próximo clique chama `colocarToken`.
   */
  tokenParaPor: { nome: string; cor: string; tamanhoQuadrados: number } | null;
};

/** O que o mapa precisa saber das imagens locais (o gerente de assets responde). */
export type ImagensDoMapa = {
  meta(hash: string): AssetMeta | undefined;
  /** O arquivo (ou, no mapa fatiado, todos os tiles) já está no cache local? */
  pronto(hash: string): boolean;
  blob(hash: string): Promise<Blob | null>;
};

/** A medida em andamento (ou solta, esperando o "fixar") e onde o rótulo fica (px do mapa). */
export type MedicaoNaTela = { medida: Medida; x: number; y: number; solta: boolean };

/** Uma medida fixada na tela (só de quem mediu), com o rótulo. */
export type MedicaoFixa = { id: number; medida: Medida; x: number; y: number };

export type RetornosDoMapa = {
  mover: (id: string, x: number, y: number) => void;
  soltar: (id: string, x: number, y: number) => void;
  /** O mestre arrastou a bandeira do ponto de chegada (da cena que ele está vendo). */
  chegada: (cenaId: string, x: number, y: number) => void;
  selecionar: (id: string | null) => void;
  zoom: (zoom: number) => void;
  medir: (medicao: MedicaoNaTela | null) => void;
  /** As medidas fixadas (a lista inteira, a cada mudança de medida ou de vista). */
  reguasFixas: (medidas: MedicaoFixa[]) => void;
  /** Modo "pôr token": clicou no mapa; o token nasce ali (metros, já encaixado). */
  colocarToken: (x: number, y: number) => void;
  /** Dois cliques num token (ferramenta de seleção): abre o painel dele (só o mestre). */
  editarToken: (tokenId: string) => void;
  /** Clique num marcador de condição: abre a regra (popover) na posição da página. */
  abrirRegra: (regra: DicaDoMapa) => void;
  /** Uma sequência desenhada vira paredes (numa mensagem só). */
  criarParedes: (
    cenaId: string,
    segmentos: { a: Ponto; b: Ponto; meio?: Ponto }[],
    tipo: TipoDeParede,
  ) => void;
  /** V5: a tecla A trocou linha e arco na ferramenta de paredes (para o painel mostrar). */
  modoDeArco: (arco: boolean) => void;
  /** Arrastou uma ponta da parede. */
  moverPonta: (id: string, ponta: "a" | "b", ponto: Ponto) => void;
  selecionarParede: (id: string | null) => void;
  apagarParede: (id: string) => void;
  /** Clique no ícone da porta. */
  alternarPorta: (id: string) => void;
  /** Clique direito no ícone da porta (só o mestre): tranca ou destranca. */
  trancarPorta: (id: string) => void;
  /** A ferramenta de luz clicou no mapa: põe uma luz fixa ali. */
  colocarLuz: (cenaId: string, x: number, y: number) => void;
  /** O mestre soltou uma luz fixa em outro ponto. */
  moverLuz: (id: string, x: number, y: number) => void;
  selecionarLuz: (id: string | null) => void;
  /** A ferramenta de ponto clicou no mapa: cria um suporte ou inflamável ali. */
  colocarPonto: (cenaId: string, tipo: "suporte" | "inflamavel", x: number, y: number) => void;
  moverPonto: (id: string, x: number, y: number) => void;
  selecionarPonto: (id: string | null) => void;
  /** A alça da tocha foi solta sobre outro token (entregar) ou sobre um suporte (pôr). */
  entregarTocha: (luzId: string, tokenId: string) => void;
  posarTocha: (luzId: string, pontoId: string) => void;
  /** Dois cliques na alça (ou no ícone do ponto aceso): apaga ou reacende. */
  alternarTocha: (luzId: string) => void;
  /** Começou (e terminou) a segurar a tocha acesa sobre um ponto inflamável. */
  acenderPontoInicio: (pontoId: string, luzId: string) => void;
  acenderPontoFim: (pontoId: string, luzId: string) => void;
  /** Clique direito numa alça: o menu da tocha, na posição da página. */
  menuDaTocha: (luzId: string, x: number, y: number) => void;
  /** Clique direito num token (ferramenta de seleção): o menu do token, na posição da página. */
  menuDoToken: (tokenId: string, x: number, y: number) => void;
  /** O ponteiro está sobre um marcador de condição (ou saiu dele: `null`): a dica, na posição da página. */
  dica: (dica: DicaDoMapa | null) => void;
  /** Pincel: soltou o traço (grava), arrastou um desenho, apagou (borracha ou Delete), selecionou. */
  criarDesenho: (desenho: DesenhoNovo) => void;
  moverDesenho: (id: string, dx: number, dy: number) => void;
  apagarDesenhos: (ids: string[]) => void;
  selecionarDesenho: (id: string | null) => void;
  /** O traço em andamento (a cada ~80 ms); `null`: cancelou. */
  rascunhoDeDesenho: (id: string, desenho: DesenhoEmAndamento | null) => void;
};

/** A dica de um marcador de condição, exaustão ou concentração. */
export type DicaDoMapa = {
  titulo: string;
  texto: string;
  x: number;
  y: number;
  /** `condicao` (marcador no token), `tocha` (alça da luz) ou `bandeira` (ponto de chegada). */
  tipo: "condicao" | "tocha" | "bandeira";
};

type Ponto = { x: number; y: number };

type Visual = {
  token: Token;
  chave: string;
  container: Container;
  anel: Graphics;
  /** Anel da vez (ordem de turno). */
  anelVez: Graphics;
  /** Marcadores de condição desenhados na borda (posição em px do mundo, relativa ao centro). */
  marcas: MarcaVisual[];
  /** A imagem do token já apareceu (senão vale o círculo gerado). */
  temImagem: boolean;
  x: number;
  y: number;
  alvoX: number;
  alvoY: number;
};

type MarcaVisual = { ox: number; oy: number; r: number; titulo: string; texto: string };

/** Até quantos marcadores cabem na borda; o resto vira um "+N". */
const MARCAS_VISIVEIS = 6;
/** Raio do marcador (px do mundo) e a letra dele; maiores desde o R5a para ler e clicar. */
const RAIO_DA_MARCA = 13;
const LETRA_DA_MARCA = 12;
/** Distância mínima (px do mundo) entre os centros de dois marcadores vizinhos. */
const DISTANCIA_ENTRE_MARCAS = 19;
/** A alça da tocha (R5a): raio do círculo, letra do tempo e onde o tempo começa, abaixo do centro. */
const RAIO_DA_ALCA_TOCHA = 20;
const LETRA_DO_TEMPO = 15;
/** A dica da alça da tocha (o que ela faz). */
const DICA_DA_BANDEIRA =
  'Os tokens do grupo aparecem aqui quando você usa "Levar grupo" para esta cena. Arraste para mudar.';
/** V10b: a dica da bandeira para o jogador. */
const DICA_DA_BANDEIRA_DO_JOGADOR = 'Arraste a sua ficha para cá ou use "Colocar no mapa".';
const DICA_DA_TOCHA = "Dois cliques: apagar ou acender · Botão direito: mais ações";

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
  | { tipo: "luz"; id: string; deslocamento: Ponto }
  | { tipo: "ponto"; id: string; deslocamento: Ponto }
  | { tipo: "alca"; luzId: string }
  | { tipo: "regua" }
  | {
      tipo: "traco";
      id: string;
      /** Livre: o traço inteiro; as outras formas: só o início e o ponto de agora. */
      pontos: Ponto[];
      limitador: ReturnType<typeof criarLimitador<undefined>>;
    }
  | { tipo: "desenhoMover"; id: string; inicio: Ponto }
  | { tipo: "borracha" };

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
  private dicaAberta = false;
  private readonly camadaMestre = new Container();
  /** Luz e escuridão (texturas do tamanho da cena): acima dos tokens, abaixo das paredes do mestre. */
  private camada!: CamadaDeLuz;
  /** Os polígonos de visão e de luz da cena como estão agora (`null`: tudo claro). */
  private modelo: ModeloDeLuz | null = null;
  private luzes: FonteDeLuz[] = [];
  private readonly cacheDeLuz = new CacheDeLuz();
  /** Luz fixa que o mestre está arrastando (a posição ao vivo, antes de a sala confirmar). */
  private luzArrastada: { id: string; pos: Ponto } | null = null;
  /** Marcas das luzes (só o mestre, com o painel de fontes aberto). */
  private readonly marcasDeLuz = new Graphics();
  /** Pontos de luz (suportes e inflamáveis) e o anel de "segurar para acender". */
  private readonly desenhoDosPontos = new Graphics();
  private chaveDosPontos = "";
  private pontos: PontoDeLuz[] = [];
  /** Ponto que o mestre está arrastando (a posição ao vivo, antes de a sala confirmar). */
  private pontoArrastado: { id: string; pos: Ponto } | null = null;
  /** Alças das tochas e ícones dos objetos nos pontos: acima do véu de luz (sempre à vista). */
  private readonly camadaDeAlcas = new Container();
  private readonly alcas = new Map<string, AlcaVisual>();
  private alcaArrastada: AlcaArrastada | null = null;
  // Memória do mapa (só de tela; IndexedDB por usuário e cena).
  private readonly armazem = new ArmazemDeMemoria();
  private gradeDaMemoria: GradeDeMemoria | null = null;
  private gradeCenaId: string | null = null;
  private gradeCarregando: string | null = null;
  private esquecimentoAplicado = 0;
  private memoriaPendente = false;
  private memoriaSuja = false;
  private ultimaMarcacao = 0;
  private ultimaTremula = 0;
  private gravacao: ReturnType<typeof setTimeout> | null = null;
  private gravando = 0;
  /** Portas que o jogador vê: abaixo do véu (só aparecem onde ele enxerga). */
  private readonly paredesAbaixo = new Graphics();
  /** Paredes, portas e a ferramenta do mestre: acima do véu. */
  private readonly paredesAcima = new Graphics();
  private paredes: Parede[] = [];
  private visaoSuja = true;
  private visibilidadeSuja = true;
  private chaveDaVisao = "";
  /** Pontos já clicados da sequência de paredes em desenho. */
  private desenhando: Ponto[] | null = null;
  /** V5: o ponto do arco de cada trecho já fechado da sequência (`undefined`: trecho reto). */
  private meiosDoDesenho: (Ponto | undefined)[] = [];
  /** V5: tecla A: o próximo trecho é um arco. */
  private modoArco = false;
  /** V5: arco de 3 pontos em andamento: a ponta final já clicada, falta a curvatura. */
  private fimDoArco3: Ponto | null = null;
  /** V5: a porta sob o cursor (destaque e mão mesmo com os contornos escondidos). */
  private portaSob: string | null = null;
  /** V5: o último ponto da parede foi encaixado (o Alt inverte); decide se os pontos de fixação aparecem. */
  private encaixaPonteiro = true;
  private cursorDaParede: Ponto | null = null;
  private pontaArrastada: { id: string; ponta: "a" | "b"; pos: Ponto } | null = null;
  private readonly desenhoDaRegua = new Graphics();
  private readonly desenhoDasFixas = new Graphics();
  /** Desenhos do pincel (Lote 13): acima do véu da luz e da memória do mapa (visíveis no escuro). */
  private readonly desenhoLayer = new CamadaDeDesenho();
  private desenhos: Desenho[] = [];
  /** Traços em andamento de outras pessoas, por id do desenho. */
  private readonly rascunhosAlheios = new Map<string, Desenho>();
  /** Meu desenho já enviado e ainda não confirmado pela sala (some quando o evento chega). */
  private readonly pendentes = new Map<string, Desenho>();
  /** Desenhos que a borracha já tocou: somem na hora, antes de a sala confirmar. */
  private readonly apagadosLocais = new Set<string>();
  /** O desenho arrastado (deslocamento ao vivo, antes de a sala confirmar). */
  private desenhoMovido: { id: string; dx: number; dy: number; chave: string } | null = null;
  private zoomDosDesenhos = 0;
  /** Ids que a borracha tocou neste arrasto (o pedido sai ao soltar). */
  private readonly apagadosPelaBorracha = new Set<string>();
  /** Bandeira do ponto de chegada do grupo (só o mestre a vê e arrasta). */
  private readonly bandeira = new Container();
  private posicaoDaBandeira: Ponto | null = null;
  /** V10b: a área em volta da bandeira, acesa enquanto o jogador arrasta a ficha. */
  private readonly areaDaBandeira = new Graphics();
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
  /** A medida atual já foi solta (o botão "fixar" do rótulo aparece). */
  private reguaSolta = false;
  /** Medidas fixadas na tela (só de quem mediu): somem com Esc, com um clique nelas ou ao trocar de ferramenta. */
  private reguasFixadas: { id: number; a: Ponto; b: Ponto }[] = [];
  private proximaReguaFixa = 1;
  private fixasAvisadas = false;
  /** Prévia do token do modo "pôr token" e onde o ponteiro está no mapa (para ela seguir o cursor). */
  private readonly previaDoToken = new Container();
  private chaveDaPrevia = "";
  private ponteiroNoMapa: { p: Ponto; alt: boolean } | null = null;
  private jaCentralizou = false;
  /** O tamanho da área do mapa na última vez que a vista foi acertada (para manter o centro ao redimensionar). */
  private telaAntes = { largura: 0, altura: 0 };
  private sujo = true;
  private quadro = 0;
  private observador: ResizeObserver | null = null;
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
      // Os modos de mistura avançados (o cinza da visão no escuro) leem o que já foi desenhado.
      useBackBuffer: true,
      autoStart: false, // o desenho é sob demanda (ver `laco`): várias abas abertas não fritam a CPU
    });
    if (this.destruido) {
      this.app.destroy({ removeView: true }, { children: true });
      return;
    }
    this.host.append(this.app.canvas);
    this.camada = new CamadaDeLuz(this.app.renderer);
    this.mundo.addChild(
      this.fundo,
      this.camadaMapa,
      this.grade,
      this.camadaCenario,
      this.camadaTokens,
      this.camadaMestre,
      this.camada.multiplicar,
      this.camada.brilho,
      this.camada.cinza,
      this.paredesAbaixo,
      this.paredesAcima,
      this.desenhoLayer.container,
      this.marcasDeLuz,
      this.desenhoDosPontos,
      this.camadaDeAlcas,
      this.areaDaBandeira,
      this.bandeira,
      this.desenhoDasFixas,
      this.desenhoDaRegua,
      this.previaDoToken,
    );
    this.previaDoToken.visible = false;
    this.desenharBandeira();
    this.app.stage.addChild(this.mundo);
    this.ultimoQuadro = performance.now();
    this.quadro = requestAnimationFrame(this.laco);

    const c = this.app.canvas;
    c.addEventListener("pointerdown", this.aoApertar);
    c.addEventListener("pointermove", this.aoMover);
    c.addEventListener("pointerleave", this.aoSairDoMapa);
    c.addEventListener("pointerup", this.aoSoltar);
    c.addEventListener("pointercancel", this.aoSoltar);
    c.addEventListener("wheel", this.aoRolar, { passive: false });
    c.addEventListener("contextmenu", this.impedir);
    c.addEventListener("dblclick", this.aoDuploClique);
    window.addEventListener("keydown", this.aoTeclaBaixo);
    window.addEventListener("keyup", this.aoTeclaCima);
    this.app.renderer.on("resize", this.aoRedimensionar);
    // O Pixi só reage ao resize da janela; a área do mapa muda também ao ajustar ou recolher o painel.
    this.observador = new ResizeObserver(() => this.app.queueResize());
    this.observador.observe(this.host);

    this.pronto = true;
    this.telaAntes = { largura: this.largura(), altura: this.altura() };
    this.chaveDaVisao = this.chaveDe_visao();
    this.instalarGanchoDeTeste();
    this.desenharCena();
    this.atualizarMapa();
    this.sincronizarTokens();
    this.vistaInicial();
    this.atualizarBandeira();
    this.atualizarCursor();
    this.desenharParedes();
    this.desenharMarcasDeLuz();
    this.redesenharDesenhos();
    window.addEventListener("pagehide", this.gravarMemoria);
    this.carregarMemoria();
  }

  destruir(): void {
    this.destruido = true;
    if (!this.pronto) return;
    this.pronto = false;
    cancelAnimationFrame(this.quadro);
    const c = this.app.canvas;
    c.removeEventListener("pointerdown", this.aoApertar);
    c.removeEventListener("pointermove", this.aoMover);
    c.removeEventListener("pointerleave", this.aoSairDoMapa);
    c.removeEventListener("pointerup", this.aoSoltar);
    c.removeEventListener("pointercancel", this.aoSoltar);
    c.removeEventListener("wheel", this.aoRolar);
    c.removeEventListener("contextmenu", this.impedir);
    c.removeEventListener("dblclick", this.aoDuploClique);
    window.removeEventListener("keydown", this.aoTeclaBaixo);
    window.removeEventListener("keyup", this.aoTeclaCima);
    this.observador?.disconnect();
    this.observador = null;
    if (this.gesto?.tipo === "token" || this.gesto?.tipo === "traco")
      this.gesto.limitador.cancelar();
    this.gesto = null;
    if (import.meta.env.MODE === "e2e") {
      (window as unknown as { __tabletop?: unknown }).__tabletop = undefined;
    }
    for (const t of this.texturas.values()) t.destroy(true);
    this.texturas.clear();
    window.removeEventListener("pagehide", this.gravarMemoria);
    if (this.gravacao) clearTimeout(this.gravacao);
    this.gravarMemoria();
    this.camada.destruir();
    // Sem `releaseGlobalResources`: `destroy(true)` esvazia os pools GLOBAIS do Pixi, e no StrictMode (o
    // primeiro mapa é descartado com o segundo já de pé) isso destruía lotes em uso ("reading 'clear'").
    this.app.destroy({ removeView: true }, { children: true });
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
    if (outraCena || this.gradeCenaId !== cena.id) this.carregarMemoria();
    this.desenharParedes();
    this.desenharCena();
    this.atualizarMapa();
    if (outraCena) {
      this.cancelarTraco();
      this.limparRegua();
    }
    this.redesenharDesenhos();
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
    if (trocouFerramenta || !opcoes.podeDesenhar) this.cancelarTraco();
    this.redesenharDesenhos();
    this.atualizarPrevia();
    if (trocouFerramenta) {
      this.limparRegua();
      this.zerarDesenho();
    }
    const chave = this.chaveDe_visao();
    if (chave !== this.chaveDaVisao) {
      this.chaveDaVisao = chave;
      this.visaoSuja = true;
      this.aplicarEsquecimento();
    }
    this.atualizarEstilos();
    this.atualizarBandeira();
    this.atualizarCursor();
    this.desenharParedes();
    this.desenharMarcasDeLuz();
  }

  /** As fontes de luz da cena (o que a sala mandou para quem está olhando). */
  definirLuzes(luzes: FonteDeLuz[]): void {
    this.luzes = luzes;
    if (!this.pronto) return;
    this.visaoSuja = true;
    this.desenharMarcasDeLuz();
  }

  /** Os pontos de luz da cena (o que a sala mandou para quem está olhando). */
  definirPontos(pontos: PontoDeLuz[]): void {
    this.pontos = pontos;
    if (!this.pronto) return;
    this.visaoSuja = true;
    this.chaveDosPontos = "";
    this.desenharMarcasDeLuz();
  }

  private chaveDe_visao(): string {
    return JSON.stringify(this.opcoes.visao);
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

  /** V10: se o ponto do mundo (metros) saiu da tela, desliza a vista o mínimo para trazê-lo de volta. */
  manterVisivel(xM: number, yM: number): void {
    if (!this.pronto) return;
    const margem = 80;
    const t = this.paraTela(xM, yM);
    const w = this.largura();
    const h = this.altura();
    let dx = 0;
    let dy = 0;
    if (t.x < margem) dx = margem - t.x;
    else if (t.x > w - margem) dx = w - margem - t.x;
    if (t.y < margem) dy = margem - t.y;
    else if (t.y > h - margem) dy = h - margem - t.y;
    if (dx === 0 && dy === 0) return;
    this.vista.x += dx;
    this.vista.y += dy;
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

  /** Ponto do mundo (metros) na página (clientX/clientY): onde abrir um menu junto de um token pelo teclado. */
  pontoDoMundoNaPagina(xM: number, yM: number): Ponto {
    const r = this.app.canvas.getBoundingClientRect();
    const p = this.paraTela(xM, yM);
    return { x: r.left + p.x, y: r.top + p.y };
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
    this.desenharMarcasDeLuz();
    if (this.zoomDosDesenhos !== this.vista.zoom) this.redesenharDesenhos();
  }

  private readonly aoRedimensionar = () => {
    const largura = this.largura();
    const altura = this.altura();
    if (!this.jaCentralizou) this.vistaInicial();
    else {
      // A área mudou (painel, janela do navegador): o ponto que estava no centro continua no centro.
      if (this.telaAntes.largura > 0 && this.telaAntes.altura > 0 && largura > 0 && altura > 0) {
        this.vista.x += (largura - this.telaAntes.largura) / 2;
        this.vista.y += (altura - this.telaAntes.altura) / 2;
      }
      this.aplicarVista();
    }
    this.telaAntes = { largura, altura };
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
    const marcas = `${(t.condicoes ?? []).join(",")}|${t.exaustao ?? ""}|${t.concentracao ?? ""}`;
    return `${t.nome}|${t.cor}|${t.tamanhoQuadrados}|${t.oculto}|${t.camada}|${imagem}|${marcas}`;
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
    // As iniciais seguem a cor do token (texto claro ou escuro, com o halo contrário): o amarelo não pode ter branco.
    const textoDasIniciais = corDoTextoSobre(token.cor);
    const iniciais = new Text({
      text: iniciaisDe(token.nome),
      style: {
        fill: textoDasIniciais,
        fontSize: Math.max(12, raio * 0.8),
        fontWeight: "700",
        fontFamily: "system-ui, sans-serif",
        stroke: { color: haloDoTexto(textoDasIniciais), width: 3 },
      },
    });
    iniciais.anchor.set(0.5);
    iniciais.visible = textura === undefined;
    // O nome vai numa pílula escura translúcida (legível sobre mapa claro ou escuro, sem contorno borrado).
    const rotulo = new Text({
      text: token.nome,
      style: {
        fill: 0xf4f5f7,
        fontSize: 13,
        fontWeight: "600",
        fontFamily: "system-ui, sans-serif",
      },
    });
    rotulo.anchor.set(0.5, 0);
    const icones = iconesDoToken(token);
    rotulo.position.set(0, raio + 4 + (icones.length > 0 ? RAIO_DA_MARCA : 0));
    const pilulaDoRotulo = new Graphics()
      .roundRect(
        -rotulo.width / 2 - 6,
        rotulo.y - 2,
        rotulo.width + 12,
        rotulo.height + 4,
        (rotulo.height + 4) / 2,
      )
      .fill({ color: 0x0b0d11, alpha: 0.72 });
    const anel = new Graphics().circle(0, 0, raio + 5).stroke({ width: 3, color: ACENTO });
    anel.visible = false;
    const anelVez = new Graphics()
      .circle(0, 0, raio + 12)
      .stroke({ width: 7, color: COR_DA_VEZ, alpha: 0.3 })
      .circle(0, 0, raio + 8)
      .stroke({ width: 4, color: COR_DA_VEZ });
    anelVez.visible = false;
    container.addChild(anelVez, anel, corpo, imagem, iniciais, pilulaDoRotulo, rotulo);
    const marcas = this.desenharMarcas(container, icones, raio);
    if (token.oculto) container.addChild(this.desenharOlhoCortado(raio));
    container.position.set(x * PX_POR_M, y * PX_POR_M);
    this.camadaDe(token).addChild(container);
    return {
      token,
      chave: this.chaveDe(token),
      container,
      anel,
      anelVez,
      marcas,
      temImagem: textura !== undefined,
      x,
      y,
      alvoX: x,
      alvoY: y,
    };
  }

  /**
   * Marcadores de condição, exaustão e concentração na borda de baixo do token (pequenos discos com
   * duas letras). Passando de `MARCAS_VISIVEIS`, o último vira "+N" (a dica lista o resto).
   */
  private desenharMarcas(
    container: Container,
    icones: IconeDeCondicao[],
    raio: number,
  ): MarcaVisual[] {
    if (icones.length === 0) return [];
    const mostrados: { sigla: string; cor: string; titulo: string; texto: string }[] = [];
    const comoMarca = (i: IconeDeCondicao) => ({
      sigla: i.sigla,
      cor: i.cor,
      titulo: i.titulo,
      texto: i.resumo,
    });
    const raioDaMarca = raio + 3;
    // Os marcadores ficam no arco de baixo da borda (sem cobrir as iniciais): no máximo 150 graus, e
    // com a distância mínima entre os centros que ainda deixa ler as duas letras. Em token pequeno cabem
    // menos marcadores; o último vira "+N" (a dica e a regra por clique listam o resto).
    const passoMinimo =
      (2 * Math.asin(Math.min(1, DISTANCIA_ENTRE_MARCAS / (2 * raioDaMarca))) * 180) / Math.PI;
    const cabem = Math.max(2, Math.min(MARCAS_VISIVEIS, Math.floor(150 / passoMinimo) + 1));
    if (icones.length <= cabem) {
      for (const i of icones) mostrados.push(comoMarca(i));
    } else {
      for (const i of icones.slice(0, cabem - 1)) mostrados.push(comoMarca(i));
      const resto = icones.slice(cabem - 1);
      mostrados.push({
        sigla: `+${resto.length}`,
        cor: "#555f6e",
        titulo: `Mais ${resto.length}`,
        texto: resto.map((i) => i.titulo).join(", "),
      });
    }
    const passo =
      mostrados.length > 1 ? Math.min(Math.max(passoMinimo, 30), 150 / (mostrados.length - 1)) : 0;
    const marcas: MarcaVisual[] = [];
    mostrados.forEach((m, i) => {
      const graus = 90 - (i - (mostrados.length - 1) / 2) * passo;
      const rad = (graus * Math.PI) / 180;
      const ox = Math.cos(rad) * raioDaMarca;
      const oy = Math.sin(rad) * raioDaMarca;
      const g = new Graphics()
        .circle(ox, oy, RAIO_DA_MARCA)
        .fill(m.cor)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.95 });
      const t = new Text({
        text: m.sigla,
        style: {
          fill: 0xffffff,
          fontSize: LETRA_DA_MARCA,
          fontWeight: "700",
          fontFamily: "system-ui, sans-serif",
          stroke: { color: 0x000000, width: 2 },
        },
      });
      t.anchor.set(0.5);
      t.position.set(ox, oy);
      container.addChild(g, t);
      marcas.push({ ox, oy, r: RAIO_DA_MARCA, titulo: m.titulo, texto: m.texto });
    });
    return marcas;
  }

  /** O marcador de condição sob o ponteiro (ponto da tela). */
  private marcaEm(p: Ponto): MarcaVisual | null {
    const m = this.paraMundo(p);
    for (const v of this.visuais.values()) {
      if (!v.container.visible) continue;
      for (const marca of v.marcas) {
        const cx = v.x + marca.ox / PX_POR_M;
        const cy = v.y + marca.oy / PX_POR_M;
        if (Math.hypot(m.x - cx, m.y - cy) <= (marca.r + 2) / PX_POR_M) return marca;
      }
    }
    return null;
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
      v.anelVez.visible = this.opcoes.tokenDaVezId === t.id;
    }
  }

  /** Um quadro: anima os tokens e só redesenha se algo mudou. */
  private readonly laco = (agora: number) => {
    const dt = agora - this.ultimoQuadro;
    this.ultimoQuadro = agora;
    try {
      this.passo(agora, dt);
    } catch (e) {
      // Um erro de desenho não pode parar o laço (o mapa congelaria em silêncio).
      console.error("Falha ao desenhar o mapa", e);
    }
    this.quadro = requestAnimationFrame(this.laco);
  };

  private passo(agora: number, dt: number): void {
    this.animar(dt);
    this.passoDaContagem();
    this.desenharAlcas();
    if (this.visaoSuja) this.recalcularVisao();
    else if (this.visibilidadeSuja) this.atualizarVisibilidadeDosTokens();
    if (this.memoriaPendente && agora - this.ultimaMarcacao >= INTERVALO_DA_MEMORIA_MS) {
      this.processarMemoria(agora);
    }
    // A luz que tremula só refaz o brilho (os polígonos continuam os mesmos).
    if (this.modelo && agora - this.ultimaTremula >= INTERVALO_DA_TREMULA_MS) {
      this.ultimaTremula = agora;
      if (this.camada.temTremula()) {
        this.camada.atualizarBrilho(agora);
        this.sujo = true;
      }
    }
    if (this.sujo) {
      this.sujo = false;
      this.app.render();
    }
  }

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
      // Quem enxerga (ou carrega uma luz) andou: os polígonos mudam. Quem não: só a visibilidade dele.
      if (
        this.opcoes.visao.fontes.some((f) => f.tokenId === v.token.id) ||
        this.luzes.some(
          (l) =>
            (l.portador.tipo === "token" && l.portador.tokenId === v.token.id) ||
            (l.portador.tipo === "mao" &&
              v.token.personagemId !== undefined &&
              l.portador.personagemId === v.token.personagemId),
        )
      ) {
        this.visaoSuja = true;
        if (this.marcasVisiveis()) this.desenharMarcasDeLuz();
      } else this.visibilidadeSuja = true;
    }
  }

  // --- visão, luz e memória (só de tela) -----------------------------------------------------------

  /** As fontes de luz com a posição que a tela mostra agora (a luz de token acompanha o token na tela). */
  private luzesDaTela(): FonteDeLuz[] {
    const a = this.luzArrastada;
    return a
      ? this.luzes.map((l) =>
          l.id === a.id ? { ...l, portador: { tipo: "cena" as const, x: a.pos.x, y: a.pos.y } } : l,
        )
      : this.luzes;
  }

  /** Os polígonos de visão e de luz e as texturas da luz (só roda quando algo que afeta a luz muda). */
  private recalcularVisao(): void {
    this.visaoSuja = false;
    this.sujo = true;
    const cena = this.cena;
    const { modo, fontes, memoria } = this.opcoes.visao;
    this.modelo = null;
    if (!cena || modo === "claro") {
      this.camada.esconder();
      this.atualizarVisibilidadeDosTokens();
      return;
    }
    const segmentos = this.paredes
      .filter((p) => p.cenaId === cena.id && bloqueiaVisao(p))
      .flatMap((p) => segmentosDaParede(p));
    const olhos = fontes.flatMap((f) => {
      const v = this.visuais.get(f.tokenId);
      return v ? [{ x: v.x, y: v.y, alcanceM: f.alcanceM, visaoNoEscuroM: f.visaoNoEscuroM }] : [];
    });
    const luzes = resolverLuzes(
      this.luzesDaTela(),
      cena,
      this.tokens,
      (id) => {
        const v = this.visuais.get(id);
        return v ? { x: v.x, y: v.y } : undefined;
      },
      this.pontosDaTela(),
    );
    this.modelo = calcularModelo({
      olhos,
      luzes,
      segmentos,
      limites: cena,
      ambiente: luzAmbienteDa(cena),
      cache: this.cacheDeLuz,
    });
    const comMemoria = modo === "jogador" && memoria.ligada && this.gradeDaMemoria !== null;
    this.camada.atualizar(
      {
        modo,
        larguraM: cena.larguraM,
        alturaM: cena.alturaM,
        modelo: this.modelo,
        memoria: comMemoria ? this.imagemDaMemoria() : null,
      },
      performance.now(),
    );
    if (comMemoria) this.memoriaPendente = true;
    this.atualizarVisibilidadeDosTokens();
  }

  /** Os tokens do jogador com a posição da tela, para a memória (onde ele está e até onde se lembra). */
  private fontesDeMemoria() {
    return this.opcoes.visao.fontes.flatMap((f) => {
      const v = this.visuais.get(f.tokenId);
      return v ? [{ x: v.x, y: v.y, alcanceM: f.memoriaM }] : [];
    });
  }

  private imagemDaMemoria() {
    const g = this.gradeDaMemoria;
    if (!g) return null;
    return {
      colunas: g.colunas,
      linhas: g.linhas,
      celulaM: g.celulaM,
      imagem: imagemDaMemoria(
        g,
        this.fontesDeMemoria(),
        corEmCanais(this.opcoes.visao.memoria.tom),
      ),
    };
  }

  /**
   * Marca na memória o que o jogador vê agora, esquece o que passou do alcance e redesenha a lembrança.
   * Roda no máximo a cada `INTERVALO_DA_MEMORIA_MS` (a conta é por célula), e uma última vez quando para.
   */
  private processarMemoria(agora: number): void {
    this.memoriaPendente = false;
    this.ultimaMarcacao = agora;
    const g = this.gradeDaMemoria;
    const modelo = this.modelo;
    const { modo, memoria } = this.opcoes.visao;
    if (!g || !modelo || modo !== "jogador" || !memoria.ligada) return;
    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (const poligono of modelo.visao) {
      for (const q of poligono) {
        x0 = Math.min(x0, q.x);
        y0 = Math.min(y0, q.y);
        x1 = Math.max(x1, q.x);
        y1 = Math.max(y1, q.y);
      }
    }
    const fontes = this.fontesDeMemoria();
    let mudou = 0;
    if (Number.isFinite(x0)) {
      mudou += marcarVisto(g, { x0, y0, x1, y1 }, (c) => veNoPonto(modelo, c));
    }
    mudou += esquecerAlemDoAlcance(g, fontes);
    if (mudou > 0) this.sujarMemoria();
    this.camada.definirMemoria(this.imagemDaMemoria());
    this.sujo = true;
  }

  private chaveDaGrade(): string | null {
    const cena = this.cena;
    const { usuarioId, mesaId } = this.opcoes.visao.memoria;
    return cena && usuarioId ? chaveDaMemoria(mesaId, usuarioId, cena.id) : null;
  }

  /** Só a mesa legada tem uma chave antiga a herdar (a de antes de a chave levar o id da mesa). */
  private chaveAntigaDaGrade(): string | undefined {
    const cena = this.cena;
    const { usuarioId, legada } = this.opcoes.visao.memoria;
    return legada && cena && usuarioId ? chaveAntigaDaMemoria(usuarioId, cena.id) : undefined;
  }

  /** Lê a memória da cena do IndexedDB (ou começa uma vazia) e aplica o "esquecer" do mestre, se houver. */
  private carregarMemoria(): void {
    const cena = this.cena;
    const chave = this.chaveDaGrade();
    if (!cena || !chave || this.gradeCarregando === chave) return;
    this.gradeCarregando = chave;
    this.gradeDaMemoria = null;
    this.gradeCenaId = null;
    void this.armazem
      .ler(chave, this.chaveAntigaDaGrade())
      .catch(() => undefined)
      .then((r) => {
        if (this.destruido || this.gradeCarregando !== chave || this.chaveDaGrade() !== chave)
          return;
        this.gradeCarregando = null;
        const atual = this.cena;
        if (!atual) return;
        const serve =
          r !== undefined && gradeServe(r, atual.larguraM, atual.alturaM, CELULA_DA_MEMORIA_M);
        this.gradeDaMemoria = serve
          ? { colunas: r.colunas, linhas: r.linhas, celulaM: r.celulaM, dados: r.dados }
          : criarGrade(atual.larguraM, atual.alturaM, CELULA_DA_MEMORIA_M);
        this.gradeCenaId = atual.id;
        this.esquecimentoAplicado = serve ? r.esquecimento : 0;
        this.aplicarEsquecimento();
        this.visaoSuja = true;
      });
  }

  /** O mestre mandou esquecer a cena depois do que este navegador já aplicou: zera a memória. */
  private aplicarEsquecimento(): void {
    const g = this.gradeDaMemoria;
    const versao = this.opcoes.visao.memoria.esquecimento;
    if (!g || versao <= this.esquecimentoAplicado) return;
    esquecerTudo(g);
    this.esquecimentoAplicado = versao;
    this.sujarMemoria();
    this.visaoSuja = true;
  }

  /** Há algo novo na memória: grava no IndexedDB depois de um instante (sem gravar a cada quadro). */
  private sujarMemoria(): void {
    this.memoriaSuja = true;
    if (this.gravacao) clearTimeout(this.gravacao);
    this.gravacao = setTimeout(this.gravarMemoria, ATRASO_DA_GRAVACAO_MS);
  }

  private readonly gravarMemoria = () => {
    if (this.gravacao) clearTimeout(this.gravacao);
    this.gravacao = null;
    const g = this.gradeDaMemoria;
    const chave = this.chaveDaGrade();
    if (!this.memoriaSuja || !g || !chave || this.gradeCenaId !== this.cena?.id) return;
    this.memoriaSuja = false;
    const registro: RegistroDeMemoria = {
      colunas: g.colunas,
      linhas: g.linhas,
      celulaM: g.celulaM,
      dados: g.dados.slice(),
      esquecimento: this.esquecimentoAplicado,
    };
    this.gravando++;
    void this.armazem.gravar(chave, registro).finally(() => {
      this.gravando--;
    });
  };

  /** Token fora do que o jogador enxerga agora não é desenhado (as fontes sempre aparecem). */
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
        (this.modelo !== null && veNoPonto(this.modelo, { x: v.x, y: v.y }));
    }
  }

  // --- fontes de luz: marcas, arrasto e seleção (só o mestre) ---------------------------------------

  /** Onde cada fonte da cena está na tela (as presas a token seguem o token). */
  private posicoesDasLuzes(): { luz: FonteDeLuz; pos: Ponto }[] {
    const cena = this.cena;
    if (!cena) return [];
    const resultado: { luz: FonteDeLuz; pos: Ponto }[] = [];
    for (const luz of this.luzesDaTela()) {
      // A tocha na mão e o objeto num ponto já têm a alça; a marca do painel é das fixas e das de token.
      if (luz.portador.tipo === "cena") {
        if (luz.cenaId !== cena.id) continue;
        resultado.push({ luz, pos: { x: luz.portador.x, y: luz.portador.y } });
      } else if (luz.portador.tipo === "token") {
        if (luz.cenaId !== cena.id) continue;
        const v = this.visuais.get(luz.portador.tokenId);
        if (v) resultado.push({ luz, pos: { x: v.x, y: v.y } });
      }
    }
    return resultado;
  }

  private marcasVisiveis(): boolean {
    return this.opcoes.mostrarLuzes && this.opcoes.modoMestre;
  }

  /** Ícone de cada luz (do mesmo tamanho na tela) e, na selecionada, os dois raios em metros. */
  private desenharMarcasDeLuz(): void {
    this.sujo = true;
    const g = this.marcasDeLuz.clear();
    if (!this.marcasVisiveis()) return;
    const z = this.vista.zoom;
    for (const { luz, pos } of this.posicoesDasLuzes()) {
      const cx = pos.x * PX_POR_M;
      const cy = pos.y * PX_POR_M;
      const r = 9 / z;
      const selecionada = luz.id === this.opcoes.luzSelecionadaId;
      if (selecionada) {
        const k = luz.intensidade * (this.cena?.fatorDeLuz ?? 1) * (luz.fatorDeRaio ?? 1);
        const clara = luz.luz.claraM * k * PX_POR_M;
        const total = (luz.luz.claraM + luz.luz.penumbraM) * k * PX_POR_M;
        g.circle(cx, cy, total).stroke({ width: 1.5 / z, color: COR_DA_LUZ, alpha: 0.6 });
        g.circle(cx, cy, clara).stroke({ width: 1.5 / z, color: 0xffffff, alpha: 0.6 });
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.moveTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35)
          .lineTo(cx + Math.cos(a) * r * 1.9, cy + Math.sin(a) * r * 1.9)
          .stroke({ width: 1.6 / z, color: luz.estado === "acesa" ? COR_DA_LUZ : 0x8a94a3 });
      }
      g.circle(cx, cy, r)
        .fill({ color: luz.estado === "acesa" ? COR_DA_LUZ : 0x3a414d, alpha: 0.95 })
        .stroke({ width: (selecionada ? 3 : 2) / z, color: selecionada ? ACENTO : 0x1a1204 });
    }
  }

  /** A luz cuja marca está sob o ponto da tela (só a que o mestre pode ver). */
  private luzEm(p: Ponto): { luz: FonteDeLuz; pos: Ponto } | null {
    if (!this.marcasVisiveis()) return null;
    let achada: { luz: FonteDeLuz; pos: Ponto } | null = null;
    let melhor = 16;
    for (const item of this.posicoesDasLuzes()) {
      const t = this.paraTela(item.pos.x, item.pos.y);
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d <= melhor) {
        melhor = d;
        achada = item;
      }
    }
    return achada;
  }

  // --- pontos de luz e alças das tochas ------------------------------------------------------------

  /** Os pontos da cena como a tela os mostra (o que o mestre está arrastando vale a posição ao vivo). */
  private pontosDaTela(): PontoDeLuz[] {
    const a = this.pontoArrastado;
    const cenaId = this.cena?.id;
    return this.pontos
      .filter((p) => p.cenaId === cenaId)
      .map((p) => (a && a.id === p.id ? { ...p, x: a.pos.x, y: a.pos.y } : p));
  }

  /** Onde o objeto de luz está agora na tela (metros): cena, token, mão, ponto. Na mochila: lugar nenhum. */
  private posicaoDoObjeto(luz: FonteDeLuz): Ponto | undefined {
    const cena = this.cena;
    if (!cena) return undefined;
    const p = luz.portador;
    switch (p.tipo) {
      case "cena":
        return luz.cenaId === cena.id ? { x: p.x, y: p.y } : undefined;
      case "token": {
        const v = this.visuais.get(p.tokenId);
        return v && luz.cenaId === cena.id ? { x: v.x, y: v.y } : undefined;
      }
      case "mao": {
        const v = this.visualDoPersonagem(p.personagemId);
        return v ? { x: v.x, y: v.y } : undefined;
      }
      case "ponto": {
        const ponto = this.pontosDaTela().find((x) => x.id === p.pontoId);
        return ponto ? { x: ponto.x, y: ponto.y } : undefined;
      }
      case "mochila":
        return undefined;
    }
  }

  /** O token (desenhado nesta cena) do personagem. */
  private visualDoPersonagem(personagemId: string): Visual | undefined {
    for (const v of this.visuais.values()) if (v.token.personagemId === personagemId) return v;
    return undefined;
  }

  /** O objeto aparece na tela? (a mão só se o token do dono aparece; o do ponto, só se o jogador o vê) */
  private objetoVisivelNaTela(luz: FonteDeLuz, pos: Ponto): boolean {
    if (luz.portador.tipo === "mao") {
      const v = this.visualDoPersonagem(luz.portador.personagemId);
      return v?.container.visible === true;
    }
    if (this.opcoes.visao.modo !== "jogador") return true;
    return this.modelo !== null && veNoPonto(this.modelo, pos);
  }

  /** Onde a alça (ou o ícone do objeto no ponto) fica, em metros do mundo. Ao arrastar, segue o ponteiro. */
  private ancoraDaAlca(
    luz: FonteDeLuz,
    ordemNoPonto: number,
  ): { mundo: Ponto; lado: number } | null {
    const arrasto = this.alcaArrastada;
    if (arrasto && arrasto.luzId === luz.id) return { mundo: arrasto.pos, lado: 0 };
    const centro = this.posicaoDoObjeto(luz);
    if (!centro) return null;
    const z = this.vista.zoom;
    const p = luz.portador;
    if (p.tipo === "mao") {
      const v = this.visualDoPersonagem(p.personagemId);
      const raioPx = v ? (v.token.tamanhoQuadrados * this.quadradoM() * PX_POR_M) / 2 : 20;
      const lado = p.mao % 2 === 0 ? -1 : 1;
      const camada = Math.floor(p.mao / 2);
      const dy = (camada * (2 * RAIO_DA_ALCA_TOCHA + 24)) / z / PX_POR_M;
      // A alça fica ao lado do token; se cair em cima do ícone de um ponto de luz, afasta para o lado
      // (até três passos) para os dois continuarem à vista e clicáveis.
      const pontos = this.pontosDaTela();
      const livre = (dx: number) => {
        const t = this.paraTela(centro.x + dx, centro.y + dy);
        return pontos.every((q) => {
          const u = this.paraTela(q.x, q.y);
          return Math.hypot(t.x - u.x, t.y - u.y) >= RAIO_DA_ALCA_TOCHA + 10 + 6;
        });
      };
      let dx = (lado * (raioPx + (RAIO_DA_ALCA_TOCHA + 12) / z)) / PX_POR_M;
      for (let passo = 0; passo < 3 && !livre(dx); passo++) {
        dx += (lado * (2 * RAIO_DA_ALCA_TOCHA + 8)) / z / PX_POR_M;
      }
      return { mundo: { x: centro.x + dx, y: centro.y + dy }, lado };
    }
    // No ponto (suporte, fogueira): o ícone fica acima do ponto, lado a lado se houver mais de um.
    return {
      mundo: { x: centro.x + (ordemNoPonto * 34) / z / PX_POR_M, y: centro.y - 52 / z / PX_POR_M },
      lado: 0,
    };
  }

  /** Texto sob a alça: o tempo restante (para quem pode ver) ou o estágio. */
  private rotuloDaAlca(luz: FonteDeLuz): string {
    const restante = this.opcoes.restanteDe(luz.id);
    if (restante !== undefined) return formatarRestante(restante);
    return luz.estagio ?? "";
  }

  /** Os objetos que aparecem como alça ou ícone, com a âncora de cada um. */
  private alcasDaTela(): { luz: FonteDeLuz; mundo: Ponto }[] {
    const resultado: { luz: FonteDeLuz; mundo: Ponto }[] = [];
    const porPonto = new Map<string, number>();
    for (const luz of this.luzes) {
      const p = luz.portador;
      if (p.tipo !== "mao" && p.tipo !== "ponto") continue;
      const pos = this.posicaoDoObjeto(luz);
      if (!pos || !this.objetoVisivelNaTela(luz, pos)) continue;
      const ordem = p.tipo === "ponto" ? (porPonto.get(p.pontoId) ?? 0) : 0;
      if (p.tipo === "ponto") porPonto.set(p.pontoId, ordem + 1);
      const a = this.ancoraDaAlca(luz, ordem);
      if (a) resultado.push({ luz, mundo: a.mundo });
    }
    return resultado;
  }

  /** Desenha uma chama (acesa) ou o contorno apagado, centrada em (0, 0), em pixels da tela. */
  private desenharChama(g: Graphics, acesa: boolean): void {
    const k = 1.6;
    g.moveTo(0, -8 * k)
      .bezierCurveTo(7 * k, -2 * k, 6 * k, 6 * k, 0, 8 * k)
      .bezierCurveTo(-6 * k, 6 * k, -7 * k, -2 * k, 0, -8 * k);
    if (acesa) {
      g.fill(0xff9a3c);
      g.moveTo(0, -2 * k)
        .bezierCurveTo(3.5 * k, k, 3 * k, 5 * k, 0, 6 * k)
        .bezierCurveTo(-3 * k, 5 * k, -3.5 * k, k, 0, -2 * k)
        .fill(0xffe08a);
    } else g.stroke({ width: 1.8, color: 0x8a94a3 });
  }

  private criarAlca(luzId: string): AlcaVisual {
    const container = new Container();
    const corpo = new Graphics();
    const rotulo = new Text({
      text: "",
      style: {
        fill: 0xfff1d0,
        fontSize: LETRA_DO_TEMPO,
        fontWeight: "700",
        fontFamily: "system-ui, sans-serif",
        stroke: { color: 0x000000, width: 4 },
      },
    });
    rotulo.anchor.set(0.5, 0);
    rotulo.position.set(0, RAIO_DA_ALCA_TOCHA + 3);
    container.addChild(corpo, rotulo);
    this.camadaDeAlcas.addChild(container);
    return { luzId, container, corpo, rotulo, chave: "" };
  }

  /**
   * Redesenha as alças das tochas (uma por mão, junto ao token), os ícones dos objetos nos pontos e o
   * anel de "segurar para acender". Tudo com o mesmo tamanho na tela, qualquer que seja o zoom.
   */
  private desenharAlcas(): void {
    const z = this.vista.zoom;
    const vivos = new Set<string>();
    const arrasto = this.alcaArrastada;
    for (const { luz, mundo } of this.alcasDaTela()) {
      vivos.add(luz.id);
      let alca = this.alcas.get(luz.id);
      if (!alca) {
        alca = this.criarAlca(luz.id);
        this.alcas.set(luz.id, alca);
      }
      const acesa = luz.estado === "acesa";
      const rotulo = this.rotuloDaAlca(luz);
      const dono = this.opcoes.podeMexerNaTocha(luz);
      const arrastando = arrasto?.luzId === luz.id;
      const chave = `${mundo.x.toFixed(3)},${mundo.y.toFixed(3)}|${z}|${acesa}|${rotulo}|${dono}|${arrastando}|${luz.estagio ?? ""}`;
      if (chave === alca.chave) continue;
      alca.chave = chave;
      this.sujo = true;
      alca.container.position.set(mundo.x * PX_POR_M, mundo.y * PX_POR_M);
      alca.container.scale.set((arrastando ? 1.2 : 1) / z);
      const g = alca.corpo.clear();
      g.circle(0, 0, RAIO_DA_ALCA_TOCHA)
        .fill({ color: 0x10141a, alpha: 0.94 })
        .stroke({ width: 3, color: acesa ? COR_DA_LUZ : 0x6b7686 });
      if (dono && luz.portador.tipo === "mao") {
        // O dono pode arrastar: um pontinho de destaque no canto.
        g.circle(RAIO_DA_ALCA_TOCHA * 0.75, -RAIO_DA_ALCA_TOCHA * 0.75, 4.5).fill(ACENTO);
      }
      this.desenharChama(g, acesa);
      alca.rotulo.text = rotulo;
      alca.rotulo.visible = rotulo !== "";
      alca.container.alpha = acesa ? 1 : 0.8;
    }
    for (const [id, alca] of this.alcas) {
      if (vivos.has(id)) continue;
      alca.container.destroy({ children: true });
      this.alcas.delete(id);
      this.sujo = true;
    }
    this.desenharPontos(z, arrasto);
  }

  /** Ícones dos pontos (suporte e inflamável), o alcance do selecionado e o anel de acender. */
  private desenharPontos(z: number, arrasto: AlcaArrastada | null): void {
    const g = this.desenhoDosPontos;
    const r = 10 / z;
    const progresso = arrasto?.segurando ? this.progressoDeAcender() : null;
    const chave = JSON.stringify([
      z,
      this.opcoes.pontoSelecionadoId,
      this.opcoes.alcanceInteracaoM,
      this.pontosDaTela(),
      this.opcoes.modoMestre,
      this.opcoes.visao.modo,
      this.modelo !== null,
      progresso === null ? null : Math.round(progresso * 40),
      arrasto?.segurando?.pontoId ?? null,
      this.luzes.filter((l) => l.portador.tipo === "ponto").map((l) => `${l.id}${l.estado}`),
    ]);
    if (chave === this.chaveDosPontos) return;
    this.chaveDosPontos = chave;
    this.sujo = true;
    g.clear();
    for (const ponto of this.pontosDaTela()) {
      const pos = { x: ponto.x, y: ponto.y };
      if (!this.opcoes.modoMestre && !this.pontoNaVisao(pos)) continue;
      const cx = ponto.x * PX_POR_M;
      const cy = ponto.y * PX_POR_M;
      const suporte = ponto.tipo === "suporte";
      const cor = suporte ? 0x7fd1b9 : 0xff9a4d;
      const alpha = ponto.visivelParaJogadores ? 1 : 0.55;
      const selecionado = ponto.id === this.opcoes.pontoSelecionadoId;
      if (selecionado) {
        const q = this.quadradoM();
        const alcance = (this.opcoes.alcanceInteracaoM + q / 2) * PX_POR_M;
        g.circle(cx, cy, alcance).stroke({ width: 1.5 / z, color: cor, alpha: 0.55 });
      }
      g.circle(cx, cy, r)
        .fill({ color: 0x10141a, alpha: 0.9 * alpha })
        .stroke({ width: (selecionado ? 3 : 2) / z, color: selecionado ? ACENTO : cor, alpha });
      if (suporte) {
        // um "U": a tocha se apoia nele
        g.moveTo(cx - r * 0.5, cy - r * 0.35)
          .lineTo(cx - r * 0.5, cy + r * 0.2)
          .lineTo(cx + r * 0.5, cy + r * 0.2)
          .lineTo(cx + r * 0.5, cy - r * 0.35)
          .stroke({ width: 1.8 / z, color: cor, alpha });
      } else {
        // lenha cruzada
        g.moveTo(cx - r * 0.55, cy + r * 0.4)
          .lineTo(cx + r * 0.55, cy - r * 0.4)
          .moveTo(cx - r * 0.55, cy - r * 0.4)
          .lineTo(cx + r * 0.55, cy + r * 0.4)
          .stroke({ width: 2 / z, color: cor, alpha });
      }
    }
    // O anel que enche enquanto a tocha acesa é segurada sobre o inflamável.
    const seg = arrasto?.segurando;
    if (seg && progresso !== null) {
      const ponto = this.pontosDaTela().find((x) => x.id === seg.pontoId);
      if (ponto) {
        const cx = ponto.x * PX_POR_M;
        const cy = ponto.y * PX_POR_M;
        const raioDoAnel = 30 / z;
        g.circle(cx, cy, raioDoAnel).stroke({ width: 6 / z, color: 0x000000, alpha: 0.6 });
        if (progresso > 0) {
          g.moveTo(cx, cy - raioDoAnel);
          g.arc(
            cx,
            cy,
            raioDoAnel,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * Math.min(1, progresso),
          );
          g.stroke({ width: 6 / z, color: 0xffb347, cap: "round" });
        }
      }
    }
  }

  private pontoNaVisao(pos: Ponto): boolean {
    if (this.opcoes.visao.modo !== "jogador") return true;
    return this.modelo !== null && veNoPonto(this.modelo, pos);
  }

  /** Quanto falta do "segurar" (0 a 1), ou `null` se não há contagem. */
  private progressoDeAcender(): number | null {
    const seg = this.alcaArrastada?.segurando;
    if (!seg) return null;
    const ponto = this.pontos.find((p) => p.id === seg.pontoId);
    const exigidoMs = (ponto?.segurarS ?? SEGURAR_PADRAO_S) * 1000;
    if (exigidoMs <= 0) return 1;
    return Math.min(1, (performance.now() - seg.desde) / exigidoMs);
  }

  /** A alça (ou ícone de objeto no ponto) sob o ponto da tela. */
  private alcaEm(p: Ponto): { luz: FonteDeLuz; tela: Ponto } | null {
    let achada: { luz: FonteDeLuz; tela: Ponto } | null = null;
    let melhor = RAIO_DA_ALCA_TOCHA + 1;
    for (const { luz, mundo } of this.alcasDaTela()) {
      const t = this.paraTela(mundo.x, mundo.y);
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d <= melhor) {
        melhor = d;
        achada = { luz, tela: t };
      }
    }
    return achada;
  }

  /** O ponto de luz (suporte ou inflamável) cujo ícone está sob o ponto da tela. */
  private pontoEm(p: Ponto): PontoDeLuz | null {
    let achado: PontoDeLuz | null = null;
    let melhor = 15;
    for (const ponto of this.pontosDaTela()) {
      if (!this.opcoes.modoMestre && !this.pontoNaVisao(ponto)) continue;
      const t = this.paraTela(ponto.x, ponto.y);
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d <= melhor) {
        melhor = d;
        achado = ponto;
      }
    }
    return achado;
  }

  /** O que está embaixo da tocha arrastada: outro token, um suporte ou um inflamável. */
  private alvoDaAlca(m: Ponto, luz: FonteDeLuz): AlvoDaAlca | null {
    const q = this.quadradoM();
    const dono =
      luz.portador.tipo === "mao" ? this.visualDoPersonagem(luz.portador.personagemId) : undefined;
    for (const v of this.visuais.values()) {
      if (v === dono || !v.container.visible || v.token.personagemId === undefined) continue;
      if (v.token.camada !== "tokens") continue;
      const raio = Math.max((v.token.tamanhoQuadrados * q) / 2, 12 / (this.vista.zoom * PX_POR_M));
      if (Math.hypot(m.x - v.x, m.y - v.y) <= raio) return { tipo: "token", tokenId: v.token.id };
    }
    const margem = Math.max(q * 0.6, 14 / (this.vista.zoom * PX_POR_M));
    for (const ponto of this.pontosDaTela()) {
      if (Math.hypot(m.x - ponto.x, m.y - ponto.y) > margem) continue;
      return { tipo: ponto.tipo, ponto };
    }
    return null;
  }

  /** O token do dono da tocha está ao alcance do ponto? (só uma dica; a sala confere de verdade) */
  private aoAlcanceDoPonto(luz: FonteDeLuz, ponto: PontoDeLuz): boolean {
    if (luz.portador.tipo !== "mao") return false;
    const v = this.visualDoPersonagem(luz.portador.personagemId);
    if (!v) return false;
    return dentroDoAlcance(
      { x: v.x, y: v.y, tamanhoQuadrados: v.token.tamanhoQuadrados },
      ponto,
      this.opcoes.alcanceInteracaoM,
      this.quadradoM(),
    );
  }

  /** Atualiza o que a tocha arrastada está tocando e começa (ou desfaz) a contagem do inflamável. */
  private atualizarAlvoDaAlca(): void {
    const arrasto = this.alcaArrastada;
    if (!arrasto) return;
    const luz = this.luzes.find((l) => l.id === arrasto.luzId);
    if (!luz) return;
    const alvo = this.alvoDaAlca(arrasto.pos, luz);
    const sobreInflamavel =
      alvo?.tipo === "inflamavel" &&
      luz.estado === "acesa" &&
      this.aoAlcanceDoPonto(luz, alvo.ponto);
    if (alvo?.tipo === "inflamavel" && sobreInflamavel) {
      if (arrasto.segurando?.pontoId !== alvo.ponto.id) {
        arrasto.segurando = { pontoId: alvo.ponto.id, desde: performance.now(), fimEnviado: false };
        this.retornos().acenderPontoInicio(alvo.ponto.id, luz.id);
      }
    } else if (arrasto.segurando) {
      arrasto.segurando = null;
    }
    this.chaveDosPontos = "";
  }

  /** Cada quadro: a contagem do inflamável chegou ao fim? Então pede para acender (a tocha volta à mão). */
  private passoDaContagem(): void {
    const arrasto = this.alcaArrastada;
    const seg = arrasto?.segurando;
    if (!arrasto || !seg) return;
    this.chaveDosPontos = "";
    const ponto = this.pontos.find((p) => p.id === seg.pontoId);
    const exigidoMs = (ponto?.segurarS ?? SEGURAR_PADRAO_S) * 1000;
    if (seg.fimEnviado || performance.now() - seg.desde < exigidoMs + 60) return;
    seg.fimEnviado = true;
    this.retornos().acenderPontoFim(seg.pontoId, arrasto.luzId);
    // A tocha volta para a mão; o arraste acaba aqui.
    this.alcaArrastada = null;
    this.gesto = null;
    this.atualizarCursor();
  }

  // --- paredes e portas -------------------------------------------------------------------------

  private ferramentaDeParedes(): boolean {
    return this.opcoes.ferramenta === "paredes" && this.opcoes.modoMestre;
  }

  /** A parede com a ponta em arrasto aplicada (a visão local da edição, antes de a sala confirmar). */
  private comPontaArrastada(p: Parede): Parede {
    const a = this.pontaArrastada;
    if (!a || a.id !== p.id) return p;
    const nova = a.ponta === "a" ? { ...p, a: a.pos } : { ...p, b: a.pos };
    if (!p.meio) return nova;
    // O arco acompanha: o ponto dele anda com o meio da corda (a sala faz o mesmo ao confirmar).
    return {
      ...nova,
      meio: {
        x: p.meio.x + (nova.a.x + nova.b.x) / 2 - (p.a.x + p.b.x) / 2,
        y: p.meio.y + (nova.a.y + nova.b.y) / 2 - (p.a.y + p.b.y) / 2,
      },
    };
  }

  /** Marca no `Graphics` o caminho da parede (reta ou arco em segmentos curtos), em pixels do mapa. */
  private tracarParede(g: Graphics, p: Pick<Parede, "a" | "b" | "meio">): void {
    const [primeiro, ...resto] = pontosDaParede(p);
    if (!primeiro) return;
    g.moveTo(primeiro.x * PX_POR_M, primeiro.y * PX_POR_M);
    for (const q of resto) g.lineTo(q.x * PX_POR_M, q.y * PX_POR_M);
  }

  /** Os contornos aparecem (a ferramenta de paredes sempre mostra; fora dela, a opção de quem olha). */
  private contornosVisiveis(): boolean {
    return this.ferramentaDeParedes() || this.opcoes.contornos;
  }

  /** Zera a sequência em desenho (e o modo de arco). */
  private zerarDesenho(): void {
    this.desenhando = null;
    this.meiosDoDesenho = [];
    this.fimDoArco3 = null;
    this.cursorDaParede = null;
    if (this.modoArco) {
      this.modoArco = false;
      this.retornos().modoDeArco(false);
    }
  }

  /** O trecho que o próximo clique fecharia, para a prévia: reta, arco tangente ou arco de 3 pontos. */
  private trechoEmPrevia(cursor: Ponto): { a: Ponto; b: Ponto; meio?: Ponto } | null {
    const pontos = this.desenhando;
    const ultimo = pontos?.[pontos.length - 1];
    if (!pontos || !ultimo) return null;
    if (!this.modoArco) return { a: ultimo, b: cursor };
    if (pontos.length >= 2) {
      const i = pontos.length - 2;
      const t = tangenteNoFim({
        a: pontos[i] as Ponto,
        b: ultimo,
        ...(this.meiosDoDesenho[i] ? { meio: this.meiosDoDesenho[i] as Ponto } : {}),
      });
      const meio = meioDoArcoTangente(ultimo, t, cursor);
      return meio ? { a: ultimo, b: cursor, meio } : { a: ultimo, b: cursor };
    }
    if (this.fimDoArco3) return { a: ultimo, b: this.fimDoArco3, meio: cursor };
    return { a: ultimo, b: cursor };
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
    const mostrar = this.contornosVisiveis();
    const g = mestre ? acima : abaixo;
    for (const original of this.paredes) {
      if (original.cenaId !== cena.id) continue;
      const parede = this.comPontaArrastada(original);
      const ehPorta = parede.tipo === "porta" || (mestre && parede.tipo === "secreta");
      // Contornos escondidos: só a porta sob o cursor se destaca (para o clique ficar descobrível).
      const destaque = !mostrar && ehPorta && parede.id === this.portaSob;
      if (!mostrar && !destaque) continue;
      const estilo = ESTILO_DA_PAREDE[parede.tipo];
      if (destaque) {
        this.tracarParede(g, parede);
        g.stroke({ width: 4 / z, color: estilo.cor, alpha: 0.95 });
      } else if (mestre) {
        this.tracarParede(g, parede);
        if (ferramenta) g.stroke({ width: estilo.largura / z, color: estilo.cor });
        else g.stroke({ width: 2 / z, color: 0xc9d1dc, alpha: 0.4 });
      } else if (parede.tipo === "porta") {
        const cor = parede.estado === "aberta" ? 0x6fcf97 : 0xe0a030;
        this.tracarParede(g, parede);
        g.stroke({ width: (parede.estado === "aberta" ? 2 : 4) / z, color: cor, alpha: 0.85 });
      } else if (parede.tipo !== "invisivel") {
        // O jogador numa cena com os contornos ligados: parede e janela, discretas. A parede invisível
        // nunca é desenhada para ele.
        this.tracarParede(g, parede);
        g.stroke({ width: 2 / z, color: estilo.cor, alpha: 0.7 });
      }
      if (ehPorta) this.desenharIcone(g, parede, z);
    }
    if (!ferramenta) return;
    const sel = this.paredes.find((x) => x.id === this.opcoes.paredeSelecionadaId);
    if (sel && sel.cenaId === cena.id) {
      const parede = this.comPontaArrastada(sel);
      const a = { x: parede.a.x * PX_POR_M, y: parede.a.y * PX_POR_M };
      const b = { x: parede.b.x * PX_POR_M, y: parede.b.y * PX_POR_M };
      this.tracarParede(acima, parede);
      acima.stroke({ width: 9 / z, color: ACENTO, alpha: 0.35 });
      for (const q of [a, b]) {
        acima
          .circle(q.x, q.y, RAIO_DA_ALCA / z)
          .fill(0xffffff)
          .stroke({ width: 2 / z, color: ACENTO });
      }
    }
    // Os pontos de fixação da meia célula em volta do cursor, e o que será fixado.
    const cursor = this.cursorDaParede;
    if (cursor) {
      if (this.encaixaPonteiro) {
        const passo = this.quadradoM() / 2;
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            acima
              .circle((cursor.x + i * passo) * PX_POR_M, (cursor.y + j * passo) * PX_POR_M, 1.8 / z)
              .fill({ color: ACENTO, alpha: 0.6 });
          }
        }
      }
      acima
        .circle(cursor.x * PX_POR_M, cursor.y * PX_POR_M, 5 / z)
        .stroke({ width: 2 / z, color: ACENTO });
    }
    const pontos = this.desenhando;
    if (pontos && pontos.length > 0) {
      const cor = ESTILO_DA_PAREDE[this.opcoes.tipoDaNovaParede].cor;
      for (let i = 1; i < pontos.length; i++) {
        this.tracarParede(acima, {
          a: pontos[i - 1] as Ponto,
          b: pontos[i] as Ponto,
          ...(this.meiosDoDesenho[i - 1] ? { meio: this.meiosDoDesenho[i - 1] as Ponto } : {}),
        });
      }
      acima.stroke({ width: 4 / z, color: cor, alpha: 0.85 });
      const previa = cursor ? this.trechoEmPrevia(cursor) : null;
      if (previa) {
        this.tracarParede(acima, previa);
        acima.stroke({ width: 4 / z, color: cor, alpha: 0.6 });
      }
      for (const q of pontos) acima.circle(q.x * PX_POR_M, q.y * PX_POR_M, 4 / z).fill(cor);
      if (this.fimDoArco3) {
        acima.circle(this.fimDoArco3.x * PX_POR_M, this.fimDoArco3.y * PX_POR_M, 4 / z).fill(cor);
      }
    }
  }

  /**
   * O jogador só vê (e só clica) a porta que está na sua visão. O meio da porta fica na borda do
   * polígono, então vale olhar um pouco para cada lado dela.
   */
  private portaVisivel(parede: Parede): boolean {
    if (this.opcoes.visao.modo !== "jogador") return true;
    const modelo = this.modelo;
    if (!modelo) return false;
    const meio = meioDaParede(parede);
    const dx = parede.b.x - parede.a.x;
    const dy = parede.b.y - parede.a.y;
    const n = Math.hypot(dx, dy) || 1;
    const nx = (-dy / n) * 0.15;
    const ny = (dx / n) * 0.15;
    return (
      veNoPonto(modelo, { x: meio.x + nx, y: meio.y + ny }) ||
      veNoPonto(modelo, { x: meio.x - nx, y: meio.y - ny })
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
      let d = Number.POSITIVE_INFINITY;
      for (const seg of segmentosDaParede(parede)) {
        const sa = this.paraTela(seg.a.x, seg.a.y);
        const sb = this.paraTela(seg.b.x, seg.b.y);
        d = Math.min(d, distanciaAoSegmento(p, sa, sb));
      }
      if (d <= melhor) {
        melhor = d;
        achada = parede;
      }
    }
    return achada;
  }

  /** Ponto do mundo para a parede: encaixa na rede de meia célula, 9 pontos por quadrado (Alt solta). */
  private pontoDaParede(m: Ponto, alt: boolean): Ponto {
    this.encaixaPonteiro = this.encaixaAgora(alt);
    const ponto = this.encaixaPonteiro ? encaixarMeiaCelula(m, this.quadradoM()) : m;
    return this.cena ? limitarNaCena(ponto, this.cena) : ponto;
  }

  /** Clique com a ferramenta de paredes: continua a sequência, arrasta uma ponta, seleciona ou começa. */
  private apertarComParedes(p: Ponto, e: PointerEvent): void {
    const ponto = this.pontoDaParede(this.paraMundo(p), e.altKey);
    if (this.desenhando) {
      this.fecharTrecho(ponto);
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
    this.meiosDoDesenho = [];
    this.fimDoArco3 = null;
    this.cursorDaParede = ponto;
    this.desenharParedes();
  }

  /**
   * Um clique com a sequência em andamento. Linha: fecha um trecho reto e começa o próximo no mesmo
   * ponto. Arco (tecla A): com trecho anterior, fecha um arco tangente a ele; sem trecho anterior, faz
   * o arco de 3 pontos (início, fim e o terceiro clique dá a curvatura).
   */
  private fecharTrecho(ponto: Ponto): void {
    const pontos = this.desenhando;
    const ultimo = pontos?.[pontos.length - 1];
    if (!pontos || !ultimo) return;
    const longe = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y) > 0.05;
    if (this.modoArco && pontos.length === 1) {
      const fim = this.fimDoArco3;
      if (!fim) {
        if (longe(ultimo, ponto)) this.fimDoArco3 = ponto;
        return;
      }
      this.fimDoArco3 = null;
      // Clicar de novo na ponta final (duplo clique) fecha só uma reta.
      const meio = longe(fim, ponto) && longe(ultimo, ponto) ? ponto : undefined;
      pontos.push(fim);
      this.meiosDoDesenho.push(meio);
      return;
    }
    if (!longe(ultimo, ponto)) return;
    let meio: Ponto | undefined;
    if (this.modoArco && pontos.length >= 2) {
      const i = pontos.length - 2;
      const t = tangenteNoFim({
        a: pontos[i] as Ponto,
        b: ultimo,
        ...(this.meiosDoDesenho[i] ? { meio: this.meiosDoDesenho[i] as Ponto } : {}),
      });
      meio = meioDoArcoTangente(ultimo, t, ponto) ?? undefined;
    }
    pontos.push(ponto);
    this.meiosDoDesenho.push(meio);
  }

  /** Esc ou duplo clique: a sequência vira paredes (com menos de dois pontos não vira nada). */
  private encerrarDesenho(): void {
    const pontos = this.desenhando;
    const meios = this.meiosDoDesenho;
    this.zerarDesenho();
    if (pontos && pontos.length >= 2 && this.cena) {
      const segmentos = pontos.slice(1).map((b, i) => ({
        a: pontos[i] as Ponto,
        b,
        ...(meios[i] ? { meio: meios[i] as Ponto } : {}),
      }));
      this.retornos().criarParedes(this.cena.id, segmentos, this.opcoes.tipoDaNovaParede);
    }
    this.desenharParedes();
  }

  private readonly aoDuploClique = (e: MouseEvent) => {
    if (this.desenhando) {
      this.encerrarDesenho();
      return;
    }
    if (this.opcoes.ferramenta !== "selecionar" || this.opcoes.tokenParaPor) return;
    const r = this.app.canvas.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    // Dois cliques na alça da tocha (ou no objeto aceso de um ponto): apaga ou reacende.
    const alca = this.alcaEm(p);
    if (alca) {
      if (alca.luz.portador.tipo === "mao" && !this.opcoes.podeMexerNaTocha(alca.luz)) return;
      this.retornos().alternarTocha(alca.luz.id);
      return;
    }
    // Dois cliques num token: abre o painel dele (só o mestre tem esse painel).
    if (!this.opcoes.euMestre || this.marcaEm(p)) return;
    const v = this.tokenEm(p);
    if (v) this.retornos().editarToken(v.token.id);
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
    const visivel = cena !== null && this.opcoes.mostrarBandeira;
    this.desenharAreaDaBandeira();
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

  /** V10b: o círculo suave na cor do acento em volta do ponto de chegada, só durante o arrasto da ficha. */
  private desenharAreaDaBandeira(): void {
    const g = this.areaDaBandeira;
    g.clear();
    const cena = this.cena;
    this.sujo = true;
    if (!cena || !this.opcoes.acenderAreaDaBandeira) return;
    const a = areaDaBandeira(cena);
    const raio = a.raioM * PX_POR_M;
    g.circle(a.x * PX_POR_M, a.y * PX_POR_M, raio)
      .fill({ color: ACENTO, alpha: 0.16 })
      .stroke({ width: 2 / this.vista.zoom, color: ACENTO, alpha: 0.85 });
  }

  /** A bandeira tem sempre o mesmo tamanho na tela, qualquer que seja o zoom. */
  private escalarBandeira(): void {
    this.sujo = true;
    this.desenharAreaDaBandeira();
    this.bandeira.scale.set(1 / this.vista.zoom);
  }

  private sobreABandeira(p: Ponto): boolean {
    const b = this.posicaoDaBandeira;
    if (!b || !this.opcoes.euMestre || this.opcoes.ferramenta !== "selecionar") return false;
    const t = this.paraTela(b.x, b.y);
    return p.x >= t.x - 10 && p.x <= t.x + 28 && p.y >= t.y - 36 && p.y <= t.y + 8;
  }

  // --- régua ----------------------------------------------------------------------------------

  /** Apaga a medida atual e as fixadas (Esc, trocar de ferramenta ou de cena). */
  private limparRegua(): void {
    this.sujo = true;
    this.reguaAtual = null;
    this.reguaSolta = false;
    this.reguasFixadas = [];
    this.desenhoDaRegua.clear();
    this.desenhoDasFixas.clear();
    this.retornos().medir(null);
    if (this.fixasAvisadas) {
      this.fixasAvisadas = false;
      this.retornos().reguasFixas([]);
    }
  }

  /** Fixa a medida atual na tela (botão "Fixar" ou Shift ao soltar); dá para medir outra em seguida. */
  fixarRegua(): void {
    const r = this.reguaAtual;
    if (!r || (r.a.x === r.b.x && r.a.y === r.b.y)) return;
    this.reguasFixadas.push({ id: this.proximaReguaFixa++, a: r.a, b: r.b });
    this.reguaAtual = null;
    this.reguaSolta = false;
    this.desenhoDaRegua.clear();
    this.retornos().medir(null);
    this.desenharRegua();
  }

  /** Tira uma medida fixada (clique no rótulo ou na linha). */
  removerReguaFixa(id: number): void {
    this.reguasFixadas = this.reguasFixadas.filter((f) => f.id !== id);
    this.desenharRegua();
  }

  /** A medida fixada cuja linha passa perto do ponto da tela (até 8 px), se houver. */
  private reguaFixadaEm(p: Ponto): number | null {
    for (const f of this.reguasFixadas) {
      const a = this.paraTela(f.a.x, f.a.y);
      const b = this.paraTela(f.b.x, f.b.y);
      if (distanciaAoSegmento(p, a, b) <= 8) return f.id;
    }
    return null;
  }

  private tracarRegua(g: Graphics, r: { a: Ponto; b: Ponto }): void {
    const z = this.vista.zoom;
    const a = { x: r.a.x * PX_POR_M, y: r.a.y * PX_POR_M };
    const b = { x: r.b.x * PX_POR_M, y: r.b.y * PX_POR_M };
    g.moveTo(a.x, a.y)
      .lineTo(b.x, b.y)
      .stroke({ width: 3 / z, color: ACENTO });
    g.circle(a.x, a.y, 5 / z).fill(ACENTO);
    g.circle(b.x, b.y, 5 / z).fill(ACENTO);
  }

  private desenharRegua(): void {
    this.sujo = true;
    this.desenhoDasFixas.clear();
    if (this.reguasFixadas.length > 0 || this.fixasAvisadas) {
      const lista = this.reguasFixadas.map((f) => {
        this.tracarRegua(this.desenhoDasFixas, f);
        const fim = this.paraTela(f.b.x, f.b.y);
        return {
          id: f.id,
          medida: medirRegua(f.a, f.b, this.quadradoM()),
          x: fim.x,
          y: fim.y,
        };
      });
      this.fixasAvisadas = lista.length > 0;
      this.retornos().reguasFixas(lista);
    }
    const r = this.reguaAtual;
    if (!r) return;
    this.desenhoDaRegua.clear();
    this.tracarRegua(this.desenhoDaRegua, r);
    const fim = this.paraTela(r.b.x, r.b.y);
    this.retornos().medir({
      medida: medirRegua(r.a, r.b, this.quadradoM()),
      x: fim.x,
      y: fim.y,
      solta: this.reguaSolta,
    });
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
      // Clique direito com a ferramenta de paredes e a sequência em desenho: encerra a corrente.
      if (this.ferramentaDeParedes() && this.desenhando) {
        this.encerrarDesenho();
        return;
      }
      // Clique direito na alça da tocha (ou no objeto de um ponto): o menu da tocha.
      const alca = this.opcoes.ferramenta === "selecionar" ? this.alcaEm(p) : null;
      if (alca) {
        this.retornos().menuDaTocha(alca.luz.id, e.clientX, e.clientY);
        return;
      }
      // Clique direito no ícone da porta (mestre): tranca ou destranca.
      const porta = this.opcoes.modoMestre ? this.portaEm(p) : null;
      if (porta) {
        this.retornos().trancarPorta(porta.id);
        return;
      }
      // Clique direito num token: o menu do token (condições e, para o mestre, a iniciativa).
      const sob = this.opcoes.ferramenta === "selecionar" ? this.tokenEm(p) : null;
      if (sob) this.retornos().menuDoToken(sob.token.id, e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0 || !this.cena) return;

    // Modo "pôr token" (R5a): o clique no mapa põe o token que o formulário descreveu.
    if (this.opcoes.tokenParaPor && this.opcoes.ferramenta === "selecionar") {
      this.retornos().colocarToken(...this.pontoDoNovoToken(p, e.altKey));
      return;
    }

    if (this.opcoes.ferramenta === "pincel") {
      this.apertarComPincel(p, e);
      return;
    }

    if (this.ferramentaDeParedes()) {
      const porta = this.desenhando ? null : this.portaEm(p);
      if (porta) this.retornos().selecionarParede(porta.id);
      else this.apertarComParedes(p, e);
      return;
    }

    if (this.opcoes.ferramenta === "regua") {
      // Um clique numa medida fixada a tira (em vez de começar outra).
      const fixada = this.reguaFixadaEm(p);
      if (fixada !== null) {
        this.removerReguaFixa(fixada);
        return;
      }
      const a = this.pontoDaRegua(this.paraMundo(p), e.altKey);
      this.reguaAtual = { a, b: a };
      this.reguaSolta = false;
      this.gesto = { tipo: "regua" };
      this.app.canvas.setPointerCapture(e.pointerId);
      this.desenharRegua();
      return;
    }

    if (this.opcoes.ferramenta === "luz") {
      if (!this.opcoes.modoMestre) return;
      const m = this.paraMundo(p);
      const ponto = limitarNaCena(
        this.encaixaAgora(e.altKey) ? encaixarNoGrid(m, 1, this.quadradoM()) : m,
        this.cena,
      );
      this.retornos().colocarLuz(this.cena.id, ponto.x, ponto.y);
      return;
    }

    if (this.opcoes.ferramenta === "ponto") {
      if (!this.opcoes.modoMestre) return;
      const m = this.paraMundo(p);
      const ponto = limitarNaCena(
        this.encaixaAgora(e.altKey) ? encaixarNoGrid(m, 1, this.quadradoM()) : m,
        this.cena,
      );
      this.retornos().colocarPonto(this.cena.id, this.opcoes.tipoDoNovoPonto, ponto.x, ponto.y);
      return;
    }

    // Clique num marcador de condição: abre a regra dela (além da dica no mouse).
    const marcaClicada = this.marcaEm(p);
    if (marcaClicada) {
      this.retornos().abrirRegra({
        titulo: marcaClicada.titulo,
        texto: marcaClicada.texto,
        tipo: "condicao",
        x: e.clientX,
        y: e.clientY,
      });
      return;
    }

    // A alça da tocha: só o dono (ou o mestre) a arrasta; a dos outros ignora o clique.
    const alca = this.alcaEm(p);
    if (alca) {
      if (alca.luz.portador.tipo === "mao" && this.opcoes.podeMexerNaTocha(alca.luz)) {
        const m = this.paraMundo(p);
        this.alcaArrastada = { luzId: alca.luz.id, pos: m, segurando: null };
        this.gesto = { tipo: "alca", luzId: alca.luz.id };
        this.app.canvas.setPointerCapture(e.pointerId);
        this.atualizarCursor();
      }
      return;
    }

    const pontoMarcado = this.marcasVisiveis() ? this.pontoEm(p) : null;
    if (pontoMarcado) {
      this.retornos().selecionarPonto(pontoMarcado.id);
      const m = this.paraMundo(p);
      this.gesto = {
        tipo: "ponto",
        id: pontoMarcado.id,
        deslocamento: { x: pontoMarcado.x - m.x, y: pontoMarcado.y - m.y },
      };
      this.pontoArrastado = { id: pontoMarcado.id, pos: { x: pontoMarcado.x, y: pontoMarcado.y } };
      this.app.canvas.setPointerCapture(e.pointerId);
      this.atualizarCursor();
      return;
    }

    const marca = this.luzEm(p);
    if (marca) {
      this.retornos().selecionarLuz(marca.luz.id);
      // Só a luz fixa se arrasta; a presa a um token acompanha o token.
      if (marca.luz.portador.tipo === "cena") {
        const m = this.paraMundo(p);
        this.gesto = {
          tipo: "luz",
          id: marca.luz.id,
          deslocamento: { x: marca.pos.x - m.x, y: marca.pos.y - m.y },
        };
        this.app.canvas.setPointerCapture(e.pointerId);
        this.atualizarCursor();
      }
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
      if (this.marcasVisiveis()) {
        this.retornos().selecionarLuz(null);
        this.retornos().selecionarPonto(null);
      }
      return;
    }
    // V2: o jogador também seleciona, mas só o token que controla; clicar em outro solta a seleção. Fica só na
    // tela dele (nada vai para a sala).
    this.retornos().selecionar(
      this.opcoes.euMestre || this.opcoes.controla(v.token) ? v.token.id : null,
    );
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

  /** Onde o token do modo "pôr token" cairia: encaixado no grid (Alt inverte) e dentro da cena. */
  private pontoDoNovoToken(p: Ponto, alt: boolean): [number, number] {
    const t = this.opcoes.tokenParaPor;
    let alvo = this.paraMundo(p);
    if (t && this.encaixaAgora(alt)) {
      alvo = encaixarNoGrid(alvo, t.tamanhoQuadrados, this.quadradoM());
    }
    if (this.cena) alvo = limitarNaCena(alvo, this.cena);
    return [alvo.x, alvo.y];
  }

  private moverPrevia(e: PointerEvent, p: Ponto): void {
    if (!this.opcoes.tokenParaPor) return;
    this.ponteiroNoMapa = { p, alt: e.altKey };
    this.atualizarPrevia();
  }

  /** A prévia do token (círculo na cor dele, com as iniciais) segue o cursor enquanto o modo está ligado. */
  private atualizarPrevia(): void {
    this.sujo = true;
    const t = this.opcoes.tokenParaPor;
    const q = this.ponteiroNoMapa;
    if (!t || !q || this.opcoes.ferramenta !== "selecionar" || !this.cena) {
      this.previaDoToken.visible = false;
      return;
    }
    const chave = `${t.nome}|${t.cor}|${t.tamanhoQuadrados}|${this.quadradoM()}`;
    if (chave !== this.chaveDaPrevia) {
      this.chaveDaPrevia = chave;
      for (const filho of this.previaDoToken.removeChildren()) filho.destroy({ children: true });
      const raio = (t.tamanhoQuadrados * this.quadradoM() * PX_POR_M) / 2 - 3;
      const corpo = new Graphics()
        .circle(0, 0, raio)
        .fill({ color: t.cor, alpha: 0.6 })
        .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
      const iniciais = new Text({
        text: iniciaisDe(t.nome),
        style: {
          fill: 0xffffff,
          fontSize: Math.max(12, raio * 0.8),
          fontWeight: "700",
          fontFamily: "system-ui, sans-serif",
          stroke: { color: 0x000000, width: 3 },
        },
      });
      iniciais.anchor.set(0.5);
      this.previaDoToken.addChild(corpo, iniciais);
    }
    const [x, y] = this.pontoDoNovoToken(q.p, q.alt);
    this.previaDoToken.position.set(x * PX_POR_M, y * PX_POR_M);
    this.previaDoToken.visible = true;
  }

  private pontoDaRegua(m: Ponto, alt: boolean): Ponto {
    return this.encaixaAgora(alt) ? encaixarNoGrid(m, 1, this.quadradoM()) : m;
  }

  /** Avisa a tela da dica sob o ponteiro (e que ela acompanha o movimento). */
  private atualizarDica(
    e: PointerEvent,
    marca: { titulo: string; texto: string; tipo: DicaDoMapa["tipo"] } | null,
  ): void {
    if (marca === null) {
      if (this.dicaAberta) {
        this.dicaAberta = false;
        this.retornos().dica(null);
      }
      return;
    }
    this.dicaAberta = true;
    this.retornos().dica({
      titulo: marca.titulo,
      texto: marca.texto,
      tipo: marca.tipo,
      x: e.clientX,
      y: e.clientY,
    });
  }

  /** V10: a dica da bandeira do ponto de chegada sob o ponteiro (só o mestre a vê). */
  private dicaDaBandeira(p: Ponto): { titulo: string; texto: string; tipo: "bandeira" } | null {
    if (!this.opcoes.euMestre) {
      // V10b: o jogador vê a bandeira (quando pode pôr o token) e a dica diz como pôr; ele não a arrasta.
      const b = this.posicaoDaBandeira;
      if (!b || !this.bandeira.visible) return null;
      const t = this.paraTela(b.x, b.y);
      const em = p.x >= t.x - 10 && p.x <= t.x + 28 && p.y >= t.y - 36 && p.y <= t.y + 8;
      return em
        ? { titulo: "Ponto de chegada", texto: DICA_DA_BANDEIRA_DO_JOGADOR, tipo: "bandeira" }
        : null;
    }
    if (!this.sobreABandeira(p)) return null;
    return { titulo: "Ponto de chegada", texto: DICA_DA_BANDEIRA, tipo: "bandeira" };
  }

  /** A dica da alça da tocha sob o ponteiro (só com a ferramenta de seleção): o que ela faz. */
  private dicaDaAlca(p: Ponto): { titulo: string; texto: string; tipo: "tocha" } | null {
    if (this.opcoes.ferramenta !== "selecionar") return null;
    const alca = this.alcaEm(p);
    if (!alca) return null;
    const luz = alca.luz;
    const alheia = luz.portador.tipo === "mao" && !this.opcoes.podeMexerNaTocha(luz);
    return {
      titulo: luz.nome,
      texto: alheia ? "Tocha de outro personagem: só o dono e o mestre mexem nela." : DICA_DA_TOCHA,
      tipo: "tocha",
    };
  }

  private readonly aoSairDoMapa = () => {
    if (this.dicaAberta) {
      this.dicaAberta = false;
      this.retornos().dica(null);
    }
    this.ponteiroNoMapa = null;
    if (this.portaSob !== null) {
      this.portaSob = null;
      this.desenharParedes();
    }
    this.atualizarPrevia();
  };

  private readonly aoMover = (e: PointerEvent) => {
    const g = this.gesto;
    const p = this.posicaoNaTela(e);
    if (!g) {
      if (this.ferramentaDeParedes()) {
        const antes = this.cursorDaParede;
        const agora = this.pontoDaParede(this.paraMundo(p), e.altKey);
        this.cursorDaParede = agora;
        if (!antes || antes.x !== agora.x || antes.y !== agora.y) this.desenharParedes();
      }
      const sob = this.portaEm(p)?.id ?? null;
      if (sob !== this.portaSob) {
        this.portaSob = sob;
        if (!this.contornosVisiveis()) this.desenharParedes();
      }
      this.atualizarCursor(this.tokenEm(p), this.sobreABandeira(p), this.alcaEm(p) !== null);
      const marca = this.marcaEm(p);
      this.atualizarDica(
        e,
        marca
          ? { titulo: marca.titulo, texto: marca.texto, tipo: "condicao" }
          : (this.dicaDaAlca(p) ?? this.dicaDaBandeira(p)),
      );
      this.moverPrevia(e, p);
      return;
    }
    if (g.tipo === "traco" || g.tipo === "desenhoMover" || g.tipo === "borracha") {
      this.moverComPincel(g, this.paraMundo(p));
      return;
    }
    if (g.tipo === "alca") {
      if (this.alcaArrastada) {
        this.alcaArrastada.pos = this.paraMundo(p);
        this.atualizarAlvoDaAlca();
      }
      return;
    }
    if (g.tipo === "ponto") {
      if (!this.cena) return;
      const m = this.paraMundo(p);
      const alvo = limitarNaCena(
        this.encaixaAgora(e.altKey)
          ? encaixarNoGrid(
              { x: m.x + g.deslocamento.x, y: m.y + g.deslocamento.y },
              1,
              this.quadradoM(),
            )
          : { x: m.x + g.deslocamento.x, y: m.y + g.deslocamento.y },
        this.cena,
      );
      this.pontoArrastado = { id: g.id, pos: alvo };
      this.visaoSuja = true;
      this.chaveDosPontos = "";
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
    if (g.tipo === "luz") {
      if (!this.cena) return;
      const m = this.paraMundo(p);
      const alvo = limitarNaCena(
        { x: m.x + g.deslocamento.x, y: m.y + g.deslocamento.y },
        this.cena,
      );
      this.luzArrastada = { id: g.id, pos: alvo };
      this.visaoSuja = true;
      this.desenharMarcasDeLuz();
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
    if (g.tipo === "traco" || g.tipo === "desenhoMover" || g.tipo === "borracha") {
      this.soltarComPincel(g);
      this.atualizarCursor();
      return;
    }
    if (g.tipo === "regua") {
      // Soltou: a medida fica na tela; com Shift ela já vira fixa.
      this.reguaSolta = true;
      if (e.shiftKey) this.fixarRegua();
      else this.desenharRegua();
      this.atualizarCursor();
      return;
    }
    if (g.tipo === "bandeira") {
      const b = this.posicaoDaBandeira;
      if (b && this.cena) this.retornos().chegada(this.cena.id, b.x, b.y);
    }
    if (g.tipo === "alca") {
      const arrasto = this.alcaArrastada;
      const luz = this.luzes.find((l) => l.id === g.luzId);
      this.alcaArrastada = null;
      this.chaveDosPontos = "";
      if (arrasto && luz) {
        const alvo = this.alvoDaAlca(arrasto.pos, luz);
        if (alvo?.tipo === "token") this.retornos().entregarTocha(luz.id, alvo.tokenId);
        else if (alvo?.tipo === "suporte") this.retornos().posarTocha(luz.id, alvo.ponto.id);
      }
      this.atualizarCursor();
      return;
    }
    if (g.tipo === "ponto") {
      const arrasto = this.pontoArrastado;
      if (arrasto) this.retornos().moverPonto(arrasto.id, arrasto.pos.x, arrasto.pos.y);
      // O ponto fica onde foi solto até a sala confirmar (o evento chega em seguida).
      setTimeout(() => {
        this.pontoArrastado = null;
        if (this.pronto) {
          this.visaoSuja = true;
          this.chaveDosPontos = "";
        }
      }, 400);
      this.atualizarCursor();
      return;
    }
    if (g.tipo === "luz") {
      const arrasto = this.luzArrastada;
      if (arrasto) this.retornos().moverLuz(arrasto.id, arrasto.pos.x, arrasto.pos.y);
      // A luz fica onde foi solta até a sala confirmar (o evento chega em seguida).
      setTimeout(() => {
        this.luzArrastada = null;
        if (this.pronto) {
          this.visaoSuja = true;
          this.desenharMarcasDeLuz();
        }
      }, 400);
      this.atualizarCursor();
      return;
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

  /**
   * Espaço é "arrastar a vista", mas num botão em foco pelo teclado (Tab) é o que ativa o botão (R6a): o mapa
   * não o rouba. Botão focado com o mouse (`:focus-visible` falso) e o próprio mapa continuam arrastando.
   */
  private espacoEDeUmControle(): boolean {
    const a = document.activeElement;
    return (
      a instanceof HTMLElement &&
      a !== document.body &&
      a !== this.host &&
      a.matches(
        "button, summary, a[href], [role='button'], [role='menuitem'], [role='menuitemcheckbox'], [role='tab'], input[type='checkbox'], input[type='radio']",
      ) &&
      a.matches(":focus-visible")
    );
  }

  private readonly aoTeclaBaixo = (e: KeyboardEvent) => {
    if (this.digitando()) return;
    if (e.code === "Space" && !this.espacoEDeUmControle()) {
      this.espaco = true;
      e.preventDefault();
      this.atualizarCursor();
    }
    if (e.key === "Escape" && this.gesto?.tipo === "traco") {
      // Esc cancela o traço em andamento: nada é gravado e o rascunho some para os outros.
      this.cancelarTraco();
      return;
    }
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      this.opcoes.ferramenta === "pincel" &&
      this.opcoes.pincel.modo === "selecionar" &&
      this.opcoes.desenhoSelecionadoId !== null
    ) {
      e.preventDefault();
      this.apagarSelecionado();
      return;
    }
    if (
      (e.key === "a" || e.key === "A") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      this.ferramentaDeParedes()
    ) {
      // V5: A alterna linha e arco (como no SolidWorks).
      e.preventDefault();
      this.modoArco = !this.modoArco;
      this.fimDoArco3 = null;
      this.retornos().modoDeArco(this.modoArco);
      this.desenharParedes();
      return;
    }
    if (e.key === "Escape") {
      this.limparRegua();
      this.cancelarGestoEmAndamento();
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

  /** Esc: o arrasto de um token ou de uma alça em andamento é desfeito (o token volta de onde saiu). */
  private cancelarGestoEmAndamento(): void {
    const g = this.gesto;
    if (!g) return;
    if (g.tipo === "token") {
      g.limitador.cancelar();
      const v = this.visuais.get(g.id);
      if (v) {
        v.alvoX = g.origem.x;
        v.alvoY = g.origem.y;
      }
      if (g.moveu) this.retornos().soltar(g.id, g.origem.x, g.origem.y);
    } else if (g.tipo === "alca") {
      this.alcaArrastada = null;
      this.chaveDosPontos = "";
    } else if (g.tipo !== "regua") {
      return;
    }
    this.gesto = null;
    this.atualizarCursor();
  }

  private readonly aoTeclaCima = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.espaco = false;
      this.atualizarCursor();
    }
  };

  private atualizarCursor(
    sobre: Visual | null = null,
    sobreBandeira = false,
    sobreAlca = false,
  ): void {
    if (!this.pronto) return;
    const g = this.gesto;
    let cursor = "default";
    if (
      g?.tipo === "pan" ||
      g?.tipo === "bandeira" ||
      g?.tipo === "luz" ||
      g?.tipo === "ponto" ||
      g?.tipo === "desenhoMover" ||
      g?.tipo === "alca"
    )
      cursor = "grabbing";
    else if (this.opcoes.tokenParaPor && this.opcoes.ferramenta === "selecionar")
      cursor = "crosshair";
    else if (sobreAlca && this.opcoes.ferramenta === "selecionar") cursor = "grab";
    else if (this.espaco || this.opcoes.ferramenta === "mao") cursor = "grab";
    else if (sobreBandeira && this.opcoes.ferramenta === "selecionar") cursor = "grab";
    else if (this.portaSob !== null && this.opcoes.ferramenta === "selecionar") cursor = "pointer";
    else if (this.opcoes.ferramenta === "pincel") {
      cursor =
        this.opcoes.podeDesenhar && this.opcoes.pincel.modo !== "selecionar"
          ? "crosshair"
          : "default";
    } else if (
      this.opcoes.ferramenta === "regua" ||
      this.opcoes.ferramenta === "luz" ||
      this.opcoes.ferramenta === "ponto" ||
      this.ferramentaDeParedes()
    )
      cursor = "crosshair";
    else if (g?.tipo === "token") cursor = "grabbing";
    else if (sobre && this.selecionavel(sobre.token)) {
      cursor = this.opcoes.podeMover(sobre.token) ? "grab" : "pointer";
    }
    this.app.canvas.style.cursor = cursor;
  }

  // --- pincel e camada de desenho (Lote 13) ---------------------------------------------------

  /** Os desenhos que a sala mandou para quem está olhando (de qualquer cena; a tela filtra pela dela). */
  definirDesenhos(desenhos: Desenho[]): void {
    const antes = this.desenhos;
    this.desenhos = desenhos;
    for (const d of desenhos) {
      this.pendentes.delete(d.id);
      this.rascunhosAlheios.delete(d.id); // o traço foi gravado: o rascunho dele acabou
    }
    // O que a sala já apagou não precisa mais ficar escondido.
    for (const id of [...this.apagadosLocais]) {
      if (!desenhos.some((d) => d.id === id)) this.apagadosLocais.delete(id);
    }
    // O desenho arrastado volta a vir da sala assim que ela confirma a posição nova.
    const mov = this.desenhoMovido;
    if (mov) {
      const novo = desenhos.find((d) => d.id === mov.id);
      const velho = antes.find((d) => d.id === mov.id);
      if (!novo || (velho && JSON.stringify(novo.pontos) !== mov.chave)) this.desenhoMovido = null;
    }
    this.redesenharDesenhos();
  }

  /** Traço em andamento de outra pessoa (`desenho.rascunhando`). */
  rascunhoRecebido(desenho: Desenho): void {
    this.rascunhosAlheios.set(desenho.id, desenho);
    this.redesenharDesenhos();
  }

  /** O autor soltou, cancelou ou saiu: o rascunho some. */
  rascunhoEncerrado(id: string): void {
    if (this.rascunhosAlheios.delete(id)) this.redesenharDesenhos();
  }

  limparRascunhos(): void {
    if (this.rascunhosAlheios.size === 0) return;
    this.rascunhosAlheios.clear();
    this.redesenharDesenhos();
  }

  private desenhosDaCena(): Desenho[] {
    const cenaId = this.cena?.id;
    return this.desenhos.filter((d) => d.cenaId === cenaId && !this.apagadosLocais.has(d.id));
  }

  private redesenharDesenhos(): void {
    if (!this.pronto) return;
    this.sujo = true;
    const cenaId = this.cena?.id;
    const zoom = this.vista.zoom;
    this.zoomDosDesenhos = zoom;
    const mov = this.desenhoMovido;
    const gravados: DesenhoNaTela[] = this.desenhosDaCena().map((desenho) =>
      mov?.id === desenho.id ? { desenho, dx: mov.dx, dy: mov.dy } : { desenho },
    );
    for (const [id, desenho] of this.pendentes) {
      if (desenho.cenaId === cenaId && !this.desenhos.some((d) => d.id === id)) {
        gravados.push({ desenho });
      }
    }
    this.desenhoLayer.desenharGravados(gravados, zoom);
    const andamento: DesenhoNaTela[] = [...this.rascunhosAlheios.values()]
      .filter((d) => d.cenaId === cenaId)
      .map((desenho) => ({ desenho, alpha: 0.85 }));
    const g = this.gesto;
    if (g?.tipo === "traco" && cenaId !== undefined) {
      andamento.push({ desenho: this.desenhoDoTraco(g, cenaId) });
    }
    this.desenhoLayer.desenharEmAndamento(andamento, zoom);
    const selecionadoId =
      this.opcoes.ferramenta === "pincel" ? this.opcoes.desenhoSelecionadoId : null;
    this.desenhoLayer.desenharSelecao(
      gravados.find((i) => i.desenho.id === selecionadoId) ?? null,
      zoom,
    );
  }

  /** O desenho que o traço em andamento descreve agora. */
  private desenhoDoTraco(g: Extract<Gesto, { tipo: "traco" }>, cenaId: string): Desenho {
    const { forma, cor, espessura, preenchido } = this.opcoes.pincel;
    const primeiro = g.pontos[0] ?? { x: 0, y: 0 };
    const ultimo = g.pontos[g.pontos.length - 1] ?? primeiro;
    return {
      id: g.id,
      cenaId,
      autorId: this.opcoes.usuarioId,
      forma,
      pontos: forma === "livre" ? g.pontos : [primeiro, ultimo],
      cor,
      espessura,
      ...((forma === "retangulo" || forma === "circulo") && preenchido ? { preenchido: true } : {}),
    };
  }

  /** Posso mexer neste desenho (mover, apagar, selecionar)? O mestre em todos; o jogador nos dele. */
  private desenhoMeu(d: Desenho): boolean {
    return this.opcoes.euMestre || d.autorId === this.opcoes.usuarioId;
  }

  /** O desenho de cima sob o ponto (metros) entre os que posso mexer; `null` se não há. */
  private desenhoEm(m: Ponto): Desenho | null {
    const alvoMinimo = 8 / (this.vista.zoom * PX_POR_M);
    const lista = this.desenhosDaCena();
    for (let i = lista.length - 1; i >= 0; i--) {
      const d = lista[i] as Desenho;
      if (!this.desenhoMeu(d)) continue;
      const margem = d.espessura / PX_POR_M / 2 + alvoMinimo;
      if (desenhoTocadoEm(d, m, margem)) return d;
    }
    return null;
  }

  private apertarComPincel(p: Ponto, e: PointerEvent): void {
    const cena = this.cena;
    if (!cena || !this.opcoes.podeDesenhar) return;
    const m = this.paraMundo(p);
    const modo = this.opcoes.pincel.modo;
    if (modo === "formas") {
      const id = `des-${crypto.randomUUID().slice(0, 8)}`;
      const inicio = limitarNaCena(m, cena);
      const limitador = criarLimitador<undefined>(
        () => this.enviarRascunho(),
        {
          agora: () => performance.now(),
          agendar: (fn, ms) => setTimeout(fn, ms),
          cancelar: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
        },
        80, // ~80 ms entre rascunhos; o soltar sai por fora (grava) e o pendente é descartado
      );
      this.gesto = { tipo: "traco", id, pontos: [inicio], limitador };
      this.app.canvas.setPointerCapture(e.pointerId);
      this.redesenharDesenhos();
      limitador.enviar(undefined);
      return;
    }
    if (modo === "selecionar") {
      const alvo = this.desenhoEm(m);
      this.retornos().selecionarDesenho(alvo?.id ?? null);
      if (!alvo) return;
      this.gesto = { tipo: "desenhoMover", id: alvo.id, inicio: m };
      this.app.canvas.setPointerCapture(e.pointerId);
      return;
    }
    this.gesto = { tipo: "borracha" };
    this.app.canvas.setPointerCapture(e.pointerId);
    this.apagarPorBorracha(m);
  }

  private moverComPincel(
    g: Extract<Gesto, { tipo: "traco" | "desenhoMover" | "borracha" }>,
    m: Ponto,
  ): void {
    const cena = this.cena;
    if (!cena) return;
    if (g.tipo === "borracha") {
      this.apagarPorBorracha(m);
      return;
    }
    if (g.tipo === "desenhoMover") {
      const d = this.desenhos.find((x) => x.id === g.id);
      if (!d) return;
      const { dx, dy } = deslocamentoNaCena(d, cena, m.x - g.inicio.x, m.y - g.inicio.y);
      this.desenhoMovido = { id: d.id, dx, dy, chave: JSON.stringify(d.pontos) };
      this.redesenharDesenhos();
      return;
    }
    const alvo = limitarNaCena(m, cena);
    if (this.opcoes.pincel.forma === "livre") {
      const ultimo = g.pontos[g.pontos.length - 1];
      // Um pingo de 3 cm (≈1 px) ou menos não vira ponto: o traço fica leve.
      if (ultimo && Math.hypot(alvo.x - ultimo.x, alvo.y - ultimo.y) < 0.03) return;
      g.pontos.push(alvo);
      if (g.pontos.length > 4000) g.pontos = prepararTraco(g.pontos);
    } else {
      g.pontos = [g.pontos[0] ?? alvo, alvo];
    }
    this.redesenharDesenhos();
    g.limitador.enviar(undefined);
  }

  /** Manda o traço em andamento para os outros (só repassado; nunca gravado). */
  private enviarRascunho(): void {
    const g = this.gesto;
    const cena = this.cena;
    if (g?.tipo !== "traco" || !cena) return;
    const d = this.desenhoDoTraco(g, cena.id);
    this.retornos().rascunhoDeDesenho(g.id, {
      cenaId: cena.id,
      forma: d.forma,
      pontos: d.forma === "livre" ? prepararTraco(d.pontos) : d.pontos.map(arredondarPonto),
      cor: d.cor,
      espessura: d.espessura,
      ...(d.preenchido ? { preenchido: true } : {}),
    });
  }

  /** A borracha apaga o desenho inteiro que tocar: ele some na hora e o pedido sai ao soltar. */
  private apagarPorBorracha(m: Ponto): void {
    const alvo = this.desenhoEm(m);
    if (!alvo) return;
    this.apagadosLocais.add(alvo.id);
    this.apagadosPelaBorracha.add(alvo.id);
    this.redesenharDesenhos();
  }

  private soltarComPincel(
    g: Extract<Gesto, { tipo: "traco" | "desenhoMover" | "borracha" }>,
  ): void {
    const cena = this.cena;
    if (g.tipo === "borracha") {
      const ids = [...this.apagadosPelaBorracha];
      this.apagadosPelaBorracha.clear();
      if (ids.length > 0) this.retornos().apagarDesenhos(ids);
      // Se a sala recusar, o desenho volta a aparecer.
      setTimeout(() => {
        for (const id of ids) this.apagadosLocais.delete(id);
        this.redesenhaSePronto();
      }, 1500);
      return;
    }
    if (g.tipo === "desenhoMover") {
      const mov = this.desenhoMovido;
      if (mov && (mov.dx !== 0 || mov.dy !== 0)) {
        this.retornos().moverDesenho(mov.id, mov.dx, mov.dy);
        // Fica onde foi solto até a sala confirmar; se ela recusar, volta ao lugar.
        setTimeout(() => {
          this.desenhoMovido = null;
          this.redesenhaSePronto();
        }, 900);
      } else {
        this.desenhoMovido = null;
      }
      this.redesenharDesenhos();
      return;
    }
    // Traço: a sala grava com o mesmo id do rascunho.
    g.limitador.cancelar();
    if (!cena) return;
    const d = this.desenhoDoTraco(g, cena.id);
    const pontos = d.forma === "livre" ? prepararTraco(d.pontos) : d.pontos.map(arredondarPonto);
    const [a, b] = pontos;
    if (d.forma !== "livre" && a && b && Math.hypot(b.x - a.x, b.y - a.y) < 0.05) {
      // Um clique sem arrastar não faz linha, retângulo nem círculo.
      this.retornos().rascunhoDeDesenho(g.id, null);
      this.redesenharDesenhos();
      return;
    }
    const final: Desenho = { ...d, pontos };
    this.pendentes.set(final.id, final);
    setTimeout(() => {
      this.pendentes.delete(final.id);
      this.redesenhaSePronto();
    }, 2000);
    this.retornos().criarDesenho({
      id: final.id,
      cenaId: cena.id,
      forma: final.forma,
      pontos,
      cor: final.cor,
      espessura: final.espessura,
      ...(final.preenchido ? { preenchido: true } : {}),
    });
    this.redesenharDesenhos();
  }

  private redesenhaSePronto(): void {
    if (this.pronto) this.redesenharDesenhos();
  }

  /** Esc, troca de ferramenta ou de cena: o traço em andamento é descartado e o rascunho some. */
  private cancelarTraco(): void {
    const g = this.gesto;
    if (g?.tipo !== "traco") return;
    g.limitador.cancelar();
    this.gesto = null;
    this.retornos().rascunhoDeDesenho(g.id, null);
    this.redesenharDesenhos();
    this.atualizarCursor();
  }

  /** Delete: apaga o desenho selecionado (se for meu, ou se eu for o mestre). */
  private apagarSelecionado(): void {
    const id = this.opcoes.desenhoSelecionadoId;
    const d = id === null ? undefined : this.desenhos.find((x) => x.id === id);
    if (!d || !this.desenhoMeu(d)) return;
    this.retornos().apagarDesenhos([d.id]);
    this.retornos().selecionarDesenho(null);
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
          /** O anel da vez (ordem de turno) está aceso. */
          emVez: v.anelVez.visible,
          /** O anel de seleção (dourado) está aceso. */
          selecionado: v.anel.visible,
          /** Os marcadores de condição desenhados na borda. */
          marcas: v.marcas.map((m) => m.titulo),
        })),
      /** A prévia do modo "pôr token": onde está (metros) ou `null` se não aparece. */
      previaDoToken: () =>
        this.previaDoToken.visible
          ? { x: this.previaDoToken.x / PX_POR_M, y: this.previaDoToken.y / PX_POR_M }
          : null,
      /** Onde está o marcador `indice` do token (posição na página), para passar o mouse. */
      marcaNaPagina: (id: string, indice: number) => {
        const v = this.visuais.get(id);
        const m = v?.marcas[indice];
        if (!v || !m) return null;
        const r = this.app.canvas.getBoundingClientRect();
        const t = this.paraTela(v.x + m.ox / PX_POR_M, v.y + m.oy / PX_POR_M);
        return { x: r.left + t.x, y: r.top + t.y };
      },
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
      paredes: () =>
        this.paredes.map((q) => ({
          id: q.id,
          tipo: q.tipo,
          estado: q.estado,
          a: q.a,
          b: q.b,
          meio: q.meio,
        })),
      /** V5: os contornos estão desenhados (ferramenta de paredes, Visão do mestre ou opção da cena)? */
      contornos: () => this.contornosVisiveis(),
      /** V5: a porta sob o cursor (destaque), o modo de arco, o cursor do mouse e o ponto de fixação. */
      portaDestacada: () => this.portaSob,
      modoArco: () => this.modoArco,
      cursor: () => this.app.canvas.style.cursor,
      pontoDeFixacao: () => this.cursorDaParede,
      /** A visão: modo, fontes e quantos polígonos; e se um ponto (metros) está dentro da união. */
      visao: () => ({
        modo: this.opcoes.visao.modo,
        poligonos: this.modelo?.visao.length ?? 0,
      }),
      veNoPonto: (x: number, y: number) =>
        this.opcoes.visao.modo === "claro" ||
        (this.modelo !== null && veNoPonto(this.modelo, { x, y })),
      veuVisivel: () => this.camada.multiplicar.visible,
      /** O que o jogador vê no ponto: "nenhuma", "cinza", "penumbra" ou "plena" (só no modo jogador). */
      visaoNoPonto: (x: number, y: number) =>
        this.modelo ? visaoNoPonto(this.modelo, { x, y }) : "plena",
      /** Nível de luz (0 a 1) no ponto: ambiente mais as luzes que chegam ali. */
      nivelNoPonto: (x: number, y: number) => (this.modelo ? nivelDeLuz(this.modelo, { x, y }) : 1),
      /** As luzes que valem agora (com os raios efetivos: intensidade × fator geral). */
      luzes: () =>
        (this.modelo?.luzes ?? []).map(({ luz }) => ({
          id: luz.id,
          x: luz.x,
          y: luz.y,
          claraM: luz.claraM,
          totalM: luz.totalM,
        })),
      /** A memória do mapa: células lembradas, se há gravação pendente e o que lembra do ponto. */
      memoria: () => ({
        carregada: this.gradeDaMemoria !== null,
        lembradas: this.gradeDaMemoria ? contarLembradas(this.gradeDaMemoria) : 0,
        pendente: this.memoriaSuja || this.gravando > 0 || this.memoriaPendente,
        esquecimento: this.esquecimentoAplicado,
        alcancesM: this.fontesDeMemoria().map((f) => f.alcanceM),
      }),
      lembraNoPonto: (x: number, y: number) =>
        this.gradeDaMemoria !== null && lembraDoPonto(this.gradeDaMemoria, { x, y }),
      opacidadeDaMemoria: (x: number, y: number) =>
        this.gradeDaMemoria
          ? opacidadeNoPonto(this.gradeDaMemoria, this.fontesDeMemoria(), { x, y })
          : 0,
      /** Posição de cada marca de luz que o mestre vê (metros). */
      marcasDeLuz: () =>
        this.marcasVisiveis()
          ? this.posicoesDasLuzes().map((i) => ({ id: i.luz.id, ...i.pos }))
          : [],
      /** As alças das tochas e os ícones dos objetos nos pontos (posição na página, em pixels). */
      alcas: () => {
        const r = this.app.canvas.getBoundingClientRect();
        return this.alcasDaTela().map(({ luz, mundo }) => {
          const t = this.paraTela(mundo.x, mundo.y);
          return {
            id: luz.id,
            estado: luz.estado,
            portador: luz.portador.tipo,
            rotulo: this.rotuloDaAlca(luz),
            x: r.left + t.x,
            y: r.top + t.y,
          };
        });
      },
      /** Os pontos de luz que a tela mostra (posição na página) e a contagem de acender, se houver. */
      pontos: () => {
        const r = this.app.canvas.getBoundingClientRect();
        return this.pontosDaTela().map((p) => {
          const t = this.paraTela(p.x, p.y);
          return { id: p.id, tipo: p.tipo, x: r.left + t.x, y: r.top + t.y };
        });
      },
      anelDeAcender: () => this.progressoDeAcender(),
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
      /** V10b: a área em volta da bandeira está acesa (o jogador arrasta a ficha). */
      areaDaBandeiraAcesa: () => this.opcoes.acenderAreaDaBandeira,
      definirZoom: (z: number) => this.definirZoom(z),
      centrarEm: (x: number, y: number) => this.centrarEm(x, y),
      quadradoM: () => this.quadradoM(),
      ferramenta: () => this.opcoes.ferramenta,
      /** Os desenhos que a tela mostra (da cena vista) e o selecionado. */
      desenhos: () =>
        this.desenhosDaCena().map((d) => ({
          id: d.id,
          forma: d.forma,
          autorId: d.autorId,
          cor: d.cor,
          pontos: d.pontos.length,
          ponto0: d.pontos[0] ?? null,
          preenchido: d.preenchido === true,
        })),
      desenhoSelecionado: () => this.opcoes.desenhoSelecionadoId,
      /** Os traços em andamento de outras pessoas que a tela mostra. */
      rascunhos: () =>
        [...this.rascunhosAlheios.values()]
          .filter((d) => d.cenaId === this.cena?.id)
          .map((d) => ({ id: d.id, autorId: d.autorId, forma: d.forma, pontos: d.pontos.length })),
      /** Um ponto sobre o traço do desenho (posição na página), para clicar nele. */
      desenhoNaPagina: (id: string) => {
        const d = this.desenhos.find((x) => x.id === id);
        const [a, b] = d?.pontos ?? [];
        if (!d || !a) return null;
        let m: Ponto = a;
        if (d.forma === "livre") m = d.pontos[Math.floor(d.pontos.length / 2)] ?? a;
        else if (d.forma === "linha" && b) m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        else if (d.forma === "retangulo" && b) m = { x: (a.x + b.x) / 2, y: a.y };
        else if (d.forma === "circulo" && b)
          m = { x: a.x + Math.hypot(b.x - a.x, b.y - a.y), y: a.y };
        const r = this.app.canvas.getBoundingClientRect();
        const t = this.paraTela(m.x, m.y);
        return { x: r.left + t.x, y: r.top + t.y };
      },
      /** A camada de desenho está acima do véu da luz e da memória (visível no escuro)? */
      camadaDeDesenho: () => {
        const filhos = this.mundo.children;
        const i = filhos.indexOf(this.desenhoLayer.container);
        return {
          acimaDoVeu:
            i > filhos.indexOf(this.camada.cinza) && i > filhos.indexOf(this.camada.multiplicar),
          visivel: this.desenhoLayer.container.visible,
        };
      },
      /** A cor (RGBA) que a tela mostra num ponto do mapa, com véu e tudo (renderiza de novo). */
      pixelNoMapa: (xM: number, yM: number) => {
        const t = this.paraTela(xM, yM);
        this.app.render();
        const r = this.app.renderer.extract.pixels({
          target: this.app.stage,
          frame: new Rectangle(Math.round(t.x), Math.round(t.y), 1, 1),
        });
        return [...r.pixels];
      },
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
