import { nomeDaSala } from "@tabletop/shared";
import { pedeWebSocket } from "./sala";

export { Sala } from "./sala";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/saude") return new Response("ok");

    if (pathname === "/ws" && pedeWebSocket(request)) {
      const sala = env.SALA.get(env.SALA.idFromName(nomeDaSala()));
      return sala.fetch(request);
    }

    return new Response("Não encontrado", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
