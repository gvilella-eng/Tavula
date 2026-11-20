import {
  corEmCanais,
  type LuzCalculada,
  type ModeloDeLuz,
  NIVEL_PENUMBRA,
  PASSO_DE_LUZ,
  type Ponto,
} from "@tabletop/shared";
import {
  CanvasSource,
  Container,
  Graphics,
  type Renderer,
  RenderTexture,
  Sprite,
  Texture,
} from "pixi.js";

/** Pixels do mundo por metro (o mesmo do mapa; repetido aqui para não importar o mapa de volta). */
const PX_POR_M = 40;
/** Lado maior, em pixels, das texturas da luz (a luz tem bordas suaves; não precisa de mais). */
const LADO_MAXIMO = 1800;
/** Quanto a cor da luz tinge a cena (0 = só branco, 1 = a cor inteira). */
const TINTA = 0.5;
/** Fator (0 a 1) com que o mestre vê o que nenhum jogador enxerga. */
const FATOR_APAGADO = 0.45;
/**
 * Brilho somado (blend add) com a mesma textura que multiplica a cena: onde o jogador vê, o chão
 * escuro de um mapa sem imagem ganha um pouco de luz, e a luz deixa de parecer só uma ausência de
 * escuro. Pequeno de propósito (num mapa claro quase não se nota).
 */
const BRILHO = 0.1;
const CLARO = [0, 0, 0, 0] as [number, number, number, number];
const PRETO = [0, 0, 0, 1] as [number, number, number, number];

/** O que a camada precisa para desenhar a luz: o modelo calculado e, para o jogador, a memória. */
export type EntradaDaLuz = {
  modo: "jogador" | "noturna";
  larguraM: number;
  alturaM: number;
  modelo: ModeloDeLuz;
  /** Memória do mapa (jogador): a imagem RGBA, uma célula por pixel. `null`: sem memória. */
  memoria: { colunas: number; linhas: number; celulaM: number; imagem: Uint8ClampedArray } | null;
};

const numero = (r: number, g: number, b: number) =>
  (Math.round(Math.min(255, Math.max(0, r))) << 16) |
  (Math.round(Math.min(255, Math.max(0, g))) << 8) |
  Math.round(Math.min(255, Math.max(0, b)));

/** O mesmo polígono vira pixels várias vezes por atualização (e pelo CacheDeLuz entre elas): guarda por identidade. */
const planos = new WeakMap<readonly Ponto[], number[]>();

/** Nunca mute o array devolvido: o Graphics do Pixi guarda a referência (e ela é compartilhada pelo cache). */
const plano = (pontos: readonly Ponto[]): number[] => {
  let feito = planos.get(pontos);
  if (!feito) {
    feito = pontos.flatMap((q) => [q.x * PX_POR_M, q.y * PX_POR_M]);
    planos.set(pontos, feito);
  }
  return feito;
};

/** Cor que uma luz soma por passo (penumbra ou luz plena), já tingida e com a tremulação aplicada. */
function corDoPasso(cor: string, fator: number): number {
  const { r, g, b } = corEmCanais(cor);
  const tinge = (c: number) => 255 - (255 - c) * TINTA;
  const k = PASSO_DE_LUZ * fator;
  return numero(tinge(r) * k, tinge(g) * k, tinge(b) * k);
}

/**
 * A luz e a escuridão da cena, só de tela. Desenha em texturas do tamanho da cena e entrega dois
 * sprites para pôr sobre o mapa:
 * - `multiplicar` (blend multiply): quanto da cena aparece em cada ponto (a luz que chega onde o jogador
 *   vê; onde ele não vê, a memória do mapa ou o preto);
 * - `cinza` (blend saturation): o que aparece em tons de cinza (o escuro dentro da visão no escuro).
 *
 * Os polígonos vêm prontos (`ModeloDeLuz`); aqui só se desenha. A tremulação (`atualizarBrilho`) refaz
 * só a luz, sem recalcular polígonos.
 */
export class CamadaDeLuz {
  readonly multiplicar = new Sprite();
  readonly brilho = new Sprite();
  readonly cinza = new Sprite();
  private texturas: {
    /** Onde o jogador não vê agora (branco com alfa). */
    naoVisto: RenderTexture;
    /** A luz (ambiente, penumbra, luz plena e meia luz da visão no escuro), só onde ele vê. */
    luz: RenderTexture;
    /** O que vai multiplicar a cena (e, antes disso, o "sem luz" do passo 1). */
    saida: RenderTexture;
    /** O escuro dentro da visão no escuro (vira cinza). */
    cinza: RenderTexture;
    /** A união da visão no escuro. */
    dv: RenderTexture;
  } | null = null;
  private tamanho = { w: 0, h: 0 };
  // Desenhos reaproveitados a cada passagem.
  private readonly gNaoVistoFundo = new Graphics();
  private readonly gNaoVistoBuracos = new Graphics();
  private readonly gNaoLuzFundo = new Graphics();
  private readonly gNaoLuzBuracos = new Graphics();
  private readonly gLuzFundo = new Graphics();
  private readonly gLuzes = new Graphics();
  private readonly gEscuro = new Graphics();
  private readonly gCinzaApagar = new Graphics();
  private readonly passoNaoVisto = new Container();
  private readonly passoNaoLuz = new Container();
  private readonly passoLuz = new Container();
  private readonly passoSaida = new Container();
  private readonly passoCinza1 = new Container();
  private readonly passoCinza2 = new Container();
  private readonly passoApagarLuz = new Container();
  private readonly passoUniao = new Container();
  // FG2: a luz do mestre onde nenhum jogador vê (cor e alcance de toda luz, com as paredes).
  private extras: { visto: RenderTexture; luzGm: RenderTexture } | null = null;
  private readonly gVistoFundo = new Graphics();
  private readonly gLuzesGm = new Graphics();
  private readonly spriteNaoVistoApaga = new Sprite();
  private readonly spriteVisto = new Sprite();
  private readonly spriteLuzGm = new Sprite();
  private readonly passoVisto = new Container();
  private readonly passoLuzGm = new Container();
  private readonly spriteNaoLuz = new Sprite();
  private readonly spriteNaoVisto = new Sprite();
  private readonly spriteLuz = new Sprite();
  private readonly spriteDvNoCinza = new Sprite();
  private readonly spriteCinzaNaLuz = new Sprite();
  private readonly spriteMemoria = new Sprite();
  private readonly spriteSaidaNaoVisto = new Sprite();
  private memoria: {
    source: CanvasSource;
    textura: Texture;
    canvas: HTMLCanvasElement;
    chave: string;
    /** A imagem que já está na textura (só sobe de novo quando muda). */
    imagem: Uint8ClampedArray | null;
  } | null = null;
  private entrada: EntradaDaLuz | null = null;

  constructor(private readonly renderer: Renderer) {
    this.multiplicar.blendMode = "multiply";
    this.brilho.blendMode = "add";
    this.brilho.alpha = BRILHO;
    this.brilho.visible = false;
    this.cinza.blendMode = "saturation";
    this.multiplicar.visible = false;
    this.cinza.visible = false;
    this.gNaoVistoBuracos.blendMode = "erase";
    this.gNaoLuzBuracos.blendMode = "erase";
    this.gCinzaApagar.blendMode = "erase";
    this.gLuzes.blendMode = "add";
    this.spriteCinzaNaLuz.blendMode = "add";
    this.spriteCinzaNaLuz.tint = 0x808080;
    this.spriteNaoVisto.blendMode = "erase";
    this.spriteSaidaNaoVisto.tint = numero(
      255 * FATOR_APAGADO,
      255 * FATOR_APAGADO,
      255 * FATOR_APAGADO,
    );
    this.passoNaoVisto.addChild(this.gNaoVistoFundo, this.gNaoVistoBuracos);
    this.passoNaoLuz.addChild(this.gNaoLuzFundo, this.gNaoLuzBuracos);
    this.passoLuz.addChild(this.gLuzFundo, this.gLuzes, this.spriteCinzaNaLuz);
    this.passoCinza1.addChild(this.gEscuro);
    this.passoCinza2.addChild(this.spriteDvNoCinza, this.gCinzaApagar);
    this.passoApagarLuz.addChild(this.spriteNaoVisto);
    this.passoUniao.addChild(this.spriteNaoLuz);
    this.gLuzesGm.blendMode = "add";
    this.spriteNaoVistoApaga.blendMode = "erase";
    this.spriteVisto.blendMode = "erase";
    this.spriteLuzGm.blendMode = "add";
    this.spriteLuzGm.tint = numero(
      255 * (1 - FATOR_APAGADO),
      255 * (1 - FATOR_APAGADO),
      255 * (1 - FATOR_APAGADO),
    );
    this.passoVisto.addChild(this.gVistoFundo, this.spriteNaoVistoApaga);
    this.passoLuzGm.addChild(this.gLuzesGm, this.spriteVisto);
  }

  /** Esconde a camada (sem luz dinâmica: a cena fica toda clara). */
  esconder(): void {
    this.entrada = null;
    this.multiplicar.visible = false;
    this.brilho.visible = false;
    this.cinza.visible = false;
  }

  destruir(): void {
    this.liberar();
    this.memoria?.source.destroy();
    this.memoria = null;
  }

  private liberar(): void {
    if (!this.texturas) return;
    for (const t of Object.values(this.texturas)) t.destroy(true);
    this.texturas = null;
    if (this.extras) {
      this.extras.visto.destroy(true);
      this.extras.luzGm.destroy(true);
      this.extras = null;
    }
  }

  private garantirTexturas(w: number, h: number): NonNullable<CamadaDeLuz["texturas"]> {
    if (this.texturas && this.tamanho.w === w && this.tamanho.h === h) return this.texturas;
    this.liberar();
    const resolution = Math.min(1, LADO_MAXIMO / Math.max(w, h));
    const criar = () => RenderTexture.create({ width: w, height: h, resolution });
    this.texturas = {
      naoVisto: criar(),
      luz: criar(),
      saida: criar(),
      cinza: criar(),
      dv: criar(),
    };
    this.tamanho = { w, h };
    return this.texturas;
  }

  /**
   * FG2: só no mestre. A luz de TODAS as fontes (cor tingida como a do jogador, sem tremular, limitada pelas paredes) apenas
   * onde nenhum jogador vê: o resto da textura fica transparente. Soma-se por cima do cinza apagado da visão do mestre.
   */
  private prepararLuzDoMestre(
    w: number,
    h: number,
    t: NonNullable<CamadaDeLuz["texturas"]>,
    modelo: ModeloDeLuz,
  ): void {
    if (!this.extras) {
      const resolution = Math.min(1, LADO_MAXIMO / Math.max(w, h));
      const criar = () => RenderTexture.create({ width: w, height: h, resolution });
      this.extras = { visto: criar(), luzGm: criar() };
    }
    // onde algum jogador vê = o contrário do "não visto"
    this.gVistoFundo.clear().rect(0, 0, w, h).fill(0xffffff);
    this.spriteNaoVistoApaga.texture = t.naoVisto;
    this.desenhar(this.passoVisto, this.extras.visto, true);
    this.gLuzesGm.clear();
    for (const l of modelo.luzes) {
      const cor = corDoPasso(l.luz.cor, 1);
      if (l.total.length >= 3) this.gLuzesGm.poly(plano(l.total)).fill(cor);
      if (l.clara.length >= 3) this.gLuzesGm.poly(plano(l.clara)).fill(cor);
    }
    this.spriteVisto.texture = this.extras.visto;
    this.desenhar(this.passoLuzGm, this.extras.luzGm, true, PRETO);
  }

  private desenhar(container: Container, alvo: RenderTexture, limpar: boolean, cor = CLARO): void {
    this.renderer.render({ container, target: alvo, clear: limpar, clearColor: cor });
  }

  /** A memória do mapa vira uma textura (uma célula por pixel, ampliada com suavização). */
  private texturaDaMemoria(m: NonNullable<EntradaDaLuz["memoria"]>): Texture {
    const chave = `${m.colunas}x${m.linhas}`;
    if (!this.memoria || this.memoria.chave !== chave) {
      this.memoria?.source.destroy();
      const canvas = document.createElement("canvas");
      canvas.width = m.colunas;
      canvas.height = m.linhas;
      const source = new CanvasSource({ resource: canvas, scaleMode: "linear" });
      this.memoria = { canvas, chave, source, textura: new Texture({ source }), imagem: null };
    }
    const ctx = this.memoria.imagem === m.imagem ? null : this.memoria.canvas.getContext("2d");
    if (ctx) {
      this.memoria.imagem = m.imagem;
      const dados = new ImageData(m.imagem as Uint8ClampedArray<ArrayBuffer>, m.colunas, m.linhas); // o putImageData copia já, então a cópia extra era à toa
      ctx.putImageData(dados, 0, 0);
      this.memoria.source.update();
    }
    return this.memoria.textura;
  }

  /** Redesenha tudo (polígonos novos, memória nova, config nova). */
  atualizar(entrada: EntradaDaLuz, agora: number): void {
    this.entrada = entrada;
    const w = Math.ceil(entrada.larguraM * PX_POR_M);
    const h = Math.ceil(entrada.alturaM * PX_POR_M);
    const t = this.garantirTexturas(w, h);
    const { modelo } = entrada;
    const escuroNaCena = modelo.ambiente < NIVEL_PENUMBRA;

    // 1. Onde o jogador NÃO vê: tudo, menos a união dos polígonos de visão (blend erase, como no véu do
    //    Lote 5) e, no escuro, menos onde há luz ou visão no escuro.
    this.gNaoVistoFundo.clear().rect(0, 0, w, h).fill(0xffffff);
    this.gNaoVistoBuracos.clear();
    for (const p of modelo.visao) {
      if (p.length >= 3) this.gNaoVistoBuracos.poly(plano(p)).fill(0xffffff);
    }
    this.desenhar(this.passoNaoVisto, t.naoVisto, true);
    if (escuroNaCena) {
      this.gNaoLuzFundo.clear().rect(0, 0, w, h).fill(0xffffff);
      this.gNaoLuzBuracos.clear();
      for (const l of modelo.luzes) {
        if (l.total.length >= 3) this.gNaoLuzBuracos.poly(plano(l.total)).fill(0xffffff);
      }
      for (const p of modelo.escuro) {
        if (p.length >= 3) this.gNaoLuzBuracos.poly(plano(p)).fill(0xffffff);
      }
      // A textura de saída serve de rascunho aqui (é refeita adiante).
      this.desenhar(this.passoNaoLuz, t.saida, true);
      this.spriteNaoLuz.texture = t.saida;
      this.desenhar(this.passoUniao, t.naoVisto, false);
    }

    // 2. A visão no escuro: a união dos polígonos dela (soma meia luz) e, onde nenhuma luz chega, o cinza.
    this.gEscuro.clear();
    for (const p of modelo.escuro) {
      if (p.length >= 3) this.gEscuro.poly(plano(p)).fill(0xffffff);
    }
    // Sem visão no escuro o cinza nem aparece (`cinza.visible` abaixo) e `desenharLuz` não lê `dv` (o sprite fica
    // invisível): pula os dois passes de textura cheia. Ao voltar a haver escuro, esta mesma função os refaz antes
    // de qualquer uso, então nunca se vê textura velha.
    const temEscuro = modelo.escuro.length > 0;
    if (temEscuro) this.desenhar(this.passoCinza1, t.dv, true);
    this.spriteDvNoCinza.texture = t.dv;
    // O cinza é a visão no escuro menos o que alguma luz alcança (e nada, se a cena já tem luz de sobra).
    this.gCinzaApagar.clear();
    if (escuroNaCena) {
      for (const l of modelo.luzes) {
        if (l.total.length >= 3) this.gCinzaApagar.poly(plano(l.total)).fill(0xffffff);
      }
    } else {
      this.gCinzaApagar.rect(0, 0, w, h).fill(0xffffff);
    }
    if (temEscuro) this.desenhar(this.passoCinza2, t.cinza, true);
    this.cinza.texture = t.cinza;
    // FG2: o jogador com visão no escuro soma meia luz em toda a sua visão; o mestre soma só onde nenhuma luz chega,
    // senão a visão no escuro de um jogador lava a cor da tocha (clara de branco) e ele não consegue ajustá-la.
    this.spriteCinzaNaLuz.texture = entrada.modo === "noturna" ? t.cinza : t.dv;
    this.dimensionar(w, h);
    this.desenharLuz(agora);
    this.multiplicar.visible = true;
    this.brilho.visible = true;
    this.cinza.visible = modelo.escuro.length > 0;
    if (entrada.modo === "noturna") this.prepararLuzDoMestre(w, h, t, modelo);
    this.compor(w, h);
  }

  /** Só o brilho: a luz tremula sem recalcular polígono. */
  atualizarBrilho(agora: number): void {
    const e = this.entrada;
    // FG2: o mestre vê a cor e o alcance, mas não a tremulação (refazer a luz de dezenas de chamas a cada instante só para ele custava o dobro).
    if (e?.modo !== "jogador" || !this.texturas) return;
    this.desenharLuz(agora);
    this.compor(this.tamanho.w, this.tamanho.h);
  }

  /** A memória mudou (o jogador andou, ou o mestre mandou esquecer): refaz só a composição. */
  definirMemoria(memoria: EntradaDaLuz["memoria"]): void {
    const e = this.entrada;
    if (e?.modo !== "jogador" || !this.texturas) return;
    e.memoria = memoria;
    this.compor(this.tamanho.w, this.tamanho.h);
  }

  /**
   * Só para teste (o gancho do modo e2e): a cor (0 a 255) que a luz multiplica na cena no ponto, em metros, lida da
   * textura já composta; é o que o jogador, ou o mestre na visão de mestre, vê ali.
   */
  corNoPonto(xM: number, yM: number): [number, number, number] | null {
    const t = this.texturas;
    if (!t || !this.multiplicar.visible) return null;
    const x = Math.max(0, Math.min(this.tamanho.w - 1, Math.floor(xM * PX_POR_M)));
    const y = Math.max(0, Math.min(this.tamanho.h - 1, Math.floor(yM * PX_POR_M)));
    const r = this.renderer.extract.pixels(t.saida);
    const res = r.width / this.tamanho.w;
    const i = (Math.floor(y * res) * r.width + Math.floor(x * res)) * 4;
    return [r.pixels[i] ?? 0, r.pixels[i + 1] ?? 0, r.pixels[i + 2] ?? 0];
  }

  /** Há alguma luz que tremula (para a tela saber se precisa chamar `atualizarBrilho`)? */
  temTremula(): boolean {
    return this.entrada?.modo === "jogador" && this.entrada.modelo.luzes.some((l) => l.luz.tremula);
  }

  private dimensionar(w: number, h: number): void {
    for (const s of [this.multiplicar, this.brilho, this.cinza]) {
      s.position.set(0, 0);
      s.width = w;
      s.height = h;
    }
  }

  /** A textura de luz: ambiente de fundo, penumbra e luz plena somadas, mais meia luz na visão no escuro. */
  private desenharLuz(agora: number): void {
    const e = this.entrada;
    const t = this.texturas;
    if (!e || !t) return;
    const { modelo } = e;
    const w = this.tamanho.w;
    const h = this.tamanho.h;
    const a = Math.round(Math.min(1, Math.max(0, modelo.ambiente)) * 255);
    this.gLuzFundo
      .clear()
      .rect(0, 0, w, h)
      .fill(numero(a, a, a));
    this.gLuzes.clear();
    for (const l of modelo.luzes) this.desenharUmaLuz(l, agora);
    this.spriteCinzaNaLuz.visible = modelo.escuro.length > 0;
    this.spriteNaoVisto.texture = t.naoVisto;
    // A luz, só onde o jogador vê (o "não visto" apaga o resto).
    this.desenhar(this.passoLuz, t.luz, true, PRETO);
    this.desenhar(this.passoApagarLuz, t.luz, false);
  }

  private desenharUmaLuz(l: LuzCalculada, agora: number): void {
    // Tremulação leve: o brilho oscila alguns por cento (a fase vem do id, para as luzes não pulsarem
    // juntas). No estágio "morrendo" (tocha no fim) ela oscila bem mais e mais rápido.
    let fator = 1;
    if (l.luz.tremula) {
      let fase = 0;
      for (const c of l.luz.id) fase = (fase * 31 + c.charCodeAt(0)) % 1000;
      const amplitude = l.luz.morrendo ? 0.4 : 0.12;
      const ritmo = l.luz.morrendo ? 2.6 : 1;
      fator =
        1 -
        amplitude +
        amplitude *
          (0.5 +
            0.25 * Math.sin(agora * 0.011 * ritmo + fase) +
            0.25 * Math.sin(agora * 0.0173 * ritmo + fase * 2.1));
    }
    const cor = corDoPasso(l.luz.cor, fator);
    if (l.total.length >= 3) this.gLuzes.poly(plano(l.total)).fill(cor);
    if (l.clara.length >= 3) this.gLuzes.poly(plano(l.clara)).fill(cor);
  }

  /** Junta a memória (onde o jogador não vê agora) e a luz (onde vê) na textura de saída. */
  private compor(_w: number, _h: number): void {
    const e = this.entrada;
    const t = this.texturas;
    if (!e || !t) return;
    this.passoSaida.removeChildren();
    if (e.modo === "noturna") {
      // FG2: o mestre vê a MESMA luz que o jogador (cor, alcance, tremulação) onde algum jogador vê; o resto fica
      // mais apagado (o cinza do fator) com a cor de toda luz por cima. Nada some para ele.
      this.spriteLuz.texture = t.luz;
      this.spriteSaidaNaoVisto.texture = t.naoVisto;
      this.passoSaida.addChild(this.spriteLuz, this.spriteSaidaNaoVisto);
      if (this.extras) {
        this.spriteLuzGm.texture = this.extras.luzGm;
        this.passoSaida.addChild(this.spriteLuzGm);
      }
      this.desenhar(this.passoSaida, t.saida, true, PRETO);
      this.multiplicar.texture = t.saida;
      this.brilho.texture = t.saida;
      this.passoSaida.removeChildren();
      return;
    }
    if (e.memoria) {
      this.spriteMemoria.texture = this.texturaDaMemoria(e.memoria);
      this.spriteMemoria.position.set(0, 0);
      this.spriteMemoria.width = e.memoria.colunas * e.memoria.celulaM * PX_POR_M;
      this.spriteMemoria.height = e.memoria.linhas * e.memoria.celulaM * PX_POR_M;
      this.passoSaida.addChild(this.spriteMemoria);
    }
    this.spriteLuz.texture = t.luz;
    this.passoSaida.addChild(this.spriteLuz);
    this.desenhar(this.passoSaida, t.saida, true, PRETO);
    this.multiplicar.texture = t.saida;
    this.brilho.texture = t.saida;
    this.passoSaida.removeChildren();
  }
}
