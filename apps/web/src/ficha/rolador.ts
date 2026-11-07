import {
  type Ataque,
  bonusDeAcerto,
  type Ficha,
  formatarBonus,
  pedidoDeAtaque,
  pedidoDeTeste,
  type Vantagem,
} from "@tabletop/shared";

type Enviar = (tipo: string, dados: object) => string | null;

/**
 * O que a ficha rola. Tudo sai "Como:" o personagem (campo `como`) e usa os modelos do Lote 8: ataque
 * (`chat.modelo`), teste (`chat.modelo`) e dano solto (`/r` pelo chat). O seletor de vantagem do
 * cabeçalho vale para o PRÓXIMO d20: depois de rolar ele volta a "normal".
 */
export type Rolador = {
  podeRolar: boolean;
  /** Teste de atributo, salvaguarda, perícia, iniciativa...: d20 + bônus (com CD, mostra sucesso). */
  teste: (nome: string, bonus: number, cd?: number) => void;
  /** Clique no acerto do ataque: acerto + dano (crítico dobra os dados). */
  ataque: (a: Ataque, ficha: Ficha) => void;
  /** Clique no dano: só o dano. */
  dano: (a: Ataque) => void;
  /** Uma expressão qualquer, com um nome (ex.: dados de vida: `1d8+2`). */
  expressao: (expr: string, nome: string) => void;
};

export function criarRolador(opcoes: {
  personagemId: string;
  podeRolar: boolean;
  enviar: Enviar;
  vantagem: Vantagem;
  aoRolarD20: () => void;
}): Rolador {
  const { personagemId, podeRolar, enviar, vantagem, aoRolarD20 } = opcoes;
  const v = vantagem === "normal" ? {} : { vantagem };
  const nomeLimpo = (n: string) => n.trim().slice(0, 64) || "Ataque";
  return {
    podeRolar,
    teste(nome, bonus, cd) {
      if (!podeRolar) return;
      enviar(
        "chat.modelo",
        pedidoDeTeste({
          nome: nomeLimpo(nome),
          bonus,
          ...(cd === undefined ? {} : { cd }),
          ...v,
          como: personagemId,
        }),
      );
      aoRolarD20();
    },
    ataque(a, ficha) {
      if (!podeRolar) return;
      const bonus = bonusDeAcerto(ficha, a);
      if (bonus === undefined) return this.dano(a);
      if (a.dano && a.dano.trim() !== "") {
        enviar(
          "chat.modelo",
          pedidoDeAtaque({
            nome: nomeLimpo(a.nome),
            bonus,
            dano: a.dano.trim(),
            ...(a.tipo ? { danoTipo: a.tipo } : {}),
            ...v,
            como: personagemId,
          }),
        );
      } else {
        // Sem dano: só o teste de ataque.
        enviar(
          "chat.modelo",
          pedidoDeTeste({
            nome: `${nomeLimpo(a.nome)} (ataque ${formatarBonus(bonus)})`.slice(0, 64),
            bonus,
            ...v,
            como: personagemId,
          }),
        );
      }
      aoRolarD20();
    },
    dano(a) {
      if (!podeRolar || !a.dano || a.dano.trim() === "") return;
      const rotulo = [a.nome, a.cd === undefined ? "" : `CD ${a.cd}`, a.tipo ?? ""]
        .filter(Boolean)
        .join(", ");
      enviar("chat.enviar", { texto: `/r ${a.dano.trim()} ${rotulo}`.trim(), como: personagemId });
    },
    expressao(expr, nome) {
      if (!podeRolar) return;
      enviar("chat.enviar", { texto: `/r ${expr} ${nome}`.trim(), como: personagemId });
    },
  };
}
