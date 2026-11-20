import {
  automacoesDe,
  type Estado,
  type Fio,
  type Fluxo,
  FluxoDeQualquerFormaSchema,
  fraseDoFluxo,
  type Gatilho,
  idNovoDeNo,
  type No,
  nomesDaMesa,
  organizarGrafo,
} from "@tabletop/shared";
import { ArrowLeft, Braces, LayoutGrid, Play, Save, Undo2 } from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Fontes } from "../assets/fontes";
import { BotaoComDica } from "../BotaoComDica";
import type { SomEscolhido } from "../som/EscolherSom";
import {
  COR_DO_GRUPO,
  errosDoFluxo,
  fluxoNovo,
  GRUPOS_DE_PECA,
  PECAS,
  type Peca,
  ROTULO_DO_GRUPO,
  SEM_SELECAO,
  type Selecao,
} from "./blocos";
import { CanvasDoGrafo, type ManejoDoCanvas } from "./CanvasDoGrafo";
import { VistaJson } from "./Editor";
import { type ErroDeCampo, errosEmPortugues } from "./erros";
import { PainelDaAutomacao, PainelDoBloco } from "./PainelDoBloco";
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
};

/**
 * O editor de automação em grade (AU2), como o do n8n: a barra de cima (fechar, nome, ligada, organizar, JSON, testar,
 * desfazer, salvar), as peças em cinco cores à esquerda (arraste para a grade, ou clique), a grade livre no meio (nós,
 * fios, portas lógicas, caminhos em paralelo), os campos do nó escolhido à direita e a frase em português embaixo. Nada
 * salva com erro: o nó com problema ganha contorno e a mensagem. Só vive numa janela própria do navegador.
 */
export function EditorDeFluxo(p: PropsDoEditor) {
  const { estado } = p;
  const a = automacoesDe(estado);
  const existente = p.fluxoId === null ? undefined : a.fluxos.find((f) => f.id === p.fluxoId);
  const idNovo = useRef<string | null>(null);
  const [rascunho, setRascunho] = useState<Fluxo>(() => {
    if (existente) return structuredClone(existente);
    return fluxoNovo(`auto-${Math.random().toString(36).slice(2, 10)}`, p.gatilhoInicial);
  });
  const rascunhoRef = useRef(rascunho);
  rascunhoRef.current = rascunho;
  const [historico, setHistorico] = useState<Fluxo[]>([]);
  const [selecao, setSelecao] = useState<Selecao>(SEM_SELECAO);
  const [tentou, setTentou] = useState(false);
  const [erroDoJson, setErroDoJson] = useState<ErroDeCampo[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const jaCriado = useRef(existente !== undefined);
  const canvas = useRef<ManejoDoCanvas>(null);
  const painel = useRef<HTMLElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const copiados = useRef<{ nos: No[]; fios: Fio[]; vezes: number } | null>(null);
  const inicioDoGesto = useRef<Fluxo | null>(null);

  const nomes = useMemo(() => nomesDaMesa(estado), [estado]);
  const erros = useMemo(() => errosDoFluxo(rascunho, estado), [rascunho, estado]);
  const frase = useMemo(() => fraseDoFluxo(rascunho, nomes), [rascunho, nomes]);
  const errosDe = (onde: string) => erros.filter((e) => e.onde === onde);

  const mudar = useCallback((novo: Fluxo) => {
    setHistorico((h) => [...h.slice(-49), rascunhoRef.current]);
    setRascunho(novo);
    setAviso(null);
  }, []);

  function desfazer() {
    setHistorico((h) => {
      const anterior = h.at(-1);
      if (anterior === undefined) return h;
      setRascunho(anterior);
      setSelecao((s) => ({
        nos: s.nos.filter((id) => anterior.nos.some((n) => n.id === id)),
        fio: null,
      }));
      return h.slice(0, -1);
    });
  }

  // --- Mexer no desenho ---

  function nosNovo(peca: Peca, x: number, y: number): No {
    const f = rascunhoRef.current;
    return { ...peca.criar(), id: idNovoDeNo(f.nos), x: Math.round(x), y: Math.round(y) } as No;
  }

  function pecaNaGrade(peca: Peca, x: number, y: number) {
    const no = nosNovo(peca, x, y);
    mudar({ ...rascunhoRef.current, nos: [...rascunhoRef.current.nos, no] });
    setSelecao({ nos: [no.id], fio: null });
  }

  /** Clicou numa peça: entra no meio da tela (cada uma um pouco mais para baixo e para a direita, para não empilhar). */
  function pecaPorClique(peca: Peca) {
    const c = canvas.current?.centro() ?? { x: 160, y: 160 };
    const n = rascunhoRef.current.nos.length;
    // À direita do meio, uma peça embaixo da outra (quatro por coluna): nada nasce em cima de outro nó.
    pecaNaGrade(peca, c.x + 130 + Math.floor(n / 4) * 240, c.y - 140 + (n % 4) * 88);
  }

  function moverNos(
    fase: "comecou" | "moveu" | "terminou",
    posicoes?: ReadonlyMap<string, { x: number; y: number }>,
  ) {
    if (fase === "comecou") {
      inicioDoGesto.current = rascunhoRef.current;
    } else if (fase === "moveu" && posicoes) {
      setRascunho((f) => ({
        ...f,
        nos: f.nos.map((n) => {
          const nova = posicoes.get(n.id);
          return nova ? { ...n, ...nova } : n;
        }),
      }));
    } else if (fase === "terminou" && inicioDoGesto.current) {
      const antes = inicioDoGesto.current;
      inicioDoGesto.current = null;
      setHistorico((h) => [...h.slice(-49), antes]);
      setAviso(null);
    }
  }

  function ligar(de: Fio["de"], para: Fio["para"]) {
    const f = rascunhoRef.current;
    mudar({ ...f, fios: [...f.fios, { de, para }] });
    setSelecao({ nos: [], fio: `${de.no}.${de.saida}>${para.no}.${para.entrada}` });
  }

  function apagarSelecao() {
    const f = rascunhoRef.current;
    if (selecao.fio !== null) {
      mudar({
        ...f,
        fios: f.fios.filter(
          (x) => `${x.de.no}.${x.de.saida}>${x.para.no}.${x.para.entrada}` !== selecao.fio,
        ),
      });
      setSelecao(SEM_SELECAO);
      return;
    }
    if (selecao.nos.length === 0) return;
    const ids = new Set(selecao.nos);
    mudar({
      ...f,
      nos: f.nos.filter((n) => !ids.has(n.id)),
      fios: f.fios.filter((x) => !ids.has(x.de.no) && !ids.has(x.para.no)),
    });
    setSelecao(SEM_SELECAO);
  }

  function copiar() {
    const f = rascunhoRef.current;
    const ids = new Set(selecao.nos);
    if (ids.size === 0) return;
    copiados.current = {
      nos: structuredClone(f.nos.filter((n) => ids.has(n.id))),
      fios: structuredClone(f.fios.filter((x) => ids.has(x.de.no) && ids.has(x.para.no))),
      vezes: 0,
    };
  }

  function colar() {
    const c = copiados.current;
    if (!c || c.nos.length === 0) return;
    c.vezes++;
    const f = rascunhoRef.current;
    const novos: No[] = [];
    const mapa = new Map<string, string>();
    for (const n of c.nos) {
      const id = idNovoDeNo([...f.nos, ...novos]);
      mapa.set(n.id, id);
      novos.push({ ...structuredClone(n), id, x: n.x + 36 * c.vezes, y: n.y + 36 * c.vezes } as No);
    }
    const fios = c.fios.flatMap((x): Fio[] => {
      const de = mapa.get(x.de.no);
      const para = mapa.get(x.para.no);
      return de && para ? [{ de: { ...x.de, no: de }, para: { ...x.para, no: para } }] : [];
    });
    mudar({ ...f, nos: [...f.nos, ...novos], fios: [...f.fios, ...fios] });
    setSelecao({ nos: novos.map((n) => n.id), fio: null });
  }

  function duplicar() {
    copiar();
    colar();
  }

  function organizar() {
    const f = rascunhoRef.current;
    mudar({ ...f, nos: organizarGrafo(f) });
    setTimeout(() => canvas.current?.ajustar(), 0);
  }

  function trocarNo(novo: No) {
    const f = rascunhoRef.current;
    mudar({ ...f, nos: f.nos.map((n) => (n.id === novo.id ? novo : n)) });
  }

  function teclado(e: KeyboardEvent) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "c") {
      copiar();
      e.preventDefault();
    } else if (ctrl && e.key.toLowerCase() === "v") {
      colar();
      e.preventDefault();
    } else if (ctrl && e.key.toLowerCase() === "d") {
      duplicar();
      e.preventDefault();
    } else if (ctrl && e.key.toLowerCase() === "z") {
      desfazer();
      e.preventDefault();
    } else if (ctrl && e.key.toLowerCase() === "a") {
      setSelecao({ nos: rascunhoRef.current.nos.map((n) => n.id), fio: null });
      e.preventDefault();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (selecao.nos.length > 0 || selecao.fio !== null) {
        apagarSelecao();
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      setSelecao(SEM_SELECAO);
    } else if (e.key === "Enter" && selecao.nos.length === 1) {
      // Enter edita: o foco vai para o primeiro campo do painel.
      painel.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
      e.preventDefault();
    } else if (
      (e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown") &&
      selecao.nos.length > 0
    ) {
      // As setas movem o(s) nó(s) escolhido(s); com Shift, em passos maiores.
      const passo = e.shiftKey ? 40 : 10;
      const dx = e.key === "ArrowLeft" ? -passo : e.key === "ArrowRight" ? passo : 0;
      const dy = e.key === "ArrowUp" ? -passo : e.key === "ArrowDown" ? passo : 0;
      const ids = new Set(selecao.nos);
      const f = rascunhoRef.current;
      mudar({
        ...f,
        nos: f.nos.map((n) => (ids.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
      });
      e.preventDefault();
    }
  }

  // --- Salvar, testar ---

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

  function salvarEFechar() {
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
    const lido = FluxoDeQualquerFormaSchema.safeParse(v);
    if (lido.success) {
      setErroDoJson([]);
      if (JSON.stringify(lido.data) !== JSON.stringify(rascunho))
        mudar({ ...lido.data, id: rascunho.id });
    } else setErroDoJson(errosEmPortugues(lido.error));
  }

  const nomeErro = tentou ? errosDe("nome")[0]?.texto : undefined;
  const sinaisEmUso = useMemo(() => sinaisDaMesa(a.fluxos), [a.fluxos]);
  const noEscolhido =
    selecao.nos.length === 1 ? rascunho.nos.find((n) => n.id === selecao.nos[0]) : undefined;
  const fioEscolhido =
    selecao.fio === null
      ? undefined
      : rascunho.fios.find(
          (x) => `${x.de.no}.${x.de.saida}>${x.para.no}.${x.para.entrada}` === selecao.fio,
        );

  function aoComecarAArrastarPeca(e: DragEvent, peca: Peca) {
    e.dataTransfer.setData("text/x-peca", peca.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: os atalhos (Delete, setas, copiar e colar) valem para os nós da grade (o foco já está num deles)
    <div className="ed-raiz" data-testid="ed-raiz" ref={area} onKeyDown={teclado}>
      <header className="ed-barra">
        <button type="button" className="ed-voltar" data-testid="ed-voltar" onClick={p.aoVoltar}>
          <ArrowLeft size={15} aria-hidden /> Fechar
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
        <BotaoComDica
          className="ed-acao"
          testid="ed-organizar"
          nome="Organizar os blocos sozinho"
          onClick={organizar}
        >
          <LayoutGrid size={14} aria-hidden /> Organizar
        </BotaoComDica>
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
          onClick={salvarEFechar}
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
          <p className="nota ed-pecas-dica">
            Arraste para a grade, ou clique. Duplo clique na grade busca.
          </p>
          {GRUPOS_DE_PECA.map((g) => (
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
                  draggable
                  onDragStart={(e) => aoComecarAArrastarPeca(e, peca)}
                  onClick={() => pecaPorClique(peca)}
                >
                  <span className="ed-ponto" style={{ background: COR_DO_GRUPO[g] }} aria-hidden />
                  {peca.rotulo}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <CanvasDoGrafo
          fluxo={rascunho}
          nomes={nomes}
          selecao={selecao}
          erros={erros}
          mostrarErros={tentou}
          aoSelecionar={setSelecao}
          aoMoverNos={moverNos}
          aoLigar={ligar}
          aoPecaNaGrade={pecaNaGrade}
          aoAviso={setAviso}
          manejo={canvas}
        />

        <aside
          className="ed-painel"
          aria-label="O que está escolhido"
          data-testid="ed-painel"
          ref={painel}
        >
          {noEscolhido ? (
            <PainelDoBloco
              key={noEscolhido.id}
              estado={estado}
              rascunho={rascunho}
              no={noEscolhido}
              nomes={nomes}
              sinais={sinaisEmUso}
              erros={tentou ? erros : []}
              fontes={p.fontes}
              registrarSom={p.registrarSom}
              aoMudarNo={trocarNo}
              aoDuplicar={duplicar}
              aoApagar={apagarSelecao}
            />
          ) : fioEscolhido ? (
            <div className="ed-painel-conteudo" data-testid="ed-painel-fio">
              <div className="ed-painel-titulo">
                <h2>Fio</h2>
              </div>
              <p className="nota">
                Liga “{nomeDoNo(rascunho, fioEscolhido.de.no)}” a “
                {nomeDoNo(rascunho, fioEscolhido.para.no)}”. Delete apaga o fio.
              </p>
              <button
                type="button"
                className="perigo"
                data-testid="ed-apagar-fio"
                onClick={apagarSelecao}
              >
                Apagar o fio
              </button>
            </div>
          ) : selecao.nos.length > 1 ? (
            <div className="ed-painel-conteudo" data-testid="ed-painel-varios">
              <div className="ed-painel-titulo">
                <h2>{selecao.nos.length} blocos</h2>
              </div>
              <p className="nota">
                Arraste um deles para mover todos juntos. Ctrl+C e Ctrl+V copiam, Delete apaga.
              </p>
              <button
                type="button"
                className="perigo"
                data-testid="ed-apagar-varios"
                onClick={apagarSelecao}
              >
                Apagar os {selecao.nos.length} blocos
              </button>
            </div>
          ) : (
            <PainelDaAutomacao
              estado={estado}
              rascunho={rascunho}
              erros={tentou ? erros : []}
              aoMudarFluxo={mudar}
            />
          )}
        </aside>
      </div>

      <footer className="ed-frase" data-testid="ed-frase-caixa">
        <b>Em português:</b> <span data-testid="ed-frase">{frase}</span>
      </footer>
    </div>
  );
}

const nomeDoNo = (f: Fluxo, id: string): string => {
  const n = f.nos.find((x) => x.id === id);
  return n?.nome ?? n?.tipo ?? id;
};

/** Os nomes de sinal que já existem nas automações (a sugestão do campo). */
function sinaisDaMesa(fluxos: readonly Fluxo[]): string[] {
  const nomes = new Set<string>();
  for (const f of fluxos) {
    for (const n of f.nos) {
      if (n.tipo === "gatilho" && n.config.tipo === "sinal") nomes.add(n.config.nome);
      if (n.tipo === "sinal") nomes.add(n.config.nome);
    }
  }
  return [...nomes].sort((x, y) => x.localeCompare(y, "pt-BR"));
}
