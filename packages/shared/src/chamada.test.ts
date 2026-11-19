import { describe, expect, it } from "vitest";
import {
  chamadoDentroDoLimite,
  destinoDoSinal,
  type EntradaNaChamada,
  entrarNaChamada,
  gastarSinal,
  INTERVALO_MINIMO_DO_CHAMADO_MS,
  IntencaoSchema,
  LIMITE_DE_SINAIS,
  lerMensagemDaSala,
  MAXIMO_NA_CHAMADA,
  mensagem,
  mudarEstadoNaChamada,
  podeChamar,
  sairDaChamada,
  visaoDaChamada,
} from "./index.ts";

// CH1: a regra da sinalização da chamada. Pura: a sala guarda as entradas no socket e chama estas funções.

const ENTRAR = { microfone: true, camera: true, soOuvindo: false };
const membro = (usuarioId: string, conexaoId = `c-${usuarioId}`) => ({
  usuarioId,
  conexaoId,
  membro: true,
});

function com(...ids: string[]): EntradaNaChamada[] {
  let entradas: EntradaNaChamada[] = [];
  for (const id of ids) {
    const r = entrarNaChamada(entradas, membro(id), ENTRAR);
    if (r.erro) throw new Error(r.erro.mensagem);
    entradas = r.entradas;
  }
  return entradas;
}

describe("chamada: entrar", () => {
  it("só membro entra; o Claude nunca", () => {
    expect(entrarNaChamada([], { ...membro("x"), membro: false }, ENTRAR).erro?.codigo).toBe(
      "sem_permissao",
    );
    expect(entrarNaChamada([], { ...membro("x"), claude: true }, ENTRAR).erro?.codigo).toBe(
      "sem_permissao",
    );
  });

  it("entra com o estado pedido e aparece na ordem de entrada, sem a conexão", () => {
    const e = com("a", "b");
    expect(visaoDaChamada(e)).toEqual([
      {
        usuarioId: "a",
        microfone: true,
        camera: true,
        fundo: "nenhum",
        surdo: false,
        soOuvindo: false,
      },
      {
        usuarioId: "b",
        microfone: true,
        camera: true,
        fundo: "nenhum",
        surdo: false,
        soOuvindo: false,
      },
    ]);
    expect(JSON.stringify(visaoDaChamada(e))).not.toContain("conexaoId");
  });

  it("entrar só ouvindo: sem microfone nem câmera, e o estado não os liga depois", () => {
    const r = entrarNaChamada([], membro("a"), { microfone: true, camera: true, soOuvindo: true });
    if (r.erro) throw new Error("não devia falhar");
    expect(r.entradas[0]).toMatchObject({ microfone: false, camera: false, soOuvindo: true });
    const m = mudarEstadoNaChamada(r.entradas, "c-a", {
      microfone: true,
      camera: true,
      fundo: "forte",
      surdo: true,
    });
    expect(m.erro).toBeUndefined();
    expect(m.entradas?.[0]).toMatchObject({
      microfone: false,
      camera: false,
      fundo: "nenhum",
      surdo: true,
    });
  });

  it("a mesma pessoa por outra janela substitui a antiga", () => {
    const e = com("a", "b");
    const r = entrarNaChamada(e, membro("a", "outra"), ENTRAR);
    expect(r.erro).toBeUndefined();
    expect(r.substituidas).toEqual(["c-a"]);
    expect(r.entradas?.map((x) => x.conexaoId)).toEqual(["c-b", "outra"]);
  });

  it("a 9ª pessoa leva 'chamada cheia'; quem já está (ou troca de janela) não", () => {
    const ids = Array.from({ length: MAXIMO_NA_CHAMADA }, (_, i) => `u${i}`);
    const cheia = com(...ids);
    expect(cheia).toHaveLength(8);
    expect(entrarNaChamada(cheia, membro("novo"), ENTRAR).erro?.codigo).toBe("chamada_cheia");
    expect(entrarNaChamada(cheia, membro("u0", "outra"), ENTRAR).erro).toBeUndefined();
    expect(entrarNaChamada(cheia, membro("u1"), ENTRAR).erro).toBeUndefined();
  });
});

describe("chamada: estado e sair", () => {
  it("só quem está na chamada muda o estado", () => {
    const e = com("a");
    expect(
      mudarEstadoNaChamada(e, "fora", {
        microfone: false,
        camera: false,
        fundo: "nenhum",
        surdo: false,
      }).erro?.codigo,
    ).toBe("fora_da_chamada");
    const r = mudarEstadoNaChamada(e, "c-a", {
      microfone: false,
      camera: true,
      fundo: "desfocar",
      surdo: false,
    });
    expect(r.entradas?.[0]).toMatchObject({ microfone: false, fundo: "desfocar" });
  });

  it("sair tira a conexão; sair de novo não muda nada", () => {
    const e = com("a", "b");
    const s = sairDaChamada(e, "c-a");
    expect(s.map((x) => x.usuarioId)).toEqual(["b"]);
    expect(sairDaChamada(s, "c-a")).toEqual(s);
  });
});

describe("chamada: sinal", () => {
  it("vai de quem está na chamada a quem está na chamada", () => {
    const e = com("a", "b");
    const r = destinoDoSinal(e, { conexaoId: "c-a" }, "b");
    expect(r.erro).toBeUndefined();
    expect(r.destino?.conexaoId).toBe("c-b");
    expect(r.origem?.usuarioId).toBe("a");
  });

  it("quem manda de fora da chamada, para si mesmo ou para quem está fora é barrado", () => {
    const e = com("a", "b");
    expect(destinoDoSinal(e, { conexaoId: "intruso" }, "b").erro?.codigo).toBe("fora_da_chamada");
    expect(destinoDoSinal(e, { conexaoId: "c-a" }, "a").erro?.codigo).toBe("dados_invalidos");
    expect(destinoDoSinal(e, { conexaoId: "c-a" }, "z").erro?.codigo).toBe("fora_da_chamada");
  });

  it("o esquema limita o tamanho e pede exatamente uma das partes; o 'de' nunca vem do cliente", () => {
    const tenta = (dados: object) =>
      IntencaoSchema.safeParse({ v: 1, id: "i", tipo: "chamada.sinal", dados }).success;
    const sdp = "v=0\r\n";
    expect(tenta({ para: "b", descricao: { tipo: "offer", sdp } })).toBe(true);
    expect(
      tenta({ para: "b", candidato: { candidate: "candidate:1 1 udp 1 1.2.3.4 5 typ host" } }),
    ).toBe(true);
    expect(tenta({ para: "b" })).toBe(false);
    expect(
      tenta({ para: "b", descricao: { tipo: "offer", sdp }, candidato: { candidate: "x" } }),
    ).toBe(false);
    expect(tenta({ para: "b", descricao: { tipo: "offer", sdp: "x".repeat(16_001) } })).toBe(false);
    expect(tenta({ para: "b", candidato: { candidate: "x".repeat(1_001) } })).toBe(false);
    expect(tenta({ para: "b", descricao: { tipo: "rollback", sdp } })).toBe(false);
  });

  it("a mensagem da sala leva o 'de' carimbado", () => {
    const texto = mensagem({
      tipo: "chamada.sinal",
      dados: { de: "a", descricao: { tipo: "answer", sdp: "v=0" } },
    });
    const lida = lerMensagemDaSala(texto);
    expect(lida.ok && lida.valor.tipo).toBe("chamada.sinal");
  });

  it("o limite de frequência: a rajada passa, o excesso é barrado e o balde enche com o tempo", () => {
    let balde: ReturnType<typeof gastarSinal>["balde"] | undefined;
    let aceitos = 0;
    for (let i = 0; i < LIMITE_DE_SINAIS.rajada + 20; i++) {
      const g = gastarSinal(balde, 1_000);
      balde = g.balde;
      if (g.ok) aceitos++;
    }
    expect(aceitos).toBe(LIMITE_DE_SINAIS.rajada);
    expect(gastarSinal(balde, 1_000 + 1_000).ok).toBe(true);
  });
});

describe("chamada: chamar", () => {
  it("de dentro da chamada, a um membro que está fora", () => {
    const e = com("a");
    expect(
      podeChamar(e, { conexaoId: "c-a" }, { usuarioId: "b", membro: true }).erro,
    ).toBeUndefined();
  });

  it("barra quem está fora da chamada, quem não é membro, quem já está e a si mesmo", () => {
    const e = com("a", "b");
    expect(podeChamar(e, { conexaoId: "x" }, { usuarioId: "c", membro: true }).erro?.codigo).toBe(
      "fora_da_chamada",
    );
    expect(
      podeChamar(e, { conexaoId: "c-a" }, { usuarioId: "c", membro: false }).erro?.codigo,
    ).toBe("dados_invalidos");
    expect(podeChamar(e, { conexaoId: "c-a" }, { usuarioId: "b", membro: true }).erro?.codigo).toBe(
      "dados_invalidos",
    );
    expect(podeChamar(e, { conexaoId: "c-a" }, { usuarioId: "a", membro: true }).erro?.codigo).toBe(
      "dados_invalidos",
    );
  });

  it("chamar a mesma pessoa de novo espera o intervalo", () => {
    expect(chamadoDentroDoLimite(undefined, 5)).toBe(true);
    expect(chamadoDentroDoLimite(1_000, 1_000 + INTERVALO_MINIMO_DO_CHAMADO_MS - 1)).toBe(false);
    expect(chamadoDentroDoLimite(1_000, 1_000 + INTERVALO_MINIMO_DO_CHAMADO_MS)).toBe(true);
  });
});

describe("chamada: nada grava", () => {
  it("o núcleo recusa a intenção que chega sem passar pela janela da chamada (sem socket)", async () => {
    const { estadoInicial, processar } = await import("./index.ts");
    const estado = estadoInicial({
      usuarios: [{ id: "m", nome: "M", papel: "mestre", cor: "#aa1111" }],
    });
    const i = IntencaoSchema.parse({ v: 1, id: "x", tipo: "chamada.entrar", dados: ENTRAR });
    const r = processar(estado, "m", i, "2026-01-01T00:00:00.000Z");
    expect(r.ok).toBe(false);
  });
});
