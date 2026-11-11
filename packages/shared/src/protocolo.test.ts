import { describe, expect, it } from "vitest";
import { lerIntencao, lerMensagemDaSala, mensagem, VERSAO_PROTOCOLO } from "./index.ts";

const valida = (o: object) => JSON.stringify({ v: 1, id: "p1", ...o });

describe("schemas do protocolo", () => {
  it("aceita intenções bem formadas", () => {
    expect(lerIntencao(valida({ tipo: "handout.apagar", dados: { id: "h1" } })).ok).toBe(true);
    expect(lerIntencao(valida({ tipo: "campanha.exportar", dados: {} })).ok).toBe(true);
    expect(
      lerIntencao(
        valida({ tipo: "permissao.alterar", dados: { capacidade: "luz.apagar", valor: false } }),
      ).ok,
    ).toBe(true);
  });

  it.each([
    ["não é JSON", "{{"],
    ["não é texto", 42],
    ["sem versão", JSON.stringify({ id: "p", tipo: "handout.apagar", dados: { id: "x" } })],
    [
      "versão errada",
      JSON.stringify({ v: 2, id: "p", tipo: "handout.apagar", dados: { id: "x" } }),
    ],
    ["sem id", JSON.stringify({ v: 1, tipo: "handout.apagar", dados: { id: "x" } })],
    ["tipo desconhecido", valida({ tipo: "token.mover", dados: {} })],
    ["dados com tipo errado", valida({ tipo: "handout.apagar", dados: { id: 5 } })],
    ["sem dados", valida({ tipo: "handout.apagar" })],
    [
      "texto de handout grande demais",
      valida({
        tipo: "handout.editar",
        dados: { id: "h1", mudancas: { texto: "x".repeat(20_001) } },
      }),
    ],
    [
      "fonte de handout inexistente",
      valida({ tipo: "handout.editar", dados: { id: "h1", mudancas: { fonte: "comic" } } }),
    ],
    ["a nota antiga saiu do protocolo", valida({ tipo: "nota.editar", dados: { texto: "oi" } })],
    [
      "papel assistente",
      valida({ tipo: "papel.alterar", dados: { usuarioId: "a", papel: "assistente" } }),
    ],
    [
      "capacidade inexistente",
      valida({ tipo: "permissao.alterar", dados: { capacidade: "voar", valor: true } }),
    ],
    [
      "remover exceção sem usuário",
      valida({ tipo: "permissao.alterar", dados: { capacidade: "luz.apagar", valor: null } }),
    ],
  ])("rejeita: %s", (_nome, entrada) => {
    expect(lerIntencao(entrada).ok).toBe(false);
  });

  it("valida as mensagens da sala nos dois sentidos", () => {
    const erro = mensagem({
      tipo: "erro",
      dados: { idPedido: null, codigo: "sem_permissao", mensagem: "não" },
    });
    expect(JSON.parse(erro).v).toBe(VERSAO_PROTOCOLO);
    expect(lerMensagemDaSala(erro).ok).toBe(true);
    expect(lerMensagemDaSala(JSON.stringify({ v: 1, tipo: "erro", dados: {} })).ok).toBe(false);
    expect(lerMensagemDaSala(JSON.stringify({ v: 1, tipo: "outra", dados: {} })).ok).toBe(false);
  });
});
