import {
  ATRIBUTOS,
  bonusDeAcerto,
  expressaoDeDano,
  formatarBonus,
  type Magia,
  previaDoAtaque,
  ROTULO_DO_ATRIBUTO,
  SIGLA_DO_ATRIBUTO,
} from "@tabletop/shared";
import { ChevronRight, RotateCcw, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { CamposDaMagia, linhaDeNivelEEscola, MarcasDaMagia, TextoDaMagia } from "../CartaoDaMagia";
import { type PropsDaAba, um } from "./AbaPrincipal";
import { CampoDeNovo, CampoNumero, CampoTexto } from "./campos";
import { conjurar, magiaDoCompendio } from "./conjurar";
import { EditorDeAtaque } from "./EditorDeAtaque";
import { BotaoMandarAoChat } from "./ListaDeTitulos";
import { Bolinha, Caixa, Secao } from "./livro";

const TODOS_OS_NIVEIS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Os espaços de um nível em bolinhas: cheia = disponível. Clicar gasta ou recupera até ali. */
function Espacos({
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

/** Atributo de conjuração, CD e ataque da classe: as três caixas do alto da aba. */
function Conjuracao({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  const c = d.conjuradoras[0];
  const seletor = (classe: string, valor: string) => (
    <select
      className="fl-fld fl-seletor"
      data-testid={`conjuracao-habilidade-${classe}`}
      aria-label={`Habilidade de conjuração de ${classe}`}
      value={valor}
      disabled={!editar}
      onChange={(e) => {
        const outras = (ficha.conjuracao ?? []).filter((x) => x.classe !== classe);
        alterar(um("conjuracao", [...outras, { classe, habilidade: e.target.value }]));
      }}
    >
      {ATRIBUTOS.map((a) => (
        <option key={a} value={a}>
          {ROTULO_DO_ATRIBUTO[a]}
        </option>
      ))}
    </select>
  );
  if (!c) {
    return (
      <div className="fl-conj-caixas" data-testid="fh-conjuracao-vazia">
        {["Atributo", "CD das magias", "Ataque de magia"].map((r) => (
          <Caixa key={r} className="fl-conj-caixa">
            <span className="fl-fa fl-conj-valor">—</span>
            <span className="fl-lbl">{r}</span>
          </Caixa>
        ))}
      </div>
    );
  }
  return (
    <div className="fl-conj-caixas">
      <Caixa className="fl-conj-caixa">
        {seletor(c.classe, c.habilidade)}
        <span className="fl-lbl">Atributo</span>
      </Caixa>
      <Caixa className="fl-conj-caixa">
        <strong className="fl-fa fl-conj-valor" data-testid={`conjuracao-cd-${c.classe}`}>
          {c.cd}
        </strong>
        <span className="fl-lbl">CD das magias</span>
      </Caixa>
      <Caixa className="fl-conj-caixa fl-conj-rola">
        <button
          type="button"
          className="fl-rl fl-conj-botao"
          data-testid={`conjuracao-ataque-${c.classe}`}
          disabled={!rolador.podeRolar}
          title={rolador.podeRolar ? undefined : "Só quem edita a ficha rola"}
          aria-label={`Rolar o ataque de magia de ${c.classe}`}
          onClick={() => rolador.teste(`Ataque de magia (${c.classe})`, c.ataque)}
        >
          <span className="fl-fa fl-rn fl-conj-valor">{formatarBonus(c.ataque)}</span>
        </button>
        <span className="fl-lbl">Ataque de magia</span>
      </Caixa>
    </div>
  );
}

/** As outras classes que conjuram: uma linha para cada, com os mesmos números. */
function OutrasConjuradoras({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  const outras = d.conjuradoras.slice(1);
  if (outras.length === 0) return null;
  return (
    <ul className="fl-outras-conjuradoras" data-testid="fh-conjuracao">
      {outras.map((c) => (
        <li key={c.classe} data-testid={`conjuradora-${c.classe}`}>
          <strong>{c.classe}</strong>
          <select
            className="fl-fld fl-seletor"
            data-testid={`conjuracao-habilidade-${c.classe}`}
            aria-label={`Habilidade de conjuração de ${c.classe}`}
            value={c.habilidade}
            disabled={!editar}
            onChange={(e) => {
              const restante = (ficha.conjuracao ?? []).filter((x) => x.classe !== c.classe);
              alterar(
                um("conjuracao", [...restante, { classe: c.classe, habilidade: e.target.value }]),
              );
            }}
          >
            {ATRIBUTOS.map((a) => (
              <option key={a} value={a}>
                {SIGLA_DO_ATRIBUTO[a]}
              </option>
            ))}
          </select>
          <span>
            CD <strong data-testid={`conjuracao-cd-${c.classe}`}>{c.cd}</strong>
          </span>
          <button
            type="button"
            className="fl-rl fl-teste"
            data-testid={`conjuracao-ataque-${c.classe}`}
            disabled={!rolador.podeRolar}
            aria-label={`Rolar o ataque de magia de ${c.classe}`}
            onClick={() => rolador.teste(`Ataque de magia (${c.classe})`, c.ataque)}
          >
            {formatarBonus(c.ataque)}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** O texto de apoio da linha: escola e o que a magia rola ("ataque +9", "CD 15", "cura 1d8+4"). */
function subDaMagia(props: PropsDaAba, m: Magia): string {
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

function LinhaDeMagia({ m, i, props }: { m: Magia; i: number; props: PropsDaAba }) {
  const { alterar, editar, enviar, personagemId, compendio, abrirEditor, rolador } = props;
  const [aberta, setAberta] = useState(false);
  const doCompendio = magiaDoCompendio(compendio, m.nome);
  const sub = subDaMagia(props, m);
  const acao = m.nivel === 0 ? "Lançar" : "Conjurar";
  return (
    <div className="fl-magia" data-testid={`magia-${i}`} data-aberta={aberta}>
      <div className="fl-magia-linha">
        {m.nivel > 0 ? (
          <label className="fl-prep">
            <input
              type="checkbox"
              className="fl-chk"
              data-testid={`magia-preparada-${i}`}
              aria-label={`${m.nome} preparada`}
              checked={m.preparada}
              disabled={!editar}
              onChange={() => alterar(um(`magias.${i}.preparada`, !m.preparada))}
            />
          </label>
        ) : (
          <span className="fl-prep" />
        )}
        <button
          type="button"
          className="fl-rl fl-magia-nome"
          data-testid={`magia-alternar-${i}`}
          aria-expanded={aberta}
          aria-label={`${aberta ? "Recolher" : "Expandir"} ${m.nome}`}
          onClick={() => setAberta(!aberta)}
          data-fora-do-preparo={m.nivel > 0 && !m.preparada}
        >
          <span className="fl-magia-titulo" data-testid={`magia-nome-${i}`}>
            <ChevronRight size={13} className="fl-giro" aria-hidden /> {m.nome}
          </span>
          {sub && <span className="fl-sub">{sub}</span>}
        </button>
        <button
          type="button"
          className="fl-cnj"
          data-testid={`magia-conjurar-${i}`}
          disabled={!rolador.podeRolar}
          aria-label={`${acao} ${m.nome}${m.nivel > 0 ? ` gastando um espaço de ${m.nivel}º nível` : ""}`}
          onClick={() => conjurar(props, m, i)}
        >
          {acao}
        </button>
        <BotaoComDica
          className="fl-ib fl-eng"
          testid={`magia-editar-${i}`}
          nome={`Configurar ${m.nome}`}
          aria-label={`Configurar ${m.nome}`}
          motivo={editar ? null : "Só quem edita a ficha configura"}
          onClick={() => abrirEditor({ tipo: "magia", i })}
        >
          <Settings size={17} aria-hidden />
        </BotaoComDica>
      </div>
      {aberta && (
        <div className="fl-magia-corpo">
          {doCompendio ? (
            <div className="fl-cartao-da-magia" data-testid={`magia-cartao-${i}`}>
              <p className="fl-sub">
                {linhaDeNivelEEscola(doCompendio)} <MarcasDaMagia magia={doCompendio} />
              </p>
              <CamposDaMagia magia={doCompendio} />
              <TextoDaMagia magia={doCompendio} />
            </div>
          ) : (
            <>
              <div className="fl-magia-campos">
                <div className="fl-edf">
                  <span className="fl-lbl">Escola</span>
                  <CampoTexto
                    testid={`magia-escola-${i}`}
                    rotulo="Escola"
                    valor={m.escola ?? ""}
                    maxLength={32}
                    desabilitado={!editar}
                    className="fl-fld"
                    aoMudar={(t) => alterar(um(`magias.${i}.escola`, t === "" ? null : t))}
                  />
                </div>
                <div className="fl-edf">
                  <span className="fl-lbl">Tempo</span>
                  <CampoTexto
                    testid={`magia-tempo-${i}`}
                    rotulo="Tempo de conjuração"
                    valor={m.tempo ?? ""}
                    maxLength={60}
                    desabilitado={!editar}
                    className="fl-fld"
                    aoMudar={(t) => alterar(um(`magias.${i}.tempo`, t === "" ? null : t))}
                  />
                </div>
                <div className="fl-edf">
                  <span className="fl-lbl">Alcance</span>
                  <CampoTexto
                    testid={`magia-alcance-${i}`}
                    rotulo="Alcance"
                    valor={m.alcance ?? ""}
                    maxLength={100}
                    desabilitado={!editar}
                    className="fl-fld"
                    aoMudar={(t) => alterar(um(`magias.${i}.alcance`, t === "" ? null : t))}
                  />
                </div>
                <div className="fl-edf">
                  <span className="fl-lbl">Componentes</span>
                  <CampoTexto
                    testid={`magia-componentes-${i}`}
                    rotulo="Componentes"
                    valor={m.componentes ?? ""}
                    maxLength={200}
                    desabilitado={!editar}
                    className="fl-fld"
                    aoMudar={(t) => alterar(um(`magias.${i}.componentes`, t === "" ? null : t))}
                  />
                </div>
                <div className="fl-edf">
                  <span className="fl-lbl">Duração</span>
                  <CampoTexto
                    testid={`magia-duracao-${i}`}
                    rotulo="Duração"
                    valor={m.duracao ?? ""}
                    maxLength={80}
                    desabilitado={!editar}
                    className="fl-fld"
                    aoMudar={(t) => alterar(um(`magias.${i}.duracao`, t === "" ? null : t))}
                  />
                </div>
              </div>
              <CampoTexto
                testid={`magia-descricao-${i}`}
                rotulo={`Descrição de ${m.nome}`}
                placeholder="Descrição"
                valor={m.descricao}
                maxLength={20000}
                multilinha
                crescente
                desabilitado={!editar}
                className="fl-fld fl-feat-texto"
                aoMudar={(t) => alterar(um(`magias.${i}.descricao`, t))}
              />
            </>
          )}
          <div className="fl-magia-acoes">
            <BotaoMandarAoChat
              testid={`magia-chat-${i}`}
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
                testid={`magia-remover-${i}`}
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
    </div>
  );
}

function Nivel({ n, props }: { n: number; props: PropsDaAba }) {
  const { ficha, d, alterar, editar } = props;
  const magias = ficha.magias ?? [];
  const doNivel = magias.map((m, i) => ({ m, i })).filter((x) => x.m.nivel === n);
  const espaco = d.espacos.find((e) => e.nivel === n);
  const titulo = n === 0 ? "Truques" : `${n}º nível`;
  return (
    <Caixa testid={`magias-nivel-${n}`} className="fl-nivel">
      <div className="fl-nivel-cab" data-testid={espaco ? `espacos-${n}` : undefined}>
        <Secao className="fl-nivel-titulo">{titulo}</Secao>
        {espaco && n > 0 && (
          <>
            <Espacos
              prefixo={`espaco-${n}`}
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
            <span className="fl-fa fl-nivel-resumo" data-testid={`espacos-resumo-${n}`}>
              {espaco.restantes}/{espaco.total}
            </span>
          </>
        )}
        {n > 0 && editar && (
          <CampoNumero
            testid={`espaco-total-${n}`}
            rotulo={`Espaços de ${n}º nível: total`}
            valor={espaco?.total ?? 0}
            max={30}
            className="fl-bonus-extra fl-total-espacos"
            aoMudar={(v) =>
              alterar(um("espacosTotal", { ...(ficha.espacosTotal ?? {}), [String(n)]: v }))
            }
          />
        )}
      </div>
      {doNivel.map(({ m, i }) => (
        <LinhaDeMagia key={`m-${i}`} m={m} i={i} props={props} />
      ))}
      {doNivel.length === 0 && !editar && <p className="fl-dica">Nenhuma magia.</p>}
      {editar && (
        <CampoDeNovo
          testid={`magia-n${n}-nova-nome`}
          rotulo={`Nome da nova magia de ${n === 0 ? "truque" : `${n}º nível`}`}
          placeholder={n === 0 ? "Novo truque" : "Nova magia"}
          className="fl-in fl-magia-nova"
          aoCriar={(t) =>
            alterar(
              um("magias", [...magias, { nome: t, nivel: n, preparada: true, descricao: "" }]),
            )
          }
        />
      )}
    </Caixa>
  );
}

/** Aba Magias: atributo, CD e ataque, os espaços por nível e as magias de cada nível. */
export function AbaMagias(props: PropsDaAba) {
  const { ficha, d, alterar, editar, editorAberto, fecharEditor, estreita } = props;
  const temMagiaNoNivel = (n: number) => (ficha.magias ?? []).some((m) => m.nivel === n);
  const visiveis = TODOS_OS_NIVEIS.filter(
    (n) => n <= 1 || temMagiaNoNivel(n) || (d.espacos.find((e) => e.nivel === n)?.total ?? 0) > 0,
  );
  const metade = Math.ceil(visiveis.length / 2);
  const esquerda = estreita ? visiveis : visiveis.slice(0, metade);
  const direita = estreita ? [] : visiveis.slice(metade);
  const recuperar = () => alterar(um("espacosGastos", null));
  if (editorAberto && estreita) {
    return (
      <div className="fl-magias" data-testid="fh-aba-magias">
        <EditorDeAtaque alvo={editorAberto} origem="magias" props={props} aoVoltar={fecharEditor} />
      </div>
    );
  }
  return (
    <div className="fl-magias" data-testid="fh-aba-magias">
      <div className="fl-mag-col">
        <Conjuracao {...props} />
        <OutrasConjuradoras {...props} />
        {d.conjuradoras.length === 0 && (
          <p className="fl-dica" data-testid="sem-conjuracao">
            Nenhuma classe de conjuração: preencha as classes na aba Personagem.
          </p>
        )}
        <div className="fl-mag-barra">
          <CampoTexto
            testid="ficha-classe-conjurador"
            rotulo="Classe de conjurador"
            placeholder="Classe de conjurador"
            valor={ficha.classeConjurador ?? d.conjuradoras[0]?.classe ?? ""}
            maxLength={48}
            desabilitado={!editar}
            className="fl-in fl-ln fl-classe-conj"
            aoMudar={(t) => alterar(um("classeConjurador", t === "" ? null : t))}
          />
          {editar && (
            <button
              type="button"
              className="fl-sec2"
              data-testid="recuperar-espacos"
              onClick={recuperar}
            >
              <RotateCcw size={15} aria-hidden /> Recuperar espaços
            </button>
          )}
        </div>
        {d.pacto && (
          <Caixa testid="espacos-pacto" className="fl-nivel">
            <div className="fl-nivel-cab">
              <Secao className="fl-nivel-titulo">Pacto ({d.pacto.nivel}º nível)</Secao>
              <Espacos
                prefixo="pacto"
                total={d.pacto.quantidade}
                gastos={d.pacto.gastos}
                editar={editar}
                rotuloDoNivel="pacto"
                aoMudar={(g) => alterar(um("pactoGasto", g === 0 ? null : g))}
              />
              <span className="fl-fa fl-nivel-resumo" data-testid="espacos-resumo-pacto">
                {d.pacto.restantes}/{d.pacto.quantidade}
              </span>
            </div>
          </Caixa>
        )}
        {esquerda.map((n) => (
          <Nivel key={n} n={n} props={props} />
        ))}
      </div>
      {!estreita && (
        <div className="fl-mag-col">
          {editorAberto ? (
            <EditorDeAtaque
              alvo={editorAberto}
              origem="magias"
              props={props}
              aoVoltar={fecharEditor}
            />
          ) : (
            direita.map((n) => <Nivel key={n} n={n} props={props} />)
          )}
        </div>
      )}
    </div>
  );
}
