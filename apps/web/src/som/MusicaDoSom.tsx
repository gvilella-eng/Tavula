import { duracaoLegivel, type Estado, faixasDoFiltro } from "@tabletop/shared";
import { Pause, Play, Settings, SkipBack, SkipForward, Undo2, Volume2 } from "lucide-react";
import type { CSSProperties } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { Deslizante } from "./Deslizante";
import { CORES, ICONES } from "./iconesDoSom";
import { useEnvioAdiado } from "./modoDoSom";
import { useMusicaAgora } from "./useMusicaAgora";

type Props = {
  estado: Estado;
  enviar: (tipo: string, dados: object) => string | null;
  /** Abre a configuração da mesa de som na aba Música. */
  aoConfigurar: () => void;
};

/**
 * MU1: o corpo da seção Música da mesa de som: os botões grandes (filtros salvos, com quantas músicas cada um tem), a música
 * que toca com anterior, pausar e próxima, o progresso, o volume e "Voltar a <botão anterior>". Só o mestre vê e controla.
 */
export function MusicaDoSom({ estado, enviar, aoConfigurar }: Props) {
  const adiar = useEnvioAdiado();
  const botoes = estado.musica?.botoes ?? [];
  const faixas = estado.musica?.faixas ?? [];
  const tocandoM = estado.musicaTocando ?? null;
  const agora = useMusicaAgora(tocandoM);

  if (botoes.length === 0) {
    return (
      <div className="musica-vazia" data-testid="musica-vazia">
        <p>{faixas.length > 0 ? "Nenhum botão de música ainda" : "Nenhuma música na mesa ainda"}</p>
        <button
          type="button"
          className="som-botao-com-icone"
          data-testid="musica-configurar"
          onClick={aoConfigurar}
        >
          <Settings size={14} aria-hidden="true" />
          {faixas.length > 0 ? "Criar um botão" : "Adicionar músicas"}
        </button>
      </div>
    );
  }

  function apertar(id: string) {
    if (tocandoM?.botaoId === id) {
      // O botão que já toca: pausa e retoma.
      enviar("musica.controle", { acao: tocandoM.tocando ? "pausar" : "retomar" });
      return;
    }
    enviar("musica.tocar", { botaoId: id });
  }

  const duracao = agora?.peca.duracaoMs ?? 0;
  const progresso = agora && duracao > 0 ? Math.min(1, agora.pontoMs / duracao) : 0;

  return (
    <div className="musica-corpo" data-testid="musica-corpo">
      <div className="musica-botoes" data-testid="musica-botoes">
        {botoes.map((b) => {
          const qtd = faixasDoFiltro(faixas, b).length;
          const { Icone } = ICONES[b.icone];
          const ativo = tocandoM?.botaoId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              className="musica-botao"
              style={{ "--cor-do-som": CORES[b.cor].variavel } as CSSProperties}
              data-testid="musica-botao"
              data-nome={b.nome}
              data-ativo={ativo ? (tocandoM?.tocando ? "tocando" : "pausado") : "nao"}
              aria-pressed={ativo && tocandoM?.tocando === true}
              disabled={qtd === 0}
              title={qtd === 0 ? "Nenhuma música neste filtro" : undefined}
              onClick={() => apertar(b.id)}
            >
              <Icone size={17} aria-hidden="true" />
              <span className="musica-botao-nome">{b.nome}</span>
              <span className="musica-botao-qtd">{qtd}</span>
            </button>
          );
        })}
      </div>
      {tocandoM ? (
        <div className="musica-player" data-testid="musica-player">
          <BotaoComDica
            testid="musica-anterior"
            nome="Música anterior"
            className="musica-ctl"
            onClick={() => enviar("musica.controle", { acao: "anterior" })}
          >
            <SkipBack size={15} fill="currentColor" aria-hidden="true" />
          </BotaoComDica>
          <BotaoComDica
            testid="musica-pausar"
            nome={tocandoM.tocando ? "Pausar a música" : "Tocar a música"}
            className="musica-ctl musica-ctl-forte"
            data-tocando={tocandoM.tocando ? "sim" : "nao"}
            onClick={() =>
              enviar("musica.controle", { acao: tocandoM.tocando ? "pausar" : "retomar" })
            }
          >
            {tocandoM.tocando ? (
              <Pause size={15} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={15} fill="currentColor" aria-hidden="true" />
            )}
          </BotaoComDica>
          <BotaoComDica
            testid="musica-proxima"
            nome="Próxima música"
            className="musica-ctl"
            onClick={() => enviar("musica.controle", { acao: "proxima" })}
          >
            <SkipForward size={15} fill="currentColor" aria-hidden="true" />
          </BotaoComDica>
          <div className="musica-atual">
            <div className="musica-atual-linha">
              <span className="musica-atual-nome" data-testid="musica-atual">
                {agora?.peca.nome ?? "—"}
              </span>
              <span className="musica-atual-tempo">
                {duracaoLegivel(agora?.pontoMs ?? 0)} / {duracaoLegivel(duracao)}
              </span>
            </div>
            <div className="musica-progresso" aria-hidden="true">
              <div
                className="musica-progresso-cheio"
                style={{ width: `${Math.round(progresso * 100)}%` }}
              />
            </div>
          </div>
          {tocandoM.anterior && (
            <button
              type="button"
              className="musica-voltar"
              data-testid="musica-voltar"
              onClick={() => enviar("musica.controle", { acao: "voltar" })}
            >
              <Undo2 size={14} aria-hidden="true" />
              Voltar a {tocandoM.anterior.botaoNome}
            </button>
          )}
          <span className="musica-volume">
            <Volume2 size={14} aria-hidden="true" />
            <Deslizante
              classe="musica-volume-desliz"
              testid="musica-volume"
              rotulo="Volume da música"
              valor={tocandoM.volume}
              aoMudar={(v) => adiar("musica-volume", () => enviar("musica.volume", { volume: v }))}
            />
          </span>
        </div>
      ) : (
        <p className="nota musica-dica" data-testid="musica-dica">
          Aperte um botão para tocar para todos.
        </p>
      )}
    </div>
  );
}
