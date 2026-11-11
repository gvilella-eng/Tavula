import { FolderOpen, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ArquivoDaFonte } from "./assets/fonte";
import type { Fontes } from "./assets/fontes";
import type { Processador } from "./assets/processador";
import { BotaoComDica } from "./BotaoComDica";
import { useFecharFora } from "./Popover";

const MAX_MINIATURAS = 60;

type Props = {
  titulo: string;
  fontes: Fontes;
  processador: Processador;
  /** Processa e usa o arquivo; um erro lançado aparece aqui e o seletor continua aberto. */
  aoEscolher: (arquivo: File) => Promise<void>;
  aoFechar: () => void;
};

/**
 * Escolher uma imagem: as da pasta local (e as soltas desta sessão) ou um arquivo do computador.
 * Serve ao retrato, ao token e ao mapa; quem usa decide o que fazer com o arquivo.
 */
export function SeletorDeImagem({ titulo, fontes, processador, aoEscolher, aoFechar }: Props) {
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  const [arquivos, setArquivos] = useState<ArquivoDaFonte[]>([]);
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  useFecharFora(caixa, () => !ocupado && aoFechar());
  const versaoDasFontes = fontes.versaoAtual();

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
  }, [fontes, versaoDasFontes]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      for (const a of arquivos.slice(0, MAX_MINIATURAS)) {
        if (cancelado) return;
        if (miniaturas[a.id] !== undefined) continue;
        try {
          const url = URL.createObjectURL(await processador.miniatura(await a.abrir()));
          if (cancelado) {
            URL.revokeObjectURL(url);
            return;
          }
          setMiniaturas((m) => ({ ...m, [a.id]: url }));
        } catch {
          setMiniaturas((m) => ({ ...m, [a.id]: "" }));
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [arquivos, processador, miniaturas]);

  async function usar(obter: () => Promise<File>) {
    if (ocupado) return;
    setOcupado(true);
    setMensagem("Processando…");
    try {
      await aoEscolher(await obter());
      aoFechar();
    } catch (e) {
      setMensagem((e as Error).message);
      setOcupado(false);
    }
  }

  return (
    <div className="fundo-modal" data-testid="seletor-imagem-fundo">
      <div
        ref={caixa}
        className="modal modal-seletor"
        role="dialog"
        aria-label={titulo}
        data-testid="seletor-imagem"
      >
        <header className="cabecalho-modal">
          <strong>{titulo}</strong>
          <BotaoComDica
            className="botao-icone pequeno"
            testid="seletor-fechar"
            nome="Fechar"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <X size={16} />
          </BotaoComDica>
        </header>
        <p className="nota">As imagens ficam no seu computador: a mesa só recebe o que você usa.</p>
        <div className="linha-botoes">
          <button
            type="button"
            data-testid="seletor-escolher-arquivo"
            disabled={ocupado}
            onClick={() => entrada.current?.click()}
          >
            <FolderOpen size={16} /> Escolher arquivo…
          </button>
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            hidden
            data-testid="seletor-arquivo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void usar(async () => f);
            }}
          />
        </div>
        {arquivos.length > 0 ? (
          <ul className="miniaturas" data-testid="seletor-lista">
            {arquivos.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="miniatura"
                  data-testid="seletor-item"
                  data-nome={a.nome}
                  disabled={ocupado}
                  onClick={() => void usar(() => a.abrir())}
                >
                  {miniaturas[a.id] ? (
                    <img src={miniaturas[a.id]} alt="" />
                  ) : (
                    <span className="sem-imagem" />
                  )}
                  <span className="nome">{a.nome}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nota">
            Nenhuma imagem na pasta local. Escolha a pasta em Configurações ou use um arquivo.
          </p>
        )}
        {mensagem && (
          <p className="nota" role="status" data-testid="seletor-mensagem">
            {mensagem}
          </p>
        )}
      </div>
    </div>
  );
}
