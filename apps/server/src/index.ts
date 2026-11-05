import { nomeDaSala } from "@tabletop/shared";
import { AutenticacaoDev } from "./autenticacao";
import { CABECALHO_USUARIO, pedeWebSocket } from "./sala";

export { Sala } from "./sala";

const autenticacao = new AutenticacaoDev();

function naoEncontrado(): Response {
  return new Response("Não encontrado", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const sala = env.SALA.get(env.SALA.idFromName(nomeDaSala()));

    if (pathname === "/saude") return new Response("ok");

    if (pathname === "/api/usuarios" && request.method === "GET") return sala.fetch(request);

    if (pathname === "/api/eu" && request.method === "GET") {
      const usuarioId = autenticacao.identificar(request);
      if (!usuarioId) return new Response(null, { status: 401 });
      const cabecalhos = new Headers(request.headers);
      cabecalhos.set(CABECALHO_USUARIO, usuarioId);
      return sala.fetch(new Request(request, { headers: cabecalhos }));
    }

    if (pathname === "/api/entrar" && request.method === "POST") {
      const corpo = await request.text();
      const resposta = await sala.fetch(new Request(request.url, { method: "POST", body: corpo }));
      if (!resposta.ok) return resposta;
      const { usuarioId } = JSON.parse(corpo) as { usuarioId: string };
      const saida = new Response(resposta.body, resposta);
      saida.headers.append("Set-Cookie", autenticacao.cabecalhoDeEntrada(usuarioId));
      return saida;
    }

    if (pathname === "/api/sair" && request.method === "POST") {
      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": autenticacao.cabecalhoDeSaida() },
      });
    }

    if (pathname === "/ws" && pedeWebSocket(request)) {
      const usuarioId = autenticacao.identificar(request);
      if (!usuarioId) return new Response("Não autenticado", { status: 401 });
      // O cabeçalho é sempre sobrescrito aqui: o que o navegador mandar com esse nome não vale.
      const cabecalhos = new Headers(request.headers);
      cabecalhos.set(CABECALHO_USUARIO, usuarioId);
      return sala.fetch(new Request(request, { headers: cabecalhos }));
    }

    // Rotas de teste: só existem com MODO=teste (a sala confere de novo).
    if (pathname.startsWith("/teste/") && env.MODO === "teste" && request.method === "POST") {
      return sala.fetch(request);
    }

    return naoEncontrado();
  },
} satisfies ExportedHandler<Env>;
