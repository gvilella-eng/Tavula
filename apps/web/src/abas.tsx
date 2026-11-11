import { type Estado, type Papel, pode } from "@tabletop/shared";
import { FolderOpen, ShieldCheck } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type ArquivoDaFonte, temSeletorDePasta } from "./assets/fonte";
import type { Fontes } from "./assets/fontes";
import type { GerenteDeAssets, StatusDeAsset } from "./assets/gerente";
import { CampoNota } from "./CampoNota";
import { SeletorDeTema } from "./SeletorDeTema";
import type { Ocorrencia } from "./useSala";

type Enviar = (tipo: string, dados: object) => string | null;

type PropsNotas = {
  estado: Estado;
  eu: { id: string; papel: Papel };
  pronto: boolean;
  enviar: Enviar;
  ouvir: (fn: (o: Ocorrencia) => void) => () => void;
};

/** Nota da mesa (todos veem) e nota do mestre (só o mestre), com o comportamento do Lote 1. */
export function AbaNotas({ estado, eu, pronto, enviar, ouvir }: PropsNotas) {
  const podeEditar = pode(eu, "nota.editar", estado.permissoes);
  return (
    <div className="aba-notas" data-testid="aba-notas-conteudo">
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
    </div>
  );
}

const ROTULO_DO_ESTADO: Record<StatusDeAsset["estado"], string> = {
  pedindo: "pedindo",
  baixando: "recebendo",
  pronto: "pronto",
  indisponivel: "indisponível (ninguém com o arquivo está online)",
  erro: "erro",
};

type PropsPreferencias = {
  nome: string;
  papel: Papel;
  encaixe: boolean;
  aoMudarEncaixe: (v: boolean) => void;
  aoSair: () => void;
  fontes: Fontes;
  gerente: GerenteDeAssets | null;
};

/** A pasta local de imagens: escolher, reautorizar e ver o que há nela. */
function PastaLocal({ fontes }: { fontes: Fontes }) {
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  const [arquivos, setArquivos] = useState<ArquivoDaFonte[]>([]);
  const versao = fontes.versaoAtual();
  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega quando as fontes mudam
  useEffect(() => {
    let cancelado = false;
    fontes
      .listar()
      .then((l) => !cancelado && setArquivos(l))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [fontes, versao]);
  return (
    <>
      <h3>Pasta local de imagens</h3>
      <p className="nota">
        As imagens ficam no seu computador. A mesa só recebe o que você usa (retrato, token, mapa) e
        o servidor não guarda nada.
      </p>
      <div className="linha-botoes">
        {temSeletorDePasta() && (
          <button
            type="button"
            data-testid="biblioteca-pasta"
            onClick={() => void fontes.escolherPasta().catch(() => {})}
          >
            <FolderOpen size={16} /> {fontes.nomeDaPasta ? "Trocar pasta" : "Escolher pasta"}
          </button>
        )}
      </div>
      {fontes.nomeDaPasta ? (
        <p className="nota" data-testid="biblioteca-pasta-estado">
          Pasta: <strong>{fontes.nomeDaPasta}</strong> · {arquivos.length}{" "}
          {arquivos.length === 1 ? "imagem" : "imagens"}
          {fontes.estado === "reautorizar" && (
            <>
              {" "}
              (o navegador pede permissão de novo){" "}
              <button
                type="button"
                data-testid="biblioteca-reautorizar"
                onClick={() => void fontes.reautorizar().then(() => undefined)}
              >
                <ShieldCheck size={14} /> Reautorizar
              </button>
            </>
          )}
          {fontes.estado === "negada" && " (permissão negada)"}
        </p>
      ) : (
        <p className="nota" data-testid="biblioteca-pasta-estado">
          Nenhuma pasta escolhida.
        </p>
      )}
      {arquivos.length > 0 && (
        <ul className="lista-simples nomes-de-arquivos" data-testid="biblioteca-lista">
          {arquivos.slice(0, 8).map((a) => (
            <li key={a.id} title={a.caminho}>
              {a.nome}
            </li>
          ))}
          {arquivos.length > 8 && <li className="nota">e mais {arquivos.length - 8}…</li>}
        </ul>
      )}
    </>
  );
}

/** O que está chegando e quantos arquivos o cache deste navegador já tem. */
function Transferencias({ gerente }: { gerente: GerenteDeAssets }) {
  useSyncExternalStore(gerente.assinar, gerente.versaoAtual);
  const emAndamento = gerente.listarStatus().filter((s) => s.estado !== "pronto");
  // Conta o cache (o que está no disco deste navegador), não só o que veio por transferência.
  const prontos = gerente.inventario().length;
  return (
    <>
      <h3>Transferências</h3>
      <ul className="lista-simples transferencias" data-testid="transferencias">
        {emAndamento.map((s) => (
          <li key={s.hash} data-testid="transferencia" data-hash={s.hash} data-estado={s.estado}>
            <span className="nome">{s.nome}</span>
            <span className="estado-presenca">{ROTULO_DO_ESTADO[s.estado]}</span>
            {s.total > 0 && <progress value={s.recebidos} max={s.total} />}
          </li>
        ))}
        {emAndamento.length === 0 && <li className="nota">Nenhuma transferência em andamento.</li>}
      </ul>
      <p className="nota" data-testid="transferencias-prontas">
        {prontos} {prontos === 1 ? "arquivo pronto" : "arquivos prontos"} neste navegador.
      </p>
    </>
  );
}

/**
 * Aba Preferências (todos): o que é de cada pessoa, no navegador. Trocar de usuário, tema de cor,
 * encaixe no grid, pasta local de imagens e transferências. O que vale para a sala (regras, modelos de
 * luz, papéis) está na aba Mesa, só do mestre.
 */
export function AbaPreferencias({
  nome,
  papel,
  encaixe,
  aoMudarEncaixe,
  aoSair,
  fontes,
  gerente,
}: PropsPreferencias) {
  return (
    <>
      <p>
        Você é <strong>{nome}</strong> ({papel}).
      </p>
      <button type="button" data-testid="trocar-usuario" onClick={aoSair}>
        Trocar usuário
      </button>
      <h3>Neste navegador</h3>
      <p className="nota">Só vale para você e fica guardado aqui, não vai para a mesa.</p>
      <SeletorDeTema />
      <label className="linha-opcao">
        <input
          type="checkbox"
          data-testid="pref-encaixe"
          checked={encaixe}
          onChange={(e) => aoMudarEncaixe(e.target.checked)}
        />
        Encaixar tokens no grid (segure Alt ao arrastar para soltar sem encaixe)
      </label>
      <PastaLocal fontes={fontes} />
      {gerente && <Transferencias gerente={gerente} />}
    </>
  );
}
