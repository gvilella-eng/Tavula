/** Um erro que a ferramenta devolve à IA como texto: a mensagem diz o que corrigir, em português. */
export class ErroDoMcp extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDoMcp";
  }
}

export const TOKEN_INVALIDO =
  "Token inválido ou revogado: gere outro em Preferências → Conectar o Claude.";
