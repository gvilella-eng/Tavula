import type {
  AcaoDeFluxo,
  AlvoDoParaCada,
  Bloco,
  CondicaoDoSe,
  Estado,
  Fluxo,
  Gatilho,
  NomesParaAFrase,
} from "@tabletop/shared";
import { Copy, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import type { Fontes } from "../assets/fontes";
import { EscolherSom, type SomEscolhido } from "../som/EscolherSom";
import {
  type ErroDoEditor,
  grupoDoBloco,
  idDoCaminho,
  PECAS,
  rotuloDoBloco,
  rotuloDoGatilho,
  type Selecao,
} from "./blocos";

// O painel da direita do editor (AU1): os campos do bloco escolhido. Cada grupo de campos lado a lado usa `.linha-par`, a
// grade de 3 trilhas (rótulo, caixa, ajuda) do A1: o rótulo mais alto define a linha e as caixas ficam alinhadas.

type Props = {
  estado: Estado;
  rascunho: Fluxo;
  selecao: Selecao;
  bloco: Bloco | undefined;
  nomes: NomesParaAFrase;
  sinais: readonly string[];
  erros: readonly ErroDoEditor[];
  fontes: Fontes | null;
  registrarSom: ((arquivo: File) => Promise<SomEscolhido>) | null;
  aoMudarFluxo: (f: Fluxo) => void;
  aoMudarBloco: (b: Bloco) => void;
  aoDuplicar: () => void;
  aoApagar: () => void;
};

const COR = {
  quando: "var(--acento-forte)",
  fluxo: "var(--etiqueta-azul)",
  faca: "var(--sucesso)",
} as const;

const formatar = (n: number | undefined) =>
  n === undefined ? "" : String(Math.round(n * 1000) / 1000).replace(".", ",");
const ler = (t: string): number | null => {
  const limpo = t.trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
};

/** Um campo de número: o texto fica aqui (dá para digitar "0," no meio), o valor sobe quando o texto é um número. */
function CampoNumero(p: {
  testid: string;
  rotulo: string;
  valor: number | undefined;
  aoMudar: (v: number | undefined) => void;
  /** Sem número, o campo vale "nada" (campo opcional). */
  opcional?: boolean;
  ajuda?: string;
  /** Mostra o valor multiplicado (a chance em %). */
  escala?: number;
}) {
  const escala = p.escala ?? 1;
  const mostrado = p.valor === undefined ? undefined : p.valor * escala;
  const [texto, setTexto] = useState(formatar(mostrado));
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando o valor muda por fora
  useEffect(() => {
    const atual = ler(texto);
    if (
      atual === null ? mostrado !== undefined : Math.abs(atual - (mostrado ?? Number.NaN)) > 1e-9
    ) {
      setTexto(formatar(mostrado));
    }
  }, [mostrado]);
  return (
    <label className="campo-coluna">
      <span>{p.rotulo}</span>
      <input
        className="ed-entrada"
        type="text"
        inputMode="decimal"
        data-testid={p.testid}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = ler(e.target.value);
          if (n !== null) p.aoMudar(n / escala);
          else if (p.opcional === true && e.target.value.trim() === "") p.aoMudar(undefined);
        }}
      />
      <span className="ajuda-do-campo">{p.ajuda ?? ""}</span>
    </label>
  );
}

function CampoTexto(p: {
  testid: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  ajuda?: string;
  sugestoes?: readonly string[];
  maxLength?: number;
  area?: boolean;
}) {
  const lista = useId();
  const id = useId();
  return (
    <div className="campo-coluna">
      <label htmlFor={id}>{p.rotulo}</label>
      {p.area ? (
        <textarea
          className="ed-entrada"
          id={id}
          rows={3}
          data-testid={p.testid}
          value={p.valor}
          maxLength={p.maxLength}
          onChange={(e) => p.aoMudar(e.target.value)}
        />
      ) : (
        <input
          className="ed-entrada"
          id={id}
          type="text"
          data-testid={p.testid}
          value={p.valor}
          maxLength={p.maxLength}
          list={p.sugestoes && p.sugestoes.length > 0 ? lista : undefined}
          onChange={(e) => p.aoMudar(e.target.value)}
        />
      )}
      {p.sugestoes && p.sugestoes.length > 0 && (
        <datalist id={lista}>
          {p.sugestoes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <span className="ajuda-do-campo">{p.ajuda ?? ""}</span>
    </div>
  );
}

function CampoEscolha(p: {
  testid: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: readonly { valor: string; nome: string }[];
  ajuda?: string;
}) {
  return (
    <label className="campo-coluna">
      <span>{p.rotulo}</span>
      <select
        className="ed-entrada"
        data-testid={p.testid}
        value={p.valor}
        onChange={(e) => p.aoMudar(e.target.value)}
      >
        {p.opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
      <span className="ajuda-do-campo">{p.ajuda ?? ""}</span>
    </label>
  );
}

function Caixa(p: {
  testid: string;
  rotulo: ReactNode;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="linha-opcao">
      <input
        type="checkbox"
        data-testid={p.testid}
        checked={p.marcado}
        onChange={(e) => p.aoMudar(e.target.checked)}
      />
      {p.rotulo}
    </label>
  );
}

const sem = <T extends object, K extends keyof T>(o: T, k: K): Omit<T, K> => {
  const { [k]: _fora, ...resto } = o;
  return resto;
};

export function PainelDoBloco(p: Props) {
  const { estado } = p;
  const cenas = estado.cenas.map((c) => ({ valor: c.id, nome: c.nome }));
  const modelos = estado.modelos.map((m) => ({ valor: m.id, nome: m.nome }));
  const zonas = (estado.zonas ?? []).map((z) => ({ valor: z.id, nome: z.nome }));
  const sons = (estado.assets ?? [])
    .filter((a) => a.tipo === "som")
    .map((a) => ({ hash: a.hash, nome: a.nomeOriginal.replace(/\.[^.]+$/, "") }));
  const qualquer = (rotulo: string) => ({ valor: "", nome: rotulo });

  if (p.selecao.tipo === "gatilho")
    return (
      <PainelDoGatilho {...p} cenas={cenas} modelos={modelos} zonas={zonas} qualquer={qualquer} />
    );
  const b = p.bloco;
  if (b === undefined) return <p className="nota">Escolha um bloco no fluxo.</p>;
  const id = idDoCaminho(p.selecao.caminho);
  const grupo = grupoDoBloco(b);
  const rotulo = rotuloDoBloco(b, p.nomes);
  const meus = p.erros.filter((e) => e.onde === id);

  const campos = (() => {
    switch (b.bloco) {
      case "esperar":
        return (
          <CampoNumero
            testid="ed-campo-s"
            rotulo="Esperar (segundos)"
            valor={b.s}
            aoMudar={(v) => v !== undefined && p.aoMudarBloco({ ...b, s: v })}
            ajuda="Conta no tempo da mesa: pausar a mesa pausa a espera."
          />
        );
      case "sortear":
        return (
          <CampoNumero
            testid="ed-campo-chance"
            rotulo="Chance de “sim” (%)"
            valor={b.chance}
            escala={100}
            aoMudar={(v) =>
              v !== undefined && p.aoMudarBloco({ ...b, chance: Math.min(1, Math.max(0, v)) })
            }
            ajuda="Cada vez tira a sua sorte. O “não” é a saída de baixo."
          />
        );
      case "se":
        return <CamposDaCondicao b={b} p={p} cenas={cenas} zonas={zonas} />;
      case "paraCada":
        return (
          <CamposDoAlvo
            b={b}
            p={p}
            cenas={cenas}
            zonas={zonas}
            modelos={modelos}
            qualquer={qualquer}
          />
        );
      case "sinal":
        return (
          <>
            <CampoTexto
              testid="ed-campo-sinal"
              rotulo="Nome do sinal"
              valor={b.nome}
              maxLength={48}
              sugestoes={p.sinais}
              aoMudar={(v) => p.aoMudarBloco({ ...b, nome: v })}
              ajuda="Roda as automações que esperam este sinal."
            />
            <CampoNumero
              testid="ed-campo-atraso"
              rotulo="Daqui a (segundos)"
              valor={b.atrasoS}
              opcional
              aoMudar={(v) =>
                p.aoMudarBloco(
                  v === undefined ? (sem(b, "atrasoS") as Bloco) : { ...b, atrasoS: v },
                )
              }
              ajuda="Vazio: manda agora."
            />
          </>
        );
      case "acao":
        return (
          <CamposDaAcao
            a={b.acao}
            aoMudar={(a) => p.aoMudarBloco({ bloco: "acao", acao: a })}
            zonas={zonas}
            sons={sons}
            fontes={p.fontes}
            registrarSom={p.registrarSom}
          />
        );
    }
  })();

  return (
    <div className="ed-painel-conteudo" data-testid={`ed-painel-${id}`}>
      <div className="ed-painel-titulo">
        <span className="ed-ponto" style={{ background: COR[grupo] }} aria-hidden />
        <h2>{rotulo.titulo}</h2>
      </div>
      <p className="nota">{descricaoDoBloco(b)}</p>
      {campos}
      {meus.map((e) => (
        <p key={e.texto} className="ed-erro" role="alert" data-testid={`ed-painel-erro-${id}`}>
          {e.texto}
        </p>
      ))}
      <div className="ed-espaco-vertical" />
      <div className="linha-botoes">
        <button type="button" data-testid="ed-duplicar" onClick={p.aoDuplicar}>
          <Copy size={13} aria-hidden /> Duplicar
        </button>
        <button type="button" className="perigo" data-testid="ed-apagar-bloco" onClick={p.aoApagar}>
          <Trash2 size={13} aria-hidden /> Apagar bloco
        </button>
      </div>
    </div>
  );
}

function descricaoDoBloco(b: Bloco): string {
  switch (b.bloco) {
    case "esperar":
      return "Segura a trilha por um tempo e só depois segue para o próximo bloco.";
    case "se":
      return "Segue pelo “sim” se a condição vale; senão, pelo “não”.";
    case "sortear":
      return "Sorteia a cada vez: segue pelo “sim” com a chance escolhida, senão pelo “não”.";
    case "paraCada":
      return "Repete o que está dentro para cada objeto ou token do alvo. As ações de dentro mexem em quem a vez é.";
    case "sinal":
      return "Avisa as outras automações. As que esperam este sinal rodam (já, ou depois de um tempo).";
    case "acao":
      return b.acao.acao.startsWith("objeto") || b.acao.acao === "luz.modificar"
        ? "Mexe na luz da vez: o objeto do gatilho ou o do “para cada” em volta."
        : b.acao.acao.startsWith("visao") || b.acao.acao.startsWith("token")
          ? "Mexe no token da vez: o do gatilho ou o do “para cada” em volta."
          : "Uma ação da mesa.";
  }
}

function CamposDaCondicao(p: {
  b: Extract<Bloco, { bloco: "se" }>;
  p: Props;
  cenas: { valor: string; nome: string }[];
  zonas: { valor: string; nome: string }[];
}) {
  const { b } = p;
  const c = b.condicao;
  const trocar = (condicao: CondicaoDoSe) => p.p.aoMudarBloco({ ...b, condicao });
  return (
    <>
      <CampoEscolha
        testid="ed-campo-condicao"
        rotulo="Condição"
        valor={c.condicao}
        opcoes={[
          { valor: "etiqueta", nome: "O objeto tem a etiqueta" },
          { valor: "dentroDaZona", nome: "Está dentro da zona" },
          { valor: "cena", nome: "Está numa destas cenas" },
          { valor: "zonaLigada", nome: "A zona está ligada" },
        ]}
        aoMudar={(v) => {
          if (v === "etiqueta") trocar({ condicao: "etiqueta", etiqueta: "chama" });
          else if (v === "cena")
            trocar({
              condicao: "cena",
              cenas: p.cenas[0] ? [p.cenas[0].valor] : [],
            } as CondicaoDoSe);
          else if (v === "dentroDaZona")
            trocar({ condicao: "dentroDaZona", zona: p.zonas[0]?.valor ?? "" });
          else trocar({ condicao: "zonaLigada", zona: p.zonas[0]?.valor ?? "" });
        }}
      />
      {c.condicao === "etiqueta" && (
        <CampoTexto
          testid="ed-campo-etiqueta"
          rotulo="Etiqueta"
          valor={c.etiqueta}
          maxLength={32}
          aoMudar={(v) => trocar({ condicao: "etiqueta", etiqueta: v })}
          ajuda="A etiqueta do modelo do objeto (ex.: chama)."
        />
      )}
      {(c.condicao === "dentroDaZona" || c.condicao === "zonaLigada") && (
        <CampoEscolha
          testid="ed-campo-zona"
          rotulo="Zona"
          valor={c.zona}
          opcoes={[{ valor: "", nome: "Escolha uma zona…" }, ...p.zonas]}
          aoMudar={(v) => trocar({ condicao: c.condicao, zona: v })}
        />
      )}
      {c.condicao === "cena" && (
        <div className="ed-escolha-de-cenas" data-testid="ed-campo-cenas">
          {p.cenas.map((x) => (
            <Caixa
              key={x.valor}
              testid={`ed-campo-cenas-${x.valor}`}
              rotulo={x.nome}
              marcado={c.cenas.includes(x.valor)}
              aoMudar={(m) => {
                const cs = m ? [...c.cenas, x.valor] : c.cenas.filter((y) => y !== x.valor);
                trocar({ condicao: "cena", cenas: cs } as CondicaoDoSe);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CamposDoAlvo(p: {
  b: Extract<Bloco, { bloco: "paraCada" }>;
  p: Props;
  cenas: { valor: string; nome: string }[];
  zonas: { valor: string; nome: string }[];
  modelos: { valor: string; nome: string }[];
  qualquer: (r: string) => { valor: string; nome: string };
}) {
  const { b } = p;
  const a = b.alvo;
  const mudar = (alvo: AlvoDoParaCada) => p.p.aoMudarBloco({ ...b, alvo });
  const opcional = <T extends object>(o: T, k: string, v: string): T => {
    const { [k as keyof T]: _fora, ...resto } = o;
    return (v === "" ? resto : { ...resto, [k]: v }) as T;
  };
  return (
    <>
      <CampoEscolha
        testid="ed-campo-alvo"
        rotulo="Para cada"
        valor={a.tipo}
        opcoes={[
          { valor: "objetos", nome: "Objeto de luz (tocha…)" },
          { valor: "tokens", nome: "Token" },
        ]}
        aoMudar={(v) =>
          mudar(v === "objetos" ? { tipo: "objetos", acesos: true } : { tipo: "tokens" })
        }
        ajuda="Sempre dentro das cenas da automação."
      />
      {a.tipo === "objetos" ? (
        <>
          <CampoEscolha
            testid="ed-campo-modelo"
            rotulo="Modelo"
            valor={a.modelo ?? ""}
            opcoes={[p.qualquer("Qualquer modelo"), ...p.modelos]}
            aoMudar={(v) => mudar(opcional(a, "modelo", v))}
          />
          <CampoTexto
            testid="ed-campo-etiqueta"
            rotulo="Etiqueta"
            valor={a.etiqueta ?? ""}
            maxLength={32}
            aoMudar={(v) => mudar(opcional(a, "etiqueta", v.trim()))}
            ajuda="Vazio: qualquer etiqueta."
          />
          <CampoEscolha
            testid="ed-campo-na-zona"
            rotulo="Só dentro da zona"
            valor={a.naZona ?? ""}
            opcoes={[p.qualquer("Em qualquer lugar"), ...p.zonas]}
            aoMudar={(v) => mudar(opcional(a, "naZona", v))}
          />
          <Caixa
            testid="ed-campo-acesos"
            rotulo="Só os acesos"
            marcado={a.acesos === true}
            aoMudar={(m) =>
              mudar(m ? { ...a, acesos: true } : (sem(a, "acesos") as AlvoDoParaCada))
            }
          />
        </>
      ) : (
        <>
          <CampoEscolha
            testid="ed-campo-na-zona"
            rotulo="Só dentro da zona"
            valor={a.naZona ?? ""}
            opcoes={[p.qualquer("Em qualquer lugar"), ...p.zonas]}
            aoMudar={(v) => mudar(opcional(a, "naZona", v))}
          />
          <CampoEscolha
            testid="ed-campo-na-cena"
            rotulo="Só na cena"
            valor={a.naCena ?? ""}
            opcoes={[p.qualquer("Em todas as cenas da automação"), ...p.cenas]}
            aoMudar={(v) => mudar(opcional(a, "naCena", v))}
          />
        </>
      )}
    </>
  );
}

function CamposDaAcao(p: {
  a: AcaoDeFluxo;
  aoMudar: (a: AcaoDeFluxo) => void;
  zonas: { valor: string; nome: string }[];
  sons: { hash: string; nome: string }[];
  fontes: Fontes | null;
  registrarSom: ((arquivo: File) => Promise<SomEscolhido>) | null;
}) {
  const { a } = p;
  switch (a.acao) {
    case "luz.modificar":
      return (
        <>
          <div className="linha-par">
            <CampoNumero
              testid="ed-campo-raiox"
              rotulo="Vezes o raio"
              valor={a.raioX}
              opcional
              aoMudar={(v) =>
                p.aoMudar(v === undefined ? (sem(a, "raioX") as AcaoDeFluxo) : { ...a, raioX: v })
              }
              ajuda="0,5 = metade da luz."
            />
            <CampoNumero
              testid="ed-campo-soma"
              rotulo="Mais metros"
              valor={a.raioSomaM}
              opcional
              aoMudar={(v) =>
                p.aoMudar(
                  v === undefined ? (sem(a, "raioSomaM") as AcaoDeFluxo) : { ...a, raioSomaM: v },
                )
              }
              ajuda="Soma ao raio; pode ser negativo."
            />
          </div>
          <CampoNumero
            testid="ed-campo-por"
            rotulo="Por (segundos)"
            valor={a.porS}
            opcional
            aoMudar={(v) =>
              p.aoMudar(v === undefined ? (sem(a, "porS") as AcaoDeFluxo) : { ...a, porS: v })
            }
            ajuda="Depois disso a luz volta sozinha. Vazio: 30 s."
          />
        </>
      );
    case "objeto.apagar":
      return (
        <div className="linha-par">
          <CampoNumero
            testid="ed-campo-chance"
            rotulo="Chance de apagar (%)"
            valor={a.chance ?? 1}
            escala={100}
            aoMudar={(v) =>
              v !== undefined && p.aoMudar({ ...a, chance: Math.min(1, Math.max(0, v)) })
            }
            ajuda="100 = sempre."
          />
          <CampoNumero
            testid="ed-campo-penalidade"
            rotulo="Perde (segundos)"
            valor={a.penalidadeS}
            opcional
            aoMudar={(v) =>
              p.aoMudar(
                v === undefined ? (sem(a, "penalidadeS") as AcaoDeFluxo) : { ...a, penalidadeS: v },
              )
            }
            ajuda="Tempo que sai do que sobra."
          />
        </div>
      );
    case "objeto.ajustarTempo":
      return (
        <CampoNumero
          testid="ed-campo-delta"
          rotulo="Mudar o tempo (segundos)"
          valor={a.deltaS}
          aoMudar={(v) => v !== undefined && p.aoMudar({ ...a, deltaS: v })}
          ajuda="Negativo tira tempo; positivo dá."
        />
      );
    case "visao.limitar":
      return (
        <div className="linha-par">
          <CampoNumero
            testid="ed-campo-alcance"
            rotulo="Alcance (m)"
            valor={a.alcanceM}
            aoMudar={(v) => v !== undefined && p.aoMudar({ ...a, alcanceM: v })}
            ajuda="Até onde o token enxerga."
          />
          <CampoNumero
            testid="ed-campo-por"
            rotulo="Por (segundos)"
            valor={a.porS}
            opcional
            aoMudar={(v) =>
              p.aoMudar(v === undefined ? (sem(a, "porS") as AcaoDeFluxo) : { ...a, porS: v })
            }
            ajuda="Vazio: 30 s."
          />
        </div>
      );
    case "chat.anunciar":
      return (
        <>
          <CampoTexto
            testid="ed-campo-texto"
            rotulo="Texto"
            valor={a.texto}
            maxLength={300}
            area
            aoMudar={(v) => p.aoMudar({ ...a, texto: v })}
          />
          <CampoEscolha
            testid="ed-campo-para"
            rotulo="Para quem"
            valor={a.para}
            opcoes={[
              { valor: "todos", nome: "Todos" },
              { valor: "mestre", nome: "Só o mestre" },
            ]}
            aoMudar={(v) => p.aoMudar({ ...a, para: v === "mestre" ? "mestre" : "todos" })}
          />
        </>
      );
    case "som.tocar":
      return (
        <>
          <CampoEscolha
            testid="ed-campo-som"
            rotulo="Som"
            valor={a.hash}
            opcoes={[
              { valor: "", nome: "Escolha um som…" },
              ...p.sons.map((s) => ({ valor: s.hash, nome: s.nome })),
            ]}
            aoMudar={(v) => {
              const achado = p.sons.find((s) => s.hash === v);
              p.aoMudar({ ...a, hash: v, nome: achado?.nome ?? "" });
            }}
          />
          <CampoEscolha
            testid="ed-campo-para"
            rotulo="Para quem"
            valor={a.para}
            opcoes={[
              { valor: "todos", nome: "Todos" },
              { valor: "cena", nome: "Quem vê a cena" },
              { valor: "token", nome: "Quem controla o token" },
            ]}
            aoMudar={(v) => p.aoMudar({ ...a, para: v as typeof a.para })}
          />
          <CampoNumero
            testid="ed-campo-volume"
            rotulo="Volume (%)"
            valor={a.volume}
            escala={100}
            aoMudar={(v) =>
              v !== undefined && p.aoMudar({ ...a, volume: Math.min(1, Math.max(0, v)) })
            }
          />
          {p.fontes && p.registrarSom && (
            <details className="avancado" data-testid="ed-adicionar-som">
              <summary>Adicionar um som à mesa</summary>
              <EscolherSom
                fontes={p.fontes}
                registrar={p.registrarSom}
                testid="ed-escolher-som"
                aoEscolher={(s) => p.aoMudar({ ...a, hash: s.hash, nome: s.nome })}
              />
            </details>
          )}
        </>
      );
    case "token.mostrar":
    case "token.ocultar":
      return (
        <CampoEscolha
          testid="ed-campo-mostrar"
          rotulo="O token"
          valor={a.acao}
          opcoes={[
            { valor: "token.mostrar", nome: "Aparece" },
            { valor: "token.ocultar", nome: "Fica oculto" },
          ]}
          aoMudar={(v) =>
            p.aoMudar({ acao: v === "token.mostrar" ? "token.mostrar" : "token.ocultar" })
          }
        />
      );
    case "zona.ativar":
      return (
        <>
          <CampoEscolha
            testid="ed-campo-zona"
            rotulo="Zona"
            valor={a.zona}
            opcoes={[{ valor: "", nome: "Escolha uma zona…" }, ...p.zonas]}
            aoMudar={(v) => p.aoMudar({ ...a, zona: v })}
          />
          <CampoEscolha
            testid="ed-campo-ativa"
            rotulo="Fazer com ela"
            valor={a.ativa ? "ligar" : "desligar"}
            opcoes={[
              { valor: "ligar", nome: "Ligar" },
              { valor: "desligar", nome: "Desligar" },
            ]}
            aoMudar={(v) => p.aoMudar({ ...a, ativa: v === "ligar" })}
          />
        </>
      );
  }
}

function PainelDoGatilho(
  p: Props & {
    cenas: { valor: string; nome: string }[];
    modelos: { valor: string; nome: string }[];
    zonas: { valor: string; nome: string }[];
    qualquer: (r: string) => { valor: string; nome: string };
  },
) {
  const g = p.rascunho.gatilho;
  const mudarGatilho = (novo: Gatilho) => p.aoMudarFluxo({ ...p.rascunho, gatilho: novo });
  const opcional = <T extends object>(o: T, k: string, v: string): T => {
    const { [k as keyof T]: _fora, ...resto } = o;
    return (v === "" ? resto : { ...resto, [k]: v }) as T;
  };
  const rotulo = rotuloDoGatilho(g, p.nomes);
  const podeFixar = g.tipo === "relogio" || g.tipo === "botao";
  const meus = p.erros.filter((e) => e.onde === "gatilho" || e.onde === "cenas");
  return (
    <div className="ed-painel-conteudo" data-testid="ed-painel-gatilho">
      <div className="ed-painel-titulo">
        <span className="ed-ponto" style={{ background: COR.quando }} aria-hidden />
        <h2>Quando: {rotulo.titulo.toLowerCase()}</h2>
      </div>
      <p className="nota">
        O que faz a automação começar. Depois dele, cada trilha roda de cima para baixo, todas
        juntas.
      </p>
      <CampoEscolha
        testid="ed-campo-gatilho"
        rotulo="Quando"
        valor={g.tipo}
        opcoes={PECAS.filter((x) => x.grupo === "quando").map((x) => ({
          valor: x.id,
          nome: x.rotulo,
        }))}
        aoMudar={(v) => {
          const peca = PECAS.find((x) => x.id === v);
          const feito = peca?.criar();
          if (feito && "gatilho" in feito) mudarGatilho(feito.gatilho);
        }}
      />
      {g.tipo === "relogio" && (
        <div className="linha-par">
          <CampoNumero
            testid="ed-campo-cada"
            rotulo="A cada (segundos)"
            valor={g.cadaS}
            aoMudar={(v) => v !== undefined && mudarGatilho({ ...g, cadaS: v })}
            ajuda="Dispara já ao começar."
          />
          <CampoNumero
            testid="ed-campo-primeiro"
            rotulo="Primeira vez depois de (s)"
            valor={g.primeiroS}
            opcional
            aoMudar={(v) =>
              mudarGatilho(
                v === undefined
                  ? ({ tipo: "relogio", cadaS: g.cadaS } as Gatilho)
                  : { ...g, primeiroS: v },
              )
            }
            ajuda="Vazio: na hora."
          />
        </div>
      )}
      {g.tipo === "botao" && (
        <>
          <CampoTexto
            testid="ed-campo-botao"
            rotulo="Nome do botão"
            valor={g.nome}
            maxLength={40}
            aoMudar={(v) => mudarGatilho({ ...g, nome: v })}
          />
          <CampoEscolha
            testid="ed-campo-cena-do-botao"
            rotulo="Só na cena"
            valor={g.cena ?? ""}
            opcoes={[p.qualquer("Em todas as cenas"), ...p.cenas]}
            aoMudar={(v) => mudarGatilho(opcional(g, "cena", v))}
          />
        </>
      )}
      {g.tipo === "sinal" && (
        <CampoTexto
          testid="ed-campo-sinal"
          rotulo="Nome do sinal"
          valor={g.nome}
          maxLength={48}
          sugestoes={p.sinais}
          aoMudar={(v) => mudarGatilho({ ...g, nome: v })}
          ajuda="Roda quando outra automação manda este sinal."
        />
      )}
      {g.tipo === "tocha" && (
        <>
          <CampoEscolha
            testid="ed-campo-muda"
            rotulo="A tocha"
            valor={g.muda}
            opcoes={[
              { valor: "acende", nome: "Acende" },
              { valor: "apaga", nome: "Apaga" },
            ]}
            aoMudar={(v) => mudarGatilho({ ...g, muda: v === "apaga" ? "apaga" : "acende" })}
          />
          <CampoEscolha
            testid="ed-campo-modelo"
            rotulo="Modelo"
            valor={g.modelo ?? ""}
            opcoes={[p.qualquer("Qualquer modelo"), ...p.modelos]}
            aoMudar={(v) => mudarGatilho(opcional(g, "modelo", v))}
          />
          <CampoTexto
            testid="ed-campo-etiqueta"
            rotulo="Etiqueta"
            valor={g.etiqueta ?? ""}
            maxLength={32}
            aoMudar={(v) => mudarGatilho(opcional(g, "etiqueta", v.trim()))}
            ajuda="Vazio: qualquer etiqueta."
          />
        </>
      )}
      {g.tipo === "zona" && (
        <>
          <CampoEscolha
            testid="ed-campo-quando"
            rotulo="O token"
            valor={g.quando}
            opcoes={[
              { valor: "entra", nome: "Entra" },
              { valor: "sai", nome: "Sai" },
            ]}
            aoMudar={(v) => mudarGatilho({ ...g, quando: v === "sai" ? "sai" : "entra" })}
          />
          <CampoEscolha
            testid="ed-campo-zona"
            rotulo="Da zona"
            valor={g.zona ?? ""}
            opcoes={[p.qualquer("De qualquer zona"), ...p.zonas]}
            aoMudar={(v) => mudarGatilho(opcional(g, "zona", v))}
          />
        </>
      )}
      {g.tipo === "cena" && (
        <CampoEscolha
          testid="ed-campo-cena-ativada"
          rotulo="Quando o grupo vai para"
          valor={g.cena ?? ""}
          opcoes={[p.qualquer("Qualquer cena"), ...p.cenas]}
          aoMudar={(v) => mudarGatilho(opcional(g, "cena", v))}
        />
      )}
      <fieldset className="ed-cenas">
        <legend>Cenas onde vale</legend>
        <p className="nota">Sem nenhuma marcada, vale em todas.</p>
        <div className="ed-escolha-de-cenas" data-testid="ed-campo-cenas-do-fluxo">
          {p.cenas.map((c) => {
            const lista = p.rascunho.cenas ?? [];
            return (
              <Caixa
                key={c.valor}
                testid={`ed-cena-${c.valor}`}
                rotulo={c.nome}
                marcado={lista.includes(c.valor)}
                aoMudar={(m) => {
                  const novas = m ? [...lista, c.valor] : lista.filter((x) => x !== c.valor);
                  p.aoMudarFluxo({ ...p.rascunho, cenas: novas.length === 0 ? null : novas });
                }}
              />
            );
          })}
        </div>
      </fieldset>
      {podeFixar && (
        <>
          <Caixa
            testid="ed-fixar"
            rotulo="Fixar na barra de cima"
            marcado={p.rascunho.fixado === true}
            aoMudar={(m) => p.aoMudarFluxo({ ...p.rascunho, fixado: m })}
          />
          <Caixa
            testid="ed-liberar"
            rotulo="Liberar aos jogadores"
            marcado={p.rascunho.liberadoParaJogadores === true}
            aoMudar={(m) => p.aoMudarFluxo({ ...p.rascunho, liberadoParaJogadores: m })}
          />
        </>
      )}
      {meus.map((e) => (
        <p key={e.texto} className="ed-erro" role="alert" data-testid="ed-painel-erro-gatilho">
          {e.texto}
        </p>
      ))}
    </div>
  );
}
