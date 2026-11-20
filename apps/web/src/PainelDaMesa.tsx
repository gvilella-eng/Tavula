import {
  type AssetMeta,
  automacoesDe,
  type ConfigDaMesa,
  chamaDoModelo,
  type Estado,
  estiloDaChama,
  fluxoUsa,
  formatarDistancia,
  type ModeloDeObjeto,
  TEMPOS_PARA_JOGADORES,
  type TempoParaJogadores,
} from "@tabletop/shared";
import { Plus, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { Campo, CampoDeDistancia } from "./Campo";
import { SeletorSegmentado } from "./SeletorSegmentado";
import { useUnidade } from "./unidade";

type Enviar = (tipo: string, dados: object) => string | null;

const ROTULO_DO_TEMPO: Record<TempoParaJogadores, string> = {
  exato: "Tempo exato (12:34)",
  estagio: "Só o estágio (forte, fraca, morrendo)",
  oculto: "Oculto",
};

/** Número do campo, ou `null` se o texto não serve. */
function numeroDe(t: string): number | null {
  if (t.trim() === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Seção "Regras da mesa" da aba Mesa (só o mestre edita): mãos por personagem, penalidade ao apagar,
 * alcance de interação, o que os jogadores veem do tempo e os estágios da luz.
 */
export function SecaoMesa({ config, enviar }: { config: ConfigDaMesa; enviar: Enviar }) {
  const mudar = (mudancas: object) => enviar("config.mesa", { mudancas });
  const numero =
    (campo: string, minimo: number, inteiro = false) =>
    (t: string) => {
      const n = numeroDe(t);
      if (n === null || n < minimo || (inteiro && !Number.isInteger(n))) return;
      mudar({ [campo]: n });
    };
  const percentual = (campo: "fraca" | "morrendo") => (t: string) => {
    const n = numeroDe(t);
    if (n === null || n < 0 || n > 100) return;
    mudar({ estagios: { [campo]: n / 100 } });
  };
  return (
    <section className="secao-mesa" data-testid="config-mesa" aria-label="Regras da mesa">
      <div className="linha-par">
        <Campo
          testid="cfg-maos"
          rotulo="Mãos por personagem"
          tipo="number"
          min={1}
          max={6}
          valor={String(config.maosPorPersonagem)}
          aoConfirmar={numero("maosPorPersonagem", 1, true)}
        />
        <Campo
          testid="cfg-penalidade"
          rotulo="Penalidade ao apagar (s)"
          tipo="number"
          min={0}
          max={3600}
          valor={String(config.penalidadeAoApagarS)}
          aoConfirmar={numero("penalidadeAoApagarS", 0)}
        />
      </div>
      <CampoDeDistancia
        testid="cfg-alcance"
        rotulo="Alcance de interação"
        ajuda="Até onde dá para entregar uma tocha ou usar um ponto."
        minM={0}
        maxM={30}
        valorM={config.alcanceInteracaoM}
        aoConfirmar={(n) => {
          if (n !== null && n >= 0) mudar({ alcanceInteracaoM: n });
        }}
      />
      <label className="campo-coluna">
        Tempo para os jogadores
        <select
          data-testid="cfg-tempo"
          value={config.tempoParaJogadores}
          onChange={(e) => mudar({ tempoParaJogadores: e.target.value })}
        >
          {TEMPOS_PARA_JOGADORES.map((t) => (
            <option key={t} value={t}>
              {ROTULO_DO_TEMPO[t]}
            </option>
          ))}
        </select>
        <span className="nota campo-ajuda">O que os jogadores veem do tempo que resta.</span>
      </label>
      <div className="linha-par">
        <Campo
          testid="cfg-estagio-fraca"
          rotulo="Fraca abaixo de (%)"
          tipo="number"
          min={0}
          max={100}
          valor={String(Math.round(config.estagios.fraca * 100))}
          aoConfirmar={percentual("fraca")}
        />
        <Campo
          testid="cfg-estagio-morrendo"
          rotulo="Morrendo abaixo de (%)"
          tipo="number"
          min={0}
          max={100}
          valor={String(Math.round(config.estagios.morrendo * 100))}
          aoConfirmar={percentual("morrendo")}
        />
      </div>
      <p className="nota">
        Os estágios são frações da duração do objeto. O mestre sempre vê o tempo exato; no estágio
        “morrendo” a luz tremula mais.
      </p>
    </section>
  );
}

/** FG1: a escolha da animação da chama de um estágio: a padrão da mesa ou um arquivo animado já enviado (ou novo). */
function LinhaDaAnimacao({
  modelo: m,
  estagio,
  rotulo,
  animacoes,
  registrar,
  editar,
}: {
  modelo: ModeloDeObjeto;
  estagio: "forte" | "fraca" | "morrendo";
  rotulo: string;
  animacoes: readonly AssetMeta[];
  registrar: ((arquivo: File) => Promise<{ hash: string; nome: string }>) | undefined;
  editar: (mudancas: object) => void;
}) {
  const arquivo = useRef<HTMLInputElement>(null);
  const atuais = m.animacoes ?? {};
  const hash = atuais[estagio];
  const comArquivo = hash !== undefined;
  const mudarPara = (novo: string | undefined) => {
    const proximas: Record<string, string> = {};
    for (const [k, v] of Object.entries(atuais)) if (v) proximas[k] = v;
    if (novo === undefined) delete proximas[estagio];
    else proximas[estagio] = novo;
    editar({ animacoes: proximas });
  };
  return (
    <div className="modelo-animacao" data-testid={`modelo-anim-${estagio}-${m.id}`}>
      <span className="modelo-animacao-rotulo">{rotulo}</span>
      <SeletorSegmentado
        modo="escolha"
        rotulo={`Animação da chama (${rotulo.toLowerCase()})`}
        testid={`modelo-anim-modo-${estagio}-${m.id}`}
        valor={comArquivo ? "arquivo" : "padrao"}
        itens={[
          { id: "padrao", nome: "Padrão", testid: `modelo-anim-padrao-${estagio}-${m.id}` },
          { id: "arquivo", nome: "Arquivo", testid: `modelo-anim-arquivo-${estagio}-${m.id}` },
        ]}
        aoMudar={(id) => {
          if (id === "padrao") mudarPara(undefined);
          else if (animacoes[0]) mudarPara(animacoes[0].hash);
          else arquivo.current?.click();
        }}
      />
      {comArquivo && (
        <div className="modelo-animacao-arquivo">
          <select
            aria-label={`Arquivo da animação (${rotulo.toLowerCase()})`}
            data-testid={`modelo-anim-escolha-${estagio}-${m.id}`}
            value={hash}
            onChange={(e) => mudarPara(e.target.value)}
          >
            {animacoes.map((a) => (
              <option key={a.hash} value={a.hash}>
                {a.nomeOriginal}
              </option>
            ))}
            {hash !== undefined && !animacoes.some((a) => a.hash === hash) && (
              <option value={hash}>(arquivo)</option>
            )}
          </select>
        </div>
      )}
      {comArquivo && registrar && (
        <button
          type="button"
          className="modelo-animacao-enviar"
          data-testid={`modelo-anim-enviar-${estagio}-${m.id}`}
          onClick={() => arquivo.current?.click()}
        >
          <Upload size={14} aria-hidden /> Enviar outro
        </button>
      )}
      {registrar && (
        <input
          ref={arquivo}
          type="file"
          hidden
          accept="image/gif,image/webp,image/png,.gif,.webp,.apng,.png"
          data-testid={`modelo-anim-arquivo-input-${estagio}-${m.id}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            registrar(f)
              .then((r) => mudarPara(r.hash))
              .catch((erro) => console.warn("Não consegui enviar a animação", erro));
          }}
        />
      )}
    </div>
  );
}

function LinhaDoModelo({
  modelo: m,
  enviar,
  automacoes,
  animacoes,
  registrarAnimacao,
}: {
  modelo: ModeloDeObjeto;
  enviar: Enviar;
  /** FG1: os arquivos de animação já enviados e como enviar um novo. */
  animacoes: readonly AssetMeta[];
  registrarAnimacao: ((arquivo: File) => Promise<{ hash: string; nome: string }>) | undefined;
  /** AU1: os nomes das automações que mexem neste modelo. */
  automacoes: readonly string[];
}) {
  const editar = (mudancas: object) => enviar("modelo.editar", { id: m.id, mudancas });
  const unidade = useUnidade();
  const infinito = m.duracaoS === null;
  return (
    <details className="modelo-de-objeto" data-testid={`modelo-${m.id}`}>
      <summary>
        <span className="modelo-nome" data-testid={`modelo-resumo-${m.id}`}>
          {m.nome}
        </span>
        <span className="nota">
          {formatarDistancia(m.luz.claraM, unidade)} + {formatarDistancia(m.luz.penumbraM, unidade)}{" "}
          · {infinito ? "infinita" : `${Math.round(((m.duracaoS ?? 0) / 60) * 100) / 100} min`}
          {m.ocupaMao ? " · ocupa a mão" : ""}
        </span>
      </summary>
      <div className="modelo-corpo">
        <Campo
          testid={`modelo-nome-${m.id}`}
          rotulo="Nome"
          valor={m.nome}
          aoConfirmar={(t) => t !== "" && editar({ nome: t })}
        />
        <div className="linha-par">
          <CampoDeDistancia
            testid={`modelo-clara-${m.id}`}
            rotulo="Luz plena"
            minM={0}
            maxM={500}
            valorM={m.luz.claraM}
            aoConfirmar={(n) => {
              if (n !== null && n >= 0) editar({ luz: { claraM: n } });
            }}
          />
          <CampoDeDistancia
            testid={`modelo-penumbra-${m.id}`}
            rotulo="Penumbra"
            minM={0}
            maxM={500}
            valorM={m.luz.penumbraM}
            aoConfirmar={(n) => {
              if (n !== null && n >= 0) editar({ luz: { penumbraM: n } });
            }}
          />
        </div>
        <div className="linha-par">
          <label className="linha-opcao">
            <input
              type="checkbox"
              data-testid={`modelo-infinito-${m.id}`}
              checked={infinito}
              onChange={(e) => editar({ duracaoS: e.target.checked ? null : 3600 })}
            />
            Não se consome
          </label>
          {!infinito && (
            <Campo
              testid={`modelo-duracao-${m.id}`}
              rotulo="Duração (min)"
              tipo="number"
              min={0.1}
              max={6000}
              valor={String(Math.round(((m.duracaoS ?? 0) / 60) * 100) / 100)}
              aoConfirmar={(t) => {
                const n = numeroDe(t);
                if (n !== null && n > 0) editar({ duracaoS: Math.round(n * 60) });
              }}
            />
          )}
        </div>
        <div className="linha-par">
          <label className="linha-opcao">
            <input
              type="color"
              data-testid={`modelo-cor-${m.id}`}
              value={m.luz.cor}
              onChange={(e) => editar({ luz: { cor: e.target.value } })}
            />
            Cor
          </label>
          <label className="linha-opcao">
            <input
              type="checkbox"
              data-testid={`modelo-tremula-${m.id}`}
              checked={m.luz.tremula}
              onChange={(e) => editar({ luz: { tremula: e.target.checked } })}
            />
            Tremular
          </label>
        </div>
        <label className="linha-opcao">
          <input
            type="checkbox"
            data-testid={`modelo-mao-${m.id}`}
            checked={m.ocupaMao}
            onChange={(e) => editar({ ocupaMao: e.target.checked })}
          />
          Ocupa a mão
        </label>
        <fieldset className="modelo-chama" data-testid={`modelo-chama-${m.id}`}>
          <legend>Chama no mapa</legend>
          <div className="linha-par">
            <CampoDeDistancia
              testid={`modelo-chama-largura-${m.id}`}
              rotulo="Largura"
              minM={0.1}
              maxM={30}
              valorM={chamaDoModelo(m).larguraM}
              aoConfirmar={(n) => {
                if (n !== null && n >= 0.1) {
                  editar({ chamaM: { ...chamaDoModelo(m), larguraM: n } });
                }
              }}
            />
            <CampoDeDistancia
              testid={`modelo-chama-altura-${m.id}`}
              rotulo="Altura"
              minM={0.1}
              maxM={30}
              valorM={chamaDoModelo(m).alturaM}
              aoConfirmar={(n) => {
                if (n !== null && n >= 0.1) {
                  editar({ chamaM: { ...chamaDoModelo(m), alturaM: n } });
                }
              }}
            />
          </div>
          {(
            [
              ["forte", "Forte"],
              ["fraca", "Fraca"],
              ["morrendo", "Morrendo"],
            ] as const
          ).map(([estagio, rotulo]) => (
            <LinhaDaAnimacao
              key={estagio}
              modelo={m}
              estagio={estagio}
              rotulo={rotulo}
              animacoes={animacoes}
              registrar={registrarAnimacao}
              editar={editar}
            />
          ))}
          <p className="nota">
            Animação {estiloDaChama(m) === "fogueira" ? "de fogueira" : "de tocha"} padrão, ou um
            gif, webp animado ou apng seu (até 4 MB).
          </p>
        </fieldset>
        <Campo
          testid={`modelo-tags-${m.id}`}
          rotulo="Tags (separadas por vírgula)"
          valor={m.tags.join(", ")}
          aoConfirmar={(t) =>
            editar({
              tags: t
                .split(",")
                .map((x) => x.trim())
                .filter((x) => x !== ""),
            })
          }
        />
        <p className="nota" data-testid={`modelo-automacoes-${m.id}`}>
          {automacoes.length === 0
            ? "Nenhuma automação mexe neste modelo."
            : `Automações que mexem neste modelo: ${automacoes.join(", ")}.`}
        </p>
        <button
          type="button"
          className="perigo"
          data-testid={`modelo-apagar-${m.id}`}
          onClick={() => enviar("modelo.apagar", { id: m.id })}
        >
          <Trash2 size={14} /> Apagar o modelo
        </button>
      </div>
    </details>
  );
}

/**
 * Seção "Objetos de luz" da aba Mesa (só o mestre): os modelos de objeto (nome, luz, duração
 * ou infinita, ocupa mão, tags) que os personagens carregam na mochila e os pontos acendem.
 */
export function SecaoObjetosDeLuz({
  estado,
  enviar,
  registrarAnimacao,
}: {
  estado: Pick<Estado, "modelos" | "automacoes" | "assets">;
  enviar: Enviar;
  registrarAnimacao?: ((arquivo: File) => Promise<{ hash: string; nome: string }>) | undefined;
}) {
  const animacoes = (estado.assets ?? []).filter((a) => a.tipo === "animacao");
  function novoModelo() {
    enviar("modelo.criar", {
      modelo: {
        id: `modelo-${crypto.randomUUID().slice(0, 8)}`,
        nome: "Novo objeto",
        luz: { claraM: 3, penumbraM: 3, cor: "#ffb347", tremula: true },
        duracaoS: 600,
        ocupaMao: true,
        tags: [],
      },
    });
  }
  return (
    <section className="secao-objetos" data-testid="config-objetos" aria-label="Objetos de luz">
      <p className="nota">
        Modelos de tocha, lanterna, fogueira… Os personagens carregam na mochila (quantidade) e os
        pontos do mapa acendem. Mudar o modelo muda, na hora, todos os objetos dele (nas mãos, nas
        mochilas, nos suportes e no mapa); o que é de cada objeto (aceso, tempo, onde está) fica
        como está.
      </p>
      {estado.modelos.map((m) => (
        <LinhaDoModelo
          key={m.id}
          modelo={m}
          enviar={enviar}
          animacoes={animacoes}
          registrarAnimacao={registrarAnimacao}
          automacoes={automacoesDe(estado)
            .fluxos.filter((f) => fluxoUsa(f, "modelo", m.id))
            .map((f) => f.nome)}
        />
      ))}
      <button type="button" data-testid="modelo-novo" onClick={novoModelo}>
        <Plus size={16} /> Novo modelo
      </button>
    </section>
  );
}
