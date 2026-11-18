import {
  dadosPorNivelDaMagia,
  type EspacoDoPedido,
  expressaoDeDano,
  extraDeEspaco,
  extraDoTruque,
  type Magia,
  type MagiaDoCompendio,
  magiaInataParaRolar,
  nivelParaTruque,
  normalizarBusca,
  type OpcaoDeEspaco,
  porNivelAcimaDaMagia,
  quantidadeDaConjuracao,
  somarExpressoes,
  textoDaQuantidade,
  usosRestantesDaInata,
} from "@tabletop/shared";
import type { PropsDaAba } from "./AbaPrincipal";

/** O que o menu do Conjurar escolhe: um espaço (comum ou de pacto) ou o ritual (sem espaço, N2). */
export type OpcaoDeConjuracao = OpcaoDeEspaco | "ritual";

/** A magia do compêndio com o mesmo nome (sem acento nem caixa), se houver. */
export function magiaDoCompendio(compendio: PropsDaAba["compendio"], nome: string) {
  if (!compendio) return undefined;
  return indiceDeMagias(compendio.magias).get(normalizarBusca(nome));
}

// O compêndio é imutável depois de lido: o índice por nome normalizado é montado uma vez por lista de magias
// (e não normaliza todas as magias a cada linha de magia a cada render da ficha).
const INDICES_DE_MAGIAS = new WeakMap<readonly MagiaDoCompendio[], Map<string, MagiaDoCompendio>>();
function indiceDeMagias(magias: readonly MagiaDoCompendio[]): Map<string, MagiaDoCompendio> {
  let indice = INDICES_DE_MAGIAS.get(magias);
  if (!indice) {
    indice = new Map();
    // A primeira que casa vence, como no `find` de antes.
    for (const m of magias) {
      const chave = normalizarBusca(m.nome);
      if (!indice.has(chave)) indice.set(chave, m);
    }
    INDICES_DE_MAGIAS.set(magias, indice);
  }
  return indice;
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
export function conjurar(props: PropsDaAba, m: Magia, opcao?: OpcaoDeConjuracao): void {
  const { ficha, d, alterar, rolador } = props;
  if (!rolador.podeRolar) return;
  const doCompendio = magiaDoCompendio(props.compendio, m.nome);
  let espaco: EspacoDoPedido | undefined;
  if (opcao === "ritual") {
    // N2: ritual não gasta espaço; o cartão diz "como ritual" (a mesa confia no jogador: não confere a classe).
    if (m.nivel === 0) return;
    espaco = { nivel: m.nivel, ritual: true };
  } else if (m.nivel > 0) {
    if (!opcao) return;
    if (opcao.tipo === "pacto") {
      if (!d.pacto || d.pacto.restantes <= 0) return;
      alterar(um("pactoGasto", d.pacto.gastos + 1));
    } else {
      const circulo = d.espacos.find((e) => e.nivel === opcao.nivel);
      if (!circulo || circulo.restantes <= 0) return;
      const { [String(opcao.nivel) as "1"]: _antigo, ...resto } =
        props.fichaAtual().espacosGastos ?? {};
      alterar(um("espacosGastos", { ...resto, [String(opcao.nivel)]: circulo.gastos + 1 }));
    }
    if (opcao.nivel > m.nivel) {
      const porNivel = porNivelAcimaDaMagia(m, doCompendio?.emNiveisSuperiores);
      const extra = extraDeEspaco(porNivel, m.nivel, opcao.nivel);
      // N2: "+1 dardo/raio/alvo/criatura" por nível acima: o cartão mostra a quantidade (e rola cada dardo à parte).
      const qtd = quantidadeDaConjuracao(m, porNivel, m.nivel, opcao.nivel, doCompendio?.descricao);
      const cada = expressaoDeDano(ficha, m);
      espaco = {
        nivel: opcao.nivel,
        ...(extra ? { extra } : {}),
        ...(extra && m.salvaguarda?.sucesso === "metade" ? { metade: true } : {}),
        ...(qtd ? { quantidade: { ...qtd, ...(cada ? { cada } : {}) } } : {}),
      };
    }
  }
  executar(props, m, m, espaco, doCompendio);
}

/**
 * O fim comum de toda conjuração: com dano ou acerto, rola o ataque (e o dado de truque que o nível do personagem
 * deu); sem rolagem, manda o cartão da magia. `rolavel` é a magia como se rola (a inata troca a CD e o ataque).
 */
function executar(
  props: PropsDaAba,
  m: Magia,
  rolavel: Magia,
  espaco: EspacoDoPedido | undefined,
  doCompendio: ReturnType<typeof magiaDoCompendio>,
): void {
  const { ficha, rolador, enviar, personagemId, nomeDoPersonagem } = props;
  // N2: o truque ganha dados pelo nível do personagem (5, 11, 17): o dano rolado já sai somado.
  let aRolar = rolavel;
  let nivelDoTruque: number | undefined;
  if (m.nivel === 0 && (rolavel.dano ?? "").trim() !== "") {
    const lista = dadosPorNivelDaMagia(
      m,
      `${doCompendio?.descricao ?? ""} ${doCompendio?.emNiveisSuperiores ?? ""}`,
    );
    const nivel = nivelParaTruque(ficha);
    const extra = extraDoTruque(lista, nivel);
    const somado = extra ? somarExpressoes(rolavel.dano ?? "", extra.expressao) : null;
    if (somado) {
      aRolar = { ...rolavel, dano: somado };
      nivelDoTruque = nivel;
    }
  }
  const temRolagem = aRolar.acerto !== undefined || (aRolar.dano ?? "").trim() !== "";
  if (temRolagem) {
    rolador.ataque(aRolar, ficha, espaco, nivelDoTruque);
    return;
  }
  // O cartão sem rolagem nunca rola dado a mais: só o nível, as marcas e a quantidade.
  const semExtra = espaco
    ? {
        nivel: espaco.nivel,
        ...(espaco.ritual ? { ritual: true } : {}),
        ...(espaco.inata ? { inata: true } : {}),
        ...(espaco.quantidade
          ? { quantidade: { total: espaco.quantidade.total, unidade: espaco.quantidade.unidade } }
          : {}),
      }
    : undefined;
  if (doCompendio) {
    enviar("chat.magia", {
      magia: doCompendio,
      como: personagemId,
      ...(semExtra ? { espaco: semExtra } : {}),
    });
    return;
  }
  const marca = !espaco
    ? ""
    : espaco.ritual
      ? " · como ritual"
      : espaco.inata
        ? " · conjuração inata"
        : ` · com espaço de ${espaco.nivel}º${
            espaco.quantidade
              ? ` · ${textoDaQuantidade(espaco.quantidade.total, espaco.quantidade.unidade)}`
              : ""
          }`;
  enviar("chat.caracteristica", {
    caracteristica: {
      nome: `${nomeDoPersonagem.split(" ")[0] ?? ""} conjura ${m.nome}`.trim().slice(0, 80),
      descricao: m.descricao.slice(0, 12_000),
      origem: `${origemDaMagia(m)}${marca}`.slice(0, 80),
    },
    como: personagemId,
  });
}

/**
 * Conjurar uma magia da Conjuração inata (N2): não gasta espaço e não sobe de nível. Gasta um uso (a bolinha da
 * magia, ou a do grupo "N/dia"); "À vontade" não gasta. A CD e o ataque saem do atributo e da CD da inata. `i` é a
 * posição da magia em `ficha.magias`.
 */
export function conjurarInata(props: PropsDaAba, m: Magia, i: number): void {
  const { ficha, alterar, rolador, avisar } = props;
  if (!rolador.podeRolar || !m.inata) return;
  const usos = usosRestantesDaInata(ficha, m);
  if (usos && usos.restantes <= 0) {
    avisar(`Sem usos de ${m.nome} hoje. O descanso longo devolve.`);
    return;
  }
  if (m.inata.frequencia === "cada") {
    alterar(um(`magias.${i}.inata`, { ...m.inata, gastos: (m.inata.gastos ?? 0) + 1 }));
  } else if (m.inata.frequencia === "grupo" && ficha.inata?.grupo) {
    const g = ficha.inata.grupo;
    alterar(um("inata", { ...ficha.inata, grupo: { max: g.max, gastos: g.gastos + 1 } }));
  }
  const doCompendio = magiaDoCompendio(props.compendio, m.nome);
  // Sai no nível dela (assumido): sem espaço maior; só o cartão ganha "conjuração inata".
  executar(
    props,
    m,
    magiaInataParaRolar(ficha, m),
    m.nivel > 0 ? { nivel: m.nivel, inata: true } : undefined,
    doCompendio,
  );
}
