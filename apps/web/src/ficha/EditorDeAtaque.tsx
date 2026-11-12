import {
  type Acerto,
  ATRIBUTOS,
  type Ataque,
  type Atributo,
  bonusDeAcerto,
  cdDaRolagem,
  type Magia,
  normalizarBusca,
  previaDoAtaque,
  ROTULO_DO_ATRIBUTO,
} from "@tabletop/shared";
import { ArrowLeft, Dices } from "lucide-react";
import type { ReactNode } from "react";
import type { PropsDaAba } from "./AbaPrincipal";
import { CampoNumero, CampoTexto } from "./campos";
import { Caixa, Secao } from "./livro";

/** O que o editor da engrenagem está editando: uma linha de Ataques ou uma magia. */
export type AlvoDoEditor = { tipo: "ataque" | "magia"; i: number };

export const TIPOS_DE_DANO = [
  "Contundente",
  "Cortante",
  "Perfurante",
  "Ácido",
  "Elétrico",
  "Fogo",
  "Frio",
  "Força",
  "Necrótico",
  "Psíquico",
  "Radiante",
  "Trovejante",
  "Veneno",
  "Cura",
] as const;

const um = (caminho: string, valor: unknown) => [{ caminho, valor }];

/** Um campo do editor: o rótulo em cima, o controle embaixo. */
function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="fl-edf">
      <span className="fl-lbl">{rotulo}</span>
      {children}
    </div>
  );
}

function Marca({
  testid,
  rotulo,
  marcado,
  desabilitado,
  aoMudar,
}: {
  testid: string;
  rotulo: string;
  marcado: boolean;
  desabilitado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="fl-marca">
      <input
        type="checkbox"
        className="fl-chk"
        data-testid={testid}
        checked={marcado}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.checked)}
      />
      {rotulo}
    </label>
  );
}

function SeletorDeAtributo({
  testid,
  valor,
  comNenhum,
  comFixo,
  desabilitado,
  aoMudar,
  rotulo,
}: {
  testid: string;
  valor: string;
  comNenhum?: boolean;
  comFixo?: boolean;
  desabilitado: boolean;
  aoMudar: (v: string) => void;
  rotulo: string;
}) {
  return (
    <select
      className="fl-fld"
      data-testid={testid}
      aria-label={rotulo}
      value={valor}
      disabled={desabilitado}
      onChange={(e) => aoMudar(e.target.value)}
    >
      {comNenhum && <option value="nenhum">Nenhum</option>}
      {ATRIBUTOS.map((a) => (
        <option key={a} value={a}>
          {ROTULO_DO_ATRIBUTO[a]}
        </option>
      ))}
      {comFixo && <option value="fixo">Valor fixo</option>}
    </select>
  );
}

/**
 * O editor da engrenagem (V4a): "vira a página" sobre as colunas do meio e da direita. Serve a um ataque
 * (`ficha.ataques`) e a uma magia (`ficha.magias`) do mesmo jeito, e mostra a prévia ao vivo do que será rolado.
 */
export function EditorDeAtaque({
  alvo,
  origem,
  props,
  aoVoltar,
}: {
  alvo: AlvoDoEditor;
  /** De onde o editor foi aberto: a magia aberta em Ataques e magias só sai da lista; em Magias, é removida. */
  origem: "principal" | "magias";
  props: PropsDaAba;
  aoVoltar: () => void;
}) {
  const { ficha, alterar, editar, rolador, enviar, personagemId, compendio } = props;
  const ehMagia = alvo.tipo === "magia";
  const raiz = `${ehMagia ? "magias" : "ataques"}.${alvo.i}`;
  const r: Ataque | Magia | undefined = ehMagia ? ficha.magias?.[alvo.i] : ficha.ataques?.[alvo.i];
  if (!r) {
    return (
      <Caixa moldura className="fl-editor" testid="editor-ataque">
        <p className="fl-dica">Este item não existe mais.</p>
        <button type="button" className="fl-pill" onClick={aoVoltar}>
          <ArrowLeft size={16} aria-hidden /> Voltar
        </button>
      </Caixa>
    );
  }
  const magia = ehMagia ? (r as Magia) : undefined;
  const sem = !editar;
  const grava = (campo: string, valor: unknown) => alterar(um(`${raiz}.${campo}`, valor));
  const texto = (campo: string) => (t: string) => grava(campo, t === "" ? null : t);
  const numero = (campo: string) => (n: number) => grava(campo, n === 0 ? null : n);

  const acerto = r.acerto;
  const atrDoAcerto = acerto ? (acerto.tipo === "fixo" ? "fixo" : acerto.atributo) : "for";
  const trocarAtributoDoAcerto = (v: string) => {
    if (v === "fixo") {
      grava("acerto", {
        tipo: "fixo",
        valor: Math.max(-50, Math.min(50, (bonusDeAcerto(ficha, r) ?? 0) - (r.bonusMagico ?? 0))),
      } satisfies Acerto);
    } else {
      grava("acerto", {
        tipo: "formula",
        atributo: v as Atributo,
        proficiente: acerto?.tipo === "formula" ? acerto.proficiente : true,
        ...(acerto?.tipo === "formula" && acerto.bonus ? { bonus: acerto.bonus } : {}),
      } satisfies Acerto);
    }
  };
  const d2 = r.dano2;
  const salv = r.salvaguarda;
  const previa = previaDoAtaque(ficha, r);
  const semPrevia = !previa.acerto && !previa.dano && !previa.salvaguarda;
  const tiposDeDano: string[] = [...TIPOS_DE_DANO];
  for (const t of [r.tipo, d2?.tipo]) {
    if (t && !tiposDeDano.some((x) => normalizarBusca(x) === normalizarBusca(t)))
      tiposDeDano.push(t);
  }
  const opcoesDeTipo = () => (
    <>
      <option value="">—</option>
      {tiposDeDano.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </>
  );
  const atualizarObj = <T extends object>(campo: string, atual: T, parcial: Partial<T>) =>
    grava(campo, { ...atual, ...parcial });

  const cd = cdDaRolagem(ficha, r);
  const nivelTxt = magia ? (magia.nivel === 0 ? "Truque" : `${magia.nivel}º nível`) : "";
  const podeRolar = rolador.podeRolar && Boolean(previa.acerto || previa.dano);

  function mandarAoChat() {
    if (!editar || !r) return;
    const doCompendio =
      magia && compendio
        ? compendio.magias.find((m) => normalizarBusca(m.nome) === normalizarBusca(magia.nome))
        : undefined;
    if (doCompendio) {
      enviar("chat.magia", { magia: doCompendio, como: personagemId });
      return;
    }
    const resumo = [previa.acerto, previa.dano, previa.salvaguarda, r.alcance]
      .filter(Boolean)
      .join(" · ");
    const descricao = [resumo, (magia ? magia.descricao : (r as Ataque).descricao) ?? ""]
      .filter((t) => t.trim() !== "")
      .join("\n\n");
    enviar("chat.caracteristica", {
      caracteristica: {
        nome: r.nome.trim().slice(0, 80),
        descricao: descricao.slice(0, 12_000),
        origem: magia ? `Magia · ${nivelTxt}` : "Ataque",
      },
      como: personagemId,
    });
  }

  function remover() {
    if (!editar) return;
    if (magia && origem === "principal") grava("emAtaques", null);
    else alterar(um(raiz, null));
    aoVoltar();
  }

  return (
    <Caixa moldura className="fl-editor" testid="editor-ataque" rotulo={`Editar ${r.nome}`}>
      <div className="fl-editor-topo">
        <button
          type="button"
          className="fl-pill"
          data-testid="editor-voltar"
          aria-label="Voltar para a ficha"
          onClick={aoVoltar}
        >
          <ArrowLeft size={16} aria-hidden /> Voltar
        </button>
        <h2 className="fl-fh fl-editor-nome">{r.nome}</h2>
      </div>

      <div className="fl-ed4 fl-ed-ident">
        <Campo rotulo="Nome">
          <CampoTexto
            testid="editor-nome"
            rotulo="Nome"
            valor={r.nome}
            maxLength={80}
            desabilitado={sem}
            className="fl-fld"
            aoMudar={(t) => (t.trim() === "" ? false : grava("nome", t))}
          />
        </Campo>
        <Campo rotulo="Alcance">
          <CampoTexto
            testid="editor-alcance"
            rotulo="Alcance"
            valor={r.alcance ?? ""}
            maxLength={100}
            desabilitado={sem}
            className="fl-fld"
            aoMudar={texto("alcance")}
          />
        </Campo>
      </div>

      <div className="fl-ed-bloco">
        <Secao>Ataque</Secao>
        <Marca
          testid="editor-usa-acerto"
          rotulo="Tem jogada de ataque"
          marcado={acerto !== undefined}
          desabilitado={sem}
          aoMudar={(v) =>
            grava(
              "acerto",
              v ? ({ tipo: "formula", atributo: "for", proficiente: true } satisfies Acerto) : null,
            )
          }
        />
        {acerto && (
          <>
            <div className="fl-ed4">
              <Campo rotulo="Atributo">
                <SeletorDeAtributo
                  testid="editor-acerto-atributo"
                  rotulo="Atributo do acerto"
                  valor={atrDoAcerto}
                  comFixo
                  desabilitado={sem}
                  aoMudar={trocarAtributoDoAcerto}
                />
              </Campo>
              {acerto.tipo === "fixo" ? (
                <Campo rotulo="Valor fixo">
                  <CampoNumero
                    testid="editor-acerto-fixo"
                    rotulo="Bônus de acerto (valor fixo)"
                    valor={acerto.valor}
                    min={-50}
                    max={50}
                    desabilitado={sem}
                    className="fl-fld"
                    aoMudar={(n) => grava("acerto", { tipo: "fixo", valor: n })}
                  />
                </Campo>
              ) : (
                <Campo rotulo="Bônus extra">
                  <CampoNumero
                    testid="editor-acerto-extra"
                    rotulo="Bônus extra no acerto"
                    valor={acerto.bonus ?? 0}
                    min={-50}
                    max={50}
                    desabilitado={sem}
                    className="fl-fld"
                    aoMudar={(n) => {
                      const { bonus: _tira, ...resto } = acerto;
                      grava("acerto", n === 0 ? resto : { ...resto, bonus: n });
                    }}
                  />
                </Campo>
              )}
              <Campo rotulo="Bônus mágico">
                <CampoNumero
                  testid="editor-magico"
                  rotulo="Bônus mágico"
                  valor={r.bonusMagico ?? 0}
                  min={-50}
                  max={50}
                  desabilitado={sem}
                  className="fl-fld"
                  aoMudar={numero("bonusMagico")}
                />
              </Campo>
              <Campo rotulo="Margem de crítico">
                <select
                  className="fl-fld"
                  data-testid="editor-critico"
                  aria-label="Margem de crítico"
                  value={String(r.margemCritico ?? 20)}
                  disabled={sem}
                  onChange={(e) =>
                    grava(
                      "margemCritico",
                      Number(e.target.value) === 20 ? null : Number(e.target.value),
                    )
                  }
                >
                  <option value="20">20</option>
                  <option value="19">19–20</option>
                  <option value="18">18–20</option>
                </select>
              </Campo>
            </div>
            {acerto.tipo === "formula" && (
              <Marca
                testid="editor-proficiente"
                rotulo="Proficiente"
                marcado={acerto.proficiente}
                desabilitado={sem}
                aoMudar={(v) => grava("acerto", { ...acerto, proficiente: v })}
              />
            )}
            <span className="fl-dica">O bônus mágico vale para o acerto e para o dano.</span>
          </>
        )}
      </div>

      <div className="fl-ed-bloco">
        <Secao>Dano</Secao>
        <div className="fl-ed4">
          <Campo rotulo="Dados">
            <CampoTexto
              testid="editor-dano-dados"
              rotulo="Dados do dano"
              valor={r.dano ?? ""}
              maxLength={100}
              desabilitado={sem}
              className="fl-fld"
              aoMudar={texto("dano")}
            />
          </Campo>
          <Campo rotulo="Atributo">
            <SeletorDeAtributo
              testid="editor-dano-atributo"
              rotulo="Atributo do dano"
              valor={r.atributoDano ?? "nenhum"}
              comNenhum
              desabilitado={sem}
              aoMudar={(v) => grava("atributoDano", v === "nenhum" ? null : v)}
            />
          </Campo>
          <Campo rotulo="Bônus">
            <CampoNumero
              testid="editor-dano-bonus"
              rotulo="Bônus do dano"
              valor={r.bonusDano ?? 0}
              min={-50}
              max={50}
              desabilitado={sem}
              className="fl-fld"
              aoMudar={numero("bonusDano")}
            />
          </Campo>
          <Campo rotulo="Tipo">
            <select
              className="fl-fld"
              data-testid="editor-dano-tipo"
              aria-label="Tipo do dano"
              value={r.tipo ?? ""}
              disabled={sem}
              onChange={(e) => grava("tipo", e.target.value === "" ? null : e.target.value)}
            >
              {opcoesDeTipo()}
            </select>
          </Campo>
          <Campo rotulo="Extra no crítico">
            <CampoTexto
              testid="editor-dano-critico"
              rotulo="Dados extras no crítico"
              valor={r.danoCritico ?? ""}
              maxLength={60}
              desabilitado={sem}
              className="fl-fld"
              aoMudar={texto("danoCritico")}
            />
          </Campo>
        </div>
        <div className="fl-ed-sep">
          <Marca
            testid="editor-usa-dano2"
            rotulo="Usar um segundo dano"
            marcado={d2 !== undefined}
            desabilitado={sem}
            aoMudar={(v) => grava("dano2", v ? { dados: "1d6", tipo: "Fogo" } : null)}
          />
        </div>
        {d2 && (
          <div className="fl-ed4">
            <Campo rotulo="Dados">
              <CampoTexto
                testid="editor-dano2-dados"
                rotulo="Dados do segundo dano"
                valor={d2.dados}
                maxLength={100}
                desabilitado={sem}
                className="fl-fld"
                aoMudar={(t) => atualizarObj("dano2", d2, { dados: t })}
              />
            </Campo>
            <Campo rotulo="Atributo">
              <SeletorDeAtributo
                testid="editor-dano2-atributo"
                rotulo="Atributo do segundo dano"
                valor={d2.atributo ?? "nenhum"}
                comNenhum
                desabilitado={sem}
                aoMudar={(v) => {
                  const { atributo: _tira, ...resto } = d2;
                  grava("dano2", v === "nenhum" ? resto : { ...resto, atributo: v });
                }}
              />
            </Campo>
            <Campo rotulo="Bônus">
              <CampoNumero
                testid="editor-dano2-bonus"
                rotulo="Bônus do segundo dano"
                valor={d2.bonus ?? 0}
                min={-50}
                max={50}
                desabilitado={sem}
                className="fl-fld"
                aoMudar={(n) => {
                  const { bonus: _tira, ...resto } = d2;
                  grava("dano2", n === 0 ? resto : { ...resto, bonus: n });
                }}
              />
            </Campo>
            <Campo rotulo="Tipo">
              <select
                className="fl-fld"
                data-testid="editor-dano2-tipo"
                aria-label="Tipo do segundo dano"
                value={d2.tipo ?? ""}
                disabled={sem}
                onChange={(e) => {
                  const { tipo: _tira, ...resto } = d2;
                  grava(
                    "dano2",
                    e.target.value === "" ? resto : { ...resto, tipo: e.target.value },
                  );
                }}
              >
                {opcoesDeTipo()}
              </select>
            </Campo>
          </div>
        )}
      </div>

      <div className="fl-ed-bloco">
        <Secao>Salvaguarda</Secao>
        <Marca
          testid="editor-usa-salvaguarda"
          rotulo="Exige salvaguarda"
          marcado={salv !== undefined}
          desabilitado={sem}
          aoMudar={(v) =>
            grava("salvaguarda", v ? { alvo: "des", cdAtributo: "sab", sucesso: "metade" } : null)
          }
        />
        {salv && (
          <div className="fl-ed4">
            <Campo rotulo="Teste do alvo">
              <SeletorDeAtributo
                testid="editor-salv-alvo"
                rotulo="Teste do alvo"
                valor={salv.alvo}
                desabilitado={sem}
                aoMudar={(v) => atualizarObj("salvaguarda", salv, { alvo: v as Atributo })}
              />
            </Campo>
            <Campo rotulo="CD usa">
              <SeletorDeAtributo
                testid="editor-salv-cd-atributo"
                rotulo="Atributo da CD"
                valor={salv.cdAtributo}
                desabilitado={sem}
                aoMudar={(v) => atualizarObj("salvaguarda", salv, { cdAtributo: v as Atributo })}
              />
            </Campo>
            <Campo rotulo="Bônus na CD">
              <CampoNumero
                testid="editor-salv-cd-bonus"
                rotulo="Bônus na CD"
                valor={salv.cdBonus ?? 0}
                min={-50}
                max={50}
                desabilitado={sem}
                className="fl-fld"
                aoMudar={(n) => {
                  const { cdBonus: _tira, ...resto } = salv;
                  grava("salvaguarda", n === 0 ? resto : { ...resto, cdBonus: n });
                }}
              />
            </Campo>
            <div className="fl-edf">
              <span className="fl-lbl">CD</span>
              <span className="fl-fa fl-cd-valor" data-testid="editor-cd">
                {cd}
              </span>
            </div>
            <Campo rotulo="Efeito no sucesso">
              <select
                className="fl-fld"
                data-testid="editor-salv-sucesso"
                aria-label="Efeito no sucesso"
                value={salv.sucesso}
                disabled={sem}
                onChange={(e) =>
                  atualizarObj("salvaguarda", salv, {
                    sucesso: e.target.value === "nenhum" ? "nenhum" : "metade",
                  })
                }
              >
                <option value="metade">Metade do dano</option>
                <option value="nenhum">Nada</option>
              </select>
            </Campo>
          </div>
        )}
      </div>

      {magia && (
        <div className="fl-ed-bloco">
          <Secao>Preparo</Secao>
          <div className="fl-ed-linha">
            {magia.nivel > 0 && (
              <Marca
                testid="editor-preparada"
                rotulo="Preparada"
                marcado={magia.preparada}
                desabilitado={sem}
                aoMudar={(v) => grava("preparada", v)}
              />
            )}
            <Marca
              testid="editor-em-ataques"
              rotulo="Mostrar em Ataques e magias"
              marcado={magia.emAtaques === true}
              desabilitado={sem}
              aoMudar={(v) => grava("emAtaques", v ? true : null)}
            />
            <span className="fl-lbl fl-ed-nivel">{nivelTxt}</span>
          </div>
        </div>
      )}

      <div className="fl-ed-bloco">
        <Secao>Descrição</Secao>
        <CampoTexto
          testid="editor-descricao"
          rotulo="Descrição"
          valor={(magia ? magia.descricao : (r as Ataque).descricao) ?? ""}
          maxLength={20_000}
          multilinha
          crescente
          desabilitado={sem}
          className="fl-fld fl-ed-desc"
          aoMudar={(t) => (magia ? grava("descricao", t) : grava("descricao", t === "" ? null : t))}
        />
      </div>

      <div className="fl-previa" aria-live="polite" data-testid="editor-previa">
        <span className="fl-lbl">Prévia ao vivo</span>
        <span className="fl-previa-texto">
          {previa.acerto && <b data-testid="previa-acerto">{previa.acerto}</b>}
          {previa.dano && (
            <span data-testid="previa-dano">
              {previa.acerto ? " · " : ""}
              {previa.dano}
              {previa.critico ? `; ${previa.critico}` : ""}
            </span>
          )}
          {previa.salvaguarda && (
            <span data-testid="previa-salvaguarda">
              {previa.acerto || previa.dano ? " · " : ""}
              {previa.salvaguarda}
            </span>
          )}
          {semPrevia && (
            <i className="fl-dica">Sem rolagem configurada: só manda o texto ao chat.</i>
          )}
        </span>
      </div>

      <div className="fl-ed-acoes">
        <button
          type="button"
          className="fl-pri"
          data-testid="editor-rolar"
          disabled={!podeRolar}
          onClick={() => rolador.ataque(r, ficha)}
        >
          <Dices size={16} aria-hidden /> Rolar
        </button>
        <button
          type="button"
          className="fl-sec2"
          data-testid="editor-mandar"
          disabled={!editar}
          onClick={mandarAoChat}
        >
          Mandar ao chat
        </button>
        <button
          type="button"
          className="fl-sec2 fl-perigo"
          data-testid="editor-remover"
          disabled={!editar}
          onClick={remover}
        >
          {magia ? (origem === "principal" ? "Tirar da lista" : "Remover magia") : "Remover ataque"}
        </button>
      </div>
    </Caixa>
  );
}
