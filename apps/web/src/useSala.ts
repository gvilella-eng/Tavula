import {
  type AvisoDeContas,
  type CodigoDeErro,
  type Desenho,
  type EnvioPendente,
  type Estado,
  type EventoSala,
  type Exportacao,
  IntencaoSchema,
  LIMITES_DO_CHAT,
  lerMensagemDaSala,
  type MensagemDaSala,
  type PingRepassado,
  type Presenca,
  reduzir,
  type SomTocando,
  type Uso,
  VERSAO_PROTOCOLO,
} from "@tabletop/shared";
import { useCallback, useEffect, useRef, useState } from "react";

/** Como anda o preparo de uma cena (só o mestre recebe). */
export type ProgressoDePreparo = Extract<
  MensagemDaSala,
  { tipo: "preparo.progresso" }
>["dados"]["preparos"][number];

/** 12-1: um lote recente do Claude do próprio usuário (o diário do "Desfazer"). */
export type LoteDoClaude = Extract<
  MensagemDaSala,
  { tipo: "claude.lotes" }
>["dados"]["lotes"][number];

export type StatusConexao = "conectando" | "conectado" | "reconectando";

/** Algo que a sala contou e que os componentes (campos com rascunho) querem acompanhar. */
export type Ocorrencia =
  | { tipo: "evento"; evento: EventoSala }
  | { tipo: "movendo"; id: string; x: number; y: number }
  /** Traço em andamento de outra pessoa (Lote 13) e o fim dele (soltou, cancelou ou saiu). */
  | { tipo: "rascunho"; desenho: Desenho }
  | { tipo: "rascunhoFim"; id: string }
  /** V12: um ping de alguém (ou meu) na cena; efêmero, só o mapa o usa. */
  | { tipo: "ping"; ping: PingRepassado }
  /** N5: os sons de zona que este jogador ouve agora (a lista vazia manda parar); só o jogador os recebe. */
  | { tipo: "somDaZona"; sons: SomTocando[] }
  | { tipo: "conectado" }
  /** Vaivém de arquivos: `asset.meta`, `asset.enviar`, `asset.indisponivel` e o pré-envio (`preparo.*`). */
  | { tipo: "asset"; mensagem: MensagemDaSala }
  /** Frame binário (pedaço de arquivo repassado pela sala). */
  | { tipo: "binario"; dados: ArrayBuffer }
  /** `tipoDoPedido`: o tipo da intenção recusada, se a tela ainda o guarda (só os pedidos de mover token). */
  | {
      tipo: "erro";
      idPedido: string | null;
      codigo: CodigoDeErro;
      mensagem: string;
      tipoDoPedido?: string | undefined;
    };

/** De onde veio o aviso: o ponto da página onde a pessoa agiu (`null`: não há, a sala é quem avisa). */
export type OrigemDoAviso = { x: number; y: number };

export type Aviso = {
  numero: number;
  texto: string;
  codigo: CodigoDeErro | null;
  origem: OrigemDoAviso | null;
  /** Quanto tempo o aviso fica na tela (cresce com o tamanho do texto); um clique o dispensa. */
  duracaoMs: number;
  /** V10: uma ação no aviso (o "Desfazer"); clicar nela a executa e dispensa o aviso. */
  acao?: { rotulo: string; aoClicar: () => void };
};

const ATRASO_INICIAL_MS = 500;
const ATRASO_MAXIMO_MS = 10_000;
/** O mínimo que um aviso fica na tela, o que se soma por letra e o teto (aviso não fica para sempre). */
const AVISO_MINIMO_MS = 6_000;
const AVISO_POR_LETRA_MS = 55;
const AVISO_MAXIMO_MS = 12_000;
/** O ponteiro ainda conta como "onde a pessoa agiu" por este tempo depois do último movimento. */
const ORIGEM_VALE_MS = 1_500;

/**
 * Q12: a recusa de um gesto de mover token cujo resultado já se vê (o token não sai do lugar ou volta a ele) não
 * ganha aviso: parede no caminho, token que a pessoa não controla ou que sumiu. A sala continua recusando; só a tela
 * deixa de avisar. Qualquer outro erro (e qualquer outro pedido) avisa como sempre.
 */
const PEDIDOS_DE_MOVER = new Set(["token.mover", "token.soltar", "tokens.mover"]);
const RECUSAS_QUE_SE_VEEM = new Set<CodigoDeErro>([
  "trajeto_bloqueado",
  "sem_permissao",
  "token_inexistente",
]);
export function recusaSilenciosa(tipoDoPedido: string | undefined, codigo: CodigoDeErro): boolean {
  return (
    tipoDoPedido !== undefined &&
    PEDIDOS_DE_MOVER.has(tipoDoPedido) &&
    RECUSAS_QUE_SE_VEEM.has(codigo)
  );
}

/**
 * Q13: de quanto em quanto tempo o estado do React recebe os `token.movido` que chegaram (cada passo de seta de
 * alguém). O mapa mostra cada passo na hora; a mesa inteira não precisa se redesenhar a cada um (assumido: 300 ms).
 */
export const INTERVALO_DO_ESTADO_DOS_PASSOS_MS = 300;

/** Quanto tempo um aviso com este texto fica na tela. */
export function duracaoDoAviso(texto: string): number {
  const base = 3_500 + texto.length * AVISO_POR_LETRA_MS;
  return Math.min(AVISO_MAXIMO_MS, Math.max(AVISO_MINIMO_MS, base));
}

type Ponteiro = { x: number; y: number; t: number };

/** O ponto onde a pessoa agiu (o ponteiro, se mexeu há pouco; senão o campo que está com o foco). */
function origemDoEnvio(ponteiro: Ponteiro | null): OrigemDoAviso | null {
  if (ponteiro && Date.now() - ponteiro.t < ORIGEM_VALE_MS) {
    return { x: ponteiro.x, y: ponteiro.y };
  }
  const a = document.activeElement;
  if (a instanceof HTMLElement && a !== document.body) {
    const r = a.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.bottom };
  }
  return null;
}

/** Backoff exponencial com jitter: 0,5 s, 1 s, 2 s... até 10 s. */
export function atrasoDaTentativa(tentativa: number, aleatorio = Math.random()): number {
  const base = Math.min(ATRASO_MAXIMO_MS, ATRASO_INICIAL_MS * 2 ** tentativa);
  return Math.round(base * (0.75 + aleatorio * 0.5));
}

function urlDaSala(mesaId: string): string {
  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${location.host}/api/m/${mesaId}/ws`;
}

type Opcoes = {
  /** A mesa (id canônico) a que esta conexão pertence. */
  mesaId: string;
  aoExportar: (exportacao: Exportacao) => void;
  aoPerderSessao: () => void;
  /** O mestre mudou o nome da mesa (frame `mesa.renomeada`): vale para quem já está nela, sem recarregar. */
  aoRenomear?: (nome: string) => void;
};

/** Conexão WebSocket com a sala (mesma origem, via proxy do Vite), com reconexão automática. */
export function useSala(opcoes: Opcoes) {
  const [status, setStatus] = useState<StatusConexao>("conectando");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [presenca, setPresenca] = useState<Record<string, Presenca>>({});
  // 12-1: quem tem o Claude conectado (uma marca na bolinha) e os lotes do Claude deste usuário.
  const [claudeConectado, setClaudeConectado] = useState<string[]>([]);
  const [lotesDoClaude, setLotesDoClaude] = useState<LoteDoClaude[]>([]);
  const [uso, setUso] = useState<Uso | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [preparos, setPreparos] = useState<ProgressoDePreparo[]>([]);
  // Há mensagens visíveis mais antigas que as carregadas? (o snapshot traz no máximo 200)
  const [chatTemMais, setChatTemMais] = useState(false);
  // C2, só o mestre recebe: quantos pedidos de entrada e de redefinição esperam (cada frame é um objeto novo).
  const [avisoDeContas, setAvisoDeContas] = useState<AvisoDeContas | null>(null);
  // M1, só o mestre recebe: os arquivos que o Claude mandou e esperam o navegador processar (a sala reenvia a lista inteira a cada mudança).
  const [pendentesDaCaixa, setPendentesDaCaixa] = useState<EnvioPendente[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const ouvintes = useRef(new Set<(o: Ocorrencia) => void>());
  const opcoesAtuais = useRef(opcoes);
  opcoesAtuais.current = opcoes;
  const { mesaId } = opcoes;
  const contadorDeAvisos = useRef(0);
  // Onde a pessoa agiu por último e de onde saiu cada pedido: o aviso de erro aparece perto disso.
  const ponteiro = useRef<Ponteiro | null>(null);
  const origens = useRef(new Map<string, OrigemDoAviso | null>());
  /** Q12: o tipo de cada pedido enviado (os últimos), para saber que recusa merece aviso. */
  const tiposDosPedidos = useRef(new Map<string, string>());

  useEffect(() => {
    let encerrado = false;
    let tentativa = 0;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const avisar = (texto: string, codigo: CodigoDeErro | null, idPedido: string | null) => {
      const origem = idPedido === null ? null : (origens.current.get(idPedido) ?? null);
      setAviso({
        numero: ++contadorDeAvisos.current,
        texto,
        codigo,
        origem,
        duracaoMs: duracaoDoAviso(texto),
      });
    };
    const lembrar = (e: PointerEvent) => {
      ponteiro.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    };
    window.addEventListener("pointerdown", lembrar, true);
    window.addEventListener("pointermove", lembrar, true);
    window.addEventListener("pointerup", lembrar, true);
    const emitir = (o: Ocorrencia) => {
      for (const ouvinte of ouvintes.current) ouvinte(o);
    };

    // Q13: o aviso de que um token andou (cada passo de quem segura a seta) vai para o mapa na hora (ele anima por
    // conta própria), mas o estado do React, que redesenha a mesa inteira, só é atualizado a cada
    // `INTERVALO_DO_ESTADO_DOS_PASSOS_MS`. Qualquer outro evento descarrega a fila antes, na ordem em que chegou.
    let fila: EventoSala[] = [];
    let esperaDaFila: ReturnType<typeof setTimeout> | undefined;
    function descarregarFila() {
      clearTimeout(esperaDaFila);
      esperaDaFila = undefined;
      if (fila.length === 0) return;
      const itens = fila;
      fila = [];
      setEstado((e) => (e ? itens.reduce(reduzir, e) : e));
    }

    function tratar(texto: string) {
      const lida = lerMensagemDaSala(texto);
      if (!lida.ok) return;
      const m = lida.valor;
      switch (m.tipo) {
        case "snapshot":
          fila = [];
          clearTimeout(esperaDaFila);
          esperaDaFila = undefined;
          setUsuarioId(m.dados.usuarioId);
          setEstado(m.dados.estado);
          setChatTemMais((m.dados.estado.chat?.length ?? 0) >= LIMITES_DO_CHAT.noSnapshot);
          break;
        case "evento":
          if (m.dados.tipo === "token.movido") {
            fila.push(m.dados);
            esperaDaFila ??= setTimeout(descarregarFila, INTERVALO_DO_ESTADO_DOS_PASSOS_MS);
          } else {
            descarregarFila();
            setEstado((e) => (e ? reduzir(e, m.dados) : e));
          }
          if (m.dados.tipo === "chat.limpo") setChatTemMais(false);
          emitir({ tipo: "evento", evento: m.dados });
          break;
        case "token.movendo":
          // Transitório: não mexe no estado (nem re-renderiza); o mapa interpola até a posição.
          emitir({ tipo: "movendo", ...m.dados });
          break;
        case "desenho.rascunhando":
          emitir({ tipo: "rascunho", desenho: m.dados.desenho });
          break;
        case "desenho.rascunhoFim":
          emitir({ tipo: "rascunhoFim", id: m.dados.id });
          break;
        case "som.zona":
          emitir({ tipo: "somDaZona", sons: m.dados.sons });
          break;
        case "mapa.pingado":
          emitir({ tipo: "ping", ping: m.dados });
          break;
        case "presenca":
          setPresenca(m.dados.usuarios);
          setClaudeConectado(m.dados.claude ?? []);
          break;
        case "claude.lotes":
          setLotesDoClaude(m.dados.lotes);
          break;
        case "claude.desfeito": {
          const { aplicados, pulados } = m.dados;
          avisar(
            pulados.length === 0
              ? `Desfeito: ${aplicados} ${aplicados === 1 ? "item voltou" : "itens voltaram"}.`
              : `Desfeito, menos ${pulados.length === 1 ? "um item que mudou" : `${pulados.length} itens que mudaram`} depois: ${pulados.join(", ")}.`,
            null,
            null,
          );
          break;
        }
        case "uso":
          setUso(m.dados);
          break;
        case "chat.anteriores": {
          const { mensagens, temMais } = m.dados;
          setChatTemMais(temMais);
          setEstado((e) => {
            if (!e) return e;
            const atuais = e.chat ?? [];
            const ids = new Set(atuais.map((x) => x.id));
            const novas = mensagens.filter((x) => !ids.has(x.id));
            return { ...e, chat: [...novas, ...atuais].sort((a, b) => a.seq - b.seq) };
          });
          break;
        }
        case "preparo.progresso":
          setPreparos(m.dados.preparos);
          break;
        case "contas.aviso":
          setAvisoDeContas(m.dados);
          break;
        case "caixa.pendentes":
          setPendentesDaCaixa(m.dados.envios);
          break;
        case "mesa.renomeada":
          opcoesAtuais.current.aoRenomear?.(m.dados.nome);
          break;
        case "asset.meta":
        case "asset.enviar":
        case "asset.indisponivel":
        case "preparo.disponivel":
        case "preparo.chaves":
          emitir({ tipo: "asset", mensagem: m });
          break;
        case "exportacao":
          opcoesAtuais.current.aoExportar(m.dados.exportacao);
          break;
        case "erro": {
          const tipoDoPedido =
            m.dados.idPedido === null ? undefined : tiposDosPedidos.current.get(m.dados.idPedido);
          if (!recusaSilenciosa(tipoDoPedido, m.dados.codigo)) {
            avisar(m.dados.mensagem, m.dados.codigo, m.dados.idPedido);
          }
          emitir({ tipo: "erro", ...m.dados, tipoDoPedido });
          break;
        }
      }
    }

    function conectar() {
      const ws = new WebSocket(urlDaSala(mesaId));
      socket.current = ws;
      ws.binaryType = "arraybuffer";
      // Socket descartado (desmontagem ou StrictMode montando duas vezes) não pode mexer no estado:
      // o "close" dele pode chegar depois do "open" do socket novo.
      const ativo = () => !encerrado && socket.current === ws;
      ws.addEventListener("open", () => {
        if (!ativo()) return;
        tentativa = 0;
        setStatus("conectado");
        emitir({ tipo: "conectado" });
      });
      ws.addEventListener("message", (e) => {
        if (!ativo()) return;
        if (typeof e.data === "string") tratar(e.data);
        else if (e.data instanceof ArrayBuffer) emitir({ tipo: "binario", dados: e.data });
      });
      ws.addEventListener("close", () => {
        if (!ativo()) return;
        socket.current = null;
        setStatus("reconectando");
        // Se a sessão acabou (cookie apagado), voltar para a tela de entrada em vez de insistir.
        fetch(`/api/m/${mesaId}/eu`)
          .then((r) => {
            if (r.status === 401 && !encerrado) opcoesAtuais.current.aoPerderSessao();
          })
          .catch(() => {});
        temporizador = setTimeout(conectar, atrasoDaTentativa(tentativa++));
      });
    }

    conectar();
    return () => {
      encerrado = true;
      window.removeEventListener("pointerdown", lembrar, true);
      window.removeEventListener("pointermove", lembrar, true);
      window.removeEventListener("pointerup", lembrar, true);
      clearTimeout(temporizador);
      clearTimeout(esperaDaFila);
      const ws = socket.current;
      socket.current = null;
      ws?.close();
    };
  }, [mesaId]);

  // O aviso some sozinho.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.duracaoMs);
    return () => clearTimeout(t);
  }, [aviso]);

  /** Um aviso da própria tela (sem origem: aparece no alto da área do mapa), por exemplo a pausa sem mestre. */
  const avisar = useCallback((texto: string, acao?: Aviso["acao"]) => {
    setAviso({
      numero: ++contadorDeAvisos.current,
      texto,
      codigo: null,
      origem: null,
      duracaoMs: duracaoDoAviso(texto),
      ...(acao ? { acao } : {}),
    });
  }, []);

  /** Um clique no aviso o dispensa. */
  const dispensarAviso = useCallback(() => setAviso(null), []);

  /** Envia uma intenção. Devolve o id do pedido, ou `null` se não foi possível enviar. */
  const enviar = useCallback((tipo: string, dados: object): string | null => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return null;
    const id = crypto.randomUUID();
    const intencao = IntencaoSchema.safeParse({ v: VERSAO_PROTOCOLO, id, tipo, dados });
    if (!intencao.success) return null;
    ws.send(JSON.stringify(intencao.data));
    const guardadas = origens.current;
    guardadas.set(id, origemDoEnvio(ponteiro.current));
    if (guardadas.size > 64) {
      const primeira = guardadas.keys().next();
      if (!primeira.done) guardadas.delete(primeira.value);
    }
    if (PEDIDOS_DE_MOVER.has(tipo)) {
      const tipos = tiposDosPedidos.current;
      tipos.set(id, tipo);
      if (tipos.size > 128) {
        const primeiro = tipos.keys().next();
        if (!primeiro.done) tipos.delete(primeiro.value);
      }
    }
    return id;
  }, []);

  /** Frame binário (pedaço de arquivo). `false` se o socket não está aberto. */
  const enviarBinario = useCallback((dados: Uint8Array): boolean => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(dados as BufferSource);
    return true;
  }, []);

  const bufferizado = useCallback(() => socket.current?.bufferedAmount ?? 0, []);
  const conectado = useCallback(() => socket.current?.readyState === WebSocket.OPEN, []);

  const ouvir = useCallback((fn: (o: Ocorrencia) => void) => {
    ouvintes.current.add(fn);
    return () => {
      ouvintes.current.delete(fn);
    };
  }, []);

  const eu = estado?.usuarios.find((u) => u.id === usuarioId) ?? null;
  return {
    status,
    estado,
    eu,
    presenca,
    uso,
    aviso,
    avisar,
    dispensarAviso,
    preparos,
    chatTemMais,
    avisoDeContas,
    pendentesDaCaixa,
    claudeConectado,
    lotesDoClaude,
    enviar,
    enviarBinario,
    bufferizado,
    conectado,
    ouvir,
  };
}
