import {
  bonusDeAcerto,
  espacosAutomaticos,
  expressaoDeDano,
  formatarBonus,
  type Magia,
  moverNoGrupo,
  posicoesDoGrupo,
  previaDoAtaque,
} from "@tabletop/shared";
import { ChevronRight, Plus, Settings, Trash2 } from "lucide-react";
import { type HTMLAttributes, useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { CamposDaMagia, linhaDeNivelEEscola, MarcasDaMagia, TextoDaMagia } from "../CartaoDaMagia";
import { type PropsDaAba, um } from "./AbaPrincipal";
import { CampoDeNovo, CampoNumero, CampoTexto } from "./campos";
import { magiaDoCompendio } from "./conjurar";
import { EditorDeAtaque } from "./EditorDeAtaque";
import { BotaoMandarAoChat } from "./ListaDeTitulos";
import { Bolinha, Caixa, Secao } from "./livro";
import { BotaoPingarMagia, useConjurar } from "./menuDeEspaco";
import { indicadorDoVao, useOrdemDaLista, useSoltarDoCompendio } from "./ordem";
import { soltarNaFicha } from "./soltar";

// ---------------------------------------------------------------------------------------------
// Q9: o círculo de magias (espaços totais e restantes, bolinhas, uma linha por magia, o campo de nova) é um só
// componente para a aba Magias do personagem e para a seção Conjuração do NPC. A variante muda só o que é de cada
// ficha: os `data-testid` de sempre (cada ficha guarda os seus), o "Prep." (só o personagem), o editor da engrenagem
// (no personagem abre na outra coluna; no NPC, embaixo da linha) e o texto da magia sem cartão do compêndio.
// ---------------------------------------------------------------------------------------------

export type VarianteDoCirculo = "personagem" | "npc";

/** Os testids de cada ficha. O personagem usa `magia-*`, o NPC `npc-conj-*`: os que já existiam continuam. */
const IDS = {
  personagem: {
    circulo: (n: number) => `magias-nivel-${n}`,
    cabecalho: (n: number) => `espacos-${n}`,
    restantes: (n: number) => `espacos-restantes-${n}`,
    espaco: (n: number) => `espaco-${n}`,
    total: (n: number) => `espaco-total-${n}`,
    auto: (n: number) => `espaco-auto-${n}`,
    prep: (n: number) => `magias-prep-${n}`,
    nova: (n: number) => `magia-n${n}-nova-nome`,
    soltarAqui: (n: number) => `soltar-aqui-circulo-${n}`,
    lista: (n: number) => `circulo-${n}`,
    linha: (i: number) => `magia-${i}`,
    preparada: (i: number) => `magia-preparada-${i}`,
    alternar: (i: number) => `magia-alternar-${i}`,
    nome: (i: number) => `magia-nome-${i}`,
    conjurar: (i: number) => `magia-conjurar-${i}`,
    pingar: (i: number) => `magia-pingar-${i}`,
    editar: (i: number) => `magia-editar-${i}`,
    corpo: (i: number) => `magia-corpo-${i}`,
    cartao: (i: number) => `magia-cartao-${i}`,
    texto: (i: number) => `magia-descricao-${i}`,
    chat: (i: number) => `magia-chat-${i}`,
    remover: (i: number) => `magia-remover-${i}`,
    campo: (i: number, qual: string) => `magia-${qual}-${i}`,
  },
  npc: {
    circulo: (n: number) => `npc-conj-nivel-${n}`,
    cabecalho: (n: number) => `npc-espacos-${n}`,
    restantes: (n: number) => `npc-espacos-restantes-${n}`,
    espaco: (n: number) => `npc-espaco-${n}`,
    total: (n: number) => `npc-espaco-total-${n}`,
    auto: (n: number) => `npc-espaco-auto-${n}`,
    prep: (n: number) => `npc-conj-prep-${n}`,
    nova: (n: number) => `npc-conj-nova-${n}`,
    soltarAqui: (n: number) => `soltar-aqui-npc-circulo-${n}`,
    lista: (n: number) => `npc-circulo-${n}`,
    linha: (i: number) => `npc-conj-item-${i}`,
    preparada: (i: number) => `npc-conj-preparada-${i}`,
    alternar: (i: number) => `npc-conj-magia-${i}`,
    nome: (i: number) => `npc-conj-nome-${i}`,
    conjurar: (i: number) => `npc-conj-conjurar-${i}`,
    pingar: (i: number) => `npc-conj-pingar-${i}`,
    editar: (i: number) => `npc-conj-editar-${i}`,
    corpo: (i: number) => `npc-conj-corpo-${i}`,
    cartao: (i: number) => `npc-conj-cartao-${i}`,
    texto: (i: number) => `npc-conj-texto-${i}`,
    chat: (i: number) => `npc-conj-chat-${i}`,
    remover: (i: number) => `npc-conj-remover-${i}`,
    campo: (i: number, qual: string) => `npc-conj-${qual}-${i}`,
  },
} as const;

/** Os espaços de um nível em bolinhas: cheia = disponível. Clicar gasta ou recupera até ali. */
export function Espacos({
  prefixo,
  total,
  gastos,
  editar,
  rotuloDoNivel,
  aoMudar,
}: {
  prefixo: string;
  total: number;
  gastos: number;
  editar: boolean;
  rotuloDoNivel: string;
  aoMudar: (gastos: number) => void;
}) {
  const livres = total - gastos;
  return (
    <span className="fl-bolinhas">
      {Array.from({ length: total }, (_, i) => i + 1).map((k) => (
        <Bolinha
          key={k}
          testid={`${prefixo}-${k}`}
          rotulo={`Espaço de ${rotuloDoNivel} ${k}${k <= livres ? ", disponível. Gastar" : ", gasto. Recuperar"}`}
          marcada={k <= livres}
          desabilitado={!editar}
          aoMudar={() => {
            const novosLivres = k <= livres ? k - 1 : k;
            aoMudar(total - novosLivres);
          }}
        />
      ))}
    </span>
  );
}

/** O texto de apoio da linha: escola e o que a magia rola ("ataque +9", "CD 15", "cura 1d8+4"). */
export function subDaMagia(props: PropsDaAba, m: Magia): string {
  const { ficha } = props;
  const acerto = bonusDeAcerto(ficha, m);
  const previa = previaDoAtaque(ficha, m);
  const dano = expressaoDeDano(ficha, m);
  const chip =
    acerto !== undefined
      ? `ataque ${formatarBonus(acerto)}`
      : previa.salvaguarda
        ? previa.salvaguarda.split(" (")[0]
        : dano && (m.tipo ?? "").toLowerCase() === "cura"
          ? `cura ${dano}`
          : "";
  return [m.escola, chip].filter(Boolean).join(" · ");
}

function LinhaDeMagia({
  m,
  i,
  props,
  ordem,
  variante,
}: {
  m: Magia;
  i: number;
  props: PropsDaAba;
  ordem: HTMLAttributes<HTMLDivElement>;
  variante: VarianteDoCirculo;
}) {
  const t = IDS[variante];
  const npc = variante === "npc";
  const {
    alterar,
    editar,
    enviar,
    personagemId,
    compendio,
    abrirEditor,
    fecharEditor,
    editorAberto,
    rolador,
  } = props;
  const [aberta, setAberta] = useState(false);
  const doCompendio = magiaDoCompendio(compendio, m.nome);
  const sub = subDaMagia(props, m);
  const acao = m.nivel === 0 ? "Lançar" : "Conjurar";
  const conj = useConjurar(props, m);
  // No NPC a engrenagem abre o editor embaixo da própria linha; no personagem ele fica na outra coluna.
  const editando = npc && editorAberto?.tipo === "magia" && editorAberto.i === i;
  return (
    <div className="fl-magia" data-testid={t.linha(i)} data-aberta={aberta} {...ordem}>
      <div className="fl-magia-linha">
        {!npc &&
          (m.nivel > 0 ? (
            <label className="fl-prep">
              <input
                type="checkbox"
                className="fl-chk"
                data-testid={t.preparada(i)}
                aria-label={`${m.nome} preparada`}
                checked={m.preparada}
                disabled={!editar}
                onChange={() => alterar(um(`magias.${i}.preparada`, !m.preparada))}
              />
            </label>
          ) : (
            <span className="fl-prep" />
          ))}
        <button
          type="button"
          className="fl-rl fl-magia-nome"
          data-testid={t.alternar(i)}
          data-foco-ordem
          aria-expanded={aberta}
          aria-keyshortcuts={editar ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
          aria-label={
            npc
              ? `${m.nome}: ${aberta ? "recolher" : "expandir"} a descrição. Alt mais seta para cima ou para baixo muda a posição.`
              : `${aberta ? "Recolher" : "Expandir"} ${m.nome}`
          }
          onClick={() => setAberta(!aberta)}
          data-fora-do-preparo={!npc && m.nivel > 0 && !m.preparada}
        >
          <span className="fl-magia-titulo" data-testid={t.nome(i)}>
            <ChevronRight size={13} className="fl-giro" aria-hidden /> {m.nome}
          </span>
          {sub && <span className="fl-sub">{sub}</span>}
        </button>
        <button
          type="button"
          className="fl-cnj"
          data-testid={t.conjurar(i)}
          disabled={!rolador.podeRolar}
          aria-label={`${acao} ${m.nome}${m.nivel > 0 ? ", escolhendo o espaço de magia" : ""}`}
          aria-haspopup={m.nivel > 0 ? "menu" : undefined}
          onClick={(e) => conj.pedir(e.currentTarget)}
        >
          {acao}
        </button>
        {conj.menu}
        <BotaoPingarMagia props={props} m={m} testid={t.pingar(i)} />
        <BotaoComDica
          className="fl-ib fl-eng"
          testid={t.editar(i)}
          nome={`Configurar ${m.nome}`}
          aria-label={`Configurar ${m.nome}`}
          {...(npc ? { "aria-expanded": editando } : {})}
          motivo={editar ? null : "Só quem edita a ficha configura"}
          onClick={() => (npc && editando ? fecharEditor() : abrirEditor({ tipo: "magia", i }))}
        >
          <Settings size={17} aria-hidden />
        </BotaoComDica>
      </div>
      {aberta && (
        <div className="fl-magia-corpo" data-testid={t.corpo(i)}>
          {doCompendio ? (
            <div className="fl-cartao-da-magia" data-testid={t.cartao(i)}>
              <p className="fl-sub">
                {linhaDeNivelEEscola(doCompendio)} <MarcasDaMagia magia={doCompendio} />
              </p>
              <CamposDaMagia magia={doCompendio} />
              <TextoDaMagia magia={doCompendio} />
            </div>
          ) : npc ? (
            <p data-testid={t.texto(i)}>
              {m.descricao.trim() === "" ? "Sem descrição." : m.descricao}
            </p>
          ) : (
            <>
              <div className="fl-magia-campos">
                {(
                  [
                    ["escola", "Escola", "Escola", "escola", 32],
                    ["tempo", "Tempo", "Tempo de conjuração", "tempo", 60],
                    ["alcance", "Alcance", "Alcance", "alcance", 100],
                    ["componentes", "Componentes", "Componentes", "componentes", 200],
                    ["duracao", "Duração", "Duração", "duracao", 80],
                  ] as const
                ).map(([chave, titulo, rotulo, campo, max]) => (
                  <div className="fl-edf" key={chave}>
                    <span className="fl-lbl">{titulo}</span>
                    <CampoTexto
                      testid={t.campo(i, chave)}
                      rotulo={rotulo}
                      valor={m[campo] ?? ""}
                      maxLength={max}
                      desabilitado={!editar}
                      className="fl-fld"
                      aoMudar={(v) => alterar(um(`magias.${i}.${campo}`, v === "" ? null : v))}
                    />
                  </div>
                ))}
              </div>
              <CampoTexto
                testid={t.texto(i)}
                rotulo={`Descrição de ${m.nome}`}
                placeholder="Descrição"
                valor={m.descricao}
                maxLength={20000}
                multilinha
                crescente
                desabilitado={!editar}
                className="fl-fld fl-feat-texto"
                aoMudar={(v) => alterar(um(`magias.${i}.descricao`, v))}
              />
            </>
          )}
          <div className="fl-magia-acoes">
            <BotaoMandarAoChat
              testid={t.chat(i)}
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
            {editar && (
              <BotaoComDica
                className="fl-ib"
                testid={t.remover(i)}
                nome={`Tirar ${m.nome}`}
                aria-label={`Tirar ${m.nome}`}
                onClick={() => alterar(um(`magias.${i}`, null))}
              >
                <Trash2 size={15} aria-hidden />
              </BotaoComDica>
            )}
          </div>
        </div>
      )}
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

/** O total de espaços de um círculo: o número à vista, "auto" para voltar à conta das classes (V4a3). */
function TotalDeEspacos({
  n,
  props,
  variante,
}: {
  n: number;
  props: PropsDaAba;
  variante: VarianteDoCirculo;
}) {
  const t = IDS[variante];
  const { ficha, d, alterar, editar } = props;
  const chave = String(n) as "1";
  const total = d.espacos.find((e) => e.nivel === n)?.total ?? 0;
  const escrito = ficha.espacosTotal?.[chave] !== undefined;
  const definir = (v: number | null) => {
    const { [chave]: _antigo, ...resto } = ficha.espacosTotal ?? {};
    const novo = v === null ? resto : { ...resto, [chave]: v };
    alterar(um("espacosTotal", Object.keys(novo).length === 0 ? null : novo));
  };
  return (
    <div className="fl-total-espacos-rotulo">
      <span className="fl-lbl">Espaços totais</span>
      <CampoNumero
        testid={t.total(n)}
        rotulo={`Espaços de ${n}º nível: total`}
        valor={total}
        max={30}
        desabilitado={!editar}
        className="fl-in fl-fn fl-total-espacos"
        aoMudar={definir}
        aoApagar={() => definir(null)}
      />
      {editar && escrito && espacosAutomaticos(ficha)[n - 1] !== undefined && (
        <button
          type="button"
          className="fl-auto"
          data-testid={t.auto(n)}
          aria-label={`Espaços de ${n}º nível: voltar ao total automático (${espacosAutomaticos(ficha)[n - 1]})`}
          title="Voltar ao total das classes"
          onClick={() => definir(null)}
        >
          auto
        </button>
      )}
    </div>
  );
}

/** O "+ Círculo": mostra o próximo círculo escondido, para preencher o total de espaços antes das magias (V4a3). */
export function BotaoNovoCirculo({
  aoClicar,
  testid = "magias-novo-circulo",
}: {
  aoClicar: () => void;
  testid?: string;
}) {
  return (
    <button
      type="button"
      className="fl-sec2 fl-novo-circulo"
      data-testid={testid}
      onClick={aoClicar}
    >
      <Plus size={15} aria-hidden /> Círculo
    </button>
  );
}

/** Um círculo (ou os truques): espaços totais e restantes, as bolinhas, as magias em linha e o campo de nova. */
export function CirculoDeMagias({
  n,
  props,
  variante,
  titulo,
}: {
  n: number;
  props: PropsDaAba;
  variante: VarianteDoCirculo;
  titulo: string;
}) {
  const t = IDS[variante];
  const npc = variante === "npc";
  const { ficha, d, alterar, editar, fecharEditor } = props;
  const magias = ficha.magias ?? [];
  const doNivel = magias.map((m, i) => ({ m, i })).filter((x) => x.m.nivel === n && !x.m.inata);
  const ordem = useOrdemDaLista({
    lista: t.lista(n),
    habilitado: editar,
    aoMover: (de, para) => {
      fecharEditor();
      alterar(
        um(
          "magias",
          moverNoGrupo(
            magias,
            posicoesDoGrupo(magias, (x) => x.nivel === n && !x.inata),
            de,
            para,
          ),
        ),
      );
    },
  });
  // A magia solta entra no círculo dela: só esse círculo acende, e a posição vale quando é este mesmo.
  const soltar = useSoltarDoCompendio({
    aceita: ["magia"],
    filtro: (e) => e.tipo === "magia" && e.magia.nivel === n,
    habilitado: editar,
    listaDoTipo: { magia: t.lista(n) },
    aoSoltar: (entrada, posicao) => soltarNaFicha(props, variante, entrada, { posicao }),
  });
  const espaco = d.espacos.find((e) => e.nivel === n);
  return (
    <Caixa testid={t.circulo(n)} className="fl-nivel fl-soltar" {...soltar.props}>
      <div className="fl-nivel-cab" data-testid={n > 0 ? t.cabecalho(n) : undefined}>
        <Secao className="fl-nivel-titulo">{titulo}</Secao>
        {n > 0 && (
          <>
            {(!npc || editar) && <TotalDeEspacos n={n} props={props} variante={variante} />}
            <span className="fl-nivel-resumo">
              Restantes{" "}
              <strong className="fl-fa" data-testid={t.restantes(n)}>
                {espaco?.restantes ?? 0}
              </strong>
            </span>
          </>
        )}
      </div>
      {n > 0 && espaco && espaco.total > 0 && (
        <Espacos
          prefixo={t.espaco(n)}
          total={espaco.total}
          gastos={espaco.gastos}
          editar={editar}
          rotuloDoNivel={`${n}º nível`}
          aoMudar={(g) => {
            // O objeto inteiro (chave numérica não cria o caminho: "1" seria posição de lista).
            const { [String(n) as "1"]: _antigo, ...resto } = ficha.espacosGastos ?? {};
            alterar(um("espacosGastos", g === 0 ? resto : { ...resto, [String(n)]: g }));
          }}
        />
      )}
      {!npc && n > 0 && doNivel.length > 0 && (
        <span className="fl-prep-rotulo" data-testid={t.prep(n)} title="Preparada">
          <span aria-hidden="true">Prep.</span>
          <span className="fl-so-leitor">Preparada</span>
        </span>
      )}
      {doNivel.map(({ m, i }, k) => (
        <LinhaDeMagia
          key={`m-${i}-${m.nome}`}
          m={m}
          i={i}
          props={props}
          variante={variante}
          ordem={{
            ...ordem.linha(k, doNivel.length),
            ...(soltar.previsao?.lista === t.lista(n)
              ? { "data-indicador": indicadorDoVao(soltar.previsao.vao, k, doNivel.length) }
              : {}),
          }}
        />
      ))}
      {soltar.acesa && (
        <p className="fl-soltar-aviso" data-testid={t.soltarAqui(n)}>
          Solte aqui para pôr entre as magias
        </p>
      )}
      {doNivel.length === 0 && !editar && <p className="fl-dica">Nenhuma magia.</p>}
      {editar && (
        <CampoDeNovo
          testid={t.nova(n)}
          rotulo={`Nome da nova magia de ${n === 0 ? "truque" : `${n}º nível`}`}
          placeholder={n === 0 ? "Novo truque" : "Nova magia"}
          className="fl-in fl-magia-nova"
          aoCriar={(nome) =>
            alterar(um("magias", [...magias, { nome, nivel: n, preparada: true, descricao: "" }]))
          }
        />
      )}
    </Caixa>
  );
}
