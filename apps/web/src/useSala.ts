import { useCallback, useEffect, useRef, useState } from "react";

export type StatusConexao = "conectando" | "conectado" | "desconectado";

function urlDaSala(): string {
  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${location.host}/ws`;
}

/** Conexão WebSocket com a sala (mesma origem, via proxy do Vite). */
export function useSala() {
  const [statusConexao, setStatusConexao] = useState<StatusConexao>("conectando");
  const [eco, setEco] = useState("");
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(urlDaSala());
    socket.current = ws;
    // Socket descartado (desmontagem ou StrictMode montando duas vezes) não pode mexer no estado:
    // o "close" dele pode chegar depois do "open" do socket novo.
    const ativo = () => socket.current === ws;
    ws.addEventListener("open", () => ativo() && setStatusConexao("conectado"));
    ws.addEventListener("close", () => ativo() && setStatusConexao("desconectado"));
    ws.addEventListener("message", (e) => {
      if (ativo() && typeof e.data === "string") setEco(e.data);
    });
    return () => {
      if (socket.current === ws) socket.current = null;
      ws.close();
    };
  }, []);

  const enviar = useCallback((texto: string) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(texto);
  }, []);

  return { statusConexao, eco, enviar };
}
