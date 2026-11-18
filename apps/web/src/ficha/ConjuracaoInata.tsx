import {
  ATRIBUTOS,
  type Atributo,
  ataqueDaInata,
  cdDaInata,
  formatarBonus,
  lerEntradaArrastada,
  type Magia,
  ROTULO_DO_ATRIBUTO,
  recarregarInata,
  rotuloDaFrequenciaInata,
  TIPO_DO_ARRASTO_DO_COMPENDIO,
} from "@tabletop/shared";
import { Plus, RotateCcw, Settings, Sparkles } from "lucide-react";
import { type DragEvent, type ReactNode, useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { CamposDaMagia, linhaDeNivelEEscola, MarcasDaMagia, TextoDaMagia } from "../CartaoDaMagia";
import { FORA_DA_CONJURACAO, type PropsDaAba, um } from "./AbaPrincipal";
import { CampoDeNovo, CampoNumero } from "./campos";
import { conjurarInata, magiaDoCompendio } from "./conjurar";
import { EditorDeAtaque } from "./EditorDeAtaque";
import { Bolinha, TituloDoBloco as Titulo } from "./livro";
import { BotaoPingarMagia } from "./menuDeEspaco";
import { secao } from "./secoes";
import { soltarNaFicha } from "./soltar";

// ---------------------------------------------------------------------------------------------
// N2: a "Conjuração inata" do bloco de monstro (e da página Magias): atributo e CD próprios e as magias por
// frequência: "À vontade", "N/dia cada" (bolinhas em cada magia) e "N/dia" (um contador para o grupo). As magias
// moram em `ficha.magias`, com o campo `inata`; não gastam espaço nem aparecem nos círculos.
// ---------------------------------------------------------------------------------------------

type Frequencia = "vontade" | "cada" | "grupo";
type Item = { m: Magia; i: number };

/** Bolinhas de uso: cheia = disponível. Clicar gasta ou devolve até ali. */
function Usos({
  prefixo,
  max,
  gastos,
  editar,
  rotulo,
  aoMudar,
}: {
  prefixo: string;
  max: number;
  gastos: number;
  editar: boolean;
  rotulo: string;
  aoMudar: (gastos: number) => void;
}) {
  const livres = max - gastos;
  return (
    <span className="fl-bolinhas">
      {Array.from({ length: max }, (_, k) => k + 1).map((k) => (
        <Bolinha
          key={k}
          testid={`${prefixo}-${k}`}
          rotulo={`Uso de ${rotulo} ${k}${k <= livres ? ", disponível. Gastar" : ", gasto. Devolver"}`}
          marcada={k <= livres}
          desabilitado={!editar}
          aoMudar={() => aoMudar(max - (k <= livres ? k - 1 : k))}
        />
      ))}
    </span>
  );
}

/** A magia inata aberta: o cartão ou a descrição, o Conjurar, o chat, a frequência e a engrenagem. */
function CorpoDaInata({
  m,
  i,
  props,
  editorEmLinha,
}: {
  m: Magia;
  i: number;
  props: PropsDaAba;
  editorEmLinha: boolean;
}) {
  const { ficha, alterar, editar, compendio, rolador, abrirEditor, fecharEditor, editorAberto } =
    props;
  const doCompendio = magiaDoCompendio(compendio, m.nome);
  const editando = editorAberto?.tipo === "magia" && editorAberto.i === i;
  const inata = m.inata;
  if (!inata) return null;
  const mudarFrequencia = (nova: Frequencia | "") => {
    if (nova === "") {
      alterar(um(`magias.${i}.inata`, null));
      return;
    }
    const ops: { caminho: string; valor: unknown }[] = [
      {
        caminho: `magias.${i}.inata`,
        valor: { frequencia: nova, ...(nova === "vontade" ? {} : { max: inata.max ?? 1 }) },
      },
    ];
    if (nova === "grupo" && !ficha.inata?.grupo) {
      ops.push({ caminho: "inata", valor: { ...ficha.inata, grupo: { max: 1, gastos: 0 } } });
    }
    alterar(ops);
  };
  return (
    <div className="npc-acao-texto npc-conj-corpo" data-sem data-testid={`npc-inata-corpo-${i}`}>
      {doCompendio ? (
        <div className="fl-cartao-da-magia" data-testid={`npc-inata-cartao-${i}`}>
          <p className="fl-sub">
            {linhaDeNivelEEscola(doCompendio)} <MarcasDaMagia magia={doCompendio} />
          </p>
          <CamposDaMagia magia={doCompendio} />
          <TextoDaMagia magia={doCompendio} />
        </div>
      ) : (
        <>
          {m.escola && <p className="fl-sub">{m.escola}</p>}
          <p data-testid={`npc-inata-texto-${i}`}>
            {m.descricao.trim() === "" ? "Sem descrição." : m.descricao}
          </p>
        </>
      )}
      {editar && (
        <div className="npc-inata-freq" data-testid={`npc-inata-freq-bloco-${i}`}>
          <label className="npc-conj-attr">
            <span className="npc-rot">Frequência</span>
            <select
              className="npc-sel"
              data-testid={`npc-inata-freq-${i}`}
              aria-label={`Frequência de ${m.nome}`}
              value={inata.frequencia}
              onChange={(e) => mudarFrequencia(e.target.value as Frequencia | "")}
            >
              <option value="vontade">À vontade</option>
              <option value="cada">N/dia cada</option>
              <option value="grupo">N/dia (grupo)</option>
              <option value="">Com espaço (tirar da inata)</option>
            </select>
          </label>
          {inata.frequencia === "cada" && (
            <span className="npc-conj-attr">
              <span className="npc-rot">Usos por dia</span>
              <CampoNumero
                testid={`npc-inata-max-${i}`}
                rotulo={`Usos por dia de ${m.nome}`}
                valor={inata.max ?? 1}
                min={1}
                max={20}
                className="fl-in fl-fn npc-conj-total-campo"
                aoMudar={(v) =>
                  v !== null &&
                  alterar(
                    um(`magias.${i}.inata`, {
                      ...inata,
                      max: v,
                      gastos: Math.min(inata.gastos ?? 0, v),
                    }),
                  )
                }
              />
            </span>
          )}
        </div>
      )}
      <div className="npc-conj-acoes">
        <button
          type="button"
          className="npc-mandar"
          data-testid={`npc-inata-conjurar-${i}`}
          disabled={!rolador.podeRolar}
          aria-label={`${m.nivel === 0 ? "Lançar" : "Conjurar"} ${m.nome} (inata, sem gastar espaço)`}
          onClick={() => conjurarInata(props, m, i)}
        >
          <Sparkles size={16} aria-hidden /> {m.nivel === 0 ? "Lançar" : "Conjurar"}
        </button>
        <BotaoPingarMagia props={props} m={m} testid={`npc-inata-pingar-${i}`} />
        <BotaoComDica
          className="fl-ib npc-engrenagem"
          testid={`npc-inata-editar-${i}`}
          nome={`Configurar ${m.nome}`}
          aria-label={`Configurar ${m.nome}`}
          aria-expanded={editando}
          motivo={editar ? null : "Só quem edita a ficha configura"}
          onClick={() => (editando ? fecharEditor() : abrirEditor({ tipo: "magia", i }))}
        >
          <Settings size={17} aria-hidden />
        </BotaoComDica>
      </div>
      {editando && editorEmLinha && (
        <div className="npc-editor" data-sem>
          <EditorDeAtaque
            alvo={{ tipo: "magia", i }}
            origem="magias"
            props={props}
            aoVoltar={fecharEditor}
          />
        </div>
      )}
    </div>
  );
}

/** A CD e o ataque da Conjuração inata, com o atributo escolhido à parte (vazio = o da classe ou da seção). */
function CabecalhoDaInata({ props }: { props: PropsDaAba }) {
  const { ficha, alterar, editar, rolador } = props;
  const cd = cdDaInata(ficha);
  const ataque = ataqueDaInata(ficha);
  const gravar = (campos: Partial<NonNullable<typeof ficha.inata>>) => {
    const novo = { ...ficha.inata, ...campos };
    const limpo = Object.fromEntries(Object.entries(novo).filter(([, v]) => v !== undefined));
    alterar(um("inata", Object.keys(limpo).length === 0 ? null : limpo));
  };
  return (
    <div className="npc-conj-cab" data-testid="npc-inata-cab">
      <label className="npc-conj-attr">
        <span className="npc-rot">Atributo</span>
        <select
          className="npc-sel"
          data-testid="npc-inata-habilidade"
          aria-label="Atributo da conjuração inata"
          value={ficha.inata?.habilidade ?? ""}
          disabled={!editar}
          onChange={(e) =>
            gravar({ habilidade: e.target.value === "" ? undefined : (e.target.value as Atributo) })
          }
        >
          <option value="">Igual ao da conjuração</option>
          {ATRIBUTOS.map((a) => (
            <option key={a} value={a}>
              {ROTULO_DO_ATRIBUTO[a]}
            </option>
          ))}
        </select>
      </label>
      <span className="npc-conj-num">
        <span className="npc-rot">CD</span>
        {editar ? (
          <CampoNumero
            testid="npc-inata-cd-campo"
            rotulo="CD da conjuração inata (vazio = calculada)"
            valor={cd ?? 0}
            max={40}
            className="fl-in fl-fn npc-conj-total-campo"
            aoMudar={(v) => gravar({ cd: v ?? undefined })}
            aoApagar={() => gravar({ cd: undefined })}
          />
        ) : (
          <strong className="fl-fa" data-testid="npc-inata-cd">
            {cd ?? "—"}
          </strong>
        )}
      </span>
      <span className="npc-conj-num">
        <span className="npc-rot">Ataque de magia</span>
        {ataque === undefined ? (
          <strong className="fl-fa">—</strong>
        ) : (
          <button
            type="button"
            className="npc-acerto npc-conj-ataque"
            data-testid="npc-inata-ataque"
            disabled={!rolador.podeRolar}
            aria-label={`Rolar o ataque de magia inata, ${formatarBonus(ataque)}`}
            onClick={() => rolador.teste("Ataque de magia (inata)", ataque)}
          >
            {formatarBonus(ataque)}
          </button>
        )}
      </span>
    </div>
  );
}

/** Uma linha de frequência: o rótulo, o contador (grupo) e as magias como chips, cada uma com as bolinhas de uso. */
function LinhaDaInata({
  rotulo,
  testid,
  itens,
  props,
  aberta,
  aoAbrir,
  contador,
  editorEmLinha,
}: {
  rotulo: string;
  testid: string;
  itens: Item[];
  props: PropsDaAba;
  aberta: string | null;
  aoAbrir: (nome: string) => void;
  contador?: ReactNode;
  editorEmLinha: boolean;
}) {
  const { alterar, editar } = props;
  const aberto = itens.find((x) => x.m.nome === aberta);
  return (
    <div className="npc-conj-nivel" data-testid={testid}>
      <div className="npc-conj-linha">
        <span className="npc-rot npc-conj-nome">{rotulo}:</span>
        {contador}
        <span className="npc-conj-chips">
          {itens.map(({ m, i }) => (
            <span
              key={`m-${i}-${m.nome}`}
              className="npc-conj-item"
              data-testid={`npc-inata-item-${i}`}
            >
              <button
                type="button"
                className="npc-conj-chip"
                data-testid={`npc-inata-magia-${i}`}
                aria-expanded={aberta === m.nome}
                aria-label={`${m.nome}: ${aberta === m.nome ? "recolher" : "expandir"} a descrição.`}
                onClick={() => aoAbrir(m.nome)}
              >
                {m.nome}
              </button>
              {m.inata?.frequencia === "cada" && (
                <Usos
                  prefixo={`npc-inata-uso-${i}`}
                  max={m.inata.max ?? 1}
                  gastos={Math.min(m.inata.gastos ?? 0, m.inata.max ?? 1)}
                  editar={editar}
                  rotulo={m.nome}
                  aoMudar={(g) => {
                    const { gastos: _antigo, ...resto } = m.inata ?? {
                      frequencia: "cada" as const,
                    };
                    alterar(um(`magias.${i}.inata`, g === 0 ? resto : { ...resto, gastos: g }));
                  }}
                />
              )}
            </span>
          ))}
        </span>
      </div>
      {aberto && (
        <CorpoDaInata m={aberto.m} i={aberto.i} props={props} editorEmLinha={editorEmLinha} />
      )}
    </div>
  );
}

/**
 * A parte "Conjuração inata", logo depois dos círculos. Quem edita vê um "+ Conjuração inata" discreto enquanto não
 * existe; recebe a magia arrastada do compêndio (entra como "1/dia cada", e a frequência se troca na magia).
 */
function ParteInataBruta({
  props,
  editorEmLinha = true,
}: {
  props: PropsDaAba;
  /** `false` na página Magias do personagem: lá a engrenagem abre o editor na coluna ao lado. */
  editorEmLinha?: boolean;
}) {
  const { ficha, alterar, editar, avisar, fichaAtual } = props;
  const [aberta, setAberta] = useState<string | null>(null);
  const [forcada, setForcada] = useState(false);
  const magias = ficha.magias ?? [];
  const inatas: Item[] = magias.map((m, i) => ({ m, i })).filter((x) => x.m.inata);
  const existe = inatas.length > 0 || ficha.inata !== undefined || forcada;
  if (!existe) {
    if (!editar) return null;
    return (
      <div className="npc-novas" data-testid="npc-nova-inata-bloco">
        <button
          type="button"
          className="npc-novo"
          data-testid="npc-nova-inata"
          onClick={() => setForcada(true)}
        >
          <Plus size={13} aria-hidden /> Conjuração inata
        </button>
      </div>
    );
  }
  const abrir = (nome: string) => setAberta(aberta === nome ? null : nome);
  const daFrequencia = (f: Frequencia) => inatas.filter((x) => x.m.inata?.frequencia === f);
  const maximos = [...new Set(daFrequencia("cada").map((x) => x.m.inata?.max ?? 1))].sort(
    (a, b) => a - b,
  );
  const grupo = ficha.inata?.grupo;
  const gastouAlgum = inatas.some((x) => (x.m.inata?.gastos ?? 0) > 0) || (grupo?.gastos ?? 0) > 0;
  const criar = (nome: string, inata: NonNullable<Magia["inata"]>) => {
    const ops: { caminho: string; valor: unknown }[] = [
      {
        caminho: "magias",
        valor: [
          ...(fichaAtual().magias ?? []),
          { nome, nivel: 1, preparada: true, descricao: "", inata },
        ],
      },
    ];
    if (inata.frequencia === "grupo" && !grupo) {
      ops.push({ caminho: "inata", valor: { ...ficha.inata, grupo: { max: 1, gastos: 0 } } });
    }
    alterar(ops);
  };
  const soltarMagia = (e: DragEvent<HTMLElement>) => {
    if (!editar || !e.dataTransfer.types.includes(TIPO_DO_ARRASTO_DO_COMPENDIO)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragover") {
      e.dataTransfer.dropEffect = "copy";
      return;
    }
    const entrada = lerEntradaArrastada(e.dataTransfer.getData(TIPO_DO_ARRASTO_DO_COMPENDIO));
    if (entrada?.tipo !== "magia") return;
    soltarNaFicha(
      { ficha: fichaAtual(), alterar, avisar },
      ficha.npc ? "npc" : "personagem",
      entrada,
      {
        posicao: null,
        inata: { frequencia: "cada", max: 1 },
      },
    );
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: só recebe o arrasto do compêndio; o teclado usa os campos
    <div
      className="npc-inata"
      data-testid="npc-inata"
      onDragOver={soltarMagia}
      onDrop={soltarMagia}
    >
      <Titulo testid="npc-titulo-inata">Conjuração inata</Titulo>
      <CabecalhoDaInata props={props} />
      <div className="npc-conj-circulos">
        {daFrequencia("vontade").length > 0 && (
          <LinhaDaInata
            rotulo={rotuloDaFrequenciaInata("vontade", undefined)}
            testid="npc-inata-linha-vontade"
            itens={daFrequencia("vontade")}
            props={props}
            aberta={aberta}
            aoAbrir={abrir}
            editorEmLinha={editorEmLinha}
          />
        )}
        {maximos.map((max) => (
          <LinhaDaInata
            key={max}
            rotulo={rotuloDaFrequenciaInata("cada", max)}
            testid={`npc-inata-linha-cada-${max}`}
            itens={daFrequencia("cada").filter((x) => (x.m.inata?.max ?? 1) === max)}
            props={props}
            aberta={aberta}
            aoAbrir={abrir}
            editorEmLinha={editorEmLinha}
          />
        ))}
        {(daFrequencia("grupo").length > 0 || grupo) && (
          <LinhaDaInata
            rotulo={rotuloDaFrequenciaInata("grupo", grupo?.max)}
            testid="npc-inata-linha-grupo"
            itens={daFrequencia("grupo")}
            props={props}
            aberta={aberta}
            aoAbrir={abrir}
            editorEmLinha={editorEmLinha}
            contador={
              grupo && (
                <>
                  <Usos
                    prefixo="npc-inata-grupo"
                    max={grupo.max}
                    gastos={Math.min(grupo.gastos, grupo.max)}
                    editar={editar}
                    rotulo="do grupo"
                    aoMudar={(g) =>
                      alterar(um("inata", { ...ficha.inata, grupo: { max: grupo.max, gastos: g } }))
                    }
                  />
                  {editar && (
                    <span className="npc-conj-total">
                      <span className="npc-rot" aria-hidden>
                        por dia
                      </span>
                      <CampoNumero
                        testid="npc-inata-grupo-max"
                        rotulo="Usos por dia do grupo"
                        valor={grupo.max}
                        min={1}
                        max={20}
                        className="fl-in fl-fn npc-conj-total-campo"
                        aoMudar={(v) =>
                          v !== null &&
                          alterar(
                            um("inata", {
                              ...ficha.inata,
                              grupo: { max: v, gastos: Math.min(grupo.gastos, v) },
                            }),
                          )
                        }
                      />
                    </span>
                  )}
                </>
              )
            }
          />
        )}
      </div>
      {editar && gastouAlgum && (
        <button
          type="button"
          className="npc-novo"
          data-testid="npc-inata-recuperar"
          onClick={() => {
            // O mesmo que o descanso longo faz com a inata (o NPC não tem botão de descanso na janela).
            const { magias: novas, inata } = recarregarInata(fichaAtual());
            const ops = [
              ...(novas ? [{ caminho: "magias", valor: novas }] : []),
              ...(inata ? [{ caminho: "inata", valor: inata }] : []),
            ];
            if (alterar(ops)) avisar("Usos da conjuração inata recuperados.");
          }}
        >
          <RotateCcw size={13} aria-hidden /> Recuperar usos
        </button>
      )}
      {editar && (
        <div className="npc-inata-novas" data-testid="npc-inata-novas">
          <CampoDeNovo
            testid="npc-inata-nova-vontade"
            rotulo="Nome da nova magia à vontade"
            placeholder="+ À vontade"
            className="fl-in npc-conj-nova"
            aoCriar={(t) => criar(t, { frequencia: "vontade" })}
          />
          <CampoDeNovo
            testid="npc-inata-nova-cada"
            rotulo="Nome da nova magia de 1 uso por dia cada"
            placeholder="+ 1/dia cada"
            className="fl-in npc-conj-nova"
            aoCriar={(t) => criar(t, { frequencia: "cada", max: 1 })}
          />
          <CampoDeNovo
            testid="npc-inata-nova-grupo"
            rotulo="Nome da nova magia do contador N por dia do grupo"
            placeholder="+ N/dia (grupo)"
            className="fl-in npc-conj-nova"
            aoCriar={(t) => criar(t, { frequencia: "grupo", max: grupo?.max ?? 1 })}
          />
        </div>
      )}
    </div>
  );
}

/** As magias inatas (com a posição) como uma chave comparável; a lista guarda o resultado por referência. */
const CHAVE_DAS_INATAS = new WeakMap<object, string>();
function magiasInatas(ficha: PropsDaAba["ficha"]): string {
  const lista = ficha.magias ?? [];
  const guardado = CHAVE_DAS_INATAS.get(lista);
  if (guardado !== undefined) return guardado;
  const chave = JSON.stringify(lista.map((m, i) => (m.inata ? [i, m] : null)).filter(Boolean));
  CHAVE_DAS_INATAS.set(lista, chave);
  return chave;
}

/**
 * A Conjuração inata em `memo` (Q15): escrever na descrição de uma magia comum não a redesenha; só mudam as magias
 * inatas, o atributo/CD (a ficha menos o que não conta) ou os cálculos.
 */
export const ParteInata = secao("ParteInata", ParteInataBruta, {
  fichaExceto: [...FORA_DA_CONJURACAO, "magias", "espacosGastos", "espacosTotal"],
  mudou: (a, b) => magiasInatas(a.props.ficha) !== magiasInatas(b.props.ficha),
});
