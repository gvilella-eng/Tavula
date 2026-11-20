import { describe, expect, it } from "vitest";
import {
  decidirSomSolto,
  MAXIMO_POR_SOLTAR,
  nomeDaFaixa,
  semOsSons,
  textoDoAvisoDaBiblioteca,
} from "./soltarSom";

const arq = (nome: string) => new File(["x"], nome);

describe("decidirSomSolto", () => {
  it("o mestre que solta mp3, ogg ou wav manda tudo para a biblioteca", () => {
    const d = decidirSomSolto("mestre", [
      arq("a.mp3"),
      arq("b.OGG"),
      arq("c.wav"),
      arq("mapa.png"),
    ]);
    expect(d.acao).toBe("biblioteca");
    expect(d.sons.map((s) => s.name)).toEqual(["a.mp3", "b.OGG", "c.wav"]);
  });

  it("o jogador que solta som é recusado", () => {
    expect(decidirSomSolto("jogador", [arq("a.mp3")]).acao).toBe("recusar");
    expect(decidirSomSolto("espectador", [arq("a.mp3")]).acao).toBe("recusar");
  });

  it("sem som entre os arquivos, o soltar segue o caminho das imagens", () => {
    expect(decidirSomSolto("mestre", [arq("a.png"), arq("b.gif")]).acao).toBe("nenhuma");
    expect(decidirSomSolto("jogador", [arq("a.png")]).acao).toBe("nenhuma");
    expect(decidirSomSolto("mestre", []).acao).toBe("nenhuma");
  });

  it("passando do máximo, as primeiras entram e o resto é contado", () => {
    const muitos = Array.from({ length: MAXIMO_POR_SOLTAR + 3 }, (_, i) => arq(`f${i}.mp3`));
    const d = decidirSomSolto("mestre", muitos);
    expect(d.sons).toHaveLength(MAXIMO_POR_SOLTAR);
    expect(d.sobraram).toBe(3);
  });

  it("as imagens soltas junto com sons seguem o caminho de sempre", () => {
    expect(semOsSons([arq("a.mp3"), arq("b.png")]).map((a) => a.name)).toEqual(["b.png"]);
  });
});

describe("textos", () => {
  it("o nome da faixa é o do arquivo sem a extensão", () => {
    expect(nomeDaFaixa("Taverna do Dragão.mp3")).toBe("Taverna do Dragão");
    expect(nomeDaFaixa(".mp3")).toBe("Música");
  });
  it("o aviso conta as que entraram e as que não", () => {
    expect(textoDoAvisoDaBiblioteca(1, 0)).toBe("Adicionada à biblioteca de música.");
    expect(textoDoAvisoDaBiblioteca(3, 0)).toBe("3 músicas adicionadas à biblioteca de música.");
    expect(textoDoAvisoDaBiblioteca(2, 1)).toContain("1 não entrou");
  });
});
