import { type Estado, type Papel, type Presenca, pode } from "@tabletop/shared";
import { CampoNota } from "./CampoNota";
import type { Ocorrencia } from "./useSala";

type Enviar = (tipo: string, dados: object) => string | null;

type PropsJogadores = {
  estado: Estado;
  presenca: Record<string, Presenca>;
  euMestre: boolean;
  enviar: Enviar;
};

/** Presença de todos; o mestre também muda os papéis aqui. */
export function AbaJogadores({ estado, presenca, euMestre, enviar }: PropsJogadores) {
  function mudarPapel(usuarioId: string, papel: Papel) {
    if (papel === "mestre" || papel === "jogador") enviar("papel.alterar", { usuarioId, papel });
  }
  return (
    <ul className="lista-simples" data-testid="presenca">
      {estado.usuarios.map((u) => (
        <li key={u.id} data-testid={`presenca-${u.id}`} className="linha-jogador">
          <span className="bolinha" style={{ background: u.cor }} />
          <span className="nome-jogador">{u.nome}</span>
          <span data-testid={`presenca-estado-${u.id}`} className="estado-presenca">
            {presenca[u.id] ?? "offline"}
          </span>
          {euMestre && (
            <select
              aria-label={`Papel de ${u.nome}`}
              data-testid={`papel-${u.id}`}
              value={u.papel === "mestre" ? "mestre" : "jogador"}
              onChange={(e) => mudarPapel(u.id, e.target.value as Papel)}
            >
              <option value="mestre">mestre</option>
              <option value="jogador">jogador</option>
            </select>
          )}
        </li>
      ))}
    </ul>
  );
}

type PropsNotas = {
  estado: Estado;
  eu: { id: string; papel: Papel };
  pronto: boolean;
  enviar: Enviar;
  ouvir: (fn: (o: Ocorrencia) => void) => () => void;
};

export function AbaNotas({ estado, eu, pronto, enviar, ouvir }: PropsNotas) {
  const podeEditar = pode(eu, "nota.editar", estado.permissoes);
  return (
    <>
      <CampoNota
        testid="nota-mesa"
        rotulo="Nota da mesa (todos veem)"
        campo="mesa"
        usuarioId={eu.id}
        servidor={estado.notaMesa}
        editavel={podeEditar}
        pronto={pronto}
        enviar={enviar}
        ouvir={ouvir}
      />
      {eu.papel === "mestre" && (
        <CampoNota
          testid="nota-mestre"
          rotulo="Nota do mestre (só mestres veem)"
          campo="mestre"
          usuarioId={eu.id}
          servidor={estado.notaMestre ?? ""}
          editavel
          pronto={pronto}
          enviar={enviar}
          ouvir={ouvir}
        />
      )}
    </>
  );
}

type PropsConfig = {
  nome: string;
  papel: Papel;
  encaixe: boolean;
  aoMudarEncaixe: (v: boolean) => void;
  aoSair: () => void;
};

/** Trocar de usuário e preferências locais (valem só neste navegador). */
export function AbaConfiguracoes({ nome, papel, encaixe, aoMudarEncaixe, aoSair }: PropsConfig) {
  return (
    <>
      <p>
        Você é <strong>{nome}</strong> ({papel}).
      </p>
      <button type="button" data-testid="trocar-usuario" onClick={aoSair}>
        Trocar usuário
      </button>
      <h3>Preferências deste navegador</h3>
      <label className="linha-opcao">
        <input
          type="checkbox"
          data-testid="pref-encaixe"
          checked={encaixe}
          onChange={(e) => aoMudarEncaixe(e.target.checked)}
        />
        Encaixar tokens no grid (segure Alt ao arrastar para soltar sem encaixe)
      </label>
    </>
  );
}
