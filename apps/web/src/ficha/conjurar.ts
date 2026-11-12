import {
  type EspacoDoPedido,
  extraDeEspaco,
  type Magia,
  normalizarBusca,
  type OpcaoDeEspaco,
  porNivelAcimaDaMagia,
} from "@tabletop/shared";
import type { PropsDaAba } from "./AbaPrincipal";

/** A magia do compêndio com o mesmo nome (sem acento nem caixa), se houver. */
export function magiaDoCompendio(compendio: PropsDaAba["compendio"], nome: string) {
  if (!compendio) return undefined;
  const alvo = normalizarBusca(nome);
  return compendio.magias.find((m) => normalizarBusca(m.nome) === alvo);
}

const um = (caminho: string, valor: unknown) => [{ caminho, valor }];

/** "3º nível · Evocação" (ou "Truque · Evocação"): o que a magia diz de si numa linha. */
const origemDaMagia = (m: Magia) =>
  `${m.nivel === 0 ? "Truque" : `${m.nivel}º nível`}${m.escola ? ` · ${m.escola}` : ""}`;

/**
 * O ícone de "Mandar ao chat" ao lado do Conjurar (V6): o cartão completo da magia, sem gastar espaço nem rolar.
 * Com a magia no compêndio vai o cartão do compêndio; sem ela, monta-se com os campos da ficha (nível e escola, tempo,
 * alcance, componentes, duração, descrição e o dado a mais por nível).
 */
export function pingarMagia(props: PropsDaAba, m: Magia): void {
  const { enviar, personagemId, compendio, rolador } = props;
  if (!rolador.podeRolar) return;
  const doCompendio = magiaDoCompendio(compendio, m.nome);
  if (doCompendio) {
    enviar("chat.magia", { magia: doCompendio, como: personagemId });
    return;
  }
  const campos = [
    ["Tempo de conjuração", m.tempo],
    ["Alcance", m.alcance],
    ["Componentes", m.componentes],
    ["Duração", m.duracao],
  ]
    .filter(([, v]) => (v ?? "").trim() !== "")
    .map(([k, v]) => `${k}: ${v}`);
  const cabecalho = m.descricao.includes("Tempo de conjuração:") ? [] : campos;
  const porNivel = m.porNivelAcima?.trim();
  const partes = [
    cabecalho.join("\n"),
    m.descricao,
    porNivel && !m.descricao.includes("Em níveis superiores")
      ? `Por nível acima: +${porNivel}`
      : "",
  ].filter((p) => p.trim() !== "");
  enviar("chat.caracteristica", {
    caracteristica: {
      nome: m.nome.trim().slice(0, 80),
      descricao: partes.join("\n\n").slice(0, 12_000),
      origem: origemDaMagia(m),
    },
    como: personagemId,
  });
}

/**
 * Conjurar (V4a, V6): gasta um espaço do nível escolhido (`opcao`, do menu "Conjurar com espaço de:") e rola o que a
 * magia tiver (ataque e dano juntos); sem rolagem, manda o cartão dela ao chat. Truque não gasta espaço (nem
 * pergunta). Acima do nível da magia, o dado a mais por nível (`porNivelAcima`) vai num bloco colado do chat.
 */
export function conjurar(props: PropsDaAba, m: Magia, opcao?: OpcaoDeEspaco): void {
  const { ficha, d, alterar, rolador, enviar, personagemId, compendio, nomeDoPersonagem } = props;
  if (!rolador.podeRolar) return;
  const doCompendio = magiaDoCompendio(compendio, m.nome);
  let espaco: EspacoDoPedido | undefined;
  if (m.nivel > 0) {
    if (!opcao) return;
    if (opcao.tipo === "pacto") {
      if (!d.pacto || d.pacto.restantes <= 0) return;
      alterar(um("pactoGasto", d.pacto.gastos + 1));
    } else {
      const circulo = d.espacos.find((e) => e.nivel === opcao.nivel);
      if (!circulo || circulo.restantes <= 0) return;
      const { [String(opcao.nivel) as "1"]: _antigo, ...resto } = ficha.espacosGastos ?? {};
      alterar(um("espacosGastos", { ...resto, [String(opcao.nivel)]: circulo.gastos + 1 }));
    }
    if (opcao.nivel > m.nivel) {
      const extra = extraDeEspaco(
        porNivelAcimaDaMagia(m, doCompendio?.emNiveisSuperiores),
        m.nivel,
        opcao.nivel,
      );
      espaco = {
        nivel: opcao.nivel,
        ...(extra ? { extra } : {}),
        ...(extra && m.salvaguarda?.sucesso === "metade" ? { metade: true } : {}),
      };
    }
  }
  const temRolagem =
    m.acerto !== undefined || m.salvaguarda !== undefined || (m.dano ?? "").trim() !== "";
  if (temRolagem) {
    rolador.ataque(m, ficha, espaco);
    return;
  }
  if (doCompendio) {
    enviar("chat.magia", {
      magia: doCompendio,
      como: personagemId,
      ...(espaco ? { espaco: { nivel: espaco.nivel } } : {}),
    });
    return;
  }
  enviar("chat.caracteristica", {
    caracteristica: {
      nome: `${nomeDoPersonagem.split(" ")[0] ?? ""} conjura ${m.nome}`.trim().slice(0, 80),
      descricao: m.descricao.slice(0, 12_000),
      origem: `${origemDaMagia(m)}${espaco ? ` · com espaço de ${espaco.nivel}º` : ""}`.slice(
        0,
        80,
      ),
    },
    como: personagemId,
  });
}
