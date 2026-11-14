import {
  type Mensagem,
  ROTULO_DA_VANTAGEM,
  textoDaQuantidade,
  type Usuario,
} from "@tabletop/shared";
import { Bot, EyeOff, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import {
  CartaoDaCaracteristicaNoChat,
  CartaoDaMagiaNoChat,
  textoDoEspacoNoCartao,
} from "./CartaoDaMagia";
import { CartaoDeRolagem, ChipsDoD20, naturalDe } from "./CartaoDeRolagem";
import type { ImagensDoMapa } from "./mapa/mapaPixi";

type Props = {
  mensagem: Mensagem;
  usuarios: Usuario[];
  euId: string;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
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

function textoDaVantagem(v: "normal" | "vantagem" | "desvantagem"): string {
  return v === "normal" ? "" : ROTULO_DA_VANTAGEM[v];
}

/** "1d20+6" com espaços, para o texto de apoio do bloco. */
function formula(expressao: string): string {
  return expressao.replace(/([+-])/g, " $1 ").trim();
}

/**
 * "com espaço de 5º" (ou "como ritual", "conjuração inata", "com espaço de 2º · 4 dardos"): o subtítulo do cartão
 * quando a magia subiu de nível sem dado a mais, foi ritual ou inata.
 */
function etiquetaDoEspaco(mensagem: Mensagem) {
  const e = mensagem.espaco;
  if (!e || e.extra) return null;
  return (
    <span className="etiqueta-vantagem" data-testid="espaco-usado">
      {textoDoEspacoNoCartao(e)}
    </span>
  );
}

/** Os dardos ou raios rolados um por um (N2): o bloco colado com cada dano e o total. */
function BlocoDaQuantidade({ mensagem }: { mensagem: Mensagem }) {
  const q = mensagem.espaco?.quantidade;
  if (!q?.rolagens) return null;
  const rotulo = q.unidade.charAt(0).toUpperCase() + q.unidade.slice(1);
  return (
    <div className="modelo-bloco bloco-espaco" data-testid="bloco-quantidade">
      <div className="bloco-cabeca">
        <strong className="bloco-titulo" data-testid="bloco-quantidade-titulo">
          {textoDaQuantidade(q.total, q.unidade)} · {formula(q.rolagens[0]?.expressao ?? "")} cada
        </strong>
      </div>
      <div className="bloco-linha">
        {q.rolagens.map((r, i) => (
          <CartaoDeRolagem
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista é fixa
            key={i}
            rolagem={r}
            rotulo={`${rotulo} ${i + 1}`}
            dano
            semExpressao
          />
        ))}
        <span className="bloco-total" data-testid="bloco-quantidade-total">
          Total <strong>{q.soma}</strong>
        </span>
      </div>
    </div>
  );
}

/**
 * O bloco colado embaixo do cartão da rolagem (V6): o dado a mais por nível acima do nível da magia, o total (o dano
 * principal mais o extra) e, com salvaguarda que dá metade, a metade. Mesma mensagem do cartão, então outra rolagem
 * nunca cai no meio e o crítico dobra os dois.
 */
function BlocoDoEspaco({ mensagem }: { mensagem: Mensagem }) {
  const e = mensagem.espaco;
  if (!e?.extra) return <BlocoDaQuantidade mensagem={mensagem} />;
  const critico = mensagem.modelo?.modelo === "ataque" && mensagem.modelo.critico;
  return (
    <div
      className="modelo-bloco bloco-espaco"
      data-testid="bloco-espaco"
      data-critico={critico || undefined}
    >
      <div className="bloco-cabeca">
        <strong className="bloco-titulo" data-testid="bloco-espaco-titulo">
          Espaço de {e.nivel}º · +{formula(e.extra.expressao)}
        </strong>
        {critico && (
          <span className="tag-natural critico" title="Os dados do extra dobram no crítico">
            Dobrado
          </span>
        )}
      </div>
      <div className="bloco-linha">
        <CartaoDeRolagem
          rolagem={e.extra.rolagem}
          rotulo="Extra"
          dano
          critico={critico}
          semExpressao
        />
        <span className="bloco-total" data-testid="bloco-espaco-total">
          Total <strong>{e.extra.total}</strong>
        </span>
        {e.extra.metade !== undefined && (
          <span className="bloco-sub" data-testid="bloco-espaco-metade">
            metade {e.extra.metade}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * A rolagem de um teste ou ataque no chat (V4a): um bloco baixo. O nome do teste fica em destaque, o total é o
 * número grande e os d20 ficam discretos (com vantagem ou desvantagem aparecem os dois, o descartado esmaecido). O
 * crítico (verde) e o 1 natural (vermelho) são iguais em todos os temas.
 */
function ResultadoDoModelo({ mensagem }: { mensagem: Mensagem }) {
  const m = mensagem.modelo;
  if (!m) return null;
  if (m.modelo === "ataque") {
    const meio = m.salvaguarda?.sucesso === "metade" ? Math.floor(m.dano.total / 2) : null;
    return (
      <div
        className="modelo modelo-bloco ataque"
        data-testid="modelo-ataque"
        data-critico={m.critico || undefined}
        data-falha-critica={m.falhaCritica || undefined}
      >
        <div className="bloco-cabeca">
          <strong className="bloco-titulo">Ataque · {m.nome}</strong>
          {m.vantagem !== "normal" && (
            <span className="etiqueta-vantagem">{textoDaVantagem(m.vantagem)}</span>
          )}
          {etiquetaDoEspaco(mensagem)}
        </div>
        <div className="bloco-linha">
          <CartaoDeRolagem rolagem={m.acerto} rotulo="Acerto" semExpressao />
          <ChipsDoD20 rolagem={m.acerto} />
          {m.critico && (
            <span className="tag-natural critico" data-testid="modelo-veredito">
              Crítico
            </span>
          )}
          {m.falhaCritica && (
            <span className="tag-natural falha" data-testid="modelo-veredito">
              1 natural
            </span>
          )}
          {m.salvaguarda && (
            <span className="bloco-cd" data-testid="modelo-cd">
              <span className="bloco-cd-valor">CD {m.salvaguarda.cd}</span>
              <span className="bloco-sub">
                {m.salvaguarda.atributo},{" "}
                {m.salvaguarda.sucesso === "metade" ? "metade no sucesso" : "nada no sucesso"}
              </span>
            </span>
          )}
          <CartaoDeRolagem
            rolagem={m.dano}
            rotulo={m.critico ? "Dano crítico" : "Dano"}
            dano
            critico={m.critico}
            semExpressao
          />
          <span className="bloco-formula" data-testid="modelo-dano-formula">
            {formula(m.dano.expressao)}
            {m.danoTipo ? ` ${m.danoTipo.toLowerCase()}` : ""}
            {m.nivelDoTruque ? ` (nível ${m.nivelDoTruque})` : ""}
            {meio !== null ? ` · metade: ${meio}` : ""}
          </span>
        </div>
      </div>
    );
  }
  if (m.modelo === "vida") {
    return (
      <div className="modelo modelo-bloco teste" data-testid="modelo-vida">
        <CartaoDeRolagem rolagem={m.rolagem} semExpressao />
        <span className="bloco-textos">
          <strong className="bloco-titulo">{m.nome}</strong>
          <span className="bloco-sub" data-testid="modelo-vida-pv">
            +{m.curou} PV ({m.pvAtual}/{m.pvMax})
          </span>
        </span>
      </div>
    );
  }
  const veredito =
    m.sucesso === undefined ? null : (
      <span
        className={`tag-natural ${m.sucesso ? "sucesso" : "falha"}`}
        data-testid="modelo-veredito"
      >
        {m.sucesso ? "Sucesso" : "Falha"}
      </span>
    );
  return (
    <div
      className="modelo modelo-bloco teste"
      data-testid="modelo-teste"
      data-sucesso={m.sucesso === undefined ? undefined : String(m.sucesso)}
      data-critico={m.critico || undefined}
      data-falha-critica={m.falhaCritica || undefined}
    >
      <CartaoDeRolagem rolagem={m.rolagem} semExpressao />
      <span className="bloco-textos">
        <strong className="bloco-titulo">{m.nome}</strong>
        <span className="bloco-sub">
          {formula(m.rolagem.expressao)}
          {m.vantagem !== "normal" && ` · ${textoDaVantagem(m.vantagem).toLowerCase()}`}
          {m.cd !== undefined && <span className="etiqueta-cd">CD {m.cd}</span>}
          {veredito}
          {m.sucesso === undefined && m.critico && (
            <span className="tag-natural critico">20 natural</span>
          )}
          {m.sucesso === undefined && m.falhaCritica && (
            <span className="tag-natural falha">1 natural</span>
          )}
        </span>
      </span>
      <ChipsDoD20 rolagem={m.rolagem} />
    </div>
  );
}

/** Uma mensagem do chat: quem falou (retrato e nome), a hora, o tipo e o conteúdo. */
export function MensagemDoChat({ mensagem, usuarios, euId, imagens, versaoDasImagens }: Props) {
  const autor = usuarios.find((u) => u.id === mensagem.autorId);
  // 7b-1: o aviso de uma automação não tem autor: aparece como "A mesa".
  const nome = mensagem.como?.nome ?? autor?.nome ?? (mensagem.tipo === "aviso" ? "A mesa" : "?");
  const cor = autor?.cor ?? "#666";
  const nomesDe = (ids: string[]) =>
    ids.map((id) => usuarios.find((u) => u.id === id)?.nome ?? "?").join(", ");

  let etiqueta: ReactNode = null;
  if (mensagem.oculta) {
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
        <div className="cartao-colado">
          <ResultadoDoModelo mensagem={mensagem} />
          <BlocoDoEspaco mensagem={mensagem} />
        </div>
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
    corpo = (
      <div className="cartao-colado">
        <div className="modelo modelo-bloco livre" data-testid="modelo-livre">
          {mensagem.texto && <strong className="bloco-titulo">{mensagem.texto}</strong>}
          {etiquetaDoEspaco(mensagem)}
          <div className="bloco-linha">
            {(mensagem.rolagens ?? []).map((r, i) => {
              const natural = naturalDe(r);
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: a lista é fixa
                <span key={i} className="bloco-item">
                  <CartaoDeRolagem rolagem={r} />
                  <ChipsDoD20 rolagem={r} />
                  {natural === "20" && <span className="tag-natural critico">20 natural</span>}
                  {natural === "1" && <span className="tag-natural falha">1 natural</span>}
                </span>
              );
            })}
          </div>
        </div>
        <BlocoDoEspaco mensagem={mensagem} />
      </div>
    );
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
