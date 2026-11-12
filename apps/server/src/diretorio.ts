import { DurableObject } from "cloudflare:workers";
import { ID_DA_MESA_LEGADA_DE_TESTE, nomeDeMesaValido, type ResumoDaMesa } from "@tabletop/shared";
import { LIMITE_DE_MESAS_POR_HORA, RegistroDeMesas } from "./registroDeMesas";

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

const resumo = (m: { id: string; nome: string }): ResumoDaMesa => ({ id: m.id, nome: m.nome });

/**
 * O diretório de mesas: um Durable Object único (`idFromName("diretorio")`) com a lista
 * `{id, doNome, nome, criadaEm}`. Só o Worker fala com ele (as rotas aqui são internas).
 * Ao subir garante a entrada da mesa legada (o DO "campanha"), sem tocar nele.
 */
export class Diretorio extends DurableObject<Env> {
  private readonly registro: RegistroDeMesas;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.registro = new RegistroDeMesas(ctx.storage.sql);
    void ctx.blockConcurrencyWhile(async () => {
      this.registro.iniciar(env.MODO === "teste" ? ID_DA_MESA_LEGADA_DE_TESTE : null);
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const mesaDe = /^\/mesas\/([^/]+)$/.exec(pathname);

    if (pathname === "/mesas" && request.method === "GET") {
      return json(this.registro.listar().map((m) => ({ ...resumo(m), legada: m.legada })));
    }
    if (mesaDe && request.method === "GET") {
      const m = this.registro.obter(decodeURIComponent(mesaDe[1] ?? ""));
      return m ? json({ ...m }) : json({ erro: "mesa_inexistente" }, 404);
    }
    if (pathname === "/mesas" && request.method === "POST") return this.criar(request);
    if (mesaDe && request.method === "PATCH")
      return this.renomear(decodeURIComponent(mesaDe[1] ?? ""), request);
    return new Response("Não encontrado", { status: 404 });
  }

  private async criar(request: Request): Promise<Response> {
    const { nome: bruto, ip } = (await request.json()) as { nome?: unknown; ip?: unknown };
    const nome = nomeDeMesaValido(bruto);
    if (!nome) return json({ erro: "nome_invalido" }, 400);
    const quem = typeof ip === "string" && ip ? ip : "local";
    // Em MODO=teste o freio não vale (os E2E criam mesas à vontade); o limite em si tem teste de unidade.
    const limite = this.env.MODO === "teste" ? 10_000 : LIMITE_DE_MESAS_POR_HORA;
    const agora = Date.now();
    if (this.registro.limiteAtingido(quem, agora, limite))
      return json({ erro: "muitas_mesas" }, 429);
    const mesa = this.registro.criar(nome, quem, agora);
    // Só agora o Durable Object da mesa passa a existir (nasce vazio).
    const sala = this.env.SALA.get(this.env.SALA.idFromName(mesa.doNome));
    const r = await sala.fetch(
      new Request("https://sala/criar", {
        method: "POST",
        body: JSON.stringify({ nome }),
      }),
    );
    if (!r.ok) {
      this.registro.esquecer(mesa.id);
      return json({ erro: "falha_ao_criar" }, 500);
    }
    return json({ id: mesa.id, nome }, 201);
  }

  private async renomear(id: string, request: Request): Promise<Response> {
    const { nome: bruto } = (await request.json()) as { nome?: unknown };
    const nome = nomeDeMesaValido(bruto);
    if (!nome) return json({ erro: "nome_invalido" }, 400);
    return this.registro.renomear(id, nome)
      ? json({ id, nome })
      : json({ erro: "mesa_inexistente" }, 404);
  }
}
