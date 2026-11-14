import {
  bonusDeAcerto,
  cdDaRolagem,
  type EspacoDoPedido,
  expressaoDeDano,
  type Ficha,
  formatarBonus,
  pedidoDeAtaque,
  pedidoDeTeste,
  ROTULO_DO_ATRIBUTO,
  type Rolavel,
  tipoDeDano,
  type Vantagem,
} from "@tabletop/shared";

type Enviar = (tipo: string, dados: object) => string | null;

/**
 * O que a ficha rola. Tudo sai "Como:" o personagem (campo `como`) e usa os modelos do Lote 8: ataque
 * (`chat.modelo`), teste (`chat.modelo`) e dano solto (`/r` pelo chat). Quem rola é sempre a sala. A faixa
 * Vantagem / Normal / Desvantagem da janela vale para todos os d20 desta ficha (V4a), até a pessoa trocá-la.
 */
export type Rolador = {
  podeRolar: boolean;
  vantagem: Vantagem;
  /** Teste de atributo, salvaguarda, perícia, iniciativa...: d20 + bônus (com CD, mostra sucesso). */
  teste: (nome: string, bonus: number, cd?: number) => void;
  /**
   * O nome do ataque ou da magia: acerto + dano no mesmo bloco do chat (crítico dobra os dados). `espaco` (V6): a
   * magia foi conjurada acima do nível; a sala rola o dado a mais num bloco colado na mesma mensagem.
   */
  ataque: (a: Rolavel, ficha: Ficha, espaco?: EspacoDoPedido, nivelDoTruque?: number) => void;
  /** O botão Acerto: só o d20 do ataque. */
  acerto: (a: Rolavel, ficha: Ficha) => void;
  /** O botão Dano: só o dano. */
  dano: (a: Rolavel, ficha: Ficha, espaco?: EspacoDoPedido, nivelDoTruque?: number) => void;
  /** Uma expressão qualquer, com um nome (ex.: dados de vida: `1d8+2`). */
  expressao: (expr: string, nome: string) => void;
};

export function criarRolador(opcoes: {
  personagemId: string;
  podeRolar: boolean;
  enviar: Enviar;
  vantagem: Vantagem;
}): Rolador {
  const { personagemId, podeRolar, enviar, vantagem } = opcoes;
  const v = vantagem === "normal" ? {} : { vantagem };
  const nomeLimpo = (n: string) => n.trim().slice(0, 64) || "Ataque";
  const rolador: Rolador = {
    podeRolar,
    vantagem,
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
    },
    ataque(a, ficha, espaco, nivelDoTruque) {
      if (!podeRolar) return;
      const bonus = bonusDeAcerto(ficha, a);
      const dano = expressaoDeDano(ficha, a);
      if (bonus === undefined) return rolador.dano(a, ficha, espaco, nivelDoTruque);
      if (dano === undefined) return rolador.acerto(a, ficha);
      const tipo = tipoDeDano(a);
      const cd = a.salvaguarda ? cdDaRolagem(ficha, a) : undefined;
      enviar(
        "chat.modelo",
        pedidoDeAtaque({
          nome: nomeLimpo(a.nome),
          bonus,
          dano,
          ...(tipo ? { danoTipo: tipo } : {}),
          ...(a.margemCritico && a.margemCritico < 20 ? { margemCritico: a.margemCritico } : {}),
          ...(a.danoCritico?.trim() ? { danoCritico: a.danoCritico.trim() } : {}),
          ...(espaco ? { espaco } : {}),
          ...(nivelDoTruque ? { nivelDoTruque } : {}),
          ...(a.salvaguarda && cd !== undefined
            ? {
                salvaguarda: {
                  cd,
                  atributo: ROTULO_DO_ATRIBUTO[a.salvaguarda.alvo],
                  sucesso: a.salvaguarda.sucesso,
                },
              }
            : {}),
          ...v,
          como: personagemId,
        }),
      );
    },
    acerto(a, ficha) {
      if (!podeRolar) return;
      const bonus = bonusDeAcerto(ficha, a);
      if (bonus === undefined) return;
      enviar(
        "chat.modelo",
        pedidoDeTeste({
          nome: `Ataque · ${nomeLimpo(a.nome)}`.slice(0, 64),
          bonus,
          ...v,
          como: personagemId,
        }),
      );
    },
    dano(a, ficha, espaco, nivelDoTruque) {
      const expr = expressaoDeDano(ficha, a);
      if (!podeRolar || expr === undefined) return;
      const cd = cdDaRolagem(ficha, a);
      const rotulo = [
        nivelDoTruque ? `${a.nome} (nível ${nivelDoTruque})` : a.nome,
        cd === undefined ? "" : `CD ${cd}`,
        tipoDeDano(a) ?? "",
      ]
        .filter(Boolean)
        .join(", ");
      enviar("chat.enviar", {
        texto: `/r ${expr} ${rotulo}`.trim(),
        como: personagemId,
        ...(espaco ? { espaco } : {}),
      });
    },
    expressao(expr, nome) {
      if (!podeRolar) return;
      enviar("chat.enviar", { texto: `/r ${expr} ${nome}`.trim(), como: personagemId });
    },
  };
  return rolador;
}

/** "+13": o texto do bônus de acerto de um ataque, ou `null` sem acerto. */
export function textoDoAcerto(ficha: Ficha, a: Rolavel): string | null {
  const b = bonusDeAcerto(ficha, a);
  return b === undefined ? null : formatarBonus(b);
}
