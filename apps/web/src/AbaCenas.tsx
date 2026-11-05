import type { Cena, Estado } from "@tabletop/shared";
import { useState } from "react";
import type { ProgressoDePreparo } from "./useSala";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  /** A cena que o mestre está olhando (estado local da tela dele). */
  cenaVistaId: string;
  preparos: ProgressoDePreparo[];
  enviar: Enviar;
  /** `null`: volta a acompanhar a cena do grupo. */
  aoVer: (cenaId: string | null) => void;
  /** Cifra e envia o preparo; devolve uma mensagem de erro, ou `null` se deu certo. */
  aoPreparar: (cenaId: string) => Promise<string | null>;
  centroDaVista: () => { x: number; y: number };
};

type PropsLinha = Omit<Props, "estado" | "cenaVistaId" | "preparos"> & {
  cena: Cena;
  doGrupo: boolean;
  vista: boolean;
  preparo: ProgressoDePreparo | undefined;
};

function LinhaDeCena({
  cena,
  doGrupo,
  vista,
  preparo,
  enviar,
  aoVer,
  aoPreparar,
  centroDaVista,
}: PropsLinha) {
  const [nome, setNome] = useState(cena.nome);
  const [apagando, setApagando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Outro nome vindo da sala (duplicar, outro mestre): acompanha.
  const [nomeDaSala, setNomeDaSala] = useState(cena.nome);
  if (nomeDaSala !== cena.nome) {
    setNomeDaSala(cena.nome);
    setNome(cena.nome);
  }

  const renomear = () => {
    const limpo = nome.trim();
    if (limpo && limpo !== cena.nome) enviar("cena.editar", { cenaId: cena.id, nome: limpo });
    else setNome(cena.nome);
  };

  async function preparar() {
    setOcupado(true);
    setMensagem("Preparando…");
    setMensagem(await aoPreparar(cena.id));
    setOcupado(false);
  }

  return (
    <li
      className="cena-linha"
      data-testid="cena-linha"
      data-cena-id={cena.id}
      data-do-grupo={doGrupo}
      data-vista={vista}
    >
      <div className="cena-titulo">
        <input
          aria-label={`Nome da cena ${cena.nome}`}
          data-testid={`cena-nome-${cena.id}`}
          value={nome}
          maxLength={64}
          onChange={(e) => setNome(e.target.value)}
          onBlur={renomear}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        {doGrupo && <span className="selo">grupo aqui</span>}
        {vista && <span className="selo">vendo</span>}
      </div>
      <div className="linha-botoes">
        <button
          type="button"
          data-testid={`cena-ver-${cena.id}`}
          disabled={vista}
          onClick={() => aoVer(doGrupo ? null : cena.id)}
        >
          Ver
        </button>
        <button
          type="button"
          data-testid={`cena-levar-${cena.id}`}
          disabled={doGrupo}
          onClick={() => {
            enviar("grupo.moverPara", { cenaId: cena.id });
            aoVer(null);
          }}
        >
          Levar o grupo aqui
        </button>
        <button
          type="button"
          data-testid={`cena-preparar-${cena.id}`}
          disabled={doGrupo || ocupado}
          title="Envia os arquivos desta cena, cifrados, para os jogadores antes de levar o grupo"
          onClick={() => void preparar()}
        >
          Preparar
        </button>
        <button
          type="button"
          data-testid={`cena-duplicar-${cena.id}`}
          onClick={() =>
            enviar("cena.duplicar", {
              cenaId: cena.id,
              novoId: `cena-${crypto.randomUUID().slice(0, 8)}`,
            })
          }
        >
          Duplicar
        </button>
        {apagando ? (
          <button
            type="button"
            className="perigo"
            data-testid={`cena-apagar-confirmar-${cena.id}`}
            onClick={() => {
              enviar("cena.apagar", { cenaId: cena.id });
              setApagando(false);
            }}
          >
            Confirmar: apagar cena e tokens
          </button>
        ) : (
          <button
            type="button"
            className="perigo"
            data-testid={`cena-apagar-${cena.id}`}
            disabled={doGrupo}
            title={doGrupo ? "A cena onde está o grupo não pode ser apagada" : ""}
            onClick={() => setApagando(true)}
          >
            Apagar
          </button>
        )}
        {vista && (
          <button
            type="button"
            data-testid={`cena-chegada-${cena.id}`}
            onClick={() => enviar("cena.editar", { cenaId: cena.id, chegada: centroDaVista() })}
          >
            Usar o centro da vista como chegada
          </button>
        )}
      </div>
      {cena.chegada && (
        <p className="nota" data-testid={`cena-chegada-valor-${cena.id}`}>
          Chegada: {cena.chegada.x.toFixed(1)} m, {cena.chegada.y.toFixed(1)} m
        </p>
      )}
      {preparo && (
        <p className="nota" data-testid={`cena-progresso-${cena.id}`}>
          Preparada: {preparo.hashesOriginais.length}{" "}
          {preparo.hashesOriginais.length === 1 ? "arquivo" : "arquivos"} · {preparo.completos} de{" "}
          {preparo.jogadores} jogadores já têm tudo
        </p>
      )}
      {mensagem && (
        <p className="nota" role="status" data-testid={`cena-mensagem-${cena.id}`}>
          {mensagem}
        </p>
      )}
    </li>
  );
}

/** Aba Cenas (só do mestre): onde o grupo está, o que ele está vendo, levar, preparar, duplicar. */
export function AbaCenas({ estado, cenaVistaId, preparos, ...resto }: Props) {
  const [nova, setNova] = useState("");

  function criar() {
    const nome = nova.trim();
    if (!nome) return;
    resto.enviar("cena.criar", { id: `cena-${crypto.randomUUID().slice(0, 8)}`, nome });
    setNova("");
  }

  return (
    <div className="aba-cenas" data-testid="aba-cenas-conteudo">
      <p className="nota">
        Os jogadores só recebem a cena onde está o grupo. Ver uma cena aqui não move ninguém.
      </p>
      <ul className="lista-simples">
        {estado.cenas.map((c) => (
          <LinhaDeCena
            key={c.id}
            cena={c}
            doGrupo={c.id === estado.cenaAtivaId}
            vista={c.id === cenaVistaId}
            preparo={preparos.find((p) => p.cenaId === c.id)}
            {...resto}
          />
        ))}
      </ul>
      <div className="linha-botoes">
        <input
          aria-label="Nome da nova cena"
          data-testid="cena-nova-nome"
          placeholder="Nome da nova cena"
          value={nova}
          maxLength={64}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criar()}
        />
        <button type="button" data-testid="cena-nova" onClick={criar}>
          Criar cena
        </button>
      </div>
    </div>
  );
}
