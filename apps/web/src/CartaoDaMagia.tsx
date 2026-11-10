import { type MagiaDoCompendio, ROTULO_DO_NIVEL_DE_MAGIA } from "@tabletop/shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";

/** "3º nível · Evocação" (ou "Truque · Evocação"): a linha que abre qualquer cartão de magia. */
export const linhaDeNivelEEscola = (m: MagiaDoCompendio): string =>
  `${ROTULO_DO_NIVEL_DE_MAGIA(m.nivel)} · ${m.escola}`;

/** As marcas de concentração e de ritual (nada quando não há). */
export function MarcasDaMagia({ magia }: { magia: MagiaDoCompendio }) {
  if (!magia.concentracao && !magia.ritual) return null;
  return (
    <span className="marcas-da-magia">
      {magia.concentracao && (
        <span className="etiqueta-magia" data-testid="marca-concentracao" title="Concentração">
          Concentração
        </span>
      )}
      {magia.ritual && (
        <span
          className="etiqueta-magia"
          data-testid="marca-ritual"
          title="Pode ser conjurada como ritual"
        >
          Ritual
        </span>
      )}
    </span>
  );
}

/** Tempo, alcance, componentes e duração, em lista de rótulo e valor. */
export function CamposDaMagia({
  magia,
  somenteComponentes = false,
}: {
  magia: MagiaDoCompendio;
  somenteComponentes?: boolean;
}) {
  const campos: [string, string][] = somenteComponentes
    ? [["Componentes", magia.componentes]]
    : [
        ["Tempo de conjuração", magia.tempo],
        ["Alcance", magia.alcance],
        ["Componentes", magia.componentes],
        ["Duração", magia.duracao],
      ];
  return (
    <dl className="campos-da-magia">
      {campos.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A descrição (com quebras de linha) e o "Em níveis superiores". */
export function TextoDaMagia({ magia }: { magia: MagiaDoCompendio }) {
  return (
    <>
      <p className="texto-da-magia" data-testid="magia-texto">
        {magia.descricao}
      </p>
      {magia.emNiveisSuperiores && (
        <p className="texto-da-magia" data-testid="magia-niveis-superiores">
          <strong>Em níveis superiores. </strong>
          {magia.emNiveisSuperiores}
        </p>
      )}
    </>
  );
}

/**
 * O cartão de uma magia no chat: nome, nível, escola, marcas e uma linha com tempo, alcance e duração; a
 * descrição fica recolhida até alguém abrir.
 */
export function CartaoDaMagiaNoChat({ magia }: { magia: MagiaDoCompendio }) {
  const [aberta, setAberta] = useState(false);
  return (
    <section className="cartao-magia-chat" data-testid="magia-chat" data-aberta={aberta}>
      <header>
        <strong data-testid="magia-chat-nome">{magia.nome}</strong>
        {magia.nomeOriginal && <em className="nome-original">{magia.nomeOriginal}</em>}
      </header>
      <p className="nivel-e-escola">
        {linhaDeNivelEEscola(magia)} <MarcasDaMagia magia={magia} />
      </p>
      <p className="resumo-da-magia">
        {magia.tempo} · {magia.alcance} · {magia.duracao}
      </p>
      <button
        type="button"
        className="alternar-descricao"
        data-testid="magia-chat-alternar"
        aria-expanded={aberta}
        onClick={() => setAberta(!aberta)}
      >
        {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {aberta ? "Esconder a descrição" : "Mostrar a descrição"}
      </button>
      {aberta && (
        <div className="descricao-da-magia" data-testid="magia-chat-descricao">
          <CamposDaMagia magia={magia} somenteComponentes />
          <TextoDaMagia magia={magia} />
        </div>
      )}
    </section>
  );
}

/** Um bloco de rótulo + conteúdo (as ações do cartão). */
export function LinhaDeAcao({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="linha-de-acao">
      <span className="rotulo-de-acao">{rotulo}</span>
      {children}
    </div>
  );
}
