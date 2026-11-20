import {
  automacoesDe,
  type Bloco,
  type Estado,
  type Fluxo,
  FluxoSchema,
  fraseDoFluxo,
  type Gatilho,
  nomesDaMesa,
} from "@tabletop/shared";
import { ArrowLeft, Braces, ExternalLink, Play, Plus, Save, Trash2, Undo2 } from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Fontes } from "../assets/fontes";
import { BotaoComDica } from "../BotaoComDica";
import type { SomEscolhido } from "../som/EscolherSom";
import {
  blocoEm,
  type Caminho,
  caminhoDeLista,
  caminhosDosBlocos,
  type ErroDoEditor,
  errosDoFluxo,
  fluxoNovo,
  type GrupoDePeca,
  grupoDoBloco,
  idDoCaminho,
  inserirEm,
  listaEm,
  moverBloco,
  PECAS,
  type Peca,
  ROTULO_DO_GRUPO,
  rotuloDoBloco,
  rotuloDoGatilho,
  type Selecao,
  tirarEm,
  trocarEm,
} from "./blocos";
import { VistaJson } from "./Editor";
import { type ErroDeCampo, errosEmPortugues } from "./erros";
import { PainelDoBloco } from "./PainelDoBloco";
import { idDoNome } from "./rascunho";

type Enviar = (tipo: string, dados: object) => string | null;

export type PropsDoEditor = {
  estado: Estado;
  enviar: Enviar;
  /** `null`: uma automação nova. */
  fluxoId: string | null;
  /** O gatilho com que a automação nova nasce (a zona que pediu "+ automação para esta zona"). */
  gatilhoInicial?: Gatilho | undefined;
  fontes: Fontes | null;
  registrarSom: ((arquivo: File) => Promise<SomEscolhido>) | null;
  aoVoltar: () => void;
  /** Abre este editor numa janela do navegador (só na mesa; a janela própria não tem o botão). */
  aoAbrirEmJanela?: ((fluxoId: string | null) => void) | undefined;
};

const COR_DO_GRUPO: Record<GrupoDePeca, string> = {
  quando: "var(--acento-forte)",
  fluxo: "var(--etiqueta-azul)",
  faca: "var(--sucesso)",
};

/**
 * O editor de automação por blocos (AU1): a barra de cima (voltar, nome, ligada, testar, desfazer, salvar), as peças em três
 * cores à esquerda, o fluxo no meio (a árvore do gatilho, arrumada sozinha: cada trilha é uma fileira, "se" e "sortear" têm
 * as saídas sim e não, "para cada" tem um corpo), os campos do bloco escolhido à direita e a frase em português embaixo.
 * Nada salva com erro: cada bloco com problema ganha contorno e a mensagem.
 */
export function EditorDeFluxo(p: PropsDoEditor) {
  const { estado } = p;
  const a = automacoesDe(estado);
  const existente = p.fluxoId === null ? undefined : a.fluxos.find((f) => f.id === p.fluxoId);
  const idNovo = useRef<string | null>(null);
  const [rascunho, setRascunho] = useState<Fluxo>(() => {
    if (existente) return structuredClone(existente);
    const f = fluxoNovo(`auto-${Math.random().toString(36).slice(2, 10)}`);
    return p.gatilhoInicial ? { ...f, gatilho: p.gatilhoInicial } : f;
  });
  const [historico, setHistorico] = useState<Fluxo[]>([]);
  const [selecao, setSelecao] = useState<Selecao>({ tipo: "gatilho" });
  const [mais, setMais] = useState<{ lista: Caminho; indice: number } | null>(null);
  const [tentou, setTentou] = useState(false);
  const [erroDoJson, setErroDoJson] = useState<ErroDeCampo[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const jaCriado = useRef(existente !== undefined);

  const nomes = useMemo(() => nomesDaMesa(estado), [estado]);
  const erros = useMemo(() => errosDoFluxo(rascunho, estado), [rascunho, estado]);
  const frase = useMemo(() => fraseDoFluxo(rascunho, nomes), [rascunho, nomes]);
  const errosDe = (onde: string) => erros.filter((e) => e.onde === onde);

  function mudar(novo: Fluxo) {
    setHistorico((h) => [...h.slice(-49), rascunho]);
    setRascunho(novo);
    setAviso(null);
  }
  function desfazer() {
    setHistorico((h) => {
      const anterior = h.at(-1);
      if (anterior === undefined) return h;
      setRascunho(anterior);
      setSelecao((s) =>
        s.tipo === "bloco" && blocoEm(anterior, s.caminho) === undefined ? { tipo: "gatilho" } : s,
      );
      return h.slice(0, -1);
    });
  }

  function inserirPeca(peca: Peca, lista?: Caminho, indice?: number) {
    const feito = peca.criar();
    if ("gatilho" in feito) {
      mudar({ ...rascunho, gatilho: feito.gatilho });
      setSelecao({ tipo: "gatilho" });
      return;
    }
    let destino = lista;
    let pos = indice;
    if (destino === undefined) {
      if (selecao.tipo === "bloco") {
        destino = caminhoDeLista(selecao.caminho);
        pos = Number(selecao.caminho.at(-1)) + 1;
      } else {
        destino = [0];
        pos = listaEm(rascunho, [0])?.length ?? 0;
      }
    }
    const novoFluxo = inserirEm(rascunho, destino, pos ?? 0, feito.bloco);
    mudar(novoFluxo);
    setSelecao({ tipo: "bloco", caminho: [...destino, pos ?? 0] });
    setMais(null);
  }

  function tirar(caminho: Caminho) {
    mudar(tirarEm(rascunho, caminho));
    setSelecao({ tipo: "gatilho" });
  }
  function duplicar(caminho: Caminho) {
    const b = blocoEm(rascunho, caminho);
    if (b === undefined) return;
    const lista = caminhoDeLista(caminho);
    const pos = Number(caminho.at(-1)) + 1;
    mudar(inserirEm(rascunho, lista, pos, structuredClone(b)));
    setSelecao({ tipo: "bloco", caminho: [...lista, pos] });
  }
  function trocarBloco(caminho: Caminho, novo: Bloco) {
    mudar(trocarEm(rascunho, caminho, novo));
  }

  function soltarEm(lista: Caminho, indice: number, e: DragEvent) {
    e.preventDefault();
    const idPeca = e.dataTransfer.getData("text/x-peca");
    if (idPeca) {
      const peca = PECAS.find((x) => x.id === idPeca);
      if (peca) inserirPeca(peca, lista, indice);
      return;
    }
    const origem = e.dataTransfer.getData("text/x-bloco");
    if (!origem) return;
    const de = JSON.parse(origem) as Caminho;
    const r = moverBloco(rascunho, de, lista, indice);
    if (r) {
      mudar(r.fluxo);
      setSelecao({ tipo: "bloco", caminho: r.caminho });
    }
  }

  function teclado(e: KeyboardEvent) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    const todos = caminhosDosBlocos(rascunho);
    const atual =
      selecao.tipo === "bloco"
        ? todos.findIndex((c) => idDoCaminho(c) === idDoCaminho(selecao.caminho))
        : -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      const prox = todos[atual + 1];
      if (prox) setSelecao({ tipo: "bloco", caminho: prox });
      else if (selecao.tipo === "gatilho" && todos[0])
        setSelecao({ tipo: "bloco", caminho: todos[0] });
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      if (atual > 0) setSelecao({ tipo: "bloco", caminho: todos[atual - 1] as Caminho });
      else if (atual === 0) setSelecao({ tipo: "gatilho" });
      e.preventDefault();
    } else if ((e.key === "Delete" || e.key === "Backspace") && selecao.tipo === "bloco") {
      tirar(selecao.caminho);
      e.preventDefault();
    }
  }

  // Foco: quando a seleção muda por teclado, o nó escolhido recebe o foco.
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id =
      selecao.tipo === "gatilho" ? "ed-no-gatilho" : `ed-no-${idDoCaminho(selecao.caminho)}`;
    const el = raiz.current?.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (el && document.activeElement?.closest(".ed-canvas") && document.activeElement !== el)
      el.focus();
  }, [selecao]);

  function salvar(): string | null {
    setTentou(true);
    if (erros.length > 0) {
      setAviso(
        erros.length === 1
          ? "Corrija este ponto para salvar."
          : `Corrija estes ${erros.length} pontos para salvar.`,
      );
      return null;
    }
    let id = idNovo.current ?? rascunho.id;
    if (!jaCriado.current) {
      if (idNovo.current === null) {
        idNovo.current = idDoNome(rascunho.nome, new Set(a.fluxos.map((f) => f.id)), "automacao");
      }
      id = idNovo.current;
      // (o que `enviar` devolve é o id do pedido, não um erro: a recusa da sala chega pelo aviso da mesa)
      p.enviar("fluxo.criar", { fluxo: { ...rascunho, id } });
      jaCriado.current = true;
    } else {
      const { id: _id, ...resto } = rascunho;
      p.enviar("fluxo.editar", {
        id,
        mudancas: {
          ...resto,
          fixado: rascunho.fixado ?? false,
          liberadoParaJogadores: rascunho.liberadoParaJogadores ?? false,
        },
      });
    }
    return id;
  }

  function salvarEVoltar() {
    if (salvar() !== null) p.aoVoltar();
  }
  function testar() {
    const id = salvar();
    if (id === null) return;
    p.enviar("fluxo.disparar", { id });
    setAviso("Disparado agora, uma vez.");
  }

  const [paraGuardar, setParaGuardar] = useState<Fluxo>(rascunho);
  useEffect(() => setParaGuardar(rascunho), [rascunho]);

  function aoMudarJson(v: unknown) {
    const lido = FluxoSchema.safeParse(v);
    if (lido.success) {
      setErroDoJson([]);
      if (JSON.stringify(lido.data) !== JSON.stringify(rascunho))
        mudar({ ...lido.data, id: rascunho.id });
    } else setErroDoJson(errosEmPortugues(lido.error));
  }

  const nomeErro = tentou ? errosDe("nome")[0]?.texto : undefined;
  const sinaisEmUso = useMemo(() => sinaisDaMesa(a.fluxos), [a.fluxos]);

  const selecionado = selecao.tipo === "bloco" ? blocoEm(rascunho, selecao.caminho) : undefined;
  const geral = errosDe("geral");

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: as setas e o Delete navegam pelos blocos (o foco já está num botão dentro)
    <div className="ed-raiz" data-testid="ed-raiz" ref={raiz} onKeyDown={teclado}>
      <header className="ed-barra">
        <button type="button" className="ed-voltar" data-testid="ed-voltar" onClick={p.aoVoltar}>
          <ArrowLeft size={15} aria-hidden /> Automações
        </button>
        <label className="ed-nome">
          <span className="so-leitor">Nome da automação</span>
          <input
            type="text"
            data-testid="ed-nome"
            placeholder="Nome da automação"
            value={rascunho.nome}
            maxLength={64}
            aria-invalid={nomeErro !== undefined}
            onChange={(e) => mudar({ ...rascunho, nome: e.target.value })}
          />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={rascunho.ligado}
          className="ed-ligada"
          data-testid="ed-ligada"
          onClick={() => mudar({ ...rascunho, ligado: !rascunho.ligado })}
        >
          <span className="ed-trilho" data-ligada={rascunho.ligado}>
            <span className="ed-bolinha" />
          </span>
          <span className="ed-ligada-texto">{rascunho.ligado ? "Ligada" : "Desligada"}</span>
        </button>
        <div className="ed-espaco" />
        {p.aoAbrirEmJanela && (
          <BotaoComDica
            className="ed-acao"
            testid="ed-janela"
            nome="Abrir numa janela própria"
            onClick={() =>
              p.aoAbrirEmJanela?.(jaCriado.current ? (idNovo.current ?? rascunho.id) : null)
            }
          >
            <ExternalLink size={14} aria-hidden />
          </BotaoComDica>
        )}
        <details className="ed-mais-menu">
          <summary className="ed-acao ed-json-botao" data-testid="ed-menu-json">
            <Braces size={14} aria-hidden /> JSON
          </summary>
          <div className="ed-json-caixa">
            <VistaJson
              testid="ed-json"
              valor={paraGuardar}
              aoMudar={aoMudarJson}
              erros={erroDoJson}
            />
          </div>
        </details>
        <button
          type="button"
          className="ed-acao"
          data-testid="ed-testar"
          onClick={testar}
          title="Salva e roda a automação agora, de verdade, uma vez"
        >
          <Play size={14} aria-hidden /> Testar agora (dispara de verdade)
        </button>
        <BotaoComDica
          className="ed-acao"
          testid="ed-desfazer"
          nome="Desfazer a última edição"
          motivo={historico.length === 0 ? "Nada para desfazer ainda" : null}
          onClick={desfazer}
        >
          <Undo2 size={14} aria-hidden />
        </BotaoComDica>
        <button
          type="button"
          className="ed-acao forte"
          data-testid="ed-salvar"
          onClick={salvarEVoltar}
        >
          <Save size={14} aria-hidden /> Salvar
        </button>
      </header>
      {(aviso !== null || (tentou && erros.length > 0)) && (
        <div
          className={`ed-aviso${erros.length > 0 ? " erro" : ""}`}
          role="status"
          data-testid="ed-aviso"
        >
          {aviso ?? ""}
          {nomeErro !== undefined && <span> Nome: {nomeErro}</span>}
        </div>
      )}

      <div className="ed-corpo">
        <aside className="ed-pecas" aria-label="Blocos">
          {(["quando", "fluxo", "faca"] as const).map((g) => (
            <div key={g} className="ed-grupo-de-pecas">
              <div className="ed-grupo-titulo" style={{ color: COR_DO_GRUPO[g] }}>
                {ROTULO_DO_GRUPO[g]}
              </div>
              {PECAS.filter((x) => x.grupo === g).map((peca) => (
                <button
                  key={peca.id}
                  type="button"
                  className="ed-peca"
                  data-testid={`ed-peca-${peca.id}`}
                  draggable={g !== "quando"}
                  onDragStart={(e) => e.dataTransfer.setData("text/x-peca", peca.id)}
                  onClick={() => inserirPeca(peca)}
                >
                  <span className="ed-ponto" style={{ background: COR_DO_GRUPO[g] }} aria-hidden />
                  {peca.rotulo}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className="ed-canvas" data-testid="ed-canvas">
          <div className="ed-fluxo">
            <div className="ed-no-coluna">
              <button
                type="button"
                className="ed-no ed-no-gatilho"
                data-testid="ed-no-gatilho"
                data-grupo="quando"
                aria-pressed={selecao.tipo === "gatilho"}
                aria-invalid={errosDe("gatilho").length > 0}
                onClick={() => setSelecao({ tipo: "gatilho" })}
              >
                <span
                  className="ed-ponto"
                  style={{ background: COR_DO_GRUPO.quando }}
                  aria-hidden
                />
                <span className="ed-no-texto">
                  <b>{rotuloDoGatilho(rascunho.gatilho, nomes).titulo}</b>
                  <span>
                    {rascunho.cenas && rascunho.cenas.length > 0
                      ? `nas cenas: ${rascunho.cenas.map((c) => nomes.cena(c) ?? "(apagada)").join(", ")}`
                      : rotuloDoGatilho(rascunho.gatilho, nomes).detalhe}
                  </span>
                </span>
              </button>
              {tentou &&
                errosDe("gatilho").map((e) => (
                  <span
                    key={e.texto}
                    className="ed-erro"
                    role="alert"
                    data-testid="ed-erro-gatilho"
                  >
                    {e.texto}
                  </span>
                ))}
            </div>
            <div className="ed-trilhas">
              {rascunho.trilhas.map((trilha, t) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a trilha é identificada pela posição
                <div className="ed-trilha" key={t} data-testid={`ed-trilha-${t}`}>
                  <span className="ed-conector" aria-hidden />
                  <ListaDeBlocos
                    lista={[t]}
                    blocos={trilha}
                    ctx={{
                      nomes,
                      selecao,
                      mais,
                      erros,
                      tentou,
                      setSelecao,
                      setMais,
                      inserirPeca,
                      soltarEm,
                    }}
                  />
                  {rascunho.trilhas.length > 1 && (
                    <button
                      type="button"
                      className="ed-tirar-trilha"
                      data-testid={`ed-tirar-trilha-${t}`}
                      aria-label={`Tirar a trilha ${t + 1}`}
                      onClick={() => {
                        mudar({ ...rascunho, trilhas: rascunho.trilhas.filter((_, k) => k !== t) });
                        setSelecao({ tipo: "gatilho" });
                      }}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  )}
                </div>
              ))}
              {rascunho.trilhas.length < 8 && (
                <button
                  type="button"
                  className="ed-nova-trilha"
                  data-testid="ed-nova-trilha"
                  onClick={() => mudar({ ...rascunho, trilhas: [...rascunho.trilhas, []] })}
                >
                  <Plus size={13} aria-hidden /> Trilha em paralelo
                </button>
              )}
            </div>
          </div>
          {geral.map((e) => (
            <p key={e.texto} className="ed-erro" role="alert" data-testid="ed-erro-geral">
              {e.texto}
            </p>
          ))}
        </div>

        <aside className="ed-painel" aria-label="O bloco escolhido" data-testid="ed-painel">
          <PainelDoBloco
            estado={estado}
            rascunho={rascunho}
            selecao={selecao}
            bloco={selecionado}
            nomes={nomes}
            sinais={sinaisEmUso}
            erros={tentou ? erros : []}
            fontes={p.fontes}
            registrarSom={p.registrarSom}
            aoMudarFluxo={mudar}
            aoMudarBloco={(b) => selecao.tipo === "bloco" && trocarBloco(selecao.caminho, b)}
            aoDuplicar={() => selecao.tipo === "bloco" && duplicar(selecao.caminho)}
            aoApagar={() => selecao.tipo === "bloco" && tirar(selecao.caminho)}
          />
        </aside>
      </div>

      <footer className="ed-frase" data-testid="ed-frase-caixa">
        <b>Em português:</b> <span data-testid="ed-frase">{frase}</span>
      </footer>
    </div>
  );
}

type CtxDaLista = {
  nomes: ReturnType<typeof nomesDaMesa>;
  selecao: Selecao;
  mais: { lista: Caminho; indice: number } | null;
  erros: readonly ErroDoEditor[];
  tentou: boolean;
  setSelecao: (s: Selecao) => void;
  setMais: (m: { lista: Caminho; indice: number } | null) => void;
  inserirPeca: (peca: Peca, lista?: Caminho, indice?: number) => void;
  soltarEm: (lista: Caminho, indice: number, e: DragEvent) => void;
};

/** Uma lista de blocos: um "+" antes de cada um e no fim, e os blocos (com os ramos dos que têm saídas). */
function ListaDeBlocos(p: { lista: Caminho; blocos: readonly Bloco[]; ctx: CtxDaLista }) {
  const { ctx } = p;
  const itens: ReactNode[] = [];
  for (let i = 0; i <= p.blocos.length; i++) {
    itens.push(<Encaixe key={`mais-${i}`} lista={p.lista} indice={i} ctx={ctx} />);
    const b = p.blocos[i];
    if (b !== undefined)
      itens.push(<GrupoDoBloco key={`b-${i}`} caminho={[...p.lista, i]} bloco={b} ctx={ctx} />);
  }
  return <div className="ed-lista">{itens}</div>;
}

/** O "+" entre dois blocos (ou no fim da lista): abre o menu das peças; também recebe o que se arrasta. */
function Encaixe(p: { lista: Caminho; indice: number; ctx: CtxDaLista }) {
  const { ctx } = p;
  const id = `${idDoCaminho(p.lista)}-${p.indice}`;
  const aberto =
    ctx.mais !== null &&
    idDoCaminho(ctx.mais.lista) === idDoCaminho(p.lista) &&
    ctx.mais.indice === p.indice;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: é só o alvo de soltar; o "+" dentro dele é o controle de teclado
    <div
      className="ed-encaixe"
      data-testid={`ed-encaixe-${id}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => ctx.soltarEm(p.lista, p.indice, e)}
    >
      <span className="ed-conector" aria-hidden />
      <button
        type="button"
        className="ed-mais"
        data-testid={`ed-mais-${id}`}
        aria-label="Encaixar um bloco aqui"
        aria-expanded={aberto}
        onClick={() => ctx.setMais(aberto ? null : { lista: p.lista, indice: p.indice })}
      >
        <Plus size={12} aria-hidden />
      </button>
      {aberto && (
        <div className="ed-menu-de-pecas" role="menu" data-testid={`ed-menu-${id}`}>
          {PECAS.filter((x) => x.grupo !== "quando").map((peca) => (
            <button
              key={peca.id}
              type="button"
              className="ed-menu-item"
              role="menuitem"
              data-testid={`ed-menu-${id}-${peca.id}`}
              onClick={() => ctx.inserirPeca(peca, p.lista, p.indice)}
            >
              <span
                className="ed-ponto"
                style={{ background: COR_DO_GRUPO[peca.grupo] }}
                aria-hidden
              />
              {peca.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoDoBloco(p: { caminho: Caminho; bloco: Bloco; ctx: CtxDaLista }) {
  const { caminho, bloco, ctx } = p;
  const id = idDoCaminho(caminho);
  const rotulo = rotuloDoBloco(bloco, ctx.nomes);
  const escolhido = ctx.selecao.tipo === "bloco" && idDoCaminho(ctx.selecao.caminho) === id;
  const meusErros = ctx.erros.filter((e) => e.onde === id);
  const comErro = ctx.tentou && meusErros.length > 0;
  const grupo = grupoDoBloco(bloco);
  const ramos: { nome: string; rotulo: string; blocos: readonly Bloco[] }[] =
    bloco.bloco === "se" || bloco.bloco === "sortear"
      ? [
          { nome: "sim", rotulo: "sim", blocos: bloco.sim },
          { nome: "nao", rotulo: "não", blocos: bloco.nao },
        ]
      : bloco.bloco === "paraCada"
        ? [{ nome: "corpo", rotulo: "cada um", blocos: bloco.corpo }]
        : [];
  return (
    <div className="ed-grupo-do-bloco">
      <div className="ed-no-coluna">
        <button
          type="button"
          className="ed-no"
          data-testid={`ed-no-${id}`}
          data-grupo={grupo}
          aria-pressed={escolhido}
          aria-invalid={comErro}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/x-bloco", JSON.stringify(caminho))}
          onClick={() => ctx.setSelecao({ tipo: "bloco", caminho })}
        >
          <span className="ed-ponto" style={{ background: COR_DO_GRUPO[grupo] }} aria-hidden />
          <span className="ed-no-texto">
            <b>{rotulo.titulo}</b>
            <span>{rotulo.detalhe}</span>
          </span>
        </button>
        {comErro &&
          meusErros.map((e) => (
            <span key={e.texto} className="ed-erro" role="alert" data-testid={`ed-erro-${id}`}>
              {e.texto}
            </span>
          ))}
      </div>
      {ramos.length > 0 && (
        <div className="ed-ramos">
          {ramos.map((r) => (
            <div className="ed-ramo" key={r.nome} data-testid={`ed-ramo-${id}-${r.nome}`}>
              <span className="ed-ramo-rotulo" data-ramo={r.nome}>
                {r.rotulo}
              </span>
              <ListaDeBlocos lista={[...caminho, r.nome]} blocos={r.blocos} ctx={ctx} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Os nomes de sinal que já existem nas automações (a sugestão do campo). */
function sinaisDaMesa(fluxos: readonly Fluxo[]): string[] {
  const nomes = new Set<string>();
  for (const f of fluxos) {
    if (f.gatilho.tipo === "sinal") nomes.add(f.gatilho.nome);
    const anda = (lista: readonly Bloco[]) => {
      for (const b of lista) {
        if (b.bloco === "sinal") nomes.add(b.nome);
        if (b.bloco === "se" || b.bloco === "sortear") {
          anda(b.sim);
          anda(b.nao);
        } else if (b.bloco === "paraCada") anda(b.corpo);
      }
    };
    for (const t of f.trilhas) anda(t);
  }
  return [...nomes].sort((x, y) => x.localeCompare(y, "pt-BR"));
}
