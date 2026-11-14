import {
  type EspacoNoChat,
  type MagiaDoCompendio,
  ROTULO_DO_NIVEL_DE_MAGIA,
  textoDaQuantidade,
} from "@tabletop/shared";
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
        <span className="etiqueta-magia" data-testid="marca-concentracao">
          Concentração
        </span>
      )}
      {magia.ritual && (
        <span className="etiqueta-magia" data-testid="marca-ritual">
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

/** "como ritual", "conjuração inata" ou "com espaço de 5º" (e, com quantidade, " · 4 dardos"): a etiqueta do cartão. */
export function textoDoEspacoNoCartao(e: EspacoNoChat): string {
  if (e.ritual) return "como ritual";
  if (e.inata) return "conjuração inata";
  const q = e.quantidade ? ` · ${textoDaQuantidade(e.quantidade.total, e.quantidade.unidade)}` : "";
  return `com espaço de ${e.nivel}º${q}`;
}

/**
 * O cartão de uma magia no chat: nome, nível, escola, marcas e uma linha com tempo, alcance e duração; a
 * descrição fica recolhida até alguém abrir.
 */
export function CartaoDaMagiaNoChat({
  magia,
  espaco,
}: {
  magia: MagiaDoCompendio;
  /** O espaço, quando a magia foi conjurada acima do nível dela (V6), como ritual ou por Conjuração inata (N2). */
  espaco?: EspacoNoChat | undefined;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <section className="cartao-magia-chat" data-testid="magia-chat" data-aberta={aberta}>
      <header>
        <strong data-testid="magia-chat-nome">{magia.nome}</strong>
        {magia.nomeOriginal && <em className="nome-original">{magia.nomeOriginal}</em>}
      </header>
      <p className="nivel-e-escola">
        {linhaDeNivelEEscola(magia)} <MarcasDaMagia magia={magia} />
        {espaco !== undefined && (
          <span className="etiqueta-magia" data-testid="magia-chat-espaco">
            {textoDoEspacoNoCartao(espaco)}
          </span>
        )}
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

/** O cartão de uma característica da ficha no chat (V4a): título e descrição recolhida até alguém abrir. */
export function CartaoDaCaracteristicaNoChat({
  caracteristica,
}: {
  caracteristica: { nome: string; descricao: string; origem?: string | undefined };
}) {
  const [aberta, setAberta] = useState(false);
  const temTexto = caracteristica.descricao.trim() !== "";
  return (
    <section className="cartao-magia-chat" data-testid="caracteristica-chat" data-aberta={aberta}>
      <header>
        <strong data-testid="caracteristica-chat-nome">{caracteristica.nome}</strong>
      </header>
      {caracteristica.origem && (
        <p className="nivel-e-escola" data-testid="caracteristica-chat-origem">
          {caracteristica.origem}
        </p>
      )}
      {temTexto && (
        <button
          type="button"
          className="alternar-descricao"
          data-testid="caracteristica-chat-alternar"
          aria-expanded={aberta}
          onClick={() => setAberta(!aberta)}
        >
          {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {aberta ? "Esconder a descrição" : "Mostrar a descrição"}
        </button>
      )}
      {aberta && (
        <div className="descricao-da-magia" data-testid="caracteristica-chat-descricao">
          <p className="texto-da-magia">{caracteristica.descricao}</p>
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
