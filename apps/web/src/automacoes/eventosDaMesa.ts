import {
  automacoesDe,
  type CorDoSom,
  type Estado,
  type IconeDoSom,
  idDoBotaoDeEvento,
  noDeGatilhoDoTipo,
} from "@tabletop/shared";
import { useCallback, useState } from "react";

// A mesa de eventos (AU2): só botões grandes, um para cada automação cujo gatilho é um botão. Aqui, o que ela mostra e a
// preferência de como aparecer (como a mesa de som: janela flutuante ou faixa no pé da tela, só neste navegador).

export type BotaoDeEvento = {
  /** O id do botão para o `botao.usar` (`evento:<fluxo>`). */
  botaoId: string;
  fluxoId: string;
  nome: string;
  cor: CorDoSom;
  icone: IconeDoSom;
  ligada: boolean;
};

export const COR_PADRAO_DO_BOTAO: CorDoSom = "ambar";
export const ICONE_PADRAO_DO_BOTAO: IconeDoSom = "chama";

/**
 * Os botões da mesa de eventos. O mestre vê todas as automações com gatilho de botão (as desligadas aparecem apagadas; o
 * rascunho do Claude não). O jogador vê só as que o mestre liberou (o que a sala lhe manda em `estado.botoes`: nada da
 * definição), com o rótulo, a cor e o ícone.
 */
export function botoesDaMesaDeEventos(estado: Estado, euMestre: boolean): BotaoDeEvento[] {
  if (euMestre) {
    return automacoesDe(estado).fluxos.flatMap((f): BotaoDeEvento[] => {
      const g = noDeGatilhoDoTipo(f, "botao")?.config;
      if (g?.tipo !== "botao" || f.rascunho === true) return [];
      return [
        {
          botaoId: idDoBotaoDeEvento(f.id),
          fluxoId: f.id,
          nome: g.nome,
          cor: g.cor ?? COR_PADRAO_DO_BOTAO,
          icone: g.icone ?? ICONE_PADRAO_DO_BOTAO,
          ligada: f.ligado,
        },
      ];
    });
  }
  return (estado.botoes ?? []).flatMap((b): BotaoDeEvento[] =>
    b.tipo === "evento"
      ? [
          {
            botaoId: b.id,
            fluxoId: b.id.replace(/^evento:/, ""),
            nome: b.rotulo ?? b.nome,
            cor: b.cor ?? COR_PADRAO_DO_BOTAO,
            icone: b.icone ?? ICONE_PADRAO_DO_BOTAO,
            ligada: true,
          },
        ]
      : [],
  );
}

// --- Como a mesa de eventos aparece (preferência pessoal; nunca vai para a sala) ---

export type ModoDosEventos = "janela" | "faixa";
export const CHAVE_MODO_DOS_EVENTOS = "tabletop:pref:eventos-modo";
export const CHAVE_EVENTOS_RECOLHIDA = "tabletop:pref:eventos-recolhida";

export function lerModoDosEventos(): ModoDosEventos {
  try {
    return localStorage.getItem(CHAVE_MODO_DOS_EVENTOS) === "faixa" ? "faixa" : "janela";
  } catch {
    return "janela";
  }
}

function lerRecolhida(): boolean {
  try {
    return localStorage.getItem(CHAVE_EVENTOS_RECOLHIDA) === "1";
  } catch {
    return false;
  }
}

/** O modo e o recolhimento da faixa, lembrados por pessoa (o localStorage pode estar bloqueado). */
export function useModoDosEventos() {
  const [modo, setModo] = useState<ModoDosEventos>(lerModoDosEventos);
  const [recolhida, setRecolhida] = useState<boolean>(lerRecolhida);
  const mudarModo = useCallback((m: ModoDosEventos) => {
    setModo(m);
    try {
      localStorage.setItem(CHAVE_MODO_DOS_EVENTOS, m);
    } catch {
      // sem localStorage: vale só até fechar a página
    }
  }, []);
  const mudarRecolhida = useCallback((r: boolean) => {
    setRecolhida(r);
    try {
      localStorage.setItem(CHAVE_EVENTOS_RECOLHIDA, r ? "1" : "0");
    } catch {
      // idem
    }
  }, []);
  return { modo, mudarModo, recolhida, mudarRecolhida };
}
