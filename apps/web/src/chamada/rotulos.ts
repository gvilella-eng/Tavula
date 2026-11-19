import {
  ambientesLigados,
  type Estado,
  lugarDe,
  tocandoAgora,
  type Usuario,
} from "@tabletop/shared";

// CH1: textos que a janela da chamada tira do estado da mesa (puros, para a tela e os testes).

/** O personagem de um jogador (o primeiro que ele edita); o mestre aparece como "Mestre". */
export function rotuloDoPapel(estado: Pick<Estado, "personagens">, u: Usuario): string {
  if (u.papel === "mestre") return "Mestre";
  const p = estado.personagens.find(
    (x) => x.editores.tipo === "jogadores" && x.editores.ids.includes(u.id),
  );
  return p ? p.nome : u.papel === "assistente" ? "Assistente" : "Jogador";
}

/**
 * O que a mesa de som toca agora, para o quadro "Trilha da mesa". Com música tocando (MU1) mostra o nome da música
 * (`nomeDaMusica`, que a tela acha pela fila e pelo relógio da sala) e o do botão; sem música tocando, os ambientes, como
 * antes (o jogador não vê os nomes dos ambientes: só que toca). `musica` diz se há música tocando, pausada ou nenhuma.
 */
export function trilhaDaMesa(
  estado: Pick<Estado, "somLigado" | "mesaDeSom" | "musicaTocando">,
  nomeDaMusica?: string,
): {
  tocando: boolean;
  titulo: string;
  subtitulo?: string;
  musica: "tocando" | "pausada" | null;
} {
  const m = estado.musicaTocando;
  if (m?.tocando && nomeDaMusica) {
    return {
      tocando: true,
      titulo: nomeDaMusica,
      subtitulo: `Música · ${m.botaoNome}`,
      musica: "tocando",
    };
  }
  const musica = m ? (m.tocando ? "tocando" : "pausada") : null;
  if (!tocandoAgora(estado)) {
    return {
      tocando: false,
      titulo: "Nada tocando",
      ...(m && !m.tocando ? { subtitulo: `Música pausada · ${m.botaoNome}` } : {}),
      musica,
    };
  }
  const nomes = ambientesLigados(estado)
    .map((a) => lugarDe(estado.mesaDeSom, "ambiente", a.indice)?.nome)
    .filter((n): n is string => typeof n === "string" && n !== "");
  return {
    tocando: true,
    titulo: nomes.length > 0 ? nomes.join(" · ") : "Música ambiente",
    ...(m && !m.tocando ? { subtitulo: `Música pausada · ${m.botaoNome}` } : {}),
    musica,
  };
}
