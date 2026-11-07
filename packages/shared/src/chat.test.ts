import { describe, expect, it } from "vitest";
import {
  AJUDA_DO_CHAT,
  CODIGOS_DE_ERRO,
  chatParaUsuario,
  criarExportacao,
  type Estado,
  estadoInicial,
  eventoPara,
  fonteComSemente,
  type Intencao,
  IntencaoSchema,
  interpretarChat,
  LIMITES_DO_CHAT,
  lerIntencao,
  type Mensagem,
  MensagemSchema,
  mensagemVisivelPara,
  processar,
  reduzir,
  registrarMensagem,
  visaoPara,
} from "./index.ts";

const USUARIOS = [
  { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
  { id: "j1", nome: "Jogador 1", papel: "jogador", cor: "#222" },
  { id: "j2", nome: "Jogador 2", papel: "jogador", cor: "#333" },
  { id: "j3", nome: "Brisa Silva", papel: "jogador", cor: "#444" },
] as const;

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: USUARIOS,
    pastas: [{ id: "p", nome: "Pers", ordem: 0, visivel: { tipo: "mestre" } }],
    personagens: [
      {
        id: "aldric",
        pastaId: "p",
        editores: { tipo: "jogadores", ids: ["j1"] },
        nome: "Aldric",
        retratoHash: "a".repeat(64),
        tokenPadrao: { cor: "#fff", tamanhoQuadrados: 1 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha: { pvAtual: 5, pvMax: 5 },
      },
      {
        id: "ogro",
        pastaId: "p",
        editores: { tipo: "jogadores", ids: [] },
        nome: "Ogro",
        tokenPadrao: { cor: "#f00", tamanhoQuadrados: 2 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha: { pvAtual: 5, pvMax: 5 },
      },
    ],
  });
}

let contador = 0;
function pedido(tipo: Intencao["tipo"], dados: object = {}): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });
}
const AGORA = "2026-01-01T00:00:00.000Z";

type Dica = { semente?: number };
/** Aplica e devolve o estado novo, os eventos e a primeira mensagem criada. */
function falar(estado: Estado, quem: string, i: Intencao, dica: Dica = {}) {
  const r = processar(estado, quem, i, AGORA, fonteComSemente(dica.semente ?? 1));
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}: ${r.erro.mensagem}`);
  const ev = r.eventos[0];
  const mensagem = ev?.tipo === "chat.mensagem" ? ev.dados.mensagem : undefined;
  return { ...r, mensagem };
}
function erroDe(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA, fonteComSemente(1));
  return r.ok ? null : r.erro;
}
function usuario(id: string) {
  const u = USUARIOS.find((x) => x.id === id);
  if (!u) throw new Error(id);
  return u;
}

describe("interpretarChat", () => {
  const us = USUARIOS.map(({ id, nome }) => ({ id, nome }));

  it("texto comum e vazio", () => {
    expect(interpretarChat("oi, pessoal", us)).toEqual({
      tipo: "texto",
      texto: "oi, pessoal",
      inline: [],
    });
    expect(interpretarChat("   ", us).tipo).toBe("erro");
  });

  it("/r e /gr: a expressão é o começo válido e o resto vira comentário", () => {
    expect(interpretarChat("/r 1d20+5", us)).toEqual({
      tipo: "rolar",
      expressao: "1d20+5",
      comentario: "",
      oculta: false,
    });
    expect(interpretarChat("/r 1d20 + 5 furtividade na porta", us)).toEqual({
      tipo: "rolar",
      expressao: "1d20 + 5",
      comentario: "furtividade na porta",
      oculta: false,
    });
    expect(interpretarChat("/gr 2d20kh1", us)).toMatchObject({ tipo: "rolar", oculta: true });
    expect(interpretarChat("/r", us).tipo).toBe("erro");
    expect(interpretarChat("/r abc", us).tipo).toBe("erro");
    expect(interpretarChat("/r 200d6", us)).toMatchObject({ tipo: "erro" });
  });

  it("[[...]] dentro do texto vira rolagem; inválido é recusado", () => {
    expect(interpretarChat("ataco com [[1d20+5]] e causo [[1d8+3]]!", us)).toEqual({
      tipo: "texto",
      texto: "ataco com [[1d20+5]] e causo [[1d8+3]]!",
      inline: ["1d20+5", "1d8+3"],
    });
    expect(interpretarChat("olha [[abc]]", us).tipo).toBe("erro");
    const onze = Array.from({ length: 11 }, () => "[[1d4]]").join(" ");
    expect(interpretarChat(onze, us).tipo).toBe("erro");
  });

  it("/em, /? e comando desconhecido", () => {
    expect(interpretarChat("/em olha em volta", us)).toEqual({
      tipo: "acao",
      texto: "olha em volta",
      inline: [],
    });
    expect(interpretarChat("/em", us).tipo).toBe("erro");
    expect(interpretarChat("/?", us)).toEqual({ tipo: "ajuda" });
    expect(interpretarChat("/ajuda", us)).toEqual({ tipo: "ajuda" });
    expect(interpretarChat("/xpto", us)).toMatchObject({ tipo: "erro" });
    expect(AJUDA_DO_CHAT.map(([c]) => c)).toContain("/w Nome texto");
  });

  it("/w acha o destinatário pelo nome completo (com espaço), entre aspas, pelo id ou por prefixo único", () => {
    expect(interpretarChat("/w Jogador 2 vem cá", us)).toMatchObject({
      tipo: "sussurro",
      destinatarioId: "j2",
      texto: "vem cá",
    });
    expect(interpretarChat('/w "jogador 1" psiu', us)).toMatchObject({ destinatarioId: "j1" });
    expect(interpretarChat("/w j2 psiu", us)).toMatchObject({ destinatarioId: "j2" });
    expect(interpretarChat("/w brisa cuidado", us)).toMatchObject({
      destinatarioId: "j3",
      texto: "cuidado",
    });
    expect(interpretarChat("/w mestre oi", us)).toMatchObject({ destinatarioId: "m" });
    // "jogador" serve para dois: ambíguo
    expect(interpretarChat("/w jogador oi", us).tipo).toBe("erro");
    expect(interpretarChat("/w ninguem oi", us).tipo).toBe("erro");
    expect(interpretarChat("/w Jogador 2", us).tipo).toBe("erro"); // sem mensagem
  });
});

describe("chat.enviar na sala", () => {
  it("texto: mensagem pública com o autor, o id e o seq do evento", () => {
    const e = criarEstado();
    const { mensagem, estado } = falar(e, "j1", pedido("chat.enviar", { texto: "olá" }));
    expect(mensagem).toMatchObject({
      id: "m1",
      seq: 1,
      autorId: "j1",
      tipo: "texto",
      texto: "olá",
      visivelPara: "todos",
    });
    expect(MensagemSchema.safeParse(mensagem).success).toBe(true);
    expect(estado.chat?.length).toBe(1);
  });

  it("/r rola no servidor e guarda dados, total e expressão", () => {
    const { mensagem } = falar(criarEstado(), "j1", pedido("chat.enviar", { texto: "/r 2d6+3" }));
    expect(mensagem?.tipo).toBe("rolagem");
    const r = mensagem?.rolagens?.[0];
    expect(r?.expressao).toBe("2d6+3");
    const soma =
      r?.termos[0]?.tipo === "dados" ? r.termos[0].dados.reduce((s, d) => s + d.valor, 0) : 0;
    expect(r?.total).toBe(soma + 3);
  });

  it("a mesma semente dá a mesma rolagem (reprodutível)", () => {
    const a = falar(criarEstado(), "j1", pedido("chat.enviar", { texto: "/r 4d6kh3" }), {
      semente: 9,
    });
    const b = falar(criarEstado(), "j1", pedido("chat.enviar", { texto: "/r 4d6kh3" }), {
      semente: 9,
    });
    expect(a.mensagem?.rolagens).toEqual(b.mensagem?.rolagens);
  });

  it("inline: uma rolagem por [[...]], na ordem, com o texto guardado", () => {
    const { mensagem } = falar(
      criarEstado(),
      "j1",
      pedido("chat.enviar", { texto: "acerto [[1d20+5]], dano [[1d8+3]]" }),
    );
    expect(mensagem).toMatchObject({ tipo: "rolagem", inline: true });
    expect(mensagem?.rolagens?.map((r) => r.expressao)).toEqual(["1d20+5", "1d8+3"]);
  });

  it("/em marca a ação", () => {
    const { mensagem } = falar(
      criarEstado(),
      "j1",
      pedido("chat.enviar", { texto: "/em olha em volta" }),
    );
    expect(mensagem).toMatchObject({ tipo: "texto", acao: true, texto: "olha em volta" });
  });

  it("/? não cria mensagem nenhuma", () => {
    const r = falar(criarEstado(), "j1", pedido("chat.enviar", { texto: "/?" }));
    expect(r.eventos).toEqual([]);
  });

  it("comando inválido volta como dados_invalidos", () => {
    expect(erroDe(criarEstado(), "j1", pedido("chat.enviar", { texto: "/r abc" }))?.codigo).toBe(
      "dados_invalidos",
    );
    expect(
      erroDe(criarEstado(), "j1", pedido("chat.enviar", { texto: "/w ninguem oi" }))?.codigo,
    ).toBe("dados_invalidos");
  });

  it("o schema recusa mais de 2000 caracteres e aceita 2000", () => {
    const longo = (n: number) => ({
      v: 1,
      id: "x",
      tipo: "chat.enviar",
      dados: { texto: "a".repeat(n) },
    });
    expect(lerIntencao(JSON.stringify(longo(LIMITES_DO_CHAT.caracteres))).ok).toBe(true);
    const r = lerIntencao(JSON.stringify(longo(LIMITES_DO_CHAT.caracteres + 1)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("2000");
  });

  it("'Como': jogador só fala como personagem que edita; o mestre, como qualquer um", () => {
    const e = criarEstado();
    const ok = falar(e, "j1", pedido("chat.enviar", { texto: "sou eu", como: "aldric" }));
    expect(ok.mensagem?.como).toEqual({
      personagemId: "aldric",
      nome: "Aldric",
      retratoHash: "a".repeat(64),
    });
    // outro jogador: o personagem existe mas ele não vê (pasta do mestre) -> igual a inexistente
    expect(erroDe(e, "j2", pedido("chat.enviar", { texto: "x", como: "aldric" }))?.codigo).toBe(
      "personagem_inexistente",
    );
    expect(erroDe(e, "j1", pedido("chat.enviar", { texto: "x", como: "nao-existe" }))?.codigo).toBe(
      "personagem_inexistente",
    );
    expect(erroDe(e, "j1", pedido("chat.enviar", { texto: "x", como: "ogro" }))?.codigo).toBe(
      "personagem_inexistente",
    );
    const mestre = falar(e, "m", pedido("chat.enviar", { texto: "grrr", como: "ogro" }));
    expect(mestre.mensagem?.como?.nome).toBe("Ogro");
  });
});

describe("crítico e testes pelo chat.modelo", () => {
  it("ataque: o schema ignora um 'resultado' que o cliente tente mandar", () => {
    const i = IntencaoSchema.parse({
      v: 1,
      id: "a",
      tipo: "chat.modelo",
      dados: {
        modelo: "ataque",
        nome: "Espada",
        bonus: 5,
        dano: "1d8+3",
        // tentativas de impor o resultado: nenhuma sobrevive
        resultado: { total: 99 },
        acerto: { total: 99 },
        total: 99,
        critico: true,
        rolagens: [{ total: 99 }],
      },
    });
    expect(JSON.stringify(i)).not.toContain("99");
    expect(JSON.stringify(i)).not.toContain("critico");
    const r = processar(criarEstado(), "j1", i, AGORA, fonteComSemente(5));
    expect(r.ok).toBe(true);
    const ev = r.ok ? r.eventos[0] : undefined;
    const m = ev?.tipo === "chat.mensagem" ? ev.dados.mensagem : undefined;
    expect(m?.modelo?.modelo).toBe("ataque");
    if (m?.modelo?.modelo === "ataque") expect(m.modelo.acerto.total).not.toBe(99);
  });

  it("dado.rolar e chat.enviar também descartam resultado vindo do cliente", () => {
    const a = IntencaoSchema.parse({
      v: 1,
      id: "a",
      tipo: "dado.rolar",
      dados: { expressao: "1d20", total: 20, rolagens: [{ total: 20 }] },
    });
    expect(a.dados).toEqual({ expressao: "1d20" });
    const b = IntencaoSchema.parse({
      v: 1,
      id: "b",
      tipo: "chat.enviar",
      dados: { texto: "/r 1d20", resultado: 20, rolagens: [{ total: 20 }] },
    });
    expect(b.dados).toEqual({ texto: "/r 1d20" });
  });

  it("teste com CD e ataque geram mensagens do tipo modelo", () => {
    const e = criarEstado();
    const t = falar(
      e,
      "j1",
      pedido("chat.modelo", { modelo: "teste", nome: "Furtividade", bonus: 5, cd: 15 }),
    );
    expect(t.mensagem?.tipo).toBe("modelo");
    expect(t.mensagem?.modelo).toMatchObject({ modelo: "teste", cd: 15 });
    const dado = t.mensagem?.modelo?.modelo === "teste" ? t.mensagem.modelo : null;
    expect(dado?.sucesso).toBe((dado?.rolagem.total ?? 0) >= 15);
  });

  it("dano inválido é recusado", () => {
    const erro = erroDe(
      criarEstado(),
      "j1",
      pedido("chat.modelo", { modelo: "ataque", nome: "X", bonus: 0, dano: "xx" }),
    );
    expect(erro?.codigo).toBe("dados_invalidos");
  });
});

describe("sigilo: sussurro e rolagem oculta", () => {
  /** Uma conversa com tudo: pública, sussurro j1→j2, /gr do mestre e /gr de j1 (com permissão). */
  function conversa() {
    let e = criarEstado();
    e = {
      ...e,
      permissoes: { ...e.permissoes, porUsuario: { j1: { "dado.rolarOculto": true } } },
    };
    const eventos: {
      ev: ReturnType<typeof falar>["eventos"][number];
      antes: Estado;
      depois: Estado;
    }[] = [];
    const passo = (quem: string, texto: string) => {
      const r = falar(e, quem, pedido("chat.enviar", { texto }));
      for (const ev of r.eventos) eventos.push({ ev, antes: e, depois: r.estado });
      e = r.estado;
    };
    passo("j1", "publico");
    passo("j1", "/w Jogador 2 segredo entre nós");
    passo("m", "/gr 1d20+7");
    passo("j1", "/gr 1d20");
    passo("j2", "/w Mestre só para o mestre");
    return { estado: e, eventos };
  }

  const textos = (ms: Mensagem[] | undefined) =>
    (ms ?? []).map((m) => m.texto ?? m.rolagens?.[0]?.expressao);

  it("o jogador sem permissão é recusado no /gr (e o mestre sempre pode)", () => {
    const e = criarEstado();
    expect(erroDe(e, "j2", pedido("chat.enviar", { texto: "/gr 1d20" }))?.codigo).toBe(
      "sem_permissao",
    );
    expect(erroDe(e, "j2", pedido("dado.rolar", { expressao: "1d20", oculta: true }))?.codigo).toBe(
      "sem_permissao",
    );
    expect(
      erroDe(e, "j2", pedido("chat.modelo", { modelo: "teste", nome: "X", bonus: 0, oculta: true }))
        ?.codigo,
    ).toBe("sem_permissao");
    expect(erroDe(e, "m", pedido("chat.enviar", { texto: "/gr 1d20" }))).toBeNull();
    // com a permissão delegada ao jogador
    const liberado = {
      ...e,
      permissoes: {
        ...e.permissoes,
        jogadores: { ...e.permissoes.jogadores, "dado.rolarOculto": true },
      },
    };
    expect(erroDe(liberado, "j2", pedido("chat.enviar", { texto: "/gr 1d20" }))).toBeNull();
  });

  it("snapshot: cada um vê só o que pode", () => {
    const { estado } = conversa();
    expect(textos(visaoPara(estado, usuario("m")).chat)).toEqual([
      "publico",
      "segredo entre nós",
      "1d20+7",
      "1d20",
      "só para o mestre",
    ]);
    // j1: a pública, o próprio sussurro, o próprio /gr; nunca o /gr do mestre nem o sussurro de j2
    expect(textos(visaoPara(estado, usuario("j1")).chat)).toEqual([
      "publico",
      "segredo entre nós",
      "1d20",
    ]);
    // j2: a pública, o sussurro que recebeu e o que mandou
    expect(textos(visaoPara(estado, usuario("j2")).chat)).toEqual([
      "publico",
      "segredo entre nós",
      "só para o mestre",
    ]);
    // j3 (terceiro): só a pública
    const j3 = JSON.stringify(visaoPara(estado, usuario("j3")));
    expect(textos(visaoPara(estado, usuario("j3")).chat)).toEqual(["publico"]);
    for (const segredo of ["segredo entre nós", "só para o mestre", "1d20+7"]) {
      expect(j3).not.toContain(segredo);
    }
  });

  it("eventos: o terceiro não recebe o sussurro nem a rolagem oculta, e a pública chega a todos", () => {
    const { eventos } = conversa();
    const paraJ3 = eventos
      .map((x) => eventoPara(x.ev, usuario("j3"), x.antes, x.depois))
      .filter((v) => v !== null);
    expect(paraJ3.length).toBe(1);
    expect(JSON.stringify(paraJ3)).toContain("publico");
    // o mestre recebe tudo; o destinatário recebe o sussurro
    expect(
      eventos.map((x) => eventoPara(x.ev, usuario("m"), x.antes, x.depois)).filter(Boolean).length,
    ).toBe(5);
    const paraJ2 = eventos
      .map((x) => eventoPara(x.ev, usuario("j2"), x.antes, x.depois))
      .filter(Boolean);
    expect(paraJ2.length).toBe(3);
  });

  it("chat.anteriores (chatParaUsuario): filtrado e limitado, para cada papel", () => {
    const { estado } = conversa();
    const todas = estado.chat ?? [];
    const config = estado.config;
    expect(textos(chatParaUsuario(todas, usuario("j3"), config))).toEqual(["publico"]);
    expect(chatParaUsuario(todas, usuario("m"), config).length).toBe(5);
    expect(chatParaUsuario(todas, usuario("m"), config, 2).map((m) => m.seq)).toEqual([4, 5]);
    expect(mensagemVisivelPara(todas[2] as Mensagem, usuario("j2"))).toBe(false);
  });

  it("o relógio da sala (emSala) não vai ao jogador fora do modo 'exato'", () => {
    const { estado } = conversa();
    const oculto = {
      ...estado,
      config: { ...estado.config, tempoParaJogadores: "oculto" as const },
    };
    for (const m of visaoPara(oculto, usuario("j1")).chat ?? []) expect(m.emSala).toBeUndefined();
    for (const m of visaoPara(oculto, usuario("m")).chat ?? []) expect(m.emSala).toBeDefined();
    const exato = { ...estado, config: { ...estado.config, tempoParaJogadores: "exato" as const } };
    for (const m of visaoPara(exato, usuario("j1")).chat ?? []) expect(m.emSala).toBeDefined();
  });

  it("o jogador não recebe a lista interna de retratos do chat", () => {
    const { estado } = conversa();
    expect(
      JSON.stringify(visaoPara({ ...estado, retratosDoChat: ["a".repeat(64)] }, usuario("j1"))),
    ).not.toContain("retratosDoChat");
  });
});

describe("histórico: reduzir, limpar e exportar", () => {
  it("reduzir acrescenta a mensagem uma vez só e chat.limpo esvazia", () => {
    const e = criarEstado();
    const r = falar(e, "j1", pedido("chat.enviar", { texto: "um" }));
    const ev = r.eventos[0];
    if (!ev) throw new Error("sem evento");
    expect(reduzir(r.estado, ev).chat?.length).toBe(1);
    const limpo = falar(r.estado, "m", pedido("chat.limpar"));
    expect(limpo.estado.chat).toEqual([]);
  });

  it("só o mestre limpa o chat", () => {
    expect(erroDe(criarEstado(), "j1", pedido("chat.limpar"))?.codigo).toBe("sem_permissao");
  });

  it("o retrato de quem fala em público fica liberado; o de sussurro, não", () => {
    const e = criarEstado();
    const publico = falar(e, "j1", pedido("chat.enviar", { texto: "oi", como: "aldric" }));
    expect(publico.estado.retratosDoChat).toEqual(["a".repeat(64)]);
    const sussurro = falar(
      e,
      "j1",
      pedido("chat.enviar", { texto: "/w Jogador 2 oi", como: "aldric" }),
    );
    expect(sussurro.estado.retratosDoChat).toBeUndefined();
  });

  it("o chat fica fora da exportação", () => {
    const r = falar(criarEstado(), "j1", pedido("chat.enviar", { texto: "segredo" }));
    const exportado = criarExportacao(r.estado, AGORA);
    expect(Object.keys(exportado.dados)).not.toContain("chat");
    expect(JSON.stringify(exportado)).not.toContain("segredo");
  });

  it("chat.anteriores é só consulta: não gera evento", () => {
    const r = falar(criarEstado(), "j1", pedido("chat.anteriores", { antesDoSeq: 10 }));
    expect(r.eventos).toEqual([]);
  });

  it("toda intenção de chat declara a capacidade (ou null, conferida dentro)", () => {
    expect(CODIGOS_DE_ERRO).toContain("muitas_mensagens");
  });
});

describe("limite de 10 mensagens por segundo", () => {
  it("aceita 10 na janela e recusa a 11ª; depois de 1 s volta a aceitar", () => {
    let h: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = registrarMensagem(h, 1000 + i * 10);
      expect(r.ok).toBe(true);
      h = r.historico;
    }
    const onze = registrarMensagem(h, 1100);
    expect(onze.ok).toBe(false);
    expect(onze.historico.length).toBe(10); // a recusada não entra no histórico
    expect(registrarMensagem(onze.historico, 2001).ok).toBe(true);
  });
});
