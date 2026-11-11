import type { Presenca, Usuario } from "@tabletop/shared";
import { useId, useRef, useState } from "react";
import { iniciais } from "./Avatar";
import { BotaoComDica } from "./BotaoComDica";
import { corDoTextoSobre } from "./contrasteDeCor";
import { useFecharFora } from "./Popover";

type Props = {
  usuarios: Usuario[];
  presenca: Record<string, Presenca>;
  euId: string;
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
}: {
  u: Usuario;
  estado: Presenca;
  euId: string;
  naLista?: boolean;
}) {
  const dica = `${u.nome} (${u.papel})${u.id === euId ? " — você" : ""}: ${ROTULO[estado]}`;
  return (
    <li
      className={naLista ? "presenca-item presenca-linha" : "presenca-item"}
      data-testid={`presenca-${u.id}`}
      data-estado={estado}
      // Na lista o nome está à vista; só os avatares de iniciais precisam do nome e do estado.
      title={naLista ? undefined : dica}
    >
      <span className="avatar" style={{ background: u.cor, color: corDoTextoSobre(u.cor) }}>
        {iniciais(u.nome)}
        <span className="ponto-estado" aria-hidden="true" />
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
export function PresencaNoTopo({ usuarios, presenca, euId }: Props) {
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
          <Item key={u.id} u={u} estado={estadoDe(u)} euId={euId} />
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
              <Item key={u.id} u={u} estado={estadoDe(u)} euId={euId} naLista />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
