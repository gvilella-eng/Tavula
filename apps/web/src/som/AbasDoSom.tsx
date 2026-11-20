import { SeletorSegmentado } from "../SeletorSegmentado";
import { ABAS_DO_SOM, type AbaDoSom } from "./abaDoSom";

type Props = {
  aba: AbaDoSom;
  aoMudar: (aba: AbaDoSom) => void;
  /** O que toca em Efeitos e ambientes ("2 ambientes ligados" ou "nada tocando"); vai só no rótulo acessível. */
  efeitos: { estado: string; toca: boolean };
  /** O que toca em Música: o nome do botão e se está tocando ou pausada; sem nome, "parada". */
  musica: { nome: string | null; tocando: boolean; toca: boolean };
};

export const NOMES_DAS_ABAS: Record<AbaDoSom, string> = {
  efeitos: "Efeitos e ambientes",
  musica: "Música",
};

/**
 * MU3: a barra de abas da mesa de som, no mesmo seletor segmentado da ficha ("Personagem | NPC"). Sem subtítulo: o
 * estado de cada aba vai só no rótulo acessível, e um ponto marca a aba escondida que tem algo tocando. Setas (e Home e
 * End) trocam de aba.
 */
export function AbasDoSom({ aba, aoMudar, efeitos, musica }: Props) {
  const estadoDaMusica = musica.nome
    ? `${musica.nome}${musica.tocando ? "" : " (pausada)"}`
    : "parada";
  const estados: Record<AbaDoSom, string> = { efeitos: efeitos.estado, musica: estadoDaMusica };
  const tocam: Record<AbaDoSom, boolean> = { efeitos: efeitos.toca, musica: musica.toca };

  return (
    <div className="som-abas">
      <SeletorSegmentado<AbaDoSom>
        modo="abas"
        rotulo="Partes da mesa de som"
        testid="som-abas"
        valor={aba}
        aoMudar={aoMudar}
        itens={ABAS_DO_SOM.map((id) => {
          const escondidaTocando = aba !== id && tocam[id];
          return {
            id,
            nome: NOMES_DAS_ABAS[id],
            testid: `som-aba-${id}`,
            elementoId: `som-aba-${id}`,
            controla: `som-painel-${id}`,
            rotulo: `${NOMES_DAS_ABAS[id]}: ${estados[id]}${escondidaTocando ? " (tocando)" : ""}`,
            ponto: escondidaTocando ? { testid: `som-aba-${id}-ponto` } : undefined,
          };
        })}
      />
    </div>
  );
}
