import {
  ATRIBUTOS,
  type Atributo,
  formatarBonus,
  type Magia,
  moverNoGrupo,
  posicoesDoGrupo,
  ROTULO_DO_ATRIBUTO,
} from "@tabletop/shared";
import { Plus, Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { CamposDaMagia, linhaDeNivelEEscola, MarcasDaMagia, TextoDaMagia } from "../CartaoDaMagia";
import { Espacos, subDaMagia } from "./AbaMagias";
import { type PropsDaAba, um } from "./AbaPrincipal";
import { CampoDeNovo, CampoNumero } from "./campos";
import { magiaDoCompendio } from "./conjurar";
import { EditorDeAtaque } from "./EditorDeAtaque";
import { BotaoMandarAoChat } from "./ListaDeTitulos";
import { TituloDoBloco as Titulo } from "./livro";
import { BotaoPingarMagia, useConjurar } from "./menuDeEspaco";
import {
  indicadorDoVao,
  useEntradaEmArrasto,
  useOrdemDaLista,
  useSoltarDoCompendio,
} from "./ordem";
import { soltarNaFicha } from "./soltar";

// ---------------------------------------------------------------------------------------------
// A seção Conjuração do bloco de monstro (V4b2). Os dados são os da ficha de personagem (`magias`, os espaços por
// círculo e `habilidadeDeConjuracao`), então trocar a apresentação Personagem ↔ NPC mantém tudo. O que muda é o jeito
// de mostrar: uma linha por círculo ("1º nível: ●●● Dardo Mágico, Escudo"), no estilo do bloco de monstro.
// ---------------------------------------------------------------------------------------------

const NIVEIS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const nomeDoNivel = (n: number) => (n === 0 ? "Truques (à vontade)" : `${n}º nível`);

/** A magia aberta na seção: o cartão ou a descrição, com Conjurar, o chat e a engrenagem. */
function CorpoDaMagia({ m, i, props }: { m: Magia; i: number; props: PropsDaAba }) {
  const {
    editar,
    enviar,
    personagemId,
    compendio,
    rolador,
    abrirEditor,
    fecharEditor,
    editorAberto,
  } = props;
  const doCompendio = magiaDoCompendio(compendio, m.nome);
  const sub = subDaMagia(props, m);
  const editando = editorAberto?.tipo === "magia" && editorAberto.i === i;
  const acao = m.nivel === 0 ? "Lançar" : "Conjurar";
  const conj = useConjurar(props, m);
  return (
    <div className="npc-acao-texto npc-conj-corpo" data-sem data-testid={`npc-conj-corpo-${i}`}>
      {doCompendio ? (
        <div className="fl-cartao-da-magia" data-testid={`npc-conj-cartao-${i}`}>
          <p className="fl-sub">
            {linhaDeNivelEEscola(doCompendio)} <MarcasDaMagia magia={doCompendio} />
          </p>
          <CamposDaMagia magia={doCompendio} />
          <TextoDaMagia magia={doCompendio} />
        </div>
      ) : (
        <>
          {sub && <p className="fl-sub">{sub}</p>}
          <p data-testid={`npc-conj-texto-${i}`}>
            {m.descricao.trim() === "" ? "Sem descrição." : m.descricao}
          </p>
        </>
      )}
      <div className="npc-conj-acoes">
        <button
          type="button"
          className="npc-mandar"
          data-testid={`npc-conj-conjurar-${i}`}
          disabled={!rolador.podeRolar}
          aria-label={`${acao} ${m.nome}${m.nivel > 0 ? ", escolhendo o espaço de magia" : ""}`}
          aria-haspopup={m.nivel > 0 ? "menu" : undefined}
          onClick={(e) => conj.pedir(e.currentTarget)}
        >
          <Sparkles size={16} aria-hidden /> {acao}
        </button>
        {conj.menu}
        <BotaoPingarMagia props={props} m={m} testid={`npc-conj-pingar-${i}`} />
        <BotaoMandarAoChat
          testid={`npc-conj-chat-${i}`}
          nome={m.nome}
          podeMandar={editar}
          aoMandar={() =>
            doCompendio
              ? enviar("chat.magia", { magia: doCompendio, como: personagemId })
              : enviar("chat.caracteristica", {
                  caracteristica: {
                    nome: m.nome.trim().slice(0, 80),
                    descricao: m.descricao.slice(0, 12_000),
                  },
                  como: personagemId,
                })
          }
        />
        <BotaoComDica
          className="fl-ib npc-engrenagem"
          testid={`npc-conj-editar-${i}`}
          nome={`Configurar ${m.nome}`}
          aria-label={`Configurar ${m.nome}`}
          aria-expanded={editando}
          motivo={editar ? null : "Só quem edita a ficha configura"}
          onClick={() => (editando ? fecharEditor() : abrirEditor({ tipo: "magia", i }))}
        >
          <Settings size={17} aria-hidden />
        </BotaoComDica>
      </div>
      {editando && (
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

/** Uma linha de círculo: o nome do nível, as bolinhas de espaço, o total (quem edita) e as magias como chips. */
function NivelDoNpc({
  n,
  props,
  aberta,
  aoAbrir,
  previsao,
}: {
  n: number;
  props: PropsDaAba;
  aberta: string | null;
  aoAbrir: (nome: string) => void;
  previsao: { lista: string; vao: number } | null;
}) {
  const { ficha, d, alterar, editar, fecharEditor } = props;
  const magias = ficha.magias ?? [];
  const doNivel = magias.map((m, i) => ({ m, i })).filter((x) => x.m.nivel === n);
  const lista = `npc-circulo-${n}`;
  const ordem = useOrdemDaLista({
    lista,
    habilitado: editar,
    fluxo: true,
    aoMover: (de, para) => {
      fecharEditor();
      alterar(
        um(
          "magias",
          moverNoGrupo(
            magias,
            posicoesDoGrupo(magias, (x) => x.nivel === n),
            de,
            para,
          ),
        ),
      );
    },
  });
  const espaco = d.espacos.find((e) => e.nivel === n);
  const total = espaco?.total ?? 0;
  const chave = String(n) as "1";
  const definirTotal = (v: number | null) => {
    const { [chave]: _antigo, ...resto } = ficha.espacosTotal ?? {};
    const novo = v === null ? resto : { ...resto, [chave]: v };
    alterar(um("espacosTotal", Object.keys(novo).length === 0 ? null : novo));
  };
  const aberto = doNivel.find((x) => x.m.nome === aberta);
  return (
    <div className="npc-conj-nivel" data-testid={`npc-conj-nivel-${n}`}>
      <div className="npc-conj-linha">
        <span className="npc-rot npc-conj-nome">{nomeDoNivel(n)}:</span>
        {n > 0 && total > 0 && espaco && (
          <Espacos
            prefixo={`npc-espaco-${n}`}
            total={total}
            gastos={espaco.gastos}
            editar={editar}
            rotuloDoNivel={`${n}º nível`}
            aoMudar={(g) => {
              // O objeto inteiro (chave numérica não cria o caminho: "1" seria posição de lista).
              const { [chave]: _antigo, ...resto } = ficha.espacosGastos ?? {};
              alterar(um("espacosGastos", g === 0 ? resto : { ...resto, [chave]: g }));
            }}
          />
        )}
        {n > 0 && editar && (
          <span className="npc-conj-total">
            <span className="npc-rot" aria-hidden>
              espaços
            </span>
            <CampoNumero
              testid={`npc-espaco-total-${n}`}
              rotulo={`Espaços de ${n}º nível: total`}
              valor={total}
              max={30}
              className="fl-in fl-fn npc-conj-total-campo"
              aoMudar={definirTotal}
              aoApagar={() => definirTotal(null)}
            />
          </span>
        )}
        <span className="npc-conj-chips">
          {doNivel.map(({ m, i }, k) => (
            <span
              key={`m-${i}-${m.nome}`}
              className="npc-conj-item"
              data-testid={`npc-conj-item-${i}`}
              {...ordem.linha(k, doNivel.length)}
              {...(previsao?.lista === lista
                ? { "data-indicador": indicadorDoVao(previsao.vao, k, doNivel.length) }
                : {})}
            >
              <button
                type="button"
                className="npc-conj-chip"
                data-foco-ordem
                data-testid={`npc-conj-magia-${i}`}
                aria-expanded={aberta === m.nome}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                aria-label={`${m.nome}: ${aberta === m.nome ? "recolher" : "expandir"} a descrição. Alt mais seta para cima ou para baixo muda a posição.`}
                onClick={() => aoAbrir(m.nome)}
              >
                {m.nome}
              </button>
            </span>
          ))}
          {editar && (
            <CampoDeNovo
              testid={`npc-conj-nova-${n}`}
              rotulo={`Nome da nova magia de ${n === 0 ? "truque" : `${n}º nível`}`}
              placeholder={n === 0 ? "Novo truque" : "Nova magia"}
              className="fl-in npc-conj-nova"
              aoCriar={(t) =>
                alterar(
                  um("magias", [...magias, { nome: t, nivel: n, preparada: true, descricao: "" }]),
                )
              }
            />
          )}
        </span>
      </div>
      {aberto && <CorpoDaMagia m={aberto.m} i={aberto.i} props={props} />}
    </div>
  );
}

/** O cabeçalho da seção: o atributo de conjuração, a CD e o ataque de magia (com o bônus de proficiência do ND). */
function CabecalhoDaConjuracao({ props }: { props: PropsDaAba }) {
  const { ficha, d, alterar, editar, rolador } = props;
  const c = d.conjuradoras[0];
  const livre = d.conjuracaoSemClasse;
  const habilidade = c?.habilidade ?? ficha.habilidadeDeConjuracao ?? "";
  const cd = c?.cd ?? livre?.cd;
  const ataque = c?.ataque ?? livre?.ataque;
  return (
    <div className="npc-conj-cab" data-testid="npc-conj-cab">
      <label className="npc-conj-attr">
        <span className="npc-rot">Atributo</span>
        <select
          className="npc-sel"
          data-testid="npc-conj-habilidade"
          aria-label="Atributo de conjuração"
          value={habilidade}
          disabled={!editar}
          onChange={(e) => {
            if (c) {
              const outras = (ficha.conjuracao ?? []).filter((x) => x.classe !== c.classe);
              alterar(
                um("conjuracao", [...outras, { classe: c.classe, habilidade: e.target.value }]),
              );
            } else {
              alterar(
                um(
                  "habilidadeDeConjuracao",
                  e.target.value === "" ? null : (e.target.value as Atributo),
                ),
              );
            }
          }}
        >
          <option value="">—</option>
          {ATRIBUTOS.map((a) => (
            <option key={a} value={a}>
              {ROTULO_DO_ATRIBUTO[a]}
            </option>
          ))}
        </select>
      </label>
      <span className="npc-conj-num">
        <span className="npc-rot">CD</span>
        <strong className="fl-fa" data-testid="npc-conj-cd">
          {cd ?? "—"}
        </strong>
      </span>
      <span className="npc-conj-num">
        <span className="npc-rot">Ataque de magia</span>
        {ataque === undefined ? (
          <strong className="fl-fa">—</strong>
        ) : (
          <button
            type="button"
            className="npc-acerto npc-conj-ataque"
            data-testid="npc-conj-ataque"
            disabled={!rolador.podeRolar}
            aria-label={`Rolar o ataque de magia, ${formatarBonus(ataque)}`}
            onClick={() => rolador.teste("Ataque de magia", ataque)}
          >
            {formatarBonus(ataque)}
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * A seção Conjuração entre Traços e Ações. Existe enquanto a ficha tem magias (ou atributo ou espaços escolhidos);
 * quem edita vê um "+ Conjuração" discreto para criá-la. Recebe a magia arrastada do compêndio, no círculo dela.
 */
export function SecaoDeConjuracao({ props }: { props: PropsDaAba }) {
  const { ficha, d, alterar, editar, avisar } = props;
  const magias = ficha.magias ?? [];
  const [extras, setExtras] = useState<number[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const emArrasto = useEntradaEmArrasto();
  const circuloEmArrasto = editar && emArrasto?.tipo === "magia" ? emArrasto.magia.nivel : null;
  const soltar = useSoltarDoCompendio({
    aceita: ["magia"],
    habilitado: editar,
    fluxo: true,
    listaDoTipo: { magia: (e) => (e.tipo === "magia" ? `npc-circulo-${e.magia.nivel}` : "") },
    aoSoltar: (entrada, posicao) =>
      soltarNaFicha({ ficha, alterar, avisar }, "npc", entrada, { posicao }),
  });
  const existe =
    magias.length > 0 ||
    ficha.habilidadeDeConjuracao !== undefined ||
    ficha.espacosTotal !== undefined ||
    d.conjuradoras.length > 0;
  if (!existe && circuloEmArrasto === null) {
    if (!editar) return null;
    return (
      <div className="npc-novas" data-testid="npc-nova-conjuracao-bloco">
        <button
          type="button"
          className="npc-novo"
          data-testid="npc-nova-conjuracao"
          onClick={() => {
            // O atributo mental mais alto: a seção passa a existir e a CD sai dele.
            const mod = (a: Atributo) => ficha.atributos?.[a] ?? 10;
            const melhor = (["int", "sab", "car"] as const).reduce((m, a) =>
              mod(a) > mod(m) ? a : m,
            );
            alterar(um("habilidadeDeConjuracao", melhor));
          }}
        >
          <Plus size={13} aria-hidden /> Conjuração
        </button>
      </div>
    );
  }
  const visivel = (n: number) =>
    (n === 0 && editar) ||
    magias.some((m) => m.nivel === n) ||
    (d.espacos.find((e) => e.nivel === n)?.total ?? 0) > 0 ||
    extras.includes(n) ||
    circuloEmArrasto === n;
  const niveis = NIVEIS.filter(visivel);
  const ocultos = NIVEIS.filter((n) => n > 0 && !niveis.includes(n));
  return (
    <div className="npc-secao npc-soltar" data-testid="npc-secao-conjuracao" {...soltar.props}>
      <Titulo testid="npc-titulo-conjuracao">Conjuração</Titulo>
      <CabecalhoDaConjuracao props={props} />
      {niveis.map((n) => (
        <NivelDoNpc
          key={n}
          n={n}
          props={props}
          aberta={aberta}
          aoAbrir={(nome) => setAberta(aberta === nome ? null : nome)}
          previsao={soltar.previsao}
        />
      ))}
      {editar && ocultos.length > 0 && (
        <select
          className="npc-sel npc-sel-mais"
          data-testid="npc-conj-mais-circulo"
          aria-label="Mostrar mais um círculo"
          value=""
          onChange={(e) => {
            if (e.target.value !== "") setExtras([...extras, Number(e.target.value)]);
          }}
        >
          <option value="">+ Círculo</option>
          {ocultos.map((n) => (
            <option key={n} value={n}>
              {nomeDoNivel(n)}
            </option>
          ))}
        </select>
      )}
      {soltar.acesa && (
        <p className="npc-soltar-aviso" data-testid="soltar-aqui-conjuracao">
          Solte aqui para pôr a magia no círculo dela
        </p>
      )}
    </div>
  );
}
