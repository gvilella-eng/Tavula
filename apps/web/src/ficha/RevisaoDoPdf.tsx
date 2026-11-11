import {
  type Ataque,
  derivar,
  type Ficha,
  FichaSchema,
  type ImportacaoDoPdf,
  type Incerto,
  NIVEIS_DE_PROFICIENCIA,
  type NivelDeProficiencia,
  PERICIAS,
  type Personagem,
  pesParaMetros,
  RECARGAS,
  ROTULO_DO_ATRIBUTO,
} from "@tabletop/shared";
import { AlertTriangle, ChevronDown, ChevronRight, FileCheck2, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

type Props = {
  nomeDoArquivo: string;
  resultado: ImportacaoDoPdf;
  /** O destino já escolhido ao começar (pelo menu de um item): o item cuja ficha será substituída; `null` = ficha nova. */
  alvo: Personagem | null;
  /** Os personagens que a pessoa pode editar: os destinos possíveis de "Por cima de". */
  candidatos: Personagem[];
  /** Manda a ficha para a sala (por cima do destino, ou nova se `null`); devolve o erro, se houver. */
  aoConfirmar: (ficha: Ficha, nome: string, destino: Personagem | null) => string | null;
  aoCancelar: () => void;
};

const SECOES = [
  "cabecalho",
  "atributos",
  "pericias",
  "gerais",
  "ataques",
  "magias",
  "caracteristicas",
  "equipamento",
  "recursos",
  "notas",
] as const;
type Secao = (typeof SECOES)[number];

/** A seção da tela de revisão a que um caminho da ficha pertence. */
export function secaoDoCaminho(caminho: string): Secao {
  const raiz = caminho.split(".")[0] ?? "";
  if (raiz === "classes" || raiz === "raca" || raiz === "antecedente" || raiz === "alinhamento")
    return "cabecalho";
  if (raiz === "atributos" || raiz === "salvaguardas") return "atributos";
  if (raiz === "pericias") return "pericias";
  if (raiz === "ataques") return "ataques";
  if (raiz === "magias" || raiz === "conjuracao" || raiz === "espacos") return "magias";
  if (raiz === "caracteristicas") return "caracteristicas";
  if (raiz === "itens") return "equipamento";
  if (raiz === "recursos") return "recursos";
  if (raiz === "notas") return "notas";
  return "gerais";
}

const TITULOS: Record<Secao, string> = {
  cabecalho: "Cabeçalho",
  atributos: "Atributos e salvaguardas",
  pericias: "Perícias",
  gerais: "Números gerais, PV e idiomas",
  ataques: "Ataques",
  magias: "Conjuração e magias",
  caracteristicas: "Características e traços",
  equipamento: "Equipamento",
  recursos: "Recursos (caixas do PDF)",
  notas: "Notas (personalidade e moedas)",
};

/** Quantos campos a seção leu (para o resumo da seção recolhida: "12 campos lidos, nada a conferir"). */
function camposLidos(secao: Secao, f: Ficha): number {
  const tem = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : 1);
  switch (secao) {
    case "cabecalho":
      return tem(f.raca) + tem(f.antecedente) + tem(f.alinhamento) + (f.classes?.length ?? 0);
    case "atributos":
      return 12;
    case "pericias":
      return PERICIAS.length;
    case "gerais":
      return 8;
    case "ataques":
      return f.ataques?.length ?? 0;
    case "magias":
      return f.magias?.length ?? 0;
    case "caracteristicas":
      return f.caracteristicas?.length ?? 0;
    case "equipamento":
      return f.itens?.length ?? 0;
    case "recursos":
      return f.recursos?.length ?? 0;
    case "notas":
      return tem(f.notas);
  }
}

const mesmoNome = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Muda um campo numa cópia da ficha (`undefined` remove o campo). Sem validar: isso fica para o fim. */
function definirNoCaminho(ficha: Ficha, caminho: string, valor: unknown): Ficha {
  const copia = JSON.parse(JSON.stringify(ficha)) as Record<string, unknown>;
  const partes = caminho.split(".");
  let atual: Record<string, unknown> | unknown[] = copia;
  for (let i = 0; i < partes.length - 1; i++) {
    const chave = partes[i] as string;
    const proximo: unknown = (atual as Record<string, unknown>)[chave];
    if (typeof proximo !== "object" || proximo === null) return ficha;
    atual = proximo as Record<string, unknown> | unknown[];
  }
  const ultima = partes[partes.length - 1] as string;
  if (valor === undefined) delete (atual as Record<string, unknown>)[ultima];
  else (atual as Record<string, unknown>)[ultima] = valor;
  return copia as Ficha;
}

function apenasNumero(texto: string): number | undefined {
  const t = texto.trim();
  if (t === "" || !/^-?\d+$/.test(t)) return undefined;
  return Number(t);
}

type Editar = (caminho: string, valor: unknown) => void;

/**
 * Tela de revisão da importação do PDF da ficha (Lote 10): cada seção da ficha com o valor lido, o trecho
 * do PDF ao lado e os campos incertos em amarelo e editáveis. Nada vai para a sala sem "Confirmar".
 */
export function RevisaoDoPdf({
  nomeDoArquivo,
  resultado,
  alvo: alvoInicial,
  candidatos,
  aoConfirmar,
  aoCancelar,
}: Props) {
  const [ficha, setFicha] = useState<Ficha>(resultado.ficha);
  const [nome, setNome] = useState(resultado.nome ?? "Personagem importado");
  // O destino: ficha nova ou por cima de um personagem que a pessoa edita. Já vem preenchido quando se
  // começou pelo menu do item; senão começa em "Ficha nova" e só sugere (nunca escolhe sozinho).
  const [destinoId, setDestinoId] = useState<string | null>(alvoInicial?.id ?? null);
  const alvo = candidatos.find((c) => c.id === destinoId) ?? null;
  const sugerido =
    alvo === null && resultado.nome
      ? (candidatos.find((c) => mesmoNome(c.nome, resultado.nome ?? "")) ?? null)
      : null;
  const corpo = useRef<HTMLDivElement>(null);
  const proximoIncerto = useRef(-1);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const editar: Editar = (caminho, valor) => setFicha((f) => definirNoCaminho(f, caminho, valor));

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoCancelar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoCancelar]);

  const d = useMemo(() => derivar(ficha), [ficha]);
  // Seções sem campo incerto começam recolhidas; as com campo incerto, abertas. "Mostrar tudo" abre todas.
  const [abertas, setAbertas] = useState<Set<Secao>>(
    () => new Set(resultado.incertos.map((i) => secaoDoCaminho(i.caminho))),
  );
  const alternar = (id: Secao) =>
    setAbertas((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const tudoAberto = SECOES.every((x) => abertas.has(x));
  const incertosPorSecao = useMemo(() => {
    const mapa = new Map<Secao, Incerto[]>();
    for (const i of resultado.incertos) {
      const s = secaoDoCaminho(i.caminho);
      mapa.set(s, [...(mapa.get(s) ?? []), i]);
    }
    return mapa;
  }, [resultado.incertos]);
  const doCaminho = (caminho: string) => resultado.incertos.filter((i) => i.caminho === caminho);
  const ehIncerto = (caminho: string) => doCaminho(caminho).length > 0;

  /** Leva o foco ao próximo campo incerto (abre a seção dele se estava recolhida). */
  function irParaOProximoIncerto() {
    const raiz = corpo.current;
    if (!raiz) return;
    const todos = [...raiz.querySelectorAll<HTMLElement>('[data-incerto="true"]')];
    // só o mais externo de cada grupo (a linha da tabela e a célula dela contam como um campo)
    const alvos = todos.filter((el) => !todos.some((o) => o !== el && o.contains(el)));
    if (alvos.length === 0) return;
    proximoIncerto.current = (proximoIncerto.current + 1) % alvos.length;
    const el = alvos[proximoIncerto.current] as HTMLElement;
    const id = el.closest<HTMLElement>("[data-secao]")?.dataset.secao as Secao | undefined;
    if (id) flushSync(() => setAbertas((a) => new Set(a).add(id)));
    const campo = el.matches("input, select, textarea, button, summary")
      ? el
      : (el.querySelector<HTMLElement>("input, select, textarea, button, summary") ?? el);
    if (campo === el && !el.hasAttribute("tabindex")) el.tabIndex = -1;
    campo.focus();
    campo.scrollIntoView({ block: "center" });
  }

  function tentarConfirmar() {
    const valida = FichaSchema.safeParse(ficha);
    if (!valida.success) {
      const p = valida.error.issues[0];
      setErro(`Há um valor inválido em ${p?.path.join(".") ?? "ficha"}: ${p?.message ?? ""}`);
      return;
    }
    if (alvo === null && nome.trim() === "") {
      setErro("Dê um nome ao personagem.");
      return;
    }
    setErro(null);
    if (alvo && !confirmando) {
      setConfirmando(true);
      return;
    }
    enviar();
  }

  function enviar() {
    const falha = aoConfirmar(ficha, nome.trim(), alvo);
    if (falha) {
      setConfirmando(false);
      setErro(falha);
    }
  }

  const total = resultado.incertos.length;
  const resumoDe = (id: Secao) => {
    const n = camposLidos(id, ficha);
    return n === 0
      ? "Nada lido neste trecho, nada a conferir"
      : `${n} ${n === 1 ? "campo lido" : "campos lidos"}, nada a conferir`;
  };
  const trecho = (s: string) => resultado.trechos[s] ?? "";

  // Itens de uma seção que não têm campo próprio: aparecem como aviso amarelo.
  const COM_CAMPO = [
    /^ataques\.\d+\.(nome|tipo)$/,
    /^pv(Atual|Temp|Max)$/,
    /^recursos\.\d+$/,
    /^(pericias|salvaguardas)\./,
    /^classes\.\d+\.(subclasse|classe)$/,
    /^idiomas$/,
    /^magias\.\d+\.descricao$/,
  ];
  const avisos = (s: Secao) =>
    (incertosPorSecao.get(s) ?? []).filter((i) => !COM_CAMPO.some((r) => r.test(i.caminho)));

  return (
    <div className="rev-fundo" data-testid="revisao-pdf-fundo">
      <div
        className="rev-janela"
        role="dialog"
        aria-modal="true"
        aria-label="Revisar a ficha importada do PDF"
        data-testid="revisao-pdf"
      >
        <header className="rev-cabecalho">
          <FileCheck2 size={20} />
          <div className="rev-titulo">
            <strong>Importar PDF</strong>
            <span className="nota">
              {nomeDoArquivo} · o PDF foi lido neste computador; só a ficha vai para a sala
            </span>
          </div>
          <button
            type="button"
            className="botao-icone"
            aria-label="Cancelar a importação"
            data-testid="revisao-fechar"
            onClick={aoCancelar}
          >
            <X size={18} />
          </button>
        </header>

        <div className="rev-topo" data-testid="revisao-topo">
          <div className="rev-destino" data-testid="revisao-destino-bloco">
            <label htmlFor="revisao-destino">Destino</label>
            <select
              id="revisao-destino"
              data-testid="revisao-destino"
              value={destinoId ?? ""}
              onChange={(e) => setDestinoId(e.target.value === "" ? null : e.target.value)}
            >
              <option value="">Ficha nova</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  Por cima de: {c.nome}
                </option>
              ))}
            </select>
            {alvo === null ? (
              <input
                type="text"
                value={nome}
                maxLength={80}
                aria-label="Nome do personagem"
                data-testid="revisao-nome"
                onChange={(e) => setNome(e.target.value)}
              />
            ) : (
              <span className="nota" data-testid="revisao-destino-aviso">
                Troca só a ficha. O retrato, o token e a pasta de {alvo.nome} ficam como estão.
              </span>
            )}
            {sugerido && (
              <span className="rev-sugestao" data-testid="revisao-sugestao">
                Já existe {sugerido.nome} na mesa.{" "}
                <button
                  type="button"
                  className="link"
                  data-testid="revisao-sugestao-usar"
                  onClick={() => setDestinoId(sugerido.id)}
                >
                  Importar por cima dele
                </button>
              </span>
            )}
          </div>
          <div className="rev-conferir">
            <span
              className={`rev-selo ${total > 0 ? "amarelo" : ""}`}
              data-testid="revisao-total-incertos"
              role="status"
            >
              {total === 0
                ? "Nada para conferir"
                : `${total} ${total === 1 ? "campo" : "campos"} para conferir`}
            </span>
            <button
              type="button"
              data-testid="revisao-proximo-incerto"
              disabled={total === 0}
              onClick={irParaOProximoIncerto}
            >
              Próximo a conferir
            </button>
            <button
              type="button"
              data-testid="revisao-mostrar-tudo"
              aria-pressed={tudoAberto}
              onClick={() =>
                setAbertas(tudoAberto ? new Set(incertosPorSecao.keys()) : new Set(SECOES))
              }
            >
              {tudoAberto ? "Recolher o que está certo" : "Mostrar tudo"}
            </button>
          </div>
        </div>

        <div className="rev-corpo" data-testid="revisao-corpo" ref={corpo}>
          <p className="rev-intro">
            Confira o que foi lido. Os campos em <mark className="rev-amostra">amarelo</mark> estão
            incertos (nome cortado no PDF, caixa repetida, campo vazio, conta que não fecha):
            corrija ou deixe como está. O PDF não tem as marcas desenhadas (proficiência, magias
            preparadas); elas foram deduzidas pela conta.
          </p>
          {resultado.incertos
            .filter((i) => i.caminho === "")
            .map((i) => (
              <Aviso key={i.motivo} incerto={i} />
            ))}

          <Secao
            id="cabecalho"
            titulo={TITULOS.cabecalho}
            trecho={trecho("cabecalho")}
            avisos={incertosPorSecao.get("cabecalho")?.length ?? 0}
            aberta={abertas.has("cabecalho")}
            aoAlternar={() => alternar("cabecalho")}
            resumo={resumoDe("cabecalho")}
          >
            <dl className="rev-dl">
              <dt>Raça</dt>
              <dd>{ficha.raca ?? "—"}</dd>
              <dt>Antecedente</dt>
              <dd>{ficha.antecedente ?? "—"}</dd>
              <dt>Alinhamento</dt>
              <dd>{ficha.alinhamento ?? "—"}</dd>
            </dl>
            <ul className="rev-lista">
              {(ficha.classes ?? []).map((c, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a lista é a do PDF, na ordem dele
                <li key={`classe-${i}`}>
                  <span className="rev-nome-do-campo">Classe {i + 1}</span> {c.classe} {c.nivel}
                  {ehIncerto(`classes.${i}.subclasse`) && (
                    <CampoTexto
                      caminho={`classes.${i}.subclasse`}
                      rotulo="Subclasse"
                      valor={c.subclasse ?? ""}
                      incertos={doCaminho(`classes.${i}.subclasse`)}
                      editar={editar}
                    />
                  )}
                  {ehIncerto(`classes.${i}.classe`) && (
                    <CampoTexto
                      caminho={`classes.${i}.classe`}
                      rotulo="Classe"
                      valor={c.classe}
                      incertos={doCaminho(`classes.${i}.classe`)}
                      editar={editar}
                    />
                  )}
                </li>
              ))}
            </ul>
            <Avisos lista={avisos("cabecalho")} />
          </Secao>

          <Secao
            id="atributos"
            titulo={TITULOS.atributos}
            trecho={[trecho("atributos"), trecho("salvaguardas")].filter(Boolean).join("\n")}
            avisos={incertosPorSecao.get("atributos")?.length ?? 0}
            aberta={abertas.has("atributos")}
            aoAlternar={() => alternar("atributos")}
            resumo={resumoDe("atributos")}
          >
            <table className="rev-tabela">
              <thead>
                <tr>
                  <th />
                  <th>Valor</th>
                  <th>Mod.</th>
                  <th>Salvaguarda</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(ROTULO_DO_ATRIBUTO) as (keyof typeof ROTULO_DO_ATRIBUTO)[]).map(
                  (a) => {
                    const s = d.salvaguardas[a];
                    const caminho = `salvaguardas.${a}`;
                    return (
                      <tr key={a} data-incerto={ehIncerto(caminho) || undefined}>
                        <th scope="row">{ROTULO_DO_ATRIBUTO[a]}</th>
                        <td>{d.atributos[a].valor}</td>
                        <td>
                          {d.atributos[a].mod >= 0 ? `+${d.atributos[a].mod}` : d.atributos[a].mod}
                        </td>
                        <td>
                          {s.total >= 0 ? `+${s.total}` : s.total}{" "}
                          {s.nivel !== "nenhuma" && <span className="rev-prof">P</span>}
                          {ehIncerto(caminho) && (
                            <CampoDeNivel
                              caminho={caminho}
                              nivel={s.nivel}
                              bonus={ficha.salvaguardas?.[a]?.bonus}
                              incertos={doCaminho(caminho)}
                              editar={editar}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
            <p className="nota">
              Bônus de proficiência +{d.proficiencia}. P = proficiente (deduzido pela conta).
            </p>
            <Avisos lista={avisos("atributos")} />
          </Secao>

          <Secao
            id="pericias"
            titulo={TITULOS.pericias}
            trecho={trecho("pericias")}
            avisos={incertosPorSecao.get("pericias")?.length ?? 0}
            aberta={abertas.has("pericias")}
            aoAlternar={() => alternar("pericias")}
            resumo={resumoDe("pericias")}
          >
            <ul className="rev-grade">
              {PERICIAS.map((p) => {
                const x = d.pericias.find((q) => q.id === p.id);
                const caminho = `pericias.${p.id}`;
                const total = x?.total ?? 0;
                return (
                  <li key={p.id} data-incerto={ehIncerto(caminho) || undefined}>
                    <span>{p.nome}</span>
                    <strong>{total >= 0 ? `+${total}` : total}</strong>
                    {x?.nivel === "proficiente" && <span className="rev-prof">P</span>}
                    {x?.nivel === "especialista" && <span className="rev-prof">E</span>}
                    {ehIncerto(caminho) && (
                      <CampoDeNivel
                        caminho={caminho}
                        nivel={x?.nivel ?? "nenhuma"}
                        bonus={ficha.pericias?.[p.id]?.bonus}
                        incertos={doCaminho(caminho)}
                        editar={editar}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            <Avisos lista={avisos("pericias")} />
          </Secao>

          <Secao
            id="gerais"
            titulo={TITULOS.gerais}
            trecho={[trecho("gerais"), trecho("idiomas")].filter(Boolean).join("\n")}
            avisos={incertosPorSecao.get("gerais")?.length ?? 0}
            aberta={abertas.has("gerais")}
            aoAlternar={() => alternar("gerais")}
            resumo={resumoDe("gerais")}
          >
            <dl className="rev-dl">
              <dt>CA</dt>
              <dd>{ficha.ca?.valor ?? "—"}</dd>
              <dt>Iniciativa</dt>
              <dd>{d.iniciativa >= 0 ? `+${d.iniciativa}` : d.iniciativa}</dd>
              <dt>Deslocamento</dt>
              <dd>
                {d.deslocamentoFt} ft ({pesParaMetros(d.deslocamentoFt)} m)
              </dd>
              <dt>PV máximo</dt>
              <dd>{ficha.pvMax}</dd>
              <dt>PV atuais</dt>
              <dd>
                <CampoNumero
                  caminho="pvAtual"
                  rotulo="PV atuais"
                  valor={ficha.pvAtual}
                  incertos={doCaminho("pvAtual")}
                  editar={editar}
                />
              </dd>
              <dt>PV temporários</dt>
              <dd>
                <CampoNumero
                  caminho="pvTemp"
                  rotulo="PV temporários"
                  valor={ficha.pvTemp}
                  incertos={doCaminho("pvTemp")}
                  editar={editar}
                />
              </dd>
              <dt>Percepção passiva</dt>
              <dd>{d.percepcaoPassiva}</dd>
              <dt>Idiomas e outras proficiências</dt>
              <dd>
                <CampoTexto
                  caminho="idiomas"
                  rotulo="Idiomas (separe por vírgula)"
                  valor={(ficha.idiomas ?? []).join(", ")}
                  incertos={doCaminho("idiomas")}
                  editar={(c, v) =>
                    editar(
                      c,
                      String(v)
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </dd>
            </dl>
            <Avisos lista={avisos("gerais")} />
          </Secao>

          <Secao
            id="ataques"
            titulo={`${TITULOS.ataques} (${ficha.ataques?.length ?? 0})`}
            trecho={trecho("ataques")}
            avisos={incertosPorSecao.get("ataques")?.length ?? 0}
            aberta={abertas.has("ataques")}
            aoAlternar={() => alternar("ataques")}
            resumo={resumoDe("ataques")}
          >
            <table className="rev-tabela rev-ataques" data-testid="revisao-ataques">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Ataque</th>
                  <th>Dano</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {(ficha.ataques ?? []).map((a, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a lista é a do PDF, na ordem dele
                  <LinhaDeAtaque key={i} i={i} a={a} doCaminho={doCaminho} editar={editar} />
                ))}
              </tbody>
            </table>
            <p className="nota">
              Os ataques entram como valor fixo, como no PDF; nada é recalculado.
            </p>
            <Avisos lista={avisos("ataques")} />
          </Secao>

          <Secao
            id="magias"
            titulo={`${TITULOS.magias} (${ficha.magias?.length ?? 0} magias)`}
            trecho={[trecho("conjuracao"), trecho("magias")].filter(Boolean).join("\n")}
            avisos={incertosPorSecao.get("magias")?.length ?? 0}
            aberta={abertas.has("magias")}
            aoAlternar={() => alternar("magias")}
            resumo={resumoDe("magias")}
          >
            <ul className="rev-lista">
              {d.conjuradoras.map((c) => (
                <li key={c.classe}>
                  {c.classe}: {ROTULO_DO_ATRIBUTO[c.habilidade]}, CD {c.cd}, ataque{" "}
                  {c.ataque >= 0 ? `+${c.ataque}` : c.ataque}
                </li>
              ))}
              <li>
                Espaços:{" "}
                {d.espacos
                  .filter((e) => e.total > 0)
                  .map((e) => `${e.nivel}º ${e.total}`)
                  .join(" · ") || "nenhum"}
              </li>
            </ul>
            <div className="rev-magias" data-testid="revisao-magias">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                const doNivel = (ficha.magias ?? [])
                  .map((m, i) => ({ m, i }))
                  .filter((x) => x.m.nivel === n);
                if (doNivel.length === 0) return null;
                return (
                  <div key={n}>
                    <h4>{n === 0 ? "Truques" : `${n}º nível`}</h4>
                    {doNivel.map(({ m, i }) => (
                      <details
                        key={`${m.nome}-${i}`}
                        data-incerto={ehIncerto(`magias.${i}.descricao`) || undefined}
                        data-testid={`revisao-magia-${i}`}
                      >
                        <summary>
                          {m.nome}
                          {m.escola && <span className="nota"> · {m.escola}</span>}
                        </summary>
                        <pre className="rev-descricao">
                          {m.descricao || "(sem descrição no PDF)"}
                        </pre>
                      </details>
                    ))}
                  </div>
                );
              })}
            </div>
            <Avisos lista={avisos("magias")} />
          </Secao>

          <Secao
            id="caracteristicas"
            titulo={`${TITULOS.caracteristicas} (${ficha.caracteristicas?.length ?? 0})`}
            trecho={trecho("caracteristicas")}
            avisos={incertosPorSecao.get("caracteristicas")?.length ?? 0}
            aberta={abertas.has("caracteristicas")}
            aoAlternar={() => alternar("caracteristicas")}
            resumo={resumoDe("caracteristicas")}
          >
            {(ficha.caracteristicas ?? []).map((c, i) => (
              <details key={`caracteristica-${c.nome}`} data-testid={`revisao-caracteristica-${i}`}>
                <summary>{c.nome}</summary>
                <pre className="rev-descricao">{c.descricao || "(sem descrição no PDF)"}</pre>
              </details>
            ))}
            <Avisos lista={avisos("caracteristicas")} />
          </Secao>

          <Secao
            id="equipamento"
            titulo={`${TITULOS.equipamento} (${ficha.itens?.length ?? 0})`}
            trecho={trecho("equipamento")}
            avisos={incertosPorSecao.get("equipamento")?.length ?? 0}
            aberta={abertas.has("equipamento")}
            aoAlternar={() => alternar("equipamento")}
            resumo={resumoDe("equipamento")}
          >
            <ul className="rev-lista">
              {(ficha.itens ?? []).map((it, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a lista é a do PDF, na ordem dele
                <li key={i}>
                  {it.quantidade} × {it.nome}
                </li>
              ))}
            </ul>
            <Avisos lista={avisos("equipamento")} />
          </Secao>

          <Secao
            id="recursos"
            titulo={TITULOS.recursos}
            trecho={trecho("recursos")}
            avisos={incertosPorSecao.get("recursos")?.length ?? 0}
            aberta={abertas.has("recursos")}
            aoAlternar={() => alternar("recursos")}
            resumo={resumoDe("recursos")}
          >
            {(ficha.recursos ?? []).length === 0 && (
              <p className="nota">Nenhuma caixa de recurso no PDF.</p>
            )}
            {(ficha.recursos ?? []).map((r, i) => {
              const caminho = `recursos.${i}`;
              return (
                <div
                  key={caminho}
                  className="rev-recurso"
                  data-incerto={ehIncerto(caminho) || undefined}
                  data-testid={`revisao-recurso-${i}`}
                >
                  <label>
                    Nome
                    <input
                      type="text"
                      value={r.nome}
                      maxLength={80}
                      onChange={(e) => editar(`${caminho}.nome`, e.target.value)}
                    />
                  </label>
                  <label>
                    Atual
                    <input
                      type="number"
                      min={0}
                      value={r.atual}
                      onChange={(e) =>
                        editar(`${caminho}.atual`, apenasNumero(e.target.value) ?? 0)
                      }
                    />
                  </label>
                  <label>
                    Máximo
                    <input
                      type="number"
                      min={0}
                      value={r.max}
                      onChange={(e) => editar(`${caminho}.max`, apenasNumero(e.target.value) ?? 0)}
                    />
                  </label>
                  <label>
                    Recarrega
                    <select
                      value={r.recarga}
                      onChange={(e) => editar(`${caminho}.recarga`, e.target.value)}
                    >
                      {RECARGAS.map((x) => (
                        <option key={x} value={x}>
                          {
                            { curto: "descanso curto", longo: "descanso longo", nenhuma: "nunca" }[
                              x
                            ]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                  {doCaminho(caminho).map((i2) => (
                    <Aviso key={i2.motivo} incerto={i2} />
                  ))}
                </div>
              );
            })}
          </Secao>

          <Secao
            id="notas"
            titulo={TITULOS.notas}
            trecho={trecho("notas")}
            avisos={incertosPorSecao.get("notas")?.length ?? 0}
            aberta={abertas.has("notas")}
            aoAlternar={() => alternar("notas")}
            resumo={resumoDe("notas")}
          >
            <pre className="rev-descricao">{ficha.notas || "(vazio)"}</pre>
          </Secao>
        </div>

        <footer className="rev-rodape">
          {erro && (
            <p className="rev-erro" role="alert" data-testid="revisao-erro">
              {erro}
            </p>
          )}
          <span className="rev-rodape-nota nota">
            Nada vai para a sala até você confirmar. Cancelar descarta tudo.
          </span>
          <button type="button" data-testid="revisao-cancelar" onClick={aoCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="primario"
            data-testid="revisao-confirmar"
            onClick={tentarConfirmar}
          >
            {alvo ? `Substituir a ficha de ${alvo.nome}` : "Criar a ficha"}
          </button>
        </footer>

        {confirmando && alvo && (
          <div className="rev-confirmar" role="alertdialog" data-testid="revisao-sobrescrever">
            <div className="rev-confirmar-caixa">
              <strong>Importar por cima?</strong>
              <p>
                Isto substitui TODA a ficha de <strong>{alvo.nome}</strong> pela que está nesta
                tela. O retrato, o token e a pasta do item continuam como estão.
              </p>
              <div className="linha-botoes">
                <button
                  type="button"
                  className="perigo"
                  data-testid="revisao-sobrescrever-sim"
                  onClick={enviar}
                >
                  Substituir a ficha
                </button>
                <button
                  type="button"
                  data-testid="revisao-sobrescrever-nao"
                  onClick={() => setConfirmando(false)}
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Secao({
  id,
  titulo,
  trecho,
  avisos,
  aberta,
  aoAlternar,
  resumo,
  children,
}: {
  id: string;
  titulo: string;
  trecho: string;
  avisos: number;
  aberta: boolean;
  aoAlternar: () => void;
  /** O que a seção recolhida diz no lugar do conteúdo. */
  resumo: string;
  children: ReactNode;
}) {
  const idDoCorpo = `revisao-corpo-${id}`;
  return (
    <section
      className="rev-secao"
      data-testid={`revisao-secao-${id}`}
      data-secao={id}
      data-aberta={aberta}
    >
      <h3>
        <button
          type="button"
          className="rev-secao-alternar"
          data-testid={`revisao-secao-alternar-${id}`}
          aria-expanded={aberta}
          aria-controls={idDoCorpo}
          onClick={aoAlternar}
        >
          {aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>{titulo}</span>
        </button>
        {avisos > 0 && <span className="rev-selo amarelo">{avisos} para conferir</span>}
        {!aberta && avisos === 0 && (
          <span className="rev-resumo" data-testid={`revisao-resumo-${id}`}>
            {resumo}
          </span>
        )}
      </h3>
      <div className="rev-par" id={idDoCorpo} hidden={!aberta}>
        <div className="rev-lido">{children}</div>
        <div className="rev-pdf">
          <div className="rev-pdf-titulo">Trecho do PDF</div>
          <pre data-testid={`revisao-trecho-${id}`}>{trecho || "(nada lido)"}</pre>
        </div>
      </div>
    </section>
  );
}

function Aviso({ incerto }: { incerto: Incerto }) {
  return (
    <p className="rev-aviso" data-incerto="true">
      <AlertTriangle size={14} />
      <span>
        {incerto.motivo}
        {incerto.trecho && <code className="rev-trecho"> {incerto.trecho}</code>}
      </span>
    </p>
  );
}

function Avisos({ lista }: { lista: Incerto[] }) {
  if (lista.length === 0) return null;
  return (
    <div className="rev-avisos" data-testid="revisao-avisos">
      {lista.map((i) => (
        <Aviso key={`${i.caminho}-${i.motivo}`} incerto={i} />
      ))}
    </div>
  );
}

function CampoTexto({
  caminho,
  rotulo,
  valor,
  incertos,
  editar,
}: {
  caminho: string;
  rotulo: string;
  valor: string;
  incertos: Incerto[];
  editar: (caminho: string, valor: string) => void;
}) {
  const incerto = incertos.length > 0;
  return (
    <span className="rev-campo" data-incerto={incerto || undefined}>
      <input
        type="text"
        aria-label={rotulo}
        data-testid={`revisao-campo-${caminho}`}
        value={valor}
        onChange={(e) => editar(caminho, e.target.value)}
      />
      {incertos.map((i) => (
        <span key={i.motivo} className="rev-motivo">
          {i.motivo}
        </span>
      ))}
    </span>
  );
}

function CampoNumero({
  caminho,
  rotulo,
  valor,
  incertos,
  editar,
}: {
  caminho: string;
  rotulo: string;
  valor: number | undefined;
  incertos: Incerto[];
  editar: Editar;
}) {
  return (
    <span className="rev-campo" data-incerto={incertos.length > 0 || undefined}>
      <input
        type="number"
        min={0}
        aria-label={rotulo}
        data-testid={`revisao-campo-${caminho}`}
        value={valor ?? ""}
        placeholder="vazio"
        onChange={(e) => editar(caminho, apenasNumero(e.target.value))}
      />
      {incertos.map((i) => (
        <span key={i.motivo} className="rev-motivo">
          {i.motivo}
        </span>
      ))}
    </span>
  );
}

function CampoDeNivel({
  caminho,
  nivel,
  bonus,
  incertos,
  editar,
}: {
  caminho: string;
  nivel: NivelDeProficiencia;
  bonus: number | undefined;
  incertos: Incerto[];
  editar: Editar;
}) {
  return (
    <span className="rev-campo" data-incerto="true">
      <select
        aria-label="Proficiência"
        data-testid={`revisao-campo-${caminho}`}
        value={nivel}
        onChange={(e) => editar(`${caminho}.nivel`, e.target.value)}
      >
        {NIVEIS_DE_PROFICIENCIA.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <input
        type="number"
        aria-label="Bônus extra"
        value={bonus ?? 0}
        onChange={(e) => editar(`${caminho}.bonus`, apenasNumero(e.target.value) ?? 0)}
      />
      {incertos.map((i) => (
        <span key={i.motivo} className="rev-motivo">
          {i.motivo}
        </span>
      ))}
    </span>
  );
}

function LinhaDeAtaque({
  i,
  a,
  doCaminho,
  editar,
}: {
  i: number;
  a: Ataque;
  doCaminho: (caminho: string) => Incerto[];
  editar: Editar;
}) {
  const nome = doCaminho(`ataques.${i}.nome`);
  const tipo = doCaminho(`ataques.${i}.tipo`);
  const acerto = doCaminho(`ataques.${i}.acerto`);
  const bonus =
    a.cd !== undefined
      ? `CD ${a.cd}`
      : a.acerto?.tipo === "fixo"
        ? a.acerto.valor >= 0
          ? `+${a.acerto.valor}`
          : String(a.acerto.valor)
        : "—";
  return (
    <tr
      data-testid={`revisao-ataque-${i}`}
      data-incerto={nome.length + tipo.length + acerto.length > 0 || undefined}
    >
      <td>{i + 1}</td>
      <td data-incerto={nome.length > 0 || undefined}>
        <input
          type="text"
          aria-label={`Nome do ataque ${i + 1}`}
          data-testid={`revisao-campo-ataques.${i}.nome`}
          value={a.nome}
          maxLength={80}
          onChange={(e) => editar(`ataques.${i}.nome`, e.target.value)}
        />
        {nome.map((x) => (
          <span key={x.motivo} className="rev-motivo">
            {x.motivo}
          </span>
        ))}
      </td>
      <td data-incerto={acerto.length > 0 || undefined}>{bonus}</td>
      <td>{a.dano ?? "—"}</td>
      <td data-incerto={tipo.length > 0 || undefined}>
        <input
          type="text"
          aria-label={`Tipo do dano do ataque ${i + 1}`}
          data-testid={`revisao-campo-ataques.${i}.tipo`}
          value={a.tipo ?? ""}
          maxLength={32}
          onChange={(e) =>
            editar(`ataques.${i}.tipo`, e.target.value === "" ? undefined : e.target.value)
          }
        />
        {tipo.map((x) => (
          <span key={x.motivo} className="rev-motivo">
            {x.motivo}
          </span>
        ))}
      </td>
    </tr>
  );
}
