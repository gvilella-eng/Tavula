import { z } from "zod";
import {
  type Ataque,
  bonusDeAcerto,
  cdDaRolagem,
  dadosPorNivelDaMagia,
  type EspacoDoPedido,
  espacosDaFicha,
  expressaoDeDano,
  extraDeEspaco,
  extraDoTruque,
  type Ficha,
  type Magia,
  type Mensagem,
  magiaInataParaRolar,
  margemDeCritico,
  nivelParaTruque,
  normalizarBusca,
  type OpcaoDeEspaco,
  opcoesDeEspaco,
  pactoDaFicha,
  porNivelAcimaDaMagia,
  quantidadeDaConjuracao,
  ROTULO_DO_ATRIBUTO,
  somarExpressoes,
  tipoDeDano,
  usosRestantesDaInata,
  VANTAGENS,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { textoDaRolagem } from "../formato.ts";
import type { Lote } from "../tipos.ts";
import { type Contexto, passo } from "./base.ts";

// Q16: conjurar pelo MCP, como o botão "Conjurar" da ficha: gasta o espaço (ou o espaço de pacto, ou o uso da magia
// inata), rola o que a magia tiver (acerto, dano, salvaguarda, dado a mais por nível acima) e manda o cartão ao chat.

export const ConjurarSchema = z
  .object({
    ficha: z
      .string()
      .describe("Nome da ficha que conjura (a sua, ou qualquer uma se for o mestre)."),
    magia: z.string().describe("Nome da magia na lista de magias da ficha."),
    nivel: z
      .number()
      .int()
      .min(1)
      .max(9)
      .optional()
      .describe(
        "Círculo do espaço gasto. Padrão: o menor com espaço sobrando, a partir do nível da magia. Acima do nível da magia soma o dado a mais por nível. Truque e magia inata não gastam espaço.",
      ),
    pacto: z.boolean().optional().describe("Gasta um espaço de pacto do Bruxo."),
    ritual: z
      .boolean()
      .optional()
      .describe("Conjura como ritual: não gasta espaço (a magia precisa ser ritual)."),
    vantagem: z.enum(VANTAGENS).optional(),
  })
  .strict();
export type PedidoDeConjuracao = z.infer<typeof ConjurarSchema>;

type Operacao = { caminho: string; valor: unknown };

function mensagemDoEvento(evento: unknown): Mensagem | null {
  const e = evento as { tipo?: string; dados?: { mensagem?: Mensagem } } | undefined;
  return e?.tipo === "chat.mensagem" ? (e.dados?.mensagem ?? null) : null;
}

/** Que espaço gastar e o que mudar na ficha por causa dele (sem tocar na ficha ainda). */
function planoDoEspaco(
  ficha: Ficha,
  m: Magia,
  c: PedidoDeConjuracao,
  doCompendio:
    | { descricao?: string | undefined; emNiveisSuperiores?: string | undefined }
    | undefined,
): { espaco?: EspacoDoPedido; operacoes: Operacao[]; gasto?: string } {
  if (m.nivel === 0) return { operacoes: [] };
  if (c.ritual) {
    if (!m.ritual) throw new ErroDoMcp(`"${m.nome}" não é uma magia de ritual na ficha.`);
    return { espaco: { nivel: m.nivel, ritual: true }, operacoes: [], gasto: "como ritual" };
  }
  const espacos = espacosDaFicha(ficha);
  const pacto = pactoDaFicha(ficha);
  const opcoes = opcoesDeEspaco(m.nivel, espacos, pacto);
  const comuns = opcoes.filter((o) => o.tipo === "comum");
  let escolhida: OpcaoDeEspaco | undefined;
  if (c.pacto) escolhida = opcoes.find((o) => o.tipo === "pacto");
  else if (c.nivel !== undefined) escolhida = comuns.find((o) => o.nivel === c.nivel);
  else escolhida = comuns[0] ?? opcoes[0];
  if (!escolhida) {
    const tem = opcoes.map((o) => o.rotulo).join("; ");
    throw new ErroDoMcp(
      `Sem espaço para "${m.nome}"${c.nivel ? ` no ${c.nivel}º círculo` : c.pacto ? " de pacto" : ""}. ${tem ? `Opções: ${tem}.` : "A ficha não tem espaço de magia sobrando (descanso longo: `campos` espacosGastos null)."}`,
    );
  }
  const operacoes: Operacao[] = [];
  if (escolhida.tipo === "pacto") {
    operacoes.push({ caminho: "pactoGasto", valor: (pacto?.gastos ?? 0) + 1 });
  } else {
    const circulo = espacos.find((e) => e.nivel === escolhida.nivel);
    const { [String(escolhida.nivel) as "1"]: _antigo, ...resto } = ficha.espacosGastos ?? {};
    operacoes.push({
      caminho: "espacosGastos",
      valor: { ...resto, [String(escolhida.nivel)]: (circulo?.gastos ?? 0) + 1 },
    });
  }
  let espaco: EspacoDoPedido | undefined;
  if (escolhida.nivel > m.nivel) {
    const porNivel = porNivelAcimaDaMagia(m, doCompendio?.emNiveisSuperiores);
    const extra = extraDeEspaco(porNivel, m.nivel, escolhida.nivel);
    const qtd = quantidadeDaConjuracao(
      m,
      porNivel,
      m.nivel,
      escolhida.nivel,
      doCompendio?.descricao,
    );
    const cada = expressaoDeDano(ficha, m);
    espaco = {
      nivel: escolhida.nivel,
      ...(extra ? { extra } : {}),
      ...(extra && m.salvaguarda?.sucesso === "metade" ? { metade: true } : {}),
      ...(qtd ? { quantidade: { ...qtd, ...(cada ? { cada } : {}) } } : {}),
    };
  }
  return {
    ...(espaco ? { espaco } : {}),
    operacoes,
    gasto:
      escolhida.tipo === "pacto"
        ? `espaço de pacto (${escolhida.nivel}º)`
        : `espaço de ${escolhida.nivel}º`,
  };
}

/** Rola um ataque ou magia da ficha: o pedido ao chat que a tela monta (acerto, dano, salvaguarda, espaço). */
export async function rolarDaFicha(
  ctx: Contexto,
  lote: Lote,
  p: { id: string; nome: string },
  ficha: Ficha,
  ataque: Ataque | Magia,
  opcoes: {
    oculta?: boolean;
    vantagem?: (typeof VANTAGENS)[number];
    espaco?: EspacoDoPedido;
    nivelDoTruque?: number;
  },
): Promise<string> {
  const bonus = bonusDeAcerto(ficha, ataque);
  const dano = expressaoDeDano(ficha, ataque);
  const nome = ataque.nome;
  if (bonus === undefined) {
    if (!dano) throw new ErroDoMcp(`O ataque "${nome}" não tem acerto nem dano para rolar.`);
    // Como a tela: sem acerto, o dano sai como `/r` com a CD e o tipo no rótulo (e o espaço, se houver); oculto não tem `/r`.
    const cdDoDano = cdDaRolagem(ficha, ataque);
    const rotulo = [
      opcoes.nivelDoTruque ? `${nome} (nível ${opcoes.nivelDoTruque})` : nome,
      cdDoDano === undefined ? "" : `CD ${cdDoDano}`,
      tipoDeDano(ataque) ?? "",
    ]
      .filter(Boolean)
      .join(", ");
    const r = opcoes.oculta
      ? await passo(ctx, lote, "dado.rolar", { expressao: dano, oculta: true, como: p.id })
      : await passo(ctx, lote, "chat.enviar", {
          texto: `/r ${dano} ${rotulo}`.trim(),
          como: p.id,
          ...(opcoes.espaco ? { espaco: opcoes.espaco } : {}),
        });
    const m = mensagemDoEvento(r.evento);
    return m ? `${nome} (dano): ${textoDaRolagem(m)}` : "A mesa não devolveu o resultado.";
  }
  const cd = cdDaRolagem(ficha, ataque);
  const s = ataque.salvaguarda;
  const r = await passo(ctx, lote, "chat.modelo", {
    modelo: "ataque",
    nome: `${nome} (${p.nome})`,
    bonus,
    dano: dano ?? "0",
    ...(tipoDeDano(ataque) ? { danoTipo: tipoDeDano(ataque) } : {}),
    margemCritico: margemDeCritico(ataque),
    ...(ataque.danoCritico ? { danoCritico: ataque.danoCritico } : {}),
    ...(opcoes.espaco ? { espaco: opcoes.espaco } : {}),
    ...(opcoes.nivelDoTruque ? { nivelDoTruque: opcoes.nivelDoTruque } : {}),
    ...(s && cd !== undefined
      ? { salvaguarda: { cd, atributo: ROTULO_DO_ATRIBUTO[s.alvo], sucesso: s.sucesso } }
      : {}),
    ...(opcoes.vantagem ? { vantagem: opcoes.vantagem } : {}),
    ...(opcoes.oculta ? { oculta: true } : {}),
    como: p.id,
  });
  const m = mensagemDoEvento(r.evento);
  return `${m ? textoDaRolagem(m) : "A mesa não devolveu o resultado."}${cd !== undefined ? ` (CD ${cd})` : ""}`;
}

/** Conjurar: gasta o espaço (ou o uso da inata), rola e manda o cartão. */
export async function conjurar(
  c: PedidoDeConjuracao,
  ctx: Contexto,
  lote: Lote,
  p: { id: string; nome: string },
  ficha: Ficha,
): Promise<string> {
  const alvo = normalizarBusca(c.magia);
  const lista = ficha.magias ?? [];
  const i = lista.findIndex((x) => normalizarBusca(x.nome) === alvo);
  const m = lista[i];
  if (i < 0 || !m) {
    throw new ErroDoMcp(
      `A ficha "${p.nome}" não tem a magia "${c.magia}". Tem: ${lista.map((x) => x.nome).join(", ") || "nenhuma"}.`,
    );
  }
  let doCompendio: ReturnType<Contexto["compendio"]["achar"]> | undefined;
  try {
    doCompendio = ctx.compendio.achar(m.nome);
  } catch {
    doCompendio = undefined;
  }
  const magiaDoCompendio = doCompendio?.tipo === "magia" ? doCompendio.magia : undefined;

  let espaco: EspacoDoPedido | undefined;
  let operacoes: Operacao[] = [];
  let gasto = "";
  let rolavel: Magia = m;
  if (m.inata) {
    if (c.nivel !== undefined || c.pacto || c.ritual) {
      throw new ErroDoMcp(
        `"${m.nome}" é inata: ela não gasta espaço (tire \`nivel\`, \`pacto\` e \`ritual\`).`,
      );
    }
    const usos = usosRestantesDaInata(ficha, m);
    if (usos && usos.restantes <= 0) {
      throw new ErroDoMcp(`Sem usos de "${m.nome}" hoje. O descanso longo devolve.`);
    }
    if (m.inata.frequencia === "cada") {
      operacoes = [
        { caminho: `magias.${i}.inata`, valor: { ...m.inata, gastos: (m.inata.gastos ?? 0) + 1 } },
      ];
      gasto = "um uso";
    } else if (m.inata.frequencia === "grupo" && ficha.inata?.grupo) {
      const g = ficha.inata.grupo;
      operacoes = [
        {
          caminho: "inata",
          valor: { ...ficha.inata, grupo: { max: g.max, gastos: g.gastos + 1 } },
        },
      ];
      gasto = "um uso do grupo";
    } else {
      gasto = "à vontade";
    }
    rolavel = magiaInataParaRolar(ficha, m);
    if (m.nivel > 0) espaco = { nivel: m.nivel, inata: true };
  } else {
    if (m.nivel === 0 && (c.nivel !== undefined || c.pacto || c.ritual)) {
      throw new ErroDoMcp(`"${m.nome}" é um truque: não gasta espaço.`);
    }
    const plano = planoDoEspaco(ficha, m, c, magiaDoCompendio);
    espaco = plano.espaco;
    operacoes = plano.operacoes;
    gasto = plano.gasto ?? "";
  }

  // Primeiro gasta (se a sala recusar, não rola nada); depois rola, como a tela.
  if (operacoes.length > 0) {
    await passo(ctx, lote, "ficha.alterar", { personagemId: p.id, operacoes });
  }

  // O truque ganha dados pelo nível do personagem (5, 11, 17): o dano rolado já sai somado.
  let aRolar = rolavel;
  let nivelDoTruque: number | undefined;
  if (m.nivel === 0 && (rolavel.dano ?? "").trim() !== "") {
    const extra = extraDoTruque(
      dadosPorNivelDaMagia(
        m,
        `${magiaDoCompendio?.descricao ?? ""} ${magiaDoCompendio?.emNiveisSuperiores ?? ""}`,
      ),
      nivelParaTruque(ficha),
    );
    const somado = extra ? somarExpressoes(rolavel.dano ?? "", extra.expressao) : null;
    if (somado) {
      aRolar = { ...rolavel, dano: somado };
      nivelDoTruque = nivelParaTruque(ficha);
    }
  }
  const prefixo = gasto ? `Gastou ${gasto}. ` : "";
  const temRolagem = aRolar.acerto !== undefined || (aRolar.dano ?? "").trim() !== "";
  if (temRolagem) {
    return `${prefixo}${await rolarDaFicha(ctx, lote, p, ficha, aRolar, {
      ...(c.vantagem ? { vantagem: c.vantagem } : {}),
      ...(espaco ? { espaco } : {}),
      ...(nivelDoTruque ? { nivelDoTruque } : {}),
    })}`;
  }
  // Sem rolagem: o cartão da magia, com o nível e as marcas.
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
  if (magiaDoCompendio) {
    await passo(ctx, lote, "chat.magia", {
      magia: magiaDoCompendio,
      como: p.id,
      ...(semExtra ? { espaco: semExtra } : {}),
    });
  } else {
    const marca = !espaco
      ? ""
      : espaco.ritual
        ? " · como ritual"
        : espaco.inata
          ? " · conjuração inata"
          : ` · com espaço de ${espaco.nivel}º`;
    await passo(ctx, lote, "chat.caracteristica", {
      como: p.id,
      caracteristica: {
        nome: `${p.nome.split(" ")[0] ?? ""} conjura ${m.nome}`.trim().slice(0, 80),
        descricao: (m.descricao || m.nome).slice(0, 12_000),
        origem:
          `${m.nivel === 0 ? "Truque" : `${m.nivel}º nível`}${m.escola ? ` · ${m.escola}` : ""}${marca}`.slice(
            0,
            80,
          ),
      },
    });
  }
  return `${prefixo}Mostrou o cartão de "${m.nome}" no chat.`;
}
