import {
  ATRIBUTOS,
  type Ataque,
  bonusDeAcerto,
  CLASSES,
  type Ficha,
  type FichaDerivada,
  formatarBonus,
  iconesDoToken,
  NIVEIS_DE_PROFICIENCIA,
  type NivelDeProficiencia,
  type OperacaoDeFicha,
  ROTULO_DO_ATRIBUTO,
  SIGLA_DO_ATRIBUTO,
  type Token,
} from "@tabletop/shared";
import { Dices, Plus, Trash2 } from "lucide-react";
import { CampoNumero, CampoTexto } from "./campos";
import type { Rolador } from "./rolador";

export type PropsDaAba = {
  personagemId: string;
  ficha: Ficha;
  d: FichaDerivada;
  alterar: (operacoes: OperacaoDeFicha[]) => boolean;
  editar: boolean;
  rolador: Rolador;
  /** O token do personagem na cena ativa (as condições e a concentração moram nele); sem token, `undefined`. */
  token?: Token | undefined;
};

/** Uma operação só: `caminho` recebe `valor` (`null` remove). */
const um = (caminho: string, valor: unknown): OperacaoDeFicha[] => [{ caminho, valor }];

const ROTULO_DA_PROFICIENCIA: Record<NivelDeProficiencia, string> = {
  nenhuma: "sem proficiência",
  proficiente: "proficiente",
  especialista: "especialista",
};

/** Bolinha que alterna nenhuma → proficiente → especialista. */
function BotaoDeProficiencia({
  testid,
  nome,
  nivel,
  editar,
  aoMudar,
}: {
  testid: string;
  nome: string;
  nivel: NivelDeProficiencia;
  editar: boolean;
  aoMudar: (nivel: NivelDeProficiencia) => void;
}) {
  const proximo = (): NivelDeProficiencia => {
    const i = NIVEIS_DE_PROFICIENCIA.indexOf(nivel);
    return NIVEIS_DE_PROFICIENCIA[(i + 1) % NIVEIS_DE_PROFICIENCIA.length] ?? "nenhuma";
  };
  return (
    <button
      type="button"
      className="fh-prof"
      data-testid={testid}
      data-nivel={nivel}
      disabled={!editar}
      title={`${nome}: ${ROTULO_DA_PROFICIENCIA[nivel]} (clique para alternar)`}
      aria-label={`Proficiência em ${nome}: ${ROTULO_DA_PROFICIENCIA[nivel]}`}
      onClick={() => aoMudar(proximo())}
    />
  );
}

/** Número que se rola: clicar manda o teste para o chat, como o personagem. */
function NumeroRolavel({
  testid,
  valor,
  nome,
  rolador,
  className,
  cd,
}: {
  testid: string;
  valor: number;
  nome: string;
  rolador: Rolador;
  className?: string;
  cd?: number;
}) {
  return (
    <button
      type="button"
      className={`fh-rolavel ${className ?? ""}`}
      data-testid={testid}
      disabled={!rolador.podeRolar}
      title={rolador.podeRolar ? `Rolar ${nome}` : "Só quem edita a ficha rola"}
      aria-label={`Rolar ${nome} ${formatarBonus(valor)}`}
      onClick={() => rolador.teste(nome, valor, cd)}
    >
      {formatarBonus(valor)}
    </button>
  );
}

function Atributos({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  return (
    <section className="fh-atributos" data-testid="fh-atributos" aria-label="Atributos">
      {ATRIBUTOS.map((a) => (
        <div key={a} className="fh-atributo" data-testid={`atributo-${a}`}>
          <span className="fh-sigla" title={ROTULO_DO_ATRIBUTO[a]}>
            {SIGLA_DO_ATRIBUTO[a]}
          </span>
          <NumeroRolavel
            testid={`atributo-mod-${a}`}
            valor={d.atributos[a].mod}
            nome={`Teste de ${ROTULO_DO_ATRIBUTO[a]}`}
            rolador={rolador}
            className="grande"
          />
          <CampoNumero
            testid={`atributo-valor-${a}`}
            rotulo={`Valor de ${ROTULO_DO_ATRIBUTO[a]}`}
            valor={ficha.atributos?.[a] ?? 10}
            min={1}
            max={30}
            desabilitado={!editar}
            aoMudar={(n) => alterar(um(`atributos.${a}`, n))}
          />
        </div>
      ))}
    </section>
  );
}

function Salvaguardas({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  return (
    <section className="fh-lista" data-testid="fh-salvaguardas" aria-label="Salvaguardas">
      <h4>Salvaguardas</h4>
      {ATRIBUTOS.map((a) => (
        <div key={a} className="fh-linha" data-testid={`salvaguarda-${a}`}>
          <BotaoDeProficiencia
            testid={`prof-salva-${a}`}
            nome={`salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}`}
            nivel={d.salvaguardas[a].nivel}
            editar={editar}
            aoMudar={(nivel) => alterar(um(`salvaguardas.${a}.nivel`, nivel))}
          />
          <NumeroRolavel
            testid={`salvaguarda-total-${a}`}
            valor={d.salvaguardas[a].total}
            nome={`Salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}`}
            rolador={rolador}
          />
          <span className="fh-nome-linha">{ROTULO_DO_ATRIBUTO[a]}</span>
          <CampoNumero
            testid={`salvaguarda-bonus-${a}`}
            rotulo={`Bônus extra na salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}`}
            valor={ficha.salvaguardas?.[a]?.bonus ?? 0}
            min={-50}
            max={50}
            desabilitado={!editar}
            className="mini"
            aoMudar={(n) =>
              alterar(
                ficha.salvaguardas?.[a]
                  ? um(`salvaguardas.${a}.bonus`, n === 0 ? null : n)
                  : um(`salvaguardas.${a}`, { nivel: "nenhuma", ...(n === 0 ? {} : { bonus: n }) }),
              )
            }
          />
        </div>
      ))}
    </section>
  );
}

function Pericias({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  return (
    <section className="fh-lista" data-testid="fh-pericias" aria-label="Perícias">
      <h4>Perícias</h4>
      {d.pericias.map((p) => (
        <div key={p.id} className="fh-linha" data-testid={`pericia-${p.id}`}>
          <BotaoDeProficiencia
            testid={`prof-pericia-${p.id}`}
            nome={p.nome}
            nivel={p.nivel}
            editar={editar}
            aoMudar={(nivel) => alterar(um(`pericias.${p.id}.nivel`, nivel))}
          />
          <NumeroRolavel
            testid={`pericia-total-${p.id}`}
            valor={p.total}
            nome={p.nome}
            rolador={rolador}
          />
          <span className="fh-nome-linha">
            {p.nome} <small>({SIGLA_DO_ATRIBUTO[p.atributo]})</small>
          </span>
          <CampoNumero
            testid={`pericia-bonus-${p.id}`}
            rotulo={`Bônus extra em ${p.nome}`}
            valor={ficha.pericias?.[p.id]?.bonus ?? 0}
            min={-50}
            max={50}
            desabilitado={!editar}
            className="mini"
            aoMudar={(n) =>
              alterar(
                ficha.pericias?.[p.id]
                  ? um(`pericias.${p.id}.bonus`, n === 0 ? null : n)
                  : um(`pericias.${p.id}`, { nivel: "nenhuma", ...(n === 0 ? {} : { bonus: n }) }),
              )
            }
          />
        </div>
      ))}
    </section>
  );
}

function Identidade({ ficha, alterar, editar }: PropsDaAba) {
  const classes = ficha.classes ?? [];
  return (
    <section className="fh-identidade" data-testid="fh-identidade" aria-label="Identidade">
      <div className="fh-grade-3">
        {(
          [
            ["raca", "Raça"],
            ["antecedente", "Antecedente"],
            ["alinhamento", "Alinhamento"],
          ] as const
        ).map(([campo, rotulo]) => (
          <div key={campo} className="fh-campo">
            <span>{rotulo}</span>
            <CampoTexto
              testid={`ficha-${campo}`}
              rotulo={rotulo}
              valor={ficha[campo] ?? ""}
              maxLength={64}
              desabilitado={!editar}
              aoMudar={(t) => alterar(um(campo, t === "" ? null : t))}
            />
          </div>
        ))}
      </div>
      <div className="fh-classes" data-testid="fh-classes">
        {classes.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
          <div key={i} className="fh-classe" data-testid={`classe-${i}`}>
            <CampoTexto
              testid={`classe-nome-${i}`}
              lista="fh-classes-srd"
              rotulo="Classe"
              valor={c.classe}
              maxLength={48}
              desabilitado={!editar}
              aoMudar={(t) => alterar(um(`classes.${i}.classe`, t))}
            />
            <CampoTexto
              testid={`classe-subclasse-${i}`}
              rotulo="Subclasse"
              placeholder="subclasse"
              valor={c.subclasse ?? ""}
              maxLength={48}
              desabilitado={!editar}
              aoMudar={(t) => alterar(um(`classes.${i}.subclasse`, t === "" ? null : t))}
            />
            <CampoNumero
              testid={`classe-nivel-${i}`}
              rotulo={`Nível de ${c.classe}`}
              valor={c.nivel}
              min={1}
              max={20}
              desabilitado={!editar}
              aoMudar={(n) => alterar(um(`classes.${i}.nivel`, n))}
            />
            {editar && (
              <button
                type="button"
                className="botao-icone pequeno"
                data-testid={`classe-remover-${i}`}
                title="Tirar a classe"
                aria-label={`Tirar a classe ${c.classe}`}
                onClick={() => alterar(um(`classes.${i}`, null))}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {editar && (
          <>
            <datalist id="fh-classes-srd">
              {CLASSES.map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>
            <button
              type="button"
              data-testid="classe-adicionar"
              onClick={() =>
                alterar(um("classes", [...classes, { classe: "Guerreiro", nivel: 1 }]))
              }
            >
              <Plus size={14} /> Classe
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function Resumo({ personagemId, d, alterar, editar, rolador }: PropsDaAba) {
  return (
    <section className="fh-resumo" aria-label="Resumo">
      <div className="fh-caixa" data-testid="fh-ca">
        <span className="fh-rotulo">CA</span>
        <CampoNumero
          testid={`ca-${personagemId}`}
          rotulo="Classe de armadura"
          valor={d.ca}
          max={50}
          desabilitado={!editar}
          className="grande"
          aoMudar={(n) => alterar(um("ca.valor", n))}
        />
      </div>
      <div className="fh-caixa" data-testid="fh-iniciativa">
        <span className="fh-rotulo">Iniciativa</span>
        <NumeroRolavel
          testid="iniciativa"
          valor={d.iniciativa}
          nome="Iniciativa"
          rolador={rolador}
          className="grande"
        />
      </div>
      <div className="fh-caixa" data-testid="fh-deslocamento">
        <span className="fh-rotulo">Deslocamento</span>
        <span className="fh-duplo">
          <CampoNumero
            testid="deslocamento-ft"
            rotulo="Deslocamento em pés (ft)"
            valor={d.deslocamentoFt}
            max={500}
            desabilitado={!editar}
            aoMudar={(n) => alterar(um("deslocamentoFt", n))}
          />
          <span data-testid="deslocamento-texto">
            ft = {String(d.deslocamentoM).replace(".", ",")} m
          </span>
        </span>
      </div>
      <div className="fh-caixa" data-testid="fh-proficiencia">
        <span className="fh-rotulo">Proficiência</span>
        <strong data-testid="proficiencia" className="fh-grande">
          {formatarBonus(d.proficiencia)}
        </strong>
        <small>nível {d.nivelTotal}</small>
      </div>
      <div className="fh-caixa" data-testid="fh-passiva">
        <span className="fh-rotulo">Percepção passiva</span>
        <strong data-testid="percepcao-passiva" className="fh-grande">
          {d.percepcaoPassiva}
        </strong>
      </div>
    </section>
  );
}

function PontosDeVida({ personagemId, ficha, d, alterar, editar, rolador }: PropsDaAba) {
  const mortes = ficha.mortes ?? { sucessos: 0, falhas: 0 };
  const marcas = (campo: "sucessos" | "falhas") =>
    [1, 2, 3].map((n) => (
      <input
        key={n}
        type="checkbox"
        data-testid={`morte-${campo}-${n}`}
        aria-label={`${campo === "sucessos" ? "Sucesso" : "Falha"} ${n} no teste contra a morte`}
        checked={mortes[campo] >= n}
        disabled={!editar}
        onChange={() =>
          alterar(um("mortes", { ...mortes, [campo]: mortes[campo] >= n ? n - 1 : n }))
        }
      />
    ));
  return (
    <section className="fh-pv" data-testid="fh-pv" aria-label="Pontos de vida">
      <div className="fh-pv-campos">
        <div className="fh-campo">
          <span>PV atuais</span>
          <CampoNumero
            testid={`pv-atual-${personagemId}`}
            rotulo="PV atuais"
            valor={ficha.pvAtual}
            desabilitado={!editar}
            className="grande"
            aoMudar={(n) => alterar(um("pvAtual", n))}
          />
        </div>
        <span className="fh-barra">/</span>
        <div className="fh-campo">
          <span>PV máximos</span>
          <CampoNumero
            testid={`pv-max-${personagemId}`}
            rotulo="PV máximos"
            valor={ficha.pvMax}
            desabilitado={!editar}
            className="grande"
            aoMudar={(n) => alterar(um("pvMax", n))}
          />
        </div>
        <div className="fh-campo">
          <span>Temporários</span>
          <CampoNumero
            testid={`pv-temp-${personagemId}`}
            rotulo="PV temporários"
            valor={ficha.pvTemp ?? 0}
            desabilitado={!editar}
            className="grande"
            aoMudar={(n) => alterar(um("pvTemp", n === 0 ? null : n))}
          />
        </div>
      </div>
      <div className="fh-dv" data-testid="fh-dados-de-vida">
        <span className="fh-rotulo">Dados de vida</span>
        {d.dadosDeVida.length === 0 && <small>Sem classe do SRD</small>}
        {d.dadosDeVida.map((dv) => (
          <span key={dv.dado} className="fh-dv-tipo" data-testid={`dv-${dv.dado}`}>
            <button
              type="button"
              className="fh-rolavel"
              disabled={!rolador.podeRolar}
              data-testid={`dv-rolar-${dv.dado}`}
              title={`Rolar 1${dv.dado} + CON (e gastar um dado)`}
              onClick={() => {
                if (dv.restantes <= 0) return;
                rolador.expressao(
                  `1${dv.dado}${d.atributos.con.mod === 0 ? "" : formatarBonus(d.atributos.con.mod).replace("−", "-")}`,
                  `Dado de vida (${dv.dado})`,
                );
                alterar(um(`dadosDeVidaUsados.${dv.dado}`, dv.usados + 1));
              }}
            >
              <Dices size={14} /> {dv.dado}
            </button>
            <span data-testid={`dv-restantes-${dv.dado}`}>
              {dv.restantes}/{dv.total}
            </span>
            {editar && (
              <>
                <button
                  type="button"
                  className="botao-icone pequeno"
                  data-testid={`dv-menos-${dv.dado}`}
                  aria-label={`Gastar um ${dv.dado}`}
                  disabled={dv.restantes <= 0}
                  onClick={() => alterar(um(`dadosDeVidaUsados.${dv.dado}`, dv.usados + 1))}
                >
                  −
                </button>
                <button
                  type="button"
                  className="botao-icone pequeno"
                  data-testid={`dv-mais-${dv.dado}`}
                  aria-label={`Recuperar um ${dv.dado}`}
                  disabled={dv.usados <= 0}
                  onClick={() => alterar(um(`dadosDeVidaUsados.${dv.dado}`, dv.usados - 1 || null))}
                >
                  +
                </button>
              </>
            )}
          </span>
        ))}
      </div>
      <div className="fh-mortes" data-testid="fh-mortes">
        <span className="fh-rotulo">Testes contra a morte</span>
        <span className="fh-marcas">Sucessos {marcas("sucessos")}</span>
        <span className="fh-marcas">Falhas {marcas("falhas")}</span>
        <button
          type="button"
          className="fh-rolavel"
          disabled={!rolador.podeRolar}
          data-testid="morte-rolar"
          title="Rolar um teste contra a morte (CD 10)"
          onClick={() => rolador.teste("Teste contra a morte", 0, 10)}
        >
          <Dices size={14} /> Rolar
        </button>
      </div>
    </section>
  );
}

function descricaoDoAcerto(ficha: Ficha, a: Ataque): string {
  const b = bonusDeAcerto(ficha, a);
  if (b !== undefined) return formatarBonus(b);
  return a.cd === undefined ? "—" : `CD ${a.cd}`;
}

function Ataques({ ficha, alterar, editar, rolador }: PropsDaAba) {
  const ataques = ficha.ataques ?? [];
  return (
    <section className="fh-ataques" data-testid="fh-ataques" aria-label="Ataques">
      <h4>Ataques</h4>
      <div className="fh-tabela-ataques">
        {ataques.map((a, i) => {
          const acerto = a.acerto;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
            <div key={i} className="fh-ataque" data-testid={`ataque-${i}`}>
              <CampoTexto
                testid={`ataque-nome-${i}`}
                rotulo="Nome do ataque"
                valor={a.nome}
                maxLength={80}
                desabilitado={!editar}
                aoMudar={(t) => alterar(um(`ataques.${i}.nome`, t))}
              />
              <button
                type="button"
                className="fh-rolavel"
                data-testid={`ataque-rolar-${i}`}
                disabled={!rolador.podeRolar || (!acerto && !a.dano)}
                title={
                  acerto ? `Rolar o ataque de ${a.nome}` : a.dano ? "Rolar o dano" : "Sem rolagem"
                }
                onClick={() => rolador.ataque(a, ficha)}
              >
                {descricaoDoAcerto(ficha, a)}
              </button>
              <button
                type="button"
                className="fh-rolavel dano"
                data-testid={`ataque-dano-${i}`}
                disabled={!rolador.podeRolar || !a.dano}
                title={a.dano ? `Rolar só o dano (${a.dano})` : "Sem dano"}
                onClick={() => rolador.dano(a)}
              >
                {a.dano || "—"}
              </button>
              <span className="fh-tipo" data-testid={`ataque-tipo-${i}`}>
                {a.tipo ?? ""}
              </span>
              {editar && (
                <button
                  type="button"
                  className="botao-icone pequeno"
                  data-testid={`ataque-remover-${i}`}
                  title="Tirar o ataque"
                  aria-label={`Tirar o ataque ${a.nome}`}
                  onClick={() => alterar(um(`ataques.${i}`, null))}
                >
                  <Trash2 size={14} />
                </button>
              )}
              {editar && (
                <details className="fh-ataque-edicao">
                  <summary title="Editar acerto, dano e tipo">Editar</summary>
                  <div className="fh-grade-3">
                    <div className="fh-campo">
                      <span>Acerto (fixo)</span>
                      <CampoNumero
                        testid={`ataque-acerto-${i}`}
                        rotulo="Bônus de acerto (valor fixo)"
                        valor={acerto?.tipo === "fixo" ? acerto.valor : 0}
                        min={-50}
                        max={50}
                        aoMudar={(n) =>
                          alterar(um(`ataques.${i}.acerto`, { tipo: "fixo", valor: n }))
                        }
                      />
                    </div>
                    <div className="fh-campo">
                      <span>Dano</span>
                      <CampoTexto
                        testid={`ataque-dano-editar-${i}`}
                        rotulo="Dano (1d8+3)"
                        valor={a.dano ?? ""}
                        maxLength={100}
                        aoMudar={(t) => alterar(um(`ataques.${i}.dano`, t === "" ? null : t))}
                      />
                    </div>
                    <div className="fh-campo">
                      <span>Tipo</span>
                      <CampoTexto
                        testid={`ataque-tipo-editar-${i}`}
                        rotulo="Tipo de dano"
                        valor={a.tipo ?? ""}
                        maxLength={32}
                        aoMudar={(t) => alterar(um(`ataques.${i}.tipo`, t === "" ? null : t))}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`ataque-sem-acerto-${i}`}
                    disabled={!acerto}
                    onClick={() => alterar(um(`ataques.${i}.acerto`, null))}
                  >
                    Sem rolagem de acerto
                  </button>
                </details>
              )}
            </div>
          );
        })}
        {ataques.length === 0 && <p className="nota">Nenhum ataque.</p>}
      </div>
      {editar && (
        <button
          type="button"
          data-testid="ataque-adicionar"
          onClick={() =>
            alterar(
              um("ataques", [
                ...ataques,
                { nome: "Novo ataque", acerto: { tipo: "fixo", valor: 0 }, dano: "1d6" },
              ]),
            )
          }
        >
          <Plus size={14} /> Ataque
        </button>
      )}
    </section>
  );
}

/** Condições, exaustão e concentração do token do personagem na cena ativa (só leitura; o menu do token as muda). */
function Condicoes({ token }: PropsDaAba) {
  const icones = token ? iconesDoToken(token) : [];
  return (
    <section className="fh-condicoes" data-testid="fh-condicoes" aria-label="Condições">
      <h4>Condições</h4>
      {!token ? (
        <p className="nota" data-testid="fh-condicoes-sem-token">
          Sem token na cena atual.
        </p>
      ) : icones.length === 0 ? (
        <p className="nota" data-testid="fh-condicoes-nenhuma">
          Nenhuma condição.
        </p>
      ) : (
        <ul className="fh-condicoes-lista">
          {icones.map((i) => (
            <li
              key={i.chave}
              className="fh-condicao"
              data-testid={`fh-condicao-${i.chave}`}
              title={i.resumo}
            >
              <span className="fh-condicao-sigla" style={{ background: i.cor }} aria-hidden>
                {i.sigla}
              </span>
              <span className="fh-condicao-texto">{i.titulo}</span>
            </li>
          ))}
        </ul>
      )}
      {token && (
        <p className="nota">
          Passe o mouse para ler a regra. Para mudar: botão direito no token do mapa,{" "}
          <em>Condições</em>.
        </p>
      )}
    </section>
  );
}

/** Aba Principal: atributos, salvaguardas e perícias à esquerda; o resto à direita. */
export function AbaPrincipal(props: PropsDaAba) {
  return (
    <div className="fh-principal" data-testid="fh-aba-principal">
      <div className="fh-esquerda">
        <Atributos {...props} />
        <div className="fh-listas">
          <Salvaguardas {...props} />
          <Pericias {...props} />
        </div>
      </div>
      <div className="fh-direita">
        <Identidade {...props} />
        <Resumo {...props} />
        <PontosDeVida {...props} />
        <Condicoes {...props} />
        <Ataques {...props} />
      </div>
    </div>
  );
}
