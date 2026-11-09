import { caixaDoDesenho, type Desenho } from "@tabletop/shared";
import { Container, Graphics } from "pixi.js";

/** Pixels do mundo por metro (o mesmo do mapa; repetido aqui para não importar o mapa de volta). */
const PX_POR_M = 40;
const ACENTO = 0xe0a030;
/** Nunca mais fino que isto na tela, qualquer que seja o zoom. */
const MINIMO_NA_TELA_PX = 1.5;

/** Um desenho com o deslocamento local (o arrasto antes de a sala confirmar). */
export type DesenhoNaTela = { desenho: Desenho; dx?: number; dy?: number; alpha?: number };

function corEmNumero(cor: string): number {
  return Number.parseInt(cor.slice(1), 16);
}

/** Traça um desenho no `Graphics`: coordenadas em metros viram pixels do mundo. */
function tracar(g: Graphics, item: DesenhoNaTela, zoom: number): void {
  const { desenho: d } = item;
  const dx = item.dx ?? 0;
  const dy = item.dy ?? 0;
  const alpha = item.alpha ?? 1;
  const cor = corEmNumero(d.cor);
  const largura = Math.max(d.espessura, MINIMO_NA_TELA_PX / zoom);
  const pontos = d.pontos.map((p) => ({ x: (p.x + dx) * PX_POR_M, y: (p.y + dy) * PX_POR_M }));
  const [a, b] = pontos;
  if (!a) return;
  const traco = { width: largura, color: cor, alpha, cap: "round", join: "round" } as const;
  switch (d.forma) {
    case "livre": {
      if (pontos.length === 1) {
        g.circle(a.x, a.y, largura / 2).fill({ color: cor, alpha });
        return;
      }
      g.moveTo(a.x, a.y);
      for (const p of pontos.slice(1)) g.lineTo(p.x, p.y);
      g.stroke(traco);
      return;
    }
    case "linha":
      if (b) g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke(traco);
      return;
    case "retangulo": {
      if (!b) return;
      g.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      if (d.preenchido) g.fill({ color: cor, alpha: alpha * 0.4 });
      g.stroke(traco);
      return;
    }
    case "circulo": {
      if (!b) return;
      g.circle(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y));
      if (d.preenchido) g.fill({ color: cor, alpha: alpha * 0.4 });
      g.stroke(traco);
      return;
    }
  }
}

/**
 * A camada de desenho (Lote 13): fica por cima do mapa, dos tokens e do véu da luz, então aparece
 * também no escuro. Três `Graphics`: os desenhos gravados, os traços em andamento (o meu e os dos
 * outros) e o destaque da seleção. Tudo é redesenhado de uma vez quando algo muda (ou o zoom).
 */
export class CamadaDeDesenho {
  readonly container = new Container();
  private readonly gravados = new Graphics();
  private readonly emAndamento = new Graphics();
  private readonly selecao = new Graphics();

  constructor() {
    this.container.label = "camada-de-desenho";
    this.container.addChild(this.gravados, this.emAndamento, this.selecao);
  }

  desenharGravados(itens: DesenhoNaTela[], zoom: number): void {
    this.gravados.clear();
    for (const item of itens) tracar(this.gravados, item, zoom);
  }

  desenharEmAndamento(itens: DesenhoNaTela[], zoom: number): void {
    this.emAndamento.clear();
    for (const item of itens) tracar(this.emAndamento, item, zoom);
  }

  /** O destaque do desenho selecionado: caixa em volta, com a folga da espessura, e quatro alças. */
  desenharSelecao(item: DesenhoNaTela | null, zoom: number): void {
    this.selecao.clear();
    if (!item) return;
    const dx = item.dx ?? 0;
    const dy = item.dy ?? 0;
    const c = caixaDoDesenho(item.desenho);
    const folga = item.desenho.espessura / 2 + 6 / zoom;
    const x0 = (c.x0 + dx) * PX_POR_M - folga;
    const y0 = (c.y0 + dy) * PX_POR_M - folga;
    const x1 = (c.x1 + dx) * PX_POR_M + folga;
    const y1 = (c.y1 + dy) * PX_POR_M + folga;
    this.selecao
      .rect(x0, y0, x1 - x0, y1 - y0)
      .fill({ color: ACENTO, alpha: 0.08 })
      .stroke({ width: 1.5 / zoom, color: ACENTO });
    const lado = 7 / zoom;
    for (const [x, y] of [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ] as const) {
      this.selecao
        .rect(x - lado / 2, y - lado / 2, lado, lado)
        .fill(0x151a22)
        .stroke({ width: 1.5 / zoom, color: ACENTO });
    }
  }

  destruir(): void {
    this.container.destroy({ children: true });
  }
}
