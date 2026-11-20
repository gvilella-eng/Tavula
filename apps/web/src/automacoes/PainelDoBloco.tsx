import {
  type AcaoDeFluxo,
  type AlvoDoParaCada,
  CORES_DO_SOM,
  type CondicaoDoSe,
  type CorDoSom,
  type Estado,
  type Fluxo,
  type Gatilho,
  ICONES_DO_SOM,
  type IconeDoSom,
  type No,
  type NomesParaAFrase,
} from "@tabletop/shared";
import { Copy, Trash2 } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useId, useState } from "react";
import type { Fontes } from "../assets/fontes";
import { EscolherSom, type SomEscolhido } from "../som/EscolherSom";
import { CORES, ICONES, IconeDoLugar } from "../som/iconesDoSom";
import { COR_DO_GRUPO, type ErroDoEditor, grupoDoNo, PECAS, rotuloDoNo } from "./blocos";

// O painel da direita do editor (AU1/AU2): os campos do nó escolhido, ou os da automação quando não há nó escolhido. Cada
// grupo de campos lado a lado usa `.linha-par`, a grade de 3 trilhas (rótulo, caixa, ajuda) do A1: o rótulo mais alto
// define a linha e as caixas ficam alinhadas.

type Props = {
  estado: Estado;
  rascunho: Fluxo;
  no: No;
  nomes: NomesParaAFrase;
  sinais: readonly string[];
  erros: readonly ErroDoEditor[];
  fontes: Fontes | null;
  registrarSom: ((arquivo: File) => Promise<SomEscolhido>) | null;
  aoMudarNo: (n: No) => void;
  aoDuplicar: () => void;
  aoApagar: () => void;
};

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
  const { estado, no } = p;
  const cenas = estado.cenas.map((c) => ({ valor: c.id, nome: c.nome }));
  const modelos = estado.modelos.map((m) => ({ valor: m.id, nome: m.nome }));
  const zonas = (estado.zonas ?? []).map((z) => ({ valor: z.id, nome: z.nome }));
  const sons = (estado.assets ?? [])
    .filter((a) => a.tipo === "som")
    .map((a) => ({ hash: a.hash, nome: a.nomeOriginal.replace(/\.[^.]+$/, "") }));
  const qualquer = (rotulo: string) => ({ valor: "", nome: rotulo });
  const grupo = grupoDoNo(no);
  const rotulo = rotuloDoNo(no, p.nomes);
  const meus = p.erros.filter((e) => e.onde === no.id);

  const campos = (() => {
    switch (no.tipo) {
      case "gatilho":
        return (
          <CamposDoGatilho
            g={no.config}
            aoMudar={(g) => p.aoMudarNo({ ...no, config: g })}
            sinais={p.sinais}
            cenas={cenas}
            modelos={modelos}
            zonas={zonas}
            qualquer={qualquer}
          />
        );
      case "esperar":
        return (
          <CampoNumero
            testid="ed-campo-s"
            rotulo="Esperar (segundos)"
            valor={no.config.s}
            aoMudar={(v) => v !== undefined && p.aoMudarNo({ ...no, config: { s: v } })}
            ajuda="Conta no tempo da mesa: pausar a mesa pausa a espera."
          />
        );
      case "sortear":
        return (
          <CampoNumero
            testid="ed-campo-chance"
            rotulo="Chance de “sim” (%)"
            valor={no.config.chance}
            escala={100}
            aoMudar={(v) =>
              v !== undefined &&
              p.aoMudarNo({ ...no, config: { chance: Math.min(1, Math.max(0, v)) } })
            }
            ajuda="Cada vez tira a sua sorte. O “não” é a saída de baixo."
          />
        );
      case "se":
        return (
          <p className="nota" data-testid="ed-se-nota">
            Ligue uma condição (ou uma porta E, OU, NÃO) à entrada de baixo do bloco. Se ela vale,
            segue pelo “sim”; senão, pelo “não”.
          </p>
        );
      case "condicao":
        return (
          <CamposDaCondicao
            c={no.config}
            aoMudar={(c) => p.aoMudarNo({ ...no, config: c })}
            cenas={cenas}
            zonas={zonas}
          />
        );
      case "porta":
        return (
          <CampoEscolha
            testid="ed-campo-porta"
            rotulo="Porta lógica"
            valor={no.config.porta}
            opcoes={[
              { valor: "e", nome: "E: vale se todas as entradas valem" },
              { valor: "ou", nome: "OU: vale se alguma entrada vale" },
              { valor: "nao", nome: "NÃO: inverte a única entrada" },
            ]}
            aoMudar={(v) =>
              p.aoMudarNo({
                ...no,
                config: { porta: v === "ou" ? "ou" : v === "nao" ? "nao" : "e" },
              })
            }
          />
        );
      case "paraCada":
        return (
          <CamposDoAlvo
            a={no.config.alvo}
            aoMudar={(alvo) => p.aoMudarNo({ ...no, config: { alvo } })}
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
              valor={no.config.nome}
              maxLength={48}
              sugestoes={p.sinais}
              aoMudar={(v) => p.aoMudarNo({ ...no, config: { ...no.config, nome: v } })}
              ajuda="Roda as automações que esperam este sinal."
            />
            <CampoNumero
              testid="ed-campo-atraso"
              rotulo="Daqui a (segundos)"
              valor={no.config.atrasoS}
              opcional
              aoMudar={(v) =>
                p.aoMudarNo({
                  ...no,
                  config: v === undefined ? { nome: no.config.nome } : { ...no.config, atrasoS: v },
                })
              }
              ajuda="Vazio: manda agora."
            />
          </>
        );
      case "acao":
        return (
          <CamposDaAcao
            a={no.config.acao}
            aoMudar={(a) => p.aoMudarNo({ ...no, config: { acao: a } })}
            zonas={zonas}
            sons={sons}
            fontes={p.fontes}
            registrarSom={p.registrarSom}
          />
        );
    }
  })();

  return (
    <div className="ed-painel-conteudo" data-testid={`ed-painel-${no.id}`}>
      <div className="ed-painel-titulo">
        <span className="ed-ponto" style={{ background: COR_DO_GRUPO[grupo] }} aria-hidden />
        <h2>{rotulo.titulo}</h2>
      </div>
      <p className="nota">{descricaoDoNo(no)}</p>
      <CampoTexto
        testid="ed-campo-nome-do-no"
        rotulo="Nome do bloco (opcional)"
        valor={no.nome ?? ""}
        maxLength={40}
        aoMudar={(v) => {
          const { nome: _n, ...resto } = no;
          p.aoMudarNo((v.trim() === "" ? resto : { ...resto, nome: v }) as No);
        }}
        ajuda="Aparece no lugar do título, e é como o Claude chama este bloco."
      />
      {campos}
      {meus.map((e) => (
        <p key={e.texto} className="ed-erro" role="alert" data-testid={`ed-painel-erro-${no.id}`}>
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

function descricaoDoNo(no: No): string {
  switch (no.tipo) {
    case "gatilho":
      return "O que faz a automação começar. Vários gatilhos ligados ao mesmo bloco formam um OU: qualquer um dispara.";
    case "esperar":
      return "Segura o caminho por um tempo e só depois segue pelo fio de saída.";
    case "se":
      return "Segue pelo “sim” se a condição ligada vale; senão, pelo “não”.";
    case "sortear":
      return "Sorteia a cada vez: segue pelo “sim” com a chance escolhida, senão pelo “não”.";
    case "condicao":
      return "Dá verdadeiro ou falso. Ligue a saída a um “se” ou a uma porta E, OU, NÃO.";
    case "porta":
      return "Combina condições: ligue as condições na entrada e a saída no “se” (ou em outra porta).";
    case "paraCada":
      return "Repete o caminho “para cada” para cada objeto ou token do alvo; “depois” roda uma vez no fim.";
    case "sinal":
      return "Avisa as outras automações. As que esperam este sinal rodam (já, ou depois de um tempo).";
    case "acao":
      return no.config.acao.acao.startsWith("objeto") || no.config.acao.acao === "luz.modificar"
        ? "Mexe na luz da vez: o objeto do gatilho ou o do “para cada” em volta."
        : no.config.acao.acao.startsWith("visao") || no.config.acao.acao.startsWith("token")
          ? "Mexe no token da vez: o do gatilho ou o do “para cada” em volta."
          : "Uma ação da mesa.";
  }
}

function CamposDaCondicao(p: {
  c: CondicaoDoSe;
  aoMudar: (c: CondicaoDoSe) => void;
  cenas: { valor: string; nome: string }[];
  zonas: { valor: string; nome: string }[];
}) {
  const c = p.c;
  const trocar = p.aoMudar;
  return (
    <>
      <CampoEscolha
        testid="ed-campo-condicao"
        rotulo="Condição"
        valor={c.condicao}
        opcoes={[
          { valor: "chance", nome: "Acontece com uma chance" },
          { valor: "etiqueta", nome: "O objeto tem a etiqueta" },
          { valor: "dentroDaZona", nome: "Está dentro da zona" },
          { valor: "cena", nome: "Está numa destas cenas" },
          { valor: "zonaLigada", nome: "A zona está ligada" },
          { valor: "tokenDeJogador", nome: "O token é de um jogador" },
        ]}
        aoMudar={(v) => {
          if (v === "chance") trocar({ condicao: "chance", chance: 0.5 });
          else if (v === "etiqueta") trocar({ condicao: "etiqueta", etiqueta: "chama" });
          else if (v === "cena")
            trocar({
              condicao: "cena",
              cenas: p.cenas[0] ? [p.cenas[0].valor] : [],
            } as CondicaoDoSe);
          else if (v === "dentroDaZona")
            trocar({ condicao: "dentroDaZona", zona: p.zonas[0]?.valor ?? "" });
          else if (v === "tokenDeJogador") trocar({ condicao: "tokenDeJogador" });
          else trocar({ condicao: "zonaLigada", zona: p.zonas[0]?.valor ?? "" });
        }}
      />
      {c.condicao === "chance" && (
        <CampoNumero
          testid="ed-campo-chance"
          rotulo="Chance (%)"
          valor={c.chance}
          escala={100}
          aoMudar={(v) =>
            v !== undefined && trocar({ condicao: "chance", chance: Math.min(1, Math.max(0, v)) })
          }
          ajuda="Sorteia a cada vez que o “se” confere."
        />
      )}
      {c.condicao === "tokenDeJogador" && (
        <p className="nota">
          Vale quando o token da vez tem um jogador controlando; senão é do mestre.
        </p>
      )}
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
  a: AlvoDoParaCada;
  aoMudar: (a: AlvoDoParaCada) => void;
  cenas: { valor: string; nome: string }[];
  zonas: { valor: string; nome: string }[];
  modelos: { valor: string; nome: string }[];
  qualquer: (r: string) => { valor: string; nome: string };
}) {
  const a = p.a;
  const mudar = p.aoMudar;
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

const corDoSom = (c: CorDoSom) => ({ "--cor-do-som": CORES[c].variavel }) as CSSProperties;

function CamposDoGatilho(p: {
  g: Gatilho;
  aoMudar: (g: Gatilho) => void;
  sinais: readonly string[];
  cenas: { valor: string; nome: string }[];
  modelos: { valor: string; nome: string }[];
  zonas: { valor: string; nome: string }[];
  qualquer: (r: string) => { valor: string; nome: string };
}) {
  const g = p.g;
  const mudarGatilho = p.aoMudar;
  const opcional = <T extends object>(o: T, k: string, v: string): T => {
    const { [k as keyof T]: _fora, ...resto } = o;
    return (v === "" ? resto : { ...resto, [k]: v }) as T;
  };
  return (
    <>
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
          if (feito && feito.tipo === "gatilho") mudarGatilho(feito.config);
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
          <div className="som-secao-nome">Ícone na mesa de eventos</div>
          <fieldset className="som-config-icones" aria-label="Ícone do botão">
            {ICONES_DO_SOM.map((id: IconeDoSom) => (
              <button
                key={id}
                type="button"
                className="som-config-icone"
                style={corDoSom(g.cor ?? "ambar")}
                data-testid={`ed-botao-icone-${id}`}
                aria-pressed={(g.icone ?? "chama") === id}
                aria-label={ICONES[id].nome}
                title={ICONES[id].nome}
                onClick={() => mudarGatilho({ ...g, icone: id })}
              >
                <IconeDoLugar icone={id} tamanho={18} />
              </button>
            ))}
          </fieldset>
          <div className="som-secao-nome">Cor do botão</div>
          <fieldset className="som-config-cores" aria-label="Cor do botão">
            {CORES_DO_SOM.map((id: CorDoSom) => (
              <button
                key={id}
                type="button"
                className="som-config-cor"
                style={corDoSom(id)}
                data-testid={`ed-botao-cor-${id}`}
                aria-pressed={(g.cor ?? "ambar") === id}
                aria-label={CORES[id].nome}
                title={CORES[id].nome}
                onClick={() => mudarGatilho({ ...g, cor: id })}
              />
            ))}
          </fieldset>
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
    </>
  );
}

/** O painel quando nenhum nó está escolhido: o que vale para a automação toda (cenas, fixar na barra, liberar aos jogadores). */
export function PainelDaAutomacao(p: {
  estado: Estado;
  rascunho: Fluxo;
  erros: readonly ErroDoEditor[];
  aoMudarFluxo: (f: Fluxo) => void;
}) {
  const cenas = p.estado.cenas.map((c) => ({ valor: c.id, nome: c.nome }));
  const podeFixar = p.rascunho.nos.some(
    (n) => n.tipo === "gatilho" && (n.config.tipo === "relogio" || n.config.tipo === "botao"),
  );
  const meus = p.erros.filter((e) => e.onde === "cenas" || e.onde === "geral");
  return (
    <div className="ed-painel-conteudo" data-testid="ed-painel-automacao">
      <div className="ed-painel-titulo">
        <h2>Esta automação</h2>
      </div>
      <p className="nota">
        Arraste peças da esquerda para a grade e ligue as bolinhas com fios: da saída de um bloco
        até a entrada do outro. Escolha um bloco para mudar os campos dele.
      </p>
      <fieldset className="ed-cenas">
        <legend>Cenas onde vale</legend>
        <p className="nota">Sem nenhuma marcada, vale em todas.</p>
        <div className="ed-escolha-de-cenas" data-testid="ed-campo-cenas-do-fluxo">
          {cenas.map((c) => {
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
        <p key={e.texto} className="ed-erro" role="alert" data-testid="ed-painel-erro-geral">
          {e.texto}
        </p>
      ))}
    </div>
  );
}
