import type { Estado, Presenca } from "@tabletop/shared";
import { Send } from "lucide-react";

type Props = {
  estado: Estado;
  presenca: Record<string, Presenca>;
  euId: string;
};

const ROTULO_DA_PRESENCA: Record<Presenca, string> = {
  online: "online",
  reconectando: "reconectando",
  offline: "offline",
};

function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const duas = palavras.length >= 2 ? `${palavras[0]?.[0] ?? ""}${palavras[1]?.[0] ?? ""}` : nome;
  return duas.slice(0, 2).toUpperCase();
}

/**
 * Aba Chat. No topo, a presença de todos (avatar com a cor do usuário e o estado). O chat em si
 * (mensagens, rolagens, "Como:") chega no Lote 8: por ora a lista está vazia e a caixa, desabilitada.
 */
export function AbaChat({ estado, presenca, euId }: Props) {
  const quemEsta = (id: string): Presenca => presenca[id] ?? "offline";
  return (
    <div className="aba-chat" data-testid="aba-chat-conteudo">
      <ul className="presenca" data-testid="presenca" aria-label="Quem está na mesa">
        {estado.usuarios.map((u) => (
          <li
            key={u.id}
            className="presenca-item"
            data-testid={`presenca-${u.id}`}
            data-estado={quemEsta(u.id)}
            title={`${u.nome} (${u.papel})`}
          >
            <span className="avatar" style={{ background: u.cor }}>
              {iniciais(u.nome)}
              <span className="ponto-estado" aria-hidden="true" />
            </span>
            <span className="presenca-nome">
              {u.nome}
              {u.id === euId ? " (você)" : ""}
            </span>
            <span data-testid={`presenca-estado-${u.id}`} className="estado-presenca">
              {ROTULO_DA_PRESENCA[quemEsta(u.id)]}
            </span>
          </li>
        ))}
      </ul>

      <div className="mensagens-chat" data-testid="chat-mensagens" aria-live="polite">
        <p className="nota">Nenhuma mensagem ainda.</p>
      </div>

      <form className="caixa-chat" onSubmit={(e) => e.preventDefault()}>
        <label className="linha-opcao">
          Como:
          <select data-testid="chat-como" disabled aria-label="Falar como">
            <option>Eu mesmo</option>
          </select>
        </label>
        <div className="linha-chat">
          <input
            data-testid="chat-texto"
            disabled
            placeholder="O chat chega em breve…"
            aria-label="Mensagem"
          />
          <button type="submit" className="botao-icone" disabled aria-label="Enviar" title="Enviar">
            <Send size={18} />
          </button>
        </div>
        <p className="nota" data-testid="chat-aviso">
          O chat chega no Lote 8: conversa, rolagens de dados e descrições de magia.
        </p>
      </form>
    </div>
  );
}
