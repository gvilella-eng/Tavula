import type { Cena, Trilha } from "@tabletop/shared";
import { Music2, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Fontes } from "./assets/fontes";
import { noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { Deslizante } from "./som/Deslizante";
import { EscolherSom, type SomEscolhido } from "./som/EscolherSom";
import { mudarPrefsDeSom, usePrefsDeSom } from "./som/prefsDeSom";

type Props = {
  /** A trilha que toca agora (a da sala). */
  trilha: Trilha | null;
  /** A cena que o mestre está vendo: tem a trilha padrão dela. */
  cena: Cena;
  fontes: Fontes;
  registrar: (arquivo: File) => Promise<SomEscolhido>;
  enviar: (tipo: string, dados: object) => string | null;
  aoFechar: () => void;
};

const VOLUME_PADRAO = 0.8;

/**
 * N5: o painel de Som do mestre. Trilha (um som por vez, em laço: tocar, parar, volume; trocar faz uma transição de
 * 2 s), a trilha padrão da cena (começa ao levar o grupo para ela) e os efeitos (um clique, uma vez). Cada lista mostra os
 * sons da pasta, com busca. Quem manda no que toca é o mestre; quem ouve é todo mundo conectado.
 */
export function PainelDoSom(p: Props) {
  const prefs = usePrefsDeSom();
  // O volume com que o próximo som sai: o da trilha que toca, ou o último que o mestre deixou.
  const [volumeDaTrilha, setVolumeDaTrilha] = useState(p.trilha?.volume ?? VOLUME_PADRAO);
  const [volumeDosEfeitos, setVolumeDosEfeitos] = useState(VOLUME_PADRAO);
  const hashDaTrilha = p.trilha?.hash;
  const volumeDaSala = p.trilha?.volume;
  useEffect(() => {
    if (volumeDaSala !== undefined) setVolumeDaTrilha(volumeDaSala);
  }, [volumeDaSala]);

  // O volume vai ao soltar, com um respiro, para não mandar um frame por pixel.
  const envio = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(envio.current), []);
  function mudarVolumeDaTrilha(v: number) {
    setVolumeDaTrilha(v);
    if (hashDaTrilha === undefined) return;
    clearTimeout(envio.current);
    envio.current = setTimeout(
      () => p.enviar("som.trilha", { hash: hashDaTrilha, volume: v }),
      120,
    );
  }

  const padrao = p.cena.trilha;

  return (
    <Janela
      id="som"
      titulo="Som"
      icone={<Volume2 size={14} />}
      testid="painel-som"
      classeDoCorpo="painel-token painel-som"
      padrao={noCanto("topo-esquerda", 72, 64)}
      largura={272}
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar o painel de som"
      testidDoFechar="som-fechar"
    >
      <fieldset className="quem-controla" data-testid="som-trilha">
        <legend>Trilha</legend>
        <p
          className="som-agora"
          data-testid="som-trilha-agora"
          data-tocando={p.trilha ? "sim" : "nao"}
        >
          <Music2 size={14} aria-hidden="true" />
          <span>{p.trilha ? p.trilha.nome : "Parada"}</span>
        </p>
        <Deslizante
          testid="som-trilha-volume"
          rotulo="Volume da trilha"
          valor={volumeDaTrilha}
          aoMudar={mudarVolumeDaTrilha}
        />
        <div className="linha-botoes">
          <button
            type="button"
            data-testid="som-trilha-parar"
            disabled={!p.trilha}
            onClick={() => p.enviar("som.parar", {})}
          >
            <Square size={14} aria-hidden="true" /> Parar
          </button>
        </div>
        <EscolherSom
          fontes={p.fontes}
          registrar={p.registrar}
          testid="som-trilha-escolher"
          aoEscolher={(s) => p.enviar("som.trilha", { hash: s.hash, volume: volumeDaTrilha })}
        />
        <p className="nota" data-testid="som-cena-trilha">
          Trilha desta cena: {padrao ? padrao.nome : "nenhuma"}
        </p>
        <div className="linha-botoes">
          <button
            type="button"
            data-testid="som-cena-usar"
            disabled={!p.trilha}
            onClick={() =>
              p.trilha &&
              p.enviar("cena.editar", {
                cenaId: p.cena.id,
                trilha: { hash: p.trilha.hash, nome: p.trilha.nome, volume: p.trilha.volume },
              })
            }
          >
            Usar a que toca
          </button>
          <button
            type="button"
            data-testid="som-cena-tirar"
            disabled={!padrao}
            onClick={() => p.enviar("cena.editar", { cenaId: p.cena.id, trilha: null })}
          >
            Tirar
          </button>
        </div>
      </fieldset>
      <fieldset className="quem-controla" data-testid="som-efeitos">
        <legend>Efeitos</legend>
        <p className="nota">Um clique toca o som uma vez, para todos.</p>
        <Deslizante
          testid="som-efeitos-volume"
          rotulo="Volume dos efeitos"
          valor={volumeDosEfeitos}
          aoMudar={setVolumeDosEfeitos}
        />
        <EscolherSom
          fontes={p.fontes}
          registrar={p.registrar}
          testid="som-efeito"
          aoEscolher={(s) => p.enviar("som.efeito", { hash: s.hash, volume: volumeDosEfeitos })}
        />
      </fieldset>
      <label className="som-opcao">
        <input
          type="checkbox"
          data-testid="som-ouvir-zonas"
          checked={prefs.ouvirZonas}
          onChange={(e) => mudarPrefsDeSom({ ouvirZonas: e.target.checked })}
        />
        Ouvir as zonas do token selecionado
      </label>
    </Janela>
  );
}
