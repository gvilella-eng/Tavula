import {
  AJUDA_DO_CHAT,
  type Estado,
  interpretarChat,
  LIMITES_DO_CHAT,
  type Mensagem,
  type Presenca,
  pode,
  podeEditarPersonagem,
  ROTULO_DA_VANTAGEM,
  type Usuario,
  VANTAGENS,
  type Vantagem,
} from "@tabletop/shared";
import { Dices, Send, Trash2 } from "lucide-react";
import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { MensagemDoChat } from "./MensagemDoChat";
import type { ImagensDoMapa } from "./mapa/mapaPixi";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  presenca: Record<string, Presenca>;
  eu: Usuario;
  enviar: Enviar;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  /** O personagem de quem estou falando ("" = eu mesmo). Vale também para os dados rápidos. */
  comoId: string;
  aoMudarComo: (id: string) => void;
  /** Há mensagens visíveis mais antigas que as carregadas? */
  temMais: boolean;
  pedirAnteriores: () => void;
  /** A aba do chat está aberta e à vista? */
  visivel: boolean;
};

const ROTULO_DA_PRESENCA: Record<Presenca, string> = {
  online: "online",
  reconectando: "reconectando",
  offline: "offline",
};
const HISTORICO_DE_ENVIOS = 30;

function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const duas = palavras.length >= 2 ? `${palavras[0]?.[0] ?? ""}${palavras[1]?.[0] ?? ""}` : nome;
  return duas.slice(0, 2).toUpperCase();
}

type ModeloAberto = "ataque" | "teste";

/**
 * Formulário dos modelos de rolagem: ataque (acerto + dano) e teste (com CD ou simples), com o seletor
 * de normal, vantagem e desvantagem. A ficha do Lote 9 manda os mesmos pedidos.
 */
function ModelosDeRolagem({
  podeOculta,
  comoId,
  enviar,
}: {
  podeOculta: boolean;
  comoId: string;
  enviar: Enviar;
}) {
  const [tipo, setTipo] = useState<ModeloAberto>("ataque");
  const [nome, setNome] = useState("");
  const [bonus, setBonus] = useState("0");
  const [dano, setDano] = useState("1d8+3");
  const [cd, setCd] = useState("");
  const [vantagem, setVantagem] = useState<Vantagem>("normal");
  const [oculta, setOculta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function rolar() {
    const b = Number(bonus);
    if (!Number.isInteger(b) || b < -50 || b > 50) {
      setErro("O bônus é um número inteiro de -50 a 50.");
      return;
    }
    const rotulo = nome.trim() || (tipo === "ataque" ? "Ataque" : "Teste");
    const comum = {
      nome: rotulo,
      bonus: b,
      vantagem,
      ...(oculta && podeOculta ? { oculta: true } : {}),
      ...(comoId ? { como: comoId } : {}),
    };
    let ok: string | null;
    if (tipo === "ataque") {
      if (dano.trim() === "") {
        setErro("Diga o dano (ex.: 1d8+3).");
        return;
      }
      ok = enviar("chat.modelo", { modelo: "ataque", ...comum, dano: dano.trim() });
    } else {
      const alvo = cd.trim() === "" ? undefined : Number(cd);
      if (alvo !== undefined && (!Number.isInteger(alvo) || alvo < 0 || alvo > 100)) {
        setErro("A CD é um número inteiro de 0 a 100.");
        return;
      }
      ok = enviar("chat.modelo", {
        modelo: "teste",
        ...comum,
        ...(alvo === undefined ? {} : { cd: alvo }),
      });
    }
    setErro(ok === null ? "Sem conexão com a sala." : null);
  }

  return (
    <div className="modelos-rolagem" data-testid="chat-modelos">
      <div className="linha-opcao">
        <select
          data-testid="modelo-tipo"
          aria-label="Modelo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as ModeloAberto)}
        >
          <option value="ataque">Ataque</option>
          <option value="teste">Teste</option>
        </select>
        <input
          data-testid="modelo-nome"
          aria-label="Nome"
          placeholder={tipo === "ataque" ? "Espada longa" : "Furtividade"}
          maxLength={64}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <div className="linha-opcao">
        <label>
          Bônus
          <input
            data-testid="modelo-bonus"
            type="number"
            value={bonus}
            min={-50}
            max={50}
            onChange={(e) => setBonus(e.target.value)}
          />
        </label>
        {tipo === "ataque" ? (
          <label>
            Dano
            <input
              data-testid="modelo-dano"
              value={dano}
              maxLength={60}
              onChange={(e) => setDano(e.target.value)}
            />
          </label>
        ) : (
          <label>
            CD
            <input
              data-testid="modelo-cd"
              type="number"
              placeholder="sem CD"
              value={cd}
              min={0}
              max={100}
              onChange={(e) => setCd(e.target.value)}
            />
          </label>
        )}
      </div>
      <div className="linha-opcao">
        <select
          data-testid="modelo-vantagem"
          aria-label="Vantagem"
          value={vantagem}
          onChange={(e) => setVantagem(e.target.value as Vantagem)}
        >
          {VANTAGENS.map((v) => (
            <option key={v} value={v}>
              {ROTULO_DA_VANTAGEM[v]}
            </option>
          ))}
        </select>
        {podeOculta && (
          <label className="linha-opcao">
            <input
              type="checkbox"
              data-testid="modelo-oculta"
              checked={oculta}
              onChange={(e) => setOculta(e.target.checked)}
            />
            Oculta
          </label>
        )}
        <button type="button" data-testid="modelo-rolar" onClick={rolar}>
          <Dices size={16} /> Rolar
        </button>
      </div>
      {erro && (
        <p className="nota erro" data-testid="modelo-erro">
          {erro}
        </p>
      )}
    </div>
  );
}

/**
 * Aba Chat. No topo, a presença de todos. No meio, a conversa (texto, rolagens, modelos, sussurros).
 * No rodapé, a caixa fixa com o "Como:" (eu mesmo ou um personagem que eu edito; o mestre, qualquer
 * um). Enter envia, Shift+Enter quebra a linha, a seta para cima traz de volta a última mensagem.
 */
export function AbaChat({
  estado,
  presenca,
  eu,
  enviar,
  imagens,
  versaoDasImagens,
  comoId,
  aoMudarComo,
  temMais,
  pedirAnteriores,
  visivel,
}: Props) {
  const quemEsta = (id: string): Presenca => presenca[id] ?? "offline";
  const chat: Mensagem[] = estado.chat ?? [];
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ajuda, setAjuda] = useState(false);
  const [modelosAbertos, setModelosAbertos] = useState(false);
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);
  const enviadas = useRef<string[]>([]);
  // Posição na lista de enviadas enquanto a seta para cima percorre (-1 = fora do histórico).
  const posicao = useRef(-1);
  const lista = useRef<HTMLDivElement>(null);
  const ultimoSeq = useRef(0);
  const primeiroSeq = useRef(0);
  const alturaAntes = useRef<number | null>(null);

  const meusPersonagens = estado.personagens.filter((p) => podeEditarPersonagem(p, eu));
  const comoValido = meusPersonagens.some((p) => p.id === comoId) ? comoId : "";
  const podeOculta = pode(eu, "dado.rolarOculto", estado.permissoes);

  const ultima = chat[chat.length - 1];
  const primeira = chat[0];

  // Rola para o fim quando chega mensagem (se eu estava perto do fim ou a mensagem é minha) e ao
  // abrir a aba; ao carregar anteriores, mantém na tela o que eu estava lendo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reage ao que muda na lista e à visibilidade
  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    if (alturaAntes.current !== null && primeira && primeira.seq !== primeiroSeq.current) {
      el.scrollTop += el.scrollHeight - alturaAntes.current;
      alturaAntes.current = null;
    } else if (ultima && ultima.seq !== ultimoSeq.current) {
      const pertoDoFim = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (pertoDoFim || ultimoSeq.current === 0 || ultima.autorId === eu.id) {
        el.scrollTop = el.scrollHeight;
      }
    } else if (visivel) {
      el.scrollTop = el.scrollHeight;
    }
    ultimoSeq.current = ultima?.seq ?? 0;
    primeiroSeq.current = primeira?.seq ?? 0;
  }, [ultima?.seq, primeira?.seq, visivel, eu.id]);

  function mandar() {
    const bruto = texto.trim();
    if (bruto === "") return;
    const lido = interpretarChat(bruto, estado.usuarios);
    if (lido.tipo === "ajuda") {
      setAjuda(true);
      setErro(null);
      setTexto("");
      return;
    }
    if (lido.tipo === "erro") {
      setErro(lido.motivo);
      return;
    }
    const id = enviar("chat.enviar", { texto: bruto, ...(comoValido ? { como: comoValido } : {}) });
    if (id === null) {
      setErro("Sem conexão com a sala: a mensagem não foi enviada.");
      return;
    }
    enviadas.current = [...enviadas.current.slice(-(HISTORICO_DE_ENVIOS - 1)), bruto];
    posicao.current = -1;
    setErro(null);
    setAjuda(false);
    setTexto("");
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      mandar();
      return;
    }
    // Seta para cima (com a caixa vazia ou já percorrendo): traz de volta a última mensagem enviada.
    if (e.key === "ArrowUp" && (texto === "" || posicao.current >= 0)) {
      const historico = enviadas.current;
      if (historico.length === 0) return;
      e.preventDefault();
      posicao.current = Math.min(posicao.current + 1, historico.length - 1);
      setTexto(historico[historico.length - 1 - posicao.current] ?? "");
    } else if (e.key === "ArrowDown" && posicao.current >= 0) {
      e.preventDefault();
      posicao.current -= 1;
      setTexto(
        posicao.current < 0
          ? ""
          : (enviadas.current[enviadas.current.length - 1 - posicao.current] ?? ""),
      );
    }
  }

  function carregarAnteriores() {
    alturaAntes.current = lista.current?.scrollHeight ?? null;
    pedirAnteriores();
  }

  return (
    <div className="aba-chat" data-testid="aba-chat-conteudo">
      <ul className="presenca" data-testid="presenca" aria-label="Quem está na mesa">
        {estado.usuarios.map((u) => (
          <li
            key={u.id}
            className="presenca-item"
            data-testid={`presenca-${u.id}`}
            data-estado={quemEsta(u.id)}
            title={`${u.nome} (${u.papel})${u.id === eu.id ? " — você" : ""}`}
          >
            <span className="avatar" style={{ background: u.cor }}>
              {iniciais(u.nome)}
              <span className="ponto-estado" aria-hidden="true" />
            </span>
            <span className="presenca-nome">
              {u.nome}
              {u.id === eu.id ? " ★" : ""}
            </span>
            <span data-testid={`presenca-estado-${u.id}`} className="estado-presenca">
              {ROTULO_DA_PRESENCA[quemEsta(u.id)]}
            </span>
          </li>
        ))}
      </ul>

      <div className="mensagens-chat" data-testid="chat-mensagens" aria-live="polite" ref={lista}>
        {temMais && (
          <button
            type="button"
            className="chat-anteriores"
            data-testid="chat-anteriores"
            onClick={carregarAnteriores}
          >
            Carregar anteriores
          </button>
        )}
        {chat.length === 0 && <p className="nota">Nenhuma mensagem ainda.</p>}
        {chat.map((m) => (
          <MensagemDoChat
            key={m.id}
            mensagem={m}
            usuarios={estado.usuarios}
            euId={eu.id}
            imagens={imagens}
            versaoDasImagens={versaoDasImagens}
          />
        ))}
        {ajuda && (
          <div className="chat-ajuda" data-testid="chat-ajuda">
            <strong>Comandos do chat</strong>
            <dl>
              {AJUDA_DO_CHAT.map(([comando, descricao]) => (
                <div key={comando}>
                  <dt>
                    <code>{comando}</code>
                  </dt>
                  <dd>{descricao}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <form
        className="caixa-chat"
        data-testid="chat-caixa"
        onSubmit={(e) => {
          e.preventDefault();
          mandar();
        }}
      >
        {modelosAbertos && (
          <ModelosDeRolagem podeOculta={podeOculta} comoId={comoValido} enviar={enviar} />
        )}
        <div className="linha-como">
          <label className="linha-opcao">
            Como:
            <select
              data-testid="chat-como"
              aria-label="Falar como"
              value={comoValido}
              onChange={(e) => aoMudarComo(e.target.value)}
            >
              <option value="">{eu.nome} (eu mesmo)</option>
              {meusPersonagens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="botao-icone pequeno"
            data-testid="chat-modelos-abrir"
            aria-pressed={modelosAbertos}
            title="Modelos de rolagem (ataque e teste)"
            aria-label="Modelos de rolagem"
            onClick={() => setModelosAbertos(!modelosAbertos)}
          >
            <Dices size={16} />
          </button>
          {eu.papel === "mestre" && (
            <button
              type="button"
              className="botao-icone pequeno"
              data-testid="chat-limpar"
              title="Limpar o chat"
              aria-label="Limpar o chat"
              onClick={() => setConfirmandoLimpar(true)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        {confirmandoLimpar && (
          <div
            className="confirmar-limpar"
            data-testid="chat-limpar-confirmacao"
            role="alertdialog"
          >
            <p>Apagar todo o histórico do chat, para todos? Isso não tem volta.</p>
            <div className="linha-botoes">
              <button
                type="button"
                className="perigo"
                data-testid="chat-limpar-confirmar"
                onClick={() => {
                  enviar("chat.limpar", {});
                  setConfirmandoLimpar(false);
                }}
              >
                Apagar tudo
              </button>
              <button
                type="button"
                data-testid="chat-limpar-cancelar"
                onClick={() => setConfirmandoLimpar(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        <div className="linha-chat">
          <textarea
            data-testid="chat-texto"
            rows={2}
            maxLength={LIMITES_DO_CHAT.caracteres}
            placeholder="Mensagem, /r 1d20+5, /w Nome… (/? lista os comandos)"
            aria-label="Mensagem"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              posicao.current = -1;
              if (erro) setErro(null);
            }}
            onKeyDown={aoTeclar}
          />
          <button
            type="submit"
            className="botao-icone"
            data-testid="chat-enviar"
            aria-label="Enviar"
            title="Enviar (Enter)"
          >
            <Send size={18} />
          </button>
        </div>
        {erro && (
          <p className="nota erro" data-testid="chat-erro" role="alert">
            {erro}
          </p>
        )}
      </form>
    </div>
  );
}
