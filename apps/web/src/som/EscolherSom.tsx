import { LIMITES_DE_ASSET } from "@tabletop/shared";
import { FolderOpen, Music2, Search } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ArquivoDaFonte } from "../assets/fonte";
import type { Fontes } from "../assets/fontes";

export type SomEscolhido = { hash: string; nome: string };

type Props = {
  fontes: Fontes;
  /** Guarda o arquivo na mesa (vira asset `som`) e devolve o hash; um erro lançado aparece aqui. */
  registrar: (arquivo: File) => Promise<SomEscolhido>;
  aoEscolher: (som: SomEscolhido) => void;
  /** Prefixo dos `data-testid` (`som-lista`, `som-item`, `som-busca`, `som-arquivo`). */
  testid: string;
  /** Texto de quando não há som na pasta. */
  vazio?: string;
};

/**
 * N5: a lista de sons do mestre, com busca. Mostra os arquivos de áudio da pasta local (`sons/` ou qualquer subpasta) e os
 * que ele escolheu à mão nesta sessão; clicar num som o registra na mesa e o entrega a quem usa a lista.
 * Os arquivos ficam no computador: a mesa só recebe o que ele usa.
 */
export function EscolherSom({ fontes, registrar, aoEscolher, testid, vazio }: Props) {
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  const versaoDasFontes = fontes.versaoAtual();
  const [arquivos, setArquivos] = useState<ArquivoDaFonte[]>([]);
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega quando as fontes mudam
  useEffect(() => {
    let cancelado = false;
    fontes
      .listarSons()
      .then((l) => !cancelado && setArquivos(l))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [fontes, versaoDasFontes]);

  async function usar(obter: () => Promise<File>) {
    if (ocupado) return;
    setOcupado(true);
    setMensagem("Enviando…");
    try {
      const arquivo = await obter();
      if (arquivo.size > LIMITES_DE_ASSET.bytesDoSom) {
        throw new Error("Som grande demais (até 20 MB).");
      }
      aoEscolher(await registrar(arquivo));
      setMensagem(null);
    } catch (e) {
      setMensagem((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = termo
    ? arquivos.filter((a) => a.caminho.toLocaleLowerCase("pt-BR").includes(termo))
    : arquivos;

  return (
    <div className="som-escolher" data-testid={testid}>
      <label className="som-busca">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar som"
          aria-label="Buscar som"
          data-testid={`${testid}-busca`}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </label>
      {visiveis.length > 0 ? (
        <ul className="som-lista" data-testid={`${testid}-lista`}>
          {visiveis.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="som-item"
                data-testid={`${testid}-item`}
                data-nome={a.nome}
                disabled={ocupado}
                title={a.caminho}
                onClick={() => void usar(() => a.abrir())}
              >
                <Music2 size={14} aria-hidden="true" />
                <span>{a.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nota" data-testid={`${testid}-vazio`}>
          {arquivos.length > 0
            ? "Nenhum som com esse nome."
            : (vazio ??
              "Nenhum som na pasta local. Escolha a pasta em Preferências ou um arquivo.")}
        </p>
      )}
      <button
        type="button"
        className="som-arquivo-botao"
        data-testid={`${testid}-escolher-arquivo`}
        disabled={ocupado}
        onClick={() => entrada.current?.click()}
      >
        <FolderOpen size={14} aria-hidden="true" /> Escolher arquivo…
      </button>
      <input
        ref={entrada}
        type="file"
        accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav"
        hidden
        data-testid={`${testid}-arquivo`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            fontes.adicionarSomSolto(f);
            void usar(async () => f);
          }
        }}
      />
      {mensagem && (
        <p className="nota" role="status" data-testid={`${testid}-mensagem`}>
          {mensagem}
        </p>
      )}
    </div>
  );
}
