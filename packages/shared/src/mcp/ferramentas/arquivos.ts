import { z } from "zod";
import {
  type AlvoDoEnvio,
  type AssetMeta,
  base64UrlParaBytes,
  comandoDeEnvio,
  detectarFormato,
  type EnvioPublico,
  type Estado,
  LIMITES_DO_ENVIO,
  limparNomeDoEnvio,
  lugaresDe,
  motivoDoFormato,
  negarEnvio,
  type OpcoesDoEnvio,
  ROTULO_DO_USO,
  type UsoDeEnvio,
  usoDoArquivo,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar } from "../nomes.ts";
import { type Contexto, definir, passo } from "./base.ts";

const FORMAS_DO_USO = [
  "mapa",
  "mapa da cena",
  "token",
  "retrato",
  "retrato da ficha",
  "handout",
  "imagem do handout",
  "som",
  "compendio",
  "compêndio",
] as const;

/** As duas formas de escrever cada uso (a curta e a da mesa) viram o uso de verdade. */
function usoDe(forma: (typeof FORMAS_DO_USO)[number]): UsoDeEnvio {
  switch (forma) {
    case "mapa":
    case "mapa da cena":
      return "mapa";
    case "retrato":
    case "retrato da ficha":
      return "retrato";
    case "handout":
    case "imagem do handout":
      return "handout";
    case "compendio":
    case "compêndio":
      return "compendio";
    default:
      return forma;
  }
}

/** Onde o asset é usado agora, em frases curtas (para a lista). */
function ondeEhUsado(estado: Estado, hash: string): string[] {
  const usos: string[] = [];
  for (const c of estado.cenas) {
    if (c.mapa?.assetHash === hash) usos.push(`mapa da cena ${c.nome}`);
  }
  const lugares = lugaresDe(estado.mesaDeSom);
  lugares.efeitos.forEach((l, i) => {
    if (l?.hash === hash) usos.push(`efeito ${i + 1} da mesa de som`);
  });
  lugares.ambientes.forEach((l, i) => {
    if (l?.hash === hash) usos.push(`ambiente ${i + 1} da mesa de som`);
  });
  for (const t of estado.tokens) if (t.assetHash === hash) usos.push(`imagem do token ${t.nome}`);
  for (const p of estado.personagens) {
    if (p.retratoHash === hash) usos.push(`retrato de ${p.nome}`);
    if (p.tokenPadrao.assetHash === hash) usos.push(`token padrão de ${p.nome}`);
  }
  for (const h of estado.handouts)
    if (h.imagemHash === hash) usos.push(`imagem do handout ${h.titulo}`);
  if (estado.compendio?.hash === hash) usos.push("compêndio da mesa");
  return usos;
}

function tamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** O que a lista mostra: só o que o Claude usa (o manifesto do mapa; não os tiles nem os arquivos cifrados do pré-envio). */
function assetsDaLista(estado: Estado): AssetMeta[] {
  return (estado.assets ?? []).filter((a) => a.tipo !== "tile" && a.tipo !== "cifrado");
}

function acharAsset(estado: Estado, pedido: string): AssetMeta {
  const p = pedido.trim().toLowerCase();
  if (p.length < 6) throw new ErroDoMcp("Escreva pelo menos 6 letras do hash (veja `listar`).");
  const achados = assetsDaLista(estado).filter((a) => a.hash.startsWith(p));
  if (achados.length === 1) return achados[0] as AssetMeta;
  if (achados.length > 1)
    throw new ErroDoMcp(`O hash "${pedido}" serve para mais de um arquivo. Escreva mais letras.`);
  throw new ErroDoMcp(`Não achei o arquivo "${pedido}" na mesa. Use {"acao":"listar"} para ver.`);
}

/** Acha o cena, o token, a ficha e o handout que o Claude citou pelo nome. */
function alvoDoPedido(
  estado: Estado,
  e: {
    cena?: string | undefined;
    token?: string | undefined;
    ficha?: string | undefined;
    handout?: string | undefined;
  },
): AlvoDoEnvio {
  const alvo: AlvoDoEnvio = {};
  if (e.cena !== undefined) {
    alvo.cenaId = achar(estado.cenas, e.cena, {
      rotulo: "cena",
      nomeDe: (c) => c.nome,
      idDe: (c) => c.id,
    }).id;
  }
  if (e.token !== undefined) {
    const doCena = alvo.cenaId
      ? estado.tokens.filter((t) => t.cenaId === alvo.cenaId)
      : estado.tokens;
    alvo.tokenId = achar(doCena, e.token, {
      rotulo: "token",
      nomeDe: (t) => t.nome,
      idDe: (t) => t.id,
    }).id;
  }
  if (e.ficha !== undefined) {
    alvo.fichaId = achar(estado.personagens, e.ficha, {
      rotulo: "ficha",
      nomeDe: (p) => p.nome,
      idDe: (p) => p.id,
    }).id;
  }
  if (e.handout !== undefined) {
    alvo.handoutId = achar(estado.handouts, e.handout, {
      rotulo: "handout",
      nomeDe: (h) => h.titulo,
      idDe: (h) => h.id,
    }).id;
  }
  return alvo;
}

/** O texto do estado de um envio (o que o Claude lê depois de rodar o comando, ou ao consultar). */
export function textoDoEnvio(v: EnvioPublico): string {
  const o = ROTULO_DO_USO[v.uso];
  switch (v.estado) {
    case "aplicado":
      return `Pronto: ${v.nome} (${o}). ${v.resultado ?? "Está na mesa."}${v.hash ? ` Hash: ${v.hash.slice(0, 12)}.` : ""}`;
    case "erro":
      return `NÃO FEITO: ${v.nome} (${o}). ${v.motivo ?? "Não deu."} O que mudou na mesa foi desfeito ou não chegou a mudar.`;
    case "aguardando":
      return `Envio ${v.id} (${v.nome}, ${o}): a mesa ainda não recebeu o arquivo. Rode o comando do link.`;
    case "recebido":
      return `Envio ${v.id} (${v.nome}, ${o}): o arquivo chegou à caixa da mesa e espera o navegador do mestre processar. Se a mesa do mestre está fechada, ele processa sozinho ao abrir. Consulte depois com {"acao":"estado","envio":"${v.id}"}.`;
    case "processando":
      return `Envio ${v.id} (${v.nome}, ${o}): o navegador do mestre está processando. Consulte de novo com {"acao":"estado","envio":"${v.id}"}.`;
  }
}

function pedidoDe(
  ctx: Contexto,
  uso: UsoDeEnvio,
  nome: string,
  alvo: AlvoDoEnvio,
  opcoes: OpcoesDoEnvio,
) {
  return {
    uso,
    nome,
    alvo,
    opcoes,
    lote: ctx.novoLote(`Enviou ${ROTULO_DO_USO[uso]}: ${nome}`),
  };
}

export const arquivos = definir({
  nome: "arquivos",
  descricao: [
    "Sobe arquivos do computador para a mesa (mapa da cena, token, retrato da ficha, imagem do handout, som, compêndio) e usa arquivos que já estão na mesa. Fluxo: gere ou ache o arquivo no computador, chame `enviar`, rode no shell o comando que ela devolve (curl) e pronto: a resposta do curl já diz o que foi feito.",
    '`enviar` devolve um link de envio de uso único (vale 15 min); o comando é `curl -sS -T "<caminho do arquivo>" "<link>"`. Sem shell (Claude Desktop, claude.ai), passe o arquivo em `base64` (até 2 MB; gasta contexto). Formatos: imagem png, jpg, webp ou gif; som mp3, ogg ou wav; compêndio json.',
    "Alvos, pelo nome: mapa -> `cena` (padrão: a cena ativa); token -> `token` (e `cena`, se o nome se repete) ou `ficha` (vira o token padrão da ficha); retrato -> `ficha`; handout -> `handout`; som -> entra na mesa (depois a ferramenta `som` o põe num lugar da mesa de som). No mapa, `quadrados` (45 = 45 x 45) ou `pxPorQuadrado` (padrão 70) ajusta o tamanho da cena à imagem.",
    "`estado` consulta um envio (`envio`: o id) e espera até 20 s. `listar` mostra os arquivos da mesa e onde são usados (só o mestre). `usar` põe na mesa um arquivo que já existe (`hash`: 6+ letras do `listar`, e o mesmo `uso` e alvo do `enviar`), sem reenviar. O que o Claude põe vale no lote do `desfazer`; o arquivo fica na pasta.",
    'Exemplos: {"acao":"enviar","uso":"mapa","nome":"cripta.png","cena":"Cripta","quadrados":45}; {"acao":"enviar","uso":"retrato","nome":"goblin.png","ficha":"Goblin"}; {"acao":"estado","envio":"env-..."}; {"acao":"usar","uso":"mapa","hash":"a1b2c3d4","cena":"Cripta"}.',
  ].join(" "),
  entrada: z
    .object({
      acao: z.enum(["enviar", "estado", "listar", "usar"]).optional().describe("Padrão: enviar."),
      uso: z.enum(FORMAS_DO_USO).optional().describe("Para que serve o arquivo (enviar e usar)."),
      nome: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe("Nome do arquivo (só para exibição; nunca o caminho). Obrigatório ao enviar."),
      cena: z
        .string()
        .optional()
        .describe(
          "Mapa: a cena. Som: sem efeito (o som entra na mesa; a ferramenta `som` o põe num lugar). Token: filtra os tokens da cena.",
        ),
      token: z.string().optional().describe("Token: o nome do token da cena."),
      ficha: z
        .string()
        .optional()
        .describe("Retrato: a ficha. Token: a ficha que ganha o token padrão."),
      handout: z.string().optional().describe("Handout: o título."),
      pxPorQuadrado: z
        .number()
        .min(10)
        .max(1000)
        .optional()
        .describe("Mapa: pixels da imagem por quadrado (padrão 70)."),
      quadrados: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe(
          "Mapa: quantos quadrados tem o lado maior da imagem (45 = 45 x 45); calcula o pxPorQuadrado.",
        ),
      volume: z.number().min(0).max(1).optional().describe("Som da cena: 0 a 1 (padrão 0,6)."),
      base64: z
        .string()
        .optional()
        .describe("O arquivo em base64, para quem não tem shell (até 2 MB)."),
      envio: z.string().optional().describe("Só no `estado`: o id do envio."),
      hash: z.string().optional().describe("Só no `usar`: o hash (6+ letras) do arquivo da mesa."),
    })
    .strict(),
  visivel: () => true,
  async executar(e, ctx) {
    const acao = e.acao ?? "enviar";
    const estado = ctx.sala.estado();
    const eu = ctx.sala.eu();

    if (acao === "listar") {
      if (eu.papel !== "mestre") throw new ErroDoMcp("Só o mestre lista os arquivos da mesa.");
      const lista = assetsDaLista(estado);
      if (lista.length === 0) return "A mesa ainda não tem arquivos.";
      return [
        `Arquivos da mesa (${lista.length}):`,
        ...lista.slice(0, 80).map((a) => {
          const usos = ondeEhUsado(estado, a.hash);
          const dim =
            a.tipo === "som" || a.tipo === "compendio" ? "" : `, ${a.largura}x${a.altura}`;
          return `- ${a.nomeOriginal} (${a.tipo}${dim}${a.bytes > 0 ? `, ${tamanho(a.bytes)}` : ""}) [hash ${a.hash.slice(0, 12)}] — ${usos.length > 0 ? `usado em: ${usos.join("; ")}` : "sem uso"}`;
        }),
        ...(lista.length > 80 ? [`...e mais ${lista.length - 80}.`] : []),
      ].join("\n");
    }

    if (acao === "estado") {
      if (!ctx.sala.arquivos)
        throw new ErroDoMcp(
          "Esta conexão não tem a caixa de arquivos. Use o MCP por HTTP (a sala).",
        );
      if (!e.envio) throw new ErroDoMcp("Diga o id do envio (`envio`).");
      const v = await ctx.sala.arquivos.estado(e.envio, LIMITES_DO_ENVIO.esperaMs);
      if (!v)
        throw new ErroDoMcp(
          "Não achei esse envio (ou o arquivo já foi apagado da caixa depois de 24 h).",
        );
      return { texto: textoDoEnvio(v), erro: v.estado === "erro" };
    }

    if (e.uso === undefined)
      throw new ErroDoMcp("Diga o `uso`: mapa, token, retrato, handout, som ou compêndio.");
    const uso = usoDe(e.uso);
    const alvo = alvoDoPedido(estado, e);
    const opcoes: OpcoesDoEnvio = {
      ...(e.pxPorQuadrado !== undefined ? { pxPorQuadrado: e.pxPorQuadrado } : {}),
      ...(e.quadrados !== undefined ? { quadrados: e.quadrados } : {}),
      ...(e.volume !== undefined ? { volume: e.volume } : {}),
    };

    if (acao === "usar") {
      if (eu.papel !== "mestre")
        throw new ErroDoMcp(
          "Só o mestre usa os arquivos que já estão na mesa; o jogador envia o dele com `enviar`.",
        );
      if (e.hash === undefined) throw new ErroDoMcp("Diga o `hash` do arquivo (veja `listar`).");
      const meta = acharAsset(estado, e.hash);
      const serve =
        uso === "mapa"
          ? meta.tipo === "mapa"
          : uso === "som"
            ? meta.tipo === "som"
            : uso === "compendio"
              ? meta.tipo === "compendio"
              : meta.tipo === "token" || meta.tipo === "retrato";
      if (!serve) {
        throw new ErroDoMcp(
          `O arquivo "${meta.nomeOriginal}" é do tipo ${meta.tipo} e não serve para ${ROTULO_DO_USO[uso]}.`,
        );
      }
      const aplicar = usoDoArquivo(uso, alvo, meta.hash, meta, opcoes);
      if (!aplicar.ok) throw new ErroDoMcp(aplicar.motivo);
      if (aplicar.tipo === null) return `${meta.nomeOriginal}: ${aplicar.frase}.`;
      await passo(
        ctx,
        ctx.novoLote(`Usou ${ROTULO_DO_USO[uso]}: ${meta.nomeOriginal}`),
        aplicar.tipo,
        aplicar.dados,
      );
      return `Feito: ${aplicar.frase} (${meta.nomeOriginal}).`;
    }

    // enviar
    const caixa = ctx.sala.arquivos;
    if (!caixa) {
      throw new ErroDoMcp(
        "Esta conexão não sobe arquivos: use o MCP por HTTP (o endereço da mesa, em Conectar o Claude). Com o MCP em stdio, peça ao mestre para subir pela mesa.",
      );
    }
    if (e.nome === undefined)
      throw new ErroDoMcp("Diga o `nome` do arquivo (só o nome, para exibição).");
    const nome = limparNomeDoEnvio(e.nome);
    const negado = negarEnvio(estado, eu, uso, alvo, opcoes);
    if (negado) throw new ErroDoMcp(negado);
    if (opcoes.quadrados !== undefined && uso !== "mapa") {
      throw new ErroDoMcp("`quadrados` e `pxPorQuadrado` valem só para o mapa da cena.");
    }
    const pedido = pedidoDe(ctx, uso, nome, alvo, opcoes);
    const mestre = caixa.mestreOnline();

    if (e.base64 !== undefined) {
      const limpo = e.base64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
      if (limpo.length > Math.ceil((LIMITES_DO_ENVIO.bytesDoBase64 * 4) / 3) + 8) {
        throw new ErroDoMcp(
          `O base64 passa de ${LIMITES_DO_ENVIO.bytesDoBase64 / 1024 / 1024} MB. Use o link com curl (sem limite de contexto).`,
        );
      }
      const bytes = base64UrlParaBytes(
        limpo.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      );
      if (!bytes) throw new ErroDoMcp("O base64 não é válido.");
      const motivo = motivoDoFormato(uso, detectarFormato(bytes), bytes.length);
      if (motivo) throw new ErroDoMcp(motivo);
      const { id } = await caixa.guardarBytes({ ...pedido, bytes });
      const v = await caixa.estado(id, LIMITES_DO_ENVIO.esperaMs);
      if (!v) throw new ErroDoMcp("A mesa perdeu o envio. Tente de novo.");
      return { texto: textoDoEnvio(v), erro: v.estado === "erro" };
    }

    const { id, link, expiraEmMs } = await caixa.criarEnvio(pedido);
    const minutos = Math.round(expiraEmMs / 60_000);
    return [
      `Envio ${id} aberto para ${ROTULO_DO_USO[uso]}: ${nome}.`,
      `Rode no shell (troque o caminho pelo do arquivo no computador; o link vale uma vez, ${minutos} min):`,
      comandoDeEnvio(link),
      "A resposta do curl já diz o que foi feito na mesa. Se ele demorar a responder ou você não vir o resultado, consulte com " +
        `{"acao":"estado","envio":"${id}"}.`,
      mestre
        ? "O navegador do mestre está aberto e processa sozinho."
        : "Não há navegador de mestre aberto agora: o arquivo espera na caixa e a mesa o processa quando o mestre abrir (o envio mostra 'O Claude enviou 1 arquivo').",
      "Sem shell? Mande de novo com `base64` (até 2 MB).",
    ].join("\n");
  },
});
