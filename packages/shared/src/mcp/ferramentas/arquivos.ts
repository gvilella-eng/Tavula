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
  listarAssetsDaMesa,
  motivoDoFormato,
  negarEnvio,
  type OpcoesDoEnvio,
  ROTULO_DO_USO,
  type UsoDeEnvio,
  usoDoArquivo,
  usosDoAsset,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar } from "../nomes.ts";
import { type Contexto, definir, passo } from "./base.ts";
import { emMetros } from "./cenasUtil.ts";

const FORMAS_DO_USO = [
  "mapa",
  "mapa da cena",
  "token",
  "retrato",
  "retrato da ficha",
  "aparencia",
  "aparência",
  "simbolo",
  "símbolo",
  "handout",
  "imagem do handout",
  "som",
  "animacao",
  "animação",
  "imagem",
  "imagem solta",
  "imagem na cena",
  "compendio",
  "compêndio",
  "mapa universal vtt",
  "dungeondraft",
  "uvtt",
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
    case "aparencia":
    case "aparência":
      return "aparencia";
    case "simbolo":
    case "símbolo":
      return "simbolo";
    case "handout":
    case "imagem do handout":
      return "handout";
    case "animacao":
    case "animação":
      return "animacao";
    case "imagem":
    case "imagem solta":
    case "imagem na cena":
      return "imagem";
    case "compendio":
    case "compêndio":
      return "compendio";
    case "mapa universal vtt":
    case "dungeondraft":
    case "uvtt":
      return "mapa-uvtt";
    default:
      return forma;
  }
}

/** Onde o asset é usado agora, em frases curtas (para a lista). */
function ondeEhUsado(estado: Estado, hash: string): string[] {
  return usosDoAsset(estado, hash).map((u) => u.rotulo);
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
    "Sobe arquivos do computador para a mesa (mapa, token, retrato, aparência, símbolo, handout, som, animação, imagem solta na cena, compêndio) e usa os que já estão nela. Fluxo: `enviar`, rode no shell o comando devolvido (curl) e a resposta diz o que foi feito.",
    'O link vale 15 min, uma vez: `curl -sS -T "<caminho do arquivo>" "<link>"`. Sem shell, passe `base64` (até 2 MB). Formatos: imagem png, jpg, webp ou gif; som mp3, ogg ou wav; animação gif, webp ou apng; compêndio json.',
    'Mapa do Dungeondraft (.dd2vtt, .uvtt, .df2vtt): `uso` "dungeondraft" cria uma cena nova. Só o mestre.',
    'Alvos, pelo nome: mapa -> `cena` (padrão: a ativa); token -> `token` ou `ficha`; retrato, aparencia, simbolo -> `ficha`; handout -> `handout`; som -> entra na mesa. No mapa, `quadrados` ou `pxPorQuadrado` ajusta o tamanho. Imagem solta: `uso` "imagem" põe o arquivo na cena (`x`, `y` e `larguraQuadrados` em quadrados, `camada`).',
    "`estado` consulta um envio. `listar` mostra os Assets da mesa (tipo, quem enviou, onde é usado; só o mestre). `usar` põe na mesa um arquivo que já existe (`hash`: 6+ letras do `listar`). `renomear` (`hash`, `novoNome`). `apagar` (`hash`): em uso a mesa recusa e diz onde; `confirmar: true` tira a imagem desses lugares. `ajustar` move, estica, gira ou esconde uma imagem solta (`token`: o nome dela).",
    'Exemplos: {"acao":"enviar","uso":"mapa","nome":"cripta.png","cena":"Cripta","quadrados":45}; {"acao":"usar","uso":"imagem","hash":"a1b2c3d4","x":12,"y":8,"camada":"mapa"}; {"acao":"ajustar","token":"estatua","larguraQuadrados":3,"rotacao":45}; {"acao":"apagar","hash":"a1b2c3d4"}.',
  ].join(" "),
  entrada: z
    .object({
      acao: z
        .enum(["enviar", "estado", "listar", "usar", "renomear", "apagar", "ajustar"])
        .optional()
        .describe("Padrão: enviar."),
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
      hash: z
        .string()
        .optional()
        .describe("`usar`, `renomear` e `apagar`: o hash (6+ letras) do arquivo da mesa."),
      x: z
        .number()
        .min(0)
        .optional()
        .describe("Imagem solta: o ponto em quadrados (x) onde fica o centro dela."),
      y: z.number().min(0).optional().describe("Imagem solta: o ponto em quadrados (y)."),
      camada: z
        .enum(["mapa", "tokens", "mestre"])
        .optional()
        .describe("Imagem solta: a camada (padrão mapa para o mestre)."),
      larguraQuadrados: z
        .number()
        .min(0.1)
        .max(500)
        .optional()
        .describe("Imagem solta: a largura, em quadrados (a altura segue a proporção)."),
      alturaQuadrados: z
        .number()
        .min(0.1)
        .max(500)
        .optional()
        .describe("`ajustar`: a altura, em quadrados."),
      rotacao: z.number().min(-360).max(360).optional().describe("`ajustar`: o giro, em graus."),
      oculto: z.boolean().optional().describe("`ajustar`: esconde a imagem dos jogadores."),
      novoNome: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe("`renomear`: o nome novo. `ajustar`: o novo nome da imagem na cena."),
      confirmar: z
        .boolean()
        .optional()
        .describe("`apagar`: confirma, mesmo em uso (a mesa tira a imagem de onde estava)."),
    })
    .strict(),
  visivel: () => true,
  async executar(e, ctx) {
    const acao = e.acao ?? "enviar";
    const estado = ctx.sala.estado();
    const eu = ctx.sala.eu();

    if (acao === "listar") {
      if (eu.papel !== "mestre") throw new ErroDoMcp("Só o mestre lista os arquivos da mesa.");
      const lista = listarAssetsDaMesa(estado, eu);
      if (lista.length === 0) return "A mesa ainda não tem arquivos.";
      return [
        `Assets da mesa (${lista.length}):`,
        ...lista.slice(0, 80).map((a) => {
          const dim =
            a.tipo === "som" || a.tipo === "compendio" ? "" : `, ${a.largura}x${a.altura}`;
          return `- ${a.nome} (${a.tipo}${a.animado ? " animado" : ""}${dim}${a.bytes > 0 ? `, ${tamanho(a.bytes)}` : ""}) enviado por ${a.donoNome} [hash ${a.hash.slice(0, 12)}] — ${a.usos.length > 0 ? `usado em: ${a.usos.join("; ")}` : "sem uso"}`;
        }),
        ...(lista.length > 80 ? [`...e mais ${lista.length - 80}.`] : []),
      ].join("\n");
    }

    if (acao === "renomear" || acao === "apagar") {
      if (eu.papel !== "mestre") {
        throw new ErroDoMcp(
          `Só o mestre ${acao === "renomear" ? "renomeia" : "apaga"} os arquivos da mesa.`,
        );
      }
      if (e.hash === undefined) throw new ErroDoMcp("Diga o `hash` do arquivo (veja `listar`).");
      const meta = acharAsset(estado, e.hash);
      if (acao === "renomear") {
        if (e.novoNome === undefined) throw new ErroDoMcp("Diga o `novoNome`.");
        await passo(
          ctx,
          ctx.novoLote(`Renomeou o arquivo ${meta.nomeOriginal}`),
          "asset.renomear",
          {
            hash: meta.hash,
            nome: e.novoNome,
          },
        );
        return `Feito: o arquivo agora se chama "${e.novoNome}".`;
      }
      const usos = ondeEhUsado(estado, meta.hash);
      await passo(ctx, ctx.novoLote(`Apagou o arquivo ${meta.nomeOriginal}`), "asset.apagar", {
        hash: meta.hash,
        ...(e.confirmar === true ? { removerUsos: true } : {}),
      });
      return usos.length > 0
        ? `Feito: o arquivo "${meta.nomeOriginal}" saiu da mesa, e a imagem saiu de: ${usos.join("; ")}. O arquivo continua no computador do mestre.`
        : `Feito: o arquivo "${meta.nomeOriginal}" saiu da mesa. Ele continua no computador do mestre.`;
    }

    if (acao === "ajustar") {
      if (e.token === undefined) throw new ErroDoMcp("Diga o nome da imagem (`token`).");
      const cena = e.cena
        ? achar(estado.cenas, e.cena, { rotulo: "cena", nomeDe: (c) => c.nome, idDe: (c) => c.id })
        : (estado.cenas.find((c) => c.id === estado.cenaAtivaId) ?? estado.cenas[0]);
      if (!cena) throw new ErroDoMcp("A mesa não tem cena.");
      const imagens = estado.tokens.filter((t) => t.cenaId === cena.id && t.imagem !== undefined);
      const alvo = achar(imagens, e.token, {
        rotulo: "imagem solta",
        nomeDe: (t) => t.nome,
        idDe: (t) => t.id,
      });
      const q = cena.grid.quadradoM;
      const lugar =
        e.x !== undefined || e.y !== undefined
          ? emMetros([e.x ?? alvo.x / q, e.y ?? alvo.y / q], q)
          : undefined;
      const mudancas = {
        ...(lugar ? { x: lugar.x, y: lugar.y } : {}),
        ...(e.larguraQuadrados !== undefined ? { larguraM: e.larguraQuadrados * q } : {}),
        ...(e.alturaQuadrados !== undefined ? { alturaM: e.alturaQuadrados * q } : {}),
        ...(e.rotacao !== undefined ? { rotacao: e.rotacao } : {}),
        ...(e.camada !== undefined ? { camada: e.camada } : {}),
        ...(e.oculto !== undefined ? { oculto: e.oculto } : {}),
        ...(e.novoNome !== undefined ? { nome: e.novoNome.slice(0, 64) } : {}),
      };
      if (Object.keys(mudancas).length === 0) {
        throw new ErroDoMcp(
          "Diga o que mudar: x, y, larguraQuadrados, alturaQuadrados, rotacao, camada ou oculto.",
        );
      }
      await passo(ctx, ctx.novoLote(`Ajustou a imagem ${alvo.nome}`), "imagem.ajustar", {
        id: alvo.id,
        mudancas,
      });
      return `Feito: a imagem "${alvo.nome}" foi ajustada.`;
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
      throw new ErroDoMcp(
        "Diga o `uso`: mapa, token, retrato, aparência, símbolo, handout, som, animação, imagem (solta na cena), compêndio ou dungeondraft (mapa Universal VTT).",
      );
    const uso = usoDe(e.uso);
    const alvo = alvoDoPedido(estado, e);
    // Imagem solta: o Claude fala em quadrados da cena; a mesa guarda metros. Sem `x` e `y`, o centro da cena.
    const cenaDaImagem =
      uso === "imagem"
        ? ((alvo.cenaId ? estado.cenas.find((c) => c.id === alvo.cenaId) : undefined) ??
          estado.cenas.find((c) => c.id === estado.cenaAtivaId) ??
          estado.cenas[0])
        : undefined;
    if (uso === "imagem" && cenaDaImagem && alvo.cenaId === undefined)
      alvo.cenaId = cenaDaImagem.id;
    const quadradoDaImagem = cenaDaImagem?.grid.quadradoM ?? 1.5;
    const opcoes: OpcoesDoEnvio = {
      ...(uso === "imagem" && cenaDaImagem
        ? {
            xM: (e.x ?? cenaDaImagem.larguraM / quadradoDaImagem / 2) * quadradoDaImagem,
            yM: (e.y ?? cenaDaImagem.alturaM / quadradoDaImagem / 2) * quadradoDaImagem,
            ...(e.camada !== undefined ? { camada: e.camada } : {}),
            ...(e.larguraQuadrados !== undefined
              ? { larguraM: e.larguraQuadrados * quadradoDaImagem }
              : {}),
          }
        : {}),
      ...(e.pxPorQuadrado !== undefined ? { pxPorQuadrado: e.pxPorQuadrado } : {}),
      ...(e.quadrados !== undefined ? { quadrados: e.quadrados } : {}),
      ...(e.volume !== undefined ? { volume: e.volume } : {}),
    };

    if (acao === "usar") {
      if (eu.papel !== "mestre")
        throw new ErroDoMcp(
          "Só o mestre usa os arquivos que já estão na mesa; o jogador envia o dele com `enviar`.",
        );
      if (uso === "mapa-uvtt") {
        throw new ErroDoMcp(
          "O mapa Universal VTT só entra pelo `enviar`: o arquivo é lido pelo navegador do mestre e vira uma cena nova.",
        );
      }
      if (e.hash === undefined) throw new ErroDoMcp("Diga o `hash` do arquivo (veja `listar`).");
      const meta = acharAsset(estado, e.hash);
      const serve =
        uso === "mapa"
          ? meta.tipo === "mapa"
          : uso === "som"
            ? meta.tipo === "som"
            : uso === "animacao"
              ? meta.tipo === "animacao"
              : uso === "imagem"
                ? meta.tipo === "imagem" || meta.tipo === "animacao"
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
