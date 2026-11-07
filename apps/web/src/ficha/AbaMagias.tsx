import {
  ATRIBUTOS,
  formatarBonus,
  type Magia,
  ROTULO_DO_ATRIBUTO,
  SIGLA_DO_ATRIBUTO,
} from "@tabletop/shared";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { PropsDaAba } from "./AbaPrincipal";
import { CampoTexto } from "./campos";

const um = (caminho: string, valor: unknown) => [{ caminho, valor }];

const ROTULO_DO_NIVEL = (n: number) => (n === 0 ? "Truques" : `${n}º nível`);

/** Caixinhas de espaços: as primeiras `gastos` estão marcadas (gastas). Clicar marca ou desmarca até ali. */
function Caixinhas({
  prefixo,
  total,
  gastos,
  editar,
  aoMudar,
}: {
  prefixo: string;
  total: number;
  gastos: number;
  editar: boolean;
  aoMudar: (gastos: number) => void;
}) {
  return (
    <span className="fh-caixinhas">
      {Array.from({ length: total }, (_, i) => i + 1).map((k) => (
        <input
          key={k}
          type="checkbox"
          data-testid={`${prefixo}-${k}`}
          aria-label={`Espaço ${k} gasto`}
          checked={gastos >= k}
          disabled={!editar}
          onChange={() => aoMudar(gastos >= k ? k - 1 : k)}
        />
      ))}
    </span>
  );
}

function Conjuracao({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  if (d.conjuradoras.length === 0) {
    return (
      <p className="nota" data-testid="sem-conjuracao">
        Nenhuma classe de conjuração: preencha as classes na aba Principal.
      </p>
    );
  }
  return (
    <section className="fh-conjuracao" data-testid="fh-conjuracao" aria-label="Conjuração">
      {d.conjuradoras.map((c) => (
        <div key={c.classe} className="fh-conjuradora" data-testid={`conjuradora-${c.classe}`}>
          <strong>{c.classe}</strong>
          <label className="fh-campo">
            <span>Habilidade</span>
            <select
              data-testid={`conjuracao-habilidade-${c.classe}`}
              value={c.habilidade}
              disabled={!editar}
              onChange={(e) => {
                const outras = (ficha.conjuracao ?? []).filter((x) => x.classe !== c.classe);
                alterar(
                  um("conjuracao", [...outras, { classe: c.classe, habilidade: e.target.value }]),
                );
              }}
            >
              {ATRIBUTOS.map((a) => (
                <option key={a} value={a}>
                  {SIGLA_DO_ATRIBUTO[a]} · {ROTULO_DO_ATRIBUTO[a]}
                </option>
              ))}
            </select>
          </label>
          <span className="fh-caixa mini">
            <span className="fh-rotulo">CD</span>
            <strong data-testid={`conjuracao-cd-${c.classe}`} className="fh-grande">
              {c.cd}
            </strong>
          </span>
          <span className="fh-caixa mini">
            <span className="fh-rotulo">Ataque</span>
            <button
              type="button"
              className="fh-rolavel grande"
              data-testid={`conjuracao-ataque-${c.classe}`}
              disabled={!rolador.podeRolar}
              title={`Rolar o ataque de magia de ${c.classe}`}
              onClick={() => rolador.teste(`Ataque de magia (${c.classe})`, c.ataque)}
            >
              {formatarBonus(c.ataque)}
            </button>
          </span>
        </div>
      ))}
    </section>
  );
}

function Espacos({ ficha, d, alterar, editar }: PropsDaAba) {
  return (
    <section className="fh-espacos" data-testid="fh-espacos" aria-label="Espaços de magia">
      <h4>
        Espaços de magia <small>(conjurador de nível {d.nivelDeConjurador})</small>
      </h4>
      {d.espacos.length === 0 && !d.pacto && <p className="nota">Sem espaços de magia.</p>}
      {d.espacos.map((e) => (
        <div key={e.nivel} className="fh-linha-espaco" data-testid={`espacos-${e.nivel}`}>
          <span className="fh-nome-linha">{ROTULO_DO_NIVEL(e.nivel)}</span>
          <Caixinhas
            prefixo={`espaco-${e.nivel}`}
            total={e.total}
            gastos={e.gastos}
            editar={editar}
            aoMudar={(g) => {
              // O objeto inteiro (chave numérica não cria o caminho: "1" seria posição de lista).
              const { [String(e.nivel) as "1"]: _antigo, ...resto } = ficha.espacosGastos ?? {};
              alterar(um("espacosGastos", g === 0 ? resto : { ...resto, [String(e.nivel)]: g }));
            }}
          />
          <span data-testid={`espacos-resumo-${e.nivel}`} className="fh-resumo-espaco">
            {e.restantes}/{e.total}
          </span>
        </div>
      ))}
      {d.pacto && (
        <div className="fh-linha-espaco" data-testid="espacos-pacto">
          <span className="fh-nome-linha">Pacto ({d.pacto.nivel}º nível)</span>
          <Caixinhas
            prefixo="pacto"
            total={d.pacto.quantidade}
            gastos={d.pacto.gastos}
            editar={editar}
            aoMudar={(g) => alterar(um("pactoGasto", g === 0 ? null : g))}
          />
          <span data-testid="espacos-resumo-pacto" className="fh-resumo-espaco">
            {d.pacto.restantes}/{d.pacto.quantidade}
          </span>
        </div>
      )}
    </section>
  );
}

function LinhaDeMagia({
  m,
  i,
  editar,
  alterar,
}: { m: Magia; i: number } & Pick<PropsDaAba, "editar" | "alterar">) {
  const [aberta, setAberta] = useState(false);
  return (
    <li className="fh-magia" data-testid={`magia-${i}`}>
      <div className="fh-magia-linha">
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid={`magia-detalhes-${i}`}
          aria-expanded={aberta}
          aria-label={aberta ? "Esconder a descrição" : "Mostrar a descrição"}
          onClick={() => setAberta(!aberta)}
        >
          {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <input
          type="checkbox"
          data-testid={`magia-preparada-${i}`}
          aria-label={`${m.nome} preparada`}
          title="Preparada"
          checked={m.preparada}
          disabled={!editar}
          onChange={() => alterar(um(`magias.${i}.preparada`, !m.preparada))}
        />
        <CampoTexto
          testid={`magia-nome-${i}`}
          rotulo="Nome da magia"
          valor={m.nome}
          maxLength={80}
          desabilitado={!editar}
          aoMudar={(t) => alterar(um(`magias.${i}.nome`, t))}
        />
        <CampoTexto
          testid={`magia-escola-${i}`}
          rotulo="Escola"
          placeholder="escola"
          valor={m.escola ?? ""}
          maxLength={32}
          desabilitado={!editar}
          className="curto"
          aoMudar={(t) => alterar(um(`magias.${i}.escola`, t === "" ? null : t))}
        />
        {editar && (
          <button
            type="button"
            className="botao-icone pequeno"
            data-testid={`magia-remover-${i}`}
            title="Tirar a magia"
            aria-label={`Tirar a magia ${m.nome}`}
            onClick={() => alterar(um(`magias.${i}`, null))}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {aberta && (
        <CampoTexto
          testid={`magia-descricao-${i}`}
          rotulo={`Descrição de ${m.nome}`}
          valor={m.descricao}
          maxLength={20000}
          multilinha
          desabilitado={!editar}
          className="fh-descricao"
          aoMudar={(t) => alterar(um(`magias.${i}.descricao`, t))}
        />
      )}
    </li>
  );
}

/** Aba Magias: habilidade, CD e ataque; espaços por nível (e o pacto do Bruxo à parte); lista por nível. */
export function AbaMagias(props: PropsDaAba) {
  const { ficha, alterar, editar } = props;
  const magias = ficha.magias ?? [];
  const [nome, setNome] = useState("");
  const [nivel, setNivel] = useState(0);
  const niveis = [...new Set(magias.map((m) => m.nivel))].sort((a, b) => a - b);
  function adicionar() {
    const limpo = nome.trim();
    if (!limpo) return;
    if (
      alterar(um("magias", [...magias, { nome: limpo, nivel, preparada: true, descricao: "" }]))
    ) {
      setNome("");
    }
  }
  return (
    <div className="fh-magias" data-testid="fh-aba-magias">
      <Conjuracao {...props} />
      <Espacos {...props} />
      {niveis.map((n) => (
        <section key={n} className="fh-grupo-magias" data-testid={`magias-nivel-${n}`}>
          <h4>
            {ROTULO_DO_NIVEL(n)} <small>({magias.filter((m) => m.nivel === n).length})</small>
          </h4>
          <ul className="lista-simples">
            {magias.map((m, i) => {
              if (m.nivel !== n) return null;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
                <LinhaDeMagia key={i} m={m} i={i} editar={editar} alterar={alterar} />
              );
            })}
          </ul>
        </section>
      ))}
      {magias.length === 0 && <p className="nota">Nenhuma magia na lista.</p>}
      {editar && (
        <form
          className="fh-nova-magia"
          data-testid="magia-nova"
          onSubmit={(e) => {
            e.preventDefault();
            adicionar();
          }}
        >
          <input
            type="text"
            data-testid="magia-nova-nome"
            aria-label="Nome da nova magia"
            placeholder="Nome da magia"
            maxLength={80}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <select
            data-testid="magia-nova-nivel"
            aria-label="Nível da nova magia"
            value={nivel}
            onChange={(e) => setNivel(Number(e.target.value))}
          >
            {Array.from({ length: 10 }, (_, n) => n).map((n) => (
              <option key={n} value={n}>
                {ROTULO_DO_NIVEL(n)}
              </option>
            ))}
          </select>
          <button type="submit" data-testid="magia-adicionar">
            <Plus size={14} /> Magia
          </button>
        </form>
      )}
    </div>
  );
}
