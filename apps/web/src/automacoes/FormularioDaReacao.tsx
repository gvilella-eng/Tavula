import { type Acao, type CondicaoDeReacao, type Reacao, ReacaoSchema } from "@tabletop/shared";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CampoDecimal, CampoDeDistancia } from "../Campo";
import { CampoDeEvento, CampoDeTexto, ErroDoCampo, EscolhaDeCenas, Marcador } from "./campos";
import { EditorDaPeca } from "./Editor";
import { erroDoCampo, errosEmPortugues } from "./erros";
import {
  acaoPadrao,
  condicaoPadrao,
  definir,
  idDoNome,
  ler,
  ROTULO_DA_ACAO,
  ROTULO_DA_CONDICAO,
  ROTULO_DA_FICA,
  TIPOS_DE_ACAO,
  TIPOS_DE_CONDICAO,
} from "./rascunho";

type Opcao = { id: string; nome: string };

type Props = {
  /** A reação a editar; `null` cria uma nova. */
  inicial: Reacao | null;
  /** Onde a reação nova nasce (o grupo onde se apertou "Nova reação"). */
  ficaPadrao?: Reacao["fica"];
  modelos: readonly Opcao[];
  cenas: readonly Opcao[];
  zonas: readonly Opcao[];
  idsUsados: ReadonlySet<string>;
  eventos: readonly string[];
  aoSalvar: (reacao: Reacao, nova: boolean) => void;
  aoCancelar: () => void;
};

type Caminho = ReadonlyArray<string | number>;

const idDoJson = (v: unknown) => String(ler(v, ["id"]) ?? "");

/**
 * O formulário de uma reação: "ao receber o evento X, se as condições valem, faça estas ações". O evento, as condições
 * e as ações vêm de listas fechadas; cada ação tem os campos dela, em português, e a unidade (metros ou pés) segue a
 * preferência nos campos de distância.
 */
export function FormularioDaReacao(p: Props) {
  const ehNova = p.inicial === null;
  const [rascunho, setRascunho] = useState<unknown>(
    p.inicial ?? {
      id: "",
      ativa: true,
      fica: p.ficaPadrao ?? { tipo: "mesa" },
      ao: "",
      se: [],
      fazer: [acaoPadrao("chat.anunciar")],
    },
  );
  const [idManual, setIdManual] = useState(false);
  const nome = String(ler(rascunho, ["nome"]) ?? "");
  const idAutomatico = idDoNome(nome, p.idsUsados, "reacao");
  const comId = useMemo(
    () => (ehNova && !idManual ? definir(rascunho, ["id"], idAutomatico) : rascunho),
    [rascunho, ehNova, idManual, idAutomatico],
  );
  const idMostrado = idDoJson(comId);

  const resultado = ReacaoSchema.safeParse(comId);
  const erros = resultado.success ? [] : errosEmPortugues(resultado.error);
  const mudar = (caminho: Caminho, valor: unknown) => setRascunho(definir(comId, caminho, valor));
  const fica = (ler(comId, ["fica"]) as { tipo?: string; id?: string } | undefined) ?? {};
  const se = (ler(comId, ["se"]) as unknown[] | undefined) ?? [];
  const fazer = (ler(comId, ["fazer"]) as unknown[] | undefined) ?? [];

  function trocarFica(tipo: Reacao["fica"]["tipo"]) {
    const lista =
      tipo === "modelo" ? p.modelos : tipo === "cena" ? p.cenas : tipo === "zona" ? p.zonas : [];
    mudar(["fica"], tipo === "mesa" ? { tipo } : { tipo, id: lista[0]?.id ?? "" });
  }
  const listaDaFica = fica.tipo === "modelo" ? p.modelos : fica.tipo === "cena" ? p.cenas : p.zonas;

  return (
    <EditorDaPeca
      testid="form-reacao"
      titulo={ehNova ? "Nova reação" : "Editar reação"}
      rascunho={comId}
      aoMudarRascunho={(v) => {
        if (idDoJson(v) !== idMostrado) setIdManual(true);
        setRascunho(v);
      }}
      erros={erros}
      aoSalvar={() => resultado.success && p.aoSalvar(resultado.data, ehNova)}
      aoCancelar={p.aoCancelar}
    >
      {(mostrar) => {
        const e = (caminho: string) => (mostrar ? erroDoCampo(erros, caminho) : undefined);
        return (
          <>
            <CampoDeTexto
              testid="form-reacao-nome"
              rotulo="Nome (opcional)"
              valor={nome}
              maxLength={64}
              placeholder="Ex.: A tocha treme na inspiração"
              aoMudar={(v) => mudar(["nome"], v === "" ? undefined : v)}
              erro={e("nome")}
            />
            <Marcador
              testid="form-reacao-ativa"
              rotulo="Ligada"
              marcado={ler(comId, ["ativa"]) !== false}
              aoMudar={(v) => mudar(["ativa"], v)}
            />
            <fieldset className="quem-controla">
              <legend>Onde ela fica</legend>
              <label className="campo-coluna">
                A reação pertence a
                <select
                  data-testid="form-reacao-fica"
                  value={fica.tipo ?? "mesa"}
                  onChange={(ev) => trocarFica(ev.target.value as Reacao["fica"]["tipo"])}
                >
                  {(Object.keys(ROTULO_DA_FICA) as Reacao["fica"]["tipo"][]).map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_DA_FICA[t]}
                    </option>
                  ))}
                </select>
              </label>
              {fica.tipo !== undefined && fica.tipo !== "mesa" && (
                <label className="campo-coluna">
                  {fica.tipo === "modelo"
                    ? "Qual modelo"
                    : fica.tipo === "cena"
                      ? "Qual cena"
                      : "Qual zona"}
                  <select
                    data-testid="form-reacao-fica-id"
                    value={fica.id ?? ""}
                    aria-invalid={e("fica.id") !== undefined}
                    onChange={(ev) => mudar(["fica", "id"], ev.target.value)}
                  >
                    {listaDaFica.length === 0 && <option value="">Nenhum cadastrado</option>}
                    {listaDaFica.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                  <ErroDoCampo erro={e("fica.id")} testid="form-reacao-fica-id" />
                </label>
              )}
              {fica.tipo === "modelo" && (
                <p className="nota">Toda luz criada deste modelo já herda a reação.</p>
              )}
            </fieldset>
            <CampoDeEvento
              testid="form-reacao-ao"
              rotulo="Ao receber o evento"
              valor={String(ler(comId, ["ao"]) ?? "")}
              sugestoes={p.eventos}
              aoMudar={(v) => mudar(["ao"], v)}
              erro={e("ao")}
            />
            <fieldset className="quem-controla" data-testid="form-reacao-se">
              <legend>Se (todas precisam valer)</legend>
              {se.length === 0 && <p className="nota">Sem condição: sempre que o evento chegar.</p>}
              {se.map((_, i) => (
                <LinhaDeCondicao
                  // biome-ignore lint/suspicious/noArrayIndexKey: a condição não tem id; a posição é a identidade na lista
                  key={i}
                  i={i}
                  condicao={(ler(comId, ["se", i]) ?? {}) as Partial<CondicaoDeReacao>}
                  cenas={p.cenas}
                  zonas={p.zonas}
                  mudar={mudar}
                  e={e}
                />
              ))}
              <label className="campo-coluna">
                <span className="so-leitor">Adicionar condição</span>
                <select
                  data-testid="form-reacao-add-se"
                  value=""
                  onChange={(ev) => {
                    if (ev.target.value !== "") {
                      mudar(
                        ["se", se.length],
                        condicaoPadrao(ev.target.value as CondicaoDeReacao["condicao"]),
                      );
                    }
                  }}
                >
                  <option value="">+ Adicionar condição…</option>
                  {TIPOS_DE_CONDICAO.map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_DA_CONDICAO[t]}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <fieldset className="quem-controla" data-testid="form-reacao-fazer">
              <legend>Faça</legend>
              {fazer.map((_, i) => (
                <LinhaDeAcao
                  // biome-ignore lint/suspicious/noArrayIndexKey: a ação não tem id; a posição é a identidade na lista
                  key={i}
                  i={i}
                  acao={(ler(comId, ["fazer", i]) ?? {}) as Partial<Acao>}
                  modelos={p.modelos}
                  zonas={p.zonas}
                  eventos={p.eventos}
                  podeTirar={fazer.length > 1}
                  mudar={mudar}
                  e={e}
                />
              ))}
              {e("fazer") !== undefined && (
                <p className="erro-do-campo" role="alert">
                  {e("fazer")}
                </p>
              )}
              <label className="campo-coluna">
                <span className="so-leitor">Adicionar ação</span>
                <select
                  data-testid="form-reacao-add-acao"
                  value=""
                  onChange={(ev) => {
                    if (ev.target.value !== "") {
                      mudar(["fazer", fazer.length], acaoPadrao(ev.target.value as Acao["acao"]));
                    }
                  }}
                >
                  <option value="">+ Adicionar ação…</option>
                  {TIPOS_DE_ACAO.map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_DA_ACAO[t]}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </>
        );
      }}
    </EditorDaPeca>
  );
}

type Erro = (caminho: string) => string | undefined;

/** Os campos de chance mostram % na tela (o schema guarda de 0 a 1): o erro fala na unidade da tela. */
const PORCENTAGEM_INVALIDA = "precisa estar entre 0 e 100.";

function LinhaDeCondicao(p: {
  i: number;
  condicao: Partial<CondicaoDeReacao>;
  cenas: readonly Opcao[];
  zonas: readonly Opcao[];
  mudar: (caminho: Caminho, valor: unknown) => void;
  e: Erro;
}) {
  const { i, condicao: c } = p;
  const base = ["se", i] as const;
  return (
    <div className="linha-da-peca" data-testid={`form-condicao-${i}`}>
      <div className="linha-da-peca-topo">
        <label className="campo-coluna">
          <span className="so-leitor">Tipo da condição {i + 1}</span>
          <select
            data-testid={`form-condicao-${i}-tipo`}
            value={c.condicao ?? "chance"}
            onChange={(ev) =>
              p.mudar(base, condicaoPadrao(ev.target.value as CondicaoDeReacao["condicao"]))
            }
          >
            {TIPOS_DE_CONDICAO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_DA_CONDICAO[t]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid={`form-condicao-${i}-tirar`}
          aria-label={`Tirar a condição ${i + 1}`}
          onClick={() => p.mudar(base, undefined)}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {c.condicao === "chance" && (
        <CampoDecimal
          testid={`form-condicao-${i}-valor`}
          rotulo="Chance (%)"
          valor={c.valor === undefined ? undefined : c.valor * 100}
          aoConfirmar={(v) => p.mudar([...base, "valor"], v === null ? undefined : v / 100)}
          erro={p.e(`se.${i}.valor`) === undefined ? undefined : PORCENTAGEM_INVALIDA}
        />
      )}
      {c.condicao === "tag" && (
        <CampoDeTexto
          testid={`form-condicao-${i}-tag`}
          rotulo="Tag do modelo"
          valor={c.tag ?? ""}
          maxLength={32}
          placeholder="Ex.: chama"
          aoMudar={(v) => p.mudar([...base, "tag"], v)}
          erro={p.e(`se.${i}.tag`)}
        />
      )}
      {c.condicao === "cena" && (
        <div>
          <EscolhaDeCenas
            testid={`form-condicao-${i}-cenas`}
            cenas={p.cenas}
            valor={c.cenas ?? []}
            aoMudar={(ids) => p.mudar([...base, "cenas"], ids)}
          />
          <ErroDoCampo erro={p.e(`se.${i}.cenas`)} testid={`form-condicao-${i}-cenas`} />
        </div>
      )}
      {c.condicao === "dentroDaZona" && (
        <label className="campo-coluna">
          Zona
          <select
            data-testid={`form-condicao-${i}-zona`}
            value={c.zona ?? ""}
            onChange={(ev) =>
              p.mudar([...base, "zona"], ev.target.value === "" ? undefined : ev.target.value)
            }
          >
            <option value="">A zona desta reação</option>
            {p.zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nome}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function LinhaDeAcao(p: {
  i: number;
  acao: Partial<Acao> & Record<string, unknown>;
  modelos: readonly Opcao[];
  zonas: readonly Opcao[];
  eventos: readonly string[];
  podeTirar: boolean;
  mudar: (caminho: Caminho, valor: unknown) => void;
  e: Erro;
}) {
  const { i, acao: a } = p;
  const base = ["fazer", i] as const;
  const tipo = a.acao;
  const campo = (chave: string, valor: unknown) => p.mudar([...base, chave], valor);
  const err = (chave: string) => p.e(`fazer.${i}.${chave}`);
  const temAlvoDeObjeto =
    tipo === "luz.modificar" || tipo === "objeto.apagar" || tipo === "objeto.ajustarTempo";
  const alvo = (a.alvo ?? {}) as { modeloId?: string; tag?: string };
  function mudarAlvo(chave: "modeloId" | "tag", valor: string) {
    const novo = { ...alvo, [chave]: valor === "" ? undefined : valor };
    const vazio = novo.modeloId === undefined && novo.tag === undefined;
    campo(
      "alvo",
      vazio
        ? undefined
        : Object.fromEntries(Object.entries(novo).filter(([, v]) => v !== undefined)),
    );
  }
  const porS = (
    <CampoDecimal
      testid={`form-acao-${i}-por`}
      rotulo="Por quantos segundos"
      placeholder="o da fase"
      dica="Vazio: vale a duração da fase do ciclo (ou 30 s)."
      valor={a.porS as number | undefined}
      aoConfirmar={(v) => campo("porS", v ?? undefined)}
      erro={err("porS")}
    />
  );
  return (
    <div className="linha-da-peca" data-testid={`form-acao-${i}`}>
      <div className="linha-da-peca-topo">
        <label className="campo-coluna">
          <span className="so-leitor">Tipo da ação {i + 1}</span>
          <select
            data-testid={`form-acao-${i}-tipo`}
            value={tipo ?? "chat.anunciar"}
            aria-invalid={err("acao") !== undefined}
            onChange={(ev) => p.mudar(base, acaoPadrao(ev.target.value as Acao["acao"]))}
          >
            {TIPOS_DE_ACAO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_DA_ACAO[t]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid={`form-acao-${i}-tirar`}
          aria-label={`Tirar a ação ${i + 1}`}
          disabled={!p.podeTirar}
          onClick={() => p.mudar(base, undefined)}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {tipo === "luz.modificar" && (
        <>
          <CampoDecimal
            testid={`form-acao-${i}-raioX`}
            rotulo="Raio × fator (0,5 = metade)"
            placeholder="sem fator"
            valor={a.raioX as number | undefined}
            aoConfirmar={(v) => campo("raioX", v ?? undefined)}
            erro={err("raioX")}
          />
          <CampoDeDistancia
            testid={`form-acao-${i}-raioSomaM`}
            rotulo="Soma ao raio"
            nota="negativo diminui"
            valorM={a.raioSomaM as number | undefined}
            minM={-100}
            maxM={100}
            aoConfirmar={(v) => campo("raioSomaM", v ?? undefined)}
          />
          <ErroDoCampo erro={err("raioSomaM")} testid={`form-acao-${i}-raioSomaM`} />
          {porS}
        </>
      )}
      {tipo === "objeto.apagar" && (
        <div className="linha-par">
          <CampoDecimal
            testid={`form-acao-${i}-chance`}
            rotulo="Chance de apagar (%)"
            placeholder="100"
            valor={a.chance === undefined ? undefined : (a.chance as number) * 100}
            aoConfirmar={(v) => campo("chance", v === null ? undefined : v / 100)}
            erro={err("chance") === undefined ? undefined : PORCENTAGEM_INVALIDA}
          />
          <CampoDecimal
            testid={`form-acao-${i}-penalidadeS`}
            rotulo="Tira do tempo (segundos)"
            placeholder="0"
            valor={a.penalidadeS as number | undefined}
            aoConfirmar={(v) => campo("penalidadeS", v ?? undefined)}
            erro={err("penalidadeS")}
          />
        </div>
      )}
      {tipo === "objeto.ajustarTempo" && (
        <CampoDecimal
          testid={`form-acao-${i}-deltaS`}
          rotulo="Soma ao tempo (segundos; negativo tira)"
          valor={a.deltaS as number | undefined}
          aoConfirmar={(v) => campo("deltaS", v ?? undefined)}
          erro={err("deltaS")}
        />
      )}
      {tipo === "visao.limitar" && (
        <>
          <CampoDeDistancia
            testid={`form-acao-${i}-alcanceM`}
            rotulo="Alcance de visão"
            valorM={a.alcanceM as number | undefined}
            minM={0.5}
            maxM={1000}
            aoConfirmar={(v) => campo("alcanceM", v ?? undefined)}
          />
          <ErroDoCampo erro={err("alcanceM")} testid={`form-acao-${i}-alcanceM`} />
          {porS}
        </>
      )}
      {tipo === "chat.anunciar" && (
        <>
          <CampoDeTexto
            testid={`form-acao-${i}-texto`}
            rotulo="Texto"
            area
            valor={String(a.texto ?? "")}
            maxLength={300}
            aoMudar={(v) => campo("texto", v)}
            erro={err("texto")}
          />
          <label className="campo-coluna">
            Quem lê
            <select
              data-testid={`form-acao-${i}-para`}
              value={String(a.para ?? "todos")}
              onChange={(ev) => campo("para", ev.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="mestre">Só o mestre</option>
            </select>
          </label>
        </>
      )}
      {tipo === "zona.ativar" && (
        <>
          <label className="campo-coluna">
            Zona
            <select
              data-testid={`form-acao-${i}-zona`}
              value={String(a.zona ?? "")}
              onChange={(ev) => campo("zona", ev.target.value === "" ? undefined : ev.target.value)}
            >
              <option value="">A zona desta reação</option>
              {p.zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nome}
                </option>
              ))}
            </select>
          </label>
          <Marcador
            testid={`form-acao-${i}-ativa`}
            rotulo="Ligar a zona (desmarcado desliga)"
            marcado={a.ativa === true}
            aoMudar={(v) => campo("ativa", v)}
          />
        </>
      )}
      {tipo === "evento.disparar" && (
        <div className="linha-par">
          <CampoDeTexto
            testid={`form-acao-${i}-evento`}
            rotulo="Evento a disparar"
            valor={String(a.evento ?? "")}
            maxLength={48}
            sugestoes={p.eventos}
            aoMudar={(v) => campo("evento", v)}
            erro={err("evento")}
          />
          <CampoDecimal
            testid={`form-acao-${i}-atrasoS`}
            rotulo="Depois de (segundos)"
            placeholder="já"
            valor={a.atrasoS as number | undefined}
            aoConfirmar={(v) => campo("atrasoS", v ?? undefined)}
            erro={err("atrasoS")}
          />
        </div>
      )}
      {temAlvoDeObjeto && (
        <details className="avancado">
          <summary>Quais luzes (opcional)</summary>
          <label className="campo-coluna">
            Só as do modelo
            <select
              data-testid={`form-acao-${i}-alvo-modelo`}
              value={alvo.modeloId ?? ""}
              onChange={(ev) => mudarAlvo("modeloId", ev.target.value)}
            >
              <option value="">Qualquer</option>
              {p.modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <CampoDeTexto
            testid={`form-acao-${i}-alvo-tag`}
            rotulo="Só as que têm a tag"
            valor={alvo.tag ?? ""}
            maxLength={32}
            aoMudar={(v) => mudarAlvo("tag", v)}
          />
          <p className="nota">Sem escolha: a luz da própria reação (ou todas as da cena).</p>
        </details>
      )}
    </div>
  );
}
