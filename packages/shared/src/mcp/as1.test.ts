import { describe, expect, it } from "vitest";
import type { AssetMeta } from "../index.ts";
import { arquivos } from "./ferramentas/arquivos.ts";
import type { QualquerFerramenta, Saida } from "./ferramentas/base.ts";
import { chamarFerramenta } from "./servidor.ts";
import { CaixaSimulada, SalaSimulada } from "./testes/salaSimulada.ts";

// AS1: o Claude lista os assets, põe uma imagem na cena por nome, ajusta, renomeia e apaga, com as mesmas regras da tela.

const HASH_IMG = "ab".repeat(32);
const HASH_MAPA = "cd".repeat(32);
const HASH_SOM = "ef".repeat(32);

function meta(hash: string, tipo: AssetMeta["tipo"], extra: Partial<AssetMeta> = {}): AssetMeta {
  return {
    hash,
    tipo,
    mime: tipo === "som" ? "audio/mpeg" : "image/webp",
    bytes: 2048,
    largura: 280,
    altura: 140,
    donoId: "j1",
    nomeOriginal: `${tipo}.webp`,
    pedacos: [],
    ...extra,
  };
}

function salaDe(usuario: string): SalaSimulada {
  const sala = new SalaSimulada(usuario);
  sala.arquivos = new CaixaSimulada();
  sala.verdade = {
    ...sala.verdade,
    assets: [
      meta(HASH_IMG, "imagem", { nomeOriginal: "estatua.png" }),
      meta(HASH_MAPA, "mapa", {
        donoId: "m",
        nomeOriginal: "cripta.png",
        largura: 1400,
        altura: 1400,
      }),
      meta(HASH_SOM, "som", { donoId: "m", nomeOriginal: "chuva.mp3" }),
    ],
  };
  return sala;
}

async function rodar(sala: SalaSimulada, entrada: object): Promise<Saida> {
  const f = arquivos as QualquerFerramenta;
  const s = await f.executar(f.entrada.parse(entrada), sala.contexto());
  return typeof s === "string" ? { texto: s } : s;
}

async function chamar(sala: SalaSimulada, entrada: object) {
  const conexao = Object.assign(sala, {
    esperarPronto: async () => undefined,
    estadoOuNulo: () => sala.estado(),
  });
  return chamarFerramenta("arquivos", entrada, conexao, sala.contexto().compendio);
}

describe("AS1: o MCP e os assets da mesa", () => {
  it("listar mostra tipo, quem enviou e onde cada arquivo é usado", async () => {
    const sala = salaDe("m");
    sala.verdade = {
      ...sala.verdade,
      cenas: sala.verdade.cenas.map((c) => ({
        ...c,
        mapa: { assetHash: HASH_MAPA, pxPorQuadrado: 70 },
      })),
    };
    const r = await rodar(sala, { acao: "listar" });
    expect(r.texto).toMatch(/Assets da mesa \(3\)/);
    expect(r.texto).toMatch(/estatua\.png \(imagem.*enviado por Ana.*sem uso/);
    expect(r.texto).toMatch(
      /cripta\.png \(mapa.*enviado por Mestre.*usado em: mapa da cena Taverna/,
    );
    const jogador = await chamar(salaDe("j1"), { acao: "listar" });
    expect(jogador.isError).toBe(true);
  });

  it("usar com uso imagem põe a imagem na cena, no ponto (em quadrados) e na camada pedidos, no lote do Claude", async () => {
    const sala = salaDe("m");
    const r = await rodar(sala, {
      acao: "usar",
      uso: "imagem",
      hash: HASH_IMG.slice(0, 8),
      x: 10,
      y: 6,
      camada: "mapa",
      larguraQuadrados: 4,
    });
    expect(r.texto).toMatch(/Feito: a imagem foi posta na cena/);
    expect(sala.enviados[0]).toMatchObject({
      tipo: "imagem.colocar",
      dados: { assetHash: HASH_IMG, x: 15, y: 9, camada: "mapa", larguraM: 6, cenaId: "c1" },
    });
    expect(sala.enviados[0]?.lote?.lote).toMatch(/Usou imagem solta na cena/);
    const t = sala.verdade.tokens.find((x) => x.assetHash === HASH_IMG);
    expect(t).toMatchObject({ x: 15, y: 9, camada: "mapa", nome: "estatua" });
    expect(t?.imagem).toMatchObject({ larguraM: 6, alturaM: 3, rotacao: 0 });
    // O que não é imagem não vai para a cena.
    const som = await chamar(sala, { acao: "usar", uso: "imagem", hash: HASH_SOM.slice(0, 8) });
    expect(som.isError).toBe(true);
    expect(som.content[0]?.text).toMatch(/não serve para imagem solta/);
  });

  it("ajustar move, estica, gira e esconde a imagem pelo nome; só o que existe", async () => {
    const sala = salaDe("m");
    await rodar(sala, { acao: "usar", uso: "imagem", hash: HASH_IMG.slice(0, 8), x: 5, y: 5 });
    await rodar(sala, {
      acao: "ajustar",
      token: "estatua",
      x: 8,
      larguraQuadrados: 2,
      alturaQuadrados: 3,
      rotacao: 45,
      oculto: true,
    });
    const t = sala.verdade.tokens.find((x) => x.nome === "estatua");
    expect(t).toMatchObject({ x: 12, y: 7.5, oculto: true });
    expect(t?.imagem).toMatchObject({ larguraM: 3, alturaM: 4.5, rotacao: 45 });
    const nada = await chamar(sala, { acao: "ajustar", token: "estatua" });
    expect(nada.isError).toBe(true);
    const outra = await chamar(sala, { acao: "ajustar", token: "dragao", rotacao: 3 });
    expect(outra.isError).toBe(true);
  });

  it("renomear muda o nome que a mesa mostra; apagar em uso recusa e, confirmado, tira a imagem dos lugares", async () => {
    const sala = salaDe("m");
    await rodar(sala, {
      acao: "renomear",
      hash: HASH_IMG.slice(0, 8),
      novoNome: "Estátua da praça",
    });
    expect(sala.verdade.assets?.find((a) => a.hash === HASH_IMG)?.nomeExibicao).toBe(
      "Estátua da praça",
    );
    await rodar(sala, { acao: "usar", uso: "imagem", hash: HASH_IMG.slice(0, 8) });
    expect(sala.verdade.tokens).toHaveLength(1);
    const recusado = await chamar(sala, { acao: "apagar", hash: HASH_IMG.slice(0, 8) });
    expect(recusado.isError).toBe(true);
    expect(recusado.content[0]?.text).toMatch(/Está em uso em: imagem solta/);
    const feito = await rodar(sala, {
      acao: "apagar",
      hash: HASH_IMG.slice(0, 8),
      confirmar: true,
    });
    expect(feito.texto).toMatch(/saiu da mesa, e a imagem saiu de/);
    expect(sala.verdade.tokens).toHaveLength(0);
    expect(sala.verdade.assets?.some((a) => a.hash === HASH_IMG)).toBe(false);
    // Sem uso, apaga direto.
    const direto = await rodar(sala, { acao: "apagar", hash: HASH_MAPA.slice(0, 8) });
    expect(direto.texto).toMatch(/saiu da mesa/);
  });

  it("o jogador não renomeia nem apaga arquivos da mesa", async () => {
    const sala = salaDe("j1");
    const a = await chamar(sala, { acao: "renomear", hash: HASH_IMG.slice(0, 8), novoNome: "x" });
    expect(a.isError).toBe(true);
    const b = await chamar(sala, { acao: "apagar", hash: HASH_IMG.slice(0, 8) });
    expect(b.isError).toBe(true);
  });

  it("enviar com uso imagem abre o envio e leva o ponto em metros para a caixa", async () => {
    const sala = new SalaSimulada("m");
    const caixa = new CaixaSimulada();
    sala.arquivos = caixa;
    const r = await rodar(sala, {
      acao: "enviar",
      uso: "imagem",
      nome: "dragao.gif",
      x: 4,
      y: 2,
      camada: "tokens",
    });
    expect(r.texto).toMatch(/imagem solta na cena: dragao\.gif/);
    expect(caixa.pedidos[0]).toMatchObject({
      uso: "imagem",
      alvo: { cenaId: "c1" },
      opcoes: { xM: 6, yM: 3, camada: "tokens" },
    });
  });
});
