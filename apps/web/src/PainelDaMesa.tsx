import {
  type ConfigDaMesa,
  type Estado,
  formatarDistancia,
  type ModeloDeObjeto,
  TEMPOS_PARA_JOGADORES,
  type TempoParaJogadores,
} from "@tabletop/shared";
import { Plus, Trash2 } from "lucide-react";
import { Campo } from "./Campo";
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
      <h3>Regras da mesa</h3>
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
      <Campo
        testid="cfg-alcance"
        rotulo="Alcance de interação (m): entregar tocha, usar ponto"
        tipo="number"
        min={0}
        max={30}
        valor={String(config.alcanceInteracaoM)}
        aoConfirmar={numero("alcanceInteracaoM", 0)}
      />
      <label className="campo-coluna">
        O que os jogadores veem do tempo
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

function LinhaDoModelo({ modelo: m, enviar }: { modelo: ModeloDeObjeto; enviar: Enviar }) {
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
          <Campo
            testid={`modelo-clara-${m.id}`}
            rotulo="Luz plena (m)"
            tipo="number"
            min={0}
            max={500}
            valor={String(m.luz.claraM)}
            aoConfirmar={(t) => {
              const n = numeroDe(t);
              if (n !== null && n >= 0) editar({ luz: { claraM: n } });
            }}
          />
          <Campo
            testid={`modelo-penumbra-${m.id}`}
            rotulo="Penumbra (m)"
            tipo="number"
            min={0}
            max={500}
            valor={String(m.luz.penumbraM)}
            aoConfirmar={(t) => {
              const n = numeroDe(t);
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
          <label className="campo-coluna">
            Cor
            <input
              type="color"
              data-testid={`modelo-cor-${m.id}`}
              value={m.luz.cor}
              onChange={(e) => editar({ luz: { cor: e.target.value } })}
            />
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
export function SecaoObjetosDeLuz({ estado, enviar }: { estado: Estado; enviar: Enviar }) {
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
      <h3>Modelos de tocha e objetos de luz</h3>
      <p className="nota">
        Modelos de tocha, lanterna, fogueira... Os personagens carregam na mochila (quantidade) e os
        pontos do mapa acendem. Mudar o modelo não muda os objetos que já existem.
      </p>
      {estado.modelos.map((m) => (
        <LinhaDoModelo key={m.id} modelo={m} enviar={enviar} />
      ))}
      <button type="button" data-testid="modelo-novo" onClick={novoModelo}>
        <Plus size={16} /> Novo modelo
      </button>
    </section>
  );
}
