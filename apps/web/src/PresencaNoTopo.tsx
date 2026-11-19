import type { Presenca, Usuario } from "@tabletop/shared";
import { Bot, Video } from "lucide-react";
import { useId, useRef, useState } from "react";
import { iniciais } from "./Avatar";
import { BotaoComDica } from "./BotaoComDica";
import { corDoTextoSobre } from "./contrasteDeCor";
import { useFecharFora } from "./Popover";

type Props = {
  usuarios: Usuario[];
  presenca: Record<string, Presenca>;
  euId: string;
  /** 12-1: quem tem o Claude conectado (uma marca pequena na bolinha; o Claude nunca vira outra pessoa aqui). */
  claude?: readonly string[];
  /** CH1: quem está na chamada da mesa (um ícone pequeno no avatar) e quem fala agora (o anel verde, vindo da janela da chamada). */
  naChamada?: readonly string[];
  falandoNaChamada?: ReadonlySet<string>;
};

const ROTULO: Record<Presenca, string> = {
  online: "online",
  reconectando: "reconectando",
  offline: "offline",
};

/** Quantos avatares cabem no topo antes de virar "+N". */
const VISIVEIS = 6;

function Item({
  u,
  estado,
  euId,
  naLista,
  comClaude,
  naChamada,
  falando,
}: {
  u: Usuario;
  estado: Presenca;
  euId: string;
  naLista?: boolean;
  comClaude?: boolean;
  naChamada?: boolean;
  falando?: boolean;
}) {
  const dica = `${u.nome} (${u.papel})${u.id === euId ? " — você" : ""}: ${ROTULO[estado]}${comClaude ? " · Claude conectado" : ""}`;
  return (
    <li
      className={naLista ? "presenca-item presenca-linha" : "presenca-item"}
      data-testid={`presenca-${u.id}`}
      data-estado={estado}
      data-claude={comClaude ? "sim" : undefined}
      data-na-chamada={naChamada ? "sim" : undefined}
      data-falando={falando ? "sim" : undefined}
      // Na lista o nome está à vista; só os avatares de iniciais precisam do nome e do estado.
      title={naLista ? undefined : dica}
    >
      <span className="avatar" style={{ background: u.cor, color: corDoTextoSobre(u.cor) }}>
        {iniciais(u.nome)}
        <span className="ponto-estado" aria-hidden="true" />
        {naChamada && (
          <span
            className="marca-chamada"
            data-testid={`presenca-chamada-${u.id}`}
            title="Na chamada"
          >
            <Video size={9} aria-hidden="true" />
            <span className="so-leitor">Na chamada</span>
          </span>
        )}
        {comClaude && (
          <span
            className="marca-claude"
            data-testid={`presenca-claude-${u.id}`}
            title="Claude conectado"
          >
            <Bot size={9} aria-hidden="true" />
            <span className="so-leitor">Claude conectado</span>
          </span>
        )}
      </span>
      {naLista && (
        <span className="presenca-nome">
          {u.nome}
          {u.id === euId ? " ★" : ""}
        </span>
      )}
      {/* Para leitores de tela (e testes) o estado é sempre texto; na lista do "+N" ele aparece. */}
      <span
        data-testid={`presenca-estado-${u.id}`}
        className={naLista ? "estado-presenca" : "so-leitor"}
      >
        {ROTULO[estado]}
      </span>
    </li>
  );
}

/**
 * Quem está na mesa, como avatares no topo (nome e estado na dica; offline esmaecido). Com mais de
 * {VISIVEIS} pessoas, aparecem os que estão online primeiro e um "+N" abre a lista dos outros.
 */
export function PresencaNoTopo({
  usuarios,
  presenca,
  euId,
  claude = [],
  naChamada = [],
  falandoNaChamada,
}: Props) {
  const [aberta, setAberta] = useState(false);
  const idDaLista = useId();
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, () => setAberta(false));
  const estadoDe = (u: Usuario): Presenca => presenca[u.id] ?? "offline";

  let visiveis = usuarios;
  if (usuarios.length > VISIVEIS) {
    // Os online (e reconectando) primeiro; entre iguais, a ordem da sala. Depois volta à ordem da sala.
    const peso = (u: Usuario) => (estadoDe(u) === "offline" ? 1 : 0);
    const escolhidos = new Set(
      [...usuarios]
        .map((u, i) => ({ u, i }))
        .sort((a, b) => peso(a.u) - peso(b.u) || a.i - b.i)
        .slice(0, VISIVEIS - 1)
        .map((x) => x.u.id),
    );
    visiveis = usuarios.filter((u) => escolhidos.has(u.id));
  }
  const outros = usuarios.filter((u) => !visiveis.includes(u));

  return (
    <div className="presenca-topo" ref={ref}>
      <ul className="presenca-avatares" data-testid="presenca" aria-label="Quem está na mesa">
        {visiveis.map((u) => (
          <Item
            key={u.id}
            u={u}
            estado={estadoDe(u)}
            euId={euId}
            comClaude={claude.includes(u.id)}
            naChamada={naChamada.includes(u.id)}
            falando={falandoNaChamada?.has(u.id) === true}
          />
        ))}
      </ul>
      {outros.length > 0 && (
        <>
          <BotaoComDica
            className="presenca-mais"
            testid="presenca-mais"
            data-popover-gatilho=""
            nome={`Mais ${outros.length} na mesa`}
            semDica={aberta}
            aria-expanded={aberta}
            aria-controls={idDaLista}
            onClick={() => setAberta(!aberta)}
          >
            +{outros.length}
          </BotaoComDica>
          {/* Sempre montada (os estados continuam lidos por leitores de tela); só aparece ao abrir. */}
          <ul
            className="presenca-lista"
            id={idDaLista}
            data-testid="presenca-lista"
            aria-label="Os outros na mesa"
            hidden={!aberta}
          >
            {outros.map((u) => (
              <Item
                key={u.id}
                u={u}
                estado={estadoDe(u)}
                euId={euId}
                naLista
                comClaude={claude.includes(u.id)}
                naChamada={naChamada.includes(u.id)}
                falando={falandoNaChamada?.has(u.id) === true}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
