import { describe, expect, it } from "vitest";
import { lerIntencao, lerMensagemDaSala, mensagem, VERSAO_PROTOCOLO } from "./index.ts";

const valida = (o: object) => JSON.stringify({ v: 1, id: "p1", ...o });

describe("schemas do protocolo", () => {
  it("aceita intenções bem formadas", () => {
    expect(lerIntencao(valida({ tipo: "nota.editar", dados: { texto: "oi" } })).ok).toBe(true);
    expect(lerIntencao(valida({ tipo: "campanha.exportar", dados: {} })).ok).toBe(true);
    expect(
      lerIntencao(
        valida({ tipo: "permissao.alterar", dados: { capacidade: "nota.editar", valor: false } }),
      ).ok,
    ).toBe(true);
  });

  it.each([
    ["não é JSON", "{{"],
    ["não é texto", 42],
    ["sem versão", JSON.stringify({ id: "p", tipo: "nota.editar", dados: { texto: "x" } })],
    [
      "versão errada",
      JSON.stringify({ v: 2, id: "p", tipo: "nota.editar", dados: { texto: "x" } }),
    ],
    ["sem id", JSON.stringify({ v: 1, tipo: "nota.editar", dados: { texto: "x" } })],
    ["tipo desconhecido", valida({ tipo: "token.mover", dados: {} })],
    ["dados com tipo errado", valida({ tipo: "nota.editar", dados: { texto: 5 } })],
    ["sem dados", valida({ tipo: "nota.editar" })],
    ["nota grande demais", valida({ tipo: "nota.editar", dados: { texto: "x".repeat(20_001) } })],
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
      valida({ tipo: "permissao.alterar", dados: { capacidade: "nota.editar", valor: null } }),
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
