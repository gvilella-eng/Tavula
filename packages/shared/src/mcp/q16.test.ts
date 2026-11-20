import { describe, expect, it } from "vitest";
import { type Estado, espacosDaFicha } from "../index.ts";
import { ErroDoMcp } from "./erros.ts";
import type { QualquerFerramenta, Saida } from "./ferramentas/base.ts";
import { TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { CaixaSimulada, SalaSimulada } from "./testes/salaSimulada.ts";

// Q16: o MCP faz tudo o que a tela faz, campo a campo. Aqui: o que o lote fechou (conjurar gastando espaço e uso, controle
// do token, campos livres da ficha, aparência e símbolo, som por nome nas zonas e reações) e uma preparação completa só
// pelo MCP, conferida campo a campo.

async function rodar(sala: SalaSimulada, nome: string, entrada: object): Promise<Saida> {
  const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === nome) as QualquerFerramenta;
  const lida = f.entrada.parse(entrada);
  try {
    const s = await f.executar(lida, sala.contexto());
    return typeof s === "string" ? { texto: s } : s;
  } catch (e) {
    // Como o servidor: o erro que diz o que fazer volta como texto de erro.
    if (e instanceof ErroDoMcp) return { texto: e.message, erro: true };
    throw e;
  }
}

const HASH_VENTO = "a".repeat(64);
const HASH_TROVAO = "b".repeat(64);
const HASH_IMG = "c".repeat(64);
const HASH_IMG2 = "d".repeat(64);

function meta(hash: string, tipo: "som" | "retrato", nomeOriginal: string) {
  return {
    hash,
    tipo,
    mime: tipo === "som" ? "audio/mpeg" : "image/webp",
    bytes: 10,
    largura: 1,
    altura: 1,
    donoId: "m",
    nomeOriginal,
    pedacos: [],
  };
}

function comArquivos(sala: SalaSimulada): void {
  sala.verdade = {
    ...sala.verdade,
    assets: [
      meta(HASH_VENTO, "som", "vento.mp3"),
      meta(HASH_TROVAO, "som", "trovao.mp3"),
      meta(HASH_IMG, "retrato", "brisa.webp"),
      meta(HASH_IMG2, "retrato", "simbolo.webp"),
    ],
  } as Estado;
}

const MAGIAS = [
  {
    nome: "Mísseis Mágicos",
    nivel: 1,
    escola: "Evocação",
    dano: "1d4+1",
    quantidadeBase: 3,
    porNivelAcima: "1 dardo",
  },
  { nome: "Detectar Magia", nivel: 1, ritual: true, descricao: "Sente magia por perto." },
  {
    nome: "Raio de Gelo",
    nivel: 0,
    dano: "1d8",
    tipo: "gelo",
    acerto: { tipo: "formula", atributo: "int", proficiente: true },
  },
  {
    nome: "Bola de Fogo",
    nivel: 3,
    dano: "8d6",
    tipo: "fogo",
    porNivelAcima: "1d6",
    salvaguarda: { alvo: "des", cdAtributo: "int", sucesso: "metade" },
  },
  {
    nome: "Luz Dançante",
    nivel: 0,
    descricao: "Quatro luzes.",
    inata: { frequencia: "cada", max: 1 },
  },
];

async function magaComMagias(sala: SalaSimulada) {
  await rodar(sala, "fichas", {
    fichas: [
      {
        nome: "Brisa",
        tipo: "personagem",
        dono: ["Ana"],
        classes: [{ classe: "Mago", nivel: 9 }],
        atributos: { for: 8, des: 14, con: 14, int: 16, sab: 12, car: 10 },
        magias: MAGIAS,
      },
    ],
  });
}

const ficha = (sala: SalaSimulada, nome: string) =>
  sala.verdade.personagens.find((p) => p.nome === nome)?.ficha;

describe("conjurar pelo MCP (Q16)", () => {
  it("gasta o espaço do nível, rola o dano e marca o gasto na ficha", async () => {
    const sala = new SalaSimulada("m");
    await magaComMagias(sala);
    const antes = espacosDaFicha(ficha(sala, "Brisa") ?? ({} as never));
    expect(antes.find((e) => e.nivel === 1)?.total).toBeGreaterThan(0);
    const r = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Mísseis Mágicos" },
    });
    expect(r.erro).toBeFalsy();
    expect(r.texto).toContain("Gastou espaço de 1º");
    expect(ficha(sala, "Brisa")?.espacosGastos).toEqual({ "1": 1 });
    // Sem espaço acima do nível da magia: o chat não leva o bloco do nível maior.
    const msg = sala.verdade.chat?.at(-1);
    expect(msg).toBeTruthy();
  });

  it("com `nivel` acima da magia, gasta aquele círculo e soma o dado a mais por nível", async () => {
    const sala = new SalaSimulada("m");
    await magaComMagias(sala);
    const r = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Bola de Fogo", nivel: 4 },
    });
    expect(r.erro).toBeFalsy();
    expect(r.texto).toContain("espaço de 4º");
    expect(ficha(sala, "Brisa")?.espacosGastos).toEqual({ "4": 1 });
    const ultima = JSON.stringify(sala.verdade.chat?.at(-1));
    expect(ultima).toContain(`"espaco":{"nivel":4,"extra":{"expressao":"1d6"`);
    // O dado a mais por nível acima vai no espaço, e a CD no rótulo, como na tela.
    expect(ultima).toMatch(/CD \d+, fogo/);
  });

  it("sem espaço no círculo pedido, recusa e diz as opções", async () => {
    const sala = new SalaSimulada("m");
    await magaComMagias(sala);
    const r = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Bola de Fogo", nivel: 9 },
    });
    expect(r.erro).toBeTruthy();
    expect(r.texto).toContain("Sem espaço");
    expect(ficha(sala, "Brisa")?.espacosGastos).toBeUndefined();
  });

  it("gasta o círculo até acabar e então recusa (sem rolar de graça)", async () => {
    const sala = new SalaSimulada("m");
    await magaComMagias(sala);
    const total = espacosDaFicha(ficha(sala, "Brisa") ?? ({} as never)).find((e) => e.nivel === 1)
      ?.total as number;
    for (let i = 0; i < total; i++) {
      const r = await rodar(sala, "rolar", {
        conjurar: { ficha: "Brisa", magia: "Detectar Magia", nivel: 1 },
      });
      expect(r.erro).toBeFalsy();
    }
    const chatAntes = sala.verdade.chat?.length ?? 0;
    const r = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Detectar Magia", nivel: 1 },
    });
    expect(r.erro).toBeTruthy();
    expect(sala.verdade.chat?.length ?? 0).toBe(chatAntes);
    expect(ficha(sala, "Brisa")?.espacosGastos?.["1"]).toBe(total);
  });

  it("ritual não gasta espaço; truque não gasta nem aceita `nivel`", async () => {
    const sala = new SalaSimulada("m");
    await magaComMagias(sala);
    const r = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Detectar Magia", ritual: true },
    });
    expect(r.erro).toBeFalsy();
    expect(ficha(sala, "Brisa")?.espacosGastos).toBeUndefined();
    const t = await rodar(sala, "rolar", { conjurar: { ficha: "Brisa", magia: "Raio de Gelo" } });
    expect(t.erro).toBeFalsy();
    const t2 = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Raio de Gelo", nivel: 2 },
    });
    expect(t2.erro).toBeTruthy();
    const nr = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Mísseis Mágicos", ritual: true },
    });
    expect(nr.erro).toBeTruthy();
  });

  it("gasta o espaço de pacto do Bruxo", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "fichas", {
      fichas: [
        {
          nome: "Cinza",
          tipo: "personagem",
          classes: [{ classe: "Bruxo", nivel: 3 }],
          magias: [{ nome: "Pavor", nivel: 1, descricao: "Medo." }],
        },
      ],
    });
    const r = await rodar(sala, "rolar", {
      conjurar: { ficha: "Cinza", magia: "Pavor", pacto: true },
    });
    expect(r.erro, r.texto).toBeFalsy();
    expect(r.texto).toContain("pacto");
    expect(ficha(sala, "Cinza")?.pactoGasto).toBe(1);
  });

  it("magia inata gasta um uso (e recusa quando acaba); espaço não vale nela", async () => {
    const sala = new SalaSimulada("m");
    await magaComMagias(sala);
    const r = await rodar(sala, "rolar", { conjurar: { ficha: "Brisa", magia: "Luz Dançante" } });
    expect(r.erro, r.texto).toBeFalsy();
    expect(
      ficha(sala, "Brisa")?.magias?.find((m) => m.nome === "Luz Dançante")?.inata?.gastos,
    ).toBe(1);
    const de_novo = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Luz Dançante" },
    });
    expect(de_novo.erro).toBeTruthy();
    expect(de_novo.texto).toContain("Sem usos");
    const com_espaco = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Luz Dançante", nivel: 2 },
    });
    expect(com_espaco.erro).toBeTruthy();
  });

  it("o jogador conjura pela ficha dele, e não pela dos outros", async () => {
    const m = new SalaSimulada("m");
    await magaComMagias(m);
    await rodar(m, "fichas", {
      fichas: [{ nome: "Outro", tipo: "personagem", magias: [{ nome: "Fagulha", nivel: 1 }] }],
    });
    await rodar(m, "rascunhos", { acao: "publicar" });
    const sala = new SalaSimulada("j1", m.verdade);
    const meu = await rodar(sala, "rolar", {
      conjurar: { ficha: "Brisa", magia: "Mísseis Mágicos" },
    });
    expect(meu.erro, meu.texto).toBeFalsy();
    const alheio = await rodar(sala, "rolar", {
      conjurar: { ficha: "Outro", magia: "Fagulha" },
    });
    expect(alheio.erro).toBeTruthy();
  });

  it("a magia sem acerto sai como dano com a CD e o tipo no rótulo; o ataque com salvaguarda leva a CD ao chat", async () => {
    const sala = new SalaSimulada("m");
    await magaComMagias(sala);
    const r = await rodar(sala, "rolar", { ataque: { ficha: "Brisa", nome: "Bola de Fogo" } });
    expect(r.erro, r.texto).toBeFalsy();
    expect(JSON.stringify(sala.verdade.chat?.at(-1))).toMatch(/CD \d+, fogo/);
    await rodar(sala, "fichas", {
      fichas: [
        {
          nome: "Brisa",
          ataques: [
            {
              nome: "Sopro gélido",
              acerto: { tipo: "fixo", valor: 5 },
              dano: "2d6",
              tipo: "frio",
              salvaguarda: { alvo: "con", cdAtributo: "int", sucesso: "metade" },
            },
          ],
        },
      ],
    });
    const s = await rodar(sala, "rolar", { ataque: { ficha: "Brisa", nome: "Sopro gélido" } });
    expect(s.erro, s.texto).toBeFalsy();
    expect(JSON.stringify(sala.verdade.chat?.at(-1))).toContain("Constituição");
  });
});

describe("campos que faltavam (Q16)", () => {
  it("`campos` grava qualquer campo da ficha, na criação e na edição, com a validação da tela", async () => {
    const sala = new SalaSimulada("m");
    const r = await rodar(sala, "fichas", {
      fichas: [
        {
          nome: "Thara",
          tipo: "personagem",
          campos: [
            { caminho: "xp", valor: 300 },
            { caminho: "inspiracao", valor: true },
            { caminho: "pvTemp", valor: 5 },
            { caminho: "mortes", valor: { sucessos: 1, falhas: 2 } },
            { caminho: "aliados", valor: "A Ordem do Farol" },
            { caminho: "idade", valor: "27" },
            { caminho: "ca", valor: { valor: 16, nota: "cota de malha" } },
          ],
        },
      ],
    });
    expect(r.erro, r.texto).toBeFalsy();
    expect(ficha(sala, "Thara")).toMatchObject({
      xp: 300,
      inspiracao: true,
      pvTemp: 5,
      mortes: { sucessos: 1, falhas: 2 },
      aliados: "A Ordem do Farol",
      idade: "27",
      ca: { valor: 16, nota: "cota de malha" },
    });
    const e = await rodar(sala, "fichas", {
      fichas: [{ nome: "Thara", campos: [{ caminho: "xp", valor: 900 }] }],
    });
    expect(e.erro, e.texto).toBeFalsy();
    expect(ficha(sala, "Thara")?.xp).toBe(900);
    const ruim = await rodar(sala, "fichas", {
      fichas: [{ nome: "Thara", campos: [{ caminho: "xp", valor: "muito" }] }],
    });
    expect(ruim.erro).toBeTruthy();
    expect(ficha(sala, "Thara")?.xp).toBe(900);
  });

  it("`visaoM`, `vidaPorToken` e `barraDeVida` valem já na criação da ficha", async () => {
    const sala = new SalaSimulada("m");
    const r = await rodar(sala, "fichas", {
      fichas: [
        { nome: "Lich", visaoM: 12, vidaPorToken: false, barraDeVida: false, pv: { max: 100 } },
      ],
    });
    expect(r.erro, r.texto).toBeFalsy();
    const p = sala.verdade.personagens.find((x) => x.nome === "Lich");
    expect(p?.visao.alcanceM).toBe(12);
    expect(p?.vidaPorToken).toBe(false);
    expect(p?.tokenPadrao.barraDeVida).toBe(false);
    await rodar(sala, "fichas", { fichas: [{ nome: "Lich", visaoM: null }] });
    expect(sala.verdade.personagens.find((x) => x.nome === "Lich")?.visao.alcanceM).toBeNull();
  });

  it("o mestre diz quem controla o token (`controladoPor`)", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "fichas", { fichas: [{ nome: "Goblin", monstro: "Goblin" }] });
    await rodar(sala, "cenas", { cenas: [{ nome: "Taverna", tokens: [{ ficha: "Goblin" }] }] });
    const r = await rodar(sala, "tokens", {
      tokens: [{ token: "Goblin", controladoPor: ["Ana", "Bia"] }],
    });
    expect(r.erro, r.texto).toBeFalsy();
    expect(sala.verdade.tokens[0]?.controladoPor).toEqual(["j1", "j2"]);
    await rodar(sala, "tokens", { tokens: [{ token: "Goblin", controladoPor: [] }] });
    expect(sala.verdade.tokens[0]?.controladoPor).toEqual([]);
    const errado = await rodar(sala, "tokens", {
      tokens: [{ token: "Goblin", controladoPor: ["Fulano"] }],
    });
    expect(errado.erro).toBeTruthy();
  });

  it("aparência e símbolo da ficha entram pelo `arquivos` (enviar e usar)", async () => {
    const sala = new SalaSimulada("m");
    const caixa = new CaixaSimulada();
    sala.arquivos = caixa;
    comArquivos(sala);
    await rodar(sala, "fichas", { fichas: [{ nome: "Brisa", tipo: "personagem" }] });
    const env = await rodar(sala, "arquivos", {
      acao: "enviar",
      uso: "aparência",
      nome: "brisa.png",
      ficha: "Brisa",
    });
    expect(env.erro, env.texto).toBeFalsy();
    expect(caixa.pedidos[0]).toMatchObject({ uso: "aparencia", nome: "brisa.png" });
    const usar = await rodar(sala, "arquivos", {
      acao: "usar",
      uso: "aparencia",
      hash: HASH_IMG.slice(0, 8),
      ficha: "Brisa",
    });
    expect(usar.erro, usar.texto).toBeFalsy();
    const sim = await rodar(sala, "arquivos", {
      acao: "usar",
      uso: "símbolo",
      hash: HASH_IMG2.slice(0, 8),
      ficha: "Brisa",
    });
    expect(sim.erro, sim.texto).toBeFalsy();
    expect(ficha(sala, "Brisa")).toMatchObject({
      aparenciaHash: HASH_IMG,
      simboloHash: HASH_IMG2,
    });
    const lista = await rodar(sala, "arquivos", { acao: "listar" });
    expect(lista.texto).toContain("aparência de Brisa");
    expect(lista.texto).toContain("símbolo de Brisa");
  });
});

describe("zona e reação com som pelo nome do arquivo (Q16)", () => {
  it("a zona leva todos os efeitos e o som por nome; a reação toca um som por nome", async () => {
    const sala = new SalaSimulada("m");
    comArquivos(sala);
    const r = await rodar(sala, "automacoes", {
      zonas: [
        {
          cena: "Taverna",
          nome: "Poça",
          pontos: [
            [2, 2],
            [8, 2],
            [8, 6],
            [2, 6],
          ],
          efeitos: {
            luzRaioX: 0.5,
            luzSomaM: -2,
            visaoMaxM: 3,
            som: { hash: "vento.mp3", volume: 0.4, laco: false },
          },
        },
      ],
      fluxos: [
        {
          nome: "Trovão na poça",
          gatilho: { tipo: "zona", quando: "entra", zona: "Poça" },
          trilhas: [
            [
              { bloco: "acao", acao: { acao: "som.tocar", hash: "trovao", volume: 0.9 } },
              { bloco: "acao", acao: { acao: "chat.anunciar", texto: "Um trovão!" } },
            ],
          ],
        },
      ],
    });
    expect(r.erro, r.texto).toBeFalsy();
    const z = sala.verdade.zonas?.[0];
    expect(z?.efeitos).toEqual({
      luzRaioX: 0.5,
      luzSomaM: -2,
      visaoMaxM: 3,
      som: { hash: HASH_VENTO, nome: "vento.mp3", volume: 0.4, laco: false },
    });
    const fluxo = sala.verdade.automacoes?.fluxos[0];
    expect(fluxo?.gatilho).toEqual({ tipo: "zona", quando: "entra", zona: z?.id });
    expect(fluxo?.trilhas[0]?.[0]).toMatchObject({
      bloco: "acao",
      acao: { acao: "som.tocar", hash: HASH_TROVAO, nome: "trovao.mp3", volume: 0.9 },
    });
  });

  it("som que não existe na mesa diz o que fazer", async () => {
    const sala = new SalaSimulada("m");
    const r = await rodar(sala, "automacoes", {
      zonas: [
        {
          cena: "Taverna",
          nome: "Poça",
          pontos: [
            [2, 2],
            [8, 2],
            [8, 6],
          ],
          efeitos: { som: { hash: "nada.mp3" } },
        },
      ],
    });
    expect(r.erro).toBeTruthy();
    expect(r.texto).toContain("`arquivos`");
  });
});

describe("a preparação completa só pelo MCP (Q16)", () => {
  it("sobe som, cria a cena, a zona com tudo, a reação, tokens, luz, handout e trilha, e o estado final bate campo a campo", async () => {
    const sala = new SalaSimulada("m");
    const caixa = new CaixaSimulada();
    sala.arquivos = caixa;

    // 1) Subir o som: o MCP pede o envio; o navegador do mestre o registra na mesa (simulado aqui).
    const envio = await rodar(sala, "arquivos", { acao: "enviar", uso: "som", nome: "vento.mp3" });
    expect(envio.erro, envio.texto).toBeFalsy();
    expect(caixa.pedidos[0]).toMatchObject({ uso: "som", nome: "vento.mp3" });
    comArquivos(sala);

    // 2) A cena, com grid, chegada, cartão, luz e uma porta.
    const cena = await rodar(sala, "cenas", {
      cenas: [
        {
          nome: "Cripta",
          grid: { quadradoM: 1.5, visivel: true },
          chegada: [3, 3],
          cartao: true,
          iluminacao: { dinamica: true, luzAmbiente: 0.2 },
          paredes: [{ de: [1, 1], ate: [12, 1], tipo: "porta", estado: "trancada" }],
        },
      ],
    });
    expect(cena.erro, cena.texto).toBeFalsy();
    const cripta = sala.verdade.cenas.find((c) => c.nome === "Cripta");
    expect(cripta?.grid).toMatchObject({ quadradoM: 1.5, visivel: true });
    expect(cripta?.cartao).toBe(true);
    expect(sala.verdade.paredes.find((p) => p.cenaId === cripta?.id)).toMatchObject({
      tipo: "porta",
      estado: "trancada",
    });

    // 3) Zona com todos os efeitos e o som dela; reação "ao entrar na zona".
    const auto = await rodar(sala, "automacoes", {
      zonas: [
        {
          cena: "Cripta",
          nome: "Sala do vento",
          pontos: [
            [2, 2],
            [9, 2],
            [9, 7],
            [2, 7],
          ],
          efeitos: {
            luzRaioX: 0.6,
            luzSomaM: -1,
            visaoMaxM: 4,
            som: { hash: "vento.mp3", volume: 0.5, laco: true },
          },
        },
      ],
      fluxos: [
        {
          nome: "Aviso ao entrar",
          gatilho: { tipo: "zona", quando: "entra", zona: "Sala do vento" },
          trilhas: [
            [
              {
                bloco: "acao",
                acao: { acao: "chat.anunciar", texto: "O vento uiva.", para: "mestre" },
              },
            ],
          ],
        },
      ],
    });
    expect(auto.erro, auto.texto).toBeFalsy();
    const zona = sala.verdade.zonas?.find((z) => z.nome === "Sala do vento");
    expect(zona).toMatchObject({
      cenaId: cripta?.id,
      ativa: true,
      efeitos: {
        luzRaioX: 0.6,
        luzSomaM: -1,
        visaoMaxM: 4,
        som: { hash: HASH_VENTO, nome: "vento.mp3", volume: 0.5, laco: true },
      },
    });
    expect(zona?.pontos).toHaveLength(4);
    const fluxo = sala.verdade.automacoes?.fluxos.find((r) => r.nome === "Aviso ao entrar");
    expect(fluxo).toMatchObject({
      gatilho: { tipo: "zona", quando: "entra", zona: zona?.id },
      trilhas: [
        [
          {
            bloco: "acao",
            acao: { acao: "chat.anunciar", texto: "O vento uiva.", para: "mestre" },
          },
        ],
      ],
    });

    // 4) O som da zona também pelo `som` (troca por nome), e a trilha da cena.
    const som = await rodar(sala, "som", {
      zonas: [
        { cena: "Cripta", zona: "Sala do vento", som: "trovao.mp3", volume: 0.3, laco: false },
      ],
      lugares: [{ grupo: "ambiente", lugar: 1, som: "vento.mp3", nome: "Vento" }],
      ambientesDaCena: [{ cena: "Cripta", lugares: ["Vento"] }],
    });
    expect(som.erro, som.texto).toBeFalsy();
    expect(sala.verdade.zonas?.[0]?.efeitos.som).toMatchObject({
      hash: HASH_TROVAO,
      volume: 0.3,
      laco: false,
    });
    expect(sala.verdade.cenas.find((c) => c.nome === "Cripta")?.ambientes).toEqual([0]);

    // 5) Fichas, tokens com borda e barra de vida, controle do token.
    await rodar(sala, "fichas", {
      fichas: [
        { nome: "Goblin", monstro: "Goblin" },
        { nome: "Brisa", tipo: "personagem", dono: ["Ana"], pv: { max: 20 } },
      ],
    });
    const tk = await rodar(sala, "cenas", {
      cenas: [
        {
          nome: "Cripta",
          tokens: [
            { ficha: "Goblin", quantidade: 2, em: [4, 4] },
            { ficha: "Brisa", em: [6, 4] },
          ],
        },
      ],
    });
    expect(tk.erro, tk.texto).toBeFalsy();
    const t2 = await rodar(sala, "tokens", {
      tokens: [
        { token: "Goblin 1", borda: "vermelho", barraDeVida: true, cena: "Cripta" },
        {
          token: "Brisa",
          borda: "azul",
          barraDeVida: true,
          controladoPor: ["Ana"],
          cena: "Cripta",
        },
      ],
      grupo: [{ tokens: ["Goblin 1", "Goblin 2"], cena: "Cripta", borda: "laranja" }],
    });
    expect(t2.erro, t2.texto).toBeFalsy();
    const tokens = sala.verdade.tokens.filter((t) => t.cenaId === cripta?.id);
    expect(tokens.map((t) => [t.nome, t.borda, t.barraDeVida ?? true])).toEqual([
      ["Goblin 1", "laranja", true],
      ["Goblin 2", "laranja", true],
      ["Brisa", "azul", true],
    ]);
    expect(tokens.find((t) => t.nome === "Brisa")?.controladoPor).toEqual(["j1"]);

    // 6) Uma luz e um handout.
    const luz = await rodar(sala, "objetos", {
      luzes: [
        {
          cena: "Cripta",
          nome: "Braseiro",
          em: [5, 5],
          claraM: 6,
          penumbraM: 9,
          cor: "#ff8800",
          tremula: true,
          intensidade: 0.8,
        },
      ],
    });
    expect(luz.erro, luz.texto).toBeFalsy();
    const braseiro = sala.verdade.luzes.find((o) => o.nome === "Braseiro");
    expect(braseiro).toMatchObject({
      luz: { claraM: 6, penumbraM: 9, cor: "#ff8800", tremula: true },
    });
    const nota = await rodar(sala, "notas", {
      notas: [{ titulo: "A Cripta antiga", texto: "Ossos e vento.", visivel: "todos" }],
    });
    expect(nota.erro, nota.texto).toBeFalsy();
    expect(sala.verdade.handouts.find((h) => h.titulo === "A Cripta antiga")).toMatchObject({
      texto: "Ossos e vento.",
      visivel: { tipo: "todos" },
    });

    // 7) Tudo entra como rascunho; o mestre publica de uma vez e o jogador passa a ver o que é dele.
    const rasc = await rodar(sala, "rascunhos", { acao: "listar" });
    expect(rasc.texto).toMatch(/cena: Cripta/);
    const pub = await rodar(sala, "rascunhos", { acao: "publicar" });
    expect(pub.erro, pub.texto).toBeFalsy();
    expect(sala.verdade.cenas.find((c) => c.nome === "Cripta")?.rascunho).toBeUndefined();
    // O grupo vai para a cena: o jogador passa a ver a Cripta, o token dele e a luz (e a mesa do mestre fica como está).
    const levar = await rodar(sala, "cenas", { cenas: [{ nome: "Cripta", levarGrupo: true }] });
    expect(levar.erro, levar.texto).toBeFalsy();
    const ana = sala.visaoDe("j1");
    expect(ana.cenas.map((c) => c.nome)).toEqual(["Cripta"]);
    expect(ana.tokens.some((t) => t.nome === "Brisa")).toBe(true);
    // O segredo do mestre continua fora do jogador: a zona e a reação nunca chegam a ele.
    expect(sala.visaoDe("j1").zonas ?? []).toHaveLength(0);
    expect(sala.visaoDe("j1").automacoes).toBeUndefined();
  });
});
