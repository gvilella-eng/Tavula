import { describe, expect, it } from "vitest";
import { negarEnvio } from "../index.ts";
import { arquivos } from "./ferramentas/arquivos.ts";
import type { QualquerFerramenta, Saida } from "./ferramentas/base.ts";
import { TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { chamarFerramenta } from "./servidor.ts";
import { CaixaSimulada, SalaSimulada } from "./testes/salaSimulada.ts";

const MESTRE = "m";
const ANA = "j1";
const BIA = "j2";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const emBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

async function rodar(sala: SalaSimulada, entrada: object): Promise<Saida> {
  const f = arquivos as QualquerFerramenta;
  const s = await f.executar(f.entrada.parse(entrada), sala.contexto());
  return typeof s === "string" ? { texto: s } : s;
}

function salaDe(usuario: string): { sala: SalaSimulada; caixa: CaixaSimulada } {
  const sala = new SalaSimulada(usuario);
  const caixa = new CaixaSimulada();
  sala.arquivos = caixa;
  return { sala, caixa };
}

/** Roda pela mesma porta do servidor (valida a entrada e devolve o erro como texto). */
async function chamar(sala: SalaSimulada, entrada: object) {
  const conexao = Object.assign(sala, {
    esperarPronto: async () => undefined,
    estadoOuNulo: () => sala.estado(),
  });
  return chamarFerramenta("arquivos", entrada, conexao, sala.contexto().compendio);
}

describe("M1: a ferramenta `arquivos` aparece para todos, na ordem certa", () => {
  it("fica antes do `desfazer`", () => {
    const nomes = TODAS_AS_FERRAMENTAS.map((f) => f.nome);
    expect(nomes.indexOf("arquivos")).toBe(nomes.indexOf("desfazer") - 1);
  });
});

describe("M1: enviar", () => {
  it("devolve o link de uso único, o comando pronto e o aviso de que o mestre está aberto", async () => {
    const { sala, caixa } = salaDe(MESTRE);
    const r = await rodar(sala, {
      acao: "enviar",
      uso: "mapa",
      nome: "C:\\Users\\mestre\\cripta.png",
      cena: "Taverna",
      quadrados: 45,
    });
    expect(r.erro).toBeFalsy();
    expect(r.texto).toMatch(
      /curl -sS -T "<caminho do arquivo>" "http:\/\/sala\/api\/m\/mesa\/claude\/envio\/tve_/,
    );
    expect(r.texto).toContain("navegador do mestre está aberto");
    expect(r.texto).toContain("15 min");
    expect(caixa.pedidos).toHaveLength(1);
    // O caminho do computador nunca chega à sala: só o nome.
    expect(caixa.pedidos[0]).toMatchObject({
      uso: "mapa",
      nome: "cripta.png",
      alvo: { cenaId: "c1" },
      opcoes: { quadrados: 45 },
    });
    expect(caixa.pedidos[0]?.lote.lote).toMatch(/mapa da cena: cripta.png/);
  });

  it("sem navegador de mestre aberto, avisa que o arquivo espera na caixa", async () => {
    const { sala, caixa } = salaDe(MESTRE);
    caixa.online = false;
    const r = await rodar(sala, { uso: "som", nome: "taverna.mp3" });
    expect(r.texto).toMatch(/espera na caixa/);
    expect(r.texto).toMatch(/O Claude enviou 1 arquivo/);
  });

  it("aceita os nomes dos usos do jeito da mesa (mapa da cena, compêndio)", async () => {
    const { sala, caixa } = salaDe(MESTRE);
    await rodar(sala, { uso: "mapa da cena", nome: "a.png" });
    await rodar(sala, { uso: "compêndio", nome: "magias.json" });
    expect(caixa.pedidos.map((p) => p.uso)).toEqual(["mapa", "compendio"]);
  });

  it("Q3: o mapa do Dungeondraft entra pelo `enviar` (uso dungeondraft); `usar` é recusado", async () => {
    const { sala, caixa } = salaDe(MESTRE);
    const r = await rodar(sala, { uso: "dungeondraft", nome: "cripta.dd2vtt" });
    expect(r.texto).toContain("mapa Universal VTT");
    expect(caixa.pedidos[0]).toMatchObject({ uso: "mapa-uvtt", nome: "cripta.dd2vtt" });
    await rodar(sala, { uso: "uvtt", nome: "b.uvtt" });
    await rodar(sala, { uso: "mapa universal vtt", nome: "c.df2vtt" });
    expect(caixa.pedidos.map((p) => p.uso)).toEqual(["mapa-uvtt", "mapa-uvtt", "mapa-uvtt"]);
    const usar = await chamar(sala, { acao: "usar", uso: "dungeondraft", hash: "abcdef" });
    expect(usar.isError).toBe(true);
    expect(usar.content[0]?.text).toMatch(/só entra pelo `enviar`/);
  });

  it("o jogador não consegue pôr mapa, som nem compêndio (a regra da tela vale)", async () => {
    const { sala, caixa } = salaDe(ANA);
    for (const uso of ["mapa", "som", "compendio", "dungeondraft"]) {
      const r = await chamar(sala, { uso, nome: "x.png" });
      expect(r.isError, uso).toBe(true);
      expect(r.content[0]?.text).toMatch(/Só o mestre/);
    }
    expect(caixa.pedidos).toHaveLength(0);
  });

  it("o jogador manda o retrato da própria ficha, mas não da ficha de outro", async () => {
    const { sala, caixa } = salaDe(ANA);
    const fichas = TODAS_AS_FERRAMENTAS.find((f) => f.nome === "fichas") as QualquerFerramenta;
    await fichas.executar(fichas.entrada.parse({ fichas: [{ nome: "Brisa" }] }), sala.contexto());
    const certo = await chamar(sala, { uso: "retrato", nome: "brisa.png", ficha: "Brisa" });
    expect(certo.isError).toBeFalsy();
    expect(caixa.pedidos[0]).toMatchObject({ uso: "retrato" });

    // A Bia não vê a ficha da Ana: a ficha nem existe para ela.
    const outra = salaDe(BIA);
    outra.sala.verdade = sala.verdade;
    const errado = await chamar(outra.sala, { uso: "retrato", nome: "x.png", ficha: "Brisa" });
    expect(errado.isError).toBe(true);
    expect(outra.caixa.pedidos).toHaveLength(0);
  });

  it("sem a permissão de subir arquivos o jogador não manda retrato nem token", async () => {
    const { sala, caixa } = salaDe(ANA);
    const fichas = TODAS_AS_FERRAMENTAS.find((f) => f.nome === "fichas") as QualquerFerramenta;
    await fichas.executar(fichas.entrada.parse({ fichas: [{ nome: "Brisa" }] }), sala.contexto());
    sala.verdade = {
      ...sala.verdade,
      permissoes: {
        ...sala.verdade.permissoes,
        jogadores: { ...sala.verdade.permissoes.jogadores, "asset.subir": false },
      },
    };
    const r = await chamar(sala, { uso: "retrato", nome: "brisa.png", ficha: "Brisa" });
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/asset\.subir/);
    expect(caixa.pedidos).toHaveLength(0);
  });

  it("`quadrados` só vale para o mapa; sem o alvo o pedido volta com o que falta", async () => {
    const { sala } = salaDe(MESTRE);
    const a = await chamar(sala, { uso: "retrato", nome: "a.png", quadrados: 45 });
    expect(a.isError).toBe(true);
    const b = await chamar(sala, { uso: "retrato", nome: "a.png" });
    expect(b.content[0]?.text).toMatch(/de qual ficha/);
    const c = await chamar(sala, { uso: "mapa", nome: "a.png", cena: "Não existe" });
    expect(c.content[0]?.text).toMatch(/Não achei a cena/);
  });

  it("base64: confere o formato, guarda na caixa e já devolve o resultado", async () => {
    const { sala, caixa } = salaDe(MESTRE);
    const ok = await rodar(sala, { uso: "mapa", nome: "m.png", base64: emBase64(PNG) });
    expect(ok.erro).toBeFalsy();
    expect(ok.texto).toMatch(/^Pronto: m\.png/);
    expect(caixa.guardados[0]?.bytes).toEqual(PNG);

    // Não é imagem: recusado antes de ir para a caixa.
    const texto = await chamar(sala, {
      uso: "mapa",
      nome: "m.png",
      base64: btoa("<html>oi</html>"),
    });
    expect(texto.isError).toBe(true);
    expect(texto.content[0]?.text).toMatch(/Não reconheci o formato/);
    const som = await chamar(sala, { uso: "som", nome: "m.mp3", base64: emBase64(PNG) });
    expect(som.content[0]?.text).toMatch(/uma imagem/);
    expect(caixa.guardados).toHaveLength(1);
  });

  it("base64 acima de 2 MB é recusado com o caminho do curl", async () => {
    const { sala, caixa } = salaDe(MESTRE);
    const r = await chamar(sala, {
      uso: "mapa",
      nome: "m.png",
      base64: "A".repeat(3 * 1024 * 1024),
    });
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/2 MB/);
    expect(caixa.guardados).toHaveLength(0);
  });

  it("sem a caixa (MCP em stdio) explica que precisa do MCP por HTTP", async () => {
    const sala = new SalaSimulada(MESTRE);
    const r = await chamar(sala, { uso: "mapa", nome: "a.png" });
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/MCP por HTTP/);
  });
});

describe("M1: estado, listar e usar", () => {
  it("estado conta o que aconteceu com o envio, inclusive o erro", async () => {
    const { sala, caixa } = salaDe(MESTRE);
    caixa.estados.set("env-1", {
      id: "env-1",
      uso: "mapa",
      nome: "a.png",
      estado: "aplicado",
      bytes: 0,
      criadoEm: 0,
      hash: "cd".repeat(32),
      resultado: "O mapa entrou na cena (70 px por quadrado).",
    });
    caixa.estados.set("env-2", {
      id: "env-2",
      uso: "mapa",
      nome: "b.png",
      estado: "erro",
      bytes: 0,
      criadoEm: 0,
      motivo: "Não deu.",
    });
    caixa.estados.set("env-3", {
      id: "env-3",
      uso: "mapa",
      nome: "c.png",
      estado: "recebido",
      bytes: 10,
      criadoEm: 0,
    });
    const a = await rodar(sala, { acao: "estado", envio: "env-1" });
    expect(a.texto).toMatch(/Pronto: a\.png.*70 px por quadrado.*Hash: cdcdcdcdcdcd/);
    const b = await rodar(sala, { acao: "estado", envio: "env-2" });
    expect(b.erro).toBe(true);
    expect(b.texto).toMatch(/NÃO FEITO/);
    const c = await rodar(sala, { acao: "estado", envio: "env-3" });
    expect(c.texto).toMatch(/espera o navegador do mestre/);
    const d = await chamar(sala, { acao: "estado", envio: "nenhum" });
    expect(d.isError).toBe(true);
  });

  it("listar mostra os arquivos da mesa e onde são usados (só o mestre)", async () => {
    const { sala } = salaDe(MESTRE);
    const hash = "ab".repeat(32);
    sala.verdade = {
      ...sala.verdade,
      assets: [
        {
          hash,
          tipo: "mapa",
          mime: "image/webp",
          bytes: 2048,
          largura: 3150,
          altura: 3150,
          donoId: "m",
          nomeOriginal: "cripta.png",
          pedacos: [],
        },
      ],
      cenas: sala.verdade.cenas.map((c) => ({
        ...c,
        mapa: { assetHash: hash, pxPorQuadrado: 70 },
      })),
    };
    const r = await rodar(sala, { acao: "listar" });
    expect(r.texto).toMatch(
      /cripta\.png \(mapa, 3150x3150, 2 KB\).*usado em: mapa da cena Taverna/,
    );
    const jogador = salaDe(ANA);
    const negado = await chamar(jogador.sala, { acao: "listar" });
    expect(negado.isError).toBe(true);
  });

  it("usar põe na mesa um arquivo que já existe (sem reenviar), pelo hash, no lote do Claude", async () => {
    const { sala, caixa } = salaDe(MESTRE);
    const hash = "ab".repeat(32);
    sala.verdade = {
      ...sala.verdade,
      assets: [
        {
          hash,
          tipo: "mapa",
          mime: "image/webp",
          bytes: 0,
          largura: 3150,
          altura: 3150,
          donoId: "m",
          nomeOriginal: "cripta.png",
          pedacos: [],
        },
      ],
    };
    const r = await rodar(sala, {
      acao: "usar",
      uso: "mapa",
      hash: hash.slice(0, 8),
      cena: "Taverna",
      quadrados: 45,
    });
    expect(r.texto).toMatch(/Feito: o mapa entrou na cena \(70 px por quadrado\)/);
    expect(caixa.pedidos).toHaveLength(0);
    expect(sala.enviados[0]).toMatchObject({
      tipo: "cena.definirMapa",
      dados: { cenaId: "c1", assetHash: hash, pxPorQuadrado: 70 },
    });
    expect(sala.enviados[0]?.lote?.lote).toMatch(/Usou mapa da cena/);
    const cena = sala.verdade.cenas.find((c) => c.id === "c1");
    expect(cena?.mapa).toEqual({ assetHash: hash, pxPorQuadrado: 70 });
    // 3150 px ÷ 70 = 45 quadrados de 1,5 m.
    expect(cena?.larguraM).toBeCloseTo(67.5);

    const errado = await chamar(sala, { acao: "usar", uso: "som", hash: hash.slice(0, 8) });
    expect(errado.isError).toBe(true);
    expect(errado.content[0]?.text).toMatch(/não serve para som/);
    const curto = await chamar(sala, { acao: "usar", uso: "mapa", hash: "ab" });
    expect(curto.content[0]?.text).toMatch(/6 letras/);
  });
});

describe("M1: negarEnvio roda as regras de verdade", () => {
  it("o mestre pode o que a mesa deixa; cena que não existe é recusada", () => {
    const sala = new SalaSimulada(MESTRE);
    expect(negarEnvio(sala.estado(), sala.eu(), "mapa", { cenaId: "c1" }, {})).toBeNull();
    expect(negarEnvio(sala.estado(), sala.eu(), "mapa", { cenaId: "nada" }, {})).not.toBeNull();
    expect(negarEnvio(sala.estado(), sala.eu(), "compendio", {}, {})).toBeNull();
    expect(negarEnvio(sala.estado(), sala.eu(), "som", {}, {})).toBeNull();
  });
});
