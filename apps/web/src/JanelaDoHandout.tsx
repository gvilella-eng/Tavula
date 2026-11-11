import type { Estado, Handout, Usuario, Visibilidade } from "@tabletop/shared";
import { ImagePlus, ScrollText, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BotaoComDica } from "./BotaoComDica";
import { Campo } from "./Campo";
import type { PedirImagem } from "./FaixaDeCenas";
import { FONTES_DO_HANDOUT, familiaDoHandout, idDaJanelaDoHandout } from "./handouts";
import { Janela } from "./janelas/Janela";
import type { ImagensDoMapa } from "./mapa/mapaPixi";
import { apagarRascunho, chaveDoRascunho, gravarRascunho, lerRascunho } from "./rascunho";
import { useImagem } from "./useImagem";
import type { Ocorrencia } from "./useSala";

type Enviar = (tipo: string, dados: object) => string | null;

const ESPERA_DO_ENVIO_MS = 400;

/** A imagem pequena de um handout (ou o pergaminho, se não tem imagem): a lista e o cabeçalho usam. */
export function MiniaturaDoHandout({
  handout,
  imagens,
  versao,
  className,
}: {
  handout: Pick<Handout, "imagemHash" | "titulo">;
  imagens: ImagensDoMapa | null;
  versao: number;
  className?: string;
}) {
  const url = useImagem(imagens, handout.imagemHash, versao);
  return (
    <span
      className={`handout-miniatura ${className ?? ""}`}
      data-com-imagem={url !== null}
      data-testid="handout-miniatura"
    >
      {url ? <img src={url} alt="" /> : <ScrollText size={16} aria-hidden="true" />}
    </span>
  );
}

type PropsDoTexto = {
  handout: Handout;
  usuarioId: string;
  pronto: boolean;
  enviar: Enviar;
  ouvir: (fn: (o: Ocorrencia) => void) => () => void;
};

/**
 * O texto do handout para o mestre: sem botão "salvar" (envia 400 ms depois de parar) e com o rascunho no
 * localStorage até a sala confirmar, como o campo de nota do Lote 1 (o mesmo comportamento, agora por handout).
 */
function CampoDoTexto({ handout, usuarioId, pronto, enviar, ouvir }: PropsDoTexto) {
  const chave = chaveDoRascunho(usuarioId, `handout:${handout.id}`);
  const [rascunho, setRascunho] = useState<string | null>(() => lerRascunho(chave));
  const rascunhoAtual = useRef(rascunho);
  const ultimoEnvio = useRef<{ id: string; texto: string } | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const servidorAtual = useRef(handout.texto);
  servidorAtual.current = handout.texto;

  function definirRascunho(texto: string | null) {
    rascunhoAtual.current = texto;
    setRascunho(texto);
    if (texto === null) apagarRascunho(chave);
    else gravarRascunho(chave, texto);
  }

  function enviarAgora(texto: string) {
    const id = enviar("handout.editar", { id: handout.id, mudancas: { texto } });
    ultimoEnvio.current = id ? { id, texto } : null;
  }

  // Conectou (ou reconectou): reenvia o rascunho que sobrou, ou o descarta se já não vale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só na transição de `pronto`
  useEffect(() => {
    if (!pronto) return;
    const texto = rascunhoAtual.current;
    if (texto === null) return;
    if (texto === servidorAtual.current) definirRascunho(null);
    else enviarAgora(texto);
  }, [pronto]);

  // A sala já tem o texto do rascunho (a confirmação pode não vir como evento: texto igual não gera evento): ele cumpriu o papel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando o texto da sala muda
  useEffect(() => {
    if (rascunhoAtual.current !== null && handout.texto === rascunhoAtual.current) {
      definirRascunho(null);
    }
  }, [handout.texto]);

  // A sala confirmou (ou recusou) o meu envio: o rascunho cumpriu o papel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ouvir` é estável
  useEffect(
    () =>
      ouvir((o) => {
        if (o.tipo !== "evento" && o.tipo !== "erro") return;
        const envio = ultimoEnvio.current;
        if (!envio) return;
        const meu =
          o.tipo === "evento"
            ? o.evento.tipo === "handout.alterado" && o.evento.origem.idPedido === envio.id
            : o.idPedido === envio.id;
        if (!meu) return;
        ultimoEnvio.current = null;
        if (o.tipo === "erro" || rascunhoAtual.current === envio.texto) definirRascunho(null);
      }),
    [ouvir],
  );

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function aoDigitar(texto: string) {
    definirRascunho(texto);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => enviarAgora(texto), ESPERA_DO_ENVIO_MS);
  }

  return (
    <textarea
      className="handout-texto handout-texto-campo"
      data-testid="handout-texto-campo"
      data-fonte={handout.fonte}
      aria-label="Texto do handout"
      placeholder="Escreva aqui o que os jogadores vão ler…"
      style={{ fontFamily: familiaDoHandout(handout.fonte) }}
      value={rascunho ?? handout.texto}
      maxLength={20_000}
      onChange={(e) => aoDigitar(e.target.value)}
    />
  );
}

/** Quem vê o handout: só o mestre, todos ou jogadores escolhidos (aplica na hora). */
function QuemVe({
  handout,
  jogadores,
  editar,
}: {
  handout: Handout;
  jogadores: Usuario[];
  editar: (mudancas: object) => void;
}) {
  const v = handout.visivel;
  const ids = v.tipo === "jogadores" ? v.ids : [];
  const definir = (visivel: Visibilidade) => editar({ visivel });
  function alternar(id: string) {
    const novos = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    definir(novos.length === 0 ? { tipo: "mestre" } : { tipo: "jogadores", ids: novos });
  }
  return (
    <fieldset className="quem-ve" data-testid="handout-quem-ve">
      <legend>Quem vê</legend>
      <div className="chips">
        <button
          type="button"
          className="chip"
          data-testid="handout-visib-mestre"
          aria-pressed={v.tipo === "mestre"}
          onClick={() => definir({ tipo: "mestre" })}
        >
          Só o mestre
        </button>
        <button
          type="button"
          className="chip"
          data-testid="handout-visib-todos"
          aria-pressed={v.tipo === "todos"}
          onClick={() => definir({ tipo: "todos" })}
        >
          Todos os jogadores
        </button>
        {jogadores.map((u) => (
          <button
            key={u.id}
            type="button"
            className="chip"
            data-testid={`handout-visib-jogador-${u.id}`}
            aria-pressed={v.tipo === "jogadores" && ids.includes(u.id)}
            onClick={() =>
              v.tipo === "jogadores" ? alternar(u.id) : definir({ tipo: "jogadores", ids: [u.id] })
            }
          >
            {u.nome}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type Props = {
  handout: Handout;
  /** Posição na pilha de janelas abertas (desloca a janela nova para não cobrir a anterior). */
  cascata: number;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  pronto: boolean;
  ouvir: (fn: (o: Ocorrencia) => void) => () => void;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  pedirImagem: PedirImagem;
  aoFechar: () => void;
};

/**
 * Janela de um handout (V3): o título, a imagem no alto (se houver) e o texto na fonte escolhida. O jogador só
 * lê; o mestre edita ali mesmo (título, fonte, texto, imagem e quem vê) e pode "Mostrar agora", que abre esta
 * mesma janela na tela de quem vê o handout.
 */
export function JanelaDoHandout({
  handout: h,
  cascata,
  estado,
  eu,
  enviar,
  pronto,
  ouvir,
  imagens,
  versaoDasImagens,
  pedirImagem,
  aoFechar,
}: Props) {
  const euMestre = eu.papel === "mestre";
  const jogadores = estado.usuarios.filter((u) => u.papel === "jogador");
  const urlDaImagem = useImagem(imagens, h.imagemHash, versaoDasImagens);
  const [avisoDeMostrar, setAvisoDeMostrar] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const editar = (mudancas: object) => enviar("handout.editar", { id: h.id, mudancas });
  const soOMestre = h.visivel.tipo === "mestre";
  const quemVe =
    h.visivel.tipo === "todos"
      ? "todos os jogadores"
      : h.visivel.tipo === "jogadores"
        ? h.visivel.ids.map((id) => jogadores.find((u) => u.id === id)?.nome ?? id).join(", ")
        : "";

  const imagem = h.imagemHash ? (
    <div
      className="handout-imagem"
      data-testid="handout-imagem"
      data-com-imagem={urlDaImagem !== null}
    >
      {urlDaImagem ? <img src={urlDaImagem} alt="" /> : <ScrollText size={28} aria-hidden="true" />}
    </div>
  ) : null;

  return (
    <Janela
      id={idDaJanelaDoHandout(h.id)}
      titulo={`Handout: ${h.titulo}`}
      testid="janela-handout"
      testidDoCabecalho="janela-handout-cabecalho"
      testidDoFechar="janela-handout-fechar"
      testidDoRedimensionar="janela-handout-redimensionar"
      rotuloDoFechar="Fechar o handout"
      dados={{ "data-handout-id": h.id }}
      classe="janela-handout"
      redimensionar="ambos"
      minLargura={320}
      minAltura={240}
      largura={(area) => Math.max(320, Math.min(480, area.largura - 48))}
      altura={(area) => Math.max(240, Math.min(560, Math.round(area.altura * 0.8)))}
      padrao={() => ({ x: 56 + cascata * 28, y: 40 + cascata * 28 })}
      aoFechar={aoFechar}
      cabecalho={
        <>
          <ScrollText size={16} aria-hidden="true" />
          <strong className="handout-cabecalho-titulo" data-testid="janela-handout-titulo">
            {h.titulo}
          </strong>
        </>
      }
    >
      {euMestre ? (
        <div className="handout-editor" data-testid="handout-editor">
          <div className="handout-topo">
            <button
              type="button"
              className="handout-imagem-botao"
              data-testid="handout-imagem-escolher"
              data-com-imagem={urlDaImagem !== null}
              title={h.imagemHash ? "Trocar a imagem" : "Escolher uma imagem"}
              aria-label={
                h.imagemHash ? "Trocar a imagem do handout" : "Escolher uma imagem para o handout"
              }
              onClick={() =>
                pedirImagem("Imagem do handout", "retrato", (imagemHash) => editar({ imagemHash }))
              }
            >
              {urlDaImagem ? (
                <img src={urlDaImagem} alt="" />
              ) : (
                <ImagePlus size={22} aria-hidden="true" />
              )}
            </button>
            <div className="handout-topo-campos">
              <Campo
                testid="handout-titulo-campo"
                rotulo="Título"
                valor={h.titulo}
                aoConfirmar={(t) => t && editar({ titulo: t })}
              />
              {h.imagemHash && (
                <button
                  type="button"
                  className="fraco"
                  data-testid="handout-imagem-tirar"
                  onClick={() => editar({ imagemHash: null })}
                >
                  Tirar a imagem
                </button>
              )}
            </div>
          </div>
          <fieldset className="handout-fontes" data-testid="handout-fontes">
            <legend>Fonte</legend>
            <div className="chips">
              {FONTES_DO_HANDOUT.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="chip"
                  data-testid={`handout-fonte-${f.id}`}
                  aria-pressed={h.fonte === f.id}
                  style={{ fontFamily: f.familia }}
                  onClick={() => editar({ fonte: f.id })}
                >
                  {f.nome}
                </button>
              ))}
            </div>
          </fieldset>
          <CampoDoTexto
            handout={h}
            usuarioId={eu.id}
            pronto={pronto}
            enviar={enviar}
            ouvir={ouvir}
          />
          <QuemVe handout={h} jogadores={jogadores} editar={editar} />
          <div className="handout-acoes">
            <BotaoComDica
              testid="handout-mostrar"
              className="primario"
              nome="Mostrar agora"
              dica="Abre este handout na tela de quem pode vê-lo, agora."
              motivo={
                soOMestre ? "Só você vê este handout: escolha quem vê antes de mostrar." : null
              }
              onClick={() => {
                if (enviar("handout.mostrar", { id: h.id })) {
                  setAvisoDeMostrar(`Aberto para ${quemVe}.`);
                }
              }}
            >
              <Send size={14} /> Mostrar agora
            </BotaoComDica>
            {apagando ? (
              <button
                type="button"
                className="perigo"
                data-testid="handout-apagar-confirmar"
                onClick={() => {
                  enviar("handout.apagar", { id: h.id });
                  aoFechar();
                }}
              >
                <Trash2 size={14} /> Confirmar: apagar o handout
              </button>
            ) : (
              <button
                type="button"
                className="perigo"
                data-testid="handout-apagar"
                onClick={() => setApagando(true)}
              >
                <Trash2 size={14} /> Apagar
              </button>
            )}
          </div>
          {soOMestre && (
            <p className="nota" data-testid="handout-mostrar-aviso">
              Só você vê este handout: ninguém mais o receberia. Escolha quem vê para poder
              mostrá-lo.
            </p>
          )}
          {avisoDeMostrar && !soOMestre && (
            <p className="nota" role="status" data-testid="handout-mostrado-aviso">
              {avisoDeMostrar}
            </p>
          )}
        </div>
      ) : (
        <article className="handout-leitura" data-testid="handout-leitura">
          {imagem}
          <h3 className="handout-titulo" data-testid="handout-titulo">
            {h.titulo}
          </h3>
          <div
            className="handout-texto"
            data-testid="handout-texto"
            data-fonte={h.fonte}
            style={{ fontFamily: familiaDoHandout(h.fonte) }}
          >
            {h.texto}
          </div>
        </article>
      )}
    </Janela>
  );
}
