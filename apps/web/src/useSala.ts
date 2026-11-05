import {
  type CodigoDeErro,
  type Estado,
  type EventoSala,
  type Exportacao,
  IntencaoSchema,
  lerMensagemDaSala,
  type MensagemDaSala,
  type Presenca,
  reduzir,
  type Uso,
  VERSAO_PROTOCOLO,
} from "@tabletop/shared";
import { useCallback, useEffect, useRef, useState } from "react";

/** Como anda o preparo de uma cena (só o mestre recebe). */
export type ProgressoDePreparo = Extract<
  MensagemDaSala,
  { tipo: "preparo.progresso" }
>["dados"]["preparos"][number];

export type StatusConexao = "conectando" | "conectado" | "reconectando";

/** Algo que a sala contou e que os componentes (campos com rascunho) querem acompanhar. */
export type Ocorrencia =
  | { tipo: "evento"; evento: EventoSala }
  | { tipo: "movendo"; id: string; x: number; y: number }
  | { tipo: "conectado" }
  /** Vaivém de arquivos: `asset.meta`, `asset.enviar`, `asset.indisponivel` e o pré-envio (`preparo.*`). */
  | { tipo: "asset"; mensagem: MensagemDaSala }
  /** Frame binário (pedaço de arquivo repassado pela sala). */
  | { tipo: "binario"; dados: ArrayBuffer }
  | { tipo: "erro"; idPedido: string | null; codigo: CodigoDeErro; mensagem: string };

export type Aviso = { numero: number; texto: string; codigo: CodigoDeErro | null };

const ATRASO_INICIAL_MS = 500;
const ATRASO_MAXIMO_MS = 10_000;
const DURACAO_DO_AVISO_MS = 6_000;

/** Backoff exponencial com jitter: 0,5 s, 1 s, 2 s... até 10 s. */
export function atrasoDaTentativa(tentativa: number, aleatorio = Math.random()): number {
  const base = Math.min(ATRASO_MAXIMO_MS, ATRASO_INICIAL_MS * 2 ** tentativa);
  return Math.round(base * (0.75 + aleatorio * 0.5));
}

function urlDaSala(): string {
  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${location.host}/ws`;
}

type Opcoes = {
  aoExportar: (exportacao: Exportacao) => void;
  aoPerderSessao: () => void;
};

/** Conexão WebSocket com a sala (mesma origem, via proxy do Vite), com reconexão automática. */
export function useSala(opcoes: Opcoes) {
  const [status, setStatus] = useState<StatusConexao>("conectando");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [presenca, setPresenca] = useState<Record<string, Presenca>>({});
  const [uso, setUso] = useState<Uso | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [preparos, setPreparos] = useState<ProgressoDePreparo[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const ouvintes = useRef(new Set<(o: Ocorrencia) => void>());
  const opcoesAtuais = useRef(opcoes);
  opcoesAtuais.current = opcoes;
  const contadorDeAvisos = useRef(0);

  useEffect(() => {
    let encerrado = false;
    let tentativa = 0;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const avisar = (texto: string, codigo: CodigoDeErro | null) => {
      setAviso({ numero: ++contadorDeAvisos.current, texto, codigo });
    };
    const emitir = (o: Ocorrencia) => {
      for (const ouvinte of ouvintes.current) ouvinte(o);
    };

    function tratar(texto: string) {
      const lida = lerMensagemDaSala(texto);
      if (!lida.ok) return;
      const m = lida.valor;
      switch (m.tipo) {
        case "snapshot":
          setUsuarioId(m.dados.usuarioId);
          setEstado(m.dados.estado);
          break;
        case "evento":
          setEstado((e) => (e ? reduzir(e, m.dados) : e));
          emitir({ tipo: "evento", evento: m.dados });
          break;
        case "token.movendo":
          // Transitório: não mexe no estado (nem re-renderiza); o mapa interpola até a posição.
          emitir({ tipo: "movendo", ...m.dados });
          break;
        case "presenca":
          setPresenca(m.dados.usuarios);
          break;
        case "uso":
          setUso(m.dados);
          break;
        case "preparo.progresso":
          setPreparos(m.dados.preparos);
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
        case "erro":
          avisar(m.dados.mensagem, m.dados.codigo);
          emitir({ tipo: "erro", ...m.dados });
          break;
      }
    }

    function conectar() {
      const ws = new WebSocket(urlDaSala());
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
        fetch("/api/eu")
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
      clearTimeout(temporizador);
      const ws = socket.current;
      socket.current = null;
      ws?.close();
    };
  }, []);

  // O aviso some sozinho.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), DURACAO_DO_AVISO_MS);
    return () => clearTimeout(t);
  }, [aviso]);

  /** Envia uma intenção. Devolve o id do pedido, ou `null` se não foi possível enviar. */
  const enviar = useCallback((tipo: string, dados: object): string | null => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return null;
    const id = crypto.randomUUID();
    const intencao = IntencaoSchema.safeParse({ v: VERSAO_PROTOCOLO, id, tipo, dados });
    if (!intencao.success) return null;
    ws.send(JSON.stringify(intencao.data));
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
    preparos,
    enviar,
    enviarBinario,
    bufferizado,
    conectado,
    ouvir,
  };
}
