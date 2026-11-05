import { ehCapacidadeDelegavel, pode } from "./capacidades.ts";
import type { Estado, Usuario } from "./estado.ts";
import {
  type CodigoDeErro,
  capacidadeDaIntencao,
  type EventoSala,
  type Exportacao,
  ExportacaoSchema,
  type Intencao,
} from "./protocolo.ts";

export type ErroDaSala = { codigo: CodigoDeErro; mensagem: string };

export type Resultado =
  | {
      ok: true;
      estado: Estado;
      eventos: EventoSala[];
      /** Quem deve receber um snapshot novo (em vez do evento, no caso de quem mudou de papel). */
      snapshotPara: "todos" | string[];
      /** Preenchido por `campanha.exportar`: vai só para quem pediu. */
      exportacao?: Exportacao;
    }
  | { ok: false; erro: ErroDaSala };

type Visao = Pick<Usuario, "id" | "papel">;
type NovoEvento = EventoSala extends infer E
  ? E extends unknown
    ? Omit<E, "seq" | "origem">
    : never
  : never;

function recusa(codigo: CodigoDeErro, mensagem: string): Resultado {
  return { ok: false, erro: { codigo, mensagem } };
}

function totalDeMestres(estado: Estado): number {
  return estado.usuarios.filter((u) => u.papel === "mestre").length;
}

export function criarExportacao(estado: Estado, agora: string): Exportacao {
  return {
    formato: "tabletop-campanha",
    versao: 1,
    exportadoEm: agora,
    dados: { ...estado, notaMestre: estado.notaMestre ?? "" },
  };
}

/** Valida um arquivo de exportação: formato, ids únicos, pelo menos um mestre, exceções válidas. */
export function lerExportacao(
  bruto: unknown,
): { ok: true; exportacao: Exportacao } | { ok: false; motivo: string } {
  const r = ExportacaoSchema.safeParse(bruto);
  if (!r.success) {
    const problema = r.error.issues[0];
    return { ok: false, motivo: `${problema?.path.join(".") ?? ""}: ${problema?.message ?? ""}` };
  }
  const { usuarios, permissoes } = r.data.dados;
  const ids = new Set(usuarios.map((u) => u.id));
  if (ids.size !== usuarios.length) return { ok: false, motivo: "ids de usuário repetidos" };
  if (!usuarios.some((u) => u.papel === "mestre"))
    return { ok: false, motivo: "sem nenhum mestre" };
  for (const id of Object.keys(permissoes.porUsuario)) {
    if (!ids.has(id)) return { ok: false, motivo: `exceção para usuário desconhecido: ${id}` };
  }
  return { ok: true, exportacao: r.data };
}

/**
 * Aplica um evento ao estado. Usada pela sala e pelo cliente: os dois lados nunca divergem.
 * Evento com `seq` antigo (já refletido no estado) é ignorado.
 */
export function reduzir(estado: Estado, evento: EventoSala): Estado {
  if (evento.seq <= estado.seq) return estado;
  const base = { ...estado, seq: evento.seq };
  switch (evento.tipo) {
    case "nota.alterada":
      return { ...base, notaMesa: evento.dados.texto };
    case "notaMestre.alterada":
      return { ...base, notaMestre: evento.dados.texto };
    case "papel.alterado":
      return {
        ...base,
        usuarios: base.usuarios.map((u) =>
          u.id === evento.dados.usuarioId ? { ...u, papel: evento.dados.papel } : u,
        ),
      };
    case "permissao.alterada": {
      const { capacidade, valor, usuarioId } = evento.dados;
      if (!ehCapacidadeDelegavel(capacidade)) return base;
      const { permissoes } = base;
      if (usuarioId === undefined) {
        if (valor === null) return base;
        return {
          ...base,
          permissoes: {
            ...permissoes,
            jogadores: { ...permissoes.jogadores, [capacidade]: valor },
          },
        };
      }
      const excecoes = { ...permissoes.porUsuario[usuarioId] };
      if (valor === null) delete excecoes[capacidade];
      else excecoes[capacidade] = valor;
      const porUsuario = { ...permissoes.porUsuario, [usuarioId]: excecoes };
      if (Object.keys(excecoes).length === 0) delete porUsuario[usuarioId];
      return { ...base, permissoes: { ...permissoes, porUsuario } };
    }
  }
}

/**
 * Processa uma intenção: confere a capacidade, valida as regras e devolve o novo estado e os
 * eventos (numerados a partir de `estado.seq`). Pura: não grava nem envia nada.
 */
export function processar(
  estado: Estado,
  usuarioId: string,
  intencao: Intencao,
  agora: string,
): Resultado {
  const usuario = estado.usuarios.find((u) => u.id === usuarioId);
  if (!usuario) return recusa("usuario_inexistente", "Usuário desconhecido.");

  const exigida = capacidadeDaIntencao[intencao.tipo];
  if (!pode(usuario, exigida, estado.permissoes)) {
    return recusa("sem_permissao", `Sem permissão (${exigida}).`);
  }

  const origem = { usuarioId, idPedido: intencao.id };
  let proximo = estado;
  const eventos: EventoSala[] = [];
  const emitir = (evento: NovoEvento) => {
    const completo = { ...evento, seq: proximo.seq + 1, origem } as EventoSala;
    eventos.push(completo);
    proximo = reduzir(proximo, completo);
  };
  const aplicado = (snapshotPara: string[] = []): Resultado => ({
    ok: true,
    estado: proximo,
    eventos,
    snapshotPara,
  });

  switch (intencao.tipo) {
    case "nota.editar":
      emitir({ tipo: "nota.alterada", dados: { texto: intencao.dados.texto } });
      return aplicado();

    case "notaMestre.editar":
      emitir({ tipo: "notaMestre.alterada", dados: { texto: intencao.dados.texto } });
      return aplicado();

    case "papel.alterar": {
      const { usuarioId: alvoId, papel } = intencao.dados;
      const alvo = estado.usuarios.find((u) => u.id === alvoId);
      if (!alvo) return recusa("usuario_inexistente", "Usuário não encontrado.");
      if (alvo.papel === papel) return aplicado();
      if (alvo.papel === "mestre" && totalDeMestres(estado) <= 1) {
        return recusa("ultimo_mestre", "A mesa precisa de pelo menos um mestre.");
      }
      emitir({ tipo: "papel.alterado", dados: { usuarioId: alvoId, papel } });
      return aplicado([alvoId]);
    }

    case "permissao.alterar": {
      const { capacidade, valor, usuarioId: alvoId } = intencao.dados;
      if (!ehCapacidadeDelegavel(capacidade)) {
        return recusa("capacidade_nao_delegavel", `${capacidade} é só do mestre.`);
      }
      if (alvoId !== undefined && !estado.usuarios.some((u) => u.id === alvoId)) {
        return recusa("usuario_inexistente", "Usuário não encontrado.");
      }
      emitir({
        tipo: "permissao.alterada",
        dados:
          alvoId === undefined ? { capacidade, valor } : { capacidade, valor, usuarioId: alvoId },
      });
      return aplicado();
    }

    case "campanha.exportar":
      return {
        ok: true,
        estado,
        eventos,
        snapshotPara: [],
        exportacao: criarExportacao(estado, agora),
      };

    case "campanha.importar": {
      const lida = lerExportacao(intencao.dados.dados);
      if (!lida.ok) return recusa("importacao_invalida", `Arquivo inválido: ${lida.motivo}`);
      // O `seq` nunca volta: números já enviados não podem ser reaproveitados depois da importação.
      const novo: Estado = {
        ...lida.exportacao.dados,
        seq: Math.max(estado.seq, lida.exportacao.dados.seq),
      };
      if (!novo.usuarios.some((u) => u.id === usuarioId && u.papel === "mestre")) {
        return recusa(
          "importacao_invalida",
          "Quem importa precisa ser mestre também na campanha importada.",
        );
      }
      return { ok: true, estado: novo, eventos, snapshotPara: "todos" };
    }
  }
}

/** Snapshot filtrado: o jogador não recebe `notaMestre` nem as exceções dos outros. */
export function visaoPara(estado: Estado, usuario: Visao): Estado {
  if (usuario.papel === "mestre") return estado;
  const { notaMestre: _oculta, ...resto } = estado;
  const propria = estado.permissoes.porUsuario[usuario.id];
  return {
    ...resto,
    permissoes: {
      jogadores: estado.permissoes.jogadores,
      porUsuario: propria ? { [usuario.id]: propria } : {},
    },
  };
}

/** Filtra um evento para um usuário: `null` quando ele não deve receber. */
export function eventoPara(evento: EventoSala, usuario: Visao): EventoSala | null {
  const mestre = usuario.papel === "mestre";
  switch (evento.tipo) {
    case "notaMestre.alterada":
      return mestre ? evento : null;
    case "permissao.alterada":
      if (evento.dados.usuarioId === undefined) return evento;
      return mestre || evento.dados.usuarioId === usuario.id ? evento : null;
    default:
      return evento;
  }
}
