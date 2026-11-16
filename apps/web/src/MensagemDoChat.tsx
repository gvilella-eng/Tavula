import type { Mensagem, Usuario } from "@tabletop/shared";
import { Bot, EyeOff, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { CartaoDaCaracteristicaNoChat, CartaoDaMagiaNoChat } from "./CartaoDaMagia";
import { CartaoDeRolagem } from "./CartaoDeRolagem";
import type { ImagensDoMapa } from "./mapa/mapaPixi";
import { ehCartaoDeRolagem } from "./rolagem/agrupar";
import { CorpoDaRolagemLivre, CorpoDoModelo } from "./rolagem/CorpoDaRolagem";

type Props = {
  mensagem: Mensagem;
  usuarios: Usuario[];
  euId: string;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  /** Q5: a mensagem anterior é do mesmo remetente e também é um cartão de rolagem: o cabeçalho é dividido. */
  seguida?: boolean;
};

function hora(emReal: number): string {
  return new Date(emReal).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** O texto com cada `[[...]]` trocado pelo resultado da rolagem correspondente (na ordem). */
function textoComRolagens(mensagem: Mensagem): ReactNode[] {
  const rolagens = mensagem.rolagens ?? [];
  const partes = (mensagem.texto ?? "").split(/(\[\[.*?\]\])/g);
  let proxima = 0;
  return partes.map((parte, i) => {
    if (/^\[\[.*\]\]$/.test(parte)) {
      const r = rolagens[proxima++];
      // biome-ignore lint/suspicious/noArrayIndexKey: a lista é montada de uma vez e não muda
      return r ? <CartaoDeRolagem key={i} rolagem={r} embutido /> : <span key={i}>{parte}</span>;
    }
    // biome-ignore lint/suspicious/noArrayIndexKey: idem
    return <span key={i}>{parte}</span>;
  });
}

/** Uma mensagem do chat: quem falou (retrato e nome), a hora, o tipo e o conteúdo. */
export function MensagemDoChat({
  mensagem,
  usuarios,
  euId,
  imagens,
  versaoDasImagens,
  seguida,
}: Props) {
  const autor = usuarios.find((u) => u.id === mensagem.autorId);
  // 7b-1: o aviso de uma automação não tem autor: aparece como "A mesa".
  const nome = mensagem.como?.nome ?? autor?.nome ?? (mensagem.tipo === "aviso" ? "A mesa" : "?");
  const cor = autor?.cor ?? "#666";
  const nomesDe = (ids: string[]) =>
    ids.map((id) => usuarios.find((u) => u.id === id)?.nome ?? "?").join(", ");

  let etiqueta: ReactNode = null;
  if (mensagem.oculta && ehCartaoDeRolagem(mensagem)) {
    // Q5: a rolagem oculta é uma linha pequena com a marca dentro dela (rolagem/CartaoNoChat.tsx)
    etiqueta = null;
  } else if (mensagem.oculta) {
    etiqueta = (
      <span className="etiqueta-sigilo oculta" data-testid="etiqueta-oculta">
        <EyeOff size={12} /> Rolagem oculta
      </span>
    );
  } else if (mensagem.visivelPara !== "todos") {
    const destinatarios = mensagem.visivelPara.ids;
    const texto =
      mensagem.autorId === euId
        ? `Sussurro para ${nomesDe(destinatarios)}`
        : destinatarios.includes(euId)
          ? `Sussurro de ${autor?.nome ?? "?"}`
          : `Sussurro para ${nomesDe(destinatarios)}`;
    etiqueta = (
      <span className="etiqueta-sigilo sussurro" data-testid="etiqueta-sussurro">
        <Lock size={12} /> {texto}
      </span>
    );
  }

  const classes = [
    "mensagem-chat",
    `tipo-${mensagem.tipo}`,
    mensagem.acao ? "acao" : "",
    mensagem.oculta ? "oculta" : "",
    !mensagem.oculta && mensagem.visivelPara !== "todos" ? "sussurro" : "",
    mensagem.autorId === euId ? "minha" : "",
    seguida ? "seguida" : "",
  ]
    .filter(Boolean)
    .join(" ");

  let corpo: ReactNode;
  if (mensagem.tipo === "magia" && mensagem.magia) {
    corpo = <CartaoDaMagiaNoChat magia={mensagem.magia} espaco={mensagem.espaco} />;
  } else if (mensagem.tipo === "caracteristica" && mensagem.caracteristica) {
    corpo = <CartaoDaCaracteristicaNoChat caracteristica={mensagem.caracteristica} />;
  } else if (mensagem.tipo === "modelo") {
    corpo = (
      <>
        {mensagem.texto && <p className="texto-chat">{mensagem.texto}</p>}
        {mensagem.modelo && <CorpoDoModelo mensagem={mensagem} modelo={mensagem.modelo} />}
      </>
    );
  } else if (mensagem.tipo === "rolagem" && mensagem.inline) {
    corpo = (
      <p className={`texto-chat ${mensagem.acao ? "acao-chat" : ""}`}>
        {mensagem.acao && <em>{nome} </em>}
        {textoComRolagens(mensagem)}
      </p>
    );
  } else if (mensagem.tipo === "rolagem") {
    corpo = <CorpoDaRolagemLivre mensagem={mensagem} />;
  } else if (mensagem.acao) {
    corpo = (
      <p className="texto-chat acao-chat">
        <em>
          {nome} {mensagem.texto}
        </em>
      </p>
    );
  } else {
    corpo = <p className="texto-chat">{mensagem.texto}</p>;
  }

  return (
    <article
      className={classes}
      data-testid="chat-mensagem"
      data-seq={mensagem.seq}
      data-tipo={mensagem.tipo}
      data-autor={mensagem.autorId}
    >
      <Avatar
        imagens={imagens}
        versao={versaoDasImagens}
        hash={mensagem.como?.retratoHash}
        nome={nome}
        cor={cor}
        redondo
        className="pequeno"
      />
      <div className="mensagem-corpo">
        <header>
          <strong className="mensagem-autor" data-testid="chat-autor">
            {nome}
          </strong>
          {mensagem.como && autor && <span className="mensagem-por">({autor.nome})</span>}
          {mensagem.peloClaude && (
            <span className="selo-pelo-claude" data-testid="chat-pelo-claude">
              <Bot size={11} aria-hidden="true" /> pelo Claude
            </span>
          )}
          <time className="mensagem-hora">{hora(mensagem.emReal)}</time>
        </header>
        {etiqueta}
        {corpo}
      </div>
    </article>
  );
}
