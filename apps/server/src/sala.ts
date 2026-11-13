import { DurableObject } from "cloudflare:workers";
import {
  assetVisivelPara,
  botaoDentroDoLimite,
  type CodigoDeErro,
  CorpoAceitarSchema,
  CorpoChaveSchema,
  CorpoCodigoSchema,
  CorpoEntrarSchema,
  CorpoEsqueciSchema,
  CorpoMestreInicialSchema,
  CorpoPedirSchema,
  CorpoRecuperarCodigoSchema,
  CorpoRecuperarPastaSchema,
  CorpoRedefinirSchema,
  CorpoTrocarSenhaSchema,
  calcularUso,
  derivarMembros,
  desenhoVisivelPara,
  diaUtc,
  type Estado,
  type EventoSala,
  estadoInicial,
  eventoPara,
  type FonteDeAleatoriedade,
  fonteComSemente,
  INTERVALO_MINIMO_DO_BOTAO_MS,
  type Intencao,
  idDoPedido,
  LIMITES_DO_CHAT,
  lerFrameDePedaco,
  lerIntencao,
  limitarPing,
  type Mensagem,
  MestreDaMesaNovaSchema,
  mensagem,
  mensagemDeErroDeConta,
  mensagemParaUsuario,
  nomeDeExibicaoValido,
  type Pacote,
  type PingRepassado,
  type PlanoDeAceite,
  PRAZO_PARA_RESTAURAR_TOKEN_MS,
  type Presenca,
  pausarSeSemMestre,
  pingVisivelPara,
  planejarAceite,
  processar,
  processarSistema,
  proximoIdDeJogador,
  proximoMarcoDasAutomacoes,
  proximoMarcoDoObjeto,
  type RascunhoRepassado,
  rascunhoDentroDoLimite,
  registrarMensagem,
  type TokenApagadoRecente,
  tempoDaSala,
  tokenVisivelPara,
  type UltimoPing,
  type Usuario,
  visaoPara,
} from "@tabletop/shared";
import semente from "../../../fixtures/campanha.seed.json";
import { Agendador } from "./agendador";
import { Armazenamento, type UsoDoDia } from "./armazenamento";
import {
  COOKIE_DE_TESTE,
  cookieDeSessao,
  cookieDeTeste,
  cookiesDeSaida,
  lerCookie,
  NOME_DO_COOKIE,
} from "./autenticacao";
import { type ContaPublica, ContasDaMesa, type Falha } from "./contas";
import { carregarOuSemear, criarMesaNova } from "./inicializacao";
import { Transferencias } from "./transferencias";

/** O valor do cabeçalho Upgrade não diferencia maiúsculas ("websocket", "WebSocket"). */
export function pedeWebSocket(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

/**
 * Cabeçalhos internos que o Worker preenche (e que ele sempre apaga do que o navegador mandar): o IP de
 * quem pediu, se o pedido é local, se veio por https e o id da mesa. A identificação de quem pede NÃO vem
 * de cabeçalho: a sala a resolve sozinha pelo cookie (sessão → conta → vaga).
 */
export const CABECALHO_IP = "x-tavola-ip";
export const CABECALHO_LOCAL = "x-tavola-local";
export const CABECALHO_SEGURO = "x-tavola-seguro";
export const CABECALHO_MESA = "x-tavola-mesa";
export const CABECALHOS_INTERNOS = [
  CABECALHO_IP,
  CABECALHO_LOCAL,
  CABECALHO_SEGURO,
  CABECALHO_MESA,
];

const TEMPO_RECONECTANDO_MS = 10_000;
/**
 * Quanto a sala espera, depois que o último mestre sai, antes de pausar a mesa: recarregar a página (ou o
 * React em desenvolvimento, que abre a conexão duas vezes) fecha uma conexão um instante antes de abrir a
 * outra. A pausa vale no tempo da sala da hora da saída, não da espera.
 */
const ESPERA_DA_PAUSA_MS = 5_000;
const INTERVALO_USO_MS = 5_000;
const MENSAGENS_POR_LOTE_DE_USO = 50;
/** As intenções que criam uma mensagem no chat: limitadas a 10 por segundo, por conexão. */
const INTENCOES_DE_CHAT = new Set<string>([
  "chat.enviar",
  "dado.rolar",
  "chat.modelo",
  "chat.magia",
  "chat.caracteristica",
]);
/** Quantas linhas do histórico a sala lê de cada vez ao procurar o que o usuário pode ver. */
const PAGINA_DO_HISTORICO = 400;

/** O que fica no `serializeAttachment` de cada socket: sobrevive à hibernação. */
type Identidade = {
  usuarioId: string;
  conexaoId: string;
  /** Conta e sessão que abriram o socket (sem eles: o login solto de teste). Para fechar o socket quando a conta cai. */
  contaId?: string;
  sessaoHash?: string;
};

/** Quem fez uma requisição, já resolvido pela sala. */
type Quem = {
  usuarioId: string;
  conta?: ContaPublica;
  sessaoHash?: string;
  renovou?: boolean;
  token?: string;
};

type Esquema<T> = { safeParse(dados: unknown): { success: true; data: T } | { success: false } };

const STATUS_DO_ERRO_DE_CONTA: Record<string, number> = {
  corpo_invalido: 400,
  mestre_obrigatorio: 400,
  tipo_invalido: 415,
  credenciais: 401,
  sem_sessao: 401,
  bloqueada: 429,
  ip_bloqueado: 429,
  muitos_pedidos: 429,
  pedido_recusado_recente: 429,
  login_em_uso: 409,
  ja_tem_mestre: 409,
  id_em_uso: 409,
  vaga_invalida: 409,
  sem_pedido: 409,
  mesa_sem_mestre: 409,
  conta_inexistente: 404,
  recuperacao_invalida: 401,
  login_nao_confere: 403,
  origem_invalida: 403,
};
const TAMANHO_MAXIMO_DO_CORPO = 4096;
/** Cores das vagas novas (as de conteúdo de uma mesa; não são do tema da interface). */
const CORES_DE_VAGA = [
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#800000",
];

function erroDeConta(f: Falha): Response {
  const resposta = json(
    { erro: f.erro, mensagem: mensagemDeErroDeConta(f.erro, f.minutos), minutos: f.minutos },
    STATUS_DO_ERRO_DE_CONTA[f.erro] ?? 403,
  );
  if (f.minutos) resposta.headers.set("Retry-After", String(f.minutos * 60));
  return resposta;
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * A sala da campanha: autoritativa. O estado em memória é só cache do SQLite (recarregado no
 * construtor); quem é cada socket vem do attachment dele.
 */
export class Sala extends DurableObject<Env> {
  private estado!: Estado;
  /** Há estado nesta mesa? `false` num Durable Object de mesa que o diretório ainda não criou. */
  private criada = false;
  private readonly banco: Armazenamento;
  /** As contas e sessões desta mesa (C2): segredo da sala, nunca vai a cliente. */
  private readonly contas: ContasDaMesa;
  private readonly agenda: Agendador;
  private uso: UsoDoDia = { dia: "", mensagens: 0, conexoes: 0 };
  private mensagensDesdeGravacaoDoUso = 0;
  private mensagensDesdeEnvioDoUso = 0;
  private ultimoEnvioDoUso = 0;
  /**
   * Tokens que cada socket está arrastando (mandou `token.mover` e ainda não `token.soltar`). Só
   * memória: enquanto alguém arrasta, a sala recebe mensagens e não hiberna.
   */
  private readonly arrastes = new Map<WebSocket, Set<string>>();
  /**
   * Traços em andamento de cada socket (id do desenho → cena): o rascunho só é repassado (nunca
   * gravado). Quando o socket cai, os outros recebem o fim de cada um. Só memória.
   */
  private readonly rascunhos = new Map<WebSocket, Map<string, string>>();
  /** V12: o último ping e a última centralização de cada usuário (só memória; o limite de frequência). */
  private readonly ultimoPing = new Map<string, UltimoPing>();
  /** 7b-3: quando cada jogador usou um botão liberado pela última vez (só memória; o limite de frequência). */
  private readonly ultimoBotao = new Map<string, number>();
  /** Quando cada conexão mandou o último rascunho aceito (o limite de frequência). */
  private readonly ultimoRascunho = new Map<WebSocket, number>();
  /** Quando cada conexão mandou as últimas mensagens de chat (só memória; a janela é de 1 s). */
  private readonly taxaDoChat = new Map<WebSocket, number[]>();
  /** Gancho de teste (`MODO=teste`): dados com semente fixa. Fora dele, sempre `crypto`. */
  private fonteDeDadosDeTeste: FonteDeAleatoriedade | null = null;
  /** V10: os tokens tirados do mapa há pouco (só na memória), para o "Desfazer"; some depois do prazo. */
  private apagadosRecentes: TokenApagadoRecente[] = [];
  /**
   * Gancho de teste (`/teste/zerar`): os sockets que já existiam quando a sala foi zerada. O fechamento
   * atrasado de um deles (de um teste anterior) não pausa a mesa nova.
   */
  private readonly anterioresAoZerar = new WeakSet<WebSocket>();
  /** Envio de arquivos entre navegadores (só memória; a sala nunca grava pedaço). */
  private readonly transferencias: Transferencias;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.banco = new Armazenamento(ctx.storage.sql);
    this.contas = new ContasDaMesa(ctx.storage.sql);
    this.agenda = new Agendador(ctx.storage.sql, ctx.storage);
    this.transferencias = new Transferencias({
      candidatos: (hash) => this.candidatosA(hash),
      pedirEnvio: (conexaoId, hash, indices) =>
        this.enviarA(conexaoId, mensagem({ tipo: "asset.enviar", dados: { hash, indices } })),
      repassar: (conexaoId, frame) => this.enviarA(conexaoId, frame),
      avisarIndisponivel: (conexaoId, hash) =>
        this.enviarA(conexaoId, mensagem({ tipo: "asset.indisponivel", dados: { hash } })),
      agora: () => Date.now(),
    });
    void ctx.blockConcurrencyWhile(async () => {
      // Só a mesa legada (o DO "campanha") nasce da semente de exemplo; uma mesa do diretório só passa a
      // existir quando o diretório manda `POST /criar` (antes disso responde 404 e não se auto-semeia).
      const carregado = carregarOuSemear(this.banco, ctx.id.name, semente);
      if (carregado) await this.iniciar(carregado);
    });
  }

  /** Estado em memória pronto, relógio e filas em dia. Roda ao acordar uma mesa que já existe e ao criar uma nova. */
  private async iniciar(carregado: Estado): Promise<void> {
    this.estado = { ...carregado, retratosDoChat: this.banco.retratosDoChat() };
    this.criada = true;
    this.iniciarRelogio();
    // Ao acordar: objeto que acabou enquanto a sala dormia sai agora; o resto volta à fila.
    await this.rodarTempo([]);
    // Sem nenhum mestre conectado ao acordar (processo reiniciado): a mesa não corre sozinha.
    await this.pausarSeSemMestre();
    this.uso = this.banco.lerUso() ?? { dia: diaUtc(new Date()), mensagens: 0, conexoes: 0 };
    // Ao acordar: conexão que não existe mais não tem cópia de nada.
    this.banco.limparPosseOrfa(this.conexoesAbertas().map((c) => c.conexaoId));
  }

  /** `POST /criar {nome, mestre?, seguro}` (só o diretório manda): dá à mesa o estado vazio e, com `mestre`, a conta do mestre. Repetir não muda nada. */
  private async criar(request: Request): Promise<Response> {
    if (this.criada) return json({ ok: true, jaExistia: true });
    let corpo: {
      nome?: unknown;
      seguro?: unknown;
      mesaId?: unknown;
      mestre?: unknown;
      chavePublica?: unknown;
    } = {};
    try {
      corpo = (await request.json()) as typeof corpo;
    } catch {
      // sem corpo: mesa sem conta (só MODO=teste; o Worker já conferiu)
    }
    const mestre = corpo.mestre ? MestreDaMesaNovaSchema.safeParse(corpo.mestre) : null;
    if (corpo.mestre && !mestre?.success) return json({ erro: "corpo_invalido" }, 400);
    let cookie: string | null = null;
    let codigo: string | null = null;
    let falhou = false;
    await this.ctx.blockConcurrencyWhile(async () => {
      const { estado } = criarMesaNova(this.banco);
      await this.iniciar(estado);
      if (!mestre?.success) return;
      const agora = Date.now();
      const vaga = this.estado.usuarios.find((u) => u.papel === "mestre");
      const nome = nomeDeExibicaoValido(mestre.data.nome);
      if (!vaga || !nome) {
        falhou = true;
        return;
      }
      const conta = await this.contas.criarMestre({ ...mestre.data, nome }, vaga.id, agora);
      if (!conta.ok) {
        falhou = true;
        return;
      }
      // C3: a chave pública da pasta (se veio) e o código de recuperação, mostrado uma vez na resposta.
      if (corpo.chavePublica !== undefined && corpo.chavePublica !== null) {
        const k = await this.contas.registrarChave(
          conta.valor.id,
          corpo.chavePublica,
          null,
          "local",
          agora,
        );
        if (!k.ok) {
          falhou = true;
          return;
        }
      }
      codigo = await this.contas.gerarCodigo(conta.valor.id);
      this.aplicarUsuarios(
        this.estado.usuarios.map((u) => (u.id === vaga.id ? { ...u, nome } : u)),
      );
      const token = await this.contas.abrirSessaoDe(conta.valor.id, agora);
      cookie = cookieDeSessao(token, String(corpo.mesaId ?? ""), corpo.seguro === true);
    });
    if (falhou) return json({ erro: "falha_ao_criar" }, 500);
    return json({ ok: true, cookie, codigo });
  }

  // --- Quem é quem ------------------------------------------------------------------------------

  private get ehTeste(): boolean {
    return this.env.MODO === "teste";
  }

  /**
   * V7: quem é membro da mesa. O mestre, quem tem conta ativa e, só com MODO=teste, quem entrou pelo login
   * solto (marcado em `meta.presentes_teste`). A vaga em que ninguém entrou fica escondida das listas.
   */
  private membrosIds(): string[] {
    return derivarMembros(
      this.estado.usuarios,
      this.contas.usuariosComContaAtiva(),
      this.presentesDeTeste(),
      this.ehTeste,
    );
  }

  private presentesDeTeste(): string[] {
    try {
      const v = JSON.parse(this.banco.lerMeta("presentes_teste") ?? "[]") as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  /** Com MODO=teste, o login solto numa vaga a torna membro. Devolve `true` se ela acabou de virar. */
  private marcarPresenteDeTeste(usuarioId: string): boolean {
    if (!this.ehTeste) return false;
    const marcados = this.presentesDeTeste();
    if (marcados.includes(usuarioId)) return false;
    this.banco.gravarMeta("presentes_teste", JSON.stringify([...marcados, usuarioId]));
    return true;
  }

  /** A lista de membros mudou: um snapshot novo para todos. */
  private difundirSnapshots(): void {
    for (const ws of this.ctx.getWebSockets()) {
      const usuario = this.usuarioDe(ws);
      if (usuario) this.enviarSnapshot(ws, usuario);
    }
  }

  /**
   * Quem fez o pedido: o cookie `tavola_sessao` (sessão → conta → vaga) e, só com MODO=teste, o login solto
   * `tabletop_sessao` (o id do usuário). Nada do que o navegador mandar em cabeçalho vale aqui.
   */
  private async identificar(request: Request): Promise<Quem | null> {
    const cookies = request.headers.get("Cookie");
    const token = lerCookie(cookies, NOME_DO_COOKIE);
    if (token) {
      const r = await this.contas.resolverSessao(token, Date.now());
      const vaga = r?.conta.usuarioId;
      if (r && vaga && this.estado.usuarios.some((u) => u.id === vaga)) {
        return {
          usuarioId: vaga,
          conta: r.conta,
          sessaoHash: r.sessaoHash,
          renovou: r.renovou,
          token,
        };
      }
    }
    if (this.ehTeste) {
      const id = lerCookie(cookies, COOKIE_DE_TESTE);
      if (id && this.estado.usuarios.some((u) => u.id === id)) return { usuarioId: id };
    }
    return null;
  }

  private ipDe(request: Request): string {
    return request.headers.get(CABECALHO_IP) || "local";
  }

  private seguro(request: Request): boolean {
    return request.headers.get(CABECALHO_SEGURO) === "1";
  }

  private mesaIdDe(request: Request): string {
    return request.headers.get(CABECALHO_MESA) ?? "";
  }

  private comCookies(resposta: Response, cookies: string[]): Response {
    for (const c of cookies) resposta.headers.append("Set-Cookie", c);
    return resposta;
  }

  /** O corpo JSON (até 4 KB) validado pelo esquema, ou a resposta de erro pronta. */
  private async lerCorpo<T>(
    request: Request,
    esquema: Esquema<T>,
  ): Promise<{ ok: true; valor: T } | { ok: false; resposta: Response }> {
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return { ok: false, resposta: erroDeConta({ ok: false, erro: "tipo_invalido" }) };
    }
    const texto = await request.text();
    let bruto: unknown;
    try {
      bruto = texto.length <= TAMANHO_MAXIMO_DO_CORPO ? JSON.parse(texto) : null;
    } catch {
      bruto = null;
    }
    const r = esquema.safeParse(bruto);
    if (!r.success) {
      return { ok: false, resposta: erroDeConta({ ok: false, erro: "corpo_invalido" }) };
    }
    return { ok: true, valor: r.data };
  }

  // --- HTTP -----------------------------------------------------------------------------------

  override async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    // O Worker só repassa para cá depois de achar a mesa no diretório; o diretório é quem manda criar.
    if (pathname === "/criar" && request.method === "POST") return this.criar(request);
    if (!this.criada) return json({ erro: "mesa_inexistente" }, 404);

    if (pathname === "/api/situacao" && request.method === "GET") {
      const semMestre = !this.contas.existeMestre();
      return json({
        modoTeste: this.ehTeste,
        semMestre,
        podeCriarMestre: semMestre && request.headers.get(CABECALHO_LOCAL) === "1",
      });
    }
    if (pathname === "/api/usuarios" && request.method === "GET") {
      // A escolha de usuário de desenvolvimento: só com MODO=teste (na internet ninguém lista as vagas).
      if (!this.ehTeste) return new Response("Não encontrado", { status: 404 });
      return json(this.estado.usuarios.map(({ id, nome, cor }) => ({ id, nome, cor })));
    }
    if (pathname === "/api/eu" && request.method === "GET") {
      const quem = await this.identificar(request);
      const u = quem && this.estado.usuarios.find((x) => x.id === quem.usuarioId);
      if (!quem || !u) return new Response(null, { status: 401 });
      const resposta = json({
        id: u.id,
        nome: u.nome,
        cor: u.cor,
        ...(quem.conta ? { login: quem.conta.login, tourVisto: quem.conta.tourVisto } : {}),
        // Com MODO=teste o tour não abre sozinho (a tela decide): não atrapalha os E2E antigos.
        modoTeste: this.ehTeste,
      });
      // A sessão foi renovada pelo uso: o cookie ganha mais 30 dias.
      if (quem.renovou && quem.token) {
        resposta.headers.append(
          "Set-Cookie",
          cookieDeSessao(quem.token, this.mesaIdDe(request), this.seguro(request)),
        );
      }
      return resposta;
    }
    if (pathname === "/papel" && request.method === "GET") {
      // Interna: o Worker pergunta o papel de quem fez o pedido (renomear a mesa é do mestre).
      const quem = await this.identificar(request);
      const u = quem && this.estado.usuarios.find((x) => x.id === quem.usuarioId);
      return u
        ? json({ papel: u.papel, conta: quem?.conta?.papel ?? null })
        : new Response(null, { status: 401 });
    }
    if (pathname === "/api/entrar" && request.method === "POST") return this.entrar(request);
    if (pathname === "/api/sair" && request.method === "POST") return this.sair(request);
    if (pathname === "/api/renomeada" && request.method === "POST") return this.renomeada(request);
    if (pathname === "/ws") return this.abrirSocket(request);
    if (pathname.startsWith("/api/conta/") && request.method === "POST") {
      return this.rotaDeConta(request, pathname.slice("/api/conta/".length));
    }
    if (pathname === "/api/contas" && request.method === "GET") return this.listarContas(request);
    const doMestre = /^\/api\/contas\/([^/]+)\/([a-z-]+)$/.exec(pathname);
    if (doMestre && request.method === "POST") {
      return this.acaoDoMestre(request, doMestre[1] ?? "", doMestre[2] ?? "");
    }
    if (pathname.startsWith("/teste/")) return this.rotaDeTeste(new URL(request.url));
    return new Response("Não encontrado", { status: 404 });
  }

  /** O login solto de desenvolvimento: só com MODO=teste (a escolha de usuário dos E2E antigos). */
  private async entrar(request: Request): Promise<Response> {
    if (!this.ehTeste) return new Response("Não encontrado", { status: 404 });
    let usuarioId: unknown;
    try {
      usuarioId = ((await request.json()) as { usuarioId?: unknown }).usuarioId;
    } catch {
      return json({ erro: "corpo inválido" }, 400);
    }
    if (typeof usuarioId !== "string") return json({ erro: "usuarioId obrigatório" }, 400);
    if (!this.estado.usuarios.some((u) => u.id === usuarioId)) {
      return json({ erro: "usuário desconhecido" }, 404);
    }
    if (this.marcarPresenteDeTeste(usuarioId)) this.difundirSnapshots();
    return this.comCookies(json({ ok: true }), [cookieDeTeste(usuarioId, this.mesaIdDe(request))]);
  }

  /** Sair: apaga a sessão no banco, fecha os sockets dela e apaga os cookies. */
  private async sair(request: Request): Promise<Response> {
    const token = lerCookie(request.headers.get("Cookie"), NOME_DO_COOKIE);
    if (token) {
      const quem = await this.identificar(request);
      await this.contas.sair(token);
      if (quem?.sessaoHash) this.fecharSockets((i) => i.sessaoHash === quem.sessaoHash, "saiu");
    }
    return this.comCookies(
      new Response(null, { status: 204 }),
      cookiesDeSaida(this.mesaIdDe(request), this.seguro(request)),
    );
  }

  /** O mestre mudou o nome da mesa (o Worker já conferiu e gravou no diretório): todos recebem o nome novo. */
  private async renomeada(request: Request): Promise<Response> {
    const { nome } = (await request.json().catch(() => ({}))) as { nome?: unknown };
    if (typeof nome !== "string" || nome.length < 1 || nome.length > 60) {
      return json({ erro: "nome_invalido" }, 400);
    }
    const texto = mensagem({ tipo: "mesa.renomeada", dados: { nome } });
    for (const ws of this.ctx.getWebSockets()) this.enviar(ws, texto);
    return json({ ok: true });
  }

  // --- Contas (C2) ------------------------------------------------------------------------------

  /** Fecha os sockets cuja identidade satisfaz `serve` (4001: o cliente volta à tela de entrada). */
  private fecharSockets(serve: (i: Identidade) => boolean, motivo: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      const i = this.identidadeDe(ws);
      if (!i || !serve(i)) continue;
      try {
        ws.close(4001, motivo);
      } catch {
        // já fechado
      }
    }
  }

  /** Grava e distribui vagas novas ou renomeadas: um snapshot novo para todos (a mesa nunca guarda conta). */
  private aplicarUsuarios(usuarios: Usuario[]): void {
    const mudadas = usuarios.filter((u) => {
      const antes = this.estado.usuarios.find((x) => x.id === u.id);
      return !antes || antes.nome !== u.nome || antes.cor !== u.cor || antes.papel !== u.papel;
    });
    if (mudadas.length === 0) return;
    this.banco.gravarUsuarios(mudadas);
    this.estado = { ...this.estado, usuarios };
    for (const ws of this.ctx.getWebSockets()) {
      const usuario = this.usuarioDe(ws);
      if (usuario) this.enviarSnapshot(ws, usuario);
    }
    this.difundirPresenca();
  }

  /** O resumo dos pedidos para os mestres conectados (e, se acabou de chegar um, qual). Sem dado de senha. */
  private avisarMestres(
    novo: { tipo: "entrada" | "redefinicao"; nome: string; login: string } | null,
  ): void {
    const texto = this.textoDoAvisoDeContas(novo);
    for (const ws of this.ctx.getWebSockets()) {
      if (this.usuarioDe(ws)?.papel === "mestre") this.enviar(ws, texto);
    }
  }

  private textoDoAvisoDeContas(
    novo: { tipo: "entrada" | "redefinicao"; nome: string; login: string } | null,
  ): string {
    return mensagem({ tipo: "contas.aviso", dados: { ...this.contas.pendencias(), novo } });
  }

  /** As rotas públicas e da própria conta: `conta/<acao>`. */
  private async rotaDeConta(request: Request, acao: string): Promise<Response> {
    const ip = this.ipDe(request);
    const agora = Date.now();
    const mesaId = this.mesaIdDe(request);
    const seguro = this.seguro(request);

    if (acao === "entrar") {
      const c = await this.lerCorpo(request, CorpoEntrarSchema);
      if (!c.ok) return c.resposta;
      const r = await this.contas.entrar(c.valor, ip, agora);
      if (!r.ok) return erroDeConta(r);
      return this.comCookies(json({ ok: true }), [cookieDeSessao(r.valor.token, mesaId, seguro)]);
    }

    if (acao === "pedir") {
      const c = await this.lerCorpo(request, CorpoPedirSchema);
      if (!c.ok) return c.resposta;
      const nome = nomeDeExibicaoValido(c.valor.nome);
      if (!nome) return erroDeConta({ ok: false, erro: "corpo_invalido" });
      const r = await this.contas.pedir({ ...c.valor, nome }, ip, agora);
      if (!r.ok) return erroDeConta(r);
      this.avisarMestres({ tipo: "entrada", nome, login: c.valor.login.trim().toLowerCase() });
      return json({ ok: true });
    }

    if (acao === "esqueci") {
      const c = await this.lerCorpo(request, CorpoEsqueciSchema);
      if (!c.ok) return c.resposta;
      const conta = this.contas.esqueci(c.valor.login.trim().toLowerCase(), ip, agora);
      if (conta) this.avisarMestres({ tipo: "redefinicao", nome: conta.nome, login: conta.login });
      // A resposta é a mesma existindo o login ou não.
      return json({ ok: true });
    }

    if (acao === "redefinir") {
      const c = await this.lerCorpo(request, CorpoRedefinirSchema);
      if (!c.ok) return c.resposta;
      const r = await this.contas.redefinir(c.valor, ip, agora);
      if (!r.ok) return erroDeConta(r);
      // As sessões antigas caem e os sockets delas também.
      this.fecharSockets((i) => i.contaId === r.valor.conta.id, "senha redefinida");
      this.avisarMestres(null);
      return this.comCookies(
        json({ ok: true }),
        r.valor.token ? [cookieDeSessao(r.valor.token, mesaId, seguro)] : [],
      );
    }

    if (acao === "tour-visto") {
      // O tour de introdução acabou (ou foi pulado): a conta não o vê sozinha de novo.
      const quem = await this.identificar(request);
      if (!quem?.conta) return erroDeConta({ ok: false, erro: "sem_sessao" });
      this.contas.marcarTourVisto(quem.conta.id);
      return json({ ok: true });
    }

    if (acao === "trocar-senha") {
      const quem = await this.identificar(request);
      if (!quem?.conta || !quem.sessaoHash) return erroDeConta({ ok: false, erro: "sem_sessao" });
      const c = await this.lerCorpo(request, CorpoTrocarSenhaSchema);
      if (!c.ok) return c.resposta;
      const r = await this.contas.trocarSenha(quem.conta.id, c.valor, quem.sessaoHash, ip, agora);
      if (!r.ok) return erroDeConta(r);
      const mantida = quem.sessaoHash;
      const conta = quem.conta.id;
      this.fecharSockets((i) => i.contaId === conta && i.sessaoHash !== mantida, "senha trocada");
      return json({ ok: true });
    }

    if (acao === "mestre-inicial") return this.criarMestreInicial(request, agora, mesaId, seguro);

    // --- C3: chave da pasta e código de recuperação ---------------------------------------------------

    if (acao === "chave") {
      const quem = await this.exigirMestre(request);
      if (quem instanceof Response) return quem;
      const c = await this.lerCorpo(request, CorpoChaveSchema);
      if (!c.ok) return c.resposta;
      const r = await this.contas.registrarChave(
        quem.conta?.id ?? "",
        c.valor.chavePublica,
        c.valor.senha,
        ip,
        agora,
      );
      if (!r.ok) return erroDeConta(r);
      return json({ ok: true });
    }

    if (acao === "codigo") {
      const quem = await this.exigirMestre(request);
      if (quem instanceof Response) return quem;
      const c = await this.lerCorpo(request, CorpoCodigoSchema);
      if (!c.ok) return c.resposta;
      const r = await this.contas.gerarNovoCodigo(quem.conta?.id ?? "", c.valor.senha, ip, agora);
      if (!r.ok) return erroDeConta(r);
      return json({ ok: true, codigo: r.valor.codigo });
    }

    if (acao === "recuperar/desafio") {
      const r = this.contas.emitirDesafio(ip, agora);
      if (!r.ok) return erroDeConta(r);
      return json(r.valor);
    }

    if (acao === "recuperar/pasta") {
      const c = await this.lerCorpo(request, CorpoRecuperarPastaSchema);
      if (!c.ok) return c.resposta;
      const r = await this.contas.recuperarPelaPasta({ ...c.valor, mesaId }, ip, agora);
      if (!r.ok) return erroDeConta(r);
      this.fecharSockets((i) => i.contaId === r.valor.conta.id, "acesso recuperado");
      return this.comCookies(json({ ok: true }), [cookieDeSessao(r.valor.token, mesaId, seguro)]);
    }

    if (acao === "recuperar/codigo") {
      const c = await this.lerCorpo(request, CorpoRecuperarCodigoSchema);
      if (!c.ok) return c.resposta;
      const r = await this.contas.recuperarPeloCodigo(c.valor, ip, agora);
      if (!r.ok) return erroDeConta(r);
      this.fecharSockets((i) => i.contaId === r.valor.conta.id, "acesso recuperado");
      // O código novo vai só nesta resposta (mostrado uma vez).
      return this.comCookies(json({ ok: true, codigo: r.valor.codigoNovo }), [
        cookieDeSessao(r.valor.token, mesaId, seguro),
      ]);
    }

    return new Response("Não encontrado", { status: 404 });
  }

  /**
   * A mesa legada (a campanha de antes das contas) ganha a conta do mestre, ligada à vaga `mestre` que
   * já existe. Só vale numa requisição local (o Worker marca) e só enquanto a mesa não tem mestre: na
   * internet uma mesa nunca fica sem dono.
   */
  private async criarMestreInicial(
    request: Request,
    agora: number,
    mesaId: string,
    seguro: boolean,
  ): Promise<Response> {
    if (request.headers.get(CABECALHO_LOCAL) !== "1") {
      return erroDeConta({ ok: false, erro: "so_local" });
    }
    const c = await this.lerCorpo(request, CorpoMestreInicialSchema);
    if (!c.ok) return c.resposta;
    const nome = nomeDeExibicaoValido(c.valor.nome);
    const vaga =
      this.estado.usuarios.find((u) => u.id === "mestre" && u.papel === "mestre") ??
      this.estado.usuarios.find((u) => u.papel === "mestre");
    if (!nome || !vaga) return erroDeConta({ ok: false, erro: "corpo_invalido" });
    const r = await this.contas.criarMestre({ ...c.valor, nome }, vaga.id, agora);
    if (!r.ok) return erroDeConta(r);
    this.aplicarUsuarios(this.estado.usuarios.map((u) => (u.id === vaga.id ? { ...u, nome } : u)));
    const token = await this.contas.abrirSessaoDe(r.valor.id, agora);
    // O código de recuperação da mesa legada nasce com a conta do mestre: mostrado uma vez.
    const codigo = await this.contas.gerarCodigo(r.valor.id);
    return this.comCookies(json({ ok: true, codigo }), [cookieDeSessao(token, mesaId, seguro)]);
  }

  /** O mestre (conta de mestre com sessão válida), ou a resposta de erro. */
  private async exigirMestre(request: Request): Promise<Quem | Response> {
    const quem = await this.identificar(request);
    if (!quem?.conta) return erroDeConta({ ok: false, erro: "sem_sessao" });
    if (quem.conta.papel !== "mestre") return erroDeConta({ ok: false, erro: "sem_permissao" });
    return quem;
  }

  private async listarContas(request: Request): Promise<Response> {
    const quem = await this.exigirMestre(request);
    if (quem instanceof Response) return quem;
    return json(this.contas.listarParaMestre(this.estado.usuarios));
  }

  /** `contas/<id>/aceitar|recusar|remover|vaga|liberar-redefinicao`: só o mestre. */
  private async acaoDoMestre(request: Request, contaId: string, acao: string): Promise<Response> {
    const quem = await this.exigirMestre(request);
    if (quem instanceof Response) return quem;
    const agora = Date.now();
    const alvo = this.contas.conta(contaId);
    if (!alvo) return erroDeConta({ ok: false, erro: "conta_inexistente" });

    if (acao === "aceitar") {
      const c = await this.lerCorpo(request, CorpoAceitarSchema);
      if (!c.ok) return c.resposta;
      if (alvo.status !== "pendente") return erroDeConta({ ok: false, erro: "sem_pedido" });
      const plano = planejarAceite(
        this.estado,
        this.contas.usuariosComContaAtiva(),
        c.valor.personagemId,
        proximoIdDeJogador(this.estado.usuarios),
      );
      if (plano.tipo === "erro") return erroDeConta({ ok: false, erro: plano.erro });
      const r = this.contas.aceitar(alvo.id, plano.usuarioId);
      if (!r.ok) return erroDeConta(r);
      this.ligarVaga(plano, alvo.nome, quem.usuarioId, agora);
      this.avisarMestres(null);
      return json({ ok: true });
    }

    if (acao === "recusar") {
      const r = this.contas.recusar(alvo.id, agora);
      if (!r.ok) return erroDeConta(r);
      this.fecharSockets((i) => i.contaId === alvo.id, "pedido recusado");
      this.avisarMestres(null);
      return json({ ok: true });
    }

    if (acao === "remover") {
      if (alvo.id === quem.conta?.id) return erroDeConta({ ok: false, erro: "conta_do_mestre" });
      const r = this.contas.remover(alvo.id);
      if (!r.ok) return erroDeConta(r);
      this.fecharSockets((i) => i.contaId === alvo.id, "conta removida");
      // O usuário dela some das listas (vira vaga escondida); fichas e tokens ficam para um novo aceite herdar.
      this.difundirSnapshots();
      this.avisarMestres(null);
      return json({ ok: true });
    }

    if (acao === "liberar-redefinicao") {
      const r = this.contas.liberarRedefinicao(alvo.id, agora);
      if (!r.ok) return erroDeConta(r);
      this.avisarMestres(null);
      return json({ ok: true });
    }

    return new Response("Não encontrado", { status: 404 });
  }

  /**
   * V7: a conta aceita vira membro. Vaga que já existe (escondida): ganha o nome da pessoa, e tokens, permissões
   * e histórico seguem com ela. Usuário novo: nome da pessoa e a próxima cor livre; se veio com uma "ficha dele"
   * sem dono, ele passa a ser dono dela.
   */
  private ligarVaga(plano: PlanoDeAceite, nome: string, mestreId: string, agora: number): void {
    if (plano.tipo === "erro") return;
    const existe = this.estado.usuarios.some((u) => u.id === plano.usuarioId);
    if (plano.tipo === "nova" && !existe) {
      const cor = this.proximaCorLivre();
      this.aplicarUsuarios([
        ...this.estado.usuarios,
        { id: plano.usuarioId, nome, papel: "jogador", cor },
      ]);
    } else {
      this.aplicarUsuarios(
        this.estado.usuarios.map((u) => (u.id === plano.usuarioId ? { ...u, nome } : u)),
      );
    }
    if (plano.tipo === "nova" && plano.fichaId !== undefined) {
      this.darFichaA(plano.usuarioId, plano.fichaId, mestreId, agora);
    }
    // A lista de membros mudou mesmo que nome e cor não (vaga escondida que já tinha o nome).
    this.difundirSnapshots();
  }

  private proximaCorLivre(): string {
    const usadas = new Set(this.estado.usuarios.map((u) => u.cor.toLowerCase()));
    return (
      CORES_DE_VAGA.find((c) => !usadas.has(c)) ??
      CORES_DE_VAGA[this.estado.usuarios.length % CORES_DE_VAGA.length] ??
      "#3cb44b"
    );
  }

  /** Põe o jogador como dono de uma ficha sem dono, pela mesma intenção que o mestre usa na ficha. */
  private darFichaA(usuarioId: string, fichaId: string, mestreId: string, agora: number): void {
    const ficha = this.estado.personagens.find((p) => p.id === fichaId);
    if (ficha?.editores.tipo !== "jogadores") return;
    const r = processar(
      this.estado,
      mestreId,
      {
        id: "aceite",
        tipo: "personagem.editar",
        dados: {
          id: fichaId,
          mudancas: { editores: { tipo: "jogadores", ids: [...ficha.editores.ids, usuarioId] } },
        },
      } as Intencao,
      new Date(agora).toISOString(),
    );
    if (!r.ok || r.eventos.length === 0) return;
    this.banco.salvarEventos(r.estado, r.eventos);
    const antes = this.estado;
    this.estado = r.estado;
    this.distribuir(r.eventos, r.snapshotPara, antes);
  }

  private async abrirSocket(request: Request): Promise<Response> {
    if (!pedeWebSocket(request)) return new Response("Esperava WebSocket", { status: 426 });
    const quem = await this.identificar(request);
    const usuario = quem && this.estado.usuarios.find((u) => u.id === quem.usuarioId);
    if (!quem || !usuario) return new Response("Não autenticado", { status: 401 });

    const par = new WebSocketPair();
    const [cliente, servidor] = [par[0], par[1]];
    // Hibernation API: o runtime cuida do socket; nunca usar servidor.accept().
    this.ctx.acceptWebSocket(servidor);
    const identidade: Identidade = {
      usuarioId: usuario.id,
      conexaoId: crypto.randomUUID(),
      ...(quem.conta && quem.sessaoHash
        ? { contaId: quem.conta.id, sessaoHash: quem.sessaoHash }
        : {}),
    };
    servidor.serializeAttachment(identidade);

    this.agenda.cancelar("presenca.expirar", usuario.id);
    if (usuario.papel === "mestre") this.agenda.cancelar("mestre.ausente", "");
    this.rolarDia();
    this.uso.conexoes++;
    this.banco.gravarUso(this.uso);

    // Com MODO=teste, entrar pelo cookie solto (sem passar por /api/entrar) também torna a vaga membro.
    if (!quem.conta && this.marcarPresenteDeTeste(usuario.id)) this.difundirSnapshots();
    this.enviarSnapshot(servidor, usuario);
    this.avisarPreparoA(servidor, usuario);
    if (usuario.papel === "mestre") {
      this.enviarProgresso();
      this.enviar(servidor, this.textoDoAvisoDeContas(null));
    }
    this.difundirPresenca();
    return new Response(null, { status: 101, webSocket: cliente });
  }

  /** Rotas que só existem com `MODO=teste` (E2E): nunca no `pnpm dev`. */
  private async rotaDeTeste(url: URL): Promise<Response> {
    const { pathname } = url;
    if (this.env.MODO !== "teste") return new Response("Não encontrado", { status: 404 });

    if (pathname === "/teste/zerar") {
      this.banco.apagarTudo();
      this.contas.apagarTudo();
      await this.ctx.storage.deleteAlarm();
      this.estado = estadoInicial(semente);
      this.fonteDeDadosDeTeste = null;
      this.taxaDoChat.clear();
      this.ultimoPing.clear();
      this.ultimoBotao.clear();
      this.banco.salvarTudo(this.estado);
      this.iniciarRelogio();
      this.uso = { dia: diaUtc(new Date()), mensagens: 0, conexoes: 0 };
      this.mensagensDesdeGravacaoDoUso = 0;
      this.mensagensDesdeEnvioDoUso = 0;
      this.transferencias.limpar();
      this.banco.descartarTodosOsPreparos();
      for (const ws of this.ctx.getWebSockets()) this.anterioresAoZerar.add(ws);
      // Quem já estava conectado continua membro (o login solto não se repete depois do reset).
      for (const ws of this.ctx.getWebSockets()) {
        const u = this.usuarioDe(ws);
        if (u && !this.identidadeDe(ws)?.contaId) this.marcarPresenteDeTeste(u.id);
      }
      for (const ws of this.ctx.getWebSockets()) {
        const usuario = this.usuarioDe(ws);
        if (usuario) this.enviarSnapshot(ws, usuario);
        else ws.close(4001, "usuário removido");
      }
      this.difundirPresenca();
      return json({ ok: true });
    }
    if (pathname === "/teste/avancar-relogio") {
      // Gancho de teste: adianta o relógio da sala em `ms` (tochas envelhecem sem esperar minutos
      // reais). Só existe com MODO=teste; nunca no `pnpm dev`.
      const ms = Number(url.searchParams.get("ms"));
      if (!Number.isFinite(ms) || ms < 0) return json({ erro: "ms inválido" }, 400);
      const antes = this.estado;
      this.estado = {
        ...antes,
        relogio: { ...antes.relogio, acumuladoMs: antes.relogio.acumuladoMs + ms },
      };
      this.banco.gravarRelogio(this.estado.relogio);
      await this.rodarTempo([]);
      for (const ws of this.ctx.getWebSockets()) {
        const usuario = this.usuarioDe(ws);
        if (usuario) this.enviarSnapshot(ws, usuario);
      }
      return json({ ok: true, salaMs: tempoDaSala(this.estado.relogio, Date.now()) });
    }
    if (pathname === "/teste/dados") {
      // Gancho de teste: a partir daqui os dados saem de uma sequência com semente fixa (reprodutível).
      // Sem `semente`, volta ao `crypto`. Só existe com MODO=teste; nunca no `pnpm dev`.
      const bruta = url.searchParams.get("semente");
      if (bruta === null) this.fonteDeDadosDeTeste = null;
      else {
        const n = Number(bruta);
        if (!Number.isInteger(n)) return json({ erro: "semente inválida" }, 400);
        this.fonteDeDadosDeTeste = fonteComSemente(n);
      }
      return json({ ok: true });
    }
    if (pathname === "/teste/reiniciar-sala") {
      // Esquece a memória e derruba os sockets, como um reinício do processo. O estado volta do SQLite.
      this.ctx.abort("reinício pedido pelo teste");
      return json({ ok: true });
    }
    return new Response("Não encontrado", { status: 404 });
  }

  // --- WebSocket (Hibernation) ----------------------------------------------------------------

  override async webSocketMessage(ws: WebSocket, bruta: string | ArrayBuffer): Promise<void> {
    await this.contarMensagem();

    const usuario = this.usuarioDe(ws);
    if (!usuario) {
      ws.close(4001, "usuário removido");
      return;
    }

    // Frame binário: só pedaço de arquivo, só de quem a sala pediu; o resto some em silêncio.
    if (typeof bruta !== "string") {
      this.tratarPedaco(ws, bruta);
      return;
    }

    const lida = lerIntencao(bruta);
    if (!lida.ok) {
      this.erro(ws, idDoPedido(bruta), "mensagem_invalida", lida.motivo);
      return;
    }
    const intencao = lida.valor;

    // No máximo 10 mensagens de chat por segundo por conexão; o resto é recusado com aviso.
    if (INTENCOES_DE_CHAT.has(intencao.tipo)) {
      const taxa = registrarMensagem(this.taxaDoChat.get(ws) ?? [], Date.now());
      this.taxaDoChat.set(ws, taxa.historico);
      if (!taxa.ok) {
        this.erro(
          ws,
          intencao.id,
          "muitas_mensagens",
          `Devagar: no máximo ${LIMITES_DO_CHAT.porSegundo} mensagens por segundo.`,
        );
        return;
      }
    }

    // Botão liberado (7b-3): um disparo a cada 2 s por jogador; o que passa disso é recusado com aviso. Só o pedido
    // aceito conta no limite (o recusado não muda nada na mesa).
    const limitaBotao = intencao.tipo === "botao.usar" && usuario.papel !== "mestre";
    if (limitaBotao && !botaoDentroDoLimite(this.ultimoBotao.get(usuario.id), Date.now())) {
      this.erro(
        ws,
        intencao.id,
        "muitas_mensagens",
        `Devagar: um botão a cada ${INTERVALO_MINIMO_DO_BOTAO_MS / 1000} segundos.`,
      );
      return;
    }

    // Rascunho de desenho: o que chega rápido demais é descartado em silêncio (o próximo cobre).
    if (intencao.tipo === "desenho.rascunho" && intencao.dados.desenho !== null) {
      const agora = Date.now();
      if (!rascunhoDentroDoLimite(this.ultimoRascunho.get(ws), agora)) return;
      this.ultimoRascunho.set(ws, agora);
    }

    const agoraMs = Date.now();
    this.apagadosRecentes = this.apagadosRecentes.filter(
      (a) => agoraMs - a.emMs <= PRAZO_PARA_RESTAURAR_TOKEN_MS,
    );
    const r = processar(
      this.estado,
      usuario.id,
      intencao,
      new Date(agoraMs).toISOString(),
      this.fonteDeDadosDeTeste ?? undefined,
      this.apagadosRecentes,
    );
    if (r.ok && limitaBotao) this.ultimoBotao.set(usuario.id, agoraMs);
    if (r.ok && r.apagado) this.apagadosRecentes.push({ ...r.apagado, emMs: agoraMs });
    if (r.ok && intencao.tipo === "token.restaurar") {
      this.apagadosRecentes = this.apagadosRecentes.filter((a) => a.token.id !== intencao.dados.id);
    }
    if (!r.ok) {
      this.erro(ws, intencao.id, r.erro.codigo, r.erro.mensagem);
      // Soltou do outro lado de uma parede: quem viu o arraste ao vivo volta o token para onde ele está.
      if (intencao.tipo === "token.soltar" && r.erro.codigo === "trajeto_bloqueado") {
        this.marcarArraste(ws, intencao.dados.id, false);
        const token = this.estado.tokens.find((t) => t.id === intencao.dados.id);
        if (token) this.repassarMovimento(ws, { id: token.id, x: token.x, y: token.y });
      }
      return;
    }

    // Só a importação reescreve tudo. Levar o grupo e mudar quem vê uma pasta também mandam snapshot
    // a todos, mas gravam só o que os eventos mudaram.
    if (intencao.tipo === "campanha.importar") {
      this.banco.salvarTudo(r.estado);
      // As contas ficam (a exportação nunca as leva); a que apontava para uma vaga que sumiu fica sem vaga.
      this.contas.desligarVagasQueSumiram(new Set(r.estado.usuarios.map((u) => u.id)));
    } else if (r.eventos.length > 0) this.banco.salvarEventos(r.estado, r.eventos);
    const antes = this.estado;
    // O histórico do chat mora no banco: o estado em memória nunca o acumula.
    const { chat: _historico, ...semChat } = r.estado;
    this.estado =
      intencao.tipo === "campanha.importar"
        ? { ...semChat, retratosDoChat: this.banco.retratosDoChat() }
        : semChat;
    if (intencao.tipo === "chat.anteriores") {
      const pagina = this.chatVisivelPara(
        usuario,
        intencao.dados.antesDoSeq,
        LIMITES_DO_CHAT.porPagina,
      );
      this.enviar(ws, mensagem({ tipo: "chat.anteriores", dados: pagina }));
      return;
    }
    this.cuidarDeAsset(ws, usuario, intencao);
    this.cuidarDePreparo(intencao, r.preparo);
    if (r.eventos.length > 0 || intencao.tipo === "campanha.importar") await this.reagendarLuzes();

    // Ping (V12): transitório, não grava; vai a quem vê a cena, inclusive a quem pingou.
    if (r.ping) {
      this.repassarPing(usuario.id, r.ping);
      return;
    }

    // Rascunho: transitório, não grava; só quem recebe a cena o recebe (menos o remetente).
    if (r.rascunho) {
      this.repassarRascunho(ws, r.rascunho);
      return;
    }
    if (intencao.tipo === "desenho.criar")
      this.rascunhos.get(ws)?.delete(intencao.dados.desenho.id);

    // Movimento ao vivo: transitório, não grava; só quem pode ver o token recebe (menos o remetente).
    if (r.movendo) {
      this.marcarArraste(ws, r.movendo.id, true);
      this.repassarMovimento(ws, r.movendo);
      return;
    }
    if (intencao.tipo === "token.soltar") this.marcarArraste(ws, intencao.dados.id, false);

    if (r.exportacao) {
      this.enviar(
        ws,
        mensagem({
          tipo: "exportacao",
          dados: { idPedido: intencao.id, exportacao: r.exportacao },
        }),
      );
    }

    // As chaves do preparo chegam antes do snapshot: o cliente já sabe que vai decifrar, não baixar.
    if (r.grupoMovido) this.entregarChaves(r.grupoMovido.cenaId);
    this.distribuir(r.eventos, r.snapshotPara, antes);
    if (r.snapshotPara === "todos" || r.snapshotPara.length > 0) this.difundirPresenca();
  }

  override webSocketClose(ws: WebSocket, codigo: number, motivo: string): void {
    // Códigos reservados (ex.: 1005/1006) não podem ser enviados no close.
    try {
      ws.close(codigo >= 1000 && codigo <= 1003 ? codigo : 1000, motivo);
    } catch {
      // já fechado
    }
    void this.aoSair(ws);
  }

  override webSocketError(ws: WebSocket, _erro: unknown): void {
    try {
      ws.close(1011, "erro");
    } catch {
      // já fechado
    }
    void this.aoSair(ws);
  }

  private async aoSair(ws: WebSocket): Promise<void> {
    this.desfazerArrastes(ws);
    this.encerrarRascunhos(ws);
    this.ultimoRascunho.delete(ws);
    this.taxaDoChat.delete(ws);
    const identidade = this.identidadeDe(ws);
    if (!identidade) return;
    this.banco.limparPosse(identidade.conexaoId);
    this.transferencias.conexaoSaiu(identidade.conexaoId);
    this.enviarProgresso();
    if (!this.estaOnline(identidade.usuarioId, ws)) {
      await this.agenda.agendar(
        "presenca.expirar",
        identidade.usuarioId,
        Date.now() + TEMPO_RECONECTANDO_MS,
      );
    }
    this.difundirPresenca(ws);
    // Era o último mestre: a mesa pausa sozinha (retomar é do mestre, quando voltar).
    if (
      this.usuarioDe(ws)?.papel === "mestre" &&
      !this.anterioresAoZerar.has(ws) &&
      !this.estado.relogio.pausada &&
      this.mestresConectados(ws) === 0
    ) {
      const saiuEm = Date.now();
      await this.agenda.agendar("mestre.ausente", "", saiuEm + ESPERA_DA_PAUSA_MS, { saiuEm });
    }
  }

  /** Quantos mestres seguem conectados (sem contar `ignorar`, o socket que está saindo). */
  private mestresConectados(ignorar?: WebSocket): number {
    return this.ctx
      .getWebSockets()
      .filter(
        (s) =>
          s !== ignorar && s.readyState === WebSocket.OPEN && this.usuarioDe(s)?.papel === "mestre",
      ).length;
  }

  /**
   * Mesa rodando e nenhum mestre conectado: pausa no tempo da sala de `emMs` (a hora da saída; ao acordar,
   * agora), com o mesmo evento da pausa manual, para quem está conectado ver na hora. A conta é feita pelos sockets que sobraram, não por
   * um contador em memória: a sala pode hibernar.
   */
  private async pausarSeSemMestre(emMs = Date.now()): Promise<void> {
    const r = pausarSeSemMestre(
      this.estado,
      new Date(emMs).toISOString(),
      this.mestresConectados(),
    );
    if (!r.ok || r.eventos.length === 0) return;
    this.banco.salvarEventos(r.estado, r.eventos);
    const antes = this.estado;
    this.estado = r.estado;
    await this.reagendarLuzes();
    this.distribuir(r.eventos, r.snapshotPara, antes);
  }

  // --- Alarme (agendador único) ---------------------------------------------------------------

  override async alarm(): Promise<void> {
    if (!this.criada) return;
    const vencidos = this.agenda.tomarVencidos(Date.now());
    const marcos: string[] = [];
    let automacao = false;
    for (const v of vencidos) {
      if (v.tipo === "presenca.expirar") this.difundirPresenca();
      else if (v.tipo === "uso.enviar") this.enviarUso();
      else if (v.tipo === "mestre.ausente") {
        const saiuEm = (v.dados as { saiuEm?: number }).saiuEm;
        await this.pausarSeSemMestre(typeof saiuEm === "number" ? saiuEm : Date.now());
      } else if (v.tipo === "luz.marco") marcos.push(v.chave);
      else if (v.tipo === "automacao.marco") automacao = true;
    }
    if (marcos.length > 0 || automacao) await this.rodarTempo(marcos);
    await this.agenda.reprogramar();
  }

  // --- Relógio da sala e vencimento das luzes -------------------------------------------------

  /** Mesa rodando sem instante de partida (banco antigo, campanha nova): começa a contar agora. */
  private iniciarRelogio(): void {
    const r = this.estado.relogio;
    if (r.pausada || r.desdeReal !== undefined) return;
    this.estado = { ...this.estado, relogio: { ...r, desdeReal: Date.now() } };
    this.banco.gravarRelogio(this.estado.relogio);
  }

  /**
   * O tempo passou: a intenção INTERNA do sistema (nenhum cliente a alcança) consome o que acabou,
   * tira modificadores vencidos e reenvia os objetos cujo marco (estágio) venceu. Depois reagenda.
   */
  private async rodarTempo(marcos: string[]): Promise<void> {
    const r = processarSistema(
      this.estado,
      new Date().toISOString(),
      marcos,
      this.fonteDeDadosDeTeste ?? undefined,
    );
    if (r.ok && r.eventos.length > 0) {
      this.banco.salvarEventos(r.estado, r.eventos);
      const antes = this.estado;
      this.estado = r.estado;
      this.distribuir(r.eventos, [], antes);
    }
    await this.reagendarLuzes();
  }

  /**
   * Um vencimento por objeto (o próximo marco: mudar de estágio, acabar, vencer um modificador),
   * em tempo real. Pausada, tudo é cancelado; ao retomar, reagenda a partir do que sobrou.
   */
  private async reagendarLuzes(): Promise<void> {
    for (const chave of this.agenda.chaves("luz.marco")) this.agenda.cancelar("luz.marco", chave);
    const relogio = this.estado.relogio;
    if (!relogio.pausada) {
      const agora = Date.now();
      const sala = tempoDaSala(relogio, agora);
      for (const l of this.estado.luzes) {
        const ms = proximoMarcoDoObjeto(l, sala, this.estado.config.estagios);
        if (ms !== null) await this.agenda.agendar("luz.marco", l.id, agora + Math.ceil(ms) + 5);
      }
    }
    // 7b-1: um vencimento só para as automações (a próxima fase de ciclo, evento pendente ou fim de efeito).
    this.agenda.cancelar("automacao.marco", "proximo");
    if (!relogio.pausada) {
      const agora = Date.now();
      const ms = proximoMarcoDasAutomacoes(this.estado, tempoDaSala(relogio, agora));
      if (ms !== null)
        await this.agenda.agendar("automacao.marco", "proximo", agora + Math.ceil(ms) + 5);
    }
    await this.agenda.reprogramar();
  }

  // --- Presença -------------------------------------------------------------------------------

  private estaOnline(usuarioId: string, ignorar?: WebSocket): boolean {
    return this.ctx
      .getWebSockets()
      .some(
        (s) =>
          s !== ignorar &&
          s.readyState === WebSocket.OPEN &&
          this.identidadeDe(s)?.usuarioId === usuarioId,
      );
  }

  private presenca(ignorar?: WebSocket): Record<string, Presenca> {
    const reconectando = new Set(this.agenda.chaves("presenca.expirar"));
    const resultado: Record<string, Presenca> = {};
    for (const u of this.estado.usuarios) {
      if (this.estaOnline(u.id, ignorar)) resultado[u.id] = "online";
      else resultado[u.id] = reconectando.has(u.id) ? "reconectando" : "offline";
    }
    return resultado;
  }

  private difundirPresenca(ignorar?: WebSocket): void {
    const texto = mensagem({ tipo: "presenca", dados: { usuarios: this.presenca(ignorar) } });
    for (const ws of this.ctx.getWebSockets()) if (ws !== ignorar) this.enviar(ws, texto);
  }

  // --- Contador de uso ------------------------------------------------------------------------

  private rolarDia(): void {
    const hoje = diaUtc(new Date());
    if (this.uso.dia !== hoje) {
      this.uso = { dia: hoje, mensagens: 0, conexoes: 0 };
      this.mensagensDesdeGravacaoDoUso = 0;
      this.banco.gravarUso(this.uso);
    }
  }

  private async contarMensagem(): Promise<void> {
    this.rolarDia();
    this.uso.mensagens++;
    // Gravação agrupada: a cada lote de mensagens (a perda máxima num reinício é um lote).
    if (++this.mensagensDesdeGravacaoDoUso >= MENSAGENS_POR_LOTE_DE_USO) {
      this.mensagensDesdeGravacaoDoUso = 0;
      this.banco.gravarUso(this.uso);
    }
    // Envio aos mestres: no máximo a cada 5 s ou a cada lote; senão fica para o agendador.
    const agora = Date.now();
    if (
      ++this.mensagensDesdeEnvioDoUso >= MENSAGENS_POR_LOTE_DE_USO ||
      agora - this.ultimoEnvioDoUso >= INTERVALO_USO_MS
    ) {
      this.enviarUso();
    } else if (!this.agenda.existe("uso.enviar", "uso")) {
      await this.agenda.agendar("uso.enviar", "uso", this.ultimoEnvioDoUso + INTERVALO_USO_MS);
    }
  }

  private textoDoUso(): string {
    const { dia, mensagens, conexoes } = this.uso;
    return mensagem({ tipo: "uso", dados: calcularUso(dia, mensagens, conexoes) });
  }

  private enviarUso(): void {
    this.ultimoEnvioDoUso = Date.now();
    this.mensagensDesdeEnvioDoUso = 0;
    this.agenda.cancelar("uso.enviar", "uso");
    const texto = this.textoDoUso();
    for (const ws of this.ctx.getWebSockets()) {
      if (this.usuarioDe(ws)?.papel === "mestre") this.enviar(ws, texto);
    }
  }

  // --- Arquivos (assets) ----------------------------------------------------------------------

  private conexoesAbertas(): { conexaoId: string; ws: WebSocket }[] {
    const abertas: { conexaoId: string; ws: WebSocket }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const identidade = this.identidadeDe(ws);
      if (identidade && ws.readyState === WebSocket.OPEN) {
        abertas.push({ conexaoId: identidade.conexaoId, ws });
      }
    }
    return abertas;
  }

  /**
   * Conexões online com cópia do asset, na ordem em que anunciaram. Só serve quem pode **ver** o
   * asset agora: senão um jogador que anunciasse o hash da imagem de um token oculto seria chamado
   * para enviá-la (e descobriria que ela está em uso).
   */
  private candidatosA(hash: string) {
    const abertas = new Set(this.conexoesAbertas().map((c) => c.conexaoId));
    const candidatos = [];
    for (const p of this.banco.possesDe(hash)) {
      if (!abertas.has(p.conexao)) continue;
      const usuario = this.estado.usuarios.find((u) => u.id === p.usuario);
      if (!usuario || !assetVisivelPara(hash, this.estado, usuario)) continue;
      candidatos.push({ conexaoId: p.conexao, usuarioId: usuario.id, papel: usuario.papel });
    }
    return candidatos;
  }

  private enviarA(conexaoId: string, dados: string | ArrayBuffer): void {
    const alvo = this.conexoesAbertas().find((c) => c.conexaoId === conexaoId);
    if (!alvo) return;
    try {
      alvo.ws.send(dados);
    } catch {
      // socket fechando: o webSocketClose cuida
    }
  }

  /** Frame binário de pedaço: a coordenação decide se vale (pedido àquele socket) e repassa. */
  private tratarPedaco(ws: WebSocket, bruto: ArrayBuffer): void {
    const frame = lerFrameDePedaco(bruto);
    const identidade = this.identidadeDe(ws);
    if (!frame || !identidade) return;
    this.transferencias.frame(identidade.conexaoId, frame, bruto);
  }

  /** O vaivém de arquivos que não muda o estado (`processar` já conferiu quem pode). */
  private cuidarDeAsset(ws: WebSocket, usuario: Usuario, intencao: Intencao): void {
    const identidade = this.identidadeDe(ws);
    if (!identidade) return;
    const conexaoId = identidade.conexaoId;
    // Posse só vale para asset que a pessoa vê (o mesmo filtro vale na hora de escolher quem serve).
    const conhecido = (hash: string) => assetVisivelPara(hash, this.estado, usuario);
    switch (intencao.tipo) {
      case "asset.pedir": {
        const { hash, faltam } = intencao.dados;
        const meta = this.estado.assets?.find((a) => a.hash === hash);
        // Sigilo: asset que a pessoa não vê responde igual a asset que não existe.
        if (!meta || !assetVisivelPara(hash, this.estado, usuario)) {
          this.erro(ws, intencao.id, "asset_inexistente", "Arquivo não encontrado.");
          return;
        }
        this.enviar(ws, mensagem({ tipo: "asset.meta", dados: { meta } }));
        const total = meta.pedacos.length;
        if (total === 0) return; // manifesto de mapa: não há bytes, só os tiles
        const indices = faltam ?? Array.from({ length: total }, (_, i) => i);
        this.transferencias.pedir(conexaoId, hash, total, meta.donoId, indices);
        return;
      }
      case "asset.inventario": {
        const hashes = intencao.dados.hashes.filter(conhecido);
        this.banco.substituirPosse(conexaoId, usuario.id, hashes);
        for (const h of hashes) this.transferencias.posseMudou(h);
        return;
      }
      case "asset.tenho": {
        const { hash } = intencao.dados;
        if (!conhecido(hash)) return;
        this.banco.adicionarPosse(conexaoId, usuario.id, hash);
        this.transferencias.posseMudou(hash);
        return;
      }
      case "asset.naoTenho": {
        const { hash } = intencao.dados;
        this.banco.removerPosse(conexaoId, hash);
        this.transferencias.naoTem(conexaoId, hash);
        return;
      }
    }
  }

  // --- Preparo cifrado de cenas ---------------------------------------------------------------

  /**
   * Guarda um preparo (`cena.preparar`) e avisa os jogadores para baixarem os arquivos cifrados;
   * descarta os preparos de cena apagada e os de uma campanha importada (os arquivos cifrados
   * deixaram de existir).
   */
  private cuidarDePreparo(
    intencao: Intencao,
    preparo: { cenaId: string; pacotes: Pacote[] } | undefined,
  ): void {
    if (intencao.tipo === "campanha.importar") {
      this.banco.descartarTodosOsPreparos();
      this.enviarProgresso(true);
    }
    if (intencao.tipo === "cena.apagar") {
      this.banco.descartarPreparos(intencao.dados.cenaId);
      this.enviarProgresso(true);
    }
    if (preparo) {
      this.banco.guardarPreparo(preparo.cenaId, preparo.pacotes);
      for (const ws of this.ctx.getWebSockets()) {
        const usuario = this.usuarioDe(ws);
        if (usuario) this.avisarPreparoA(ws, usuario);
      }
    }
    if (
      preparo ||
      intencao.tipo === "asset.tenho" ||
      intencao.tipo === "asset.naoTenho" ||
      intencao.tipo === "asset.inventario"
    ) {
      this.enviarProgresso();
    }
  }

  /** O jogador baixa o que está preparado (hashes dos arquivos cifrados; nada sobre a cena). */
  private avisarPreparoA(ws: WebSocket, usuario: Usuario): void {
    if (usuario.papel !== "jogador") return;
    const hashes = [...new Set(this.banco.preparos().map((p) => p.hashCifrado))];
    if (hashes.length > 0)
      this.enviar(ws, mensagem({ tipo: "preparo.disponivel", dados: { hashes } }));
  }

  /** Só mestres: quantos jogadores já têm todos os pacotes de cada preparo. */
  private enviarProgresso(descartou = false): void {
    const preparos = this.banco.preparos();
    // Sem preparo nada a contar; só avisa a lista vazia quando um preparo acabou de ser descartado.
    if (preparos.length === 0 && !descartou) return;
    const membros = new Set(this.membrosIds());
    const jogadores = this.estado.usuarios.filter(
      (u) => u.papel === "jogador" && membros.has(u.id),
    );
    const quemTem = new Map<string, Set<string>>();
    const donosDe = (hash: string) => {
      let s = quemTem.get(hash);
      if (!s) {
        s = new Set(this.banco.possesDe(hash).map((p) => p.usuario));
        quemTem.set(hash, s);
      }
      return s;
    };
    const porCena = new Map<string, typeof preparos>();
    for (const p of preparos) porCena.set(p.cenaId, [...(porCena.get(p.cenaId) ?? []), p]);
    const texto = mensagem({
      tipo: "preparo.progresso",
      dados: {
        preparos: [...porCena].map(([cenaId, pacotes]) => ({
          cenaId,
          hashesOriginais: pacotes.map((p) => p.hashOriginal),
          completos: jogadores.filter((j) => pacotes.every((p) => donosDe(p.hashCifrado).has(j.id)))
            .length,
          jogadores: jogadores.length,
        })),
      },
    });
    for (const ws of this.ctx.getWebSockets()) {
      if (this.usuarioDe(ws)?.papel === "mestre") this.enviar(ws, texto);
    }
  }

  /**
   * O grupo foi para a cena: cada jogador recebe as chaves só dos pacotes cujo original ele passa a
   * ver no estado novo (o que está oculto na cena não tem chave para ninguém). Depois da ida os
   * preparos daquela cena são descartados.
   */
  private entregarChaves(cenaId: string): void {
    const pacotes = this.banco.preparos().filter((p) => p.cenaId === cenaId);
    if (pacotes.length > 0) {
      for (const ws of this.ctx.getWebSockets()) {
        const usuario = this.usuarioDe(ws);
        if (usuario?.papel !== "jogador") continue;
        const seus = pacotes
          .filter((p) => assetVisivelPara(p.hashOriginal, this.estado, usuario))
          .map(({ hashCifrado, hashOriginal, chave }) => ({ hashCifrado, hashOriginal, chave }));
        if (seus.length > 0)
          this.enviar(ws, mensagem({ tipo: "preparo.chaves", dados: { pacotes: seus } }));
      }
    }
    this.banco.descartarPreparos(cenaId);
    this.enviarProgresso(true);
  }

  // --- Envio ----------------------------------------------------------------------------------

  private identidadeDe(ws: WebSocket): Identidade | null {
    return (ws.deserializeAttachment() as Identidade | null) ?? null;
  }

  private usuarioDe(ws: WebSocket): Usuario | null {
    const id = this.identidadeDe(ws)?.usuarioId;
    return this.estado.usuarios.find((u) => u.id === id) ?? null;
  }

  private enviar(ws: WebSocket, texto: string): void {
    try {
      ws.send(texto);
    } catch {
      // socket já fechando: o webSocketClose cuida da presença
    }
  }

  private erro(ws: WebSocket, idPedido: string | null, codigo: CodigoDeErro, texto: string): void {
    this.enviar(ws, mensagem({ tipo: "erro", dados: { idPedido, codigo, mensagem: texto } }));
  }

  /**
   * As mensagens mais novas (e mais antigas que `antesDoSeq`, se vier) que ESTE usuário pode ver, em
   * ordem de `seq`. Lê o histórico em páginas e filtra: sussurro e rolagem oculta de outros nunca
   * entram, nem contam no limite. `temMais`: há mensagens visíveis ainda mais antigas.
   */
  private chatVisivelPara(
    usuario: Usuario,
    antesDoSeq: number | null,
    quantas: number,
  ): { mensagens: Mensagem[]; temMais: boolean } {
    const achadas: Mensagem[] = [];
    let corte = antesDoSeq;
    for (;;) {
      const pagina = this.banco.chatAntes(corte, PAGINA_DO_HISTORICO);
      for (const m of pagina) {
        const visto = mensagemParaUsuario(m, usuario, this.estado.config);
        if (visto) achadas.push(visto);
        if (achadas.length > quantas) break;
      }
      const ultima = pagina[pagina.length - 1];
      if (achadas.length > quantas || pagina.length < PAGINA_DO_HISTORICO || !ultima) break;
      corte = ultima.seq;
    }
    return {
      mensagens: achadas.slice(0, quantas).reverse(),
      temMais: achadas.length > quantas,
    };
  }

  private enviarSnapshot(ws: WebSocket, usuario: Usuario): void {
    const { mensagens } = this.chatVisivelPara(usuario, null, LIMITES_DO_CHAT.noSnapshot);
    this.enviar(
      ws,
      mensagem({
        tipo: "snapshot",
        dados: {
          usuarioId: usuario.id,
          estado: {
            ...visaoPara({ ...this.estado, chat: mensagens }, usuario, Date.now()),
            membros: this.membrosIds(),
          },
        },
      }),
    );
    if (usuario.papel === "mestre") this.enviar(ws, this.textoDoUso());
  }

  private marcarArraste(ws: WebSocket, id: string, ativo: boolean): void {
    const ids = this.arrastes.get(ws) ?? new Set<string>();
    if (ativo) ids.add(id);
    else ids.delete(id);
    if (ids.size > 0) this.arrastes.set(ws, ids);
    else this.arrastes.delete(ws);
  }

  /**
   * Quem caiu no meio de um arraste nunca vai mandar o `token.soltar`: os outros voltam o token
   * para a posição gravada (senão ficariam vendo uma posição que não existe na sala).
   */
  private desfazerArrastes(ws: WebSocket): void {
    const ids = this.arrastes.get(ws);
    if (!ids) return;
    this.arrastes.delete(ws);
    for (const id of ids) {
      const token = this.estado.tokens.find((t) => t.id === id);
      if (token) this.repassarMovimento(ws, { id, x: token.x, y: token.y });
    }
  }

  /** Quem caiu no meio de um traço nunca vai cancelar: os outros apagam o rascunho dele. */
  private encerrarRascunhos(ws: WebSocket): void {
    const abertos = this.rascunhos.get(ws);
    if (!abertos) return;
    this.rascunhos.delete(ws);
    for (const id of abertos.keys()) this.repassarRascunho(ws, { fimId: id }, abertos);
  }

  /**
   * `desenho.rascunhando` / `desenho.rascunhoFim`: vai a quem recebe a cena do desenho (o mestre, ou o
   * jogador com a cena ativa), nunca ao remetente. `abertos` só é passado ao encerrar um socket.
   */
  private repassarRascunho(
    remetente: WebSocket,
    r: RascunhoRepassado,
    abertos?: Map<string, string>,
  ): void {
    const meus = abertos ?? this.rascunhos.get(remetente) ?? new Map<string, string>();
    let cenaId: string | undefined;
    let texto: string;
    if ("desenho" in r) {
      // Um traço de cada vez por mão: o resto é lixo (cliente bugado) e não ocupa memória.
      if (!meus.has(r.desenho.id) && meus.size >= 16) return;
      meus.set(r.desenho.id, r.desenho.cenaId);
      this.rascunhos.set(remetente, meus);
      cenaId = r.desenho.cenaId;
      texto = mensagem({ tipo: "desenho.rascunhando", dados: { desenho: r.desenho } });
    } else {
      cenaId = meus.get(r.fimId);
      if (cenaId === undefined) return;
      meus.delete(r.fimId);
      texto = mensagem({ tipo: "desenho.rascunhoFim", dados: { id: r.fimId } });
    }
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === remetente) continue;
      const usuario = this.usuarioDe(ws);
      if (usuario && desenhoVisivelPara(cenaId, usuario, this.estado.cenaAtivaId)) {
        this.enviar(ws, texto);
      }
    }
  }

  /**
   * `mapa.pingado`: o limite de frequência é por usuário (o que passa do limite some em silêncio; a centralização que
   * passa do limite vira só um ping). Vai a todo mestre e aos jogadores da cena do grupo, inclusive a quem pingou.
   */
  private repassarPing(usuarioId: string, ping: PingRepassado): void {
    const limite = limitarPing(this.ultimoPing.get(usuarioId), Date.now(), ping.centralizar);
    if (!limite) return;
    this.ultimoPing.set(usuarioId, limite.proximo);
    const texto = mensagem({
      tipo: "mapa.pingado",
      dados: { ...ping, centralizar: limite.centralizar },
    });
    for (const ws of this.ctx.getWebSockets()) {
      const alvo = this.usuarioDe(ws);
      if (alvo && pingVisivelPara(ping.cenaId, alvo, this.estado.cenaAtivaId))
        this.enviar(ws, texto);
    }
  }

  /** `token.movendo`: vai a quem pode ver o token, nunca ao remetente. */
  private repassarMovimento(remetente: WebSocket, mov: { id: string; x: number; y: number }): void {
    const token = this.estado.tokens.find((t) => t.id === mov.id);
    if (!token) return;
    const texto = mensagem({ tipo: "token.movendo", dados: mov });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === remetente) continue;
      const usuario = this.usuarioDe(ws);
      if (usuario && tokenVisivelPara(token, usuario, this.estado.cenaAtivaId)) {
        this.enviar(ws, texto);
      }
    }
  }

  /** Entrega cada evento (filtrado por usuário) ou, para quem pede, um snapshot novo. */
  private distribuir(eventos: EventoSala[], snapshotPara: "todos" | string[], antes: Estado): void {
    const agoraMs = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const usuario = this.usuarioDe(ws);
      if (!usuario) {
        ws.close(4001, "usuário removido");
        continue;
      }
      if (snapshotPara === "todos" || snapshotPara.includes(usuario.id)) {
        this.enviarSnapshot(ws, usuario);
        continue;
      }
      for (const ev of eventos) {
        const visto = eventoPara(ev, usuario, antes, this.estado, agoraMs);
        if (visto) this.enviar(ws, mensagem({ tipo: "evento", dados: visto }));
      }
    }
  }
}
