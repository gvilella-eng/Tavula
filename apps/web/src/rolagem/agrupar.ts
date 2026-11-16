import type { Mensagem } from "@tabletop/shared";

/** A mensagem é um cartão de rolagem (teste, ataque, dado de vida ou `/r`), não uma frase com `[[...]]`. */
export function ehCartaoDeRolagem(m: Mensagem): boolean {
  return (m.tipo === "modelo" && !!m.modelo) || (m.tipo === "rolagem" && !m.inline);
}

/** Dois cartões de rolagem seguidos do mesmo remetente (e do mesmo personagem) dividem o cabeçalho (Q5). */
export function continuaORemetente(anterior: Mensagem | undefined, m: Mensagem): boolean {
  if (!anterior || !ehCartaoDeRolagem(anterior) || !ehCartaoDeRolagem(m)) return false;
  return (
    anterior.autorId === m.autorId &&
    anterior.como?.personagemId === m.como?.personagemId &&
    !!anterior.peloClaude === !!m.peloClaude &&
    !!anterior.oculta === !!m.oculta &&
    m.emReal - anterior.emReal < 180_000
  );
}
