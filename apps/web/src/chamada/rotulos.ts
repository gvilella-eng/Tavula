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

/** O que a mesa de som toca agora, para o quadro "Trilha da mesa". Sem nomes (jogador não os vê): só diz que toca. */
export function trilhaDaMesa(estado: Pick<Estado, "somLigado" | "mesaDeSom">): {
  tocando: boolean;
  titulo: string;
} {
  if (!tocandoAgora(estado)) return { tocando: false, titulo: "Nada tocando" };
  const nomes = ambientesLigados(estado)
    .map((a) => lugarDe(estado.mesaDeSom, "ambiente", a.indice)?.nome)
    .filter((n): n is string => typeof n === "string" && n !== "");
  return { tocando: true, titulo: nomes.length > 0 ? nomes.join(" · ") : "Música ambiente" };
}
