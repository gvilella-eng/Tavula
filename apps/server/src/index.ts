import {
  ehIdDeMesa,
  MestreDaMesaNovaSchema,
  mensagemDeErroDeConta,
  nomeDaSala,
  nomeDeMesaValido,
  normalizarIdDeMesa,
} from "@tabletop/shared";
import {
  CABECALHO_IP,
  CABECALHO_LOCAL,
  CABECALHO_MESA,
  CABECALHO_SEGURO,
  CABECALHOS_INTERNOS,
  pedeWebSocket,
} from "./sala";

export { Diretorio } from "./diretorio";
export { Sala } from "./sala";

/** O diretório é um só, para todo o servidor. */
const NOME_DO_DIRETORIO = "diretorio";
const TAMANHO_MAXIMO_DO_CORPO = 4096;

function naoEncontrado(): Response {
  return new Response("Não encontrado", { status: 404 });
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

const mesaInexistente = () => json({ erro: "mesa_inexistente" }, 404);

/** O corpo JSON do pedido (de até 4 KB), ou `null` se não for JSON, for grande demais ou não for um objeto. */
async function lerCorpo(request: Request): Promise<Record<string, unknown> | null> {
  const texto = await request.text();
  if (texto.length > TAMANHO_MAXIMO_DO_CORPO) return null;
  try {
    const dados: unknown = JSON.parse(texto);
    return dados && typeof dados === "object" && !Array.isArray(dados)
      ? (dados as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

type MesaDoDiretorio = { id: string; doNome: string; nome: string; legada: boolean };

/** O Worker de verdade fica atrás do Cloudflare: lá o `CF-Connecting-IP` sempre existe. Sem ele, o pedido é do próprio computador. */
const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * As rotas de uma mesa que a sala atende, com o caminho interno de cada uma. O que não está aqui (as rotas
 * internas `/criar`, `/papel` e `/api/renomeada`, por exemplo) nunca é repassado.
 */
function caminhoInterno(metodo: string, rota: string): string | null {
  if (rota === "ws") return "/ws";
  if (metodo === "GET" && ["situacao", "usuarios", "eu", "contas"].includes(rota)) {
    return `/api/${rota}`;
  }
  if (metodo === "POST" && ["entrar", "sair"].includes(rota)) return `/api/${rota}`;
  const conta = /^conta\/(entrar|pedir|sair|esqueci|redefinir|trocar-senha|mestre-inicial)$/.exec(
    rota,
  );
  if (metodo === "POST" && conta) {
    // `conta/sair` é o mesmo que `sair`: a sessão cai e os cookies saem.
    return conta[1] === "sair" ? "/api/sair" : `/api/conta/${conta[1]}`;
  }
  const doMestre =
    /^contas\/([A-Za-z0-9-]{1,64})\/(aceitar|recusar|remover|vaga|liberar-redefinicao)$/.exec(rota);
  if (metodo === "POST" && doMestre) return `/api/contas/${doMestre[1]}/${doMestre[2]}`;
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const diretorio = () => env.DIRETORIO.get(env.DIRETORIO.idFromName(NOME_DO_DIRETORIO));
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const seguro = url.protocol === "https:";
    // (assumido) O `wrangler dev` pode pôr o IP de loopback no cabeçalho: isso também conta como local.
    const ipDoCliente = request.headers.get("CF-Connecting-IP");
    const local =
      HOSTS_LOCAIS.has(url.hostname) &&
      (!ipDoCliente || ipDoCliente === "127.0.0.1" || ipDoCliente === "::1");

    if (pathname === "/saude") return new Response("ok");

    // --- Diretório de mesas -------------------------------------------------------------------

    if (pathname === "/api/mesas" && request.method === "POST") {
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
        return json({ erro: "tipo_invalido" }, 415);
      }
      const corpo = await lerCorpo(request);
      const nome = nomeDeMesaValido(corpo?.nome);
      if (!nome) return json({ erro: "nome_invalido" }, 400);
      // C2: uma mesa nova nasce com a conta do mestre (login, nome e a senha já derivada no navegador) e o id
      // que o navegador sorteou (o id entra no sal da senha). Só em MODO=teste dá para criar sem conta.
      let mestre: unknown;
      let id: string | undefined;
      if (corpo?.mestre !== undefined) {
        const m = MestreDaMesaNovaSchema.safeParse(corpo.mestre);
        if (!m.success || typeof corpo.id !== "string" || !ehIdDeMesa(corpo.id)) {
          return json(
            { erro: "corpo_invalido", mensagem: mensagemDeErroDeConta("corpo_invalido") },
            400,
          );
        }
        mestre = m.data;
        id = corpo.id;
      } else if (env.MODO !== "teste") {
        return json(
          { erro: "mestre_obrigatorio", mensagem: mensagemDeErroDeConta("mestre_obrigatorio") },
          400,
        );
      }
      const r = await diretorio().fetch(
        new Request("https://diretorio/mesas", {
          method: "POST",
          body: JSON.stringify({ nome, ip, id, mestre, seguro }),
        }),
      );
      if (!r.ok) {
        if (r.status === 409) {
          return json({ erro: "id_em_uso", mensagem: mensagemDeErroDeConta("id_em_uso") }, 409);
        }
        return r;
      }
      const criada = (await r.json()) as { id: string; nome: string; cookie?: string | null };
      const saida = json({ id: criada.id, nome: criada.nome }, 201);
      if (criada.cookie) saida.headers.append("Set-Cookie", criada.cookie);
      return saida;
    }

    if (pathname === "/api/mesas" && request.method === "GET") {
      // Listar as mesas só com LISTAR_MESAS=1 (dev e E2E): na internet ninguém descobre as mesas dos outros.
      if (env.LISTAR_MESAS !== "1") return naoEncontrado();
      return diretorio().fetch(new Request("https://diretorio/mesas"));
    }

    const consulta = /^\/api\/mesas\/([^/]+)$/.exec(pathname);
    if (consulta && request.method === "GET") {
      const id = normalizarIdDeMesa(decodeURIComponent(consulta[1] ?? ""));
      if (!id) return mesaInexistente();
      const r = await diretorio().fetch(new Request(`https://diretorio/mesas/${id}`));
      if (!r.ok) return mesaInexistente();
      const m = (await r.json()) as MesaDoDiretorio;
      return json({ id: m.id, nome: m.nome, legada: m.legada });
    }

    // --- Rotas da mesa: /api/m/<id>/... -------------------------------------------------------

    if (pathname.startsWith("/api/m/")) {
      const daMesa = /^\/api\/m\/([^/]+)\/(.+)$/.exec(pathname);
      if (!daMesa) return naoEncontrado();
      let idBruto = daMesa[1] ?? "";
      try {
        idBruto = decodeURIComponent(idBruto);
      } catch {
        return mesaInexistente();
      }
      const id = normalizarIdDeMesa(idBruto);
      if (!id) return mesaInexistente();
      const rota = daMesa[2] ?? "";
      const r = await diretorio().fetch(new Request(`https://diretorio/mesas/${id}`));
      if (!r.ok) return mesaInexistente();
      const mesa = (await r.json()) as MesaDoDiretorio;
      const sala = env.SALA.get(env.SALA.idFromName(mesa.doNome));

      // Os cabeçalhos internos são sempre refeitos aqui: o que o navegador mandar com esses nomes não vale.
      // A sala descobre quem é quem sozinha, pelo cookie.
      const cabecalhos = new Headers(request.headers);
      for (const nome of [...CABECALHOS_INTERNOS, "x-tabletop-usuario"]) cabecalhos.delete(nome);
      cabecalhos.set(CABECALHO_IP, ip);
      cabecalhos.set(CABECALHO_MESA, id);
      if (seguro) cabecalhos.set(CABECALHO_SEGURO, "1");
      if (local) cabecalhos.set(CABECALHO_LOCAL, "1");
      const repassar = (caminho: string, init?: RequestInit) =>
        sala.fetch(
          new Request(
            new URL(caminho, request.url),
            new Request(request, { ...init, headers: cabecalhos }),
          ),
        );

      if (rota === "renomear" && request.method === "POST") {
        const papel = await sala.fetch(
          new Request(new URL("/papel", request.url), { headers: cabecalhos }),
        );
        if (!papel.ok) return new Response(null, { status: 401 });
        if (((await papel.json()) as { papel: string }).papel !== "mestre") {
          return json({ erro: "sem_permissao" }, 403);
        }
        const nome = nomeDeMesaValido((await lerCorpo(request))?.nome);
        if (!nome) return json({ erro: "nome_invalido" }, 400);
        const resposta = await diretorio().fetch(
          new Request(`https://diretorio/mesas/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ nome }),
          }),
        );
        // Quem está na mesa recebe o nome novo sem recarregar (frame `mesa.renomeada`).
        if (resposta.ok) {
          await sala.fetch(
            new Request(new URL("/api/renomeada", request.url), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nome }),
            }),
          );
        }
        return resposta;
      }

      const interno = caminhoInterno(request.method, rota);
      if (!interno) return naoEncontrado();
      if (rota === "ws" && !pedeWebSocket(request))
        return new Response("Esperava WebSocket", { status: 426 });
      return repassar(interno);
    }

    // Rotas de teste: só existem com MODO=teste (a sala confere de novo) e valem para a mesa legada.
    if (pathname.startsWith("/teste/") && env.MODO === "teste" && request.method === "POST") {
      return env.SALA.get(env.SALA.idFromName(nomeDaSala())).fetch(request);
    }

    return naoEncontrado();
  },
} satisfies ExportedHandler<Env>;
