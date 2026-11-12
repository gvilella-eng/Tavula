import { nomeDaSala, nomeDeMesaValido, normalizarIdDeMesa } from "@tabletop/shared";
import { AutenticacaoDev } from "./autenticacao";
import { CABECALHO_USUARIO, pedeWebSocket } from "./sala";

export { Diretorio } from "./diretorio";
export { Sala } from "./sala";

const autenticacao = new AutenticacaoDev();

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const diretorio = () => env.DIRETORIO.get(env.DIRETORIO.idFromName(NOME_DO_DIRETORIO));

    if (pathname === "/saude") return new Response("ok");

    // --- Diretório de mesas -------------------------------------------------------------------

    if (pathname === "/api/mesas" && request.method === "POST") {
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
        return json({ erro: "tipo_invalido" }, 415);
      }
      const corpo = await lerCorpo(request);
      const nome = nomeDeMesaValido(corpo?.nome);
      if (!nome) return json({ erro: "nome_invalido" }, 400);
      // No C1 qualquer um cria (o C2 põe a conta do mestre aqui). O IP só serve ao limite por hora.
      const ip = request.headers.get("CF-Connecting-IP") || "local";
      return diretorio().fetch(
        new Request("https://diretorio/mesas", {
          method: "POST",
          body: JSON.stringify({ nome, ip }),
        }),
      );
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
      const daMesa = /^\/api\/m\/([^/]+)\/([a-z]+)$/.exec(pathname);
      if (!daMesa) return naoEncontrado();
      const id = normalizarIdDeMesa(decodeURIComponent(daMesa[1] ?? ""));
      if (!id) return mesaInexistente();
      const rota = daMesa[2];
      const r = await diretorio().fetch(new Request(`https://diretorio/mesas/${id}`));
      if (!r.ok) return mesaInexistente();
      const mesa = (await r.json()) as MesaDoDiretorio;
      const sala = env.SALA.get(env.SALA.idFromName(mesa.doNome));
      const alvo = new URL(rota === "ws" ? "/ws" : `/api/${rota}`, request.url);

      // O cabeçalho de usuário é sempre sobrescrito aqui: o que o navegador mandar com esse nome não vale.
      const comUsuario = (usuarioId: string | null): Headers => {
        const cabecalhos = new Headers(request.headers);
        cabecalhos.delete(CABECALHO_USUARIO);
        if (usuarioId) cabecalhos.set(CABECALHO_USUARIO, usuarioId);
        return cabecalhos;
      };

      if (rota === "usuarios" && request.method === "GET") {
        return sala.fetch(new Request(alvo, { headers: comUsuario(null) }));
      }

      if (rota === "eu" && request.method === "GET") {
        const usuarioId = autenticacao.identificar(request);
        if (!usuarioId) return new Response(null, { status: 401 });
        return sala.fetch(new Request(alvo, { headers: comUsuario(usuarioId) }));
      }

      if (rota === "entrar" && request.method === "POST") {
        const corpo = await request.text();
        const resposta = await sala.fetch(new Request(alvo, { method: "POST", body: corpo }));
        if (!resposta.ok) return resposta;
        const { usuarioId } = JSON.parse(corpo) as { usuarioId: string };
        const saida = new Response(resposta.body, resposta);
        saida.headers.append("Set-Cookie", autenticacao.cabecalhoDeEntrada(usuarioId, id));
        return saida;
      }

      if (rota === "sair" && request.method === "POST") {
        const saida = new Response(null, { status: 204 });
        for (const c of autenticacao.cabecalhosDeSaida(id)) saida.headers.append("Set-Cookie", c);
        return saida;
      }

      if (rota === "renomear" && request.method === "POST") {
        const usuarioId = autenticacao.identificar(request);
        if (!usuarioId) return new Response(null, { status: 401 });
        const papel = await sala.fetch(
          new Request(new URL("/papel", request.url), { headers: comUsuario(usuarioId) }),
        );
        if (!papel.ok) return new Response(null, { status: 401 });
        if (((await papel.json()) as { papel: string }).papel !== "mestre") {
          return json({ erro: "sem_permissao" }, 403);
        }
        const nome = nomeDeMesaValido((await lerCorpo(request))?.nome);
        if (!nome) return json({ erro: "nome_invalido" }, 400);
        return diretorio().fetch(
          new Request(`https://diretorio/mesas/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ nome }),
          }),
        );
      }

      if (rota === "ws" && pedeWebSocket(request)) {
        const usuarioId = autenticacao.identificar(request);
        if (!usuarioId) return new Response("Não autenticado", { status: 401 });
        return sala.fetch(
          new Request(alvo, new Request(request, { headers: comUsuario(usuarioId) })),
        );
      }

      return naoEncontrado();
    }

    // Rotas de teste: só existem com MODO=teste (a sala confere de novo) e valem para a mesa legada.
    if (pathname.startsWith("/teste/") && env.MODO === "teste" && request.method === "POST") {
      return env.SALA.get(env.SALA.idFromName(nomeDaSala())).fetch(request);
    }

    return naoEncontrado();
  },
} satisfies ExportedHandler<Env>;
