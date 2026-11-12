import { type Magia, normalizarBusca } from "@tabletop/shared";
import type { PropsDaAba } from "./AbaPrincipal";

/** A magia do compêndio com o mesmo nome (sem acento nem caixa), se houver. */
export function magiaDoCompendio(compendio: PropsDaAba["compendio"], nome: string) {
  if (!compendio) return undefined;
  const alvo = normalizarBusca(nome);
  return compendio.magias.find((m) => normalizarBusca(m.nome) === alvo);
}

const um = (caminho: string, valor: unknown) => [{ caminho, valor }];

/**
 * Conjurar (V4a): gasta um espaço do nível da magia (ou um de pacto, se os comuns acabaram) e rola o que ela tiver
 * (ataque e dano juntos); sem rolagem, manda o cartão dela ao chat. Truque não gasta espaço. Sem espaço, avisa.
 * `i` é a posição da magia em `ficha.magias`.
 */
export function conjurar(props: PropsDaAba, m: Magia, _i: number): void {
  const { ficha, d, alterar, rolador, enviar, personagemId, compendio, avisar, nomeDoPersonagem } =
    props;
  if (!rolador.podeRolar) return;
  if (m.nivel > 0) {
    const espaco = d.espacos.find((e) => e.nivel === m.nivel);
    if (espaco && espaco.restantes > 0) {
      const { [String(m.nivel) as "1"]: _antigo, ...resto } = ficha.espacosGastos ?? {};
      alterar(um("espacosGastos", { ...resto, [String(m.nivel)]: espaco.gastos + 1 }));
    } else if (d.pacto && d.pacto.restantes > 0 && d.pacto.nivel >= m.nivel) {
      alterar(um("pactoGasto", d.pacto.gastos + 1));
    } else {
      avisar(`Sem espaços de ${m.nivel}º nível para ${m.nome}.`);
      return;
    }
  }
  const temRolagem =
    m.acerto !== undefined || m.salvaguarda !== undefined || (m.dano ?? "").trim() !== "";
  if (temRolagem) {
    rolador.ataque(m, ficha);
    return;
  }
  const doCompendio = magiaDoCompendio(compendio, m.nome);
  if (doCompendio) {
    enviar("chat.magia", { magia: doCompendio, como: personagemId });
    return;
  }
  enviar("chat.caracteristica", {
    caracteristica: {
      nome: `${nomeDoPersonagem.split(" ")[0] ?? ""} conjura ${m.nome}`.trim().slice(0, 80),
      descricao: m.descricao.slice(0, 12_000),
      origem: `${m.nivel === 0 ? "Truque" : `${m.nivel}º nível`}${m.escola ? ` · ${m.escola}` : ""}`,
    },
    como: personagemId,
  });
}
