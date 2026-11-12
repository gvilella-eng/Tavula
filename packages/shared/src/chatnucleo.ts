import { pode } from "./capacidades.ts";
import { type Como, interpretarChat, type Mensagem } from "./chat.ts";
import { type FonteDeAleatoriedade, lerExpressao, type Rolagem, rolar } from "./dados.ts";
import type { Estado, Usuario } from "./estado.ts";
import { personagemVisivelPara, podeEditarPersonagem } from "./mapa.ts";
import type { CodigoDeErro, Intencao } from "./protocolo.ts";
import { tempoDaSala } from "./relogio.ts";
import { rolarAtaque, rolarTeste } from "./rolagens.ts";

export type IntencaoDeChat = Extract<
  Intencao,
  { tipo: "chat.enviar" | "dado.rolar" | "chat.modelo" | "chat.magia" | "chat.caracteristica" }
>;

export type ResultadoDaMensagem =
  /** `mensagem` ausente: nada a mostrar (o `/?` é só da tela). */
  | { ok: true; mensagem?: Mensagem }
  | { ok: false; erro: { codigo: CodigoDeErro; mensagem: string } };

const recusa = (codigo: CodigoDeErro, mensagem: string): ResultadoDaMensagem => ({
  ok: false,
  erro: { codigo, mensagem },
});

type Quem = Pick<Usuario, "id" | "papel">;

/** A mensagem do dado de vida (V4a2): bloco `vida` com a rolagem e o PV de depois, falando como o personagem. */
export function mensagemDeDadoDeVida(
  estado: Estado,
  usuario: Quem,
  personagem: { id: string; nome: string; retratoHash?: string | undefined },
  dados: {
    nome: string;
    rolagem: Rolagem;
    curou: number;
    pvAtual: number;
    pvMax: number;
    agoraMs: number;
  },
): Mensagem {
  const seq = estado.seq + 1;
  return {
    id: `m${seq}`,
    seq,
    emSala: tempoDaSala(estado.relogio, dados.agoraMs),
    emReal: dados.agoraMs,
    autorId: usuario.id,
    como: {
      personagemId: personagem.id,
      nome: personagem.nome,
      ...(personagem.retratoHash === undefined ? {} : { retratoHash: personagem.retratoHash }),
    },
    tipo: "modelo",
    modelo: {
      modelo: "vida",
      nome: dados.nome,
      rolagem: dados.rolagem,
      curou: dados.curou,
      pvAtual: dados.pvAtual,
      pvMax: dados.pvMax,
    },
    visivelPara: "todos",
  };
}

/**
 * Monta a mensagem de uma intenção do chat, rolando os dados com `aleatorio` (o que o cliente manda
 * é só a notação; resultado de cliente não existe no schema). Não toca no estado: o núcleo emite o
 * evento. O mestre sempre rola oculto; o jogador precisa de `dado.rolarOculto`.
 */
export function criarMensagem(
  estado: Estado,
  usuario: Quem,
  intencao: IntencaoDeChat,
  agoraMs: number,
  aleatorio: FonteDeAleatoriedade,
): ResultadoDaMensagem {
  const comoId = intencao.dados.como;
  let como: Como | undefined;
  if (comoId !== undefined) {
    const p = estado.personagens.find((x) => x.id === comoId);
    if (!p || (usuario.papel !== "mestre" && !personagemVisivelPara(p, usuario, estado.pastas))) {
      return recusa("personagem_inexistente", "Personagem não encontrado.");
    }
    if (!podeEditarPersonagem(p, usuario)) {
      return recusa("sem_permissao", "Você não edita esse personagem.");
    }
    como = {
      personagemId: p.id,
      nome: p.nome,
      ...(p.retratoHash === undefined ? {} : { retratoHash: p.retratoHash }),
    };
  }

  const seq = estado.seq + 1;
  const base = {
    id: `m${seq}`,
    seq,
    emSala: tempoDaSala(estado.relogio, agoraMs),
    emReal: agoraMs,
    autorId: usuario.id,
    ...(como ? { como } : {}),
  };
  const semPermissaoOculta = () =>
    pode(usuario, "dado.rolarOculto", estado.permissoes)
      ? null
      : recusa("sem_permissao", "Você não pode fazer rolagens ocultas.");
  const ocultaDe = () => ({ visivelPara: { ids: [] as string[] }, oculta: true as const });
  const rolarTodas = (expressoes: string[]): Rolagem[] =>
    expressoes.map((e) => {
      const lida = lerExpressao(e);
      // Já foi validada na leitura; se falhar aqui é bug, e não rolamos nada.
      if (!lida.ok) throw new Error(`expressão inválida: ${e}`);
      return rolar(lida.expressao, aleatorio);
    });

  // Mensagem `magia` (Lote 14): sempre pública; a sala só confere o personagem de quem fala.
  if (intencao.tipo === "chat.magia") {
    return {
      ok: true,
      mensagem: { ...base, tipo: "magia", magia: intencao.dados.magia, visivelPara: "todos" },
    };
  }

  // Mensagem `caracteristica` (V4a): pública, de um personagem que quem fala edita (`como` é obrigatório).
  if (intencao.tipo === "chat.caracteristica") {
    return {
      ok: true,
      mensagem: {
        ...base,
        tipo: "caracteristica",
        caracteristica: intencao.dados.caracteristica,
        visivelPara: "todos",
      },
    };
  }

  if (intencao.tipo === "dado.rolar") {
    const { expressao, oculta: pedidaOculta } = intencao.dados;
    const lida = lerExpressao(expressao);
    if (!lida.ok) return recusa("dados_invalidos", lida.motivo);
    if (pedidaOculta) {
      const negado = semPermissaoOculta();
      if (negado) return negado;
    }
    return {
      ok: true,
      mensagem: {
        ...base,
        tipo: "rolagem",
        rolagens: [rolar(lida.expressao, aleatorio)],
        ...(pedidaOculta ? ocultaDe() : { visivelPara: "todos" }),
      },
    };
  }

  if (intencao.tipo === "chat.modelo") {
    const pedido = intencao.dados;
    if (pedido.oculta) {
      const negado = semPermissaoOculta();
      if (negado) return negado;
    }
    const feito =
      pedido.modelo === "ataque" ? rolarAtaque(pedido, aleatorio) : rolarTeste(pedido, aleatorio);
    if (!feito.ok) return recusa("dados_invalidos", feito.motivo);
    return {
      ok: true,
      mensagem: {
        ...base,
        tipo: "modelo",
        modelo: feito.resultado,
        ...(pedido.oculta ? ocultaDe() : { visivelPara: "todos" }),
      },
    };
  }

  const cmd = interpretarChat(intencao.dados.texto, estado.usuarios);
  switch (cmd.tipo) {
    case "erro":
      return recusa("dados_invalidos", cmd.motivo);
    case "ajuda":
      return { ok: true };
    case "rolar": {
      if (cmd.oculta) {
        const negado = semPermissaoOculta();
        if (negado) return negado;
      }
      return {
        ok: true,
        mensagem: {
          ...base,
          tipo: "rolagem",
          ...(cmd.comentario === "" ? {} : { texto: cmd.comentario }),
          rolagens: rolarTodas([cmd.expressao]),
          ...(cmd.oculta ? ocultaDe() : { visivelPara: "todos" }),
        },
      };
    }
    case "texto":
    case "acao":
    case "sussurro": {
      const rolagens = cmd.inline.length > 0 ? rolarTodas(cmd.inline) : undefined;
      return {
        ok: true,
        mensagem: {
          ...base,
          tipo: rolagens ? "rolagem" : "texto",
          texto: cmd.texto,
          ...(cmd.tipo === "acao" ? { acao: true } : {}),
          ...(rolagens ? { inline: true, rolagens } : {}),
          visivelPara: cmd.tipo === "sussurro" ? { ids: [cmd.destinatarioId] } : "todos",
        },
      };
    }
  }
}
